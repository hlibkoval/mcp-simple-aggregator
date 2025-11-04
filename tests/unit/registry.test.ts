import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { ToolSchema, ToolRegistry, ToolRegistryEntry } from '../../src/types.js';

// Import the functions we'll implement
import {
  buildToolRegistry,
  addServerTools,
  removeServerTools,
  lookupTool
} from '../../src/registry.js';

/**
 * Test Suite: Tool Registry
 *
 * Tasks:
 * - T067 [US2] Build registry from single child server
 * - T068 [P] [US2] Build registry from multiple child servers
 * - T069 [P] [US2] Prefix tools with serverKey
 * - T070 [P] [US2] Handle duplicate tool names from different servers
 * - T071 [P] [US2] Preserve original tool name for routing
 * - T072 [P] [US2] Remove tools when server crashes
 * - T073 [P] [US2] Lookup tool by prefixed name in O(1) time
 */

describe('Tool Registry', () => {
  let mockClient1: Client;
  let mockClient2: Client;
  let mockClient3: Client;

  beforeEach(() => {
    // Create mock clients for testing
    mockClient1 = {
      listTools: vi.fn(),
      callTool: vi.fn(),
      connect: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    } as unknown as Client;

    mockClient2 = {
      listTools: vi.fn(),
      callTool: vi.fn(),
      connect: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    } as unknown as Client;

    mockClient3 = {
      listTools: vi.fn(),
      callTool: vi.fn(),
      connect: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    } as unknown as Client;
  });

  // T067 [US2] Write test: Build registry from single child server
  describe('buildToolRegistry', () => {
    it('should build registry from single child server', async () => {
      const tools: ToolSchema[] = [
        {
          name: 'read_file',
          description: 'Read a file',
          inputSchema: {
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path']
          }
        },
        {
          name: 'write_file',
          description: 'Write a file',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['path', 'content']
          }
        }
      ];

      vi.mocked(mockClient1.listTools).mockResolvedValue({ tools });

      const childClients = new Map([['filesystem', mockClient1]]);
      const registry = await buildToolRegistry(childClients);

      // Should have 2 entries
      expect(registry.size).toBe(2);

      // Should have prefixed names
      expect(registry.has('filesystem:read_file')).toBe(true);
      expect(registry.has('filesystem:write_file')).toBe(true);

      // Verify client was called
      expect(mockClient1.listTools).toHaveBeenCalledTimes(1);
    });

    // T068 [P] [US2] Write test: Build registry from multiple child servers
    it('should build registry from multiple child servers', async () => {
      const filesystemTools: ToolSchema[] = [
        {
          name: 'read_file',
          description: 'Read a file',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'write_file',
          description: 'Write a file',
          inputSchema: { type: 'object', properties: {} }
        }
      ];

      const postgresTools: ToolSchema[] = [
        {
          name: 'query',
          description: 'Execute SQL query',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'execute',
          description: 'Execute SQL command',
          inputSchema: { type: 'object', properties: {} }
        }
      ];

      const githubTools: ToolSchema[] = [
        {
          name: 'create_issue',
          description: 'Create GitHub issue',
          inputSchema: { type: 'object', properties: {} }
        }
      ];

      vi.mocked(mockClient1.listTools).mockResolvedValue({ tools: filesystemTools });
      vi.mocked(mockClient2.listTools).mockResolvedValue({ tools: postgresTools });
      vi.mocked(mockClient3.listTools).mockResolvedValue({ tools: githubTools });

      const childClients = new Map([
        ['filesystem', mockClient1],
        ['postgres', mockClient2],
        ['github', mockClient3]
      ]);

      const registry = await buildToolRegistry(childClients);

      // Should have 5 total tools
      expect(registry.size).toBe(5);

      // Verify all prefixed names exist
      expect(registry.has('filesystem:read_file')).toBe(true);
      expect(registry.has('filesystem:write_file')).toBe(true);
      expect(registry.has('postgres:query')).toBe(true);
      expect(registry.has('postgres:execute')).toBe(true);
      expect(registry.has('github:create_issue')).toBe(true);

      // All clients should be called
      expect(mockClient1.listTools).toHaveBeenCalledTimes(1);
      expect(mockClient2.listTools).toHaveBeenCalledTimes(1);
      expect(mockClient3.listTools).toHaveBeenCalledTimes(1);
    });
  });

  // T069 [P] [US2] Write test: Prefix tools with serverKey
  describe('addServerTools', () => {
    it('should prefix tools with serverKey', () => {
      const registry: ToolRegistry = new Map();
      const tools: ToolSchema[] = [
        {
          name: 'search_code',
          description: 'Search code',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'get_file',
          description: 'Get file',
          inputSchema: { type: 'object', properties: {} }
        }
      ];

      addServerTools(registry, 'sourcebot', mockClient1, tools);

      // Check prefixed names exist
      expect(registry.has('sourcebot:search_code')).toBe(true);
      expect(registry.has('sourcebot:get_file')).toBe(true);

      // Verify registry entries
      const entry1 = registry.get('sourcebot:search_code');
      expect(entry1?.serverKey).toBe('sourcebot');
      expect(entry1?.client).toBe(mockClient1);

      const entry2 = registry.get('sourcebot:get_file');
      expect(entry2?.serverKey).toBe('sourcebot');
      expect(entry2?.client).toBe(mockClient1);
    });
  });

  // T070 [P] [US2] Write test: Handle duplicate tool names from different servers
  it('should handle duplicate tool names from different servers', () => {
    const registry: ToolRegistry = new Map();

    const tool1: ToolSchema = {
      name: 'query',
      description: 'Postgres query',
      inputSchema: { type: 'object', properties: {} }
    };

    const tool2: ToolSchema = {
      name: 'query',
      description: 'MongoDB query',
      inputSchema: { type: 'object', properties: {} }
    };

    // Add same tool name from different servers
    addServerTools(registry, 'postgres', mockClient1, [tool1]);
    addServerTools(registry, 'mongodb', mockClient2, [tool2]);

    // Both should exist with different prefixes
    expect(registry.size).toBe(2);
    expect(registry.has('postgres:query')).toBe(true);
    expect(registry.has('mongodb:query')).toBe(true);

    // Should route to different clients
    const postgresEntry = registry.get('postgres:query');
    const mongoEntry = registry.get('mongodb:query');

    expect(postgresEntry?.client).toBe(mockClient1);
    expect(mongoEntry?.client).toBe(mockClient2);
    expect(postgresEntry?.client).not.toBe(mongoEntry?.client);
  });

  // T071 [P] [US2] Write test: Preserve original tool name for routing
  it('should preserve original tool name for routing', () => {
    const registry: ToolRegistry = new Map();
    const tools: ToolSchema[] = [
      {
        name: 'read_file',
        description: 'Read a file',
        inputSchema: { type: 'object', properties: {} }
      }
    ];

    addServerTools(registry, 'filesystem', mockClient1, tools);

    const entry = registry.get('filesystem:read_file');

    // Original name should be preserved
    expect(entry?.originalName).toBe('read_file');

    // Schema should have prefixed name
    expect(entry?.schema.name).toBe('filesystem:read_file');

    // But original name is stored for routing back to child
    expect(entry?.originalName).not.toContain(':');
  });

  // T072 [P] [US2] Write test: Remove tools when server crashes
  describe('removeServerTools', () => {
    it('should remove all tools from a crashed server', () => {
      const registry: ToolRegistry = new Map();

      // Add tools from multiple servers
      const fsTools: ToolSchema[] = [
        { name: 'read_file', description: 'Read', inputSchema: { type: 'object' } },
        { name: 'write_file', description: 'Write', inputSchema: { type: 'object' } }
      ];

      const pgTools: ToolSchema[] = [
        { name: 'query', description: 'Query', inputSchema: { type: 'object' } },
        { name: 'execute', description: 'Execute', inputSchema: { type: 'object' } }
      ];

      addServerTools(registry, 'filesystem', mockClient1, fsTools);
      addServerTools(registry, 'postgres', mockClient2, pgTools);

      expect(registry.size).toBe(4);

      // Remove filesystem tools
      removeServerTools(registry, 'filesystem');

      // Only postgres tools should remain
      expect(registry.size).toBe(2);
      expect(registry.has('filesystem:read_file')).toBe(false);
      expect(registry.has('filesystem:write_file')).toBe(false);
      expect(registry.has('postgres:query')).toBe(true);
      expect(registry.has('postgres:execute')).toBe(true);
    });

    it('should handle removing server that does not exist', () => {
      const registry: ToolRegistry = new Map();

      addServerTools(registry, 'filesystem', mockClient1, [
        { name: 'read_file', description: 'Read', inputSchema: { type: 'object' } }
      ]);

      expect(registry.size).toBe(1);

      // Remove non-existent server (should not error)
      removeServerTools(registry, 'nonexistent');

      // Registry should remain unchanged
      expect(registry.size).toBe(1);
      expect(registry.has('filesystem:read_file')).toBe(true);
    });

    it('should only remove tools with exact serverKey prefix', () => {
      const registry: ToolRegistry = new Map();

      // Add tools with similar prefixes
      addServerTools(registry, 'db', mockClient1, [
        { name: 'query', description: 'Query', inputSchema: { type: 'object' } }
      ]);

      addServerTools(registry, 'db2', mockClient2, [
        { name: 'query', description: 'Query', inputSchema: { type: 'object' } }
      ]);

      addServerTools(registry, 'database', mockClient3, [
        { name: 'query', description: 'Query', inputSchema: { type: 'object' } }
      ]);

      expect(registry.size).toBe(3);

      // Remove only 'db' server
      removeServerTools(registry, 'db');

      // Should remove only 'db:query', not 'db2:query' or 'database:query'
      expect(registry.size).toBe(2);
      expect(registry.has('db:query')).toBe(false);
      expect(registry.has('db2:query')).toBe(true);
      expect(registry.has('database:query')).toBe(true);
    });
  });

  // T073 [P] [US2] Write test: Lookup tool by prefixed name in O(1) time
  describe('lookupTool', () => {
    it('should lookup tool by prefixed name in O(1) time', () => {
      const registry: ToolRegistry = new Map();

      // Add many tools to simulate performance
      for (let i = 0; i < 100; i++) {
        addServerTools(registry, `server${i}`, mockClient1, [
          {
            name: `tool${i}`,
            description: `Tool ${i}`,
            inputSchema: { type: 'object' }
          }
        ]);
      }

      expect(registry.size).toBe(100);

      // Lookup should be O(1) - Map.get()
      const startTime = performance.now();
      const entry = lookupTool(registry, 'server50:tool50');
      const endTime = performance.now();

      // Should find the tool
      expect(entry).toBeDefined();
      expect(entry?.originalName).toBe('tool50');
      expect(entry?.serverKey).toBe('server50');

      // Should be extremely fast (< 1ms for O(1) lookup)
      const lookupTime = endTime - startTime;
      expect(lookupTime).toBeLessThan(1);
    });

    it('should return undefined for non-existent tool', () => {
      const registry: ToolRegistry = new Map();

      addServerTools(registry, 'filesystem', mockClient1, [
        { name: 'read_file', description: 'Read', inputSchema: { type: 'object' } }
      ]);

      const result = lookupTool(registry, 'filesystem:write_file');
      expect(result).toBeUndefined();
    });

    it('should return undefined for tool without prefix', () => {
      const registry: ToolRegistry = new Map();

      addServerTools(registry, 'filesystem', mockClient1, [
        { name: 'read_file', description: 'Read', inputSchema: { type: 'object' } }
      ]);

      // Query without prefix
      const result = lookupTool(registry, 'read_file');
      expect(result).toBeUndefined();
    });

    it('should return correct client for routing', () => {
      const registry: ToolRegistry = new Map();

      addServerTools(registry, 'server1', mockClient1, [
        { name: 'tool1', description: 'Tool 1', inputSchema: { type: 'object' } }
      ]);

      addServerTools(registry, 'server2', mockClient2, [
        { name: 'tool2', description: 'Tool 2', inputSchema: { type: 'object' } }
      ]);

      const entry1 = lookupTool(registry, 'server1:tool1');
      const entry2 = lookupTool(registry, 'server2:tool2');

      expect(entry1?.client).toBe(mockClient1);
      expect(entry2?.client).toBe(mockClient2);
    });
  });

  // Additional edge cases
  describe('edge cases', () => {
    it('should handle empty tool list', () => {
      const registry: ToolRegistry = new Map();
      addServerTools(registry, 'empty-server', mockClient1, []);

      expect(registry.size).toBe(0);
    });

    it('should handle server with tools containing special characters', () => {
      const registry: ToolRegistry = new Map();
      const tools: ToolSchema[] = [
        {
          name: 'get_user-profile',
          description: 'Get user profile',
          inputSchema: { type: 'object' }
        },
        {
          name: 'list_all_items',
          description: 'List items',
          inputSchema: { type: 'object' }
        }
      ];

      addServerTools(registry, 'api-server', mockClient1, tools);

      expect(registry.has('api-server:get_user-profile')).toBe(true);
      expect(registry.has('api-server:list_all_items')).toBe(true);
    });

    it('should preserve tool schema properties', () => {
      const registry: ToolRegistry = new Map();
      const complexTool: ToolSchema = {
        name: 'complex_query',
        description: 'A complex database query tool',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'SQL query' },
            params: { type: 'array', items: { type: 'string' } },
            timeout: { type: 'number', default: 30 }
          },
          required: ['query']
        }
      };

      addServerTools(registry, 'database', mockClient1, [complexTool]);

      const entry = lookupTool(registry, 'database:complex_query');

      // Schema should be preserved with prefixed name
      expect(entry?.schema.name).toBe('database:complex_query');
      expect(entry?.schema.description).toBe('A complex database query tool');
      expect(entry?.schema.inputSchema.properties).toEqual(complexTool.inputSchema.properties);
      expect(entry?.schema.inputSchema.required).toEqual(['query']);
    });
  });

  describe('T003: [US1] buildToolRegistry with default separator', () => {
    it('should use default colon separator when no separator parameter provided', async () => {
      const tools: ToolSchema[] = [
        {
          name: 'search',
          description: 'Search tool',
          inputSchema: { type: 'object' }
        }
      ];

      vi.mocked(mockClient1.listTools).mockResolvedValue({ tools });

      const childClients = new Map([['github', mockClient1]]);
      const registry = await buildToolRegistry(childClients);

      // Should use default colon separator
      expect(registry.has('github:search')).toBe(true);
      const entry = lookupTool(registry, 'github:search');
      expect(entry?.schema.name).toBe('github:search');
      expect(entry?.originalName).toBe('search');
    });

    it('should use default colon separator for multiple servers', async () => {
      const tools1: ToolSchema[] = [
        { name: 'read_file', description: 'Read file', inputSchema: { type: 'object' } }
      ];
      const tools2: ToolSchema[] = [
        { name: 'query', description: 'Database query', inputSchema: { type: 'object' } }
      ];

      vi.mocked(mockClient1.listTools).mockResolvedValue({ tools: tools1 });
      vi.mocked(mockClient2.listTools).mockResolvedValue({ tools: tools2 });

      const childClients = new Map([
        ['filesystem', mockClient1],
        ['database', mockClient2]
      ]);
      const registry = await buildToolRegistry(childClients);

      // Both should use colon separator
      expect(registry.has('filesystem:read_file')).toBe(true);
      expect(registry.has('database:query')).toBe(true);
    });
  });

  describe('T019-T020: [US2] addServerTools with custom separator', () => {
    it('T019: should use custom separator __ for tool prefixing', () => {
      const registry: ToolRegistry = new Map();
      const tools: ToolSchema[] = [
        {
          name: 'create_issue',
          description: 'Create issue',
          inputSchema: { type: 'object' }
        },
        {
          name: 'list_repos',
          description: 'List repos',
          inputSchema: { type: 'object' }
        }
      ];

      addServerTools(registry, 'github', mockClient1, tools, '__');

      // Should use double underscore separator
      expect(registry.has('github__create_issue')).toBe(true);
      expect(registry.has('github__list_repos')).toBe(true);

      // Should NOT use colon
      expect(registry.has('github:create_issue')).toBe(false);

      const entry = lookupTool(registry, 'github__create_issue');
      expect(entry?.schema.name).toBe('github__create_issue');
      expect(entry?.originalName).toBe('create_issue');
    });

    it('T020: should use multi-character separator :: for tool prefixing', () => {
      const registry: ToolRegistry = new Map();
      const tools: ToolSchema[] = [
        {
          name: 'read_file',
          description: 'Read file',
          inputSchema: { type: 'object' }
        }
      ];

      addServerTools(registry, 'filesystem', mockClient1, tools, '::');

      // Should use double colon separator
      expect(registry.has('filesystem::read_file')).toBe(true);
      expect(registry.has('filesystem:read_file')).toBe(false);

      const entry = lookupTool(registry, 'filesystem::read_file');
      expect(entry?.schema.name).toBe('filesystem::read_file');
    });

    it('should use dot separator for tool prefixing', () => {
      const registry: ToolRegistry = new Map();
      const tools: ToolSchema[] = [
        { name: 'query', description: 'Query', inputSchema: { type: 'object' } }
      ];

      addServerTools(registry, 'database', mockClient1, tools, '.');

      expect(registry.has('database.query')).toBe(true);
      expect(registry.has('database:query')).toBe(false);
    });
  });
});

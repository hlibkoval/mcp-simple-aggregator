import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { ToolRegistry, ToolRegistryEntry, ToolSchema } from '../../src/types.js';

/**
 * Test Suite: MCP Server
 *
 * Tasks:
 * - T079 [US2] Create MCP server with tools capability
 * - T080 [P] [US2] Handle tools/list request from client
 * - T081 [P] [US2] Return all prefixed tools in tools/list response
 * - T082 [P] [US2] Update tool list when child server crashes
 * - T083 [P] [US2] Handle tools/list with zero servers
 */

// Import the functions we'll implement
import {
  createAggregatorServer,
  handleToolsList,
  updateRegistryAfterCrash
} from '../../src/server.js';

describe('MCP Server', () => {
  let mockClient1: Client;
  let mockClient2: Client;
  let registry: ToolRegistry;

  beforeEach(() => {
    // Create mock clients
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

    // Create test registry
    registry = new Map();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // T079 [US2] Write test: Create MCP server with tools capability
  describe('createAggregatorServer', () => {
    it('should create MCP server with tools capability', () => {
      const childClients = new Map([
        ['filesystem', mockClient1],
        ['postgres', mockClient2]
      ]);

      const server = createAggregatorServer(childClients, registry);

      expect(server).toBeInstanceOf(Server);

      // Verify server has proper capabilities
      // The server should be configured with tools capability
      expect(server).toBeDefined();
    });

    it('should accept empty child clients map', () => {
      const childClients = new Map();
      const emptyRegistry: ToolRegistry = new Map();

      const server = createAggregatorServer(childClients, emptyRegistry);

      expect(server).toBeInstanceOf(Server);
      expect(server).toBeDefined();
    });

    it('should initialize server with name and version', () => {
      const childClients = new Map();
      const server = createAggregatorServer(childClients, registry, {
        name: 'test-aggregator',
        version: '1.0.0'
      });

      expect(server).toBeInstanceOf(Server);
    });
  });

  // T080 [P] [US2] Write test: Handle tools/list request from client
  describe('handleToolsList', () => {
    it('should handle tools/list request from client', () => {
      // Add some tools to registry
      const tool1: ToolRegistryEntry = {
        client: mockClient1,
        serverKey: 'filesystem',
        originalName: 'read_file',
        schema: {
          name: 'filesystem:read_file',
          description: 'Read a file',
          inputSchema: { type: 'object', properties: {} }
        }
      };

      const tool2: ToolRegistryEntry = {
        client: mockClient2,
        serverKey: 'postgres',
        originalName: 'query',
        schema: {
          name: 'postgres:query',
          description: 'Execute SQL query',
          inputSchema: { type: 'object', properties: {} }
        }
      };

      registry.set('filesystem:read_file', tool1);
      registry.set('postgres:query', tool2);

      const response = handleToolsList(registry);

      expect(response).toBeDefined();
      expect(response.tools).toHaveLength(2);
      expect(response.tools).toContainEqual(tool1.schema);
      expect(response.tools).toContainEqual(tool2.schema);
    });

    it('should return empty array when registry is empty', () => {
      const emptyRegistry: ToolRegistry = new Map();
      const response = handleToolsList(emptyRegistry);

      expect(response).toBeDefined();
      expect(response.tools).toHaveLength(0);
      expect(response.tools).toEqual([]);
    });
  });

  // T081 [P] [US2] Write test: Return all prefixed tools in tools/list response
  it('should return all prefixed tools in tools/list response', () => {
    // Create multiple tools with prefixes
    const tools: Array<{ key: string; entry: ToolRegistryEntry }> = [
      {
        key: 'fs:read',
        entry: {
          client: mockClient1,
          serverKey: 'fs',
          originalName: 'read',
          schema: {
            name: 'fs:read',
            description: 'Read file',
            inputSchema: { type: 'object' }
          }
        }
      },
      {
        key: 'fs:write',
        entry: {
          client: mockClient1,
          serverKey: 'fs',
          originalName: 'write',
          schema: {
            name: 'fs:write',
            description: 'Write file',
            inputSchema: { type: 'object' }
          }
        }
      },
      {
        key: 'db:query',
        entry: {
          client: mockClient2,
          serverKey: 'db',
          originalName: 'query',
          schema: {
            name: 'db:query',
            description: 'Query database',
            inputSchema: { type: 'object' }
          }
        }
      }
    ];

    // Add to registry
    for (const { key, entry } of tools) {
      registry.set(key, entry);
    }

    const response = handleToolsList(registry);

    // All tools should be returned with prefixes
    expect(response.tools).toHaveLength(3);

    const toolNames = response.tools.map((t) => t.name);
    expect(toolNames).toContain('fs:read');
    expect(toolNames).toContain('fs:write');
    expect(toolNames).toContain('db:query');

    // Each tool should have the colon separator
    for (const tool of response.tools) {
      expect(tool.name).toMatch(/^[^:]+:[^:]+$/);
    }
  });

  // T082 [P] [US2] Write test: Update tool list when child server crashes
  describe('updateRegistryAfterCrash', () => {
    beforeEach(() => {
      // Setup registry with multiple servers
      registry.set('server1:tool1', {
        client: mockClient1,
        serverKey: 'server1',
        originalName: 'tool1',
        schema: {
          name: 'server1:tool1',
          description: 'Tool 1',
          inputSchema: { type: 'object' }
        }
      });

      registry.set('server1:tool2', {
        client: mockClient1,
        serverKey: 'server1',
        originalName: 'tool2',
        schema: {
          name: 'server1:tool2',
          description: 'Tool 2',
          inputSchema: { type: 'object' }
        }
      });

      registry.set('server2:tool3', {
        client: mockClient2,
        serverKey: 'server2',
        originalName: 'tool3',
        schema: {
          name: 'server2:tool3',
          description: 'Tool 3',
          inputSchema: { type: 'object' }
        }
      });
    });

    it('should remove tools when child server crashes', () => {
      expect(registry.size).toBe(3);

      // Simulate server1 crash
      updateRegistryAfterCrash(registry, 'server1');

      // Only server2 tools should remain
      expect(registry.size).toBe(1);
      expect(registry.has('server1:tool1')).toBe(false);
      expect(registry.has('server1:tool2')).toBe(false);
      expect(registry.has('server2:tool3')).toBe(true);
    });

    it('should handle crash of non-existent server gracefully', () => {
      const originalSize = registry.size;

      updateRegistryAfterCrash(registry, 'nonexistent-server');

      // Registry should be unchanged
      expect(registry.size).toBe(originalSize);
      expect(registry.has('server1:tool1')).toBe(true);
      expect(registry.has('server1:tool2')).toBe(true);
      expect(registry.has('server2:tool3')).toBe(true);
    });

    it('should update tools/list response after crash', () => {
      // Before crash
      let response = handleToolsList(registry);
      expect(response.tools).toHaveLength(3);

      // Simulate crash
      updateRegistryAfterCrash(registry, 'server1');

      // After crash
      response = handleToolsList(registry);
      expect(response.tools).toHaveLength(1);
      expect(response.tools[0].name).toBe('server2:tool3');
    });
  });

  // T083 [P] [US2] Write test: Handle tools/list with zero servers
  describe('tools/list with zero servers', () => {
    it('should handle tools/list with zero servers', () => {
      const emptyRegistry: ToolRegistry = new Map();
      const response = handleToolsList(emptyRegistry);

      expect(response).toBeDefined();
      expect(response.tools).toEqual([]);
      expect(response.tools).toHaveLength(0);
    });

    it('should work when all servers have crashed', () => {
      // Start with tools
      registry.set('server1:tool1', {
        client: mockClient1,
        serverKey: 'server1',
        originalName: 'tool1',
        schema: {
          name: 'server1:tool1',
          description: 'Tool 1',
          inputSchema: { type: 'object' }
        }
      });

      registry.set('server2:tool2', {
        client: mockClient2,
        serverKey: 'server2',
        originalName: 'tool2',
        schema: {
          name: 'server2:tool2',
          description: 'Tool 2',
          inputSchema: { type: 'object' }
        }
      });

      expect(registry.size).toBe(2);

      // All servers crash
      updateRegistryAfterCrash(registry, 'server1');
      updateRegistryAfterCrash(registry, 'server2');

      expect(registry.size).toBe(0);

      // tools/list should still work
      const response = handleToolsList(registry);
      expect(response.tools).toEqual([]);
    });

    it('should return valid MCP tools/list response structure', () => {
      const emptyRegistry: ToolRegistry = new Map();
      const response = handleToolsList(emptyRegistry);

      // Response should match MCP protocol structure
      expect(response).toHaveProperty('tools');
      expect(Array.isArray(response.tools)).toBe(true);
    });
  });

  // Additional edge cases
  describe('edge cases', () => {
    it('should preserve tool description and inputSchema in response', () => {
      const complexTool: ToolRegistryEntry = {
        client: mockClient1,
        serverKey: 'api',
        originalName: 'complex_call',
        schema: {
          name: 'api:complex_call',
          description: 'A complex API call with detailed schema',
          inputSchema: {
            type: 'object',
            properties: {
              endpoint: { type: 'string', description: 'API endpoint' },
              method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
              headers: { type: 'object', additionalProperties: { type: 'string' } },
              body: { type: 'object' }
            },
            required: ['endpoint', 'method']
          }
        }
      };

      registry.set('api:complex_call', complexTool);

      const response = handleToolsList(registry);

      expect(response.tools).toHaveLength(1);
      const tool = response.tools[0];

      expect(tool.name).toBe('api:complex_call');
      expect(tool.description).toBe('A complex API call with detailed schema');
      expect(tool.inputSchema).toEqual(complexTool.schema.inputSchema);
      expect(tool.inputSchema.required).toEqual(['endpoint', 'method']);
    });

    it('should handle tools with same original name from different servers', () => {
      registry.set('postgres:query', {
        client: mockClient1,
        serverKey: 'postgres',
        originalName: 'query',
        schema: {
          name: 'postgres:query',
          description: 'PostgreSQL query',
          inputSchema: { type: 'object' }
        }
      });

      registry.set('mysql:query', {
        client: mockClient2,
        serverKey: 'mysql',
        originalName: 'query',
        schema: {
          name: 'mysql:query',
          description: 'MySQL query',
          inputSchema: { type: 'object' }
        }
      });

      const response = handleToolsList(registry);

      expect(response.tools).toHaveLength(2);

      const names = response.tools.map((t) => t.name);
      expect(names).toContain('postgres:query');
      expect(names).toContain('mysql:query');

      // Descriptions should be preserved and different
      const pgTool = response.tools.find((t) => t.name === 'postgres:query');
      const mysqlTool = response.tools.find((t) => t.name === 'mysql:query');

      expect(pgTool?.description).toBe('PostgreSQL query');
      expect(mysqlTool?.description).toBe('MySQL query');
    });
  });
});

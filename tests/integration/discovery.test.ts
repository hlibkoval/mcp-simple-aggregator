import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ToolRegistry } from '../../src/types.js';
import { buildToolRegistry, removeServerTools } from '../../src/registry.js';
import { createAggregatorServer, handleToolsList } from '../../src/server.js';

/**
 * Integration Test Suite: Tool Discovery
 *
 * Tests the complete tool discovery flow from child servers through the aggregator.
 *
 * Tasks:
 * - T088 [US2] List tools from 3 child servers
 * - T089 [US2] Verify tool prefixes match config keys
 * - T090 [US2] Handle same server configured twice with different keys
 * - T091 [US2] Remove tools when child crashes after startup
 */

describe('Tool Discovery Integration Tests', () => {
  let mockClients: Map<string, Client>;
  let registry: ToolRegistry;

  beforeEach(() => {
    mockClients = new Map();
    registry = new Map();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup
    mockClients.clear();
    registry.clear();
  });

  // Helper to create a mock client with tools
  function createMockClientWithTools(tools: Array<{ name: string; description: string }>) {
    const client = {
      listTools: vi.fn().mockResolvedValue({
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        }))
      }),
      callTool: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn()
    } as unknown as Client;

    return client;
  }

  // T088 [US2] Write integration test: List tools from 3 child servers
  describe('T088: List tools from multiple child servers', () => {
    it('should aggregate and list tools from 3 child servers', async () => {
      // Create 3 mock child servers with different tools
      const filesystemClient = createMockClientWithTools([
        { name: 'read_file', description: 'Read a file from disk' },
        { name: 'write_file', description: 'Write content to a file' },
        { name: 'list_directory', description: 'List files in directory' }
      ]);

      const postgresClient = createMockClientWithTools([
        { name: 'query', description: 'Execute SQL query' },
        { name: 'execute', description: 'Execute SQL command' }
      ]);

      const githubClient = createMockClientWithTools([
        { name: 'create_issue', description: 'Create GitHub issue' },
        { name: 'list_prs', description: 'List pull requests' },
        { name: 'create_pr', description: 'Create pull request' },
        { name: 'merge_pr', description: 'Merge pull request' }
      ]);

      // Setup child clients map
      mockClients.set('filesystem', filesystemClient);
      mockClients.set('postgres', postgresClient);
      mockClients.set('github', githubClient);

      // Build registry from all child servers
      registry = await buildToolRegistry(mockClients);

      // Verify registry size
      expect(registry.size).toBe(9); // 3 + 2 + 4 = 9 tools total

      // Get tools list response
      const response = handleToolsList(registry);

      // Should return all 9 tools
      expect(response.tools).toHaveLength(9);

      // Verify all tools have proper prefixes
      const toolNames = response.tools.map((t) => t.name);

      // Filesystem tools
      expect(toolNames).toContain('filesystem:read_file');
      expect(toolNames).toContain('filesystem:write_file');
      expect(toolNames).toContain('filesystem:list_directory');

      // Postgres tools
      expect(toolNames).toContain('postgres:query');
      expect(toolNames).toContain('postgres:execute');

      // GitHub tools
      expect(toolNames).toContain('github:create_issue');
      expect(toolNames).toContain('github:list_prs');
      expect(toolNames).toContain('github:create_pr');
      expect(toolNames).toContain('github:merge_pr');
    });

    it('should call listTools on all child clients', async () => {
      const client1 = createMockClientWithTools([{ name: 'tool1', description: 'Tool 1' }]);
      const client2 = createMockClientWithTools([{ name: 'tool2', description: 'Tool 2' }]);
      const client3 = createMockClientWithTools([{ name: 'tool3', description: 'Tool 3' }]);

      mockClients.set('server1', client1);
      mockClients.set('server2', client2);
      mockClients.set('server3', client3);

      await buildToolRegistry(mockClients);

      // All clients should have been queried
      expect(client1.listTools).toHaveBeenCalledTimes(1);
      expect(client2.listTools).toHaveBeenCalledTimes(1);
      expect(client3.listTools).toHaveBeenCalledTimes(1);
    });
  });

  // T089 [US2] Write integration test: Verify tool prefixes match config keys
  describe('T089: Verify tool prefixes match config keys', () => {
    it('should prefix tools with exact config key names', async () => {
      const configKeys = ['my-filesystem', 'postgres-prod', 'github-personal'];

      const tools = [
        { name: 'read', description: 'Read' },
        { name: 'query', description: 'Query' },
        { name: 'create', description: 'Create' }
      ];

      for (let i = 0; i < configKeys.length; i++) {
        const client = createMockClientWithTools([tools[i]]);
        mockClients.set(configKeys[i], client);
      }

      registry = await buildToolRegistry(mockClients);

      const response = handleToolsList(registry);
      const toolNames = response.tools.map((t) => t.name);

      // Each tool should have its config key as prefix
      expect(toolNames).toContain('my-filesystem:read');
      expect(toolNames).toContain('postgres-prod:query');
      expect(toolNames).toContain('github-personal:create');
    });

    it('should preserve config keys with special characters', async () => {
      const specialKeys = [
        'server_1',
        'server-2',
        'server.3',
        'serverWithCamelCase'
      ];

      for (const key of specialKeys) {
        const client = createMockClientWithTools([
          { name: 'test', description: 'Test tool' }
        ]);
        mockClients.set(key, client);
      }

      registry = await buildToolRegistry(mockClients);
      const response = handleToolsList(registry);
      const toolNames = response.tools.map((t) => t.name);

      expect(toolNames).toContain('server_1:test');
      expect(toolNames).toContain('server-2:test');
      expect(toolNames).toContain('server.3:test');
      expect(toolNames).toContain('serverWithCamelCase:test');
    });
  });

  // T090 [US2] Write integration test: Handle same server configured twice with different keys
  describe('T090: Handle same server configured twice with different keys', () => {
    it('should handle same server type with different config keys', async () => {
      // Simulate two filesystem servers configured with different paths
      const fsHomeClient = createMockClientWithTools([
        { name: 'read_file', description: 'Read from home directory' },
        { name: 'write_file', description: 'Write to home directory' }
      ]);

      const fsWorkClient = createMockClientWithTools([
        { name: 'read_file', description: 'Read from work directory' },
        { name: 'write_file', description: 'Write to work directory' }
      ]);

      mockClients.set('fs-home', fsHomeClient);
      mockClients.set('fs-work', fsWorkClient);

      registry = await buildToolRegistry(mockClients);

      // Should have 4 tools total (2 from each server)
      expect(registry.size).toBe(4);

      const response = handleToolsList(registry);
      const toolNames = response.tools.map((t) => t.name);

      // Both instances should be present with different prefixes
      expect(toolNames).toContain('fs-home:read_file');
      expect(toolNames).toContain('fs-home:write_file');
      expect(toolNames).toContain('fs-work:read_file');
      expect(toolNames).toContain('fs-work:write_file');

      // Verify they point to different clients
      const homeReadEntry = registry.get('fs-home:read_file');
      const workReadEntry = registry.get('fs-work:read_file');

      expect(homeReadEntry?.client).toBe(fsHomeClient);
      expect(workReadEntry?.client).toBe(fsWorkClient);
      expect(homeReadEntry?.client).not.toBe(workReadEntry?.client);
    });

    it('should handle multiple database servers', async () => {
      const postgresClient = createMockClientWithTools([
        { name: 'query', description: 'PostgreSQL query' }
      ]);

      const mysqlClient = createMockClientWithTools([
        { name: 'query', description: 'MySQL query' }
      ]);

      const mongoClient = createMockClientWithTools([
        { name: 'query', description: 'MongoDB query' }
      ]);

      mockClients.set('postgres', postgresClient);
      mockClients.set('mysql', mysqlClient);
      mockClients.set('mongodb', mongoClient);

      registry = await buildToolRegistry(mockClients);

      expect(registry.size).toBe(3);

      const response = handleToolsList(registry);

      // All three 'query' tools should be accessible with different prefixes
      const queryTools = response.tools.filter((t) => t.name.endsWith(':query'));
      expect(queryTools).toHaveLength(3);

      const toolNames = queryTools.map((t) => t.name);
      expect(toolNames).toContain('postgres:query');
      expect(toolNames).toContain('mysql:query');
      expect(toolNames).toContain('mongodb:query');
    });
  });

  // T091 [US2] Write integration test: Remove tools when child crashes after startup
  describe('T091: Remove tools when child crashes after startup', () => {
    it('should remove tools when a child server crashes', async () => {
      const server1Client = createMockClientWithTools([
        { name: 'tool1', description: 'Tool 1' },
        { name: 'tool2', description: 'Tool 2' }
      ]);

      const server2Client = createMockClientWithTools([
        { name: 'tool3', description: 'Tool 3' },
        { name: 'tool4', description: 'Tool 4' }
      ]);

      const server3Client = createMockClientWithTools([
        { name: 'tool5', description: 'Tool 5' }
      ]);

      mockClients.set('server1', server1Client);
      mockClients.set('server2', server2Client);
      mockClients.set('server3', server3Client);

      registry = await buildToolRegistry(mockClients);

      // Initial state: 5 tools
      expect(registry.size).toBe(5);
      let response = handleToolsList(registry);
      expect(response.tools).toHaveLength(5);

      // Simulate server2 crash
      removeServerTools(registry, 'server2');

      // After crash: only 3 tools remain
      expect(registry.size).toBe(3);
      response = handleToolsList(registry);
      expect(response.tools).toHaveLength(3);

      const toolNames = response.tools.map((t) => t.name);

      // server1 and server3 tools should remain
      expect(toolNames).toContain('server1:tool1');
      expect(toolNames).toContain('server1:tool2');
      expect(toolNames).toContain('server3:tool5');

      // server2 tools should be gone
      expect(toolNames).not.toContain('server2:tool3');
      expect(toolNames).not.toContain('server2:tool4');
    });

    it('should handle cascading crashes gracefully', async () => {
      const client1 = createMockClientWithTools([{ name: 'tool1', description: 'T1' }]);
      const client2 = createMockClientWithTools([{ name: 'tool2', description: 'T2' }]);
      const client3 = createMockClientWithTools([{ name: 'tool3', description: 'T3' }]);

      mockClients.set('s1', client1);
      mockClients.set('s2', client2);
      mockClients.set('s3', client3);

      registry = await buildToolRegistry(mockClients);
      expect(registry.size).toBe(3);

      // Crash all servers one by one
      removeServerTools(registry, 's1');
      expect(registry.size).toBe(2);

      removeServerTools(registry, 's2');
      expect(registry.size).toBe(1);

      removeServerTools(registry, 's3');
      expect(registry.size).toBe(0);

      // Should return empty list
      const response = handleToolsList(registry);
      expect(response.tools).toHaveLength(0);
    });

    it('should maintain registry integrity after partial crashes', async () => {
      const fsClient = createMockClientWithTools([
        { name: 'read', description: 'Read' },
        { name: 'write', description: 'Write' }
      ]);

      const dbClient = createMockClientWithTools([
        { name: 'query', description: 'Query' }
      ]);

      mockClients.set('filesystem', fsClient);
      mockClients.set('database', dbClient);

      registry = await buildToolRegistry(mockClients);
      expect(registry.size).toBe(3);

      // Crash database server
      removeServerTools(registry, 'database');

      // Filesystem tools should still work
      const fsEntry = registry.get('filesystem:read');
      expect(fsEntry).toBeDefined();
      expect(fsEntry?.client).toBe(fsClient);
      expect(fsEntry?.originalName).toBe('read');

      // Database tools should be gone
      expect(registry.get('database:query')).toBeUndefined();
    });
  });

  // Additional integration scenarios
  describe('End-to-end tool discovery scenarios', () => {
    it('should handle complete aggregator lifecycle', async () => {
      // Phase 1: Initial setup with 2 servers
      const fs = createMockClientWithTools([
        { name: 'read', description: 'Read' }
      ]);
      const db = createMockClientWithTools([
        { name: 'query', description: 'Query' }
      ]);

      mockClients.set('fs', fs);
      mockClients.set('db', db);

      registry = await buildToolRegistry(mockClients);
      const server = createAggregatorServer(mockClients, registry);

      expect(registry.size).toBe(2);

      // Phase 2: Query tools
      let response = handleToolsList(registry);
      expect(response.tools).toHaveLength(2);

      // Phase 3: Server crash
      removeServerTools(registry, 'db');

      // Phase 4: Query tools again
      response = handleToolsList(registry);
      expect(response.tools).toHaveLength(1);
      expect(response.tools[0].name).toBe('fs:read');
    });

    it('should preserve tool schemas correctly through aggregation', async () => {
      const client = createMockClientWithTools([]);

      // Manually set up complex tool schema
      vi.mocked(client.listTools).mockResolvedValue({
        tools: [
          {
            name: 'complex_tool',
            description: 'A complex tool with detailed schema',
            inputSchema: {
              type: 'object',
              properties: {
                stringParam: { type: 'string', description: 'String parameter' },
                numberParam: { type: 'number', minimum: 0, maximum: 100 },
                arrayParam: { type: 'array', items: { type: 'string' } },
                objectParam: {
                  type: 'object',
                  properties: {
                    nested: { type: 'string' }
                  },
                  required: ['nested']
                }
              },
              required: ['stringParam', 'numberParam']
            }
          }
        ]
      });

      mockClients.set('api', client);
      registry = await buildToolRegistry(mockClients);

      const response = handleToolsList(registry);
      const tool = response.tools[0];

      // Schema should be fully preserved
      expect(tool.name).toBe('api:complex_tool');
      expect(tool.description).toBe('A complex tool with detailed schema');
      expect(tool.inputSchema.required).toEqual(['stringParam', 'numberParam']);
      expect(tool.inputSchema.properties.stringParam).toEqual({
        type: 'string',
        description: 'String parameter'
      });
      expect(tool.inputSchema.properties.numberParam).toEqual({
        type: 'number',
        minimum: 0,
        maximum: 100
      });
    });
  });
});

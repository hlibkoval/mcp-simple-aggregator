/**
 * Integration Test Suite: Tool Execution (T113-T117)
 *
 * Tests end-to-end tool execution through the aggregator, including routing,
 * argument forwarding, response handling, and error cases.
 *
 * These tests also cover routing behavior from T093-T098:
 * - T093: Route tool call to correct child server
 * - T094: Forward arguments unchanged to child
 * - T095: Return child response unchanged to client
 * - T096: Return error for tool not found
 * - T097: Return error for missing prefix
 * - T098: Forward child server errors unchanged
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { ToolRegistry } from '../../src/types.js';
import { buildToolRegistry } from '../../src/registry.js';
import { parseToolPrefix } from '../../src/server.js';

describe('Tool Execution Integration Tests', () => {
  let mockClients: Map<string, Client>;
  let registry: ToolRegistry;
  let filesystemClient: Client;
  let databaseClient: Client;

  beforeEach(() => {
    mockClients = new Map();
    registry = new Map();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockClients.clear();
    registry.clear();
  });

  // Helper to create a mock client with tools and callTool handler
  function createMockClient(
    tools: Array<{ name: string; description: string }>,
    callToolHandler?: (params: { name: string; arguments?: Record<string, unknown> }) => Promise<unknown>
  ): Client {
    return {
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
      callTool: callToolHandler ? vi.fn(callToolHandler) : vi.fn(),
      connect: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    } as unknown as Client;
  }

  /**
   * Helper to simulate tool execution through the aggregator
   * This mimics what setupToolCallHandler does in the real implementation
   */
  async function executeToolViaAggregator(
    toolName: string,
    args?: Record<string, unknown>
  ) {
    // Parse prefix (T092)
    const parsed = parseToolPrefix(toolName);
    if (!parsed) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid tool name format. Expected 'serverKey:toolName', got '${toolName}'`
      );
    }

    // Lookup tool in registry (T093)
    const entry = registry.get(toolName);
    if (!entry) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Tool not found: ${toolName}`
      );
    }

    // Route to child server with original tool name (T093-T095)
    try {
      const result = await entry.client.callTool({
        name: entry.originalName,
        arguments: args || {}
      });

      return result;
    } catch (error) {
      // Forward child server errors (T098)
      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        `Error calling tool '${toolName}': ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // T113: Call tool successfully through aggregator (also tests T093-T095)
  describe('successful tool execution', () => {
    it('should call tool successfully through aggregator', async () => {
      // Setup filesystem client with read_file tool
      filesystemClient = createMockClient(
        [{ name: 'read_file', description: 'Read a file' }],
        async ({ name, arguments: args }) => {
          expect(name).toBe('read_file');
          expect(args).toEqual({ path: '/home/user/file.txt' });
          return {
            content: [
              { type: 'text', text: 'File contents here' }
            ]
          };
        }
      );

      mockClients.set('filesystem', filesystemClient);

      // Build registry
      registry = await buildToolRegistry(mockClients);

      // Make tool call through aggregator
      const result = await executeToolViaAggregator(
        'filesystem:read_file',
        { path: '/home/user/file.txt' }
      );

      expect(result).toEqual({
        content: [{ type: 'text', text: 'File contents here' }]
      });

      // Verify the child client was called with correct parameters
      expect(filesystemClient.callTool).toHaveBeenCalledWith({
        name: 'read_file',
        arguments: { path: '/home/user/file.txt' }
      });
    });

    it('should handle complex tool responses', async () => {
      filesystemClient = createMockClient(
        [{ name: 'list_directory', description: 'List directory contents' }],
        async () => ({
          content: [
            { type: 'text', text: 'file1.txt' },
            { type: 'text', text: 'file2.txt' },
            { type: 'text', text: 'subdirectory/' }
          ],
          isError: false
        })
      );

      mockClients.set('filesystem', filesystemClient);
      registry = await buildToolRegistry(mockClients);

      const result = await executeToolViaAggregator(
        'filesystem:list_directory',
        { path: '/home/user' }
      );

      expect(result).toHaveProperty('content');
      expect(result.content).toHaveLength(3);
    });
  });

  // T114: Route to correct server with multiple children
  describe('routing with multiple servers', () => {
    it('should route to correct server with multiple children', async () => {
      // Setup filesystem client
      filesystemClient = createMockClient(
        [
          { name: 'read_file', description: 'Read a file' },
          { name: 'write_file', description: 'Write to a file' }
        ],
        async ({ name }) => {
          if (name === 'read_file') {
            return { content: [{ type: 'text', text: 'Filesystem response' }] };
          }
          return { content: [{ type: 'text', text: 'Write successful' }] };
        }
      );

      // Setup database client
      databaseClient = createMockClient(
        [
          { name: 'query', description: 'Execute SQL query' },
          { name: 'insert', description: 'Insert data' }
        ],
        async ({ name }) => {
          if (name === 'query') {
            return { content: [{ type: 'text', text: 'Query results' }] };
          }
          return { content: [{ type: 'text', text: 'Insert successful' }] };
        }
      );

      mockClients.set('filesystem', filesystemClient);
      mockClients.set('database', databaseClient);

      registry = await buildToolRegistry(mockClients);

      // Call filesystem tool
      const fsResult = await executeToolViaAggregator(
        'filesystem:read_file',
        { path: '/test.txt' }
      );

      expect(fsResult).toEqual({ content: [{ type: 'text', text: 'Filesystem response' }] });
      expect(filesystemClient.callTool).toHaveBeenCalledWith({
        name: 'read_file',
        arguments: { path: '/test.txt' }
      });

      // Call database tool
      const dbResult = await executeToolViaAggregator(
        'database:query',
        { sql: 'SELECT * FROM users' }
      );

      expect(dbResult).toEqual({ content: [{ type: 'text', text: 'Query results' }] });
      expect(databaseClient.callTool).toHaveBeenCalledWith({
        name: 'query',
        arguments: { sql: 'SELECT * FROM users' }
      });
    });
  });

  // T115: Handle invalid arguments from client (also tests T098)
  describe('error handling', () => {
    it('should handle invalid arguments from client', async () => {
      filesystemClient = createMockClient(
        [{ name: 'read_file', description: 'Read a file' }],
        async () => {
          // Child server validates and throws error
          throw new McpError(
            ErrorCode.InvalidParams,
            'Missing required parameter: path'
          );
        }
      );

      mockClients.set('filesystem', filesystemClient);
      registry = await buildToolRegistry(mockClients);

      // Call with invalid arguments (missing path)
      await expect(
        executeToolViaAggregator('filesystem:read_file', {})
      ).rejects.toThrow(McpError);

      try {
        await executeToolViaAggregator('filesystem:read_file', {});
      } catch (error) {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
        expect((error as McpError).message).toContain('Missing required parameter: path');
      }
    });

    // T116: Handle non-existent tool name (also tests T096-T097)
    it('should handle non-existent tool name', async () => {
      filesystemClient = createMockClient([
        { name: 'read_file', description: 'Read a file' }
      ]);

      mockClients.set('filesystem', filesystemClient);
      registry = await buildToolRegistry(mockClients);

      // Call non-existent tool
      await expect(
        executeToolViaAggregator('filesystem:nonexistent_tool', {})
      ).rejects.toThrow(McpError);

      try {
        await executeToolViaAggregator('filesystem:nonexistent_tool', {});
      } catch (error) {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe(ErrorCode.MethodNotFound);
        expect((error as McpError).message).toContain('Tool not found');
      }
    });

    it('should handle tool name without prefix', async () => {
      filesystemClient = createMockClient([
        { name: 'read_file', description: 'Read a file' }
      ]);

      mockClients.set('filesystem', filesystemClient);
      registry = await buildToolRegistry(mockClients);

      // Call without prefix
      await expect(
        executeToolViaAggregator('read_file', {})
      ).rejects.toThrow(McpError);

      try {
        await executeToolViaAggregator('read_file', {});
      } catch (error) {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe(ErrorCode.InvalidRequest);
        expect((error as McpError).message).toContain('Invalid tool name format');
      }
    });

    it('should forward child server errors unchanged', async () => {
      filesystemClient = createMockClient(
        [{ name: 'read_file', description: 'Read a file' }],
        async () => {
          // Child server throws a specific MCP error
          throw new McpError(
            ErrorCode.InvalidParams,
            'File path contains invalid characters'
          );
        }
      );

      mockClients.set('filesystem', filesystemClient);
      registry = await buildToolRegistry(mockClients);

      try {
        await executeToolViaAggregator('filesystem:read_file', { path: '/invalid/../path' });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Error should be forwarded unchanged
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
        expect((error as McpError).message).toContain('File path contains invalid characters');
      }
    });

    it('should wrap non-MCP errors from child server', async () => {
      filesystemClient = createMockClient(
        [{ name: 'read_file', description: 'Read a file' }],
        async () => {
          // Child server throws a regular error
          throw new Error('Network timeout connecting to filesystem service');
        }
      );

      mockClients.set('filesystem', filesystemClient);
      registry = await buildToolRegistry(mockClients);

      try {
        await executeToolViaAggregator('filesystem:read_file', { path: '/test.txt' });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Error should be wrapped as Internal Error
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe(ErrorCode.InternalError);
        expect((error as McpError).message).toContain('Network timeout connecting to filesystem service');
      }
    });
  });

  // T117: Forward large responses correctly
  describe('large response handling', () => {
    it('should forward large responses correctly', async () => {
      const largeContent = 'x'.repeat(100000); // 100KB of data

      filesystemClient = createMockClient(
        [{ name: 'read_file', description: 'Read a file' }],
        async () => ({
          content: [
            { type: 'text', text: largeContent }
          ]
        })
      );

      mockClients.set('filesystem', filesystemClient);
      registry = await buildToolRegistry(mockClients);

      const result = await executeToolViaAggregator('filesystem:read_file', { path: '/large_file.txt' });

      expect(result).toHaveProperty('content');
      expect(result.content[0].text).toBe(largeContent);
      expect(result.content[0].text.length).toBe(100000);
    });

    it('should handle responses with multiple content blocks', async () => {
      filesystemClient = createMockClient(
        [{ name: 'analyze_file', description: 'Analyze file and return multiple results' }],
        async () => ({
          content: [
            { type: 'text', text: 'Summary: This file contains code' },
            { type: 'text', text: 'Line count: 1234' },
            { type: 'text', text: 'Complexity score: 8.5' },
            { type: 'text', text: 'Issues: 3 warnings, 0 errors' }
          ]
        })
      );

      mockClients.set('filesystem', filesystemClient);
      registry = await buildToolRegistry(mockClients);

      const result = await executeToolViaAggregator('filesystem:analyze_file', { path: '/code.ts' });

      expect(result).toHaveProperty('content');
      expect(result.content).toHaveLength(4);
      expect(result.content[0].text).toContain('Summary');
      expect(result.content[3].text).toContain('Issues');
    });
  });

  // Additional test: Verify arguments are forwarded without modification
  describe('argument forwarding', () => {
    it('should forward complex nested arguments unchanged', async () => {
      const complexArgs = {
        path: '/home/user/file.txt',
        options: {
          encoding: 'utf-8',
          mode: 0o644,
          recursive: true,
          filters: ['*.txt', '*.md'],
          metadata: {
            author: 'test',
            tags: ['important', 'review']
          }
        }
      };

      filesystemClient = createMockClient(
        [{ name: 'read_file', description: 'Read a file with options' }],
        async ({ arguments: args }) => {
          // Verify arguments are forwarded exactly as provided
          expect(args).toEqual(complexArgs);
          return {
            content: [{ type: 'text', text: 'Success' }]
          };
        }
      );

      mockClients.set('filesystem', filesystemClient);
      registry = await buildToolRegistry(mockClients);

      await executeToolViaAggregator('filesystem:read_file', complexArgs);

      // If the assertion in the handler passed, the test passes
      expect(filesystemClient.callTool).toHaveBeenCalledWith({
        name: 'read_file',
        arguments: complexArgs
      });
    });
  });
});

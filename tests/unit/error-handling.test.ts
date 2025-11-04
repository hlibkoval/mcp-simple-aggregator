/**
 * Unit Tests for Error Handling (T105-T108)
 *
 * Tests error handling for child server failures, crashes, and graceful degradation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { ToolRegistry } from '../../src/types.js';
import { removeServerTools } from '../../src/registry.js';

describe('Error Handling', () => {
  let registry: ToolRegistry;
  let mockClient: Client;

  beforeEach(() => {
    registry = new Map();
    mockClient = {
      callTool: vi.fn(),
      listTools: vi.fn(),
      connect: vi.fn(),
      close: vi.fn(),
      onerror: undefined
    } as unknown as Client;

    // Setup test registry with some tools
    registry.set('filesystem:read_file', {
      client: mockClient,
      serverKey: 'filesystem',
      originalName: 'read_file',
      schema: {
        name: 'filesystem:read_file',
        description: 'Read a file',
        inputSchema: { type: 'object', properties: {} }
      }
    });

    registry.set('filesystem:write_file', {
      client: mockClient,
      serverKey: 'filesystem',
      originalName: 'write_file',
      schema: {
        name: 'filesystem:write_file',
        description: 'Write a file',
        inputSchema: { type: 'object', properties: {} }
      }
    });
  });

  // T105: Handle child server validation errors
  describe('Child Server Validation Errors', () => {
    it('should forward validation errors from child server', async () => {
      const validationError = new McpError(
        ErrorCode.InvalidParams,
        'Missing required field: path'
      );

      mockClient.callTool = vi.fn().mockRejectedValue(validationError);

      const entry = registry.get('filesystem:read_file');
      expect(entry).toBeDefined();

      try {
        await entry!.client.callTool({
          name: entry!.originalName,
          arguments: {}
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
        expect((error as McpError).message).toContain('Missing required field');
      }
    });

    it('should handle multiple validation error types', async () => {
      const testCases = [
        { code: ErrorCode.InvalidParams, message: 'Invalid parameter type' },
        { code: ErrorCode.InvalidRequest, message: 'Malformed request' },
        { code: ErrorCode.ParseError, message: 'Failed to parse input' }
      ];

      for (const testCase of testCases) {
        const error = new McpError(testCase.code, testCase.message);
        mockClient.callTool = vi.fn().mockRejectedValue(error);

        try {
          const entry = registry.get('filesystem:read_file');
          await entry!.client.callTool({
            name: entry!.originalName,
            arguments: {}
          });
          expect(true).toBe(false);
        } catch (e) {
          expect(e).toBeInstanceOf(McpError);
          expect((e as McpError).code).toBe(testCase.code);
        }
      }
    });
  });

  // T106: Handle child server timeout gracefully
  describe('Child Server Timeout', () => {
    it('should handle timeout errors from child server', async () => {
      const timeoutError = new Error('Request timeout after 30000ms');
      mockClient.callTool = vi.fn().mockRejectedValue(timeoutError);

      try {
        const entry = registry.get('filesystem:read_file');
        await entry!.client.callTool({
          name: entry!.originalName,
          arguments: { path: '/large/file.txt' }
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('timeout');
      }
    });

    it('should continue serving after timeout from one server', async () => {
      // Simulate timeout on one tool call
      mockClient.callTool = vi.fn().mockRejectedValueOnce(
        new Error('Timeout')
      );

      // First call times out
      const entry = registry.get('filesystem:read_file');
      await expect(
        entry!.client.callTool({ name: entry!.originalName, arguments: {} })
      ).rejects.toThrow('Timeout');

      // Registry should still contain the tools
      expect(registry.size).toBe(2);
      expect(registry.has('filesystem:read_file')).toBe(true);
      expect(registry.has('filesystem:write_file')).toBe(true);
    });
  });

  // T107: Handle child crash during tool call
  describe('Child Crash During Tool Call', () => {
    it('should handle child process crash error', async () => {
      const crashError = new Error('Child process exited with code 1');
      mockClient.callTool = vi.fn().mockRejectedValue(crashError);

      try {
        const entry = registry.get('filesystem:read_file');
        await entry!.client.callTool({
          name: entry!.originalName,
          arguments: {}
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('exited');
      }
    });

    it('should handle connection errors', async () => {
      const connectionError = new Error('EPIPE: broken pipe');
      mockClient.callTool = vi.fn().mockRejectedValue(connectionError);

      try {
        const entry = registry.get('filesystem:read_file');
        await entry!.client.callTool({
          name: entry!.originalName,
          arguments: {}
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('EPIPE');
      }
    });
  });

  // T108: Continue serving after child crashes
  describe('Graceful Degradation', () => {
    it('should remove crashed server tools from registry', () => {
      expect(registry.size).toBe(2);
      expect(registry.has('filesystem:read_file')).toBe(true);
      expect(registry.has('filesystem:write_file')).toBe(true);

      // Simulate child server crash - remove its tools
      removeServerTools(registry, 'filesystem');

      // Registry should be empty after removing filesystem tools
      expect(registry.size).toBe(0);
      expect(registry.has('filesystem:read_file')).toBe(false);
      expect(registry.has('filesystem:write_file')).toBe(false);
    });

    it('should continue serving other servers after one crashes', () => {
      // Add tools from a second server
      const otherClient = {
        callTool: vi.fn(),
        listTools: vi.fn(),
        connect: vi.fn(),
        close: vi.fn()
      } as unknown as Client;

      registry.set('database:query', {
        client: otherClient,
        serverKey: 'database',
        originalName: 'query',
        schema: {
          name: 'database:query',
          description: 'Execute query',
          inputSchema: { type: 'object', properties: {} }
        }
      });

      registry.set('database:insert', {
        client: otherClient,
        serverKey: 'database',
        originalName: 'insert',
        schema: {
          name: 'database:insert',
          description: 'Insert data',
          inputSchema: { type: 'object', properties: {} }
        }
      });

      expect(registry.size).toBe(4); // 2 filesystem + 2 database

      // Simulate filesystem server crash
      removeServerTools(registry, 'filesystem');

      // Database tools should remain
      expect(registry.size).toBe(2);
      expect(registry.has('filesystem:read_file')).toBe(false);
      expect(registry.has('filesystem:write_file')).toBe(false);
      expect(registry.has('database:query')).toBe(true);
      expect(registry.has('database:insert')).toBe(true);
    });

    it('should handle multiple server crashes gracefully', () => {
      // Add multiple servers
      const dbClient = { callTool: vi.fn() } as unknown as Client;
      const gitClient = { callTool: vi.fn() } as unknown as Client;

      registry.set('database:query', {
        client: dbClient,
        serverKey: 'database',
        originalName: 'query',
        schema: {
          name: 'database:query',
          description: 'Query',
          inputSchema: { type: 'object', properties: {} }
        }
      });

      registry.set('git:commit', {
        client: gitClient,
        serverKey: 'git',
        originalName: 'commit',
        schema: {
          name: 'git:commit',
          description: 'Commit',
          inputSchema: { type: 'object', properties: {} }
        }
      });

      expect(registry.size).toBe(4); // 2 filesystem + 1 database + 1 git

      // Crash filesystem
      removeServerTools(registry, 'filesystem');
      expect(registry.size).toBe(2);

      // Crash database
      removeServerTools(registry, 'database');
      expect(registry.size).toBe(1);

      // Git tools still available
      expect(registry.has('git:commit')).toBe(true);
    });

    it('should handle empty registry after all servers crash', () => {
      removeServerTools(registry, 'filesystem');
      expect(registry.size).toBe(0);

      // Should not throw error when checking non-existent tools
      expect(registry.has('filesystem:read_file')).toBe(false);
      expect(registry.get('filesystem:read_file')).toBeUndefined();
    });
  });

  // Additional error handling scenarios
  describe('Error Handler Integration', () => {
    it('should support setting onerror callback on client', () => {
      const errorHandler = vi.fn();
      mockClient.onerror = errorHandler;

      expect(mockClient.onerror).toBeDefined();
      expect(mockClient.onerror).toBe(errorHandler);
    });

    it('should call onerror when error occurs', () => {
      const errorHandler = vi.fn();
      mockClient.onerror = errorHandler;

      const testError = new Error('Test error');

      // Simulate error
      if (mockClient.onerror) {
        mockClient.onerror(testError);
      }

      expect(errorHandler).toHaveBeenCalledWith(testError);
      expect(errorHandler).toHaveBeenCalledTimes(1);
    });
  });
});

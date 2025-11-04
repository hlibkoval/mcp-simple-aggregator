import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { ToolSchema } from '../../src/types.js';
import { buildToolRegistry } from '../../src/registry.js';
import { parseToolPrefix } from '../../src/server.js';

/**
 * Integration Test Suite: Separator Configuration
 *
 * Tests end-to-end separator functionality across CLI, registry, and server modules
 */

describe('Separator Integration Tests', () => {
  let mockClient1: Client;
  let mockClient2: Client;

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
  });

  describe('T005: [US1] Default separator end-to-end flow', () => {
    it('should use default colon separator throughout the entire flow', async () => {
      // Setup mock tools
      const tools1: ToolSchema[] = [
        {
          name: 'create_issue',
          description: 'Create a GitHub issue',
          inputSchema: { type: 'object' }
        }
      ];

      const tools2: ToolSchema[] = [
        {
          name: 'read_file',
          description: 'Read a file from filesystem',
          inputSchema: { type: 'object' }
        }
      ];

      vi.mocked(mockClient1.listTools).mockResolvedValue({ tools: tools1 });
      vi.mocked(mockClient2.listTools).mockResolvedValue({ tools: tools2 });

      // Build registry with default separator (no parameter)
      const childClients = new Map([
        ['github', mockClient1],
        ['filesystem', mockClient2]
      ]);
      const registry = await buildToolRegistry(childClients);

      // Verify registry uses colon separator
      expect(registry.size).toBe(2);
      expect(registry.has('github:create_issue')).toBe(true);
      expect(registry.has('filesystem:read_file')).toBe(true);

      // Verify parsing works with colon separator
      const parsed1 = parseToolPrefix('github:create_issue');
      const parsed2 = parseToolPrefix('filesystem:read_file');

      expect(parsed1).not.toBeNull();
      expect(parsed1?.serverKey).toBe('github');
      expect(parsed1?.toolName).toBe('create_issue');

      expect(parsed2).not.toBeNull();
      expect(parsed2?.serverKey).toBe('filesystem');
      expect(parsed2?.toolName).toBe('read_file');

      // Verify tool call routing (check originalName is preserved)
      const githubEntry = registry.get('github:create_issue');
      const filesystemEntry = registry.get('filesystem:read_file');

      expect(githubEntry?.originalName).toBe('create_issue');
      expect(filesystemEntry?.originalName).toBe('read_file');
    });

    it('should handle multiple servers with overlapping tool names', async () => {
      // Both servers have a "query" tool
      const tools1: ToolSchema[] = [
        { name: 'query', description: 'PostgreSQL query', inputSchema: { type: 'object' } }
      ];

      const tools2: ToolSchema[] = [
        { name: 'query', description: 'MySQL query', inputSchema: { type: 'object' } }
      ];

      vi.mocked(mockClient1.listTools).mockResolvedValue({ tools: tools1 });
      vi.mocked(mockClient2.listTools).mockResolvedValue({ tools: tools2 });

      const childClients = new Map([
        ['postgres', mockClient1],
        ['mysql', mockClient2]
      ]);
      const registry = await buildToolRegistry(childClients);

      // Both should be registered with different prefixed names
      expect(registry.size).toBe(2);
      expect(registry.has('postgres:query')).toBe(true);
      expect(registry.has('mysql:query')).toBe(true);

      // Both should parse correctly
      const parsed1 = parseToolPrefix('postgres:query');
      const parsed2 = parseToolPrefix('mysql:query');

      expect(parsed1?.serverKey).toBe('postgres');
      expect(parsed1?.toolName).toBe('query');

      expect(parsed2?.serverKey).toBe('mysql');
      expect(parsed2?.toolName).toBe('query');
    });

    it('should preserve backward compatibility with existing colon-based naming', async () => {
      // This test ensures that the default behavior is unchanged
      const tools: ToolSchema[] = [
        { name: 'list_repos', description: 'List repositories', inputSchema: { type: 'object' } },
        { name: 'get_user', description: 'Get user info', inputSchema: { type: 'object' } },
        { name: 'create_pr', description: 'Create pull request', inputSchema: { type: 'object' } }
      ];

      vi.mocked(mockClient1.listTools).mockResolvedValue({ tools });

      const childClients = new Map([['github', mockClient1]]);
      const registry = await buildToolRegistry(childClients);

      // All tools should use colon separator (backward compatible)
      expect(registry.has('github:list_repos')).toBe(true);
      expect(registry.has('github:get_user')).toBe(true);
      expect(registry.has('github:create_pr')).toBe(true);

      // All should parse correctly
      expect(parseToolPrefix('github:list_repos')).not.toBeNull();
      expect(parseToolPrefix('github:get_user')).not.toBeNull();
      expect(parseToolPrefix('github:create_pr')).not.toBeNull();
    });
  });

  describe('T024: [US2] Custom separator end-to-end flow', () => {
    it('should use custom separator __ throughout entire flow', async () => {
      // Setup mock tools
      const tools1: ToolSchema[] = [
        {
          name: 'create_issue',
          description: 'Create a GitHub issue',
          inputSchema: { type: 'object' }
        }
      ];

      const tools2: ToolSchema[] = [
        {
          name: 'read_file',
          description: 'Read a file from filesystem',
          inputSchema: { type: 'object' }
        }
      ];

      vi.mocked(mockClient1.listTools).mockResolvedValue({ tools: tools1 });
      vi.mocked(mockClient2.listTools).mockResolvedValue({ tools: tools2 });

      // Build registry with custom separator
      const childClients = new Map([
        ['github', mockClient1],
        ['filesystem', mockClient2]
      ]);
      const registry = await buildToolRegistry(childClients, '__');

      // Verify registry uses double underscore separator
      expect(registry.size).toBe(2);
      expect(registry.has('github__create_issue')).toBe(true);
      expect(registry.has('filesystem__read_file')).toBe(true);

      // Should NOT have colon separator
      expect(registry.has('github:create_issue')).toBe(false);
      expect(registry.has('filesystem:read_file')).toBe(false);

      // Verify parsing works with double underscore separator
      const parsed1 = parseToolPrefix('github__create_issue', '__');
      const parsed2 = parseToolPrefix('filesystem__read_file', '__');

      expect(parsed1).not.toBeNull();
      expect(parsed1?.serverKey).toBe('github');
      expect(parsed1?.toolName).toBe('create_issue');

      expect(parsed2).not.toBeNull();
      expect(parsed2?.serverKey).toBe('filesystem');
      expect(parsed2?.toolName).toBe('read_file');

      // Verify tool call routing (check originalName is preserved)
      const githubEntry = registry.get('github__create_issue');
      const filesystemEntry = registry.get('filesystem__read_file');

      expect(githubEntry?.originalName).toBe('create_issue');
      expect(filesystemEntry?.originalName).toBe('read_file');
    });

    it('should work with dot separator', async () => {
      const tools: ToolSchema[] = [
        { name: 'query', description: 'Database query', inputSchema: { type: 'object' } }
      ];

      vi.mocked(mockClient1.listTools).mockResolvedValue({ tools });

      const childClients = new Map([['database', mockClient1]]);
      const registry = await buildToolRegistry(childClients, '.');

      expect(registry.has('database.query')).toBe(true);
      expect(registry.has('database:query')).toBe(false);

      const parsed = parseToolPrefix('database.query', '.');
      expect(parsed?.serverKey).toBe('database');
      expect(parsed?.toolName).toBe('query');
    });

    it('should work with multi-character separator ::', async () => {
      const tools: ToolSchema[] = [
        { name: 'get_user', description: 'Get user', inputSchema: { type: 'object' } }
      ];

      vi.mocked(mockClient1.listTools).mockResolvedValue({ tools });

      const childClients = new Map([['api', mockClient1]]);
      const registry = await buildToolRegistry(childClients, '::');

      expect(registry.has('api::get_user')).toBe(true);

      const parsed = parseToolPrefix('api::get_user', '::');
      expect(parsed?.serverKey).toBe('api');
      expect(parsed?.toolName).toBe('get_user');
    });
  });

  describe('T040-T041: [US3] Separator validation integration tests', () => {
    it('T040: should reject empty separator in end-to-end flow', async () => {
      const tools: ToolSchema[] = [
        { name: 'test_tool', description: 'Test tool', inputSchema: { type: 'object' } }
      ];

      vi.mocked(mockClient1.listTools).mockResolvedValue({ tools });

      const childClients = new Map([['server', mockClient1]]);

      // Empty separator should throw during registry build
      await expect(async () => {
        await buildToolRegistry(childClients, '');
      }).rejects.toThrow();
    });

    it('T041: should reject whitespace separator in end-to-end flow', async () => {
      const tools: ToolSchema[] = [
        { name: 'test_tool', description: 'Test tool', inputSchema: { type: 'object' } }
      ];

      vi.mocked(mockClient1.listTools).mockResolvedValue({ tools });

      const childClients = new Map([['server', mockClient1]]);

      // Whitespace separators should throw during registry build
      await expect(async () => {
        await buildToolRegistry(childClients, ' ');
      }).rejects.toThrow();

      await expect(async () => {
        await buildToolRegistry(childClients, '\t');
      }).rejects.toThrow();

      await expect(async () => {
        await buildToolRegistry(childClients, '\n');
      }).rejects.toThrow();

      await expect(async () => {
        await buildToolRegistry(childClients, '_ _');
      }).rejects.toThrow();
    });

    it('should accept valid separators in end-to-end flow', async () => {
      const tools: ToolSchema[] = [
        { name: 'test_tool', description: 'Test tool', inputSchema: { type: 'object' } }
      ];

      vi.mocked(mockClient1.listTools).mockResolvedValue({ tools });

      const childClients = new Map([['server', mockClient1]]);

      // Valid separators should work
      await expect(buildToolRegistry(childClients, '__')).resolves.toBeDefined();
      await expect(buildToolRegistry(childClients, '::')).resolves.toBeDefined();
      await expect(buildToolRegistry(childClients, '.')).resolves.toBeDefined();
      await expect(buildToolRegistry(childClients, '-')).resolves.toBeDefined();
    });

    it('should validate separator before building registry', async () => {
      const tools: ToolSchema[] = [
        { name: 'tool1', description: 'Tool 1', inputSchema: { type: 'object' } }
      ];

      vi.mocked(mockClient1.listTools).mockResolvedValue({ tools });

      const childClients = new Map([['server', mockClient1]]);

      // Test that validation happens early (before any tools are processed)
      const invalidSeparators = ['', ' ', '\t', '  ', '_ _'];

      for (const sep of invalidSeparators) {
        await expect(async () => {
          await buildToolRegistry(childClients, sep);
        }).rejects.toThrow();
      }
    });
  });
});

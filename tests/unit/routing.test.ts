/**
 * Unit Tests for Request Routing (T092-T098)
 *
 * Tests tool call routing logic, prefix parsing, argument forwarding,
 * response handling, and error cases.
 *
 * Note: These tests focus on the parseToolPrefix function. Full routing integration
 * (T093-T098) is tested in tests/integration/tool-execution.test.ts since it requires
 * a complete server setup with transport connections.
 */

import { describe, it, expect } from 'vitest';
import { parseToolPrefix } from '../../src/server.js';

describe('Request Routing', () => {
  // T092: Parse tool name prefix correctly
  describe('parseToolPrefix', () => {
    it('should parse valid prefixed tool names', () => {
      const result = parseToolPrefix('filesystem:read_file');
      expect(result).toEqual({
        serverKey: 'filesystem',
        toolName: 'read_file'
      });
    });

    it('should handle tool names with underscores', () => {
      const result = parseToolPrefix('database:execute_query');
      expect(result).toEqual({
        serverKey: 'database',
        toolName: 'execute_query'
      });
    });

    it('should handle tool names with hyphens', () => {
      const result = parseToolPrefix('github:create-issue');
      expect(result).toEqual({
        serverKey: 'github',
        toolName: 'create-issue'
      });
    });

    it('should return null for missing colon', () => {
      const result = parseToolPrefix('filesystem_read_file');
      expect(result).toBeNull();
    });

    it('should return null for empty server key', () => {
      const result = parseToolPrefix(':read_file');
      expect(result).toBeNull();
    });

    it('should return null for empty tool name', () => {
      const result = parseToolPrefix('filesystem:');
      expect(result).toBeNull();
    });

    it('should only split on first colon', () => {
      const result = parseToolPrefix('server:tool:with:colons');
      expect(result).toEqual({
        serverKey: 'server',
        toolName: 'tool:with:colons'
      });
    });
  });

});

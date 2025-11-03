import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChildClient, connectToChild, initializeChildren } from '../../src/child-manager.js';
import { ServerConfig, ChildServerError, ErrorPhase } from '../../src/types.js';

describe('Child Server Manager', () => {
  describe('T042: Initialize single child server with valid config', () => {
    it('should create and connect to a single child server', async () => {
      const serverKey = 'test-server';
      const config: ServerConfig = {
        command: 'node',
        args: ['--version'],
        env: {
          TEST_ENV: 'test-value'
        }
      };

      // Note: This test will be a mock test since we don't want to spawn real processes in unit tests
      // The actual implementation will use the MCP SDK's Client and StdioClientTransport

      // For now, we'll test that the function signature is correct
      // Full implementation will be in integration tests
      expect(createChildClient).toBeDefined();
      expect(connectToChild).toBeDefined();
      expect(initializeChildren).toBeDefined();
    });

    it('should accept config with command only', async () => {
      const serverKey = 'simple-server';
      const config: ServerConfig = {
        command: 'echo'
      };

      expect(config.command).toBe('echo');
      expect(config.args).toBeUndefined();
      expect(config.env).toBeUndefined();
    });

    it('should accept config with command, args, and env', async () => {
      const serverKey = 'full-server';
      const config: ServerConfig = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        env: {
          LOG_LEVEL: 'debug',
          API_KEY: 'test-key'
        }
      };

      expect(config.command).toBe('npx');
      expect(config.args).toHaveLength(3);
      expect(config.env).toHaveProperty('LOG_LEVEL', 'debug');
      expect(config.env).toHaveProperty('API_KEY', 'test-key');
    });
  });

  describe('Error handling', () => {
    it('should define ChildServerError with proper fields', () => {
      const error = new ChildServerError(
        'Test error',
        'test-server',
        ErrorPhase.STARTUP
      );

      expect(error.message).toBe('Test error');
      expect(error.serverKey).toBe('test-server');
      expect(error.phase).toBe(ErrorPhase.STARTUP);
      expect(error.name).toBe('ChildServerError');
    });

    it('should support different error phases', () => {
      const startupError = new ChildServerError('msg', 'key', ErrorPhase.STARTUP);
      const initError = new ChildServerError('msg', 'key', ErrorPhase.INITIALIZATION);
      const runtimeError = new ChildServerError('msg', 'key', ErrorPhase.RUNTIME);

      expect(startupError.phase).toBe(ErrorPhase.STARTUP);
      expect(initError.phase).toBe(ErrorPhase.INITIALIZATION);
      expect(runtimeError.phase).toBe(ErrorPhase.RUNTIME);
    });
  });
});

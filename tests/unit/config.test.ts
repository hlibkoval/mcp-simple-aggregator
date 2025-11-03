import { describe, it, expect } from 'vitest';
import { readConfigFile, parseConfig, validateConfig } from '../../src/config.js';
import { ConfigError, ConfigErrorCode } from '../../src/types.js';

describe('Config Parsing', () => {
  describe('T023: Parse valid MCP config JSON', () => {
    it('should parse a valid config with single server', async () => {
      const validConfig = {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
            env: {
              LOG_LEVEL: 'info'
            }
          }
        }
      };

      const parsed = parseConfig(validConfig);

      expect(parsed).toEqual(validConfig);
      expect(parsed.mcpServers).toBeDefined();
      expect(parsed.mcpServers.filesystem).toBeDefined();
      expect(parsed.mcpServers.filesystem.command).toBe('npx');
      expect(parsed.mcpServers.filesystem.args).toHaveLength(3);
      expect(parsed.mcpServers.filesystem.env).toBeDefined();
    });

    it('should parse a valid config with multiple servers', async () => {
      const validConfig = {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']
          },
          postgres: {
            command: 'node',
            args: ['/path/to/server.js'],
            env: {
              DATABASE_URL: 'postgresql://localhost:5432/test'
            }
          }
        }
      };

      const parsed = parseConfig(validConfig);

      expect(parsed.mcpServers).toBeDefined();
      expect(Object.keys(parsed.mcpServers)).toHaveLength(2);
      expect(parsed.mcpServers.filesystem).toBeDefined();
      expect(parsed.mcpServers.postgres).toBeDefined();
    });

    it('should parse config with optional fields missing', async () => {
      const validConfig = {
        mcpServers: {
          simple: {
            command: 'node'
          }
        }
      };

      const parsed = parseConfig(validConfig);

      expect(parsed.mcpServers.simple.command).toBe('node');
      expect(parsed.mcpServers.simple.args).toBeUndefined();
      expect(parsed.mcpServers.simple.env).toBeUndefined();
    });
  });
});

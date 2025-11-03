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

    it('T028: should handle multiple servers (3+) in config and preserve structure', async () => {
      const validConfig = {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
            env: {
              LOG_LEVEL: 'info',
              DEBUG: 'false'
            }
          },
          postgres: {
            command: 'node',
            args: ['/path/to/postgres-server.js', '--port', '5432'],
            env: {
              DATABASE_URL: 'postgresql://localhost:5432/test',
              POOL_SIZE: '10'
            }
          },
          redis: {
            command: 'python3',
            args: ['/opt/mcp/redis-server.py'],
            env: {
              REDIS_HOST: 'localhost',
              REDIS_PORT: '6379',
              REDIS_PASSWORD: 'secret'
            }
          },
          simple: {
            command: 'bash'
          }
        }
      };

      const parsed = parseConfig(validConfig);

      // Verify parsed structure matches original
      expect(parsed).toEqual(validConfig);

      // Verify mcpServers exists and has correct number of servers
      expect(parsed.mcpServers).toBeDefined();
      expect(Object.keys(parsed.mcpServers)).toHaveLength(4);

      // Verify filesystem server structure
      expect(parsed.mcpServers.filesystem).toBeDefined();
      expect(parsed.mcpServers.filesystem.command).toBe('npx');
      expect(parsed.mcpServers.filesystem.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem', '/tmp']);
      expect(parsed.mcpServers.filesystem.env).toBeDefined();
      expect(parsed.mcpServers.filesystem.env?.LOG_LEVEL).toBe('info');
      expect(parsed.mcpServers.filesystem.env?.DEBUG).toBe('false');

      // Verify postgres server structure
      expect(parsed.mcpServers.postgres).toBeDefined();
      expect(parsed.mcpServers.postgres.command).toBe('node');
      expect(parsed.mcpServers.postgres.args).toEqual(['/path/to/postgres-server.js', '--port', '5432']);
      expect(parsed.mcpServers.postgres.env).toBeDefined();
      expect(parsed.mcpServers.postgres.env?.DATABASE_URL).toBe('postgresql://localhost:5432/test');
      expect(parsed.mcpServers.postgres.env?.POOL_SIZE).toBe('10');

      // Verify redis server structure
      expect(parsed.mcpServers.redis).toBeDefined();
      expect(parsed.mcpServers.redis.command).toBe('python3');
      expect(parsed.mcpServers.redis.args).toEqual(['/opt/mcp/redis-server.py']);
      expect(parsed.mcpServers.redis.env).toBeDefined();
      expect(parsed.mcpServers.redis.env?.REDIS_HOST).toBe('localhost');
      expect(parsed.mcpServers.redis.env?.REDIS_PORT).toBe('6379');
      expect(parsed.mcpServers.redis.env?.REDIS_PASSWORD).toBe('secret');

      // Verify simple server structure (minimal config)
      expect(parsed.mcpServers.simple).toBeDefined();
      expect(parsed.mcpServers.simple.command).toBe('bash');
      expect(parsed.mcpServers.simple.args).toBeUndefined();
      expect(parsed.mcpServers.simple.env).toBeUndefined();
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

  describe('T024: Reject config missing mcpServers field', () => {
    it('should throw ConfigError with INVALID_SCHEMA when mcpServers is missing', () => {
      const invalidConfig = {
        someOtherField: 'value'
      };

      expect(() => parseConfig(invalidConfig)).toThrow(ConfigError);

      try {
        parseConfig(invalidConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ConfigErrorCode.INVALID_SCHEMA);
        expect((error as ConfigError).message).toContain('mcpServers');
      }
    });

    it('should throw ConfigError when config is empty object', () => {
      const emptyConfig = {};

      expect(() => parseConfig(emptyConfig)).toThrow(ConfigError);

      try {
        parseConfig(emptyConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ConfigErrorCode.INVALID_SCHEMA);
        expect((error as ConfigError).message).toContain('mcpServers');
      }
    });
  });

  describe('T025: Reject config with invalid JSON syntax', () => {
    it('should throw ConfigError with INVALID_SCHEMA when config is an array', () => {
      const invalidConfig = [{ mcpServers: {} }];

      expect(() => parseConfig(invalidConfig)).toThrow(ConfigError);

      try {
        parseConfig(invalidConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ConfigErrorCode.INVALID_SCHEMA);
        expect((error as ConfigError).message).toContain('Config must be an object');
      }
    });

    it('should throw ConfigError with INVALID_SCHEMA when config is null', () => {
      expect(() => parseConfig(null)).toThrow(ConfigError);

      try {
        parseConfig(null);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ConfigErrorCode.INVALID_SCHEMA);
        expect((error as ConfigError).message).toContain('Config must be an object');
      }
    });

    it('should throw ConfigError with INVALID_SCHEMA when config is a string', () => {
      const invalidConfig = '{"mcpServers":{}}';

      expect(() => parseConfig(invalidConfig)).toThrow(ConfigError);

      try {
        parseConfig(invalidConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ConfigErrorCode.INVALID_SCHEMA);
        expect((error as ConfigError).message).toContain('Config must be an object');
      }
    });

    it('should throw ConfigError with INVALID_SCHEMA when config is a number', () => {
      const invalidConfig = 123;

      expect(() => parseConfig(invalidConfig)).toThrow(ConfigError);

      try {
        parseConfig(invalidConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ConfigErrorCode.INVALID_SCHEMA);
        expect((error as ConfigError).message).toContain('Config must be an object');
      }
    });

    it('should throw ConfigError with INVALID_SCHEMA when config is undefined', () => {
      expect(() => parseConfig(undefined)).toThrow(ConfigError);

      try {
        parseConfig(undefined);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ConfigErrorCode.INVALID_SCHEMA);
        expect((error as ConfigError).message).toContain('Config must be an object');
      }
    });
  });

  describe('T026: Reject server config missing command field', () => {
    it('should throw ConfigError when server config is missing command field', () => {
      const invalidConfig = {
        mcpServers: {
          myserver: {
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
            env: {
              LOG_LEVEL: 'info'
            }
          }
        }
      };

      expect(() => parseConfig(invalidConfig)).toThrow(ConfigError);

      try {
        parseConfig(invalidConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ConfigErrorCode.INVALID_SCHEMA);
        expect((error as ConfigError).message).toContain('$.mcpServers.myserver.command');
        expect((error as ConfigError).message).toContain('Missing required field: command');
        expect((error as ConfigError).details).toBeDefined();

        const details = (error as ConfigError).details as { errors: Array<{ path: string, message: string }> };
        expect(details.errors).toBeDefined();
        expect(details.errors).toHaveLength(1);
        expect(details.errors[0].path).toBe('$.mcpServers.myserver.command');
        expect(details.errors[0].message).toBe('Missing required field: command');
      }
    });

    it('should throw ConfigError when multiple servers have missing command fields', () => {
      const invalidConfig = {
        mcpServers: {
          server1: {
            args: ['arg1']
          },
          server2: {
            env: { VAR: 'value' }
          }
        }
      };

      expect(() => parseConfig(invalidConfig)).toThrow(ConfigError);

      try {
        parseConfig(invalidConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ConfigErrorCode.INVALID_SCHEMA);

        const details = (error as ConfigError).details as { errors: Array<{ path: string, message: string }> };
        expect(details.errors).toBeDefined();
        expect(details.errors.length).toBeGreaterThanOrEqual(2);

        const paths = details.errors.map(e => e.path);
        expect(paths).toContain('$.mcpServers.server1.command');
        expect(paths).toContain('$.mcpServers.server2.command');
      }
    });
  });

  describe('T027: Accept server config with optional args and env', () => {
    it('should accept server config with only command (no args, no env)', () => {
      const config = {
        mcpServers: {
          minimal: {
            command: 'node'
          }
        }
      };

      const parsed = parseConfig(config);

      expect(parsed.mcpServers.minimal).toBeDefined();
      expect(parsed.mcpServers.minimal.command).toBe('node');
      expect(parsed.mcpServers.minimal.args).toBeUndefined();
      expect(parsed.mcpServers.minimal.env).toBeUndefined();
    });

    it('should accept server config with command and args (no env)', () => {
      const config = {
        mcpServers: {
          withArgs: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem']
          }
        }
      };

      const parsed = parseConfig(config);

      expect(parsed.mcpServers.withArgs.command).toBe('npx');
      expect(parsed.mcpServers.withArgs.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem']);
      expect(parsed.mcpServers.withArgs.env).toBeUndefined();
    });

    it('should accept server config with command and env (no args)', () => {
      const config = {
        mcpServers: {
          withEnv: {
            command: 'node',
            env: {
              LOG_LEVEL: 'debug',
              NODE_ENV: 'production'
            }
          }
        }
      };

      const parsed = parseConfig(config);

      expect(parsed.mcpServers.withEnv.command).toBe('node');
      expect(parsed.mcpServers.withEnv.args).toBeUndefined();
      expect(parsed.mcpServers.withEnv.env).toEqual({
        LOG_LEVEL: 'debug',
        NODE_ENV: 'production'
      });
    });

    it('should accept multiple servers with different optional field combinations', () => {
      const config = {
        mcpServers: {
          minimal: {
            command: 'node'
          },
          withArgs: {
            command: 'npx',
            args: ['-y', 'some-package']
          },
          withEnv: {
            command: 'python',
            env: {
              PYTHON_PATH: '/usr/bin/python3'
            }
          },
          complete: {
            command: 'java',
            args: ['-jar', 'server.jar'],
            env: {
              JAVA_HOME: '/usr/lib/jvm/java-11'
            }
          }
        }
      };

      const parsed = parseConfig(config);

      // Verify all servers parsed correctly
      expect(Object.keys(parsed.mcpServers)).toHaveLength(4);

      // Minimal server
      expect(parsed.mcpServers.minimal.command).toBe('node');
      expect(parsed.mcpServers.minimal.args).toBeUndefined();
      expect(parsed.mcpServers.minimal.env).toBeUndefined();

      // Server with args only
      expect(parsed.mcpServers.withArgs.command).toBe('npx');
      expect(parsed.mcpServers.withArgs.args).toHaveLength(2);
      expect(parsed.mcpServers.withArgs.env).toBeUndefined();

      // Server with env only
      expect(parsed.mcpServers.withEnv.command).toBe('python');
      expect(parsed.mcpServers.withEnv.args).toBeUndefined();
      expect(parsed.mcpServers.withEnv.env).toBeDefined();

      // Server with both args and env
      expect(parsed.mcpServers.complete.command).toBe('java');
      expect(parsed.mcpServers.complete.args).toHaveLength(2);
      expect(parsed.mcpServers.complete.env).toBeDefined();
    });
  });
});

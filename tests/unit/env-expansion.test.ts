import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { expandEnvVar, expandConfigEnvVars } from '../../src/config.js';
import { ConfigError, ConfigErrorCode } from '../../src/types.js';

describe('Environment Variable Expansion', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env to known state
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('T033: Expand ${VAR} syntax', () => {
    it('should expand ${VAR} syntax', () => {
      process.env.TEST_VAR = 'test-value';
      process.env.API_KEY = 'secret-key-123';

      const result1 = expandEnvVar('${TEST_VAR}');
      expect(result1).toBe('test-value');

      const result2 = expandEnvVar('prefix-${API_KEY}-suffix');
      expect(result2).toBe('prefix-secret-key-123-suffix');
    });

    it('should expand multiple ${VAR} in same string', () => {
      process.env.HOST = 'localhost';
      process.env.PORT = '5432';

      const result = expandEnvVar('postgresql://${HOST}:${PORT}/db');
      expect(result).toBe('postgresql://localhost:5432/db');
    });

    it('should expand ${VAR} with underscores and numbers', () => {
      process.env.VAR_WITH_UNDERSCORE = 'value1';
      process.env.VAR123 = 'value2';

      const result1 = expandEnvVar('${VAR_WITH_UNDERSCORE}');
      expect(result1).toBe('value1');

      const result2 = expandEnvVar('${VAR123}');
      expect(result2).toBe('value2');
    });

    it('should throw ConfigError for missing ${VAR}', () => {
      delete process.env.MISSING_VAR;

      expect(() => {
        expandEnvVar('${MISSING_VAR}');
      }).toThrow(ConfigError);

      try {
        expandEnvVar('${MISSING_VAR}');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ConfigErrorCode.MISSING_ENV_VAR);
        expect((error as ConfigError).message).toContain('MISSING_VAR');
      }
    });

    it('should throw with specific variable name in error', () => {
      delete process.env.DATABASE_URL;

      try {
        expandEnvVar('postgresql://${DATABASE_URL}/mydb');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        const configError = error as ConfigError;
        expect(configError.message).toContain('DATABASE_URL');
        expect(configError.details).toHaveProperty('variable', 'DATABASE_URL');
      }
    });
  });

  describe('T034: Expand $VAR syntax', () => {
    it('should expand $VAR syntax', () => {
      process.env.TEST_VAR = 'test-value';
      process.env.API_KEY = 'secret-key-123';

      const result1 = expandEnvVar('$TEST_VAR');
      expect(result1).toBe('test-value');

      const result2 = expandEnvVar('prefix-$API_KEY-suffix');
      expect(result2).toBe('prefix-secret-key-123-suffix');
    });

    it('should expand multiple $VAR in same string', () => {
      process.env.HOST = 'localhost';
      process.env.PORT = '5432';

      const result = expandEnvVar('postgresql://$HOST:$PORT/db');
      expect(result).toBe('postgresql://localhost:5432/db');
    });

    it('should expand $VAR with underscores and numbers', () => {
      process.env.VAR_WITH_UNDERSCORE = 'value1';
      process.env.VAR123 = 'value2';

      const result1 = expandEnvVar('$VAR_WITH_UNDERSCORE');
      expect(result1).toBe('value1');

      const result2 = expandEnvVar('$VAR123');
      expect(result2).toBe('value2');
    });

    it('should throw ConfigError for missing $VAR', () => {
      delete process.env.MISSING_VAR;

      expect(() => {
        expandEnvVar('$MISSING_VAR');
      }).toThrow(ConfigError);

      try {
        expandEnvVar('$MISSING_VAR');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ConfigErrorCode.MISSING_ENV_VAR);
        expect((error as ConfigError).message).toContain('MISSING_VAR');
      }
    });

    it('should work with both ${VAR} and $VAR in same string', () => {
      process.env.USER = 'admin';
      process.env.HOST = 'localhost';

      const result = expandEnvVar('${USER}@$HOST');
      expect(result).toBe('admin@localhost');
    });

    it('should handle $VAR at end of string', () => {
      process.env.SUFFIX = 'end';

      const result = expandEnvVar('start-$SUFFIX');
      expect(result).toBe('start-end');
    });

    it('should handle $VAR at start of string', () => {
      process.env.PREFIX = 'begin';

      const result = expandEnvVar('$PREFIX-end');
      expect(result).toBe('begin-end');
    });
  });

  describe('T035: Fail on missing environment variable', () => {
    it('should throw ConfigError for missing $VAR', () => {
      delete process.env.MISSING_VAR;

      expect(() => {
        expandEnvVar('$MISSING_VAR');
      }).toThrow(ConfigError);

      try {
        expandEnvVar('$MISSING_VAR');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ConfigErrorCode.MISSING_ENV_VAR);
        expect((error as ConfigError).message).toContain('MISSING_VAR');
      }
    });

    it('should throw ConfigError for missing ${VAR}', () => {
      delete process.env.UNDEFINED_VAR;

      expect(() => {
        expandEnvVar('${UNDEFINED_VAR}');
      }).toThrow(ConfigError);

      try {
        expandEnvVar('${UNDEFINED_VAR}');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ConfigErrorCode.MISSING_ENV_VAR);
        expect((error as ConfigError).message).toContain('UNDEFINED_VAR');
      }
    });

    it('should throw for $VAR with details', () => {
      delete process.env.API_TOKEN;

      try {
        expandEnvVar('Authorization: Bearer $API_TOKEN');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        const configError = error as ConfigError;
        expect(configError.message).toContain('API_TOKEN');
        expect(configError.details).toHaveProperty('variable', 'API_TOKEN');
        expect(configError.details).toHaveProperty('originalValue', 'Authorization: Bearer $API_TOKEN');
      }
    });

    it('should throw for ${VAR} with details', () => {
      delete process.env.DB_PASSWORD;

      try {
        expandEnvVar('password=${DB_PASSWORD}');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        const configError = error as ConfigError;
        expect(configError.message).toContain('DB_PASSWORD');
        expect(configError.details).toHaveProperty('variable', 'DB_PASSWORD');
        expect(configError.details).toHaveProperty('originalValue', 'password=${DB_PASSWORD}');
      }
    });

    it('should throw with all missing variables when multiple are undefined', () => {
      delete process.env.VAR1;
      delete process.env.VAR2;
      delete process.env.VAR3;

      try {
        expandEnvVar('$VAR1 and ${VAR2} and $VAR3');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        const configError = error as ConfigError;
        expect(configError.message).toContain('VAR1');
        expect(configError.message).toContain('VAR2');
        expect(configError.message).toContain('VAR3');
        expect(configError.details).toHaveProperty('missingVariables');
        expect((configError.details as any).missingVariables).toEqual(['VAR1', 'VAR2', 'VAR3']);
      }
    });
  });

  describe('T036: Recursively expand vars in nested config', () => {
    it('should recursively expand environment variables in nested objects', () => {
      process.env.HOST = 'localhost';
      process.env.PORT = '3000';
      process.env.DB_NAME = 'mydb';

      const config = {
        server: {
          url: 'http://${HOST}:${PORT}',
          database: {
            connection: 'postgresql://${HOST}/${DB_NAME}'
          }
        }
      };

      const result = expandConfigEnvVars(config);

      expect(result).toEqual({
        server: {
          url: 'http://localhost:3000',
          database: {
            connection: 'postgresql://localhost/mydb'
          }
        }
      });
    });

    it('should recursively expand environment variables in arrays', () => {
      process.env.API_KEY = 'secret-123';
      process.env.TOKEN = 'token-456';

      const config = {
        credentials: ['${API_KEY}', '${TOKEN}'],
        nested: {
          list: ['prefix-${API_KEY}', 'suffix-${TOKEN}']
        }
      };

      const result = expandConfigEnvVars(config);

      expect(result).toEqual({
        credentials: ['secret-123', 'token-456'],
        nested: {
          list: ['prefix-secret-123', 'suffix-token-456']
        }
      });
    });

    it('should handle deeply nested structures with multiple levels', () => {
      process.env.LEVEL1 = 'l1';
      process.env.LEVEL2 = 'l2';
      process.env.LEVEL3 = 'l3';
      process.env.LEVEL4 = 'l4';

      const config = {
        a: {
          b: {
            c: {
              d: {
                value: '${LEVEL1}-${LEVEL2}-${LEVEL3}-${LEVEL4}',
                array: ['${LEVEL1}', '${LEVEL2}']
              },
              e: ['${LEVEL3}']
            }
          }
        }
      };

      const result = expandConfigEnvVars(config);

      expect(result).toEqual({
        a: {
          b: {
            c: {
              d: {
                value: 'l1-l2-l3-l4',
                array: ['l1', 'l2']
              },
              e: ['l3']
            }
          }
        }
      });
    });

    it('should handle mixed arrays of objects and primitives', () => {
      process.env.USER = 'admin';
      process.env.PASS = 'secret';

      const config = {
        items: [
          { username: '${USER}', password: '${PASS}' },
          '${USER}',
          { nested: { auth: '${USER}:${PASS}' } },
          123,
          true
        ]
      };

      const result = expandConfigEnvVars(config);

      expect(result).toEqual({
        items: [
          { username: 'admin', password: 'secret' },
          'admin',
          { nested: { auth: 'admin:secret' } },
          123,
          true
        ]
      });
    });

    it('should handle empty objects and arrays in nested structures', () => {
      process.env.VAR = 'value';

      const config = {
        empty_obj: {},
        empty_array: [],
        nested: {
          with_value: '${VAR}',
          empty_obj: {},
          empty_array: []
        }
      };

      const result = expandConfigEnvVars(config);

      expect(result).toEqual({
        empty_obj: {},
        empty_array: [],
        nested: {
          with_value: 'value',
          empty_obj: {},
          empty_array: []
        }
      });
    });

    it('should throw ConfigError for missing variables in deeply nested structures', () => {
      delete process.env.MISSING_VAR;
      process.env.VALID_VAR = 'valid';

      const config = {
        level1: {
          level2: {
            level3: {
              value: '${MISSING_VAR}'
            }
          }
        },
        other: '${VALID_VAR}'
      };

      expect(() => {
        expandConfigEnvVars(config);
      }).toThrow(ConfigError);

      try {
        expandConfigEnvVars(config);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ConfigErrorCode.MISSING_ENV_VAR);
        expect((error as ConfigError).message).toContain('MISSING_VAR');
      }
    });

    it('should handle complex MCP server configuration structure', () => {
      process.env.API_KEY = 'key-123';
      process.env.DB_HOST = 'db.example.com';
      process.env.DB_PORT = '5432';

      const config = {
        mcpServers: {
          server1: {
            command: 'node',
            args: ['server.js', '${DB_HOST}', '${DB_PORT}'],
            env: {
              API_KEY: '${API_KEY}',
              DATABASE_URL: 'postgresql://${DB_HOST}:${DB_PORT}/mydb'
            }
          },
          server2: {
            command: 'python',
            args: ['-m', 'server'],
            env: {
              KEY: '${API_KEY}'
            }
          }
        }
      };

      const result = expandConfigEnvVars(config);

      expect(result).toEqual({
        mcpServers: {
          server1: {
            command: 'node',
            args: ['server.js', 'db.example.com', '5432'],
            env: {
              API_KEY: 'key-123',
              DATABASE_URL: 'postgresql://db.example.com:5432/mydb'
            }
          },
          server2: {
            command: 'python',
            args: ['-m', 'server'],
            env: {
              KEY: 'key-123'
            }
          }
        }
      });
    });
  });

  describe('T037: Preserve non-string values during expansion', () => {
    it('should preserve numbers during expansion', () => {
      const config = {
        port: 8080,
        timeout: 30,
        ratio: 1.5,
        negative: -42
      };

      const result = expandConfigEnvVars(config);

      expect(result).toEqual({
        port: 8080,
        timeout: 30,
        ratio: 1.5,
        negative: -42
      });
    });

    it('should preserve booleans during expansion', () => {
      const config = {
        enabled: true,
        disabled: false,
        debug: true
      };

      const result = expandConfigEnvVars(config);

      expect(result).toEqual({
        enabled: true,
        disabled: false,
        debug: true
      });
    });

    it('should preserve null values during expansion', () => {
      const config = {
        optional: null,
        nullable: null
      };

      const result = expandConfigEnvVars(config);

      expect(result).toEqual({
        optional: null,
        nullable: null
      });
    });

    it('should only expand strings containing environment variable references', () => {
      process.env.API_URL = 'https://api.example.com';
      process.env.PORT = '3000';

      const config = {
        url: '${API_URL}',
        port: 8080,
        enabled: true,
        description: null,
        timeout: 30.5,
        name: 'my-service'
      };

      const result = expandConfigEnvVars(config);

      expect(result).toEqual({
        url: 'https://api.example.com',
        port: 8080,
        enabled: true,
        description: null,
        timeout: 30.5,
        name: 'my-service'
      });
    });

    it('should preserve non-string values in nested objects and arrays', () => {
      process.env.DB_HOST = 'localhost';

      const config = {
        database: {
          host: '${DB_HOST}',
          port: 5432,
          ssl: true,
          poolSize: null
        },
        servers: [
          { id: 1, active: true },
          { id: 2, active: false }
        ],
        metadata: {
          version: 2.0,
          beta: null
        }
      };

      const result = expandConfigEnvVars(config);

      expect(result).toEqual({
        database: {
          host: 'localhost',
          port: 5432,
          ssl: true,
          poolSize: null
        },
        servers: [
          { id: 1, active: true },
          { id: 2, active: false }
        ],
        metadata: {
          version: 2.0,
          beta: null
        }
      });
    });

    it('should handle mixed types in arrays', () => {
      process.env.NAME = 'test';

      const config = {
        mixed: ['${NAME}', 42, true, null, 3.14, 'literal']
      };

      const result = expandConfigEnvVars(config);

      expect(result).toEqual({
        mixed: ['test', 42, true, null, 3.14, 'literal']
      });
    });
  });
});

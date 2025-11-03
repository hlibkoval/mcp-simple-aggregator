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
});

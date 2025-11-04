import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { readConfigFile, parseConfig, expandConfigEnvVars } from '../../src/config.js';
import { initializeChildren } from '../../src/child-manager.js';
import { ConfigError, ConfigErrorCode } from '../../src/types.js';

describe('Startup Integration Tests', () => {
  let testConfigPath: string;
  const testDir = join(tmpdir(), 'mcp-aggregator-test');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    testConfigPath = join(testDir, `config-${Date.now()}.json`);
  });

  afterEach(async () => {
    try {
      await unlink(testConfigPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  describe('T062: Start with valid config, verify all children spawn', () => {
    it('should successfully parse and load a valid minimal config', async () => {
      const validConfig = {
        mcpServers: {
          simple: {
            command: 'echo'
          }
        }
      };

      await writeFile(testConfigPath, JSON.stringify(validConfig, null, 2));

      const config = await readConfigFile(testConfigPath);
      const parsed = parseConfig(config);
      const expanded = expandConfigEnvVars(parsed);

      expect(expanded).toBeDefined();
      expect(expanded.mcpServers).toBeDefined();
      expect(expanded.mcpServers.simple).toBeDefined();
      expect(expanded.mcpServers.simple.command).toBe('echo');
    });

    it('should successfully parse config with multiple servers', async () => {
      const validConfig = {
        mcpServers: {
          server1: {
            command: 'node',
            args: ['--version']
          },
          server2: {
            command: 'echo',
            args: ['test']
          }
        }
      };

      await writeFile(testConfigPath, JSON.stringify(validConfig, null, 2));

      const config = await readConfigFile(testConfigPath);
      const parsed = parseConfig(config);

      expect(Object.keys(parsed.mcpServers)).toHaveLength(2);
      expect(parsed.mcpServers.server1).toBeDefined();
      expect(parsed.mcpServers.server2).toBeDefined();
    });

    // Note: Full child spawning tests require mock MCP servers
    // These will be implemented in a separate test file with proper mocks
  });

  describe('T063: Fail startup with missing config file', () => {
    it('should throw ConfigError when config file does not exist', async () => {
      const nonExistentPath = join(testDir, 'does-not-exist.json');

      await expect(readConfigFile(nonExistentPath)).rejects.toThrow(ConfigError);

      try {
        await readConfigFile(nonExistentPath);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ConfigErrorCode.FILE_NOT_FOUND);
        expect((error as ConfigError).message).toContain('not found');
        expect((error as ConfigError).message).toContain(nonExistentPath);
      }
    });

    it('should include file path in error details', async () => {
      const nonExistentPath = '/path/to/missing/config.json';

      try {
        await readConfigFile(nonExistentPath);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        const configError = error as ConfigError;
        expect(configError.details).toHaveProperty('path', nonExistentPath);
      }
    });
  });

  describe('T064: Fail startup with invalid JSON', () => {
    it('should throw ConfigError for invalid JSON syntax', async () => {
      const invalidJSON = '{invalid json content}';
      await writeFile(testConfigPath, invalidJSON);

      await expect(readConfigFile(testConfigPath)).rejects.toThrow(ConfigError);

      try {
        await readConfigFile(testConfigPath);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ConfigErrorCode.INVALID_JSON);
        expect((error as ConfigError).message).toContain('Invalid JSON');
      }
    });

    it('should throw ConfigError for malformed JSON', async () => {
      const malformedJSON = '{"mcpServers": {"server1": {command: "echo"}}}'; // Missing quotes
      await writeFile(testConfigPath, malformedJSON);

      await expect(readConfigFile(testConfigPath)).rejects.toThrow(ConfigError);
    });

    it('should include error details for invalid JSON', async () => {
      const invalidJSON = '{broken';
      await writeFile(testConfigPath, invalidJSON);

      try {
        await readConfigFile(testConfigPath);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        const configError = error as ConfigError;
        expect(configError.details).toBeDefined();
        expect(configError.details).toHaveProperty('path');
      }
    });
  });

  describe('T065: Fail startup with missing env var', () => {
    it('should throw ConfigError when referenced env var is missing', async () => {
      const configWithEnv = {
        mcpServers: {
          server: {
            command: 'echo',
            env: {
              API_KEY: '${MISSING_ENV_VAR}'
            }
          }
        }
      };

      await writeFile(testConfigPath, JSON.stringify(configWithEnv, null, 2));

      const config = await readConfigFile(testConfigPath);
      const parsed = parseConfig(config);

      // Delete the env var to ensure it's missing
      delete process.env.MISSING_ENV_VAR;

      expect(() => expandConfigEnvVars(parsed)).toThrow(ConfigError);

      try {
        expandConfigEnvVars(parsed);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).code).toBe(ConfigErrorCode.MISSING_ENV_VAR);
        expect((error as ConfigError).message).toContain('MISSING_ENV_VAR');
      }
    });

    it('should specify which variable is missing', async () => {
      const configWithEnv = {
        mcpServers: {
          server: {
            command: 'node',
            env: {
              DATABASE_URL: '${DATABASE_URL_MISSING}'
            }
          }
        }
      };

      await writeFile(testConfigPath, JSON.stringify(configWithEnv, null, 2));

      const config = await readConfigFile(testConfigPath);
      const parsed = parseConfig(config);

      delete process.env.DATABASE_URL_MISSING;

      try {
        expandConfigEnvVars(parsed);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        const configError = error as ConfigError;
        expect(configError.message).toContain('DATABASE_URL_MISSING');
        expect(configError.details).toHaveProperty('variable', 'DATABASE_URL_MISSING');
      }
    });

    it('should handle multiple missing env vars', async () => {
      const configWithMultipleEnv = {
        mcpServers: {
          server: {
            command: 'node',
            env: {
              VAR1: '${MISSING_VAR_1}',
              VAR2: '${MISSING_VAR_2}'
            }
          }
        }
      };

      await writeFile(testConfigPath, JSON.stringify(configWithMultipleEnv, null, 2));

      const config = await readConfigFile(testConfigPath);
      const parsed = parseConfig(config);

      delete process.env.MISSING_VAR_1;
      delete process.env.MISSING_VAR_2;

      try {
        expandConfigEnvVars(parsed);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        const configError = error as ConfigError;
        expect(configError.message).toMatch(/MISSING_VAR_[12]/);
      }
    });
  });

  describe('T066: Fail startup with unreachable child server', () => {
    it('should handle config with invalid command', async () => {
      const configWithInvalidCommand = {
        mcpServers: {
          invalid: {
            command: 'nonexistent-command-xyz'
          }
        }
      };

      await writeFile(testConfigPath, JSON.stringify(configWithInvalidCommand, null, 2));

      const config = await readConfigFile(testConfigPath);
      const parsed = parseConfig(config);
      const expanded = expandConfigEnvVars(parsed);

      // Note: Actual spawning test would require real child process
      // This test verifies the config parses correctly
      // Full spawn failure testing will be done with mocks
      expect(expanded.mcpServers.invalid.command).toBe('nonexistent-command-xyz');
    });

    // Note: Full child server unreachability tests require:
    // 1. Mock child processes
    // 2. Timeout mechanisms
    // 3. Error propagation tests
    // These will be added when implementing full integration test suite
  });
});

import { describe, it, expect } from 'vitest';
import { parseCliArgs, validateCliArgs } from '../../src/index.js';

describe('CLI Argument Parsing', () => {
  describe('T054: Parse --config argument', () => {
    it('should parse --config argument', () => {
      const args = ['--config', '/path/to/config.json'];
      const parsed = parseCliArgs(args);

      expect(parsed.configPath).toBe('/path/to/config.json');
    });

    it('should parse --config with absolute path', () => {
      const args = ['--config', '/Users/username/config.json'];
      const parsed = parseCliArgs(args);

      expect(parsed.configPath).toBe('/Users/username/config.json');
    });

    it('should parse --config with relative path', () => {
      const args = ['--config', './config.json'];
      const parsed = parseCliArgs(args);

      expect(parsed.configPath).toBe('./config.json');
    });

    it('should handle --config=path syntax', () => {
      const args = ['--config=/path/to/config.json'];
      const parsed = parseCliArgs(args);

      expect(parsed.configPath).toBe('/path/to/config.json');
    });
  });

  describe('CLI argument validation', () => {
    it('should accept valid CLI args', () => {
      const args = { configPath: '/path/to/config.json' };
      expect(() => validateCliArgs(args)).not.toThrow();
    });

    it('should reject missing configPath', () => {
      const args = { configPath: undefined as any };
      expect(() => validateCliArgs(args)).toThrow();
      expect(() => validateCliArgs(args)).toThrow(/config.*required/i);
    });

    it('should reject empty configPath', () => {
      const args = { configPath: '' };
      expect(() => validateCliArgs(args)).toThrow();
      expect(() => validateCliArgs(args)).toThrow(/config.*required/i);
    });
  });

  describe('Optional arguments', () => {
    it('should parse --debug flag', () => {
      const args = ['--config', '/path/to/config.json', '--debug'];
      const parsed = parseCliArgs(args);

      expect(parsed.configPath).toBe('/path/to/config.json');
      expect(parsed.debug).toBe(true);
    });

    it('should default debug to false', () => {
      const args = ['--config', '/path/to/config.json'];
      const parsed = parseCliArgs(args);

      expect(parsed.debug).toBe(false);
    });

    it('should parse --name option', () => {
      const args = ['--config', '/path/to/config.json', '--name', 'my-aggregator'];
      const parsed = parseCliArgs(args);

      expect(parsed.name).toBe('my-aggregator');
    });

    it('should parse --version option', () => {
      const args = ['--config', '/path/to/config.json', '--version', '2.0.0'];
      const parsed = parseCliArgs(args);

      expect(parsed.version).toBe('2.0.0');
    });

    it('should use default name and version', () => {
      const args = ['--config', '/path/to/config.json'];
      const parsed = parseCliArgs(args);

      expect(parsed.name).toBe('mcp-simple-aggregator');
      expect(parsed.version).toBe('1.0.0');
    });
  });
});

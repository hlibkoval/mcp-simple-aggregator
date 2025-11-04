import { describe, it, expect, vi } from 'vitest';
import { parseCliArgs, validateCliArgs, validateSeparator } from '../../src/index.js';

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

  describe('T055: Reject missing --config argument', () => {
    it('should accept valid CLI args', () => {
      const args = { configPath: '/path/to/config.json' };
      expect(() => validateCliArgs(args)).not.toThrow();
    });

    it('should reject missing configPath', () => {
      const args = { configPath: undefined as any };
      expect(() => validateCliArgs(args)).toThrow();
      expect(() => validateCliArgs(args)).toThrow(/config.*required/i);
    });

    it('should reject when configPath property is absent', () => {
      const args = {} as any;
      expect(() => validateCliArgs(args)).toThrow();
      expect(() => validateCliArgs(args)).toThrow(/config.*required/i);
    });

    it('should reject empty configPath', () => {
      const args = { configPath: '' };
      expect(() => validateCliArgs(args)).toThrow();
      expect(() => validateCliArgs(args)).toThrow(/config.*required/i);
    });

    it('should reject whitespace-only configPath', () => {
      const args = { configPath: '   ' };
      expect(() => validateCliArgs(args)).toThrow();
      expect(() => validateCliArgs(args)).toThrow(/config.*required/i);
    });

    it('should reject null configPath', () => {
      const args = { configPath: null as any };
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

  describe('T057: Help message display', () => {
    it('should display help message for --help flag', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

      const args = ['--help'];
      parseCliArgs(args);

      expect(consoleLogSpy).toHaveBeenCalled();
      const helpOutput = consoleLogSpy.mock.calls.map(call => call[0]).join('');
      expect(helpOutput).toContain('MCP Simple Aggregator');
      expect(helpOutput).toContain('Usage:');
      expect(helpOutput).toContain('--config <path>');
      expect(helpOutput).toContain('--debug');
      expect(helpOutput).toContain('--help');
      expect(processExitSpy).toHaveBeenCalledWith(0);

      consoleLogSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should display help message for -h flag', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

      const args = ['-h'];
      parseCliArgs(args);

      expect(consoleLogSpy).toHaveBeenCalled();
      const helpOutput = consoleLogSpy.mock.calls.map(call => call[0]).join('');
      expect(helpOutput).toContain('MCP Simple Aggregator');
      expect(helpOutput).toContain('Usage:');
      expect(processExitSpy).toHaveBeenCalledWith(0);

      consoleLogSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });

  describe('T002: [US1] Default separator behavior', () => {
    it('should not set separator field when not provided', () => {
      const args = ['--config', '/path/to/config.json'];
      const parsed = parseCliArgs(args);

      expect(parsed.separator).toBeUndefined();
    });

    it('should preserve backward compatibility with no separator argument', () => {
      const args = ['--config', '/path/to/config.json', '--debug'];
      const parsed = parseCliArgs(args);

      expect(parsed.configPath).toBe('/path/to/config.json');
      expect(parsed.debug).toBe(true);
      expect(parsed.separator).toBeUndefined();
    });

    it('should work with all other CLI options without separator', () => {
      const args = [
        '--config', '/path/to/config.json',
        '--name', 'test-aggregator',
        '--version', '2.0.0',
        '--debug'
      ];
      const parsed = parseCliArgs(args);

      expect(parsed.configPath).toBe('/path/to/config.json');
      expect(parsed.name).toBe('test-aggregator');
      expect(parsed.version).toBe('2.0.0');
      expect(parsed.debug).toBe(true);
      expect(parsed.separator).toBeUndefined();
    });
  });

  describe('T017-T018: [US2] Parse --separator argument', () => {
    it('T017: should parse --separator argument with space syntax', () => {
      const args = ['--config', '/path/to/config.json', '--separator', '__'];
      const parsed = parseCliArgs(args);

      expect(parsed.configPath).toBe('/path/to/config.json');
      expect(parsed.separator).toBe('__');
    });

    it('T018: should parse --separator=value format', () => {
      const args = ['--config', '/path/to/config.json', '--separator=__'];
      const parsed = parseCliArgs(args);

      expect(parsed.configPath).toBe('/path/to/config.json');
      expect(parsed.separator).toBe('__');
    });

    it('should parse --separator with dot', () => {
      const args = ['--config', '/path/to/config.json', '--separator', '.'];
      const parsed = parseCliArgs(args);

      expect(parsed.separator).toBe('.');
    });

    it('should parse --separator with multi-character string', () => {
      const args = ['--config', '/path/to/config.json', '--separator', '::'];
      const parsed = parseCliArgs(args);

      expect(parsed.separator).toBe('::');
    });

    it('should work with separator and other options', () => {
      const args = [
        '--config', '/path/to/config.json',
        '--separator', '__',
        '--debug',
        '--name', 'my-aggregator'
      ];
      const parsed = parseCliArgs(args);

      expect(parsed.configPath).toBe('/path/to/config.json');
      expect(parsed.separator).toBe('__');
      expect(parsed.debug).toBe(true);
      expect(parsed.name).toBe('my-aggregator');
    });
  });

  describe('T034-T036: [US3] validateSeparator tests', () => {
    it('T034: should reject empty string separator', () => {
      expect(() => validateSeparator('')).toThrow();
      expect(() => validateSeparator('')).toThrow(/separator cannot be empty/i);
      expect(() => validateSeparator('')).toThrow(/use --separator/i);
    });

    it('T035: should reject separator with whitespace characters', () => {
      // Single space
      expect(() => validateSeparator(' ')).toThrow();
      expect(() => validateSeparator(' ')).toThrow(/separator cannot contain whitespace/i);

      // Tab character
      expect(() => validateSeparator('\t')).toThrow();
      expect(() => validateSeparator('\t')).toThrow(/whitespace/i);

      // Newline
      expect(() => validateSeparator('\n')).toThrow();
      expect(() => validateSeparator('\n')).toThrow(/whitespace/i);

      // Multiple spaces
      expect(() => validateSeparator('  ')).toThrow();
      expect(() => validateSeparator('  ')).toThrow(/whitespace/i);

      // Separator with space inside
      expect(() => validateSeparator('_ _')).toThrow();
      expect(() => validateSeparator('_ _')).toThrow(/whitespace/i);

      // Separator with space at end
      expect(() => validateSeparator('__ ')).toThrow();
      expect(() => validateSeparator('__ ')).toThrow(/whitespace/i);

      // Separator with space at start
      expect(() => validateSeparator(' __')).toThrow();
      expect(() => validateSeparator(' __')).toThrow(/whitespace/i);
    });

    it('T036: should accept valid multi-character separators', () => {
      expect(() => validateSeparator('__')).not.toThrow();
      expect(() => validateSeparator('::')).not.toThrow();
      expect(() => validateSeparator('.')).not.toThrow();
      expect(() => validateSeparator(':')).not.toThrow();
      expect(() => validateSeparator('--')).not.toThrow();
      expect(() => validateSeparator('->')).not.toThrow();
      expect(() => validateSeparator('|')).not.toThrow();
      expect(() => validateSeparator('/')).not.toThrow();
    });

    it('should accept single-character non-whitespace separators', () => {
      expect(() => validateSeparator('_')).not.toThrow();
      expect(() => validateSeparator('-')).not.toThrow();
      expect(() => validateSeparator('|')).not.toThrow();
      expect(() => validateSeparator('.')).not.toThrow();
    });

    it('should provide helpful error message for empty separator', () => {
      try {
        validateSeparator('');
        throw new Error('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('empty');
        expect((error as Error).message).toContain('--separator');
        expect((error as Error).message).toContain('default: ":"');
      }
    });

    it('should provide helpful error message for whitespace separator', () => {
      try {
        validateSeparator(' ');
        throw new Error('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('whitespace');
        expect((error as Error).message).toContain('__');
        expect((error as Error).message).toContain('-');
      }
    });
  });
});

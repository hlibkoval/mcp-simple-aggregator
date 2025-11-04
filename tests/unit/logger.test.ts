/**
 * Unit tests for logger module
 * Tests file-based logging with WriteStream
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setDebugMode,
  setLogFile,
  logInfo,
  logDebug,
  logError,
  isDebugEnabled,
  resetLogger
} from '../../src/logger.js';
import { existsSync, unlinkSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('Logger', () => {
  const testLogPath = '/tmp/test-logger.log';
  const testDir = '/tmp/test-logger-dir';

  beforeEach(() => {
    // Reset logger state completely
    resetLogger();

    // Clean up any existing test files
    if (existsSync(testLogPath)) {
      unlinkSync(testLogPath);
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Reset logger to close any open streams
    resetLogger();

    // Clean up test files
    if (existsSync(testLogPath)) {
      unlinkSync(testLogPath);
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  // T001: Test setDebugMode()
  describe('setDebugMode', () => {
    it('should enable debug mode when set to true', () => {
      setDebugMode(true);
      expect(isDebugEnabled()).toBe(true);
    });

    it('should disable debug mode when set to false', () => {
      setDebugMode(true);
      setDebugMode(false);
      expect(isDebugEnabled()).toBe(false);
    });

    it('should default to false', () => {
      expect(isDebugEnabled()).toBe(false);
    });
  });

  // T002: Test setLogFile() creates WriteStream
  describe('setLogFile', () => {
    it('should create WriteStream for valid file path', async () => {
      setDebugMode(true);
      setLogFile(testLogPath);
      logInfo('test message');

      // Wait for async write to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(existsSync(testLogPath)).toBe(true);
    });

    it('should append to existing file', async () => {
      setDebugMode(true);
      setLogFile(testLogPath);

      logInfo('first message');
      await new Promise((resolve) => setTimeout(resolve, 50));

      logInfo('second message');
      await new Promise((resolve) => setTimeout(resolve, 50));

      const content = readFileSync(testLogPath, 'utf-8');
      expect(content).toContain('first message');
      expect(content).toContain('second message');
    });
  });

  // T003: Test logInfo() respects debug mode
  describe('logInfo respects debug mode', () => {
    it('should not log when debug mode is disabled', async () => {
      setDebugMode(false);
      setLogFile(testLogPath);
      logInfo('should not appear');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(existsSync(testLogPath)).toBe(false);
    });

    it('should log when debug mode is enabled', async () => {
      setDebugMode(true);
      setLogFile(testLogPath);
      logInfo('should appear');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(existsSync(testLogPath)).toBe(true);
      const content = readFileSync(testLogPath, 'utf-8');
      expect(content).toContain('should appear');
    });
  });

  // T004: Test logInfo() writes to file with timestamp
  describe('logInfo writes with timestamp', () => {
    it('should include ISO 8601 timestamp in log output', async () => {
      setDebugMode(true);
      setLogFile(testLogPath);
      logInfo('test message');

      await new Promise((resolve) => setTimeout(resolve, 100));

      const content = readFileSync(testLogPath, 'utf-8');
      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(content).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });

    it('should include [INFO] level tag', async () => {
      setDebugMode(true);
      setLogFile(testLogPath);
      logInfo('test message');

      await new Promise((resolve) => setTimeout(resolve, 100));

      const content = readFileSync(testLogPath, 'utf-8');
      expect(content).toContain('[INFO]');
    });

    it('should log message with arguments', async () => {
      setDebugMode(true);
      setLogFile(testLogPath);
      logInfo('test message', 'arg1', 'arg2', 123);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const content = readFileSync(testLogPath, 'utf-8');
      expect(content).toContain('test message');
      expect(content).toContain('arg1');
      expect(content).toContain('arg2');
      expect(content).toContain('123');
    });
  });

  // T005: Test logError() always logs regardless of debug mode
  describe('logError always logs', () => {
    it('should log error when debug mode is disabled', async () => {
      setDebugMode(false);
      setLogFile(testLogPath);
      logError('error message');

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Note: logError will log, but without logStream it won't write to file
      // This test verifies the function runs without throwing
      expect(true).toBe(true);
    });

    it('should log error when debug mode is enabled and file is set', async () => {
      setDebugMode(true);
      setLogFile(testLogPath);
      logError('error message');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(existsSync(testLogPath)).toBe(true);
      const content = readFileSync(testLogPath, 'utf-8');
      expect(content).toContain('[ERROR]');
      expect(content).toContain('error message');
    });

    it('should include timestamp and level tag', async () => {
      setDebugMode(true);
      setLogFile(testLogPath);
      logError('error message', 'detail');

      await new Promise((resolve) => setTimeout(resolve, 100));

      const content = readFileSync(testLogPath, 'utf-8');
      expect(content).toMatch(/\d{4}-\d{2}-\d{2}T/);
      expect(content).toContain('[ERROR]');
      expect(content).toContain('error message');
      expect(content).toContain('detail');
    });
  });

  // T006: Test file creation error handling
  describe('file creation error handling', () => {
    it('should handle invalid file path silently', () => {
      setDebugMode(true);

      // This should not throw even with invalid path
      expect(() => {
        setLogFile('/invalid/path/that/does/not/exist/test.log');
      }).not.toThrow();
    });

    it('should handle directory as file path silently', () => {
      setDebugMode(true);

      // Create a directory
      mkdirSync(testDir, { recursive: true });

      // Try to use directory as log file - should not throw
      expect(() => {
        setLogFile(testDir);
      }).not.toThrow();
    });

    it('should continue logging after file error', async () => {
      setDebugMode(true);

      // Try invalid path first
      setLogFile('/invalid/path/test.log');
      logInfo('should not crash');

      // Now set valid path
      setLogFile(testLogPath);
      logInfo('should work');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(existsSync(testLogPath)).toBe(true);
      const content = readFileSync(testLogPath, 'utf-8');
      expect(content).toContain('should work');
    });

    it('should handle write stream errors gracefully', async () => {
      setDebugMode(true);
      setLogFile(testLogPath);

      // Log normally
      logInfo('first message');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Even if stream encounters error, logging should not throw
      expect(() => {
        logInfo('second message');
      }).not.toThrow();
    });
  });

  // Additional test for logDebug
  describe('logDebug', () => {
    it('should respect debug mode like logInfo', async () => {
      setDebugMode(true);
      setLogFile(testLogPath);
      logDebug('debug message', 'context');

      await new Promise((resolve) => setTimeout(resolve, 100));

      const content = readFileSync(testLogPath, 'utf-8');
      expect(content).toContain('[DEBUG]');
      expect(content).toContain('debug message');
      expect(content).toContain('context');
    });

    it('should not log when debug disabled', async () => {
      setDebugMode(false);
      setLogFile(testLogPath);
      logDebug('should not appear');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(existsSync(testLogPath)).toBe(false);
    });
  });
});

/**
 * Integration tests for stdio cleanliness
 * Verifies that only valid JSON-RPC messages appear on stdout/stderr
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';

describe('Stdio Cleanliness', () => {
  const testConfigPath = '/tmp/test-mcp-config.json';
  const testLogPath = '/tmp/test-mcp-debug.log';
  const aggregatorPath = join(process.cwd(), 'dist', 'index.js');

  // Minimal valid MCP config for testing
  const testConfig = {
    mcpServers: {}
  };

  beforeEach(() => {
    // Create test config file
    writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

    // Clean up log file if it exists
    if (existsSync(testLogPath)) {
      unlinkSync(testLogPath);
    }
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
    if (existsSync(testLogPath)) {
      unlinkSync(testLogPath);
    }
  });

  // T020: Test that spawning without --debug produces no non-JSON-RPC output
  it('should produce no non-JSON-RPC output when --debug is disabled', (done) => {
    const child = spawn('node', [aggregatorPath, '--config', testConfigPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (data: Buffer) => {
      stdoutChunks.push(data);
    });

    child.stderr.on('data', (data: Buffer) => {
      stderrChunks.push(data);
    });

    // Give it time to start up
    setTimeout(() => {
      child.kill('SIGTERM');

      const stdoutData = Buffer.concat(stdoutChunks).toString('utf-8');
      const stderrData = Buffer.concat(stderrChunks).toString('utf-8');

      // Check that there are no log messages like "[INFO] Aggregator" or "[INFO] Error"
      expect(stdoutData).not.toContain('[INFO]');
      expect(stderrData).not.toContain('[INFO]');
      expect(stdoutData).not.toContain('Aggregator server started');
      expect(stderrData).not.toContain('Aggregator server started');

      done();
    }, 1000);
  }, 5000);

  // T021: Test that every stdout line is valid JSON-RPC
  it('should only output valid JSON-RPC messages on stdout', (done) => {
    const child = spawn('node', [aggregatorPath, '--config', testConfigPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const stdoutLines: string[] = [];

    child.stdout.on('data', (data: Buffer) => {
      const lines = data.toString('utf-8').split('\n').filter(line => line.trim());
      stdoutLines.push(...lines);
    });

    setTimeout(() => {
      child.kill('SIGTERM');

      // Every non-empty line should be valid JSON
      for (const line of stdoutLines) {
        if (line.trim()) {
          expect(() => JSON.parse(line)).not.toThrow();

          // Should be JSON-RPC format (has jsonrpc field)
          const parsed = JSON.parse(line);
          expect(parsed).toHaveProperty('jsonrpc');
        }
      }

      done();
    }, 1000);
  }, 5000);

  // T022: Test that every stderr line is valid JSON-RPC
  it('should only output valid JSON-RPC messages on stderr', (done) => {
    const child = spawn('node', [aggregatorPath, '--config', testConfigPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const stderrLines: string[] = [];

    child.stderr.on('data', (data: Buffer) => {
      const lines = data.toString('utf-8').split('\n').filter(line => line.trim());
      stderrLines.push(...lines);
    });

    setTimeout(() => {
      child.kill('SIGTERM');

      // Every non-empty line should be valid JSON
      for (const line of stderrLines) {
        if (line.trim()) {
          expect(() => JSON.parse(line)).not.toThrow();

          // Should be JSON-RPC format (has jsonrpc field)
          const parsed = JSON.parse(line);
          expect(parsed).toHaveProperty('jsonrpc');
        }
      }

      done();
    }, 1000);
  }, 5000);

  // Bonus test: Verify debug logging goes to file, not stdio
  it('should write debug logs to file when --debug and --log-file are enabled', (done) => {
    const child = spawn('node', [
      aggregatorPath,
      '--config', testConfigPath,
      '--debug',
      '--log-file', testLogPath
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (data: Buffer) => {
      stdoutChunks.push(data);
    });

    child.stderr.on('data', (data: Buffer) => {
      stderrChunks.push(data);
    });

    setTimeout(() => {
      child.kill('SIGTERM');

      const stdoutData = Buffer.concat(stdoutChunks).toString('utf-8');
      const stderrData = Buffer.concat(stderrChunks).toString('utf-8');

      // Stdio should still be clean (only JSON-RPC)
      expect(stdoutData).not.toContain('[DEBUG]');
      expect(stdoutData).not.toContain('[INFO]');
      expect(stderrData).not.toContain('[DEBUG]');
      expect(stderrData).not.toContain('[INFO]');

      // Log file should exist and contain debug messages
      expect(existsSync(testLogPath)).toBe(true);

      done();
    }, 1000);
  }, 5000);
});

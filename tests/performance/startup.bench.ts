/**
 * Performance Benchmark: Startup Time (T118)
 *
 * Success Criterion SC-001:
 * The aggregator must be able to start and initialize 10 child servers in less than 5 seconds.
 *
 * This benchmark validates:
 * - Config file parsing performance
 * - Parallel child server spawning
 * - Initial tool registry population
 * - Overall startup latency
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { spawn, ChildProcess } from 'child_process';

describe('Startup Performance Benchmarks', () => {
  let configPath: string;
  let tempDir: string;
  let aggregatorProcess: ChildProcess | null = null;

  beforeEach(() => {
    // Create a unique temp directory for this test
    tempDir = join(tmpdir(), `mcp-aggregator-bench-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    configPath = join(tempDir, 'bench-config.json');
  });

  afterEach(() => {
    // Clean up spawned processes
    if (aggregatorProcess) {
      aggregatorProcess.kill('SIGTERM');
      aggregatorProcess = null;
    }

    // Clean up temp files
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should start with 10 child servers in less than 5 seconds', async () => {
    // Create a config with 10 mock child servers
    const config = {
      mcpServers: {
        server1: { command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'] },
        server2: { command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'] },
        server3: { command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'] },
        server4: { command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'] },
        server5: { command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'] },
        server6: { command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'] },
        server7: { command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'] },
        server8: { command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'] },
        server9: { command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'] },
        server10: { command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'] },
      },
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const startTime = Date.now();

    // Spawn the aggregator process
    const promise = new Promise<number>((resolve, reject) => {
      aggregatorProcess = spawn('node', ['dist/index.js', '--config', configPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let initialized = false;

      aggregatorProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();

        // Look for initialization complete messages
        if (output.includes('MCP server running') || output.includes('initialized')) {
          if (!initialized) {
            initialized = true;
            const elapsedTime = Date.now() - startTime;
            resolve(elapsedTime);
          }
        }
      });

      aggregatorProcess.stderr?.on('data', (data: Buffer) => {
        const error = data.toString();
        if (!initialized) {
          reject(new Error(`Startup failed: ${error}`));
        }
      });

      aggregatorProcess.on('error', (error) => {
        if (!initialized) {
          reject(error);
        }
      });

      // Timeout after 10 seconds (should fail if > 5s)
      setTimeout(() => {
        if (!initialized) {
          reject(new Error('Startup timeout: exceeded 10 seconds'));
        }
      }, 10000);
    });

    try {
      const elapsedTime = await promise;

      // Log the result for analysis
      console.log(`Startup time for 10 servers: ${elapsedTime}ms`);

      // Assert against the 5-second target (SC-001)
      expect(elapsedTime).toBeLessThan(5000);
    } finally {
      // Ensure cleanup happens
      if (aggregatorProcess) {
        aggregatorProcess.kill('SIGTERM');
        aggregatorProcess = null;
      }
    }
  }, 15000); // 15 second timeout for the test itself

  it('should start with 5 child servers in less than 3 seconds', async () => {
    // Additional benchmark with fewer servers to test scaling
    const config = {
      mcpServers: {
        server1: { command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'] },
        server2: { command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'] },
        server3: { command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'] },
        server4: { command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'] },
        server5: { command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'] },
      },
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const startTime = Date.now();

    const promise = new Promise<number>((resolve, reject) => {
      aggregatorProcess = spawn('node', ['dist/index.js', '--config', configPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let initialized = false;

      aggregatorProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();

        if (output.includes('MCP server running') || output.includes('initialized')) {
          if (!initialized) {
            initialized = true;
            const elapsedTime = Date.now() - startTime;
            resolve(elapsedTime);
          }
        }
      });

      aggregatorProcess.stderr?.on('data', (data: Buffer) => {
        const error = data.toString();
        if (!initialized) {
          reject(new Error(`Startup failed: ${error}`));
        }
      });

      aggregatorProcess.on('error', (error) => {
        if (!initialized) {
          reject(error);
        }
      });

      setTimeout(() => {
        if (!initialized) {
          reject(new Error('Startup timeout: exceeded 10 seconds'));
        }
      }, 10000);
    });

    try {
      const elapsedTime = await promise;

      console.log(`Startup time for 5 servers: ${elapsedTime}ms`);

      expect(elapsedTime).toBeLessThan(3000);
    } finally {
      if (aggregatorProcess) {
        aggregatorProcess.kill('SIGTERM');
        aggregatorProcess = null;
      }
    }
  }, 15000);

  it('should start with 1 child server in less than 1 second', async () => {
    // Baseline benchmark with single server
    const config = {
      mcpServers: {
        server1: { command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'] },
      },
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const startTime = Date.now();

    const promise = new Promise<number>((resolve, reject) => {
      aggregatorProcess = spawn('node', ['dist/index.js', '--config', configPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let initialized = false;

      aggregatorProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();

        if (output.includes('MCP server running') || output.includes('initialized')) {
          if (!initialized) {
            initialized = true;
            const elapsedTime = Date.now() - startTime;
            resolve(elapsedTime);
          }
        }
      });

      aggregatorProcess.stderr?.on('data', (data: Buffer) => {
        const error = data.toString();
        if (!initialized) {
          reject(new Error(`Startup failed: ${error}`));
        }
      });

      aggregatorProcess.on('error', (error) => {
        if (!initialized) {
          reject(error);
        }
      });

      setTimeout(() => {
        if (!initialized) {
          reject(new Error('Startup timeout: exceeded 10 seconds'));
        }
      }, 10000);
    });

    try {
      const elapsedTime = await promise;

      console.log(`Startup time for 1 server: ${elapsedTime}ms`);

      expect(elapsedTime).toBeLessThan(1000);
    } finally {
      if (aggregatorProcess) {
        aggregatorProcess.kill('SIGTERM');
        aggregatorProcess = null;
      }
    }
  }, 15000);
});

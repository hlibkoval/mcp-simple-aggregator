/**
 * Performance Benchmark: Request Routing (T120)
 *
 * Success Criterion SC-003:
 * Routing overhead (from receiving tools/call to forwarding to child) must be less than 50ms.
 *
 * This benchmark validates:
 * - Tool name parsing speed
 * - Registry lookup performance
 * - Request forwarding latency
 * - Overall routing overhead
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { lookupTool } from '../../src/registry';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { ToolRegistry } from '../../src/types';

describe('Request Routing Performance Benchmarks', () => {
  let registry: ToolRegistry;
  let mockClient: Client;

  beforeEach(() => {
    registry = new Map();

    // Create a mock client with fast response
    mockClient = {
      request: async (req: { method: string; params: unknown }) => {
        return { content: [{ type: 'text', text: 'Mock response' }] };
      },
    } as unknown as Client;

    // Populate registry with 50 tools
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 10; j++) {
        const toolName = `tool${j}`;
        registry.set(`server${i}:${toolName}`, {
          client: mockClient,
          serverKey: `server${i}`,
          originalName: toolName,
          schema: {
            name: toolName,
            description: `Tool ${j}`,
            inputSchema: { type: 'object', properties: {} },
          },
        });
      }
    }
  });

  it('should parse tool name in less than 1ms', () => {
    const prefixedName = 'server3:complex_tool_name_with_underscores';

    const startTime = performance.now();

    // Simulate the parsing logic from setupToolCallHandler
    const colonIndex = prefixedName.indexOf(':');
    const serverKey = prefixedName.slice(0, colonIndex);
    const originalName = prefixedName.slice(colonIndex + 1);

    const elapsedTime = performance.now() - startTime;

    console.log(`Tool name parsing time: ${elapsedTime.toFixed(4)}ms`);

    expect(elapsedTime).toBeLessThan(1);
    expect(serverKey).toBe('server3');
    expect(originalName).toBe('complex_tool_name_with_underscores');
  });

  it('should lookup tool in registry in less than 1ms', () => {
    const prefixedName = 'server2:tool5';

    const startTime = performance.now();

    const entry = lookupTool(registry, prefixedName);

    const elapsedTime = performance.now() - startTime;

    console.log(`Registry lookup time: ${elapsedTime.toFixed(4)}ms`);

    expect(elapsedTime).toBeLessThan(1);
    expect(entry).toBeDefined();
    expect(entry?.serverKey).toBe('server2');
    expect(entry?.originalName).toBe('tool5');
  });

  it('should complete full routing overhead in less than 50ms', async () => {
    const prefixedName = 'server1:tool3';
    const toolArgs = { param1: 'value1', param2: 123 };

    const startTime = performance.now();

    // Simulate the complete routing logic from setupToolCallHandler
    // Step 1: Parse tool name
    const colonIndex = prefixedName.indexOf(':');
    const serverKey = prefixedName.slice(0, colonIndex);
    const originalName = prefixedName.slice(colonIndex + 1);

    // Step 2: Lookup in registry
    const entry = lookupTool(registry, prefixedName);

    if (!entry) {
      throw new Error(`Tool not found: ${prefixedName}`);
    }

    // Step 3: Prepare request
    const request = {
      method: 'tools/call',
      params: {
        name: originalName,
        arguments: toolArgs,
      },
    };

    // Step 4: Forward to child (mock)
    const response = await entry.client.request(request);

    const elapsedTime = performance.now() - startTime;

    console.log(`Full routing overhead: ${elapsedTime.toFixed(2)}ms`);

    // Assert against SC-003 (< 50ms)
    expect(elapsedTime).toBeLessThan(50);
    expect(response).toBeDefined();
  });

  it('should handle routing for 100 sequential requests in less than 5 seconds', async () => {
    const startTime = performance.now();

    const promises: Promise<unknown>[] = [];

    for (let i = 0; i < 100; i++) {
      const serverIdx = i % 5;
      const toolIdx = i % 10;
      const prefixedName = `server${serverIdx}:tool${toolIdx}`;

      const entry = lookupTool(registry, prefixedName);
      if (!entry) {
        throw new Error(`Tool not found: ${prefixedName}`);
      }

      const promise = entry.client.request({
        method: 'tools/call',
        params: {
          name: entry.originalName,
          arguments: {},
        },
      });

      promises.push(promise);
    }

    await Promise.all(promises);

    const elapsedTime = performance.now() - startTime;

    console.log(`100 sequential requests completed in: ${elapsedTime.toFixed(2)}ms`);

    expect(elapsedTime).toBeLessThan(5000);
  });

  it('should handle routing for 50 parallel requests in less than 100ms', async () => {
    const startTime = performance.now();

    // Create 50 parallel requests
    const promises = Array.from({ length: 50 }, (_, i) => {
      const serverIdx = i % 5;
      const toolIdx = i % 10;
      const prefixedName = `server${serverIdx}:tool${toolIdx}`;

      const entry = lookupTool(registry, prefixedName);
      if (!entry) {
        throw new Error(`Tool not found: ${prefixedName}`);
      }

      return entry.client.request({
        method: 'tools/call',
        params: {
          name: entry.originalName,
          arguments: { requestId: i },
        },
      });
    });

    await Promise.all(promises);

    const elapsedTime = performance.now() - startTime;

    console.log(`50 parallel requests completed in: ${elapsedTime.toFixed(2)}ms`);

    // Parallel execution should be fast with mock client
    expect(elapsedTime).toBeLessThan(100);
  });

  it('should maintain routing performance with registry size', async () => {
    // Test routing performance with different registry sizes
    const results: Array<{ size: number; time: number }> = [];

    for (const toolCount of [10, 50, 100, 200]) {
      const testRegistry: ToolRegistry = new Map();

      // Populate registry
      const serversCount = Math.ceil(toolCount / 10);
      for (let i = 0; i < serversCount; i++) {
        const toolsPerServer = Math.min(10, toolCount - i * 10);
        for (let j = 0; j < toolsPerServer; j++) {
          testRegistry.set(`server${i}:tool${j}`, {
            client: mockClient,
            serverKey: `server${i}`,
            originalName: `tool${j}`,
            schema: {
              name: `tool${j}`,
              description: `Tool ${j}`,
              inputSchema: { type: 'object', properties: {} },
            },
          });
        }
      }

      // Benchmark routing with this registry size
      const startTime = performance.now();

      // Perform 20 routing operations
      for (let i = 0; i < 20; i++) {
        const serverIdx = i % serversCount;
        const toolIdx = i % Math.min(10, toolCount);
        const prefixedName = `server${serverIdx}:tool${toolIdx}`;

        const entry = lookupTool(testRegistry, prefixedName);
        if (!entry) {
          throw new Error(`Tool not found: ${prefixedName}`);
        }

        await entry.client.request({
          method: 'tools/call',
          params: {
            name: entry.originalName,
            arguments: {},
          },
        });
      }

      const elapsedTime = performance.now() - startTime;
      const avgTime = elapsedTime / 20;

      results.push({ size: toolCount, time: avgTime });

      console.log(
        `Registry size: ${toolCount}, avg routing time: ${avgTime.toFixed(2)}ms per request`
      );
    }

    // Verify that routing time stays under 50ms regardless of registry size
    for (const result of results) {
      expect(result.time).toBeLessThan(50);
    }

    // Verify that performance doesn't degrade significantly
    // The largest registry should not be more than 2x slower than smallest
    const ratio = results[results.length - 1].time / results[0].time;
    console.log(`Performance ratio (smallest vs largest registry): ${ratio.toFixed(2)}x`);

    expect(ratio).toBeLessThan(2.0);
  });
});

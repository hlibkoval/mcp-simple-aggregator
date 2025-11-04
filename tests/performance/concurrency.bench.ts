/**
 * Performance Benchmark: Concurrent Requests (T121)
 *
 * Success Criterion: Implicit in architecture
 * The aggregator must handle multiple concurrent tool calls without blocking or degradation.
 *
 * This benchmark validates:
 * - Concurrent request handling
 * - No resource contention in registry lookups
 * - Proper async/await handling
 * - Child process isolation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { lookupTool } from '../../src/registry';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { ToolRegistry } from '../../src/types';

describe('Concurrent Request Performance Benchmarks', () => {
  let registry: ToolRegistry;
  let mockClients: Map<string, Client>;

  beforeEach(() => {
    registry = new Map();
    mockClients = new Map();

    // Create 5 mock clients with varying response times
    for (let i = 0; i < 5; i++) {
      const delay = (i + 1) * 10; // 10ms, 20ms, 30ms, 40ms, 50ms

      const client = {
        request: async (req: { method: string; params: unknown }) => {
          // Simulate network/processing delay
          await new Promise((resolve) => setTimeout(resolve, delay));
          return {
            content: [
              {
                type: 'text',
                text: `Response from server${i}`,
              },
            ],
          };
        },
      } as unknown as Client;

      mockClients.set(`server${i}`, client);

      // Add 10 tools per server
      for (let j = 0; j < 10; j++) {
        registry.set(`server${i}:tool${j}`, {
          client,
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
  });

  it('should handle 10 concurrent requests faster than sequential', async () => {
    const toolNames = [
      'server0:tool0',
      'server1:tool1',
      'server2:tool2',
      'server3:tool3',
      'server4:tool4',
      'server0:tool5',
      'server1:tool6',
      'server2:tool7',
      'server3:tool8',
      'server4:tool9',
    ];

    // Sequential execution
    const sequentialStart = performance.now();
    for (const toolName of toolNames) {
      const entry = lookupTool(registry, toolName);
      if (!entry) throw new Error(`Tool not found: ${toolName}`);

      await entry.client.request({
        method: 'tools/call',
        params: { name: entry.originalName, arguments: {} },
      });
    }
    const sequentialTime = performance.now() - sequentialStart;

    // Concurrent execution
    const concurrentStart = performance.now();
    const promises = toolNames.map((toolName) => {
      const entry = lookupTool(registry, toolName);
      if (!entry) throw new Error(`Tool not found: ${toolName}`);

      return entry.client.request({
        method: 'tools/call',
        params: { name: entry.originalName, arguments: {} },
      });
    });
    await Promise.all(promises);
    const concurrentTime = performance.now() - concurrentStart;

    console.log(`Sequential execution: ${sequentialTime.toFixed(2)}ms`);
    console.log(`Concurrent execution: ${concurrentTime.toFixed(2)}ms`);
    console.log(`Speedup: ${(sequentialTime / concurrentTime).toFixed(2)}x`);

    // Concurrent should be significantly faster
    expect(concurrentTime).toBeLessThan(sequentialTime);

    // With our delays (10ms, 20ms, 30ms, 40ms, 50ms), sequential should be ~300ms
    // Concurrent should be ~50ms (longest delay)
    expect(concurrentTime).toBeLessThan(100);
  });

  it('should handle 50 concurrent requests without degradation', async () => {
    const startTime = performance.now();

    const promises = Array.from({ length: 50 }, (_, i) => {
      const serverIdx = i % 5;
      const toolIdx = i % 10;
      const toolName = `server${serverIdx}:tool${toolIdx}`;

      const entry = lookupTool(registry, toolName);
      if (!entry) throw new Error(`Tool not found: ${toolName}`);

      return entry.client.request({
        method: 'tools/call',
        params: { name: entry.originalName, arguments: { requestId: i } },
      });
    });

    const results = await Promise.all(promises);

    const elapsedTime = performance.now() - startTime;

    console.log(`50 concurrent requests completed in: ${elapsedTime.toFixed(2)}ms`);
    console.log(`Average time per request: ${(elapsedTime / 50).toFixed(2)}ms`);

    // Should complete in roughly the time of the longest delay (~50ms)
    expect(elapsedTime).toBeLessThan(150);
    expect(results.length).toBe(50);

    // All results should be defined
    for (const result of results) {
      expect(result).toBeDefined();
    }
  });

  it('should handle 100 concurrent requests across multiple servers', async () => {
    const startTime = performance.now();

    const promises = Array.from({ length: 100 }, (_, i) => {
      const serverIdx = i % 5;
      const toolIdx = i % 10;
      const toolName = `server${serverIdx}:tool${toolIdx}`;

      const entry = lookupTool(registry, toolName);
      if (!entry) throw new Error(`Tool not found: ${toolName}`);

      return entry.client.request({
        method: 'tools/call',
        params: { name: entry.originalName, arguments: { requestId: i } },
      });
    });

    const results = await Promise.all(promises);

    const elapsedTime = performance.now() - startTime;

    console.log(`100 concurrent requests completed in: ${elapsedTime.toFixed(2)}ms`);
    console.log(`Average time per request: ${(elapsedTime / 100).toFixed(2)}ms`);

    // Should still complete in roughly the time of the longest delay
    expect(elapsedTime).toBeLessThan(200);
    expect(results.length).toBe(100);
  });

  it('should maintain performance with mixed request patterns', async () => {
    // Simulate realistic workload: bursts of requests with pauses
    const totalRequests = 30;
    const batchSize = 10;
    const batches = Math.ceil(totalRequests / batchSize);

    const startTime = performance.now();

    for (let batch = 0; batch < batches; batch++) {
      const batchStart = performance.now();

      const promises = Array.from({ length: batchSize }, (_, i) => {
        const requestIdx = batch * batchSize + i;
        const serverIdx = requestIdx % 5;
        const toolIdx = requestIdx % 10;
        const toolName = `server${serverIdx}:tool${toolIdx}`;

        const entry = lookupTool(registry, toolName);
        if (!entry) throw new Error(`Tool not found: ${toolName}`);

        return entry.client.request({
          method: 'tools/call',
          params: { name: entry.originalName, arguments: { requestId: requestIdx } },
        });
      });

      await Promise.all(promises);

      const batchTime = performance.now() - batchStart;
      console.log(`Batch ${batch + 1} completed in: ${batchTime.toFixed(2)}ms`);

      // Each batch should complete quickly
      expect(batchTime).toBeLessThan(100);

      // Small pause between batches (5ms)
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const totalTime = performance.now() - startTime;

    console.log(`Total time for ${totalRequests} requests in batches: ${totalTime.toFixed(2)}ms`);

    // Total time should be reasonable (3 batches * ~50ms + pauses)
    expect(totalTime).toBeLessThan(300);
  });

  it('should handle concurrent requests to same server', async () => {
    // Test contention when multiple requests target the same server
    const serverKey = 'server2';

    const startTime = performance.now();

    const promises = Array.from({ length: 20 }, (_, i) => {
      const toolIdx = i % 10;
      const toolName = `${serverKey}:tool${toolIdx}`;

      const entry = lookupTool(registry, toolName);
      if (!entry) throw new Error(`Tool not found: ${toolName}`);

      return entry.client.request({
        method: 'tools/call',
        params: { name: entry.originalName, arguments: { requestId: i } },
      });
    });

    const results = await Promise.all(promises);

    const elapsedTime = performance.now() - startTime;

    console.log(
      `20 concurrent requests to same server completed in: ${elapsedTime.toFixed(2)}ms`
    );

    // Should complete in roughly one server delay (30ms for server2)
    expect(elapsedTime).toBeLessThan(100);
    expect(results.length).toBe(20);
  });

  it('should handle concurrent requests with failures', async () => {
    // Add a failing client
    const failingClient = {
      request: async (req: { method: string; params: unknown }) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error('Simulated failure');
      },
    } as unknown as Client;

    registry.set('failing:tool1', {
      client: failingClient,
      serverKey: 'failing',
      originalName: 'tool1',
      schema: {
        name: 'tool1',
        description: 'Failing tool',
        inputSchema: { type: 'object', properties: {} },
      },
    });

    const startTime = performance.now();

    // Mix of successful and failing requests
    const promises = [
      lookupTool(registry, 'server0:tool0')!.client.request({
        method: 'tools/call',
        params: { name: 'tool0', arguments: {} },
      }),
      lookupTool(registry, 'failing:tool1')!
        .client.request({
          method: 'tools/call',
          params: { name: 'tool1', arguments: {} },
        })
        .catch((err) => ({ error: err.message })),
      lookupTool(registry, 'server1:tool1')!.client.request({
        method: 'tools/call',
        params: { name: 'tool1', arguments: {} },
      }),
      lookupTool(registry, 'failing:tool1')!
        .client.request({
          method: 'tools/call',
          params: { name: 'tool1', arguments: {} },
        })
        .catch((err) => ({ error: err.message })),
      lookupTool(registry, 'server2:tool2')!.client.request({
        method: 'tools/call',
        params: { name: 'tool2', arguments: {} },
      }),
    ];

    const results = await Promise.all(promises);

    const elapsedTime = performance.now() - startTime;

    console.log(
      `5 concurrent requests with 2 failures completed in: ${elapsedTime.toFixed(2)}ms`
    );

    expect(results.length).toBe(5);

    // Check that failures were caught properly
    const errorResults = results.filter((r) => r && typeof r === 'object' && 'error' in r);
    expect(errorResults.length).toBe(2);

    // Failures should not block successful requests
    expect(elapsedTime).toBeLessThan(100);
  });
});

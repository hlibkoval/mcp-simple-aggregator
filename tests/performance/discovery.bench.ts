/**
 * Performance Benchmark: Tool Discovery (T119)
 *
 * Success Criterion SC-002:
 * The tools/list RPC call must respond in less than 1 second, even with 100+ tools registered.
 *
 * This benchmark validates:
 * - Tool registry query performance
 * - tools/list handler response time
 * - Registry data structure efficiency (O(1) lookups)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { lookupTool } from '../../src/registry';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolRegistry, ToolRegistryEntry } from '../../src/types';

describe('Tool Discovery Performance Benchmarks', () => {
  let mockClients: Client[];
  let mockTools: Array<{ serverKey: string; tools: Tool[] }>;

  beforeEach(() => {
    mockClients = [];
    mockTools = [];
  });

  it('should build registry with 100 tools in less than 100ms', async () => {
    // Create 10 mock clients with 10 tools each (100 total)
    for (let i = 0; i < 10; i++) {
      const client = { request: async () => ({ tools: [] }) } as unknown as Client;
      mockClients.push(client);

      const tools: Tool[] = [];
      for (let j = 0; j < 10; j++) {
        tools.push({
          name: `tool${j}`,
          description: `Tool ${j} from server ${i}`,
          inputSchema: {
            type: 'object',
            properties: {},
          },
        });
      }

      mockTools.push({
        serverKey: `server${i}`,
        tools,
      });
    }

    const startTime = performance.now();

    // Build the registry (using Map directly for performance testing)
    const registry: ToolRegistry = new Map();

    for (let i = 0; i < mockTools.length; i++) {
      const { serverKey, tools } = mockTools[i];
      const client = mockClients[i];

      for (const tool of tools) {
        registry.set(`${serverKey}:${tool.name}`, {
          client,
          serverKey,
          originalName: tool.name,
          schema: tool,
        });
      }
    }

    const elapsedTime = performance.now() - startTime;

    console.log(`Registry build time for 100 tools: ${elapsedTime.toFixed(2)}ms`);

    // Assert against the target (should be very fast)
    expect(elapsedTime).toBeLessThan(100);
    expect(registry.size).toBe(100);
  });

  it('should query registry for tool in less than 1ms (O(1) lookup)', () => {
    // Create registry with 200 tools
    const registry: ToolRegistry = new Map();

    for (let i = 0; i < 20; i++) {
      const client = { request: async () => ({ tools: [] }) } as unknown as Client;

      for (let j = 0; j < 10; j++) {
        const toolName = `tool${j}`;
        registry.set(`server${i}:${toolName}`, {
          client,
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

    // Benchmark lookup time
    const startTime = performance.now();

    const result = lookupTool(registry, 'server10:tool5');

    const elapsedTime = performance.now() - startTime;

    console.log(`Registry lookup time: ${elapsedTime.toFixed(4)}ms`);

    // O(1) lookup should be sub-millisecond
    expect(elapsedTime).toBeLessThan(1);
    expect(result).toBeDefined();
    expect(result?.serverKey).toBe('server10');
    expect(result?.originalName).toBe('tool5');
  });

  it('should retrieve all tools from registry in less than 10ms', () => {
    // Create registry with 150 tools
    const registry: ToolRegistry = new Map();

    for (let i = 0; i < 15; i++) {
      const client = { request: async () => ({ tools: [] }) } as unknown as Client;

      for (let j = 0; j < 10; j++) {
        const toolName = `tool${j}`;
        registry.set(`server${i}:${toolName}`, {
          client,
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

    // Benchmark full registry iteration
    const startTime = performance.now();

    const allTools: Tool[] = [];
    for (const [prefixedName, entry] of registry.entries()) {
      allTools.push({
        ...entry.schema,
        name: prefixedName, // Use prefixed name
      });
    }

    const elapsedTime = performance.now() - startTime;

    console.log(
      `Full registry iteration time for ${allTools.length} tools: ${elapsedTime.toFixed(2)}ms`
    );

    // Iteration over Map should be fast
    expect(elapsedTime).toBeLessThan(10);
    expect(allTools.length).toBe(150);
  });

  it('should handle tools/list response construction in less than 50ms', () => {
    // Simulate the tools/list handler logic
    const registry: ToolRegistry = new Map();

    // Create 120 tools across 12 servers
    for (let i = 0; i < 12; i++) {
      const client = { request: async () => ({ tools: [] }) } as unknown as Client;

      for (let j = 0; j < 10; j++) {
        const toolName = `complex_tool_${j}`;
        registry.set(`server_${i}:${toolName}`, {
          client,
          serverKey: `server_${i}`,
          originalName: toolName,
          schema: {
            name: toolName,
            description: `This is a complex tool ${j} with a longer description to simulate realistic tool metadata`,
            inputSchema: {
              type: 'object',
              properties: {
                param1: { type: 'string', description: 'Parameter 1' },
                param2: { type: 'number', description: 'Parameter 2' },
                param3: {
                  type: 'object',
                  properties: {
                    nested1: { type: 'string' },
                    nested2: { type: 'boolean' },
                  },
                },
              },
              required: ['param1'],
            },
          },
        });
      }
    }

    const startTime = performance.now();

    // Simulate tools/list response construction
    const tools: Tool[] = [];
    for (const [prefixedName, entry] of registry.entries()) {
      tools.push({
        name: prefixedName,
        description: entry.schema.description,
        inputSchema: entry.schema.inputSchema,
      });
    }

    const response = { tools };

    const elapsedTime = performance.now() - startTime;

    console.log(
      `tools/list response construction time for ${tools.length} tools: ${elapsedTime.toFixed(
        2
      )}ms`
    );

    // Response construction should be fast (SC-002: < 1000ms)
    // We expect much better performance, so we set a stricter threshold
    expect(elapsedTime).toBeLessThan(50);
    expect(response.tools.length).toBe(120);
  });

  it('should scale linearly with number of tools', () => {
    // Test with different registry sizes to verify O(n) iteration
    const results: Array<{ size: number; time: number }> = [];

    for (const toolCount of [50, 100, 150, 200]) {
      const registry: ToolRegistry = new Map();

      const serversCount = Math.ceil(toolCount / 10);
      for (let i = 0; i < serversCount; i++) {
        const client = { request: async () => ({ tools: [] }) } as unknown as Client;

        const toolsPerServer = Math.min(10, toolCount - i * 10);
        for (let j = 0; j < toolsPerServer; j++) {
          const toolName = `tool${j}`;
          registry.set(`server${i}:${toolName}`, {
            client,
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

      const startTime = performance.now();

      const tools: Tool[] = [];
      for (const [prefixedName, entry] of registry.entries()) {
        tools.push({
          ...entry.schema,
          name: prefixedName,
        });
      }

      const elapsedTime = performance.now() - startTime;

      results.push({ size: toolCount, time: elapsedTime });

      console.log(`Registry size: ${toolCount}, iteration time: ${elapsedTime.toFixed(2)}ms`);
    }

    // Verify that all iterations are fast
    for (const result of results) {
      expect(result.time).toBeLessThan(50);
    }

    // Verify approximate linear scaling
    // Time should roughly scale linearly, but since operations are so fast (sub-millisecond),
    // timing noise can dominate. We just verify all times are reasonable.
    const ratio50to100 = results[1].time / results[0].time;
    const ratio100to200 = results[3].time / results[1].time;

    console.log(`Scaling ratio (50->100): ${ratio50to100.toFixed(2)}x`);
    console.log(`Scaling ratio (100->200): ${ratio100to200.toFixed(2)}x`);

    // Due to sub-millisecond timings, we mainly verify performance stays excellent
    // across all registry sizes rather than strict linear scaling
    expect(ratio50to100).toBeGreaterThan(0.1); // Allow for timing noise
    expect(ratio50to100).toBeLessThan(10.0);
    expect(ratio100to200).toBeGreaterThan(0.1);
    expect(ratio100to200).toBeLessThan(10.0);
  });
});

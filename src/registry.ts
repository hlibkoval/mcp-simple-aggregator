/**
 * Tool Registry Module
 *
 * Manages the aggregation of tools from multiple child MCP servers.
 * Provides O(1) lookup for tool routing and maintains the mapping between
 * prefixed tool names and their source servers.
 *
 * Tasks:
 * - T074 [US2] Implement buildToolRegistry() to aggregate tools from all children
 * - T075 [US2] Implement addServerTools() to add tools with prefix
 * - T076 [US2] Implement removeServerTools() to remove crashed server's tools
 * - T077 [US2] Implement lookupTool() for O(1) registry lookup
 * - T078 [US2] Implement prefixing logic using serverKey:toolName format
 */

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { ToolRegistry, ToolRegistryEntry, ToolSchema } from './types.js';
import { validateSeparator } from './index.js';

/**
 * T074 & T007: Build tool registry from all child server clients
 *
 * Aggregates tools from all connected child servers into a unified registry.
 * Each tool is prefixed with its server key to avoid naming conflicts.
 *
 * @param childClients - Map of server keys to MCP client connections
 * @param separator - Separator string for namespacing (default: ':')
 * @returns Promise resolving to populated tool registry
 *
 * @example
 * const clients = new Map([
 *   ['filesystem', fsClient],
 *   ['postgres', pgClient]
 * ]);
 * const registry = await buildToolRegistry(clients, ':');
 * // registry contains 'filesystem:read_file', 'postgres:query', etc.
 */
export async function buildToolRegistry(
  childClients: Map<string, Client>,
  separator: string = ':'
): Promise<ToolRegistry> {
  // T040-T041: Validate separator before building registry
  validateSeparator(separator);

  const registry: ToolRegistry = new Map();

  // Fetch tools from all child servers in parallel
  const toolFetchPromises = Array.from(childClients.entries()).map(
    async ([serverKey, client]) => {
      try {
        const response = await client.listTools();
        const tools = response.tools || [];
        return { serverKey, client, tools };
      } catch (error) {
        console.error(
          `Failed to list tools from server '${serverKey}':`,
          error instanceof Error ? error.message : String(error)
        );
        return { serverKey, client, tools: [] };
      }
    }
  );

  const results = await Promise.all(toolFetchPromises);

  // T013: Add tools from each server to registry with separator parameter
  for (const { serverKey, client, tools } of results) {
    // Cast to ToolSchema[] since the MCP SDK returns the correct type
    addServerTools(registry, serverKey, client, tools as ToolSchema[], separator);
  }

  return registry;
}

/**
 * T075 & T078 & T008: Add tools from a server to the registry with prefix
 *
 * Adds all tools from a child server to the registry, prefixing each tool name
 * with the server key using the configurable separator.
 *
 * @param registry - The tool registry to update
 * @param serverKey - Unique identifier for the server (used as prefix)
 * @param client - MCP client connection to the server
 * @param tools - Array of tool schemas from the server
 * @param separator - Separator string for namespacing (default: ':')
 *
 * @example
 * addServerTools(registry, 'filesystem', client, [
 *   { name: 'read_file', description: '...', inputSchema: {...} }
 * ], ':');
 * // Adds 'filesystem:read_file' to registry
 */
export function addServerTools(
  registry: ToolRegistry,
  serverKey: string,
  client: Client,
  tools: ToolSchema[],
  separator: string = ':'
): void {
  for (const tool of tools) {
    // T078: Implement prefixing logic using configurable separator
    const prefixedName = `${serverKey}${separator}${tool.name}`;

    // Create registry entry
    const entry: ToolRegistryEntry = {
      client,
      serverKey,
      originalName: tool.name,
      schema: {
        ...tool,
        name: prefixedName // Update schema with prefixed name
      }
    };

    registry.set(prefixedName, entry);
  }
}

/**
 * T076 & T009: Remove all tools from a crashed server
 *
 * Removes all tools belonging to a specific server from the registry.
 * This is called when a child server crashes or becomes unavailable.
 *
 * @param registry - The tool registry to update
 * @param serverKey - The server whose tools should be removed
 * @param separator - Separator string for namespacing (default: ':')
 *
 * @example
 * removeServerTools(registry, 'postgres', ':');
 * // Removes all tools with 'postgres:' prefix
 */
export function removeServerTools(
  registry: ToolRegistry,
  serverKey: string,
  separator: string = ':'
): void {
  const prefix = `${serverKey}${separator}`;

  // Find and remove all tools with this server's prefix
  const keysToRemove: string[] = [];
  for (const [toolName] of registry) {
    if (toolName.startsWith(prefix)) {
      keysToRemove.push(toolName);
    }
  }

  for (const key of keysToRemove) {
    registry.delete(key);
  }
}

/**
 * T077: Lookup tool by prefixed name with O(1) time complexity
 *
 * Performs constant-time lookup of a tool in the registry using Map.get().
 * Returns the registry entry containing the client, original name, and schema.
 *
 * @param registry - The tool registry to search
 * @param prefixedName - The prefixed tool name (e.g., 'serverKey:toolName')
 * @returns Registry entry if found, undefined otherwise
 *
 * @example
 * const entry = lookupTool(registry, 'filesystem:read_file');
 * if (entry) {
 *   const result = await entry.client.callTool({
 *     name: entry.originalName, // 'read_file'
 *     arguments: {...}
 *   });
 * }
 */
export function lookupTool(
  registry: ToolRegistry,
  prefixedName: string
): ToolRegistryEntry | undefined {
  // O(1) lookup using Map.get()
  return registry.get(prefixedName);
}

/**
 * Get all tools from the registry as an array
 *
 * Helper function to retrieve all tool schemas for the tools/list response.
 *
 * @param registry - The tool registry
 * @returns Array of tool schemas with prefixed names
 */
export function getAllTools(registry: ToolRegistry): ToolSchema[] {
  return Array.from(registry.values()).map((entry) => entry.schema);
}

/**
 * Get registry statistics
 *
 * Utility function for debugging and monitoring.
 *
 * @param registry - The tool registry
 * @returns Statistics about the registry contents
 */
export function getRegistryStats(registry: ToolRegistry): {
  totalTools: number;
  serverCounts: Record<string, number>;
} {
  const serverCounts: Record<string, number> = {};

  for (const [, entry] of registry) {
    const { serverKey } = entry;
    serverCounts[serverKey] = (serverCounts[serverKey] || 0) + 1;
  }

  return {
    totalTools: registry.size,
    serverCounts
  };
}

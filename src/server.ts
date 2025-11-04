/**
 * MCP Server Module
 *
 * Implements the aggregator MCP server that exposes tools from multiple child servers.
 * Handles tools/list and tools/call requests, routing calls to appropriate child servers.
 *
 * Tasks:
 * - T084 [US2] Implement createAggregatorServer() with Server from MCP SDK
 * - T085 [US2] Implement tools/list request handler using registry
 * - T086 [US2] Implement server initialization with capabilities
 * - T087 [US2] Wire up child crash handlers to update registry
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { ToolRegistry, ToolSchema } from './types.js';
import { removeServerTools } from './registry.js';

/**
 * Server configuration options
 */
export interface ServerOptions {
  name?: string;
  version?: string;
}

/**
 * T084: Create aggregator server with tools capability
 *
 * Creates an MCP Server instance configured to aggregate tools from child servers.
 * The server exposes tools/list and tools/call capabilities.
 *
 * @param childClients - Map of server keys to MCP client connections
 * @param registry - Tool registry containing all aggregated tools
 * @param options - Optional server name and version
 * @returns Configured MCP Server instance
 *
 * @example
 * const server = createAggregatorServer(childClients, registry, {
 *   name: 'mcp-simple-aggregator',
 *   version: '1.0.0'
 * });
 */
export function createAggregatorServer(
  childClients: Map<string, Client>,
  registry: ToolRegistry,
  options: ServerOptions = {}
): Server {
  const { name = 'mcp-simple-aggregator', version = '1.0.0' } = options;

  // T086: Initialize server with capabilities
  const server = new Server(
    {
      name,
      version
    },
    {
      capabilities: {
        tools: {} // Declare tools capability
      }
    }
  );

  // T085: Implement tools/list request handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return handleToolsList(registry);
  });

  // T087: Wire up child crash handlers to update registry
  setupCrashHandlers(childClients, registry);

  return server;
}

/**
 * T085: Handle tools/list request
 *
 * Returns all tools from the registry in MCP tools/list response format.
 *
 * @param registry - Tool registry
 * @returns MCP tools/list response
 */
export function handleToolsList(registry: ToolRegistry): { tools: ToolSchema[] } {
  const tools = Array.from(registry.values()).map((entry) => entry.schema);
  return { tools };
}

/**
 * T087 & T082: Update registry after child server crash
 *
 * Removes all tools belonging to a crashed server from the registry.
 * This function is called when a child server crashes or becomes unavailable.
 *
 * @param registry - Tool registry to update
 * @param serverKey - Server that crashed
 */
export function updateRegistryAfterCrash(
  registry: ToolRegistry,
  serverKey: string
): void {
  removeServerTools(registry, serverKey);
}

/**
 * T087: Setup child server crash handlers
 *
 * Note: The MCP SDK Client doesn't expose event emitter interface in the current version.
 * Error handling will be implemented at the transport level or through periodic health checks
 * in a future iteration. For now, this function is a placeholder for future enhancements.
 *
 * @param childClients - Map of child server clients
 * @param registry - Tool registry to update on crash
 */
function setupCrashHandlers(
  childClients: Map<string, Client>,
  registry: ToolRegistry
): void {
  // TODO: Implement crash handling when SDK provides event support
  // or implement periodic health checks
  // For now, we'll rely on tool call failures to detect unavailable servers

  // Placeholder to prevent unused variable warnings
  void childClients;
  void registry;
}

/**
 * Start the aggregator server on stdio transport
 *
 * Connects the server to stdio for communication with MCP clients.
 *
 * @param server - MCP Server instance
 * @returns Promise that resolves when server is connected
 */
export async function startServer(server: Server): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server started - no logging to prevent stdio pollution
}

/**
 * T010: Parse tool prefix from prefixed tool name with configurable separator
 *
 * Extracts the server key and original tool name from a prefixed tool name.
 * Supports configurable separator (default: ':').
 *
 * @param prefixedName - Prefixed tool name (e.g., 'filesystem:read_file')
 * @param separator - Separator string (default: ':')
 * @returns Object with serverKey and toolName, or null if invalid format
 *
 * @example
 * parseToolPrefix('filesystem:read_file', ':')
 * // Returns: { serverKey: 'filesystem', toolName: 'read_file' }
 *
 * parseToolPrefix('filesystem__read_file', '__')
 * // Returns: { serverKey: 'filesystem', toolName: 'read_file' }
 */
export function parseToolPrefix(
  prefixedName: string,
  separator: string = ':'
): { serverKey: string; toolName: string } | null {
  const separatorIndex = prefixedName.indexOf(separator);

  // Check for invalid cases: no separator, empty serverKey, or empty toolName
  if (
    separatorIndex === -1 ||
    separatorIndex === 0 ||
    separatorIndex === prefixedName.length - separator.length
  ) {
    return null;
  }

  const serverKey = prefixedName.slice(0, separatorIndex);
  const toolName = prefixedName.slice(separatorIndex + separator.length);

  return { serverKey, toolName };
}

/**
 * T011 & T015: Setup tools/call request handler with configurable separator
 *
 * Handles tool/call requests and routes them to the appropriate child server.
 * Uses configurable separator for parsing tool names.
 *
 * @param server - MCP Server instance
 * @param registry - Tool registry
 * @param separator - Separator string (default: ':')
 */
export function setupToolCallHandler(
  server: Server,
  registry: ToolRegistry,
  separator: string = ':'
): void {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: prefixedName, arguments: args } = request.params;

    // T015: Parse prefix using configurable separator
    const parsed = parseToolPrefix(prefixedName, separator);
    if (!parsed) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid tool name format. Expected 'serverKey${separator}toolName', got '${prefixedName}'`
      );
    }

    // Lookup tool in registry
    const entry = registry.get(prefixedName);
    if (!entry) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Tool not found: ${prefixedName}`
      );
    }

    // Route to child server with original tool name
    try {
      const result = await entry.client.callTool({
        name: entry.originalName,
        arguments: args || {}
      });

      return result;
    } catch (error) {
      // Forward child server errors
      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        `Error calling tool '${prefixedName}': ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

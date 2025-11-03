import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type {
  McpConfig,
  ServerConfig,
  ChildServerClient
} from './types.js';
import {
  ServerStatus,
  ChildServerError,
  ErrorPhase
} from './types.js';

/**
 * T048: Create an MCP client instance for connecting to a child server
 * @param serverKey - Unique identifier for this server from config
 * @param config - Server configuration
 * @returns Configured Client instance
 */
export function createChildClient(serverKey: string, _config: ServerConfig): Client {
  const client = new Client(
    {
      name: `mcp-aggregator-client-${serverKey}`,
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );

  return client;
}

/**
 * T049: Connect to a single child MCP server via stdio
 * @param serverKey - Unique identifier for this server
 * @param config - Server configuration with command, args, and env
 * @returns Connected ChildServerClient
 * @throws ChildServerError if connection fails
 */
export async function connectToChild(
  serverKey: string,
  config: ServerConfig
): Promise<ChildServerClient> {
  const client = createChildClient(serverKey, config);

  const childServerClient: ChildServerClient = {
    serverKey,
    client,
    config,
    status: ServerStatus.INITIALIZING
  };

  try {
    // Create stdio transport with server configuration
    const mergedEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        mergedEnv[key] = value;
      }
    }
    for (const [key, value] of Object.entries(config.env || {})) {
      mergedEnv[key] = value;
    }

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: mergedEnv
    });

    // T048: Connect client to child server
    await client.connect(transport);

    // T051: Health check - verify server responds
    try {
      await client.listTools();
      childServerClient.status = ServerStatus.RUNNING;
    } catch (error) {
      throw new ChildServerError(
        `Child server '${serverKey}' failed health check: ${(error as Error).message}`,
        serverKey,
        ErrorPhase.INITIALIZATION,
        error as Error
      );
    }

    // T052: Set up error handling for runtime failures
    client.onerror = (error) => {
      console.error(`Child server '${serverKey}' crashed:`, error);
      childServerClient.status = ServerStatus.FAILED;
      childServerClient.error = error;
    };

    return childServerClient;
  } catch (error) {
    // T052: Wrap errors with ChildServerError
    if (error instanceof ChildServerError) {
      throw error;
    }

    childServerClient.status = ServerStatus.FAILED;
    childServerClient.error = error as Error;

    throw new ChildServerError(
      `Failed to connect to child server '${serverKey}': ${(error as Error).message}`,
      serverKey,
      ErrorPhase.STARTUP,
      error as Error
    );
  }
}

/**
 * T050: Initialize all child servers from configuration
 * @param config - MCP configuration with all servers
 * @returns Map of serverKey to connected ChildServerClient
 * @throws ChildServerError if any server fails to start (fail-fast behavior)
 */
export async function initializeChildren(
  config: McpConfig
): Promise<Map<string, ChildServerClient>> {
  const children = new Map<string, ChildServerClient>();
  const serverKeys = Object.keys(config.mcpServers);

  // T053: Fail-fast startup behavior - if any child fails, exit immediately
  for (const serverKey of serverKeys) {
    const serverConfig = config.mcpServers[serverKey];
    if (!serverConfig) {
      throw new ChildServerError(
        `Server config not found for '${serverKey}'`,
        serverKey,
        ErrorPhase.STARTUP
      );
    }

    try {
      console.log(`Starting child server '${serverKey}'...`);
      const childClient = await connectToChild(serverKey, serverConfig);
      children.set(serverKey, childClient);
      console.log(`Child server '${serverKey}' started successfully`);
    } catch (error) {
      // T053: Exit on any child failure
      if (error instanceof ChildServerError) {
        console.error(`Failed to start server '${serverKey}':`, error.message);
        throw error;
      }
      throw new ChildServerError(
        `Unexpected error starting '${serverKey}': ${(error as Error).message}`,
        serverKey,
        ErrorPhase.STARTUP,
        error as Error
      );
    }
  }

  console.log(`All ${children.size} child servers started successfully`);
  return children;
}

/**
 * Gracefully shutdown a child server connection
 * @param childClient - Child server client to shutdown
 */
export async function shutdownChild(childClient: ChildServerClient): Promise<void> {
  try {
    await childClient.client.close();
    childClient.status = ServerStatus.STOPPED;
  } catch (error) {
    console.error(`Error shutting down '${childClient.serverKey}':`, error);
    childClient.status = ServerStatus.FAILED;
    childClient.error = error as Error;
  }
}

/**
 * Shutdown all child servers
 * @param children - Map of child server clients
 */
export async function shutdownAllChildren(
  children: Map<string, ChildServerClient>
): Promise<void> {
  const shutdownPromises = Array.from(children.values()).map(child =>
    shutdownChild(child)
  );

  await Promise.all(shutdownPromises);
}

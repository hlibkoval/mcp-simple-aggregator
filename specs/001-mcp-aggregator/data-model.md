# Data Model: MCP Server Aggregator

**Date**: 2025-11-03
**Feature**: MCP Server Aggregator
**Phase**: Phase 1 - Design

## Overview

This document defines all data structures, entities, and TypeScript interfaces for the MCP Server Aggregator. The system manages multiple child MCP servers and exposes their tools through a unified interface with namespaced prefixes.

## Core Entities

### 1. MCP Config

Represents the parsed Claude Desktop-compatible configuration file.

```typescript
/**
 * Standard Claude Desktop MCP configuration format
 * Reference: https://modelcontextprotocol.io/docs/tools/claude-desktop
 */
interface McpConfig {
  mcpServers: {
    [serverKey: string]: ServerConfig;
  };
}

interface ServerConfig {
  /** Command to execute (e.g., "npx", "node", "/usr/bin/python") */
  command: string;

  /** Command-line arguments for the server */
  args?: string[];

  /** Environment variables to pass to the server process */
  env?: Record<string, string>;
}
```

**Validation Rules**:
- `mcpServers` object must exist
- Each server key must be non-empty string
- `command` is required for each server
- `args` defaults to empty array if not provided
- `env` defaults to empty object if not provided
- Server keys will be used as tool prefixes

**Example**:
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user"],
      "env": {
        "LOG_LEVEL": "info"
      }
    },
    "postgres": {
      "command": "node",
      "args": ["/path/to/postgres-server.js"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    }
  }
}
```

### 2. Child Server Client

Represents a spawned child MCP server with its connection details.

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

/**
 * Wrapper for a child MCP server connection
 */
interface ChildServerClient {
  /** Unique identifier from config (used for prefixing) */
  serverKey: string;

  /** MCP SDK client connected to the child server via stdio */
  client: Client;

  /** Original server configuration */
  config: ServerConfig;

  /** Server status */
  status: ServerStatus;

  /** Error details if server failed */
  error?: Error;
}

enum ServerStatus {
  /** Server is starting up */
  INITIALIZING = 'initializing',

  /** Server is running and responding */
  RUNNING = 'running',

  /** Server crashed or failed to start */
  FAILED = 'failed',

  /** Server was intentionally stopped */
  STOPPED = 'stopped'
}
```

**State Transitions**:
```
INITIALIZING → RUNNING     (successful startup)
INITIALIZING → FAILED      (startup error)
RUNNING → FAILED           (runtime crash)
RUNNING → STOPPED          (intentional shutdown)
```

**Lifecycle**:
1. Create `Client` instance
2. Connect via `StdioClientTransport` with command/args/env
3. Verify responsiveness with `listTools()` call
4. Mark as `RUNNING` if successful
5. Listen for `error` events → transition to `FAILED`

### 3. Tool Registry

Central registry mapping prefixed tool names to their source child servers.

```typescript
/**
 * Registry entry for a single tool from a child server
 */
interface ToolRegistryEntry {
  /** MCP client connection to route requests to */
  client: Client;

  /** Server key (prefix) for this tool */
  serverKey: string;

  /** Original tool name without prefix (for forwarding to child) */
  originalName: string;

  /** Tool schema from the child server */
  schema: ToolSchema;
}

/**
 * Map from prefixed tool name (serverKey:toolName) to registry entry
 */
type ToolRegistry = Map<string, ToolRegistryEntry>;

/**
 * Tool schema as defined by MCP protocol
 */
interface ToolSchema {
  name: string;
  description?: string;
  inputSchema: JSONSchema;
}

interface JSONSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}
```

**Key Operations**:
```typescript
// Add all tools from a child server
function addServerTools(
  registry: ToolRegistry,
  serverKey: string,
  client: Client,
  tools: ToolSchema[]
): void {
  for (const tool of tools) {
    const prefixedName = `${serverKey}:${tool.name}`;
    registry.set(prefixedName, {
      client,
      serverKey,
      originalName: tool.name,
      schema: { ...tool, name: prefixedName } // Update name in schema
    });
  }
}

// Remove all tools from a crashed server
function removeServerTools(
  registry: ToolRegistry,
  serverKey: string
): void {
  const prefix = `${serverKey}:`;
  for (const [name] of registry) {
    if (name.startsWith(prefix)) {
      registry.delete(name);
    }
  }
}

// Lookup tool for routing
function lookupTool(
  registry: ToolRegistry,
  prefixedName: string
): ToolRegistryEntry | undefined {
  return registry.get(prefixedName);
}
```

**Invariants**:
- All tool names in registry have format `serverKey:originalName`
- Each prefixed name appears at most once
- Registry only contains tools from `RUNNING` servers
- When a server fails, its tools are removed immediately

### 4. Aggregator Server

The main server that exposes the aggregated MCP interface.

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * Main aggregator server instance
 */
interface AggregatorServer {
  /** MCP SDK server instance */
  server: Server;

  /** All connected child server clients */
  children: Map<string, ChildServerClient>;

  /** Aggregated tool registry */
  registry: ToolRegistry;

  /** Configuration */
  config: McpConfig;
}
```

**Server Capabilities**:
```typescript
const capabilities = {
  tools: {},  // Supports tool listing and invocation
  // resources: {},  // Not implemented in v1
  // prompts: {},    // Not implemented in v1
};
```

**Request Handlers**:
```typescript
// List all aggregated tools
server.setRequestHandler(
  ListToolsRequestSchema,
  async () => {
    return {
      tools: Array.from(registry.values()).map(entry => entry.schema)
    };
  }
);

// Route tool calls to appropriate child
server.setRequestHandler(
  CallToolRequestSchema,
  async (request) => {
    const { name, arguments: args } = request.params;

    const entry = lookupTool(registry, name);
    if (!entry) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Tool not found: ${name}`
      );
    }

    return await entry.client.callTool({
      name: entry.originalName,
      arguments: args
    });
  }
);
```

### 5. CLI Arguments

Command-line interface for the aggregator.

```typescript
/**
 * Parsed CLI arguments
 */
interface CliArgs {
  /** Path to MCP configuration JSON file */
  configPath: string;

  /** Optional: Enable debug logging */
  debug?: boolean;

  /** Optional: Server name for MCP protocol */
  name?: string;

  /** Optional: Server version for MCP protocol */
  version?: string;
}
```

**Default Values**:
```typescript
const defaults: Partial<CliArgs> = {
  debug: false,
  name: 'mcp-simple-aggregator',
  version: '1.0.0'
};
```

**Usage**:
```bash
# Required
mcp-simple-aggregator --config /path/to/config.json

# With options
mcp-simple-aggregator --config config.json --debug

# Help
mcp-simple-aggregator --help
```

## Environment Variable Expansion

### Expansion Context

```typescript
/**
 * Context for environment variable expansion
 */
interface ExpansionContext {
  /** Environment variables available for expansion */
  env: Record<string, string>;
}

/**
 * Expansion result
 */
type ExpansionResult<T> = {
  success: true;
  value: T;
} | {
  success: false;
  error: string;
  missingVars: string[];
};
```

### Expansion Algorithm

Supports both `$VAR` and `${VAR}` syntax:

```typescript
function expandEnvVar(
  value: string,
  context: ExpansionContext
): ExpansionResult<string> {
  const missingVars: string[] = [];

  const expanded = value.replace(
    /\$\{([^}]+)\}|\$([A-Z_][A-Z0-9_]*)/g,
    (match, curly, plain) => {
      const varName = curly || plain;
      const envValue = context.env[varName];

      if (envValue === undefined) {
        missingVars.push(varName);
        return match; // Keep original if missing
      }

      return envValue;
    }
  );

  if (missingVars.length > 0) {
    return {
      success: false,
      error: `Missing environment variables: ${missingVars.join(', ')}`,
      missingVars
    };
  }

  return { success: true, value: expanded };
}
```

**Recursive Expansion**:
```typescript
function expandConfigEnvVars(
  obj: unknown,
  context: ExpansionContext
): ExpansionResult<unknown> {
  if (typeof obj === 'string') {
    return expandEnvVar(obj, context);
  }

  if (Array.isArray(obj)) {
    const expanded: unknown[] = [];
    for (const item of obj) {
      const result = expandConfigEnvVars(item, context);
      if (!result.success) return result;
      expanded.push(result.value);
    }
    return { success: true, value: expanded };
  }

  if (typeof obj === 'object' && obj !== null) {
    const expanded: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const result = expandConfigEnvVars(value, context);
      if (!result.success) return result;
      expanded[key] = result.value;
    }
    return { success: true, value: expanded };
  }

  return { success: true, value: obj };
}
```

## Error Types

### Configuration Errors

```typescript
class ConfigError extends Error {
  constructor(
    message: string,
    public readonly code: ConfigErrorCode,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

enum ConfigErrorCode {
  FILE_NOT_FOUND = 'file_not_found',
  INVALID_JSON = 'invalid_json',
  INVALID_SCHEMA = 'invalid_schema',
  MISSING_ENV_VAR = 'missing_env_var'
}
```

**Examples**:
```typescript
// File not found
throw new ConfigError(
  `Config file not found: ${path}`,
  ConfigErrorCode.FILE_NOT_FOUND,
  { path }
);

// Missing environment variable
throw new ConfigError(
  `Missing environment variable: DATABASE_URL`,
  ConfigErrorCode.MISSING_ENV_VAR,
  { variable: 'DATABASE_URL', location: 'mcpServers.postgres.env.DATABASE_URL' }
);
```

### Child Server Errors

```typescript
class ChildServerError extends Error {
  constructor(
    message: string,
    public readonly serverKey: string,
    public readonly phase: ErrorPhase,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ChildServerError';
  }
}

enum ErrorPhase {
  STARTUP = 'startup',
  INITIALIZATION = 'initialization',
  RUNTIME = 'runtime'
}
```

**Examples**:
```typescript
// Startup failure
throw new ChildServerError(
  `Failed to spawn server 'postgres': command not found`,
  'postgres',
  ErrorPhase.STARTUP,
  spawnError
);

// Runtime crash
new ChildServerError(
  `Server 'filesystem' crashed during operation`,
  'filesystem',
  ErrorPhase.RUNTIME,
  crashError
);
```

## Data Flow

### Startup Sequence

```
1. Parse CLI args → CliArgs
2. Read config file → Raw JSON
3. Parse JSON → McpConfig
4. Expand env vars → Expanded McpConfig
5. For each server in config:
   a. Create Client
   b. Connect via StdioClientTransport
   c. Call listTools()
   d. Add tools to registry
   → ChildServerClient (status: RUNNING)
6. Create aggregator Server
7. Register request handlers
8. Start server on stdio
```

### Tool Call Flow

```
1. Client calls aggregator: sourcebot:search_code
2. Aggregator receives CallToolRequest
3. Parse prefix: "sourcebot"
4. Lookup in registry: registry.get("sourcebot:search_code")
5. Extract original name: "search_code"
6. Route to child: childClient.callTool({ name: "search_code", ... })
7. Child processes request
8. Child returns CallToolResult
9. Aggregator forwards response unchanged
10. Client receives result
```

### Server Crash Flow

```
1. Child process exits or emits error event
2. Client emits 'error' event
3. Error handler triggered
4. Update ChildServerClient.status → FAILED
5. Remove all tools with prefix from registry
6. Log error to stderr
7. Continue serving other servers
```

## Validation Rules

### Config Validation

```typescript
interface ConfigValidation {
  isValid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

function validateConfig(config: unknown): ConfigValidation {
  const errors: ValidationError[] = [];

  // Must be object
  if (typeof config !== 'object' || config === null) {
    return {
      isValid: false,
      errors: [{ path: '$', message: 'Config must be an object' }]
    };
  }

  // Must have mcpServers
  if (!('mcpServers' in config)) {
    errors.push({
      path: '$.mcpServers',
      message: 'Missing required field: mcpServers'
    });
  }

  const typed = config as { mcpServers?: unknown };
  const { mcpServers } = typed;

  // mcpServers must be object
  if (typeof mcpServers !== 'object' || mcpServers === null) {
    errors.push({
      path: '$.mcpServers',
      message: 'mcpServers must be an object',
      value: mcpServers
    });
    return { isValid: false, errors };
  }

  // Validate each server
  for (const [key, value] of Object.entries(mcpServers)) {
    if (typeof value !== 'object' || value === null) {
      errors.push({
        path: `$.mcpServers.${key}`,
        message: 'Server config must be an object',
        value
      });
      continue;
    }

    const server = value as Record<string, unknown>;

    // Command is required
    if (!('command' in server) || typeof server.command !== 'string') {
      errors.push({
        path: `$.mcpServers.${key}.command`,
        message: 'Missing or invalid command',
        value: server.command
      });
    }

    // Args must be array if present
    if ('args' in server && !Array.isArray(server.args)) {
      errors.push({
        path: `$.mcpServers.${key}.args`,
        message: 'args must be an array',
        value: server.args
      });
    }

    // Env must be object if present
    if ('env' in server &&
        (typeof server.env !== 'object' || server.env === null)) {
      errors.push({
        path: `$.mcpServers.${key}.env`,
        message: 'env must be an object',
        value: server.env
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
```

### Tool Name Validation

```typescript
function validateToolName(name: string): boolean {
  // Tool names must follow format: serverKey:toolName
  const parts = name.split(':');
  return (
    parts.length === 2 &&
    parts[0].length > 0 &&
    parts[1].length > 0
  );
}
```

## Performance Characteristics

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|----------------|------------------|-------|
| Registry lookup | O(1) | O(n) | Map-based, n = total tools |
| Tool listing | O(n) | O(n) | Return all registry entries |
| Add server tools | O(m) | O(m) | m = tools from one server |
| Remove server tools | O(n) | O(1) | Scan registry for prefix |
| Config validation | O(k) | O(1) | k = number of servers |
| Env var expansion | O(s × v) | O(s) | s = string length, v = variables |

## Type Exports

All types will be exported from `src/types.ts`:

```typescript
// Config types
export type { McpConfig, ServerConfig };

// Server types
export type { ChildServerClient, AggregatorServer };
export { ServerStatus };

// Registry types
export type { ToolRegistry, ToolRegistryEntry, ToolSchema, JSONSchema };

// CLI types
export type { CliArgs };

// Expansion types
export type { ExpansionContext, ExpansionResult };

// Error types
export { ConfigError, ConfigErrorCode };
export { ChildServerError, ErrorPhase };

// Validation types
export type { ConfigValidation, ValidationError };
```

This data model provides a complete type-safe foundation for the implementation.

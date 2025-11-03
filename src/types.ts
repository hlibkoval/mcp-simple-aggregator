/**
 * Type definitions for MCP Server Aggregator
 *
 * This module defines all core types, interfaces, and classes used throughout
 * the MCP Server Aggregator application.
 */

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

// ============================================================================
// Configuration Types (T014)
// ============================================================================

/**
 * Standard Claude Desktop MCP configuration format.
 *
 * This is the top-level configuration structure that maps server keys to
 * their individual configurations.
 *
 * @see https://modelcontextprotocol.io/docs/tools/claude-desktop
 */
export interface McpConfig {
  /**
   * Map of server keys to server configurations.
   * The key becomes the prefix for all tools from that server (e.g., "filesystem:read_file").
   */
  mcpServers: {
    [serverKey: string]: ServerConfig;
  };
}

/**
 * Configuration for a single child MCP server.
 *
 * Defines how to spawn and communicate with a child server process.
 */
export interface ServerConfig {
  /**
   * Command to execute (e.g., "npx", "node", "/usr/bin/python").
   * This is the executable that will be spawned.
   */
  command: string;

  /**
   * Command-line arguments for the server.
   * Optional, defaults to empty array if not provided.
   */
  args?: string[];

  /**
   * Environment variables to pass to the server process.
   * Supports $VAR and ${VAR} syntax for expansion.
   * Optional, defaults to empty object if not provided.
   */
  env?: Record<string, string>;
}

// ============================================================================
// Child Server Types (T015)
// ============================================================================

/**
 * Lifecycle status of a child MCP server.
 */
export enum ServerStatus {
  /** Server is starting up and connecting */
  INITIALIZING = 'initializing',

  /** Server is running and responding to requests */
  RUNNING = 'running',

  /** Server crashed or failed to start */
  FAILED = 'failed',

  /** Server was intentionally stopped */
  STOPPED = 'stopped',
}

/**
 * Wrapper for a child MCP server connection.
 *
 * Represents a spawned child server with its MCP SDK client connection,
 * configuration, and runtime status.
 */
export interface ChildServerClient {
  /** Unique identifier from config (used for prefixing tools) */
  serverKey: string;

  /** MCP SDK client connected to the child server via stdio */
  client: Client;

  /** Original server configuration from the config file */
  config: ServerConfig;

  /** Current runtime status of the server */
  status: ServerStatus;

  /** Error details if server failed (undefined if running) */
  error?: Error;
}

// ============================================================================
// Tool Registry Types (T016)
// ============================================================================

/**
 * Tool schema as defined by MCP protocol.
 *
 * Describes a tool's name, purpose, and input requirements.
 */
export interface ToolSchema {
  /** Tool name (prefixed in aggregator: "serverKey:toolName") */
  name: string;

  /** Human-readable description of what the tool does */
  description?: string;

  /** JSON Schema defining the tool's input parameters */
  inputSchema: JSONSchema;
}

/**
 * JSON Schema for tool input validation.
 *
 * Defines the structure and constraints for tool arguments.
 */
export interface JSONSchema {
  /** JSON Schema type (e.g., "object", "string") */
  type: string;

  /** Object property definitions (for type: "object") */
  properties?: Record<string, unknown>;

  /** Required property names (for type: "object") */
  required?: string[];

  /** Additional JSON Schema fields */
  [key: string]: unknown;
}

/**
 * Registry entry for a single tool from a child server.
 *
 * Maps a prefixed tool name to the child server that provides it,
 * along with routing information and the original tool schema.
 */
export interface ToolRegistryEntry {
  /** MCP client connection to route requests to */
  client: Client;

  /** Server key (prefix) for this tool */
  serverKey: string;

  /** Original tool name without prefix (for forwarding to child) */
  originalName: string;

  /** Tool schema from the child server (with prefixed name) */
  schema: ToolSchema;
}

/**
 * Map from prefixed tool name (serverKey:toolName) to registry entry.
 *
 * Enables O(1) lookup for routing tool calls to the correct child server.
 */
export type ToolRegistry = Map<string, ToolRegistryEntry>;

// ============================================================================
// Aggregator Server Types
// ============================================================================

/**
 * Main aggregator server instance.
 *
 * Coordinates multiple child servers and exposes their tools through
 * a unified MCP interface.
 */
export interface AggregatorServer {
  /** MCP SDK server instance exposing the aggregated interface */
  server: Server;

  /** All connected child server clients, keyed by server key */
  children: Map<string, ChildServerClient>;

  /** Aggregated tool registry with prefixed names */
  registry: ToolRegistry;

  /** Parsed configuration */
  config: McpConfig;
}

// ============================================================================
// CLI Types (T017)
// ============================================================================

/**
 * Parsed command-line arguments for the aggregator.
 *
 * Defines the CLI interface and startup configuration.
 */
export interface CliArgs {
  /** Path to MCP configuration JSON file (required) */
  configPath: string;

  /** Optional: Enable debug logging (default: false) */
  debug?: boolean;

  /** Optional: Server name for MCP protocol (default: "mcp-simple-aggregator") */
  name?: string;

  /** Optional: Server version for MCP protocol (default: "1.0.0") */
  version?: string;
}

// ============================================================================
// Environment Variable Expansion Types (T018)
// ============================================================================

/**
 * Context for environment variable expansion.
 *
 * Provides the environment variables available for substitution.
 */
export interface ExpansionContext {
  /** Environment variables available for expansion (typically process.env) */
  env: Record<string, string | undefined>;
}

/**
 * Result of environment variable expansion.
 *
 * Discriminated union indicating success with expanded value or failure
 * with error details.
 */
export type ExpansionResult<T> =
  | {
      /** Expansion succeeded */
      success: true;
      /** The expanded value */
      value: T;
    }
  | {
      /** Expansion failed */
      success: false;
      /** Error message describing the failure */
      error: string;
      /** List of missing environment variable names */
      missingVars: string[];
    };

// ============================================================================
// Error Types (T019, T020)
// ============================================================================

/**
 * Error codes for configuration validation failures.
 */
export enum ConfigErrorCode {
  /** Configuration file not found at specified path */
  FILE_NOT_FOUND = 'file_not_found',

  /** Configuration file contains invalid JSON syntax */
  INVALID_JSON = 'invalid_json',

  /** Configuration structure doesn't match required schema */
  INVALID_SCHEMA = 'invalid_schema',

  /** Referenced environment variable is missing or undefined */
  MISSING_ENV_VAR = 'missing_env_var',
}

/**
 * Configuration validation error.
 *
 * Thrown when configuration file cannot be read, parsed, or validated.
 */
export class ConfigError extends Error {
  /** Machine-readable error code */
  public readonly code: ConfigErrorCode;

  /** Additional error context (e.g., missing variable name, file path) */
  public readonly details?: unknown;

  constructor(message: string, code: ConfigErrorCode, details?: unknown) {
    super(message);
    this.name = 'ConfigError';
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

/**
 * Phase in which a child server error occurred.
 */
export enum ErrorPhase {
  /** Error during initial process spawn */
  STARTUP = 'startup',

  /** Error during connection and handshake */
  INITIALIZATION = 'initialization',

  /** Error during normal operation */
  RUNTIME = 'runtime',
}

/**
 * Child server error.
 *
 * Thrown when a child server fails to start, initialize, or crashes during operation.
 */
export class ChildServerError extends Error {
  /** Server key that identifies the failed child */
  public readonly serverKey: string;

  /** Phase in which the error occurred */
  public readonly phase: ErrorPhase;

  /** Original error that caused the failure (if available) */
  public readonly cause?: Error;

  constructor(
    message: string,
    serverKey: string,
    phase: ErrorPhase,
    cause?: Error,
  ) {
    super(message);
    this.name = 'ChildServerError';
    this.serverKey = serverKey;
    this.phase = phase;
    if (cause !== undefined) {
      this.cause = cause;
    }

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ChildServerError.prototype);
  }
}

// ============================================================================
// Validation Types (T021)
// ============================================================================

/**
 * Single validation error from config validation.
 */
export interface ValidationError {
  /** JSON path to the invalid field (e.g., "$.mcpServers.postgres.command") */
  path: string;

  /** Human-readable error message */
  message: string;

  /** The invalid value (optional, for debugging) */
  value?: unknown;
}

/**
 * Result of configuration validation.
 *
 * Contains validation status and any errors found.
 */
export interface ConfigValidation {
  /** True if config is valid and ready to use */
  isValid: boolean;

  /** List of validation errors (empty if valid) */
  errors: ValidationError[];
}

#!/usr/bin/env node

import type { CliArgs, McpConfig } from './types.js';
import { readConfigFile, parseConfig, expandConfigEnvVars } from './config.js';
import { initializeChildren, setupErrorHandlers } from './child-manager.js';
import { buildToolRegistry } from './registry.js';
import { createAggregatorServer, startServer, setupToolCallHandler } from './server.js';
import { setDebugMode, setLogFile, logDebug } from './logger.js';

/**
 * T058: Parse command-line arguments
 * @param argv - Command-line arguments (defaults to process.argv.slice(2))
 * @returns Parsed CLI arguments
 */
export function parseCliArgs(argv: string[] = process.argv.slice(2)): CliArgs {
  const args: Partial<CliArgs> = {
    debug: false,
    name: 'mcp-simple-aggregator',
    version: '1.0.0'
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;

    if (arg === '--config') {
      const nextArg = argv[++i];
      if (nextArg) {
        args.configPath = nextArg;
      }
    } else if (arg.startsWith('--config=')) {
      args.configPath = arg.substring('--config='.length);
    } else if (arg === '--debug') {
      args.debug = true;
    } else if (arg === '--log-file') {
      const nextArg = argv[++i];
      if (nextArg) {
        args.logFile = nextArg;
      }
    } else if (arg.startsWith('--log-file=')) {
      args.logFile = arg.substring('--log-file='.length);
    } else if (arg === '--name') {
      const nextArg = argv[++i];
      if (nextArg) {
        args.name = nextArg;
      }
    } else if (arg === '--version') {
      const nextArg = argv[++i];
      if (nextArg) {
        args.version = nextArg;
      }
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  return args as CliArgs;
}

/**
 * T059: Validate that required CLI arguments are provided
 * @param args - Parsed CLI arguments
 * @throws Error if config path is missing
 */
export function validateCliArgs(args: Partial<CliArgs>): void {
  if (!args.configPath || args.configPath.trim() === '') {
    throw new Error('Config path is required. Use --config <path> to specify the configuration file.');
  }
}

/**
 * T060: Print help message with usage examples
 */
function printHelp(): void {
  console.log(`
MCP Simple Aggregator - Aggregate multiple MCP servers into one

Usage:
  mcp-simple-aggregator --config <path> [options]

Required Arguments:
  --config <path>       Path to MCP configuration JSON file

Optional Arguments:
  --debug               Enable debug logging
  --log-file <path>     Path to log file (default: /tmp/mcp-aggregator-{pid}.log)
  --name <name>         Server name (default: mcp-simple-aggregator)
  --version <ver>       Server version (default: 1.0.0)
  --help, -h            Show this help message

Examples:
  # Basic usage
  mcp-simple-aggregator --config /path/to/config.json

  # With debug logging
  mcp-simple-aggregator --config /path/to/config.json --debug

  # With custom log file
  mcp-simple-aggregator --config /path/to/config.json --debug --log-file /var/log/mcp.log

  # Custom server name
  mcp-simple-aggregator --config config.json --name my-aggregator

Configuration Format:
  The config file should be a standard Claude Desktop MCP config:

  {
    "mcpServers": {
      "serverKey": {
        "command": "command-to-run",
        "args": ["arg1", "arg2"],
        "env": {
          "ENV_VAR": "\${ENV_VAR}"
        }
      }
    }
  }

For more information, visit: https://github.com/your-org/mcp-simple-aggregator
`);
}

/**
 * T061: Main entry point - wire together config parsing, env expansion, and child initialization
 */
async function main() {
  try {
    // Parse CLI arguments
    const args = parseCliArgs();
    validateCliArgs(args);

    // Set debug mode for logger
    setDebugMode(args.debug || false);

    // Initialize log file if debug mode is enabled
    if (args.debug) {
      const logFilePath = args.logFile || `/tmp/mcp-aggregator-${process.pid}.log`;
      setLogFile(logFilePath);
    }

    logDebug('[DEBUG] Starting MCP Simple Aggregator');
    logDebug('[DEBUG] Config path:', args.configPath);

    // Read and parse configuration
    logDebug('[DEBUG] Reading config file...');
    const rawConfig = await readConfigFile(args.configPath!);

    logDebug('[DEBUG] Parsing config...');
    const validConfig = parseConfig(rawConfig);

    // Expand environment variables
    logDebug('[DEBUG] Expanding environment variables...');
    const expandedConfig = expandConfigEnvVars(validConfig) as McpConfig;

    // Initialize all child servers
    logDebug('[DEBUG] Initializing child servers...');
    const children = await initializeChildren(expandedConfig);

    logDebug(`[DEBUG] ${children.size} child servers initialized successfully`);

    // Build tool registry from all children
    logDebug('[DEBUG] Building tool registry...');
    const childClients = new Map(
      Array.from(children.entries()).map(([key, child]) => [key, child.client])
    );
    const registry = await buildToolRegistry(childClients);

    logDebug(`[DEBUG] Registry built with ${registry.size} tools`);

    // Create aggregator server
    logDebug('[DEBUG] Creating aggregator server...');
    const server = createAggregatorServer(childClients, registry, {
      name: args.name || 'mcp-simple-aggregator',
      version: args.version || '1.0.0'
    });

    // Setup tool call handler
    logDebug('[DEBUG] Setting up tool call handler...');
    setupToolCallHandler(server, registry);

    // Setup error handlers for graceful degradation (T109-T112)
    logDebug('[DEBUG] Setting up error handlers...');
    setupErrorHandlers(children, registry);

    // Start the aggregator server
    logDebug('[DEBUG] Starting MCP server on stdio...');
    await startServer(server);

    logDebug(`[DEBUG] Aggregator server started successfully`);
    logDebug(`[DEBUG] Serving ${children.size} child servers with ${registry.size} tools`);

    // Keep process running
    process.on('SIGINT', async () => {
      logDebug('[DEBUG] Shutting down...');
      process.exit(0);
    });

  } catch (error) {
    // Always log fatal errors
    console.error('Fatal error:', (error as Error).message);
    logDebug((error as Error).stack || '');
    process.exit(1);
  }
}

// Run main if this is the entry point
// Check works for both direct execution and npm bin wrappers
const isDirectExecution = process.argv[1] && (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1].includes('mcp-simple-aggregator') ||
  process.argv[1].endsWith('index.js')
);

if (isDirectExecution && !process.env.VITEST) {
  main();
}

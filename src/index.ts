#!/usr/bin/env node

import type { CliArgs, McpConfig } from './types.js';
import { readConfigFile, parseConfig, expandConfigEnvVars } from './config.js';
import { initializeChildren } from './child-manager.js';

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
  --config <path>     Path to MCP configuration JSON file

Optional Arguments:
  --debug             Enable debug logging
  --name <name>       Server name (default: mcp-simple-aggregator)
  --version <ver>     Server version (default: 1.0.0)
  --help, -h          Show this help message

Examples:
  # Basic usage
  mcp-simple-aggregator --config /path/to/config.json

  # With debug logging
  mcp-simple-aggregator --config config.json --debug

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

    if (args.debug) {
      console.log('[DEBUG] Starting MCP Simple Aggregator');
      console.log('[DEBUG] Config path:', args.configPath);
    }

    // Read and parse configuration
    if (args.debug) console.log('[DEBUG] Reading config file...');
    const rawConfig = await readConfigFile(args.configPath!);

    if (args.debug) console.log('[DEBUG] Parsing config...');
    const validConfig = parseConfig(rawConfig);

    // Expand environment variables
    if (args.debug) console.log('[DEBUG] Expanding environment variables...');
    const expandedConfig = expandConfigEnvVars(validConfig) as McpConfig;

    // Initialize all child servers
    if (args.debug) console.log('[DEBUG] Initializing child servers...');
    const children = await initializeChildren(expandedConfig);

    if (args.debug) {
      console.log(`[DEBUG] ${children.size} child servers initialized successfully`);
    }

    // Create and start aggregator server
    // TODO: This will be implemented in Phase 4 (US2)
    console.log('Aggregator server started successfully');
    console.log(`Serving ${children.size} child servers`);

    // Keep process running
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      process.exit(0);
    });

  } catch (error) {
    console.error('Fatal error:', (error as Error).message);
    if (process.env.DEBUG) {
      console.error((error as Error).stack);
    }
    process.exit(1);
  }
}

// Run main if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

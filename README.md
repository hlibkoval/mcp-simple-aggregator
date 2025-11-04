# MCP Simple Aggregator

> Aggregate multiple MCP servers into a single unified server with namespaced tools.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Overview

The MCP Simple Aggregator combines multiple [Model Context Protocol (MCP)](https://modelcontextprotocol.io) servers into a single unified server. It exposes tools from all configured child servers with namespaced prefixes (e.g., `serverKey:toolName`), making it easy to use multiple MCP servers simultaneously in Claude Desktop or other MCP clients.

**Key Features:**
- ✅ Aggregate multiple MCP servers into one
- ✅ Automatic tool namespacing to avoid conflicts
- ✅ Standard Claude Desktop config format
- ✅ Environment variable expansion (`$VAR` and `${VAR}`)
- ✅ Graceful degradation (continues with remaining servers if one crashes)
- ✅ Zero configuration beyond standard MCP config
- ✅ TypeScript-based with full type safety

## Quick Start

### Installation

```bash
npm install -g mcp-simple-aggregator
```

### Create Configuration

Create a JSON config file with your MCP servers (uses standard Claude Desktop format):

**config.json:**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/username/Documents"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### Set Environment Variables

```bash
export GITHUB_TOKEN="your-github-token"
```

### Run the Aggregator

```bash
mcp-simple-aggregator --config config.json
```

### Use with Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "aggregator": {
      "command": "mcp-simple-aggregator",
      "args": ["--config", "/path/to/your/config.json"]
    }
  }
}
```

Restart Claude Desktop and your aggregated tools will be available!

## How It Works

The aggregator:

1. Reads your MCP server configuration
2. Spawns all child MCP servers via stdio
3. Discovers tools from each server
4. Prefixes tool names with the server key (e.g., `filesystem:read_file`)
5. Routes tool calls to the appropriate child server
6. Forwards responses transparently back to the client

### Tool Naming

All tools are prefixed with their server key from the config:

| Config Key | Original Tool | Aggregated Tool Name |
|-----------|---------------|---------------------|
| `filesystem` | `read_file` | `filesystem:read_file` |
| `github` | `create_issue` | `github:create_issue` |
| `postgres` | `query` | `postgres:query` |

This prevents naming conflicts when multiple servers provide tools with the same name.

### Custom Separators

By default, tools are namespaced using a colon separator (`:`, e.g., `github:create_issue`). You can customize the separator using the `--separator` argument:

**Single-character separators:**
```bash
# Dot separator
mcp-simple-aggregator --config config.json --separator "."
# Result: github.create_issue, filesystem.read_file

# Underscore separator
mcp-simple-aggregator --config config.json --separator "_"
# Result: github_create_issue, filesystem_read_file
```

**Multi-character separators:**
```bash
# Double underscore
mcp-simple-aggregator --config config.json --separator "__"
# Result: github__create_issue, filesystem__read_file

# Double colon
mcp-simple-aggregator --config config.json --separator "::"
# Result: github::create_issue, filesystem::read_file

# Arrow notation
mcp-simple-aggregator --config config.json --separator "->"
# Result: github->create_issue, filesystem->read_file
```

**Validation:**
- Separator cannot be empty
- Separator cannot contain whitespace (space, tab, newline)
- Any non-whitespace character or string is valid

**Use Cases:**
- **Language conventions**: Use `.` for Java/Python-style namespacing
- **Readability**: Use `__` for clearer visual separation
- **Compatibility**: Use `-` or `_` if `:` conflicts with other tools

### Automatic Command Resolution

The aggregator automatically resolves `node`, `npm`, and `npx` commands to absolute paths to prevent "command not found" errors, especially in environments where these executables are not in the PATH.

**How it works:**
- When you specify `"command": "node"`, it's automatically resolved to the same Node.js executable running the aggregator (e.g., `/usr/local/bin/node`)
- When you specify `"command": "npm"` or `"command": "npx"`, the aggregator checks if they exist in the same directory as Node.js
- If npm/npx are found, they're resolved to their absolute paths (e.g., `/usr/local/bin/npm`)
- If not found, the original command is used (relying on system PATH)

**Benefits:**
- ✅ **Version Consistency**: Child servers use the same Node.js version as the aggregator
- ✅ **Reliability**: Works even when PATH is not configured correctly
- ✅ **Cross-platform**: Handles Windows `.cmd` extensions automatically
- ✅ **Transparent**: No configuration changes needed

**Example:**
```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",  // Automatically resolved to /usr/local/bin/node
      "args": ["server.js"]
    }
  }
}
```

**Debugging:** Enable `--debug` mode to see resolved paths in the log file:
```bash
mcp-simple-aggregator --config config.json --debug
tail -f /tmp/mcp-aggregator-*.log
# Shows: [INFO] Resolved 'node' to '/usr/local/bin/node'
```

**Override:** To use a specific Node.js version, provide an absolute path:
```json
{
  "command": "/usr/local/bin/node18"  // Absolute paths are never modified
}
```

## Configuration

### Basic Configuration

```json
{
  "mcpServers": {
    "server-key": {
      "command": "command-to-run",
      "args": ["arg1", "arg2"],
      "env": {
        "ENV_VAR": "value"
      }
    }
  }
}
```

**Fields:**
- `mcpServers` (required): Object containing server configurations
- `server-key` (required): Unique identifier for the server (used as tool prefix)
- `command` (required): Command to execute
- `args` (optional): Array of command-line arguments
- `env` (optional): Environment variables to pass to the server

### Environment Variable Expansion

The aggregator supports environment variable expansion in string values:

**Syntax:**
- Shell-style: `$VARIABLE_NAME`
- Brace-style: `${VARIABLE_NAME}`

**Example:**
```json
{
  "mcpServers": {
    "api-server": {
      "command": "node",
      "args": ["server.js"],
      "env": {
        "API_KEY": "${API_KEY}",
        "API_URL": "$API_URL",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Before running:**
```bash
export API_KEY="sk-..."
export API_URL="https://api.example.com"
```

The aggregator will fail at startup if any referenced environment variable is missing, with a clear error message indicating which variable is needed.

### Multiple Server Instances

You can run the same server multiple times with different configurations:

```json
{
  "mcpServers": {
    "fs-home": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user"]
    },
    "fs-work": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/work/projects"]
    }
  }
}
```

This gives you `fs-home:read_file` and `fs-work:read_file` as separate tools.

## Command-Line Options

```bash
mcp-simple-aggregator --config <path> [options]
```

**Options:**
- `--config <path>` (required): Path to MCP configuration JSON file
- `--separator <chars>`: Custom separator for tool namespacing (default: `:`)
- `--debug`: Enable debug logging to file
- `--log-file <path>`: Path to log file (default: `/tmp/mcp-aggregator-{pid}.log`)
- `--name <name>`: Custom server name (default: `mcp-simple-aggregator`)
- `--version <version>`: Custom server version (default: `1.0.0`)
- `--help`, `-h`: Show help message

**Examples:**

```bash
# Basic usage (default ':' separator)
mcp-simple-aggregator --config config.json

# Custom separator (double underscore)
mcp-simple-aggregator --config config.json --separator "__"

# Custom separator (dot notation)
mcp-simple-aggregator --config config.json --separator "."

# With debug logging (logs to /tmp/mcp-aggregator-{pid}.log)
mcp-simple-aggregator --config config.json --debug

# With custom log file
mcp-simple-aggregator --config config.json --debug --log-file /var/log/mcp.log

# Custom separator and log file
mcp-simple-aggregator --config config.json --separator "__" --debug --log-file /var/log/mcp.log

# Custom server name
mcp-simple-aggregator --config config.json --name my-aggregator
```

### Debug Logging

The aggregator supports file-based debug logging that keeps stdio clean for the MCP JSON-RPC protocol:

**Enable debug logging:**
```bash
# Default log location: /tmp/mcp-aggregator-{pid}.log
mcp-simple-aggregator --config config.json --debug

# Custom log location
mcp-simple-aggregator --config config.json --debug --log-file /var/log/mcp.log
```

**Watch logs in real-time:**
```bash
tail -f /tmp/mcp-aggregator-*.log
```

**Log format:**
```
2025-11-04T15:18:05.880Z [INFO] Child server initialized: filesystem
2025-11-04T15:18:05.901Z [DEBUG] Discovered 12 tools from filesystem
2025-11-04T15:18:05.950Z [ERROR] Failed to connect to postgres: ECONNREFUSED
```

**Important:** Debug logs are written to files only, never to stdout/stderr. This prevents JSON-RPC protocol pollution that would break MCP communication.

## Use Cases

### 1. Combine Different MCP Servers

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
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

### 2. Multiple Database Connections

```json
{
  "mcpServers": {
    "db-prod": {
      "command": "node",
      "args": ["postgres-server.js"],
      "env": {
        "DATABASE_URL": "${PROD_DB_URL}"
      }
    },
    "db-staging": {
      "command": "node",
      "args": ["postgres-server.js"],
      "env": {
        "DATABASE_URL": "${STAGING_DB_URL}"
      }
    }
  }
}
```

### 3. Custom MCP Servers

```json
{
  "mcpServers": {
    "my-custom-server": {
      "command": "node",
      "args": ["/path/to/my-server/dist/index.js"],
      "env": {
        "CONFIG_PATH": "/etc/my-server/config.yaml"
      }
    }
  }
}
```

## Error Handling

### Startup Errors

The aggregator uses **fail-fast** behavior during startup. If any server fails to start, the entire aggregator exits with a clear error message:

```
Error: Failed to start server 'postgres': spawn ENOENT
```

**Common startup errors:**
- Missing config file
- Invalid JSON syntax
- Missing `mcpServers` field
- Missing required `command` field
- Missing environment variables
- Child server command not found

### Runtime Errors

The aggregator uses **graceful degradation** at runtime. If a child server crashes:

1. Error is logged to stderr
2. Failed server's tools are removed from the registry
3. Aggregator continues serving remaining servers

**Example:**
```
[ERROR] Server 'postgres' crashed: Connection refused
[INFO] Removing tools for crashed server 'postgres' from registry
[INFO] Aggregator continues serving with 47 tools from remaining servers
```

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/your-org/mcp-simple-aggregator.git
cd mcp-simple-aggregator

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linter
npm run lint
```

### Project Structure

```
mcp-simple-aggregator/
├── src/
│   ├── index.ts          # CLI entry point
│   ├── server.ts         # MCP server implementation
│   ├── registry.ts       # Tool registry
│   ├── config.ts         # Config parsing & env expansion
│   ├── child-manager.ts  # Child process management
│   └── types.ts          # TypeScript types
├── tests/
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
├── examples/
│   └── sample-config.json
├── package.json
├── tsconfig.json
└── README.md
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- config.test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm test -- --watch
```

## Troubleshooting

### "Config file not found"

**Solution:** Use an absolute path for the config file:
```bash
mcp-simple-aggregator --config /Users/username/config.json
```

### "Missing environment variable: API_KEY"

**Solution:** Export the variable before running:
```bash
export API_KEY="your-api-key"
mcp-simple-aggregator --config config.json
```

### "Failed to start server 'xyz'"

**Solution:** Verify the command exists and is in your `$PATH`:
```bash
which npx
which node
```

Or use an absolute path:
```json
{
  "command": "/usr/local/bin/node"
}
```

### "Tool not found: filesytem:read_file"

**Solution:** Check for typos in the tool name. Use `tools/list` to see available tools.

## Performance

The aggregator is designed for high performance:

- **Startup**: 10+ servers in < 5 seconds
- **Tool Discovery**: < 1 second response time
- **Routing Overhead**: < 50ms per request
- **Registry Lookup**: O(1) time complexity

## Technical Details

- **Language**: TypeScript 5.7+
- **Runtime**: Node.js v18+ (LTS)
- **Transport**: stdio only
- **Protocol**: [MCP (Model Context Protocol)](https://modelcontextprotocol.io)
- **SDK**: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)

## Resources

- **MCP Specification**: https://modelcontextprotocol.io
- **MCP TypeScript SDK**: https://github.com/modelcontextprotocol/typescript-sdk
- **Example MCP Servers**: https://github.com/modelcontextprotocol/servers
- **Claude Desktop Config**: https://docs.anthropic.com/claude/docs/mcp

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- **Issues**: https://github.com/your-org/mcp-simple-aggregator/issues
- **Discussions**: https://github.com/your-org/mcp-simple-aggregator/discussions
- **Documentation**: See `/specs/001-mcp-aggregator/` for detailed design docs

---

**Made with ❤️ for the MCP community**

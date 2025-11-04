# Quickstart Guide: MCP Server Aggregator

**Version**: 1.0.0
**Last Updated**: 2025-11-03

## Overview

The MCP Server Aggregator is a TypeScript-based tool that combines multiple MCP servers into a single unified server. It exposes tools from all configured child servers with namespaced prefixes (e.g., `serverKey:toolName`).

## Prerequisites

- **Node.js**: v18.0.0 or higher (LTS recommended)
- **npm**: v9.0.0 or higher
- **Operating System**: macOS, Linux, or Windows
- **MCP Child Servers**: At least one MCP server to aggregate

## Installation

### Option 1: Install from npm (When Published)

```bash
npm install -g mcp-simple-aggregator
```

### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/your-org/mcp-simple-aggregator.git
cd mcp-simple-aggregator

# Install dependencies
npm install

# Build the project
npm run build

# Link for local development
npm link
```

## Configuration

### 1. Create MCP Configuration File

Create a JSON file with your MCP server configurations. This uses the standard Claude Desktop MCP config format.

**Example**: `config.json`

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/username/Documents"
      ]
    },
    "postgres": {
      "command": "node",
      "args": ["/path/to/postgres-mcp-server/index.js"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    }
  }
}
```

### 2. Set Environment Variables

If your config uses environment variable expansion (e.g., `${DATABASE_URL}`), set them before running:

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"
export GITHUB_TOKEN="ghp_your_token_here"
```

### 3. Verify Configuration

The aggregator validates your config at startup. Common issues:

**Missing `mcpServers`**:
```json
❌ { "servers": { ... } }
✅ { "mcpServers": { ... } }
```

**Missing `command`**:
```json
❌ { "mcpServers": { "fs": { "args": [...] } } }
✅ { "mcpServers": { "fs": { "command": "npx", "args": [...] } } }
```

**Invalid JSON**:
```bash
# Validate JSON before running
cat config.json | jq .
```

## Running the Aggregator

### Basic Usage

```bash
mcp-simple-aggregator --config /path/to/config.json
```

The aggregator starts as an MCP server on stdio, ready to receive requests from clients like Claude Desktop.

### Using with Claude Desktop

Add the aggregator to your Claude Desktop config:

**File**: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

```json
{
  "mcpServers": {
    "aggregator": {
      "command": "mcp-simple-aggregator",
      "args": ["--config", "/Users/username/my-aggregator-config.json"]
    }
  }
}
```

**Restart Claude Desktop** to load the aggregator.

### Environment Variable Expansion

The aggregator supports two syntaxes:

1. **Shell-style**: `$VARIABLE_NAME`
2. **Brace-style**: `${VARIABLE_NAME}`

**Example**:

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

**Before running**:
```bash
export API_KEY="sk-..."
export API_URL="https://api.example.com"
mcp-simple-aggregator --config config.json
```

**Startup failure** if variables are missing:
```
Error: Missing environment variable: API_KEY
Location: mcpServers.api-server.env.API_KEY
```

## Tool Discovery

Once running, the aggregator exposes all child server tools with prefixes.

### List Available Tools

Using the MCP protocol:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

**Response**:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "filesystem:read_file",
        "description": "Read contents of a file",
        "inputSchema": {
          "type": "object",
          "properties": {
            "path": { "type": "string" }
          },
          "required": ["path"]
        }
      },
      {
        "name": "postgres:query",
        "description": "Execute SQL query",
        "inputSchema": {
          "type": "object",
          "properties": {
            "sql": { "type": "string" }
          },
          "required": ["sql"]
        }
      }
    ]
  }
}
```

**Tool Naming**: `{serverKey}:{originalToolName}`

- `filesystem` and `postgres` are keys from your config
- Tools are prefixed to avoid naming conflicts

## Calling Tools

### Example: Read a File

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "filesystem:read_file",
    "arguments": {
      "path": "README.md"
    }
  }
}
```

**Response** (forwarded from child server):

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "# Project README\n\nContents here..."
      }
    ]
  }
}
```

### Example: Database Query

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "postgres:query",
    "arguments": {
      "sql": "SELECT * FROM users LIMIT 10"
    }
  }
}
```

## Common Scenarios

### Scenario 1: Multiple Instances of Same Server

Run the same server with different configurations:

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

**Result**:
- `fs-home:read_file` reads from `/home/user`
- `fs-work:read_file` reads from `/work/projects`

### Scenario 2: Aggregate Different MCP Servers

Combine tools from multiple sources:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_TOKEN": "${SLACK_TOKEN}"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user"]
    }
  }
}
```

**Available Tools**:
- `github:create_issue`, `github:list_prs`, etc.
- `slack:send_message`, `slack:list_channels`, etc.
- `filesystem:read_file`, `filesystem:write_file`, etc.

### Scenario 3: Custom MCP Server

Use your own MCP server:

```json
{
  "mcpServers": {
    "my-custom-server": {
      "command": "node",
      "args": ["/path/to/my-server/dist/index.js"],
      "env": {
        "CONFIG_PATH": "/etc/my-server/config.yaml",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

**Requirement**: Your server must implement MCP protocol via stdio.

## Troubleshooting

### Issue: "Config file not found"

**Error**:
```
Error: Config file not found: /path/to/config.json
```

**Solution**:
- Verify file path is correct
- Use absolute path: `--config /Users/username/config.json`
- Check file permissions: `ls -l config.json`

### Issue: "Missing environment variable"

**Error**:
```
Error: Missing environment variable: API_KEY
Location: mcpServers.api-server.env.API_KEY
```

**Solution**:
```bash
# Set the variable before running
export API_KEY="your-key-here"
mcp-simple-aggregator --config config.json

# Or use a .env file
echo "API_KEY=your-key-here" > .env
source .env
mcp-simple-aggregator --config config.json
```

### Issue: "Failed to start server 'xyz'"

**Error**:
```
Error: Failed to start server 'postgres': spawn ENOENT
```

**Solution**:
- Verify command exists: `which node` or `which npx`
- Check command path is in `$PATH`
- Use absolute path: `"command": "/usr/local/bin/node"`
- Verify child server is installed: `npm list -g @modelcontextprotocol/server-filesystem`

### Issue: Child Server Crashes

**Symptom**: Some tools become unavailable after startup

**Logs**:
```
Warning: Server 'postgres' crashed: Connection refused
```

**Solution**:
- Check child server logs (stderr is forwarded)
- Verify child server dependencies (e.g., database is running)
- Test child server independently:
  ```bash
  node /path/to/postgres-server.js
  ```
- Fix underlying issue and restart aggregator

**Behavior**: Aggregator continues with remaining servers

### Issue: "Tool not found"

**Error**:
```json
{
  "error": {
    "code": -32601,
    "message": "Tool not found: filesytem:read_file"
  }
}
```

**Solution**:
- Check for typos: `filesytem` → `filesystem`
- Verify server key matches config: `"mcpServers": { "filesystem": { ... } }`
- List available tools: send `tools/list` request
- Ensure child server is running (check logs)

### Issue: "Tool name must be prefixed"

**Error**:
```json
{
  "error": {
    "code": -32602,
    "message": "Tool name must be prefixed with server key: read_file"
  }
}
```

**Solution**:
- Add server key prefix: `read_file` → `filesystem:read_file`
- Check `tools/list` for correct prefixed names

## Development

### Project Structure

```
mcp-simple-aggregator/
├── src/
│   ├── index.ts          # CLI entry point
│   ├── server.ts         # MCP Server implementation
│   ├── registry.ts       # Tool registry
│   ├── config.ts         # Config parsing
│   ├── child-manager.ts  # Child process management
│   └── types.ts          # TypeScript types
├── tests/
│   ├── unit/            # Unit tests
│   └── integration/     # Integration tests
├── specs/               # Design documents
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

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- config.test.ts

# Run in watch mode
npm test -- --watch
```

### Building

```bash
# Development build
npm run build

# Production build
npm run build:prod

# Watch mode
npm run dev
```

### Linting

```bash
# Run linter
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

## Example Configurations

### Minimal Example

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    }
  }
}
```

### Full Example

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/username/Documents"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}",
        "GITHUB_REPO": "owner/repo"
      }
    },
    "postgres": {
      "command": "node",
      "args": ["/opt/mcp-servers/postgres/index.js"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}",
        "PG_POOL_SIZE": "10",
        "LOG_LEVEL": "info"
      }
    },
    "custom-api": {
      "command": "/usr/local/bin/custom-mcp-server",
      "args": ["--config", "/etc/custom/config.yaml"],
      "env": {
        "API_KEY": "${CUSTOM_API_KEY}",
        "API_URL": "$CUSTOM_API_URL"
      }
    }
  }
}
```

## Performance

### Startup Time

- **Target**: 10+ servers in < 5 seconds
- **Measured**: Benchmark during testing
- **Bottleneck**: Child process spawning (parallel execution)

### Tool Discovery

- **Target**: < 1 second response
- **Implementation**: O(1) registry lookup
- **Caching**: Tools cached at startup

### Request Routing

- **Target**: < 50ms overhead
- **Implementation**: Direct forwarding to child
- **No transformation**: Arguments/responses unchanged

## Logging

### Log Levels

The aggregator uses minimal logging (errors and warnings only):

**Startup**:
```
[INFO] Starting mcp-simple-aggregator v1.0.0
[INFO] Loaded config from /path/to/config.json
[INFO] Starting child server 'filesystem'...
[INFO] Starting child server 'postgres'...
[INFO] All servers started successfully
[INFO] Aggregator ready (3 servers, 47 tools)
```

**Errors**:
```
[ERROR] Failed to start server 'postgres': spawn ENOENT
[ERROR] Server 'github' crashed: Error: ECONNREFUSED
```

**Warnings**:
```
[WARN] Server 'slack' tools removed due to crash
```

### Debug Mode

```bash
# Enable debug logging
mcp-simple-aggregator --config config.json --debug
```

**Output**:
```
[DEBUG] Parsing config file...
[DEBUG] Expanding environment variables...
[DEBUG] Spawning child: npx -y @modelcontextprotocol/server-filesystem /tmp
[DEBUG] Child 'filesystem' connected
[DEBUG] Fetching tools from 'filesystem'...
[DEBUG] Added 5 tools from 'filesystem'
[DEBUG] Registry built: 47 total tools
[DEBUG] Starting stdio server transport...
```

## Next Steps

1. **Configure your servers**: Create `config.json` with your MCP servers
2. **Set environment variables**: Export any required secrets/configs
3. **Run the aggregator**: `mcp-simple-aggregator --config config.json`
4. **Integrate with Claude Desktop**: Add aggregator to Claude's config
5. **Test tools**: Use `tools/list` and `tools/call` to verify functionality

## Resources

- **MCP Specification**: https://modelcontextprotocol.io
- **MCP TypeScript SDK**: https://github.com/modelcontextprotocol/typescript-sdk
- **Example MCP Servers**: https://github.com/modelcontextprotocol/servers
- **Claude Desktop Config**: https://docs.anthropic.com/claude/docs/mcp

## Support

- **Issues**: https://github.com/your-org/mcp-simple-aggregator/issues
- **Discussions**: https://github.com/your-org/mcp-simple-aggregator/discussions
- **Spec Documents**: See `/specs/001-mcp-aggregator/` directory

---

**Happy Aggregating! 🚀**

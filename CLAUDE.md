# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Workflow

This project uses [Spec-Kit](https://github.com/github/spec-kit) for agentic development workflow. All features are documented in `/specs/` directory with specifications, plans, and tasks.

**Key Spec-Kit Commands**:
- `/speckit.specify` - Create or update feature specification
- `/speckit.plan` - Generate implementation plan
- `/speckit.tasks` - Generate task breakdown
- `/speckit.implement` - Execute implementation
- `/speckit.analyze` - Cross-artifact consistency analysis

## Build, Test, and Lint

**Run tests**:
```bash
npm test                    # Run tests in watch mode
npm run test:coverage       # Run tests with coverage report
vitest run                  # Run tests once without watch
```

**Run specific test file**:
```bash
npm test -- config.test.ts
npm test -- --grep "pattern"
```

**Build**:
```bash
npm run build              # Build with tsup (outputs to dist/)
npm run dev                # Build in watch mode
```

**Lint**:
```bash
npm run lint               # TypeScript type checking (no emitting)
```

**Clean**:
```bash
npm run clean              # Remove dist/ and coverage/
```

## Architecture Overview

### Core Concepts

This is an **MCP (Model Context Protocol) server aggregator** that combines multiple child MCP servers into a single unified server. The aggregator:

1. **Spawns child MCP servers** via stdio transport based on configuration
2. **Discovers tools** from each child server
3. **Namespaces tools** with server key prefix (e.g., `sourcebot:search_code`)
4. **Routes tool calls** to the appropriate child server
5. **Handles failures gracefully** - if a child crashes, aggregator continues with remaining servers

### Key Modules

**`src/index.ts`** - CLI entry point
- Parses command-line arguments (`--config`, `--debug`, `--name`, `--version`)
- Orchestrates startup sequence

**`src/config.ts`** - Configuration management
- Reads and validates MCP config JSON (standard Claude Desktop format)
- Expands environment variables (`$VAR` and `${VAR}` syntax)
- Fails fast on missing environment variables

**`src/child-manager.ts`** - Child server lifecycle
- Spawns child MCP servers via `StdioClientTransport`
- Implements `resolveCommand()` - automatically resolves `node`, `npm`, `npx` to absolute paths to prevent "spawn ENOENT" errors
- Manages child server status (INITIALIZING, RUNNING, FAILED, STOPPED)
- Sets up error handlers for graceful degradation

**`src/registry.ts`** - Tool registry
- Maintains `Map<string, ToolRegistryEntry>` for O(1) lookup
- Prefixes tool names with server key: `serverKey:toolName`
- Supports adding/removing tools when servers start/crash

**`src/server.ts`** - MCP server implementation
- Creates aggregator MCP server using `@modelcontextprotocol/sdk`
- Implements `tools/list` handler - returns all tools from registry
- Implements `tools/call` handler - routes to child via `parseToolPrefix()`
- Exposes server via stdio transport

**`src/types.ts`** - TypeScript type definitions
- `McpConfig` - Standard Claude Desktop config format
- `ServerConfig` - Child server spawn configuration
- `ChildServerClient` - Wrapper for child connection + status
- `ToolRegistry` - Map from prefixed name to routing info
- Custom errors: `ConfigError`, `ChildServerError`

### Data Flow

1. **Startup**: CLI → Config Loading → Child Spawning → Tool Discovery → Registry Population
2. **Tool List**: Client request → `handleToolsList()` → Registry → Prefixed tools response
3. **Tool Call**: Client request → `parseToolPrefix()` → Registry lookup → Forward to child client → Return response

### Error Handling Philosophy

**Fail-fast during startup**:
- Missing config file → Exit with error
- Invalid JSON → Exit with error
- Missing environment variable → Exit with specific variable name
- Child server fails to start → Exit with server-specific error

**Graceful degradation at runtime**:
- Child server crashes → Remove its tools from registry, continue with remaining servers
- Tool call fails → Forward error to client, don't crash aggregator

### Command Resolution Feature

The aggregator automatically resolves `node`, `npm`, and `npx` commands to absolute paths:
- `"node"` → `process.execPath` (parent's Node.js)
- `"npm"` / `"npx"` → Same directory as Node.js (if exists), with Windows `.cmd` support
- Prevents "spawn ENOENT" errors in environments where PATH is not configured
- Logs resolved paths to file when `--debug` is enabled
- Absolute paths in config are never modified

### Debug Logging

**Feature 003**: File-based debug logging that prevents JSON-RPC stdio pollution

**Usage**:
```bash
# Enable debug logging with default log file (/tmp/mcp-aggregator-{pid}.log)
mcp-simple-aggregator --config config.json --debug

# Enable debug logging with custom log file
mcp-simple-aggregator --config config.json --debug --log-file /var/log/mcp.log
```

**Key Behaviors**:
- **Without `--debug`**: No logging occurs (completely silent, clean stdio for JSON-RPC)
- **With `--debug`**: Debug logs written to file only, stdio remains clean
- **Log format**: `{ISO timestamp} [LEVEL] {message}` (e.g., `2025-11-04T15:18:05.880Z [INFO] Child server initialized`)
- **Log levels**: `[DEBUG]`, `[INFO]`, `[ERROR]`
- **Fatal errors**: Pre-transport errors still use `console.error()` (acceptable exception)

**Why File-Based Logging**:
- MCP protocol uses stdio transport (stdout/stderr for JSON-RPC messages)
- Any non-JSON output on stdio breaks the protocol
- Claude Desktop would show errors like "Unexpected token 'I', "[INFO] Erro"... is not valid JSON"
- File-based logging keeps stdio clean while enabling troubleshooting

**Troubleshooting**:
```bash
# Watch debug logs in real-time
tail -f /tmp/mcp-aggregator-{pid}.log

# Check for errors in logs
grep ERROR /tmp/mcp-aggregator-*.log
```

## Test Organization

Tests are located in `tests/` directory:
- `tests/unit/` - Unit tests for individual modules
- `tests/integration/` - Integration tests for end-to-end flows

Test framework: **Vitest** with coverage via `@vitest/coverage-v8`

## Configuration Format

The aggregator uses standard Claude Desktop MCP config format:

```json
{
  "mcpServers": {
    "server-key": {
      "command": "node",
      "args": ["server.js"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

- `server-key` becomes the tool prefix
- Environment variables support `$VAR` and `${VAR}` syntax
- Only stdio transport is supported
- No additional aggregator-specific config needed

## Release Process

**IMPORTANT**: npm publishing is restricted to GitHub Actions only. Manual `npm publish` will fail.

Releases are automated via GitHub Actions:
1. Update `CHANGELOG.md` - move content from `[Unreleased]` to new version section
2. Bump version: `npm version patch|minor`
3. Push with tags: `git push && git push --tags`
4. GitHub Action automatically publishes to npm and creates GitHub release with CHANGELOG notes

The CI check in `prepublishOnly` prevents accidental manual publishes.

## Active Technologies
- TypeScript 5.3+ (Node.js 18+) + @modelcontextprotocol/sdk (stdio transport), tsup (build), vitest (testing) (003-fix-stdio-logging)
- File-based debug logs (when --debug enabled) (003-fix-stdio-logging)

## Recent Changes
- 003-fix-stdio-logging: Added TypeScript 5.3+ (Node.js 18+) + @modelcontextprotocol/sdk (stdio transport), tsup (build), vitest (testing)

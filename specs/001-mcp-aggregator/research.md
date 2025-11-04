# Research Findings: MCP Server Aggregator

**Date**: 2025-11-03
**Feature**: MCP Server Aggregator
**Phase**: Phase 0 - Research & Technical Decisions

## Overview

This document captures all technical decisions, research findings, and architectural choices made during the design phase of the MCP Server Aggregator project.

## Technical Stack Decisions

### Decision 1: Language & Runtime

**Decision**: TypeScript 5.7+ with Node.js v18+

**Rationale**:
- MCP SDK officially supports TypeScript (@modelcontextprotocol/sdk)
- Type safety aligns with Constitution Principle I (Code Quality First)
- Node.js provides robust `child_process` support for spawning stdio-based child servers
- Node.js v18+ is LTS with excellent async I/O performance
- Cross-platform support (macOS/Linux/Windows)

**Alternatives Considered**:
- **Python**: MCP SDK available, but weaker type system and slower startup times
- **Go**: Excellent performance, but MCP SDK less mature and TypeScript is the reference implementation
- **Rust**: Best performance, steep learning curve, overkill for I/O-bound proxy

**Implementation Notes**:
- Use `strict` mode in tsconfig.json for maximum type safety
- Target ES2022 for modern async/await features
- Use ES modules (not CommonJS) for better tree-shaking

### Decision 2: MCP SDK Selection

**Decision**: @modelcontextprotocol/sdk (official TypeScript SDK)

**Rationale**:
- Official reference implementation
- Includes `Server` class for implementing MCP servers
- Includes `Client` class for connecting to child MCP servers
- Provides `StdioClientTransport` for stdio-based communication
- Handles all protocol details (request/response IDs, error codes, schemas)
- Built-in Zod for schema validation
- Active maintenance by Anthropic/community

**Alternatives Considered**:
- **Custom protocol implementation**: Reinventing the wheel, error-prone, violates YAGNI
- **Third-party wrappers**: None found with better features than official SDK

**Implementation Notes**:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
```

### Decision 3: Testing Framework

**Decision**: Vitest 2.1+

**Rationale**:
- Modern, TypeScript-first testing framework
- Zero-config setup with excellent defaults
- Faster than Jest (uses esbuild/vite under the hood)
- Native ESM support (matches our module system)
- Excellent async/await support for testing child processes
- Built-in mocking capabilities for child_process

**Alternatives Considered**:
- **Jest**: Industry standard but slower, requires more configuration for TypeScript/ESM
- **Node test runner**: Built-in but less mature, fewer features
- **Mocha + Chai**: Too much boilerplate, less integrated experience

**Implementation Notes**:
- Use `vitest.config.ts` for test configuration
- Coverage target: 80% minimum (constitution requirement)
- Separate unit tests (fast, isolated) from integration tests (spawn real processes)

### Decision 4: Build Tooling

**Decision**: tsup (TypeScript bundler using esbuild)

**Rationale**:
- Zero-config TypeScript bundler
- Extremely fast (uses esbuild)
- Supports both ESM and CJS output
- Ideal for CLI tools (can create standalone executables)
- No need for complex webpack/rollup configuration

**Alternatives Considered**:
- **tsc only**: Slower, no bundling, requires separate runtime
- **webpack**: Overkill for CLI tool, complex configuration
- **esbuild directly**: tsup provides better defaults and CLI tool patterns

**Implementation Notes**:
```typescript
// tsup.config.ts
export default {
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  shims: true
};
```

## Architecture Decisions

### Decision 5: Child Process Management

**Decision**: Use Node.js `child_process.spawn()` with `StdioClientTransport` from MCP SDK

**Rationale**:
- `spawn()` is designed for long-running child processes
- Each child gets isolated stdin/stdout/stderr streams
- MCP SDK's `StdioClientTransport` handles protocol over stdio pipes
- Node.js provides async event-driven I/O for managing multiple processes
- Clean lifecycle management with exit event handlers

**Alternatives Considered**:
- **Manual stdio multiplexing**: Too complex, SDK already provides this
- **exec() or execFile()**: Designed for short-lived commands, not suitable for servers
- **Worker threads**: Wrong model - need separate process spaces, not shared memory
- **SSE/HTTP transports**: Not allowed per requirements (stdio only)

**Implementation Notes**:
```typescript
const client = new Client({
  name: 'mcp-aggregator-client',
  version: '1.0.0'
}, { capabilities: {} });

await client.connect(
  new StdioClientTransport({
    command: serverConfig.command,
    args: serverConfig.args,
    env: { ...process.env, ...expandedEnvVars }
  })
);

// Handle child crashes
client.on('error', (error) => {
  console.error(`Child server crashed: ${error.message}`);
  removeServerFromRegistry(serverKey);
});
```

### Decision 6: Tool Registry Architecture

**Decision**: In-memory Map with prefixed keys (`configKey:toolName` → metadata)

**Rationale**:
- O(1) lookup time for routing tool calls
- Simple data structure, no external dependencies
- Built once at startup after all children initialize
- Automatically handles name collisions (different prefixes)
- Easy to update when child servers crash

**Alternatives Considered**:
- **Nested objects** `{ serverKey: { tools: {...} } }`: Slower lookup, extra indirection
- **Database/file storage**: Overkill, adds latency, violates simplicity principle
- **No registry (query children on demand)**: Too slow for every tool call, violates performance goals

**Implementation Notes**:
```typescript
interface ToolRegistryEntry {
  client: Client;              // MCP client connection to child
  serverKey: string;           // Config key for this server
  originalName: string;        // Original tool name (without prefix)
  schema: ToolSchema;          // Tool schema from child
}

type ToolRegistry = Map<string, ToolRegistryEntry>;

// Build registry
const registry: ToolRegistry = new Map();
for (const [serverKey, client] of childClients) {
  const { tools } = await client.listTools();
  for (const tool of tools) {
    const prefixedName = `${serverKey}:${tool.name}`;
    registry.set(prefixedName, {
      client,
      serverKey,
      originalName: tool.name,
      schema: tool
    });
  }
}
```

### Decision 7: Request Routing Strategy

**Decision**: Parse prefix, lookup in registry, forward to child with original name

**Rationale**:
- Clear separation of concerns (prefix is for aggregator, original name for child)
- Transparent proxy pattern - arguments forwarded unchanged
- Error responses forwarded unchanged to preserve child semantics
- Single `:` separator (tools can't contain `:` per MCP conventions)

**Alternatives Considered**:
- **Hash-based routing**: No benefit, prefix is explicit and more debuggable
- **Round-robin/load balancing**: Wrong model - specific tool must go to specific server
- **Broadcast to all servers**: Defeats purpose of prefixing, wasteful

**Implementation Notes**:
```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name: prefixedName, arguments: args } = request.params;

  // Parse prefix
  const colonIndex = prefixedName.indexOf(':');
  if (colonIndex === -1) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Tool name must be prefixed: ${prefixedName}`
    );
  }

  // Lookup
  const entry = registry.get(prefixedName);
  if (!entry) {
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Tool not found: ${prefixedName}`
    );
  }

  // Route to child
  return await entry.client.callTool({
    name: entry.originalName,  // Remove prefix
    arguments: args             // Forward unchanged
  });
});
```

### Decision 8: Configuration Format & Parsing

**Decision**: Use standard Claude Desktop MCP config format, no extensions

**Rationale**:
- Requirement FR-013: "MUST NOT require any configuration beyond standard MCP config format"
- Users already familiar with format from Claude Desktop
- No learning curve for configuration
- Direct compatibility with existing configs

**Claude Desktop Config Format**:
```json
{
  "mcpServers": {
    "server-key": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

**Alternatives Considered**:
- **Custom YAML format**: Better readability, but violates requirement for standard format
- **TOML format**: Popular for configs, but not Claude Desktop standard
- **Extended JSON with aggregator-specific fields**: Violates FR-013

**Implementation Notes**:
```typescript
interface McpConfig {
  mcpServers: {
    [serverKey: string]: {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    };
  };
}

// Parse and validate
const configText = await fs.readFile(configPath, 'utf-8');
const config: McpConfig = JSON.parse(configText);

// Validate structure
if (!config.mcpServers || typeof config.mcpServers !== 'object') {
  throw new Error('Invalid config: missing mcpServers');
}
```

### Decision 9: Environment Variable Expansion

**Decision**: Regex-based expansion supporting both `$VAR` and `${VAR}` syntax

**Rationale**:
- Requirement FR-002: Support both syntaxes
- Simple implementation, no external dependencies
- Fail-fast on missing variables (requirement FR-002)
- Recursive expansion for all string values in config

**Alternatives Considered**:
- **dotenv library**: Only handles .env files, not JSON variable expansion
- **Shell expansion (child_process.exec)**: Security risk, platform-dependent
- **envsubst**: External dependency, platform-specific availability

**Implementation Notes**:
```typescript
function expandEnvVar(value: string): string {
  return value.replace(
    /\$\{([^}]+)\}|\$([A-Z_][A-Z0-9_]*)/g,
    (match, curly, plain) => {
      const varName = curly || plain;
      const envValue = process.env[varName];
      if (envValue === undefined) {
        throw new Error(
          `Missing environment variable: ${varName} (in: ${value})`
        );
      }
      return envValue;
    }
  );
}

function expandConfigEnvVars(obj: unknown): unknown {
  if (typeof obj === 'string') return expandEnvVar(obj);
  if (Array.isArray(obj)) return obj.map(expandConfigEnvVars);
  if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, expandConfigEnvVars(v)])
    );
  }
  return obj;
}
```

### Decision 10: Error Handling Strategy

**Decision**:
- **Startup**: Fail fast on any error (config, env vars, child initialization)
- **Runtime**: Continue with remaining servers on child crash

**Rationale**:
- Startup errors are developer mistakes (bad config) - must be fixed
- Runtime crashes are operational issues - maintain availability per FR-009
- Clear error messages aid debugging per Constitution Principle III
- Aligns with "continue operating with remaining servers" requirement

**Alternatives Considered**:
- **Retry child startup**: Adds complexity, likely to fail again with same config
- **Auto-restart crashed children**: Not in requirements, could mask underlying issues
- **Fail aggregator on child crash**: Reduces availability, violates FR-009

**Implementation Notes**:
```typescript
// Startup: fail fast
async function initializeChildren(config: McpConfig) {
  const clients = new Map<string, Client>();

  for (const [serverKey, serverConfig] of Object.entries(config.mcpServers)) {
    try {
      const client = await connectToChild(serverKey, serverConfig);
      await client.listTools(); // Verify server responds
      clients.set(serverKey, client);
    } catch (error) {
      console.error(`Failed to start '${serverKey}': ${error.message}`);
      process.exit(1); // Fail startup
    }
  }

  return clients;
}

// Runtime: graceful degradation
client.on('error', (error) => {
  console.error(`Server '${serverKey}' crashed: ${error.message}`);
  removeServerTools(serverKey); // Remove from registry
  // Continue serving other servers
});
```

## Performance Considerations

### Tool Discovery Optimization

**Goal**: SC-002 requires < 1 second for tool discovery

**Approach**:
- Build registry once at startup (not on every list request)
- Return cached prefixed tools from registry
- Update registry only when children emit change notifications

**Measurement**: Benchmark `server.setRequestHandler(ListToolsRequestSchema)` with 10+ servers

### Request Routing Overhead

**Goal**: SC-003 requires < 50ms overhead

**Approach**:
- O(1) Map lookup by prefixed name
- No transformation of arguments or responses
- Direct async forwarding to child client

**Measurement**: Benchmark difference between direct child call and aggregated call

### Startup Performance

**Goal**: SC-001 requires 10+ servers to start within 5 seconds

**Approach**:
- Parallel child spawning (don't wait for each to complete)
- Early failure detection with timeouts
- Minimal validation overhead

**Measurement**: Benchmark `initializeChildren()` with 10 mock servers

## Security Considerations

### Environment Variable Injection

**Risk**: Malicious config could inject code via environment variables

**Mitigation**:
- No shell expansion (no `eval` or `exec`)
- Direct string replacement only
- Variables passed through SDK's transport layer (sanitized)

### Child Process Isolation

**Risk**: Child processes could interfere with each other

**Mitigation**:
- Each child runs in separate process space
- Separate stdio streams per child
- No shared memory or IPC beyond stdio

### Configuration Validation

**Risk**: Invalid config could cause unexpected behavior

**Mitigation**:
- JSON schema validation before any child spawning
- Type checking with TypeScript
- Fail-fast on missing required fields

## Dependencies Analysis

### Production Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^0.6.0"
}
```

**Justification**: Only dependency needed. SDK includes Zod for validation.

### Development Dependencies

```json
{
  "typescript": "^5.7.0",
  "tsup": "^8.3.0",
  "vitest": "^2.1.0",
  "@types/node": "^22.0.0"
}
```

**Justification**:
- TypeScript for type safety
- tsup for building
- Vitest for testing
- Node types for TypeScript completion

## Key Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Child server hangs during startup | Aggregator fails to start | Medium | 5-second timeout per child |
| Child crashes during tool call | Tool call fails | Medium | Return error to client, mark unavailable |
| Large tool responses | Memory pressure | Low | Node.js streams handle buffering |
| Environment variable typo | Startup failure | High | Validation with clear error messages |
| Tool name with `:` separator | Routing error | Low | Document constraint, validate if needed |

## Next Steps

This research provides the foundation for Phase 1 design:

1. **data-model.md**: Define TypeScript interfaces for all entities
2. **contracts/**: Document MCP protocol message formats
3. **quickstart.md**: Developer onboarding guide

All architectural decisions are made and justified. Implementation can proceed with confidence.

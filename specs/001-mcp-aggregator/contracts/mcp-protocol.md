# MCP Protocol Specification for Aggregator

**Date**: 2025-11-03
**Version**: Based on MCP SDK v0.6.0

## Overview

This document defines the Model Context Protocol messages used by the MCP Server Aggregator. The aggregator implements both **Server** (to clients like Claude Desktop) and **Client** (to child MCP servers) roles.

## Protocol Roles

### Aggregator as Server (Exposed to Claude Desktop)

The aggregator exposes a standard MCP server interface via stdio:

```
Claude Desktop ←[stdio]→ MCP Aggregator (Server)
```

**Capabilities**:
```json
{
  "capabilities": {
    "tools": {}
  }
}
```

**Supported Requests**:
- `initialize` - Standard MCP initialization handshake
- `tools/list` - List all aggregated tools from all child servers
- `tools/call` - Invoke a specific tool on a child server

### Aggregator as Client (Connected to Child Servers)

The aggregator connects to each child server as an MCP client via stdio:

```
MCP Aggregator (Client) ←[stdio]→ Child Server 1
MCP Aggregator (Client) ←[stdio]→ Child Server 2
MCP Aggregator (Client) ←[stdio]→ Child Server N
```

**Operations**:
- Connect to child via `StdioClientTransport`
- Call `listTools()` to discover child's tools
- Call `callTool()` to route client requests to child

## Message Schemas

### 1. Initialize Request/Response

**Not modified by aggregator** - Standard MCP handshake.

**Client → Aggregator**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "sampling": {}
    },
    "clientInfo": {
      "name": "claude-desktop",
      "version": "1.0.0"
    }
  }
}
```

**Aggregator → Client**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {}
    },
    "serverInfo": {
      "name": "mcp-simple-aggregator",
      "version": "1.0.0"
    }
  }
}
```

### 2. List Tools Request/Response

**Modified by aggregator** - Tools from all children are aggregated with prefixes.

**Client → Aggregator**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**Aggregator Implementation**:
```typescript
// Aggregator collects tools from all children and prefixes them
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = Array.from(registry.values()).map(entry => ({
    name: `${entry.serverKey}:${entry.originalName}`,
    description: entry.schema.description,
    inputSchema: entry.schema.inputSchema
  }));

  return { tools };
});
```

**Aggregator → Client**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
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

### 3. Call Tool Request/Response

**Routed by aggregator** - Request is parsed, routed to appropriate child, response forwarded unchanged.

**Client → Aggregator**:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "filesystem:read_file",
    "arguments": {
      "path": "/home/user/document.txt"
    }
  }
}
```

**Aggregator Routing Logic**:
```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Parse prefix
  const [serverKey, ...toolNameParts] = name.split(':');
  const toolName = toolNameParts.join(':'); // Handle edge case of : in name

  // Lookup in registry
  const entry = registry.get(name);
  if (!entry) {
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Tool not found: ${name}`
    );
  }

  // Route to child with ORIGINAL name (without prefix)
  return await entry.client.callTool({
    name: entry.originalName,  // "read_file" NOT "filesystem:read_file"
    arguments: args             // Forward unchanged
  });
});
```

**Aggregator → Child Server**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "read_file",
    "arguments": {
      "path": "/home/user/document.txt"
    }
  }
}
```

**Child Server → Aggregator**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "File contents here..."
      }
    ]
  }
}
```

**Aggregator → Client** (forwarded unchanged):
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "File contents here..."
      }
    ]
  }
}
```

### 4. Error Responses

**Aggregator-Specific Errors**:

**Tool Not Found** (invalid prefix or tool doesn't exist):
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32601,
    "message": "Tool not found: invalid:tool_name"
  }
}
```

**Missing Prefix** (tool name doesn't contain `:`):
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32602,
    "message": "Tool name must be prefixed with server key: tool_name"
  }
}
```

**Child Server Errors** (forwarded unchanged):
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32603,
    "message": "File not found: /invalid/path.txt",
    "data": {
      "errno": -2,
      "code": "ENOENT"
    }
  }
}
```

## Tool Naming Convention

### Prefix Format

All tools exposed by the aggregator use the format:

```
{serverKey}:{originalToolName}
```

Where:
- `serverKey` - The key from `mcpServers` in the config JSON
- `:` - Literal colon separator (tools cannot contain this character)
- `originalToolName` - The tool's original name from the child server

### Examples

**Config**:
```json
{
  "mcpServers": {
    "fs": { "command": "filesystem-server" },
    "db": { "command": "postgres-server" }
  }
}
```

**Child Server Tools**:
- `fs` server exposes: `read_file`, `write_file`, `list_directory`
- `db` server exposes: `query`, `execute`

**Aggregated Tools**:
- `fs:read_file`
- `fs:write_file`
- `fs:list_directory`
- `db:query`
- `db:execute`

### Edge Cases

**Same server configured twice** (allowed):
```json
{
  "mcpServers": {
    "fs-home": { "command": "fs-server", "args": ["/home"] },
    "fs-work": { "command": "fs-server", "args": ["/work"] }
  }
}
```

Tools become:
- `fs-home:read_file`
- `fs-work:read_file`

**Server key contains special characters** (preserved):
```json
{
  "mcpServers": {
    "my-server_v2": { "command": "..." }
  }
}
```

Tools: `my-server_v2:tool_name`

## Transport Layer

### Stdio Transport

All communication uses JSON-RPC 2.0 over stdio:

**Aggregator ← Client** (stdin of aggregator):
```
{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n
```

**Aggregator → Client** (stdout of aggregator):
```
{"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}\n
```

**Aggregator → Child** (stdin of child process):
```
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{...}}\n
```

**Child → Aggregator** (stdout of child process):
```
{"jsonrpc":"2.0","id":1,"result":{...}}\n
```

**Key Points**:
- Each message is a single line terminated by `\n`
- Messages are valid JSON objects
- Binary data is base64-encoded in `content` arrays
- MCP SDK handles all serialization/deserialization

## Protocol Compliance

### MCP Specification Compliance

The aggregator is fully compliant with the MCP specification:

✅ **JSON-RPC 2.0** - All messages follow JSON-RPC format
✅ **Initialize handshake** - Proper capability negotiation
✅ **Tool schemas** - All tools have valid JSON Schema input schemas
✅ **Error codes** - Uses standard JSON-RPC error codes
✅ **Content types** - Supports text and base64-encoded content

### Aggregator-Specific Extensions

❌ **No custom methods** - Only standard MCP methods supported
❌ **No custom capabilities** - Only `tools` capability exposed
❌ **No protocol extensions** - Strict adherence to MCP spec

### Limitations

- **Resources**: Not supported in v1 (could be added in future)
- **Prompts**: Not supported in v1 (could be added in future)
- **Sampling**: Not supported (aggregator doesn't need to sample)
- **Notifications**: Tool list changes not yet broadcast to client

## Request Flow Diagrams

### Successful Tool Call

```
Claude Desktop          Aggregator              Child Server
     |                       |                         |
     |-- tools/call -------->|                         |
     |   "fs:read_file"      |                         |
     |                       |-- tools/call ---------> |
     |                       |   "read_file"           |
     |                       |                         |
     |                       |<-- result ------------- |
     |                       |   {content: [...]}      |
     |<-- result ------------|                         |
     |   {content: [...]}    |                         |
```

### Tool Not Found

```
Claude Desktop          Aggregator              Child Server
     |                       |                         |
     |-- tools/call -------->|                         |
     |   "invalid:tool"      |                         |
     |                       |                         |
     |                       | [Lookup in registry]    |
     |                       | [Not found]             |
     |                       |                         |
     |<-- error -------------|                         |
     |   "Tool not found"    |                         |
```

### Child Server Error

```
Claude Desktop          Aggregator              Child Server
     |                       |                         |
     |-- tools/call -------->|                         |
     |   "fs:read_file"      |                         |
     |                       |-- tools/call ---------> |
     |                       |   "read_file"           |
     |                       |                         |
     |                       |<-- error -------------- |
     |                       |   "File not found"      |
     |<-- error -------------|                         |
     |   "File not found"    |  [Forwarded unchanged]  |
```

## Implementation Notes

### SDK Usage

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Create aggregator server
const server = new Server({
  name: 'mcp-simple-aggregator',
  version: '1.0.0'
}, {
  capabilities: { tools: {} }
});

// Connect to child server
const childClient = new Client({
  name: 'aggregator-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await childClient.connect(
  new StdioClientTransport({
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/path']
  })
);

// Start aggregator server
await server.connect(new StdioServerTransport());
```

### Error Handling

```typescript
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Tool not found
throw new McpError(
  ErrorCode.MethodNotFound,
  `Tool not found: ${prefixedName}`
);

// Invalid request
throw new McpError(
  ErrorCode.InvalidRequest,
  `Tool name must be prefixed: ${name}`
);

// Forward child errors unchanged
try {
  return await childClient.callTool(params);
} catch (error) {
  throw error; // Re-throw as-is
}
```

This protocol specification ensures the aggregator is a transparent, compliant MCP proxy.

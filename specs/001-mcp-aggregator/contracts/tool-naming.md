# Tool Naming Convention

**Date**: 2025-11-03
**Version**: 1.0.0

## Overview

This document defines the tool naming convention used by the MCP Server Aggregator to namespace tools from multiple child MCP servers.

## Naming Format

All tools exposed by the aggregator follow this format:

```
{serverKey}:{originalToolName}
```

### Components

#### Server Key

- **Source**: The key from `mcpServers` object in the configuration JSON
- **Purpose**: Identifies which child server provides the tool
- **Constraints**:
  - Must be non-empty string
  - Recommended: alphanumeric characters, hyphens, underscores
  - Cannot contain `:` (colon) character
- **Case Sensitivity**: Preserved as-is from config

**Example Config**:
```json
{
  "mcpServers": {
    "filesystem": { ... },
    "my-db-server": { ... },
    "tool_v2": { ... }
  }
}
```

Server keys: `filesystem`, `my-db-server`, `tool_v2`

#### Separator

- **Character**: `:` (colon, ASCII 58)
- **Purpose**: Delimiter between server key and tool name
- **Rules**:
  - Exactly one colon separator
  - Cannot appear in server keys or original tool names
  - Used for parsing during request routing

#### Original Tool Name

- **Source**: Tool name from child server's `tools/list` response
- **Purpose**: Identifies the specific tool on the child server
- **Constraints**:
  - Must match the tool name exposed by child server
  - Cannot contain `:` character (MCP convention)
  - Case sensitive
- **Routing**: When routing to child, prefix is removed and only original name is sent

**Example**: Child server exposes `read_file` → Aggregated as `filesystem:read_file` → Routed to child as `read_file`

## Examples

### Basic Example

**Child Server**: Filesystem server
**Original Tools**: `read_file`, `write_file`, `list_directory`
**Server Key**: `fs`

**Aggregated Tools**:
- `fs:read_file`
- `fs:write_file`
- `fs:list_directory`

### Multiple Servers

**Config**:
```json
{
  "mcpServers": {
    "github": { "command": "github-server" },
    "gitlab": { "command": "gitlab-server" }
  }
}
```

**Child Tools**:
- `github` server: `create_issue`, `list_prs`, `merge_pr`
- `gitlab` server: `create_issue`, `list_mrs`, `merge_mr`

**Aggregated Tools** (no conflicts):
- `github:create_issue`
- `github:list_prs`
- `github:merge_pr`
- `gitlab:create_issue`
- `gitlab:list_mrs`
- `gitlab:merge_mr`

**Note**: Both servers have `create_issue`, but prefixes prevent conflicts.

### Same Server, Multiple Instances

**Config**:
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

**Result**: Same filesystem server, different configurations

**Aggregated Tools**:
- `fs-home:read_file` (operates on /home/user)
- `fs-home:write_file`
- `fs-work:read_file` (operates on /work/projects)
- `fs-work:write_file`

**Usage**:
```typescript
// Read from home directory
await callTool("fs-home:read_file", { path: "documents/note.txt" });
// → Reads /home/user/documents/note.txt

// Read from work directory
await callTool("fs-work:read_file", { path: "project/README.md" });
// → Reads /work/projects/project/README.md
```

## Parsing Rules

### Request Routing

When a client calls a prefixed tool, the aggregator:

1. **Split on first `:`**
   ```typescript
   const [serverKey, ...rest] = toolName.split(':');
   const originalName = rest.join(':'); // Handle edge case
   ```

2. **Validate format**
   ```typescript
   if (!toolName.includes(':')) {
     throw new Error('Tool name must include server prefix');
   }
   ```

3. **Lookup in registry**
   ```typescript
   const entry = registry.get(toolName); // Full prefixed name
   if (!entry) {
     throw new Error(`Tool not found: ${toolName}`);
   }
   ```

4. **Route with original name**
   ```typescript
   await entry.client.callTool({
     name: entry.originalName, // Without prefix
     arguments: args
   });
   ```

### Edge Cases

#### Multiple Colons

**Scenario**: Tool name contains additional colons (unlikely but possible)

**Input**: `server:tool:subcommand`

**Parsing**:
```typescript
// Split on FIRST colon only
const colonIndex = name.indexOf(':');
const serverKey = name.substring(0, colonIndex);       // "server"
const originalName = name.substring(colonIndex + 1);   // "tool:subcommand"
```

**Registry Lookup**: Still uses full name `server:tool:subcommand`

#### No Colon

**Input**: `read_file` (missing prefix)

**Error**:
```json
{
  "error": {
    "code": -32602,
    "message": "Tool name must be prefixed with server key: read_file"
  }
}
```

#### Empty Server Key

**Input**: `:read_file`

**Error**:
```json
{
  "error": {
    "code": -32602,
    "message": "Invalid tool name format: :read_file"
  }
}
```

#### Empty Tool Name

**Input**: `server:`

**Error**:
```json
{
  "error": {
    "code": -32602,
    "message": "Invalid tool name format: server:"
  }
}
```

## Tool Registry Implementation

### Registry Structure

```typescript
type ToolRegistry = Map<string, ToolRegistryEntry>;

interface ToolRegistryEntry {
  client: Client;          // Child server client
  serverKey: string;       // Prefix (e.g., "filesystem")
  originalName: string;    // Original name (e.g., "read_file")
  schema: ToolSchema;      // Tool schema with PREFIXED name
}
```

### Building the Registry

```typescript
async function buildRegistry(
  children: Map<string, Client>
): Promise<ToolRegistry> {
  const registry: ToolRegistry = new Map();

  for (const [serverKey, client] of children) {
    // Get tools from child
    const { tools } = await client.listTools();

    // Add each tool with prefix
    for (const tool of tools) {
      const prefixedName = `${serverKey}:${tool.name}`;

      registry.set(prefixedName, {
        client,
        serverKey,
        originalName: tool.name,
        schema: {
          ...tool,
          name: prefixedName  // Update schema with prefixed name
        }
      });
    }
  }

  return registry;
}
```

### Registry Updates

**When child server crashes**:
```typescript
function removeServerFromRegistry(
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
```

**When child server emits tool list changes** (future enhancement):
```typescript
client.on('tools/list_changed', async () => {
  // Remove old tools
  removeServerFromRegistry(registry, serverKey);

  // Re-fetch and add new tools
  const { tools } = await client.listTools();
  for (const tool of tools) {
    const prefixedName = `${serverKey}:${tool.name}`;
    registry.set(prefixedName, { ... });
  }
});
```

## User Experience

### Discovery

**Client Request**:
```json
{ "method": "tools/list" }
```

**Aggregator Response**:
```json
{
  "tools": [
    {
      "name": "filesystem:read_file",
      "description": "Read contents of a file",
      "inputSchema": { ... }
    },
    {
      "name": "postgres:query",
      "description": "Execute SQL query",
      "inputSchema": { ... }
    }
  ]
}
```

**User sees**: Tools clearly namespaced by server

### Invocation

**User Intent**: "Read file using filesystem server"

**Tool Call**:
```json
{
  "method": "tools/call",
  "params": {
    "name": "filesystem:read_file",
    "arguments": { "path": "/home/user/doc.txt" }
  }
}
```

**Clear Mapping**: User knows exactly which server will handle the request

### Error Messages

**Tool Not Found**:
```
Tool not found: filesytem:read_file
```
(Note the typo in "filesytem")

**Suggestion**: Error could suggest similar tools:
```
Tool not found: filesytem:read_file
Did you mean: filesystem:read_file?
```

## Benefits of This Convention

### 1. Namespace Isolation

✅ Multiple servers can have identically named tools without conflicts

**Example**: Both `github:create_issue` and `jira:create_issue` can coexist

### 2. Explicit Routing

✅ Tool name directly identifies target server - no ambiguity

**Example**: `db-prod:query` vs `db-staging:query` clearly distinguishes environments

### 3. Discovery Transparency

✅ Users see which server provides each tool

**Example**: `tools/list` response clearly shows tool origins

### 4. Simple Implementation

✅ Single character separator, easy to parse

**Example**: `split(':')` is trivial to implement and understand

### 5. Human Readable

✅ Format is intuitive and self-documenting

**Example**: `weather:get_forecast` is immediately understandable

## Constraints and Limitations

### 1. Colon Restriction

❌ Server keys and tool names cannot contain `:`

**Workaround**: Use hyphens or underscores instead
- ✅ `my-server:my_tool`
- ❌ `my:server:my:tool`

### 2. Server Key Visibility

⚠️ Server keys are exposed to clients

**Implication**: Choose meaningful, user-friendly keys
- ✅ `github`, `filesystem`, `db-prod`
- ❌ `server1`, `x`, `asdf`

### 3. No Automatic Aliasing

❌ Cannot alias `filesystem:read_file` as just `read_file`

**Rationale**: Would defeat namespace isolation purpose
**Alternative**: Client can implement shortcuts if desired

### 4. Config Key Changes Break Clients

⚠️ Renaming server key in config changes all tool names

**Example**: Renaming `fs` → `filesystem` breaks existing scripts using `fs:*`

**Mitigation**: Treat server keys as part of public API, version carefully

## Future Considerations

### Tool Aliasing (Not Implemented)

**Potential Feature**: Allow short aliases in config

```json
{
  "mcpServers": {
    "filesystem": { ... }
  },
  "aliases": {
    "rf": "filesystem:read_file",
    "wf": "filesystem:write_file"
  }
}
```

**Status**: Violates requirement FR-013 (no config extensions), deferred

### Hierarchical Namespaces (Not Implemented)

**Potential Feature**: Multi-level prefixes

```
category:server:tool
```

**Status**: Adds complexity, not needed for v1, deferred

## Compliance

This naming convention is:

✅ Compatible with MCP protocol (tools are strings)
✅ Compatible with Claude Desktop (displays prefixed names)
✅ Compatible with JSON (no special escaping needed)
✅ Reversible (can extract server key and original name)
✅ Deterministic (same config always produces same names)

---

**Version History**:
- 1.0.0 (2025-11-03): Initial specification

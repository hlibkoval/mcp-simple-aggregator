# Data Model: Node Executable Resolution

**Date**: 2025-11-04
**Phase**: 1 (Design & Contracts)
**Feature**: 002-node-executable-resolution

## Overview

This feature involves minimal data modeling as it's a pure transformation function that operates on existing configuration types. No new data structures are introduced.

## Entities

### ServerConfig (Existing Type)

**Description**: Configuration for a single child MCP server (already defined in `src/types.ts`)

**Structure**:
```typescript
interface ServerConfig {
  command: string;              // Executable to spawn (e.g., "node", "npm", "python")
  args?: string[];              // Command-line arguments
  env?: Record<string, string>; // Environment variables
}
```

**Relevance to This Feature**:
- `command` field is the input to command resolution
- Existing type, no modifications needed

### ResolvedCommand (Conceptual Type)

**Description**: The absolute path to the executable that will actually be spawned after command resolution

**Type**: `string` (not a separate interface, just a transformed value)

**Relationship to ServerConfig**:
- Input: `ServerConfig.command` (original command from config)
- Output: `resolvedCommand` (absolute path or original command)
- Transform: `resolvedCommand = resolveCommand(config.command)`

**Examples**:

| Original command | Resolved command | Notes |
|-----------------|------------------|-------|
| `"node"` | `"/usr/local/bin/node"` | Always resolved to process.execPath |
| `"npm"` | `"/usr/local/bin/npm"` | If exists in same directory as node |
| `"npm"` | `"npm"` | Fallback if not found (uses PATH) |
| `"/usr/bin/python3"` | `"/usr/bin/python3"` | Absolute paths unchanged |
| `"python"` | `"python"` | Non-node commands unchanged |

## Data Flow

```
ServerConfig (from JSON config)
    |
    | config.command
    v
resolveCommand(command: string)
    |
    | decision logic:
    | - "node" → process.execPath
    | - "npm"/"npx" → check dirname(process.execPath)
    | - absolute path → unchanged
    | - other → unchanged
    v
resolvedCommand: string
    |
    | used in StdioClientTransport
    v
Child process spawn (Node.js spawn API)
```

## State Transitions

**N/A** - This is a stateless, pure function transformation. No state machine or lifecycle.

## Validation Rules

### Input Validation

| Rule | Validation | Error Handling |
|------|-----------|----------------|
| Command must be non-empty string | `command.length > 0` | Existing validation in config.ts handles this |
| Command must not contain null bytes | `!command.includes('\0')` | Not enforced (Node.js spawn will reject) |

### Resolution Validation

| Rule | Validation | Fallback |
|------|-----------|----------|
| npm/npx must exist if resolving | `fs.existsSync(resolvedPath)` | Fallback to original command |
| Resolved path must be absolute | `path.isAbsolute(resolvedPath)` | For "node", always absolute; for npm/npx, fallback if not |

**No errors thrown** - Resolution is best-effort with graceful fallback to original command

## Storage

**N/A** - No persistent storage. Command resolution happens at child server spawn time (in-memory only).

## Relationships

### Existing Types (No Changes)

```typescript
// src/types.ts - Already defined
interface ServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface ChildServerClient {
  serverKey: string;
  client: Client;
  config: ServerConfig;  // Contains original command
  status: ServerStatus;
  error?: Error;
}
```

### New Function (To Be Added)

```typescript
// src/child-manager.ts - New export
export function resolveCommand(command: string): string {
  // Implementation in Phase 2 (tasks.md)
}
```

**Usage in Existing Code**:

```typescript
// src/child-manager.ts - connectToChild() function (line ~68)
// BEFORE:
const transport = new StdioClientTransport({
  command: config.command,
  args: config.args || [],
  env: mergedEnv
});

// AFTER:
const resolvedCommand = resolveCommand(config.command);
console.log(`[INFO] Resolved '${config.command}' to '${resolvedCommand}' for child server '${serverKey}'`);
const transport = new StdioClientTransport({
  command: resolvedCommand,  // Use resolved command
  args: config.args || [],
  env: mergedEnv
});
```

## Type Safety

### TypeScript Strict Mode Compliance

- ✅ `resolveCommand(command: string): string` - Simple string → string transformation
- ✅ No `any` types
- ✅ No nullable types (command is always a string from config validation)
- ✅ No index access (uses built-in APIs only)

### Immutability

- ✅ Original `ServerConfig` is never modified
- ✅ Resolution creates new string value
- ✅ Pure function (no side effects except logging)

## Summary

This feature requires **no new data structures**. It operates entirely on the existing `ServerConfig` type by transforming the `command` string value before it's passed to `StdioClientTransport`.

**Key Points**:
- Input: `string` (from ServerConfig.command)
- Output: `string` (resolved absolute path or original)
- Storage: None (in-memory transformation only)
- Validation: Best-effort with graceful fallback
- Type safety: Fully compliant with TypeScript strict mode

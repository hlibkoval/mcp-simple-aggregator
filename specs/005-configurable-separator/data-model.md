# Data Model

**Feature**: Configurable Tool Name Separator
**Date**: 2025-11-04

## Overview

This feature adds a single configuration parameter (separator string) that flows through the system without introducing new entities or complex data structures. This document describes the minimal data model changes required.

## Core Data Structures

### 1. CliArgs (Modified)

**Location**: `src/types.ts`

**Purpose**: Command-line arguments parsed from user input

**Changes**: Add optional `separator` field

```typescript
export interface CliArgs {
  configPath?: string;    // Existing
  debug?: boolean;        // Existing
  logFile?: string;       // Existing
  name?: string;          // Existing
  version?: string;       // Existing
  separator?: string;     // NEW: Optional separator (default ':')
}
```

**Validation Rules**:
- If provided, MUST NOT be empty string
- If provided, MUST NOT contain whitespace characters (space, tab, newline)
- If not provided, defaults to `':'`
- MAY be multi-character string
- MAY contain unicode characters

**Examples**:
```typescript
// Valid CliArgs
{ configPath: '/path/to/config.json', separator: '__' }  // Custom separator
{ configPath: '/path/to/config.json', separator: '::' }  // Multi-char separator
{ configPath: '/path/to/config.json' }                    // Default ':' separator

// Invalid CliArgs (validation error)
{ configPath: '/path/to/config.json', separator: '' }     // Empty
{ configPath: '/path/to/config.json', separator: ' ' }    // Whitespace
{ configPath: '/path/to/config.json', separator: 'x y' }  // Contains space
```

### 2. ToolRegistryEntry (No Changes)

**Location**: `src/types.ts`

**Purpose**: Maps prefixed tool name to routing information

**Note**: No changes needed. The `schema.name` field already stores the prefixed name. The only change is how that prefixed name is constructed (using configurable separator instead of hardcoded `:`).

```typescript
export interface ToolRegistryEntry {
  client: Client;           // Unchanged
  serverKey: string;        // Unchanged
  originalName: string;     // Unchanged
  schema: ToolSchema;       // Unchanged - schema.name contains prefixed name
}
```

### 3. ServerOptions (No Changes)

**Location**: `src/server.ts`

**Purpose**: Server configuration options

**Note**: Separator is passed as function parameter, not stored in ServerOptions. This keeps separation of concerns (ServerOptions is for server identity, not tool naming).

```typescript
export interface ServerOptions {
  name?: string;     // Unchanged
  version?: string;  // Unchanged
}
```

## Data Flow

### Separator Lifecycle

```text
1. CLI Input
   User: --separator "__"
   ↓
   parseCliArgs() extracts: args.separator = "__"
   ↓
   validateCliArgs() checks: non-empty, no whitespace
   ↓
   Default if missing: separator = args.separator || ':'

2. Registry Building
   buildToolRegistry(childClients, separator)
   ↓
   addServerTools(registry, serverKey, client, tools, separator)
   ↓
   For each tool: prefixedName = `${serverKey}${separator}${tool.name}`
   ↓
   Store in registry: Map<prefixedName, ToolRegistryEntry>

3. Tool Call Parsing
   Client calls: serverKey__toolName
   ↓
   parseToolPrefix(prefixedName, separator)
   ↓
   Split: serverKey = before separator, toolName = after separator
   ↓
   Lookup: registry.get(prefixedName)
   ↓
   Route to child: client.callTool({ name: originalName, ... })
```

## State Management

### Immutable Configuration

**Decision**: Separator is immutable after startup

**Rationale**:
- No runtime reconfiguration needed (restart to change separator)
- Simplifies implementation (no state updates)
- Prevents race conditions (no concurrent modification)
- Matches existing pattern (all CLI args are startup-only)

**Implications**:
- Separator value is read once from CLI args
- Passed by value through function calls
- Never modified after initial validation
- No need for getters/setters or synchronization

### No Persistent State

**Decision**: Separator is not persisted to disk

**Rationale**:
- Aggregator is stateless (no database, no config file writes)
- User provides separator on every startup via CLI argument
- Consistent with existing CLI args (--debug, --name, etc.)
- No migration path needed (no stored state to migrate)

## Entity Relationships

### Conceptual Model

```text
┌─────────────┐
│   CliArgs   │
│             │
│ separator   │ ─────┐
└─────────────┘      │
                     │ [used by]
                     ↓
┌─────────────────────────────────┐
│      Tool Registry Building     │
│                                 │
│  serverKey + separator + name   │ ───→ prefixedName
└─────────────────────────────────┘

                     │ [stored in]
                     ↓
┌─────────────────────────────────┐
│       ToolRegistry (Map)        │
│                                 │
│  prefixedName → ToolRegistryEntry│
│    ↑               ↓            │
│    │          originalName      │
│    │          client            │
│    │          serverKey         │
└────┼────────────────────────────┘
     │
     │ [looked up during]
     ↓
┌─────────────────────────────────┐
│       Tool Call Parsing         │
│                                 │
│  prefixedName ─(split by)→      │
│                separator         │
│  → serverKey + originalName     │
└─────────────────────────────────┘
```

### Key Invariants

1. **Uniqueness**: `prefixedName` is unique within registry
   - Enforced by Map key uniqueness
   - Collision possible only if serverKey or toolName contains separator (acceptable edge case)

2. **Reversibility**: `prefixedName` can be split back into `serverKey` and `toolName`
   - Enforced by indexOf() and slice() logic
   - First occurrence of separator is split point
   - Multiple separator occurrences handled (split at first)

3. **Consistency**: Same separator used for prefixing and parsing
   - Enforced by parameter passing (single source of truth)
   - No global state (no risk of inconsistency)

## Validation Rules Summary

### Input Validation (CLI)

| Rule | Check | Error Message |
|------|-------|---------------|
| Non-empty | `separator !== ''` | "Separator cannot be empty. Use --separator <chars>..." |
| No whitespace | `!/\s/.test(separator)` | "Separator cannot contain whitespace. Use non-whitespace characters..." |

### Runtime Validation (Tool Call Parsing)

| Rule | Check | Error Type |
|------|-------|------------|
| Has separator | `indexOf(separator) !== -1` | InvalidRequest |
| Non-empty serverKey | `indexOf(separator) !== 0` | InvalidRequest |
| Non-empty toolName | `indexOf(separator) !== length - separator.length` | InvalidRequest |
| Tool exists | `registry.has(prefixedName)` | MethodNotFound |

## Migration Path

**Not applicable**: This feature requires no data migration.

- No existing data to migrate (stateless aggregator)
- No config file changes (separator is CLI argument only)
- Backward compatible (default separator is `:`)
- Users opt-in by passing `--separator` argument

## Performance Characteristics

### Memory

- **Per-instance overhead**: ~10 bytes (single string)
- **Per-tool overhead**: ~0 bytes (separator not duplicated)
- **Total impact**: Negligible (<0.001% of baseline)

### Computation

- **Prefixing cost**: O(1) string concatenation (~3 operations)
- **Parsing cost**: O(n) indexOf + O(1) slice (~2 operations)
- **Total latency**: <0.1ms per tool call (dominated by network I/O)

### Storage

- **Persistent storage**: 0 bytes (not persisted)
- **In-memory storage**: ~10 bytes (single string in args)

## Type Definitions Reference

### Modified Types

```typescript
// src/types.ts

export interface CliArgs {
  configPath?: string;
  debug?: boolean;
  logFile?: string;
  name?: string;
  version?: string;
  separator?: string;     // NEW
}
```

### Unchanged Types

```typescript
// No changes to these types:

export interface McpConfig { ... }
export interface ServerConfig { ... }
export enum ServerStatus { ... }
export interface ChildServerClient { ... }
export interface ToolRegistryEntry { ... }
export type ToolRegistry = Map<string, ToolRegistryEntry>;
export interface ToolSchema { ... }
```

## Summary

This feature introduces minimal data model changes:
- **1 new field**: `CliArgs.separator` (optional string)
- **0 new types**: All existing types reused
- **0 new entities**: No complex objects introduced
- **Immutable**: Separator set once at startup, never modified
- **Stateless**: No persistence, no migration needed

The simplicity of the data model reflects the straightforward nature of this feature: threading a single configuration parameter through the system without architectural changes.

# Function Signature Contracts

**Feature**: Configurable Tool Name Separator
**Date**: 2025-11-04

## Overview

This document defines the API contracts for functions modified to support configurable separators. All changes are backward compatible through default parameters.

## Modified Functions

### 1. buildToolRegistry

**Module**: `src/registry.ts`

**Before**:
```typescript
export async function buildToolRegistry(
  childClients: Map<string, Client>
): Promise<ToolRegistry>
```

**After**:
```typescript
export async function buildToolRegistry(
  childClients: Map<string, Client>,
  separator: string = ':'
): Promise<ToolRegistry>
```

**Changes**:
- Added `separator` parameter with default value `':'`
- Separator is passed to `addServerTools()`

**Backward Compatibility**: ✅ Yes (default parameter)
- Existing calls without separator continue working
- New calls can optionally pass custom separator

**Example Usage**:
```typescript
// Backward compatible (uses default ':')
const registry = await buildToolRegistry(childClients);

// With custom separator
const registry = await buildToolRegistry(childClients, '__');
```

---

### 2. addServerTools

**Module**: `src/registry.ts`

**Before**:
```typescript
export function addServerTools(
  registry: ToolRegistry,
  serverKey: string,
  client: Client,
  tools: ToolSchema[]
): void
```

**After**:
```typescript
export function addServerTools(
  registry: ToolRegistry,
  serverKey: string,
  client: Client,
  tools: ToolSchema[],
  separator: string = ':'
): void
```

**Changes**:
- Added `separator` parameter with default value `':'`
- Tool prefixing logic uses separator: `${serverKey}${separator}${tool.name}`

**Backward Compatibility**: ✅ Yes (default parameter)

**Example Usage**:
```typescript
// Backward compatible (uses default ':')
addServerTools(registry, 'github', client, tools);

// With custom separator
addServerTools(registry, 'github', client, tools, '__');

// Result: 'github__create_issue', 'github__list_repos', etc.
```

---

### 3. removeServerTools

**Module**: `src/registry.ts`

**Before**:
```typescript
export function removeServerTools(
  registry: ToolRegistry,
  serverKey: string
): void
```

**After**:
```typescript
export function removeServerTools(
  registry: ToolRegistry,
  serverKey: string,
  separator: string = ':'
): void
```

**Changes**:
- Added `separator` parameter with default value `':'`
- Prefix matching uses separator: `${serverKey}${separator}`

**Backward Compatibility**: ✅ Yes (default parameter)

**Example Usage**:
```typescript
// Backward compatible (uses default ':')
removeServerTools(registry, 'github');

// With custom separator
removeServerTools(registry, 'github', '__');
```

---

### 4. parseToolPrefix

**Module**: `src/server.ts`

**Before**:
```typescript
export function parseToolPrefix(
  prefixedName: string
): { serverKey: string; toolName: string } | null
```

**After**:
```typescript
export function parseToolPrefix(
  prefixedName: string,
  separator: string = ':'
): { serverKey: string; toolName: string } | null
```

**Changes**:
- Added `separator` parameter with default value `':'`
- Parsing logic uses `indexOf(separator)` instead of `indexOf(':')`
- Boundary checks account for multi-character separators

**Backward Compatibility**: ✅ Yes (default parameter)

**Example Usage**:
```typescript
// Backward compatible (uses default ':')
const result = parseToolPrefix('github:create_issue');
// Returns: { serverKey: 'github', toolName: 'create_issue' }

// With custom separator
const result = parseToolPrefix('github__create_issue', '__');
// Returns: { serverKey: 'github', toolName: 'create_issue' }

// Invalid format
const result = parseToolPrefix('invalid-format', '__');
// Returns: null
```

**Edge Cases**:
```typescript
// Tool name contains separator (accepted - splits at first occurrence)
parseToolPrefix('github__search:code', '__')
// Returns: { serverKey: 'github', toolName: 'search:code' }

// Empty serverKey (rejected)
parseToolPrefix('__toolName', '__')
// Returns: null

// Empty toolName (rejected)
parseToolPrefix('serverKey__', '__')
// Returns: null

// No separator (rejected)
parseToolPrefix('noSeparator', '__')
// Returns: null
```

---

### 5. setupToolCallHandler

**Module**: `src/server.ts`

**Before**:
```typescript
export function setupToolCallHandler(
  server: Server,
  registry: ToolRegistry
): void
```

**After**:
```typescript
export function setupToolCallHandler(
  server: Server,
  registry: ToolRegistry,
  separator: string = ':'
): void
```

**Changes**:
- Added `separator` parameter with default value `':'`
- Passes separator to `parseToolPrefix()`
- Error messages include separator in expected format example

**Backward Compatibility**: ✅ Yes (default parameter)

**Example Usage**:
```typescript
// Backward compatible (uses default ':')
setupToolCallHandler(server, registry);

// With custom separator
setupToolCallHandler(server, registry, '__');
```

**Error Messages**:
```typescript
// With default separator
throw new McpError(
  ErrorCode.InvalidRequest,
  `Invalid tool name format. Expected 'serverKey:toolName', got '${prefixedName}'`
);

// With custom separator '__'
throw new McpError(
  ErrorCode.InvalidRequest,
  `Invalid tool name format. Expected 'serverKey__toolName', got '${prefixedName}'`
);
```

---

## New Functions

### validateSeparator

**Module**: `src/index.ts` (inline in main())

**Signature**:
```typescript
function validateSeparator(separator: string): void
```

**Purpose**: Validate separator string meets requirements

**Validation Rules**:
1. Non-empty: `separator !== ''`
2. No whitespace: `!/\s/.test(separator)`

**Throws**:
- `Error` if validation fails

**Example**:
```typescript
validateSeparator('__');   // OK
validateSeparator(':');    // OK
validateSeparator('.');    // OK
validateSeparator('');     // Throws: "Separator cannot be empty..."
validateSeparator(' ');    // Throws: "Separator cannot contain whitespace..."
validateSeparator('a b');  // Throws: "Separator cannot contain whitespace..."
```

---

## Unchanged Functions

These functions do NOT need separator parameter (no tool name manipulation):

### Registry Functions
- `lookupTool(registry, prefixedName)` - Unchanged (uses Map.get() with full name)
- `getAllTools(registry)` - Unchanged (returns all tools from registry)
- `getRegistryStats(registry)` - Unchanged (aggregates counts)

### Server Functions
- `createAggregatorServer(childClients, registry, options)` - Unchanged
- `handleToolsList(registry)` - Unchanged (returns tools from registry)
- `updateRegistryAfterCrash(registry, serverKey)` - Calls `removeServerTools()` with separator
- `startServer(server)` - Unchanged

### Config Functions
- `readConfigFile(path)` - Unchanged
- `parseConfig(rawConfig)` - Unchanged
- `expandConfigEnvVars(config)` - Unchanged

### Child Manager Functions
- `initializeChildren(config)` - Unchanged
- `setupErrorHandlers(children, registry)` - Unchanged

### CLI Functions
- `parseCliArgs(argv)` - Modified to parse `--separator`
- `validateCliArgs(args)` - Unchanged (validates config path only)
- `printHelp()` - Modified to document `--separator`

---

## Type Contracts

### CliArgs Type (Modified)

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

**Contract**:
- If `separator` is provided, it MUST pass `validateSeparator()` checks
- If `separator` is undefined, default value `':'` is used
- Type is `string` (not `string | undefined` at usage sites due to defaulting)

---

## Testing Contracts

### Unit Test Requirements

Each modified function MUST have tests for:

1. **Default behavior** (no separator parameter)
   - Ensures backward compatibility
   - Verifies default `':'` separator is used

2. **Custom separator behavior**
   - Single-character separators
   - Multi-character separators
   - Unicode separators (if applicable)

3. **Edge cases**
   - Empty strings (validation tests)
   - Whitespace (validation tests)
   - Tool names containing separator (parsing tests)
   - Boundary conditions (empty serverKey/toolName)

### Integration Test Requirements

End-to-end flow MUST test:
1. CLI argument parsing with `--separator`
2. Tool listing shows custom separator in tool names
3. Tool calling works with custom separator
4. Error messages show correct expected format

---

## Deprecation Policy

**No deprecations**. All changes are additive with default parameters.

**Stability**: All modified functions maintain stable contracts:
- Function names unchanged
- Parameter order unchanged (separator added at end)
- Return types unchanged
- Default parameters ensure backward compatibility

**Future Changes**: If separator becomes more complex (e.g., regex patterns), new functions will be created rather than modifying these signatures (following semver).

---

## Summary

**Modified Functions**: 5
- `buildToolRegistry()` - Added separator parameter
- `addServerTools()` - Added separator parameter
- `removeServerTools()` - Added separator parameter
- `parseToolPrefix()` - Added separator parameter
- `setupToolCallHandler()` - Added separator parameter

**New Functions**: 1
- `validateSeparator()` - Inline validation function

**Unchanged Functions**: 12+ (all other functions in codebase)

**Backward Compatibility**: 100% (all changes use default parameters)

**Breaking Changes**: None

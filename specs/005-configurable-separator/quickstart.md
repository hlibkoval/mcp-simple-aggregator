# Quick Start Guide: Configurable Separator

**Feature**: Configurable Tool Name Separator
**Target Users**: Developers implementing this feature
**Time to Read**: 10 minutes

## Overview

This feature adds a `--separator` CLI argument to configure the character(s) used to namespace tool names. By default, tools are named `serverKey:toolName`. With this feature, users can specify alternatives like `serverKey__toolName` or `serverKey.toolName`.

## 5-Minute Primer

### What's Changing?

**Before**:
```bash
# Fixed separator ':'
mcp-simple-aggregator --config config.json
# Tools: github:create_issue, filesystem:read_file
```

**After**:
```bash
# Configurable separator
mcp-simple-aggregator --config config.json --separator "__"
# Tools: github__create_issue, filesystem__read_file
```

### Implementation Summary

1. **CLI Parsing** (`src/index.ts`):
   - Parse `--separator` argument
   - Validate: non-empty, no whitespace
   - Default to `':'` if not provided

2. **Registry Building** (`src/registry.ts`):
   - Pass separator to `addServerTools()`
   - Use separator in tool name prefixing: `${serverKey}${separator}${toolName}`

3. **Tool Call Parsing** (`src/server.ts`):
   - Pass separator to `parseToolPrefix()`
   - Split tool name using `indexOf(separator)` instead of `indexOf(':')`

### Files to Modify

- ✏️ `src/index.ts` - CLI argument parsing
- ✏️ `src/registry.ts` - Tool prefixing logic
- ✏️ `src/server.ts` - Tool name parsing logic
- ✏️ `src/types.ts` - Add `separator?: string` to CliArgs
- ✅ `src/config.ts` - No changes
- ✅ `src/child-manager.ts` - No changes
- ✅ `src/logger.ts` - No changes

## Step-by-Step Implementation

### Step 1: Update Types

**File**: `src/types.ts`

**Change**: Add `separator` field to `CliArgs` interface

```typescript
export interface CliArgs {
  configPath?: string;
  debug?: boolean;
  logFile?: string;
  name?: string;
  version?: string;
  separator?: string;     // ADD THIS LINE
}
```

**Why**: Type-safe access to separator value throughout the codebase.

---

### Step 2: Update CLI Parsing

**File**: `src/index.ts`

**Change 1**: Add separator parsing to `parseCliArgs()`

```typescript
export function parseCliArgs(argv: string[] = process.argv.slice(2)): CliArgs {
  const args: Partial<CliArgs> = {
    debug: false,
    name: 'mcp-simple-aggregator',
    version: '1.0.0'
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;

    // ... existing argument handling ...

    // ADD THIS BLOCK
    if (arg === '--separator') {
      const nextArg = argv[++i];
      if (nextArg) {
        args.separator = nextArg;
      }
    } else if (arg.startsWith('--separator=')) {
      args.separator = arg.substring('--separator='.length);
    }
    // END NEW BLOCK

    // ... rest of argument handling ...
  }

  return args as CliArgs;
}
```

**Change 2**: Add separator validation

```typescript
// ADD THIS FUNCTION (after validateCliArgs)
export function validateSeparator(separator: string): void {
  if (separator === '') {
    throw new Error(
      'Separator cannot be empty. Use --separator <chars> to specify a separator (default: ":")'
    );
  }
  if (/\s/.test(separator)) {
    throw new Error(
      'Separator cannot contain whitespace. Use non-whitespace characters like "__" or "-"'
    );
  }
}
```

**Change 3**: Update `main()` function

```typescript
async function main() {
  try {
    // Parse CLI arguments
    const args = parseCliArgs();
    validateCliArgs(args);

    // ADD THESE LINES
    // Validate and default separator
    const separator = args.separator || ':';
    if (args.separator) {
      validateSeparator(args.separator);
    }
    // END NEW LINES

    // Set debug mode for logger
    setDebugMode(args.debug || false);

    // ... existing initialization code ...

    // MODIFY THIS LINE - add separator parameter
    const registry = await buildToolRegistry(childClients, separator);

    // ... existing server creation code ...

    // MODIFY THIS LINE - add separator parameter
    setupToolCallHandler(server, registry, separator);

    // ... rest of main() ...
  }
}
```

**Change 4**: Update help message

```typescript
function printHelp(): void {
  console.log(`
MCP Simple Aggregator - Aggregate multiple MCP servers into one

Usage:
  mcp-simple-aggregator --config <path> [options]

Required Arguments:
  --config <path>       Path to MCP configuration JSON file

Optional Arguments:
  --separator <chars>   Separator for tool namespacing (default: ":")    // ADD THIS LINE
                        Examples: "__", ".", "::", "-"                   // ADD THIS LINE
  --debug               Enable debug logging
  --log-file <path>     Path to log file (default: /tmp/mcp-aggregator-{pid}.log)
  --name <name>         Server name (default: mcp-simple-aggregator)
  --version <ver>       Server version (default: 1.0.0)
  --help, -h            Show this help message

Examples:
  # Basic usage
  mcp-simple-aggregator --config /path/to/config.json

  # Custom separator                                                     // ADD THESE LINES
  mcp-simple-aggregator --config /path/to/config.json --separator "__" // ADD THESE LINES

  # With debug logging
  mcp-simple-aggregator --config /path/to/config.json --debug

  # Custom separator and log file                                       // ADD THIS LINE
  mcp-simple-aggregator --config config.json --separator "." --debug --log-file /var/log/mcp.log  // ADD THIS LINE

  # Custom server name
  mcp-simple-aggregator --config config.json --name my-aggregator

// ... rest of help message ...
`);
}
```

---

### Step 3: Update Registry Functions

**File**: `src/registry.ts`

**Change 1**: Update `buildToolRegistry()` signature

```typescript
export async function buildToolRegistry(
  childClients: Map<string, Client>,
  separator: string = ':'    // ADD THIS PARAMETER
): Promise<ToolRegistry> {
  const registry: ToolRegistry = new Map();

  // ... existing tool fetch logic ...

  // MODIFY THIS LINE - pass separator
  for (const { serverKey, client, tools } of results) {
    addServerTools(registry, serverKey, client, tools as ToolSchema[], separator);
  }

  return registry;
}
```

**Change 2**: Update `addServerTools()` signature and logic

```typescript
export function addServerTools(
  registry: ToolRegistry,
  serverKey: string,
  client: Client,
  tools: ToolSchema[],
  separator: string = ':'    // ADD THIS PARAMETER
): void {
  for (const tool of tools) {
    // MODIFY THIS LINE - use separator instead of ':'
    const prefixedName = `${serverKey}${separator}${tool.name}`;

    const entry: ToolRegistryEntry = {
      client,
      serverKey,
      originalName: tool.name,
      schema: {
        ...tool,
        name: prefixedName
      }
    };

    registry.set(prefixedName, entry);
  }
}
```

**Change 3**: Update `removeServerTools()` signature and logic

```typescript
export function removeServerTools(
  registry: ToolRegistry,
  serverKey: string,
  separator: string = ':'    // ADD THIS PARAMETER
): void {
  // MODIFY THIS LINE - use separator instead of ':'
  const prefix = `${serverKey}${separator}`;

  // ... rest of function unchanged ...
}
```

---

### Step 4: Update Server Functions

**File**: `src/server.ts`

**Change 1**: Update `parseToolPrefix()` signature and logic

```typescript
export function parseToolPrefix(
  prefixedName: string,
  separator: string = ':'    // ADD THIS PARAMETER
): { serverKey: string; toolName: string } | null {
  // MODIFY THESE LINES - use separator instead of ':'
  const separatorIndex = prefixedName.indexOf(separator);

  if (separatorIndex === -1 ||
      separatorIndex === 0 ||
      separatorIndex === prefixedName.length - separator.length) {  // Account for multi-char
    return null;
  }

  const serverKey = prefixedName.slice(0, separatorIndex);
  const toolName = prefixedName.slice(separatorIndex + separator.length);  // Account for multi-char

  return { serverKey, toolName };
}
```

**Change 2**: Update `setupToolCallHandler()` signature

```typescript
export function setupToolCallHandler(
  server: Server,
  registry: ToolRegistry,
  separator: string = ':'    // ADD THIS PARAMETER
): void {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: prefixedName, arguments: args } = request.params;

    // MODIFY THIS LINE - pass separator
    const parsed = parseToolPrefix(prefixedName, separator);
    if (!parsed) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        // MODIFY THIS LINE - use separator in error message
        `Invalid tool name format. Expected 'serverKey${separator}toolName', got '${prefixedName}'`
      );
    }

    // ... rest of handler unchanged ...
  });
}
```

**Change 3**: Update `updateRegistryAfterCrash()` (if called with separator)

```typescript
export function updateRegistryAfterCrash(
  registry: ToolRegistry,
  serverKey: string,
  separator: string = ':'    // ADD THIS PARAMETER
): void {
  // MODIFY THIS LINE - pass separator
  removeServerTools(registry, serverKey, separator);
}
```

---

## Testing Checklist

### Unit Tests

- [ ] **CLI Parsing** (`tests/unit/cli.test.ts`):
  - [ ] Parse `--separator "value"`
  - [ ] Parse `--separator=value`
  - [ ] Default to `:` when not provided
  - [ ] Reject empty separator
  - [ ] Reject whitespace separator
  - [ ] Accept multi-character separator

- [ ] **Registry** (`tests/unit/registry.test.ts`):
  - [ ] Prefix with default separator `:`
  - [ ] Prefix with custom separator `__`
  - [ ] Remove tools with custom separator

- [ ] **Server Parsing** (`tests/unit/server.test.ts`):
  - [ ] Parse with default separator `:`
  - [ ] Parse with custom separator `__`
  - [ ] Reject invalid format (no separator)
  - [ ] Reject empty serverKey or toolName
  - [ ] Handle tool names containing separator

### Integration Tests

- [ ] **End-to-End** (`tests/integration/separator.test.ts`):
  - [ ] Start aggregator with `--separator "__"`
  - [ ] List tools shows correct format
  - [ ] Call tool with custom separator works
  - [ ] Error messages show correct expected format

---

## Common Pitfalls

### 1. Forgetting Multi-Character Separators

**Wrong**:
```typescript
// Only handles single-character separators
const toolName = prefixedName.slice(separatorIndex + 1);
```

**Right**:
```typescript
// Handles multi-character separators
const toolName = prefixedName.slice(separatorIndex + separator.length);
```

### 2. Not Passing Separator Through

**Wrong**:
```typescript
// Separator lost, defaults to ':'
const registry = await buildToolRegistry(childClients);
```

**Right**:
```typescript
// Separator threaded through
const registry = await buildToolRegistry(childClients, separator);
```

### 3. Hardcoding ':' Instead of Using Parameter

**Wrong**:
```typescript
const prefixedName = `${serverKey}:${tool.name}`;  // Hardcoded ':'
```

**Right**:
```typescript
const prefixedName = `${serverKey}${separator}${tool.name}`;  // Uses parameter
```

---

## Debugging Tips

### Enable Debug Logging

```bash
mcp-simple-aggregator \
  --config config.json \
  --separator "__" \
  --debug \
  --log-file /tmp/debug.log
```

Then check the log:
```bash
tail -f /tmp/debug.log | grep separator
```

### Verify Tool Names

After starting the aggregator, use MCP inspector to list tools:
```bash
# Should show tools with custom separator
github__create_issue
filesystem__read_file
```

### Test Parsing Manually

```typescript
// In tests/unit/server.test.ts
import { parseToolPrefix } from '../../src/server';

console.log(parseToolPrefix('github__create_issue', '__'));
// Should output: { serverKey: 'github', toolName: 'create_issue' }
```

---

## Performance Considerations

**No performance impact expected**:
- String concatenation: O(n) where n = total string length (~50 chars)
- indexOf() search: O(n) where n = total string length
- Both operations are <0.1ms per tool call
- Dominated by network I/O (milliseconds to child servers)

---

## Next Steps

After implementing this feature:

1. **Run Tests**: `npm test`
2. **Check Coverage**: `npm run test:coverage` (aim for ≥80%)
3. **Run Lint**: `npm run lint` (ensure no type errors)
4. **Manual Testing**: Start aggregator with `--separator "__"` and verify tool listing
5. **Update CHANGELOG**: Document the new `--separator` argument
6. **Update README**: Add examples with custom separators

---

## Getting Help

If you're stuck:

1. **Check Research**: See `research.md` for design decisions
2. **Check Contracts**: See `contracts/` for function signatures
3. **Check Data Model**: See `data-model.md` for type definitions
4. **Check Existing Code**: Look at how `--debug` or `--name` arguments are implemented
5. **Run Tests**: Use failing tests to guide implementation (TDD)

---

## Summary

**Core Changes**:
1. Add `separator?: string` to CliArgs type
2. Parse `--separator` in parseCliArgs()
3. Validate separator (non-empty, no whitespace)
4. Thread separator through registry and server functions
5. Use separator in prefixing and parsing instead of hardcoded `':'`

**Testing Strategy**: TDD - write tests first, implement to pass tests

**Estimated Time**: 2-4 hours for implementation + tests

**Complexity**: Low (parameter threading, no architectural changes)

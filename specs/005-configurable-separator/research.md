# Research & Technical Decisions

**Feature**: Configurable Tool Name Separator
**Date**: 2025-11-04

## Overview

This document captures research findings and technical decisions for implementing configurable tool name separators in the MCP aggregator.

## Research Questions

### Q1: What separator formats should be supported?

**Decision**: Support any non-empty, non-whitespace string as separator

**Rationale**:
- Maximum flexibility for users with different environment constraints
- Colon (`:`) conflicts with some shell environments and Windows paths
- Double-underscore (`__`) is a common alternative in Python/Django namespacing
- Dot (`.`) is common in Java/JavaScript namespacing
- Multi-character separators provide more unique boundaries (reduces collision risk)

**Alternatives considered**:
- Single-character only → Rejected: Too restrictive, multi-character separators are useful
- Predefined whitelist → Rejected: Cannot predict all user needs
- Regex validation → Rejected: Overly complex for the simple requirement

**Validation rules**:
- MUST NOT be empty string (loses namespace distinction)
- MUST NOT contain whitespace (breaks tool name parsing)
- MAY be multi-character (e.g., `__`, `::`, `--`)
- MAY contain unicode characters (user's choice)

### Q2: How should separator be passed through the system?

**Decision**: Thread separator through function signatures

**Rationale**:
- Direct parameter passing is explicit and traceable
- No global state (avoids testing complications)
- Follows existing patterns in the codebase (options objects)
- Type-safe with TypeScript interfaces

**Alternatives considered**:
- Global configuration object → Rejected: Makes testing harder, implicit dependencies
- Singleton pattern → Rejected: Overkill for a single string value
- Environment variable → Rejected: CLI argument is more explicit and documented

**Implementation pattern**:
```typescript
// CLI parses separator
const args = parseCliArgs();
const separator = args.separator || ':';

// Pass to registry builder
const registry = await buildToolRegistry(childClients, separator);

// Pass to server for parsing
setupToolCallHandler(server, registry, separator);
```

### Q3: Where does separator parsing/validation occur?

**Decision**: Validate in CLI argument parsing (fail-fast at startup)

**Rationale**:
- Early validation prevents invalid state propagation
- Clear error message at startup (user-facing)
- No need for runtime validation (immutable after startup)
- Follows existing pattern (config validation happens early)

**Alternatives considered**:
- Validate at each usage site → Rejected: Redundant, wastes CPU
- Validate in registry → Rejected: Too late, unclear error location
- No validation → Rejected: Violates user experience consistency principle

**Validation function signature**:
```typescript
function validateSeparator(separator: string): void {
  if (separator === '') {
    throw new Error('Separator cannot be empty');
  }
  if (/\s/.test(separator)) {
    throw new Error('Separator cannot contain whitespace');
  }
}
```

### Q4: How to handle backward compatibility?

**Decision**: Default separator is `:`, optional CLI argument

**Rationale**:
- Existing deployments continue working without changes
- Optional parameter pattern already used for other CLI args (--debug, --name)
- No migration path needed (stateless aggregator)
- Clear upgrade path (add --separator when needed)

**Backward compatibility verification**:
- No changes to config file format
- No changes to child server interactions
- Tool names default to existing format (`serverKey:toolName`)
- Only changes when user explicitly passes `--separator`

## Technical Constraints

### String Manipulation Performance

**Constraint**: Separator operations must not impact tool call latency

**Analysis**:
- String concatenation: O(n) where n is total string length (~50 chars typical)
- String split: O(n) where n is total string length
- Single indexOf() call: O(n) where n is total string length
- Impact: <0.1ms per tool call (negligible vs network I/O)

**Conclusion**: No performance concerns. String operations are fast enough for this use case.

### Memory Overhead

**Constraint**: Separator storage should not increase memory baseline

**Analysis**:
- Single separator string stored in args: ~10 bytes (typical)
- No duplication (passed by reference)
- No collection overhead (single value, not array)
- Impact: <0.001% of 50MB baseline

**Conclusion**: Memory overhead is negligible.

### Type Safety

**Constraint**: TypeScript strict mode must be maintained

**Analysis**:
- Add `separator?: string` to CliArgs interface
- Add `separator: string` parameter to affected functions
- Default parameter values ensure non-null at runtime
- No type casts needed (string is primitive)

**Conclusion**: Type safety maintained with standard TypeScript patterns.

## Implementation Decisions

### Decision 1: Separator in CliArgs Type

**Choice**: Add optional `separator` field to `CliArgs` interface

```typescript
export interface CliArgs {
  configPath?: string;
  debug?: boolean;
  logFile?: string;
  name?: string;
  version?: string;
  separator?: string;  // NEW: Optional separator (default ':')
}
```

**Rationale**:
- Consistent with existing optional CLI arguments
- Type-safe access in main()
- Clear default behavior (undefined → ':')

### Decision 2: Registry Function Signatures

**Choice**: Add separator parameter to registry functions

```typescript
// Current
export function addServerTools(
  registry: ToolRegistry,
  serverKey: string,
  client: Client,
  tools: ToolSchema[]
): void

// New
export function addServerTools(
  registry: ToolRegistry,
  serverKey: string,
  client: Client,
  tools: ToolSchema[],
  separator: string = ':'  // Default parameter
): void
```

**Rationale**:
- Default parameter ensures backward compatibility in tests
- Explicit parameter is clear and traceable
- No breaking changes to existing call sites (default used)

### Decision 3: Server Parser Updates

**Choice**: Make parseToolPrefix() accept separator parameter

```typescript
// Current
export function parseToolPrefix(
  prefixedName: string
): { serverKey: string; toolName: string } | null

// New
export function parseToolPrefix(
  prefixedName: string,
  separator: string = ':'
): { serverKey: string; toolName: string } | null
```

**Implementation**:
```typescript
const separatorIndex = prefixedName.indexOf(separator);
if (separatorIndex === -1 ||
    separatorIndex === 0 ||
    separatorIndex === prefixedName.length - separator.length) {
  return null;
}
const serverKey = prefixedName.slice(0, separatorIndex);
const toolName = prefixedName.slice(separatorIndex + separator.length);
return { serverKey, toolName };
```

**Rationale**:
- indexOf() supports multi-character separators naturally
- Boundary checks prevent empty serverKey or toolName
- Default parameter maintains backward compatibility

### Decision 4: Error Messages

**Choice**: User-friendly error messages with examples

```typescript
// Empty separator
throw new Error('Separator cannot be empty. Use --separator <chars> to specify a separator (default: ":")');

// Whitespace separator
throw new Error('Separator cannot contain whitespace. Use non-whitespace characters like "__" or "-"');

// Invalid tool name format
throw new McpError(
  ErrorCode.InvalidRequest,
  `Invalid tool name format. Expected 'serverKey${separator}toolName', got '${prefixedName}'`
);
```

**Rationale**:
- Clear explanation of what went wrong
- Actionable guidance (how to fix)
- Examples of valid alternatives
- Dynamic error messages include actual separator used

## Testing Strategy

### Unit Tests Required

1. **CLI Argument Parsing** (`tests/unit/cli.test.ts`)
   - ✓ Parse `--separator "value"`
   - ✓ Parse `--separator=value`
   - ✓ Default to `:` when not provided
   - ✓ Validate empty string rejection
   - ✓ Validate whitespace rejection
   - ✓ Accept multi-character separators

2. **Registry Prefixing** (`tests/unit/registry.test.ts`)
   - ✓ Prefix with default separator `:`
   - ✓ Prefix with custom separator `__`
   - ✓ Prefix with multi-character separator `::`
   - ✓ Handle tool names containing separator (no escaping)

3. **Server Parsing** (`tests/unit/server.test.ts`)
   - ✓ Parse with default separator `:`
   - ✓ Parse with custom separator `__`
   - ✓ Reject invalid format (no separator)
   - ✓ Reject invalid format (empty serverKey)
   - ✓ Reject invalid format (empty toolName)

### Integration Tests Required

1. **End-to-End Separator Flow** (`tests/integration/separator.test.ts`)
   - ✓ Start aggregator with `--separator "__"`
   - ✓ List tools shows `serverKey__toolName` format
   - ✓ Call tool with `serverKey__toolName` routes correctly
   - ✓ Call tool with wrong separator format fails gracefully

## Best Practices Applied

### Code Quality
- Type-safe parameter passing (no any types)
- Default parameters for backward compatibility
- Clear function signatures (self-documenting)
- No code duplication (single validation function)

### Testing
- TDD approach: Write tests before implementation
- Unit tests for each modified function
- Integration test for end-to-end flow
- Edge case coverage (empty, whitespace, multi-char)

### User Experience
- Clear error messages with examples
- Backward compatible (no breaking changes)
- Documented in --help output
- Debug logs show configured separator

### Performance
- No additional I/O (separator is in-memory)
- No regex overhead (simple string operations)
- O(1) additional operations per tool call
- No memory allocations in hot path

## Open Questions

None. All technical decisions have been made and documented above.

## References

- MCP SDK Documentation: https://modelcontextprotocol.io/
- TypeScript Function Parameters: https://www.typescriptlang.org/docs/handbook/functions.html
- Vitest Testing Framework: https://vitest.dev/
- Existing codebase patterns in src/index.ts, src/registry.ts, src/server.ts

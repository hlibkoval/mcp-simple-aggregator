# API Contract: Command Resolution

**Date**: 2025-11-04
**Phase**: 1 (Design & Contracts)
**Feature**: 002-node-executable-resolution
**Scope**: Internal API (not exposed to package consumers)

## Function Signature

```typescript
export function resolveCommand(command: string): string
```

## Purpose

Resolves node-related commands (`"node"`, `"npm"`, `"npx"`) to absolute paths to prevent "spawn ENOENT" errors when the PATH environment variable doesn't include the Node.js installation directory.

## Parameters

### `command: string`

**Description**: The command from `ServerConfig.command` to be resolved

**Constraints**:
- Must be a non-empty string
- Typically one of: `"node"`, `"npm"`, `"npx"`, or other executable names
- May be an absolute path (e.g., `"/usr/bin/python3"`)
- May be a relative path (e.g., `"./server.js"` - though uncommon)

**Examples**:
- `"node"` - Standard node command
- `"npm"` - npm package manager
- `"npx"` - npm package runner
- `"python"` - Non-node command (unchanged)
- `"/usr/bin/node"` - Absolute path (unchanged)

## Return Value

### `string`

**Description**: Resolved absolute path to the executable, or the original command if no resolution is needed

**Guarantees**:
- If input is `"node"`, always returns `process.execPath` (absolute path)
- If input is `"npm"` or `"npx"` and exists in same directory as node, returns absolute path
- If input is `"npm"` or `"npx"` and NOT found, returns original command (fallback to PATH)
- If input is already an absolute path, returns unchanged
- If input is any other command, returns unchanged (uses system PATH)
- Never returns `undefined`, `null`, or empty string
- Never throws errors (graceful fallback)

## Resolution Rules

### Priority Order

1. **Explicit absolute paths**: If `path.isAbsolute(command)` is true, return unchanged
2. **"node" command**: Always resolve to `process.execPath`
3. **"npm"/"npx" commands**: Check `dirname(process.execPath)` with platform-specific extensions
4. **All other commands**: Return unchanged (rely on system PATH)

### Platform-Specific Behavior

#### Windows

- For `"npm"` and `"npx"`: Check for `.cmd` extension first
- Path: `path.join(dirname(process.execPath), 'npm.cmd')`
- Fallback: Check without extension (for Git Bash/WSL compatibility)

#### Unix (macOS, Linux)

- For `"npm"` and `"npx"`: Check without extension
- Path: `path.join(dirname(process.execPath), 'npm')`

## Examples

### Example 1: Resolve "node"

```typescript
// Given: macOS with node installed via Homebrew
process.execPath === '/usr/local/bin/node'

const resolved = resolveCommand('node');
// Returns: '/usr/local/bin/node'
```

### Example 2: Resolve "npm" (found)

```typescript
// Given: Standard Node.js installation
process.execPath === '/usr/local/bin/node'
// npm exists at: '/usr/local/bin/npm'

const resolved = resolveCommand('npm');
// Returns: '/usr/local/bin/npm'
```

### Example 3: Resolve "npm" (not found - fallback)

```typescript
// Given: Custom Node.js build without npm
process.execPath === '/opt/custom-node/bin/node'
// npm does NOT exist at: '/opt/custom-node/bin/npm'

const resolved = resolveCommand('npm');
// Returns: 'npm' (fallback to PATH resolution)
```

### Example 4: Absolute path (unchanged)

```typescript
const resolved = resolveCommand('/usr/bin/python3');
// Returns: '/usr/bin/python3' (unchanged)
```

### Example 5: Non-node command (unchanged)

```typescript
const resolved = resolveCommand('python');
// Returns: 'python' (unchanged, uses PATH)
```

### Example 6: Windows npm with .cmd extension

```typescript
// Given: Windows with standard Node.js installation
process.execPath === 'C:\\Program Files\\nodejs\\node.exe'
// npm.cmd exists at: 'C:\\Program Files\\nodejs\\npm.cmd'

const resolved = resolveCommand('npm');
// Returns: 'C:\\Program Files\\nodejs\\npm.cmd'
```

## Error Handling

**No errors are thrown**. The function uses graceful fallback:

| Scenario | Behavior |
|----------|----------|
| `process.execPath` unavailable | Impossible in normal Node.js runtime; would crash Node.js itself |
| npm/npx not found in node directory | Return original command (e.g., `"npm"`), let system PATH resolve it |
| Filesystem error during `existsSync` | Return original command (graceful fallback) |
| Invalid input (empty string, null) | Not validated (caller responsibility via TypeScript types) |

## Side Effects

### Logging

The function logs command resolution for debugging purposes:

```typescript
if (resolvedCommand !== command) {
  console.log(`[INFO] Resolved '${command}' to '${resolvedCommand}'`);
}
```

**Log Examples**:
```
[INFO] Resolved 'node' to '/usr/local/bin/node'
[INFO] Resolved 'npm' to '/usr/local/bin/npm'
```

**No logging if command is unchanged** (avoids noise for non-node commands).

### Filesystem Access

- **Read-only access**: Uses `fs.existsSync()` to check if npm/npx exists
- **Frequency**: Called once per child server at startup (low frequency)
- **Performance**: Synchronous filesystem check (~0.1ms per call)

## Dependencies

### Node.js Built-in Modules

- `path`: For `dirname()`, `join()`, `isAbsolute()`
- `fs`: For `existsSync()`
- `process`: For `execPath` and `platform`

**No external dependencies required**.

## Testing Contract

### Unit Tests

Must verify:
- ✅ `"node"` always resolves to `process.execPath`
- ✅ `"npm"` resolves to same directory as node (if exists)
- ✅ `"npm"` falls back to original command (if not found)
- ✅ `"npx"` follows same pattern as npm
- ✅ Absolute paths remain unchanged
- ✅ Non-node commands remain unchanged
- ✅ Windows `.cmd` extension is checked
- ✅ Logging occurs only when resolution happens

### Integration Tests

Must verify:
- ✅ Child server spawns successfully with resolved "node" command
- ✅ Child server spawns successfully even when PATH doesn't include node
- ✅ Existing child servers (non-node commands) are unaffected

## Backward Compatibility

**100% backward compatible**:
- Existing configurations continue to work without modification
- Command resolution is transparent to users
- If resolution fails, fallback to original behavior (PATH-based spawn)
- No breaking changes to `ServerConfig` interface

## Future Extensions (Out of Scope)

- Configuration option to disable resolution: Not needed (resolution is always safe)
- Version validation: Not needed (version consistency is guaranteed by using parent's node)
- Support for other runtimes (Deno, Bun): Would require separate resolution logic

## Summary

The `resolveCommand()` function is a **pure, synchronous transformation** that:
1. Takes a command string
2. Resolves node-related commands to absolute paths when safe
3. Falls back gracefully to original command if resolution isn't possible
4. Never throws errors
5. Logs resolution for debugging
6. Maintains 100% backward compatibility

**Next Phase**: Generate quickstart.md and update agent context

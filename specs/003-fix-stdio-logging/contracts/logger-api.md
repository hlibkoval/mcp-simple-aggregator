# Logger Module API Contract

**Feature**: 003-fix-stdio-logging
**Module**: `src/logger.ts`
**Version**: 1.0.0

## Overview

The logger module provides conditional logging capabilities with file-based output for debug mode. This contract defines the public API that other modules depend on.

## Exported Functions

### `setDebugMode(enabled: boolean): void`

**Purpose**: Enable or disable debug logging globally.

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `enabled` | `boolean` | Yes | Whether to enable debug logging |

**Returns**: `void`

**Side Effects**:
- Updates global `debugEnabled` flag
- Affects subsequent calls to `logInfo()` and `logDebug()`

**Behavior**:
- When `enabled = true`: `logInfo()` and `logDebug()` become active
- When `enabled = false`: `logInfo()` and `logDebug()` are no-ops
- `logError()` is always active regardless of this setting

**Example**:
```typescript
import { setDebugMode } from './logger.js';

setDebugMode(true);  // Enable debug logging
```

---

### `setLogFile(filePath: string): void`

**Purpose**: Configure file-based logging output destination.

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | Yes | Absolute or relative path to log file |

**Returns**: `void`

**Side Effects**:
- Creates `WriteStream` to specified file (append mode)
- Registers error handler for stream failures
- All subsequent log calls write to this file instead of console

**Behavior**:
- Opens file in append mode (`flags: 'a'`)
- If file creation fails, silently continues (no exception thrown)
- If stream emits error during write, error is ignored (non-blocking)
- Relative paths resolved against current working directory

**Error Handling**:
- **File creation failure**: Silent no-op, logging disabled
- **Permission denied**: Silent no-op
- **Disk full**: Stream error ignored, logging continues without output

**Example**:
```typescript
import { setLogFile } from './logger.js';

setLogFile('/tmp/my-debug.log');  // Logs will append to this file
```

**Constraints**:
- MUST be called after `setDebugMode(true)` for logging to occur
- Only one log file active at a time (no multi-target logging)
- Stream is never explicitly closed (process exit handles cleanup)

---

### `isDebugEnabled(): boolean`

**Purpose**: Check if debug mode is currently enabled.

**Parameters**: None

**Returns**: `boolean` - `true` if debug mode is enabled, `false` otherwise

**Side Effects**: None (pure function)

**Example**:
```typescript
import { isDebugEnabled } from './logger.js';

if (isDebugEnabled()) {
  // Perform expensive debug computation
}
```

---

### `logInfo(message: string, ...args: unknown[]): void`

**Purpose**: Log informational message (only when debug enabled).

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `string` | Yes | Primary log message |
| `...args` | `unknown[]` | No | Additional context to log |

**Returns**: `void`

**Side Effects**:
- Writes to log file if `debugEnabled === true` and `logStream` exists
- No-op if debug disabled or no log file configured
- **NEVER writes to console** (prevents stdio pollution)

**Behavior**:
- Format: `{timestamp} [INFO] {message} {args}`
- Timestamp in ISO 8601 format
- Args joined with spaces, stringified if objects

**Example**:
```typescript
import { logInfo } from './logger.js';

logInfo('Server started', { port: 3000, version: '1.0.0' });
// Output: 2025-11-04T15:18:05.880Z [INFO] Server started { port: 3000, version: '1.0.0' }
```

---

### `logDebug(message: string, ...args: unknown[]): void`

**Purpose**: Log debug-level message (only when debug enabled).

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `string` | Yes | Primary log message |
| `...args` | `unknown[]` | No | Additional context to log |

**Returns**: `void`

**Side Effects**: Same as `logInfo()`

**Behavior**: Identical to `logInfo()` but with `[DEBUG]` level tag

**Example**:
```typescript
import { logDebug } from './logger.js';

logDebug('Processing request', requestId, headers);
// Output: 2025-11-04T15:18:05.881Z [DEBUG] Processing request req-123 {...headers}
```

---

### `logError(message: string, ...args: unknown[]): void`

**Purpose**: Log error message (always active, even when debug disabled).

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `string` | Yes | Primary error message |
| `...args` | `unknown[]` | No | Additional context (error stack, etc.) |

**Returns**: `void`

**Side Effects**:
- Writes to log file if `logStream` exists
- **NEVER writes to console** (prevents stdio pollution)

**Behavior**:
- Format: `{timestamp} [ERROR] {message} {args}`
- Active regardless of `debugEnabled` state
- Only differs from `logInfo()` in level tag and unconditional execution

**Example**:
```typescript
import { logError } from './logger.js';

logError('Failed to connect to database', error.message, error.stack);
// Output: 2025-11-04T15:18:05.882Z [ERROR] Failed to connect to database Connection refused ...
```

**Special Case**: Fatal errors before transport initialization
- If called before `setLogFile()`, error is silently dropped
- For pre-transport fatal errors, use `console.error()` directly (acceptable exception)

---

## Usage Patterns

### Typical Setup (index.ts)

```typescript
import { setDebugMode, setLogFile } from './logger.js';

// Parse CLI args
const args = parseArgs();

// Configure logger
setDebugMode(args.debug || false);

if (args.debug) {
  const logPath = args.logFile || `/tmp/mcp-aggregator-${process.pid}.log`;
  setLogFile(logPath);
}

// Now logging calls will work correctly
logInfo('Application starting...');
```

### Module Usage (child-manager.ts)

```typescript
import { logInfo, logDebug, logError } from './logger.js';

export async function initializeChild(config: ServerConfig) {
  logDebug('Initializing child server', config.key);

  try {
    const client = await connectToChild(config);
    logInfo('Child server initialized', config.key);
    return client;
  } catch (error) {
    logError('Failed to initialize child', config.key, error);
    throw error;
  }
}
```

## Backward Compatibility

This contract represents breaking changes from the previous implementation:

| Change | Old Behavior | New Behavior | Impact |
|--------|-------------|--------------|--------|
| **Console output** | `console.error()` always called | No console output (file only) | ✅ REQUIRED - fixes stdio pollution |
| **Debug mode** | Defaults to false | Still defaults to false | ✅ No impact |
| **New API** | N/A | `setLogFile()` added | ⚠️ Must be called for logging to work |
| **Error handling** | Errors thrown | Errors silently caught | ✅ Improves stability |

## Testing Contract

### Unit Test Requirements

1. **Test `setDebugMode()`**:
   - Verify `isDebugEnabled()` returns correct value
   - Verify `logInfo()` respects debug mode

2. **Test `setLogFile()`**:
   - Verify WriteStream is created
   - Verify error handler registered
   - Verify invalid path doesn't throw

3. **Test `logInfo()/logDebug()`**:
   - Verify output when debug enabled + file set
   - Verify no-op when debug disabled
   - Verify no console output ever

4. **Test `logError()`**:
   - Verify always logs (regardless of debug mode)
   - Verify no console output

5. **Test log format**:
   - Verify timestamp format
   - Verify level tags
   - Verify message + args concatenation

### Integration Test Requirements

1. **Stdio cleanliness**:
   - Spawn server without --debug
   - Verify stdout/stderr contain only JSON-RPC
   - No log output anywhere

2. **File logging works**:
   - Spawn server with --debug --log-file
   - Verify file created with expected content
   - Verify stdio still clean

## Constraints

1. **Single log file**: Only one active log destination at a time
2. **No buffering control**: Uses Node.js default WriteStream buffering
3. **Append-only**: No log rotation or size limits
4. **Process-scoped**: Log configuration is global, not per-module
5. **No structured logging**: Plain text format, not JSON

## Future Considerations (Out of Scope)

- Log rotation/compression
- Structured logging (JSON lines)
- Multiple log destinations
- Log level filtering (beyond DEBUG/INFO/ERROR)
- Performance metrics logging

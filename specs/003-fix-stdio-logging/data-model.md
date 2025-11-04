# Data Model: Fix Stdio Logging Protocol Pollution

**Feature**: 003-fix-stdio-logging
**Date**: 2025-11-04

## Overview

This feature has minimal data modeling concerns as it's primarily a behavior fix. The "data" consists of configuration state and log message formatting.

## Entities

### Logger Configuration

**Purpose**: Tracks the logging state and output destination.

**Attributes**:
| Attribute | Type | Description | Validation |
|-----------|------|-------------|------------|
| `debugEnabled` | `boolean` | Whether debug logging is active | Required, defaults to `false` |
| `logStream` | `WriteStream \| null` | File stream for log output | Optional, null when not logging to file |
| `logFilePath` | `string \| null` | Path to log file if specified | Optional, validated as writable path |

**State Transitions**:
```
[Initial] → setDebugMode(true) → [Debug Enabled]
[Debug Enabled] → setLogFile(path) → [File Logging Active]
[File Logging Active] → stream.error → [Fallback: Silent Logging]
```

**Lifecycle**:
1. **Initialization**: `debugEnabled = false`, `logStream = null`
2. **Debug Mode Set**: `setDebugMode(true)` called from CLI arg parsing
3. **File Stream Created**: `setLogFile(path)` called if --log-file provided
4. **Logging Active**: Subsequent `logInfo()`/`logDebug()` write to stream
5. **Error Handling**: Stream errors caught but don't propagate

---

### Log Message

**Purpose**: Structure of individual log entries written to file.

**Attributes**:
| Attribute | Type | Description | Format |
|-----------|------|-------------|--------|
| `timestamp` | `string` | ISO 8601 timestamp | `2025-11-04T15:18:05.880Z` |
| `level` | `'INFO' \| 'DEBUG' \| 'ERROR'` | Log severity | Uppercase string |
| `message` | `string` | Primary log message | Free text |
| `context` | `unknown[]` | Additional arguments | Stringified via `JSON.stringify()` or `.toString()` |

**Format**:
```
{timestamp} [{level}] {message} {context}
```

**Example**:
```
2025-11-04T15:18:05.880Z [INFO] Child server initialized: filesystem
2025-11-04T15:18:05.881Z [DEBUG] Tool registry size: 15
```

**Validation Rules**:
- Timestamp MUST be valid ISO 8601 format
- Level MUST be one of INFO, DEBUG, ERROR
- Message MUST be non-empty string
- Context MAY be empty array

---

### CLI Arguments

**Purpose**: Configuration passed from command line to control logging behavior.

**Attributes**:
| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--debug` | `boolean` | `false` | Enable debug logging |
| `--log-file` | `string` | `/tmp/mcp-aggregator-${pid}.log` | Path to debug log file |

**Validation Rules**:
- `--log-file` only used if `--debug` is true
- If `--log-file` is relative path, resolve against CWD
- If `--log-file` creation fails, silent fallback (no crash)

**Relationships**:
```
--debug=true → setDebugMode(true) → enables logging
--log-file=path → setLogFile(path) → creates WriteStream
```

---

## Data Flow

```
┌─────────────┐
│ CLI Args    │
│ --debug     │
│ --log-file  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ index.ts    │
│ parseArgs() │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ logger.ts   │
│ setDebug()  │
│ setLogFile()│
└──────┬──────┘
       │
       ▼
┌─────────────┐       ┌─────────────┐
│ logInfo()   │──────▶│ WriteStream │──────▶ File
│ logDebug()  │       │ (async I/O) │
│ logError()  │       └─────────────┘
└─────────────┘
       │
       │ (if no stream)
       ▼
   [silent no-op]
```

## Non-Entities (What This Feature Doesn't Store)

- **No log history**: Logs are not retained in memory, only streamed to disk
- **No log rotation**: Files are append-only, no automatic rotation/cleanup
- **No structured metadata**: Simple text format, not JSON (for human readability)
- **No log levels filtering**: If debug is on, all levels (INFO, DEBUG, ERROR) are written

## Assumptions

1. **Single log destination**: Only one log file at a time, no multi-target logging
2. **No async initialization**: `setLogFile()` is synchronous, stream creation is immediate
3. **Process lifecycle**: Log stream is never explicitly closed (process exit handles cleanup)
4. **Append mode**: Multiple runs append to same file (until manual cleanup)

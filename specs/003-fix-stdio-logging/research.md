# Research: Fix Stdio Logging Protocol Pollution

**Feature**: 003-fix-stdio-logging
**Date**: 2025-11-04
**Status**: Complete

## Problem Analysis

### Root Cause

The MCP aggregator uses `console.error()` for logging via the logger.ts module. When operating in stdio transport mode, both stdout and stderr must contain **only** valid JSON-RPC messages. Any non-JSON text (like `[INFO] MCP Aggregator Server started on stdio`) causes JSON parsing errors in strict MCP clients like Claude Desktop.

**Evidence from error logs**:
```
Unexpected token 'I', "[INFO] Erro"... is not valid JSON
Unexpected token 'A', "Aggregator"... is not valid JSON
Unexpected token 'S', "Serving 1 "... is not valid JSON
```

These correspond to the three `logInfo()` calls in:
- `src/server.ts:146` - "[INFO] MCP Aggregator Server started on stdio"
- `src/index.ts:177` - "Aggregator server started successfully"
- `src/index.ts:178` - "Serving ${children.size} child servers with ${registry.size} tools"

### Current Logging Architecture

**src/logger.ts** provides three functions:
- `logInfo(message, ...args)` - Only logs when `debugEnabled === true`
- `logDebug(message, ...args)` - Only logs when `debugEnabled === true`
- `logError(message, ...args)` - Always logs (unconditional)

All three use `console.error()` to write to stderr, which is correct for CLI tools but **incompatible with MCP stdio transport** where stderr must also be JSON-RPC only.

## Solution Research

### Decision: File-Based Logging for Debug Mode

**Chosen Approach**: When `--debug` flag is enabled, redirect all logging to a file stream instead of console.

**Rationale**:
1. **Complete stdio isolation**: No console output at all when logging is active
2. **Standard Node.js patterns**: Use `fs.createWriteStream()` for async, non-blocking writes
3. **No external dependencies**: Built-in Node.js `fs` module
4. **Simple implementation**: ~30 LOC modification to logger.ts
5. **Zero impact on JSON-RPC**: File I/O is completely separate from stdio

### Alternatives Considered

| Alternative | Pros | Cons | Rejected Because |
|-------------|------|------|------------------|
| **A. Structured logging to stderr** | Industry standard (JSON logs) | Still pollutes stderr with non-JSON-RPC content | Doesn't solve the fundamental problem - stderr must be JSON-RPC only |
| **B. Logging via MCP notifications** | Uses protocol correctly | Requires client support, not all clients handle notifications | Overcomplicates debugging, most clients ignore notifications |
| **C. Disable logging entirely** | Simplest solution | No troubleshooting capability | Removes critical debugging tool for developers |
| **D. Separate logging process via IPC** | Complete isolation | Complex architecture, adds process management | Violates Principle V (Simplicity), over-engineered for bug fix |

### Implementation Pattern: File Stream Logging

**Node.js fs.createWriteStream() API**:
```typescript
import { createWriteStream, WriteStream } from 'fs';

let logStream: WriteStream | null = null;

export function setLogFile(path: string): void {
  logStream = createWriteStream(path, { flags: 'a' }); // append mode
  logStream.on('error', (err) => {
    // Fallback: if file write fails, fail silently (don't pollute stdio)
  });
}

export function logInfo(message: string, ...args: unknown[]): void {
  if (!debugEnabled) return;

  if (logStream) {
    const formatted = `${new Date().toISOString()} [INFO] ${message} ${args.join(' ')}\n`;
    logStream.write(formatted);
  }
  // No console.error fallback - stdio must stay clean
}
```

**Key Design Choices**:
1. **Append mode (`flags: 'a'`)**: Preserve logs across multiple runs for debugging sessions
2. **Silent error handling**: If log file creation fails, continue without logging (don't crash server)
3. **Timestamp prefix**: Include ISO timestamps for log correlation
4. **No buffer flushing**: Let Node.js handle buffering (non-blocking writes)

### CLI Argument Pattern

**--log-file option**:
```typescript
// src/index.ts CLI arg parsing
{
  '--debug': Boolean,
  '--log-file': String,  // New option
  // ...existing options
}
```

**Default log path** (if --debug without --log-file):
- **Option 1**: `/tmp/mcp-aggregator-${pid}.log` (Unix/Mac)
- **Option 2**: `~/.mcp-aggregator/debug.log` (persistent across runs)
- **Chosen**: `/tmp/mcp-aggregator-${pid}.log` - Simple, automatic cleanup, no file accumulation

**Rationale**: Temporary files are appropriate for debug logs. Using PID ensures multiple instances don't conflict.

### Edge Case Handling

| Edge Case | Behavior | Rationale |
|-----------|----------|-----------|
| **Log file creation fails (permissions)** | Silent failure, continue without logging | Don't break server startup due to logging issue |
| **Disk full during write** | WriteStream emits 'error', we ignore it | Logging is non-critical, server continues |
| **--debug without --log-file** | Use default `/tmp/mcp-aggregator-${process.pid}.log` | Sensible default, no user input required |
| **--log-file points to directory** | Creation fails, silent fallback | Node.js will throw EISDIR, caught by error handler |
| **Fatal error before transport connected** | Allow `console.error()` for fatal errors | User needs to see why server failed to start |

### Testing Strategy

**Unit Tests** (tests/unit/logger.test.ts):
1. `setLogFile()` creates WriteStream correctly
2. `logInfo()` writes to file when debug enabled
3. `logInfo()` does nothing when debug disabled
4. File write errors don't throw exceptions
5. Log format includes timestamp and level

**Integration Tests** (tests/integration/stdio-clean.test.ts):
1. Spawn aggregator without --debug
2. Verify stdout contains only JSON-RPC messages
3. Verify stderr contains only JSON-RPC messages
4. Spawn aggregator with --debug --log-file
5. Verify stdio is clean AND log file contains expected entries

### Performance Considerations

**File I/O Impact**: Negligible
- WriteStream is async/non-blocking
- Logs only written in debug mode (not production)
- Buffer size defaults to 64KB (Node.js default)
- No impact on JSON-RPC message throughput

**Memory Impact**: Minimal
- Single WriteStream instance (~8KB overhead)
- No log buffering in memory (streams directly to disk)

## References

- **Node.js fs.createWriteStream()**: https://nodejs.org/api/fs.html#fscreatewritestreampath-options
- **MCP Stdio Transport**: https://spec.modelcontextprotocol.io/specification/basic/transports/#stdio
- **Vitest Testing**: https://vitest.dev/guide/

## Open Questions

**None** - All technical decisions made, ready for Phase 1 design.

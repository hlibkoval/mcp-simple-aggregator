# Quickstart: Fix Stdio Logging Protocol Pollution

**Feature**: 003-fix-stdio-logging
**Target Audience**: Developers implementing this feature
**Estimated Time**: 2-3 hours

## Overview

This guide walks you through implementing file-based logging to fix JSON-RPC protocol pollution in the MCP aggregator's stdio transport.

**Goal**: Ensure no console output pollutes stdout/stderr when running in MCP stdio mode.

## Prerequisites

- Node.js 18+ installed
- TypeScript 5.3+ configured
- Vitest test runner set up
- Familiarity with Node.js fs.WriteStream API

## Implementation Steps

### Step 1: Modify logger.ts (30 minutes)

**File**: `src/logger.ts`

**Current State**:
```typescript
let debugEnabled = false;

export function logInfo(message: string, ...args: unknown[]): void {
  if (debugEnabled) {
    console.error(message, ...args);  // ❌ This pollutes stderr
  }
}
```

**Target State**:
```typescript
import { createWriteStream, WriteStream } from 'fs';

let debugEnabled = false;
let logStream: WriteStream | null = null;

export function setLogFile(filePath: string): void {
  logStream = createWriteStream(filePath, { flags: 'a' });
  logStream.on('error', (err) => {
    // Silent fallback - don't crash server if logging fails
  });
}

export function logInfo(message: string, ...args: unknown[]): void {
  if (!debugEnabled || !logStream) return;

  const timestamp = new Date().toISOString();
  const formatted = `${timestamp} [INFO] ${message} ${args.map(String).join(' ')}\n`;
  logStream.write(formatted);
}
```

**Key Changes**:
1. Add `logStream: WriteStream | null` variable
2. Implement `setLogFile(filePath)` function
3. Replace `console.error()` with `logStream.write()` in all log functions
4. Add timestamp and level formatting
5. Add error handler for stream failures

**Apply to**: `logInfo()`, `logDebug()`, `logError()`

---

### Step 2: Update CLI Argument Parsing (15 minutes)

**File**: `src/index.ts`

**Add to argument schema** (around line 30):
```typescript
const argSchema = {
  '--config': String,
  '--debug': Boolean,
  '--log-file': String,  // ← Add this
  '--name': String,
  '--version': String,
  '--help': Boolean,
  // ...existing args
};
```

**Add log file setup** (around line 127, after `setDebugMode`):
```typescript
setDebugMode(args.debug || false);

// NEW: Configure file logging if debug enabled
if (args.debug) {
  const logPath = args['log-file'] || `/tmp/mcp-aggregator-${process.pid}.log`;
  setLogFile(logPath);
  logDebug(`Logging to file: ${logPath}`);
}
```

---

### Step 3: Remove Startup Info Logs (10 minutes)

**File**: `src/index.ts`

**Remove these lines** (around lines 177-178):
```typescript
logInfo('Aggregator server started successfully');  // ← Remove
logInfo(`Serving ${children.size} child servers with ${registry.size} tools`);  // ← Remove
```

**Rationale**: These are cosmetic and not needed for operation. Server readiness is communicated via JSON-RPC initialize response.

**File**: `src/server.ts`

**Remove this line** (line 146):
```typescript
logInfo('[INFO] MCP Aggregator Server started on stdio');  // ← Remove
```

---

### Step 4: Write Unit Tests (45 minutes)

**File**: `tests/unit/logger.test.ts` (create new file)

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setDebugMode, setLogFile, logInfo, isDebugEnabled } from '../../src/logger.js';
import { readFileSync, unlinkSync, existsSync } from 'fs';

describe('Logger', () => {
  const testLogPath = '/tmp/test-logger.log';

  beforeEach(() => {
    setDebugMode(false);
    if (existsSync(testLogPath)) {
      unlinkSync(testLogPath);
    }
  });

  afterEach(() => {
    if (existsSync(testLogPath)) {
      unlinkSync(testLogPath);
    }
  });

  it('should not log when debug disabled', () => {
    setDebugMode(false);
    setLogFile(testLogPath);
    logInfo('test message');

    expect(existsSync(testLogPath)).toBe(false);
  });

  it('should log to file when debug enabled', () => {
    setDebugMode(true);
    setLogFile(testLogPath);
    logInfo('test message', 'arg1', 'arg2');

    // Give stream time to flush
    setTimeout(() => {
      const content = readFileSync(testLogPath, 'utf-8');
      expect(content).toContain('[INFO] test message arg1 arg2');
      expect(content).toMatch(/^\d{4}-\d{2}-\d{2}T/);  // ISO timestamp
    }, 100);
  });

  it('should handle file creation errors silently', () => {
    setDebugMode(true);
    setLogFile('/invalid/path/that/does/not/exist.log');

    // Should not throw
    expect(() => logInfo('test')).not.toThrow();
  });
});
```

**Test Coverage Goals**:
- ✅ Debug mode controls logging
- ✅ File stream creation
- ✅ Log format (timestamp + level + message)
- ✅ Error handling (invalid paths)
- ✅ No console output

---

### Step 5: Write Integration Test (30 minutes)

**File**: `tests/integration/stdio-clean.test.ts` (create new file)

```typescript
import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { resolve } from 'path';

describe('Stdio Cleanliness', () => {
  const serverPath = resolve(__dirname, '../../dist/index.js');

  it('should produce only JSON-RPC on stdout/stderr without --debug', async () => {
    const child = spawn('node', [serverPath, '--config', './test-config.json'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Every line should be valid JSON-RPC
    const stdoutLines = stdout.split('\n').filter((l) => l.trim());
    const stderrLines = stderr.split('\n').filter((l) => l.trim());

    for (const line of stdoutLines) {
      const parsed = JSON.parse(line);  // Should not throw
      expect(parsed).toHaveProperty('jsonrpc', '2.0');
    }

    for (const line of stderrLines) {
      if (line.trim()) {
        const parsed = JSON.parse(line);  // Should not throw
        expect(parsed).toHaveProperty('jsonrpc', '2.0');
      }
    }

    child.kill();
  }, 10000);

  it('should write debug logs to file when --debug enabled', async () => {
    const logPath = '/tmp/test-stdio-debug.log';
    const child = spawn('node', [
      serverPath,
      '--config', './test-config.json',
      '--debug',
      '--log-file', logPath
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to start and log
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify log file exists and has content
    const { existsSync, readFileSync } = await import('fs');
    expect(existsSync(logPath)).toBe(true);

    const logContent = readFileSync(logPath, 'utf-8');
    expect(logContent).toContain('[DEBUG]');
    expect(logContent).toMatch(/\d{4}-\d{2}-\d{2}T/);  // Has timestamps

    child.kill();
  }, 10000);
});
```

**Test Coverage Goals**:
- ✅ No non-JSON-RPC output on stdio in normal mode
- ✅ Debug logs go to file, not stdio
- ✅ Server continues working correctly

---

### Step 6: Update Documentation (15 minutes)

**File**: `CLAUDE.md`

Add to "Build, Test, and Lint" section:
```markdown
**Debug Logging**:
```bash
npm run build
node dist/index.js --debug --log-file /tmp/debug.log
# Logs written to /tmp/debug.log, stdio remains clean
```

**File**: `README.md` (if applicable)

Add CLI options documentation:
```markdown
### CLI Options

- `--config <path>`: Path to MCP config file (required)
- `--debug`: Enable debug logging to file (default: false)
- `--log-file <path>`: Debug log file path (default: /tmp/mcp-aggregator-{pid}.log)
```

---

### Step 7: Run Tests and Verify (15 minutes)

```bash
# Build the project
npm run build

# Run unit tests
npm test -- logger.test.ts

# Run integration tests
npm test -- stdio-clean.test.ts

# Run all tests with coverage
npm run test:coverage

# Verify coverage ≥80% for logger.ts
cat coverage/coverage-summary.json | grep logger
```

**Expected Results**:
- ✅ All tests pass
- ✅ Coverage ≥80% for modified files
- ✅ No console output during test runs
- ✅ TypeScript compilation has no errors

---

## Verification Checklist

Before marking complete:

- [ ] `src/logger.ts` uses WriteStream instead of console
- [ ] `setLogFile()` function implemented with error handling
- [ ] CLI accepts `--log-file` option
- [ ] Startup info logs removed from index.ts and server.ts
- [ ] Unit tests pass (logger.test.ts)
- [ ] Integration tests pass (stdio-clean.test.ts)
- [ ] Test coverage ≥80%
- [ ] TypeScript compilation successful (no errors)
- [ ] Documentation updated (CLAUDE.md, README.md)
- [ ] Manual testing: run with Claude Desktop, no JSON errors

---

## Manual Testing

### Test 1: Normal Mode (No Debug)

```bash
npm run build
node dist/index.js --config ~/.mcp-aggregator.json
```

**Expected**: No console output, only JSON-RPC messages if stdio is monitored.

### Test 2: Debug Mode with File Logging

```bash
npm run build
node dist/index.js --config ~/.mcp-aggregator.json --debug --log-file /tmp/debug.log
cat /tmp/debug.log
```

**Expected**: Log file contains timestamped debug messages, stdio still clean.

### Test 3: Claude Desktop Integration

1. Configure Claude Desktop to use the built aggregator
2. Restart Claude Desktop
3. Check Claude Desktop logs for JSON parsing errors

**Expected**: No `Unexpected token` errors, all tools list correctly.

---

## Troubleshooting

**Issue**: Log file not created

- **Check**: File path permissions, parent directory exists
- **Fix**: Use absolute path or ensure CWD is correct

**Issue**: Tests fail with "file not found"

- **Check**: Build before running tests (`npm run build`)
- **Fix**: Run `npm run build && npm test`

**Issue**: Coverage below 80%

- **Check**: All branches tested (debug on/off, file exists/not exists)
- **Fix**: Add missing test cases

---

## Estimated Timeline

| Step | Time | Cumulative |
|------|------|------------|
| 1. Modify logger.ts | 30 min | 30 min |
| 2. Update CLI parsing | 15 min | 45 min |
| 3. Remove startup logs | 10 min | 55 min |
| 4. Write unit tests | 45 min | 1h 40min |
| 5. Write integration tests | 30 min | 2h 10min |
| 6. Update documentation | 15 min | 2h 25min |
| 7. Run tests and verify | 15 min | 2h 40min |

**Total**: ~2.5-3 hours for a developer familiar with the codebase.

---

## Next Steps

After completing this implementation:

1. Create pull request with changes
2. Request code review from maintainer
3. Address review feedback
4. Merge to main branch
5. Tag release (patch version bump)
6. Update CHANGELOG.md

See [plan.md](./plan.md) for full design context and [tasks.md](./tasks.md) for detailed task breakdown.

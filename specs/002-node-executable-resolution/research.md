# Research: Node Executable Resolution

**Date**: 2025-11-04
**Phase**: 0 (Research & Technical Decisions)
**Feature**: 002-node-executable-resolution

## Research Findings

### 1. Node.js process.execPath Behavior Across Platforms

**Decision**: Use `process.execPath` directly for "node" command resolution

**Rationale**:
- `process.execPath` returns the absolute pathname of the Node.js executable that started the current process
- Always available in Node.js runtime (guaranteed by Node.js specification)
- Handles symlinks by resolving to the actual executable location
- Cross-platform compatible (works on Windows, macOS, Linux)

**Platform-Specific Behaviors**:

| Platform | process.execPath Example | Notes |
|----------|--------------------------|-------|
| macOS    | `/usr/local/bin/node` or `/Users/user/.nvm/versions/node/v18.0.0/bin/node` | May include version path if using nvm |
| Linux    | `/usr/bin/node` or `/home/user/.nvm/versions/node/v18.0.0/bin/node` | Standard package managers use /usr/bin |
| Windows  | `C:\Program Files\nodejs\node.exe` or `C:\Users\user\AppData\Roaming\nvm\v18.0.0\node.exe` | Always includes .exe extension |

**Symlink Handling**:
- `process.execPath` returns the resolved path (follows symlinks to actual executable)
- Example: If `/usr/local/bin/node` → `/usr/local/Cellar/node/18.0.0/bin/node`, `process.execPath` returns the resolved path
- This is desirable for our use case (ensures consistent node version)

**Reliability**:
- `process.execPath` is NEVER undefined or unavailable in normal Node.js environments
- Only scenario where it might be unusual: Custom Node.js builds or embedded V8
- For our use case (npm package), this is not a concern

**Alternatives Considered**:
- `which node` shell command: Rejected (requires shell execution, cross-platform issues, PATH-dependent)
- `process.argv[0]`: Rejected (may be relative path, not guaranteed to be node executable)

### 2. npm/npx Executable Location Patterns

**Decision**: Check for npm/npx in `dirname(process.execPath)` with platform-specific extensions

**Rationale**:
- npm and npx are typically installed alongside node in the same directory
- Standard Node.js installation bundles npm with node
- Simpler than PATH searching or external "which" commands

**Standard Installation Patterns**:

| Installation Method | node Location | npm/npx Location | Notes |
|---------------------|---------------|------------------|-------|
| Official installer (macOS/Linux) | `/usr/local/bin/node` | `/usr/local/bin/npm` `/usr/local/bin/npx` | Same directory |
| nvm (macOS/Linux) | `~/.nvm/versions/node/v18.0.0/bin/node` | `~/.nvm/versions/node/v18.0.0/bin/npm` | Version-specific directory |
| Official installer (Windows) | `C:\Program Files\nodejs\node.exe` | `C:\Program Files\nodejs\npm.cmd` `C:\Program Files\nodejs\npx.cmd` | Windows uses .cmd wrappers |
| fnm (Fast Node Manager) | `~/.local/share/fnm/node-versions/v18.0.0/installation/bin/node` | `~/.local/share/fnm/node-versions/v18.0.0/installation/bin/npm` | Same pattern as nvm |

**Windows Executable Extensions**:
- npm on Windows: `npm.cmd` (primary), `npm.ps1` (PowerShell), `npm` (bash shell script)
- npx on Windows: `npx.cmd` (primary), `npx.ps1` (PowerShell), `npx` (bash shell script)
- Check order: `.cmd` first (most common), then no extension (works in Git Bash/WSL)

**Edge Cases**:
- npm installed separately (e.g., `npm install -g npm@latest`): Still in same directory as node
- Standalone npm installer (rare): Would not be in node directory, fallback to original "npm" command (PATH resolution)
- Node.js installed without npm (custom build): Fallback to original command

**Implementation Strategy**:
```typescript
// Pseudocode
if (command === 'npm' || command === 'npx') {
  const nodeDir = path.dirname(process.execPath);

  // Windows: Check for .cmd extension first
  if (process.platform === 'win32') {
    const cmdPath = path.join(nodeDir, `${command}.cmd`);
    if (fs.existsSync(cmdPath)) return cmdPath;
  }

  // Unix or Windows fallback: No extension
  const unixPath = path.join(nodeDir, command);
  if (fs.existsSync(unixPath)) return unixPath;

  // Fallback: Use original command (rely on PATH)
  return command;
}
```

**Alternatives Considered**:
- `which npm`/`where npm`: Rejected (requires shell execution, async complexity)
- Hard-coded global npm path: Rejected (not portable, breaks with nvm/fnm)
- External dependency (e.g., `which` package): Rejected (adds dependency, overkill for simple check)

### 3. Path Resolution Best Practices

**Decision**: Use Node.js built-in `path` module with `fs.existsSync` for checks

**Rationale**:
- `path.dirname()`: Extracts directory from `process.execPath`
- `path.join()`: Safely joins paths with correct separator for platform
- `fs.existsSync()`: Synchronous file existence check (acceptable for startup-time operation)

**API Choices**:

| API | Use Case | Rationale |
|-----|----------|-----------|
| `path.dirname(process.execPath)` | Get node installation directory | Standard Node.js API, handles all platforms |
| `path.join(dir, file)` | Construct npm/npx paths | Automatically uses correct separator (/ or \) |
| `path.isAbsolute(command)` | Detect absolute paths in config | Prevents double-resolution of absolute paths |
| `fs.existsSync(path)` | Check if npm/npx exists | Synchronous is acceptable (runs once per child at startup) |

**Cross-Platform Path Separators**:
- Windows: `\` (backslash) or `/` (forward slash, also supported)
- Unix (macOS, Linux): `/` (forward slash)
- `path.join()` handles this automatically
- Never manually concatenate paths with `+` or string templates

**Alternatives Considered**:
- `fs.access()` (async): Rejected (adds complexity, no benefit for startup-time check)
- `fs.statSync()`: Rejected (existsSync is simpler and sufficient)

### 4. Logging Best Practices for Command Resolution

**Decision**: Use `console.log` with `[INFO]` prefix for command resolution

**Rationale**:
- Existing codebase uses `console.log` and `console.error` (no logging framework)
- Consistent with patterns in `child-manager.ts` (lines 140, 143, 159)
- Resolution logging is informational, not error or debug

**Logging Strategy**:

| Log Level | Use Case | Example |
|-----------|----------|---------|
| `console.log` with `[INFO]` | Command resolution occurred | `[INFO] Resolved 'node' command to '/usr/local/bin/node'` |
| `console.log` (no prefix) | Standard startup messages | `Starting child server 'serverKey'...` (existing pattern) |
| `console.error` | Errors only | `[ERROR] Child server 'x' crashed: ...` (existing pattern) |

**What to Log**:
- Original command from config
- Resolved path (if different from original)
- Only log when resolution actually happens (not for every command)

**Example Log Output**:
```
Starting child server 'sourcebot'...
[INFO] Resolved 'node' command to '/usr/local/bin/node' for child server 'sourcebot'
Child server 'sourcebot' started successfully
```

**Alternatives Considered**:
- Winston/Bunyan logging framework: Rejected (overkill for this codebase, adds dependency)
- Debug module: Rejected (not used in existing codebase, inconsistent)
- Verbose flag for logging: Deferred (not required for MVP, can add later if needed)

## Implementation Decisions Summary

### Technical Choices

1. **Command Resolution Function Signature**:
   ```typescript
   function resolveCommand(command: string): string
   ```
   - Pure function (no side effects except logging)
   - Synchronous (acceptable for startup-time operation)
   - Returns original command if no resolution needed

2. **Resolution Logic**:
   - "node" → `process.execPath` (always)
   - "npm"/"npx" → Check `dirname(process.execPath)` with platform extensions
   - Absolute paths → No change (already resolved)
   - All other commands → No change (use system PATH)

3. **Platform Compatibility**:
   - Windows: Check `.cmd` extension for npm/npx
   - Unix: No extension needed
   - Both: Use `path.join()` for correct separator

4. **Error Handling**:
   - No errors thrown (graceful fallback to original command)
   - Log resolution for visibility
   - Existing ENOENT error messages remain unchanged (if fallback fails)

5. **Testing Strategy**:
   - Unit tests: Mock `process.execPath`, test all resolution paths
   - Integration tests: Spawn real child server with resolved command
   - Cross-platform tests: Test Windows .cmd extension logic

### Dependencies

**No new dependencies required**:
- `path`: Node.js built-in
- `fs`: Node.js built-in
- `process`: Node.js built-in

### Performance Impact

- Command resolution: ~0.1ms (single `fs.existsSync` call)
- Logging: ~0.01ms (console.log is fast)
- Total overhead: <1ms per child server (acceptable)

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| npm/npx not in same directory as node | Low | Low | Fallback to original command (PATH resolution) |
| process.execPath unavailable | Very Low | High | Would break Node.js itself; not a concern |
| Windows .cmd extension missing | Low | Medium | Fallback to extensionless check, then original command |
| Symlink edge cases | Low | Low | process.execPath already resolves symlinks |

## Next Phase: Design & Contracts

All research complete. Proceed to Phase 1:
- Generate data-model.md (minimal - just types)
- Generate contracts/command-resolution.md (function contract)
- Generate quickstart.md (user documentation)
- Update CLAUDE.md via agent context script

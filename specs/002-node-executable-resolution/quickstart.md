# Quick Start: Node Executable Resolution

**Feature**: Automatic Command Resolution for Node-based Child Servers
**Version**: 002-node-executable-resolution
**Date**: 2025-11-04

## Overview

The MCP Simple Aggregator now automatically resolves `"node"`, `"npm"`, and `"npx"` commands to absolute paths, preventing "spawn ENOENT" errors in environments where these executables are not in the PATH environment variable.

**What this means for you**:
- Child servers with `command: "node"` will always spawn successfully
- No configuration changes needed - resolution is automatic
- Works across all platforms (Windows, macOS, Linux)
- Version consistency guaranteed (child uses same Node.js as parent)

## How It Works

### Automatic Resolution

When you configure a child server with `command: "node"`, `command: "npm"`, or `command: "npx"`, the aggregator automatically resolves these to absolute paths:

| Original Command | Resolved To | Notes |
|-----------------|-------------|-------|
| `"node"` | Parent's `process.execPath` | Always resolved (e.g., `/usr/local/bin/node`) |
| `"npm"` | Same directory as parent's node | If exists (e.g., `/usr/local/bin/npm`) |
| `"npx"` | Same directory as parent's node | If exists (e.g., `/usr/local/bin/npx`) |

### Configuration Examples

**Before (might fail with ENOENT)**:
```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["server.js"]
    }
  }
}
```

**After (same config, now works reliably)**:
```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["server.js"]
    }
  }
}
```

**No configuration changes needed!** The aggregator automatically resolves `"node"` to the parent's Node.js executable.

## Verification

### Check Resolution in Logs

When a child server starts, the aggregator logs command resolution:

```
Starting child server 'my-server'...
[INFO] Resolved 'node' to '/usr/local/bin/node' for child server 'my-server'
Child server 'my-server' started successfully
```

**What to look for**:
- `[INFO] Resolved 'X' to 'Y'` indicates automatic resolution occurred
- If you don't see this log, the command was used as-is (already absolute or non-node command)

### Version Consistency

The resolved `node` command is always the same version as the parent aggregator:

```bash
# Check parent node version
node --version
# v18.17.0

# Child servers will use the same version automatically
```

## Advanced Usage

### Override Automatic Resolution

If you need a specific Node.js version for a child server, use an absolute path:

```json
{
  "mcpServers": {
    "legacy-server": {
      "command": "/usr/local/bin/node14",
      "args": ["old-server.js"]
    }
  }
}
```

Absolute paths are **never modified** - the aggregator respects your explicit choice.

### Non-Node Commands

Commands other than `"node"`, `"npm"`, and `"npx"` are unaffected:

```json
{
  "mcpServers": {
    "python-server": {
      "command": "python3",
      "args": ["server.py"]
    }
  }
}
```

This configuration continues to work exactly as before (uses system PATH).

## Platform-Specific Behavior

### Windows

On Windows, the aggregator automatically checks for `.cmd` extensions:

```
[INFO] Resolved 'npm' to 'C:\Program Files\nodejs\npm.cmd'
```

**Windows command extensions**:
- `npm.cmd` (standard)
- `npx.cmd` (standard)
- Fallback to extensionless for Git Bash/WSL compatibility

### macOS / Linux

On Unix-like systems, no extensions are needed:

```
[INFO] Resolved 'npm' to '/usr/local/bin/npm'
```

### Node Version Managers (nvm, fnm)

Works seamlessly with version managers:

```bash
# Using nvm
process.execPath === '/Users/you/.nvm/versions/node/v18.0.0/bin/node'

# Resolved npm path
/Users/you/.nvm/versions/node/v18.0.0/bin/npm
```

Child servers automatically use the **currently active Node.js version**.

## Troubleshooting

### npm/npx Not Found

If npm or npx are not in the same directory as your Node.js installation:

**Logs will show**:
```
Starting child server 'my-server'...
Child server 'my-server' started successfully
```

**No `[INFO] Resolved...` log** means the command was used as-is (fallback to PATH resolution).

**Solution**: Ensure npm is installed:
```bash
# Check if npm exists
which npm  # macOS/Linux
where npm  # Windows

# Install npm if missing
# (npm is bundled with Node.js in standard installations)
```

### Child Server Still Fails with ENOENT

If you still see ENOENT errors after this feature:

1. **Check command spelling** in your config:
   ```json
   "command": "node"  // Correct
   "command": "nod"   // Typo - will fail
   ```

2. **Verify parent Node.js works**:
   ```bash
   node --version
   # Should print version (e.g., v18.17.0)
   ```

3. **Check aggregator logs** for resolution:
   ```
   [INFO] Resolved 'node' to '/path/to/node'
   ```

4. **Test manually** with resolved path:
   ```bash
   # Copy the resolved path from logs
   /usr/local/bin/node server.js
   ```

### Absolute Path Configuration Not Working

If you configured an absolute path but it's not being respected:

**Check for typos**:
```json
// Correct (absolute path)
"command": "/usr/bin/node"

// Incorrect (relative path - will be resolved)
"command": "./node"
```

**Verify path exists**:
```bash
ls -la /usr/bin/node
# Should show the executable
```

## FAQ

### Q: Do I need to change my existing configurations?

**A**: No! Automatic resolution is transparent and backward compatible.

### Q: Will this affect performance?

**A**: Negligible impact (<1ms per child server at startup). Command resolution uses a single synchronous filesystem check.

### Q: Can I disable automatic resolution?

**A**: Not needed - if you want to use a specific path, just configure an absolute path. Automatic resolution only affects commands like `"node"`, `"npm"`, `"npx"`.

### Q: What if I have multiple Node.js versions installed?

**A**: Child servers will use the **same version** that's running the aggregator. To use a different version, configure an absolute path to the specific Node.js executable.

### Q: Does this work with npx?

**A**: Yes! `"npx"` is resolved the same way as `"npm"` (checks in the same directory as the parent's Node.js).

### Q: What about other languages (Python, Ruby, etc.)?

**A**: Not affected. Only `"node"`, `"npm"`, and `"npx"` are automatically resolved. Other commands continue to use system PATH.

## Next Steps

- **No action required** - automatic resolution works out of the box
- Check your aggregator logs to verify resolution is working
- Report any issues at https://github.com/hlibkoval/mcp-simple-aggregator/issues

## Technical Details

For developers interested in the implementation:
- Resolution logic is in `src/child-manager.ts` (`resolveCommand()` function)
- Uses Node.js `process.execPath` for `"node"` command
- Checks `dirname(process.execPath)` for `"npm"` and `"npx"`
- Falls back gracefully if executables not found
- Fully tested with unit and integration tests

---

**Summary**: Automatic command resolution eliminates "spawn ENOENT" errors for node-based child servers while maintaining 100% backward compatibility. No configuration changes needed!

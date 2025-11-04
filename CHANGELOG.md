# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.8] - 2025-11-04

### Added
- Configurable tool name separator via `--separator` CLI argument
  - Allows customizing the separator used for tool namespacing (default: `:`)
  - Supports single-character separators (`.`, `-`, `_`, etc.)
  - Supports multi-character separators (`__`, `::`, `->`, etc.)
  - Examples: `github__create_issue`, `api.get_user`, `db::query`
  - Backward compatible - defaults to `:` when not specified

### Changed
- Tool registry now accepts configurable separator parameter
  - Updated `buildToolRegistry()`, `addServerTools()`, and `removeServerTools()`
  - All functions maintain backward compatibility with default `:` separator
- Tool name parsing updated to support multi-character separators
  - Updated `parseToolPrefix()` to handle separators of any length
  - Tool call routing preserves custom separator format

### Fixed
- Added validation for separator argument
  - Rejects empty string separators with clear error message
  - Rejects separators containing whitespace (space, tab, newline)
  - Validates separator before building tool registry

## [0.0.7] - 2025-11-04

### Added
- File-based debug logging system to prevent JSON-RPC protocol pollution
  - New `--log-file` CLI option (default: `/tmp/mcp-aggregator-{pid}.log`)
  - Lazy file creation - only creates log file when first log occurs
  - Logs written with ISO timestamp format: `{timestamp} [LEVEL] {message}`
  - Supports `[DEBUG]`, `[INFO]`, and `[ERROR]` log levels
  - Zero stdout/stderr output in production mode (clean stdio for MCP protocol)

### Changed
- Debug logging now writes to files instead of stderr
  - Prevents "Unexpected token" JSON parsing errors in Claude Desktop
  - Logs only active when `--debug` flag is enabled
  - Complete stdio isolation for MCP JSON-RPC communication
- Removed startup `logInfo()` calls that could pollute stdio
  - Converted to `logDebug()` calls (file-only output)
  - Server started messages now only in debug log file

### Fixed
- Fixed Claude Desktop integration errors caused by stderr pollution
  - Resolved "Unexpected token 'I', "[INFO] Erro"... is not valid JSON" errors
  - MCP stdio transport now complies with JSON-RPC protocol requirements

## [0.0.6] - 2025-11-04

### Changed
- Conditional logging based on `--debug` flag
  - Info and debug messages now only shown when `--debug` flag is set
  - Error messages always displayed for debugging
  - Cleaner output without verbose logs in normal operation
  - All logs output to stderr to avoid interfering with stdio MCP communication

## [0.0.5] - 2025-11-04

### Added
- Automatic GitHub release creation when publishing to npm
  - GitHub Actions workflow now creates releases with CHANGELOG notes
  - Release notes extracted from CHANGELOG.md for each version
  - Includes installation instructions and comparison links
- CLAUDE.md documentation file for Claude Code guidance
  - Development workflow with Spec-Kit commands
  - Build, test, and lint commands
  - High-level architecture overview
  - Release process documentation

### Changed
- Restricted npm publishing to GitHub Actions only
  - Manual `npm publish` now fails with helpful error message
  - Enforces consistent releases through CI/CD pipeline
  - Ensures all releases go through automated quality checks

## [0.0.4] - 2025-11-04

### Added
- Automatic command resolution for `node`, `npm`, and `npx` commands
  - `"node"` commands are automatically resolved to the parent aggregator's Node.js executable (`process.execPath`)
  - `"npm"` and `"npx"` commands are resolved to executables in the same directory as Node.js (if they exist)
  - Falls back gracefully to original command if npm/npx not found
  - Cross-platform support (Windows `.cmd` extension handling)
  - Debug logging shows resolved paths with `[INFO]` prefix
  - Prevents "spawn ENOENT" errors in environments where PATH is not configured
  - Ensures version consistency between parent and child processes
  - Absolute paths in config are preserved unchanged

## [0.0.3] - 2025-01-XX

### Fixed
- Fixed npx execution to work when installed from npm

## [0.0.2] - 2025-01-XX

### Added
- GitHub Actions workflow for automated npm publishing

## [0.0.1] - 2025-01-XX

### Added
- Initial release
- MCP server aggregation functionality
- Tool namespacing with server key prefixes
- Environment variable expansion (`$VAR` and `${VAR}` syntax)
- Graceful degradation on runtime child server crashes
- Fail-fast behavior on startup errors
- TypeScript implementation with strict type safety
- Comprehensive test suite (unit, integration, performance)
- CLI with `--config`, `--debug`, `--name`, `--version` options
- Standard Claude Desktop config format support

[Unreleased]: https://github.com/hlibkoval/mcp-simple-aggregator/compare/v0.0.8...HEAD
[0.0.8]: https://github.com/hlibkoval/mcp-simple-aggregator/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/hlibkoval/mcp-simple-aggregator/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/hlibkoval/mcp-simple-aggregator/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/hlibkoval/mcp-simple-aggregator/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/hlibkoval/mcp-simple-aggregator/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/hlibkoval/mcp-simple-aggregator/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/hlibkoval/mcp-simple-aggregator/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/hlibkoval/mcp-simple-aggregator/releases/tag/v0.0.1

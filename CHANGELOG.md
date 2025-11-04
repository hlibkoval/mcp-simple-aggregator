# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/hlibkoval/mcp-simple-aggregator/compare/v0.0.3...HEAD
[0.0.3]: https://github.com/hlibkoval/mcp-simple-aggregator/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/hlibkoval/mcp-simple-aggregator/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/hlibkoval/mcp-simple-aggregator/releases/tag/v0.0.1

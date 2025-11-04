# Implementation Plan: Configurable Tool Name Separator

**Branch**: `005-configurable-separator` | **Date**: 2025-11-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-configurable-separator/spec.md`

## Summary

Add CLI argument `--separator` to allow users to configure the character(s) used to namespace tool names (e.g., `serverKey__toolName` instead of `serverKey:toolName`). Default remains `:` for backward compatibility. Validation ensures separator is non-empty and contains no whitespace.

**Technical Approach**: Pass separator through the entire tool lifecycle - from CLI parsing to registry building to tool call parsing. The separator is stored in a configuration object and passed to all functions that construct or parse prefixed tool names.

## Technical Context

**Language/Version**: TypeScript 5.3+ / Node.js 18+
**Primary Dependencies**: @modelcontextprotocol/sdk (stdio transport), tsup (build), vitest (testing)
**Storage**: N/A (stateless aggregator)
**Testing**: Vitest with @vitest/coverage-v8
**Target Platform**: Node.js CLI application (Linux, macOS, Windows)
**Project Type**: Single project (CLI tool)
**Performance Goals**: Tool registration <1 second for up to 100 child servers
**Constraints**: No stdio pollution (clean JSON-RPC), <50MB memory baseline
**Scale/Scope**: Support 10-50 child servers with 5-20 tools each (~500 tools max)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gate Results

✅ **Code Quality First**: No complexity increase - simple string parameter threading
✅ **Test-First Development**: Unit tests for CLI parsing, registry, server parsing (TDD approach)
✅ **User Experience Consistency**: Clear error messages for invalid separators, backward compatible
✅ **Performance by Design**: No performance impact (string concatenation/split operations O(1))
✅ **Simplicity and Maintainability**: Single responsibility change - separator configuration only

### Pre-Design Check

All gates pass. This is a straightforward configuration parameter addition with no architectural changes.

## Project Structure

### Documentation (this feature)

```text
specs/005-configurable-separator/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── index.ts             # CLI parsing - add --separator argument
├── registry.ts          # Tool prefixing - use configurable separator
├── server.ts            # Tool parsing - split by configurable separator
├── types.ts             # Add SeparatorConfig type
├── config.ts            # No changes (config file parsing unaffected)
├── child-manager.ts     # No changes (child spawning unaffected)
└── logger.ts            # No changes (logging unaffected)

tests/
├── unit/
│   ├── cli.test.ts      # Test --separator parsing and validation
│   ├── registry.test.ts # Test prefixing with custom separator
│   └── server.test.ts   # Test parsing with custom separator
└── integration/
    └── separator.test.ts # End-to-end test with custom separator
```

**Structure Decision**: Single project structure (existing). All changes are isolated to CLI argument parsing (index.ts), tool prefixing (registry.ts), and tool name parsing (server.ts). No new modules needed - this is a configuration threading exercise.

## Complexity Tracking

> **No violations - table not needed**

All constitution gates pass without exceptions. This feature maintains existing quality standards.

---

## Post-Design Constitution Check

*Re-evaluated after Phase 1 design artifacts completed*

### Gate Results (After Design)

✅ **Code Quality First**: Maintained
- Type-safe parameter passing (TypeScript strict mode)
- No unused variables (all parameters used)
- Clear naming: `separator`, `validateSeparator()`, etc.
- Low complexity: Each function adds 1-3 lines, cyclomatic complexity remains <5

✅ **Test-First Development**: Planned
- Unit tests documented in quickstart.md
- Integration test documented in quickstart.md
- Test coverage goal: ≥80% for new code
- TDD workflow: Write tests → Implement → Pass tests

✅ **User Experience Consistency**: Verified
- Error messages documented in contracts/cli-interface.md
- Backward compatible (default separator `:`)
- Clear --help output with examples
- Debug logging shows configured separator

✅ **Performance by Design**: Confirmed
- Latency impact: <0.1ms per tool call (string operations)
- Memory overhead: ~10 bytes (single string)
- No additional I/O operations
- No performance regression expected

✅ **Simplicity and Maintainability**: Validated
- Single responsibility: Separator configuration only
- 2 levels of abstraction: CLI → Registry → Server
- No premature optimization (simple string operations)
- Clear documentation in quickstart.md

### Design Validation

**Architecture Impact**: None
- No new modules required
- No changes to child server lifecycle
- No changes to MCP protocol handling
- Isolated to tool naming logic

**Dependency Impact**: None
- No new dependencies added
- Existing dependencies unchanged
- No version upgrades required

**Test Strategy**: Comprehensive
- 6 unit test suites (CLI, registry, server)
- 1 integration test suite (end-to-end)
- Edge case coverage (empty, whitespace, multi-char)
- Backward compatibility tests

### Final Gate Status

🟢 **All gates pass** - Feature ready for implementation phase

**Next Command**: `/speckit.tasks` to generate task breakdown

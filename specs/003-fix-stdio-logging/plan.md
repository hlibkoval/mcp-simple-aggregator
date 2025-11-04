# Implementation Plan: Fix Stdio Logging Protocol Pollution

**Branch**: `003-fix-stdio-logging` | **Date**: 2025-11-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-fix-stdio-logging/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Fix JSON-RPC protocol pollution caused by stderr logging in MCP stdio transport. The aggregator currently outputs informational log messages to stderr which interferes with Claude Desktop's JSON-RPC parser. Solution involves suppressing all console output by default and implementing file-based logging for debug mode.

**Primary Requirement**: Ensure only valid JSON-RPC messages appear on stdout and stderr when operating in stdio mode.

**Technical Approach**: Modify logger.ts to redirect debug logs to a file when enabled, remove informational startup messages, and only allow fatal errors on console before JSON-RPC transport is established.

## Technical Context

**Language/Version**: TypeScript 5.3+ (Node.js 18+)
**Primary Dependencies**: @modelcontextprotocol/sdk (stdio transport), tsup (build), vitest (testing)
**Storage**: File-based debug logs (when --debug enabled)
**Testing**: vitest with @vitest/coverage-v8
**Target Platform**: Node.js CLI (stdio transport for MCP protocol)
**Project Type**: Single project (CLI tool)
**Performance Goals**: No impact - logging should not affect JSON-RPC throughput
**Constraints**: Zero console output in normal mode, file I/O for debug logs must not block stdio
**Scale/Scope**: Single logger module modification + 3 call sites, ~100 LOC total

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Core Principles Assessment

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Code Quality First** | ✅ PASS | Type-safe file stream handling, no unused variables, clear naming for log file operations |
| **II. Test-First Development** | ✅ PASS | Unit tests for logger behavior, integration tests for stdio cleanliness, TDD approach required |
| **III. User Experience Consistency** | ✅ PASS | Clear error messages if log file creation fails, consistent --debug and --log-file CLI patterns |
| **IV. Performance by Design** | ✅ PASS | File I/O is async/non-blocking, no impact on JSON-RPC throughput, minimal overhead when disabled |
| **V. Simplicity and Maintainability** | ✅ PASS | Single logger module change, no new abstractions, file stream is standard Node.js API |

### Quality Gates Readiness

| Gate | Pre-Phase 0 Status | Notes |
|------|-------------------|-------|
| **1. Code Review Gate** | ⏳ PENDING | Will require peer review after implementation |
| **2. Test Gate** | ✅ READY | Test plan defined (stdio output validation, file write verification, coverage target 80%+) |
| **3. Type Safety Gate** | ✅ READY | TypeScript strict mode already enabled, fs.WriteStream types well-defined |
| **4. Performance Gate** | ✅ READY | No performance regression expected (logging is off-critical-path) |
| **5. Documentation Gate** | ✅ READY | CLAUDE.md and README updates required for --log-file option |

### Violations/Exceptions

**None** - This is a bug fix with minimal scope. No constitution principles are violated.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
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
├── logger.ts           # Primary modification: add file stream support
├── index.ts            # Update CLI args parsing for --log-file
├── server.ts           # Remove startup info log
├── child-manager.ts    # Conditional logging based on debug mode
└── types.ts            # No changes needed

tests/
├── unit/
│   └── logger.test.ts  # New tests for file logging behavior
└── integration/
    └── stdio-clean.test.ts  # New test: verify no console pollution
```

**Structure Decision**: Single project (CLI tool). Modifications are localized to the logger module with small adjustments to CLI argument parsing and removal of unnecessary startup logs. All existing modules remain in place.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**No violations** - All constitution principles satisfied by this design.

---

## Post-Phase 1 Constitution Re-evaluation

*Re-checked after design artifacts complete*

### Core Principles Assessment

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Code Quality First** | ✅ PASS | Design maintains type safety, clear module boundaries, no code quality compromises |
| **II. Test-First Development** | ✅ PASS | Test plan defined in quickstart.md with unit + integration coverage, TDD approach documented |
| **III. User Experience Consistency** | ✅ PASS | CLI args follow existing patterns (--debug, --log-file), error handling documented in contracts |
| **IV. Performance by Design** | ✅ PASS | Async file I/O confirmed non-blocking, no impact on JSON-RPC throughput per research.md |
| **V. Simplicity and Maintainability** | ✅ PASS | Single module change (logger.ts), standard Node.js APIs, no new abstractions introduced |

### Quality Gates Readiness (Post-Design)

| Gate | Status | Evidence |
|------|--------|----------|
| **1. Code Review Gate** | ⏳ PENDING | Will require peer review after implementation |
| **2. Test Gate** | ✅ READY | Test plan detailed in quickstart.md (Steps 4-5), unit + integration tests defined |
| **3. Type Safety Gate** | ✅ READY | Contract in logger-api.md specifies all types, TypeScript strict mode enforced |
| **4. Performance Gate** | ✅ READY | research.md confirms negligible impact (file I/O async, off critical path) |
| **5. Documentation Gate** | ✅ READY | quickstart.md Step 6 defines doc updates for CLAUDE.md and README.md |

### Final Assessment

**✅ ALL GATES PASS** - Design adheres to constitution, ready for `/speckit.tasks` generation and implementation.

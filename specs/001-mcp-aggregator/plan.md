# Implementation Plan: MCP Server Aggregator

**Branch**: `001-mcp-aggregator` | **Date**: 2025-11-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-mcp-aggregator/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a TypeScript-based MCP server that aggregates multiple child MCP servers, exposing their tools with namespaced prefixes (format: `serverKey:toolName`). The aggregator accepts a Claude Desktop-compatible MCP config JSON, spawns child servers via stdio transport, and acts as a transparent proxy for tool discovery and invocation. Uses Node.js child_process for process management and @modelcontextprotocol/sdk for protocol implementation.

## Technical Context

**Language/Version**: TypeScript 5.7+ with Node.js v18+ (LTS)
**Primary Dependencies**:
- `@modelcontextprotocol/sdk` ^0.6.0 - Official MCP protocol implementation
- `zod` - Schema validation (included with SDK)
- Custom environment variable expansion (regex-based, no external deps)

**Storage**: N/A - Configuration read from file at startup, no persistence needed
**Testing**: Vitest 2.1+ - Modern TypeScript-first testing framework with async support
**Target Platform**: Node.js v18+ on macOS/Linux/Windows (cross-platform stdio support)
**Project Type**: Single CLI project - stdio-based MCP server executable
**Performance Goals**:
- Start 10+ child servers within 5 seconds (SC-001)
- Tool discovery response < 1 second (SC-002)
- Request routing overhead < 50ms (SC-003)
- Handle concurrent tool invocations asynchronously

**Constraints**:
- Stdio transport only (no HTTP/SSE)
- Must use standard Claude MCP config format (no extensions)
- Minimal logging (errors/warnings only)
- No child server restart on failure
- Tools must not contain `:` character (used as prefix separator)

**Scale/Scope**:
- Support 10+ concurrent child MCP servers
- Handle 100+ aggregated tools across all servers
- Single aggregator instance per MCP client connection

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Code Quality First ✅
- **Type Safety**: TypeScript strict mode enforced
- **No Unused Code**: Linting rules configured
- **Clear Naming**: Entity names defined in spec (AggregatorServer, ChildServerClient, ToolRegistry)
- **Complexity**: Functions scoped to single responsibility (config parsing, process management, routing)
- **Code Reviews**: Required via git workflow

### Principle II: Test-First Development ✅
- **Unit Tests**: Required for config parsing, env expansion, registry, routing logic
- **Integration Tests**: Required for child process spawning, tool aggregation, end-to-end MCP protocol
- **TDD Approach**: Tests written before implementation per constitution
- **Coverage**: Minimum 80% for new code
- **Test Framework**: Vitest configured for async operations and mocking

### Principle III: User Experience Consistency ✅
- **Error Messages**: FR-002 requires specific error for missing env vars; FR-010 validates config
- **API Contracts**: MCP protocol standard (no custom extensions)
- **Config Validation**: JSON schema validation before child spawning
- **Performance Visibility**: FR-015 requires error/warning logging
- **Documentation**: quickstart.md planned with examples

### Principle IV: Performance by Design ✅
- **Latency Targets**: SC-001 (5s startup), SC-002 (1s discovery), SC-003 (<50ms overhead)
- **Resource Limits**: Documented in Technical Context
- **Async Patterns**: Node.js child_process async I/O, SDK async tool calls
- **Bottleneck Mitigation**: O(1) tool registry lookup, no synchronous blocking
- **Performance Tests**: Benchmarks required for SC-001, SC-002, SC-003

### Principle V: Simplicity and Maintainability ✅
- **YAGNI**: No extra transports (stdio only), no config extensions, no auto-restart
- **Abstraction Levels**: Single project, 2 levels (aggregator → child clients → MCP protocol)
- **No Premature Optimization**: Simple Map for registry, regex for env expansion
- **Design Documentation**: Architecture decisions in research.md

### Quality Gates Status

| Gate | Status | Evidence |
|------|--------|----------|
| Code Review Gate | ✅ Planned | Git workflow enforces peer review |
| Test Gate | ✅ Planned | Vitest configured, 80% coverage target, TDD approach |
| Type Safety Gate | ✅ Planned | TypeScript strict mode in tsconfig.json |
| Performance Gate | ✅ Planned | Benchmarks for SC-001, SC-002, SC-003 |
| Documentation Gate | ✅ Planned | quickstart.md, contracts/, inline docs |

**Result**: All constitution gates PASSED. No violations requiring justification.

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
mcp-simple-aggregator/
├── src/
│   ├── index.ts              # CLI entry point, argument parsing
│   ├── server.ts             # MCP Server implementation (aggregator)
│   ├── registry.ts           # Tool registry & prefix management
│   ├── config.ts             # Config parsing & env var expansion
│   ├── child-manager.ts      # Child process lifecycle management
│   └── types.ts              # TypeScript type definitions
├── tests/
│   ├── unit/
│   │   ├── config.test.ts           # Config parsing tests
│   │   ├── env-expansion.test.ts    # Environment variable tests
│   │   ├── registry.test.ts         # Tool registry tests
│   │   └── routing.test.ts          # Request routing tests
│   └── integration/
│       ├── aggregator.test.ts       # End-to-end MCP tests
│       └── child-process.test.ts    # Multi-server tests
├── examples/
│   └── sample-config.json    # Example MCP configuration
├── package.json
├── tsconfig.json
├── tsup.config.ts            # Build configuration (tsup)
├── vitest.config.ts          # Test configuration
└── README.md
```

**Structure Decision**: Single project structure selected. This is a CLI tool that acts as both an MCP server (to Claude Desktop) and MCP client (to child servers). No web/mobile components needed. Clean separation of concerns:
- `src/index.ts` - Entry point
- `src/config.ts` - Configuration layer
- `src/child-manager.ts` - Process management layer
- `src/registry.ts` - Tool aggregation layer
- `src/server.ts` - MCP protocol layer

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. All constitution principles satisfied.

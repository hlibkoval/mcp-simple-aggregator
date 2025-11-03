# Implementation Tasks: MCP Server Aggregator

**Feature**: MCP Server Aggregator
**Branch**: `001-mcp-aggregator`
**Approach**: Test-Driven Development (TDD)
**Generated**: 2025-11-03

## Overview

This task list follows a strict TDD approach where **tests are written before implementation**. Tasks are organized by user story to enable independent, incremental development and testing.

## Task Format Legend

```
- [ ] [TaskID] [P] [Story] Description with file path
```

- **TaskID**: Sequential task number (T001, T002, ...)
- **[P]**: Parallelizable (can run concurrently with other [P] tasks)
- **[Story]**: User story label (US1, US2, US3)
- **File path**: Specific file to create/modify

## Phase 1: Project Setup

### Setup Tasks

- [X] T001 Initialize npm project with package.json in project root
- [X] T002 [P] Create tsconfig.json with strict mode and ES2022 target in project root
- [X] T003 [P] Create tsup.config.ts for build configuration in project root
- [X] T004 [P] Create vitest.config.ts for test configuration in project root
- [X] T005 [P] Create .gitignore with node_modules, dist, coverage in project root
- [X] T006 Install dependencies: @modelcontextprotocol/sdk@^0.6.0 in package.json
- [X] T007 [P] Install dev dependencies: typescript@^5.7.0, tsup@^8.3.0, vitest@^2.1.0, @types/node@^22.0.0 in package.json
- [X] T008 [P] Create src/ directory structure in project root
- [X] T009 [P] Create tests/unit/ directory in project root
- [X] T010 [P] Create tests/integration/ directory in project root
- [X] T011 [P] Create examples/ directory in project root
- [X] T012 [P] Add test, build, and dev scripts to package.json
- [X] T013 [P] Create examples/sample-config.json with example MCP server config

**Independent Test**: Run `npm install` and `npm test` - should complete without errors (no tests yet).

---

## Phase 2: Foundational Layer (TDD)

These tasks create the foundation that all user stories depend on. Following TDD, tests are written first.

### Type Definitions

- [X] T014 [P] Define McpConfig and ServerConfig interfaces in src/types.ts
- [X] T015 [P] Define ChildServerClient interface and ServerStatus enum in src/types.ts
- [X] T016 [P] Define ToolRegistry and ToolRegistryEntry types in src/types.ts
- [X] T017 [P] Define CliArgs interface in src/types.ts
- [X] T018 [P] Define ExpansionContext and ExpansionResult types in src/types.ts
- [X] T019 [P] Define ConfigError class and ConfigErrorCode enum in src/types.ts
- [X] T020 [P] Define ChildServerError class and ErrorPhase enum in src/types.ts
- [X] T021 [P] Define ConfigValidation and ValidationError interfaces in src/types.ts
- [X] T022 Export all types from src/types.ts with proper JSDoc comments

**Independent Test**: TypeScript compilation succeeds (`npm run build`).

---

## Phase 3: User Story 1 - Configure and Start Aggregator (P1)

**Goal**: Enable developers to bundle multiple MCP servers with config file validation and child server spawning.

**Independent Test Criteria**:
- Provide valid MCP config JSON with 2+ servers
- Start aggregator with `--config` flag
- Verify all child servers spawn successfully
- Verify clear error messages for invalid configs/missing env vars

### US1: Config Parsing Tests (TDD - Tests First)

- [X] T023 [US1] Write test: Parse valid MCP config JSON in tests/unit/config.test.ts
- [ ] T024 [P] [US1] Write test: Reject config missing mcpServers field in tests/unit/config.test.ts
- [ ] T025 [P] [US1] Write test: Reject config with invalid JSON syntax in tests/unit/config.test.ts
- [ ] T026 [P] [US1] Write test: Reject server config missing command field in tests/unit/config.test.ts
- [ ] T027 [P] [US1] Write test: Accept server config with optional args and env in tests/unit/config.test.ts
- [ ] T028 [P] [US1] Write test: Handle multiple servers in config in tests/unit/config.test.ts

### US1: Config Parsing Implementation

- [X] T029 [US1] Implement readConfigFile() to read JSON from file path in src/config.ts
- [X] T030 [US1] Implement parseConfig() to parse and validate config structure in src/config.ts
- [X] T031 [US1] Implement validateConfig() with detailed error messages in src/config.ts
- [X] T032 [US1] Add ConfigError throwing for validation failures in src/config.ts

**Checkpoint**: Run tests T023-T028 - all should pass.

### US1: Environment Variable Expansion Tests (TDD - Tests First)

- [X] T033 [US1] Write test: Expand ${VAR} syntax in tests/unit/env-expansion.test.ts
- [ ] T034 [P] [US1] Write test: Expand $VAR syntax in tests/unit/env-expansion.test.ts
- [ ] T035 [P] [US1] Write test: Fail on missing environment variable in tests/unit/env-expansion.test.ts
- [ ] T036 [P] [US1] Write test: Recursively expand vars in nested config in tests/unit/env-expansion.test.ts
- [ ] T037 [P] [US1] Write test: Preserve non-string values during expansion in tests/unit/env-expansion.test.ts
- [ ] T038 [P] [US1] Write test: Identify specific missing variable name in error in tests/unit/env-expansion.test.ts

### US1: Environment Variable Expansion Implementation

- [X] T039 [US1] Implement expandEnvVar() with regex replacement in src/config.ts
- [X] T040 [US1] Implement expandConfigEnvVars() for recursive expansion in src/config.ts
- [X] T041 [US1] Add error handling for missing variables with variable name in error in src/config.ts

**Checkpoint**: Run tests T033-T038 - all should pass.

### US1: Child Server Manager Tests (TDD - Tests First)

- [X] T042 [US1] Write test: Initialize single child server with valid config in tests/unit/child-manager.test.ts
- [ ] T043 [P] [US1] Write test: Initialize multiple child servers in parallel in tests/unit/child-manager.test.ts
- [ ] T044 [P] [US1] Write test: Fail startup if child server command not found in tests/unit/child-manager.test.ts
- [ ] T045 [P] [US1] Write test: Fail startup if child server doesn't respond in tests/unit/child-manager.test.ts
- [ ] T046 [P] [US1] Write test: Pass environment variables to child process in tests/unit/child-manager.test.ts
- [ ] T047 [P] [US1] Write test: Report specific server that failed with diagnostic info in tests/unit/child-manager.test.ts

### US1: Child Server Manager Implementation

- [X] T048 [US1] Implement createChildClient() using StdioClientTransport in src/child-manager.ts
- [X] T049 [US1] Implement connectToChild() to spawn and connect to single server in src/child-manager.ts
- [X] T050 [US1] Implement initializeChildren() to spawn all servers from config in src/child-manager.ts
- [X] T051 [US1] Add child server health check with listTools() call in src/child-manager.ts
- [X] T052 [US1] Add error handling with ChildServerError for failures in src/child-manager.ts
- [X] T053 [US1] Implement fail-fast startup behavior (exit on any child failure) in src/child-manager.ts

**Checkpoint**: Run tests T042-T047 - all should pass.

### US1: CLI Interface Tests (TDD - Tests First)

- [X] T054 [US1] Write test: Parse --config argument in tests/unit/cli.test.ts
- [ ] T055 [P] [US1] Write test: Reject missing --config argument in tests/unit/cli.test.ts
- [ ] T056 [P] [US1] Write test: Parse optional --debug flag in tests/unit/cli.test.ts
- [ ] T057 [P] [US1] Write test: Show help message for --help flag in tests/unit/cli.test.ts

### US1: CLI Interface Implementation

- [X] T058 [US1] Implement parseCliArgs() for argument parsing in src/index.ts
- [X] T059 [US1] Implement validateCliArgs() to ensure config path provided in src/index.ts
- [X] T060 [US1] Add help text with usage examples in src/index.ts
- [X] T061 [US1] Wire together config parsing, env expansion, child initialization in src/index.ts

**Checkpoint**: Run tests T054-T057 - all should pass.

### US1: Integration Tests

- [X] T062 [US1] Write integration test: Start with valid config, verify all children spawn in tests/integration/startup.test.ts
- [X] T063 [US1] Write integration test: Fail startup with missing config file in tests/integration/startup.test.ts
- [X] T064 [US1] Write integration test: Fail startup with invalid JSON in tests/integration/startup.test.ts
- [X] T065 [US1] Write integration test: Fail startup with missing env var in tests/integration/startup.test.ts
- [X] T066 [US1] Write integration test: Fail startup with unreachable child server in tests/integration/startup.test.ts

**US1 Complete**: User can configure and start aggregator with proper validation.

---

## Phase 4: User Story 2 - Discover Aggregated Tools (P2)

**Goal**: Enable clients to discover all tools from all child servers with proper namespacing.

**Independent Test Criteria**:
- Configure 2 servers with different tools
- Connect client to aggregator
- Call tools/list
- Verify each tool has correct `serverKey:toolName` prefix

### US2: Tool Registry Tests (TDD - Tests First)

- [ ] T067 [US2] Write test: Build registry from single child server in tests/unit/registry.test.ts
- [ ] T068 [P] [US2] Write test: Build registry from multiple child servers in tests/unit/registry.test.ts
- [ ] T069 [P] [US2] Write test: Prefix tools with serverKey in tests/unit/registry.test.ts
- [ ] T070 [P] [US2] Write test: Handle duplicate tool names from different servers in tests/unit/registry.test.ts
- [ ] T071 [P] [US2] Write test: Preserve original tool name for routing in tests/unit/registry.test.ts
- [ ] T072 [P] [US2] Write test: Remove tools when server crashes in tests/unit/registry.test.ts
- [ ] T073 [P] [US2] Write test: Lookup tool by prefixed name in O(1) time in tests/unit/registry.test.ts

### US2: Tool Registry Implementation

- [ ] T074 [US2] Implement buildToolRegistry() to aggregate tools from all children in src/registry.ts
- [ ] T075 [US2] Implement addServerTools() to add tools with prefix in src/registry.ts
- [ ] T076 [US2] Implement removeServerTools() to remove crashed server's tools in src/registry.ts
- [ ] T077 [US2] Implement lookupTool() for O(1) registry lookup in src/registry.ts
- [ ] T078 [US2] Implement prefixing logic using serverKey:toolName format in src/registry.ts

**Checkpoint**: Run tests T067-T073 - all should pass.

### US2: MCP Server Tests (TDD - Tests First)

- [ ] T079 [US2] Write test: Create MCP server with tools capability in tests/unit/server.test.ts
- [ ] T080 [P] [US2] Write test: Handle tools/list request from client in tests/unit/server.test.ts
- [ ] T081 [P] [US2] Write test: Return all prefixed tools in tools/list response in tests/unit/server.test.ts
- [ ] T082 [P] [US2] Write test: Update tool list when child server crashes in tests/unit/server.test.ts
- [ ] T083 [P] [US2] Write test: Handle tools/list with zero servers in tests/unit/server.test.ts

### US2: MCP Server Implementation

- [ ] T084 [US2] Implement createAggregatorServer() with Server from MCP SDK in src/server.ts
- [ ] T085 [US2] Implement tools/list request handler using registry in src/server.ts
- [ ] T086 [US2] Implement server initialization with capabilities in src/server.ts
- [ ] T087 [US2] Wire up child crash handlers to update registry in src/server.ts

**Checkpoint**: Run tests T079-T083 - all should pass.

### US2: Integration Tests

- [ ] T088 [US2] Write integration test: List tools from 3 child servers in tests/integration/discovery.test.ts
- [ ] T089 [US2] Write integration test: Verify tool prefixes match config keys in tests/integration/discovery.test.ts
- [ ] T090 [US2] Write integration test: Handle same server configured twice with different keys in tests/integration/discovery.test.ts
- [ ] T091 [US2] Write integration test: Remove tools when child crashes after startup in tests/integration/discovery.test.ts

**US2 Complete**: Clients can discover all aggregated tools with proper namespacing.

---

## Phase 5: User Story 3 - Execute Tools on Child Servers (P3)

**Goal**: Enable clients to invoke tools through the aggregator with transparent routing.

**Independent Test Criteria**:
- Call prefixed tool (e.g., `serverKey:toolName`)
- Verify request routes to correct child server
- Verify response returns unchanged from child

### US3: Request Routing Tests (TDD - Tests First)

- [ ] T092 [US3] Write test: Parse tool name prefix correctly in tests/unit/routing.test.ts
- [ ] T093 [P] [US3] Write test: Route tool call to correct child server in tests/unit/routing.test.ts
- [ ] T094 [P] [US3] Write test: Forward arguments unchanged to child in tests/unit/routing.test.ts
- [ ] T095 [P] [US3] Write test: Return child response unchanged to client in tests/unit/routing.test.ts
- [ ] T096 [P] [US3] Write test: Return error for tool not found in tests/unit/routing.test.ts
- [ ] T097 [P] [US3] Write test: Return error for missing prefix in tool name in tests/unit/routing.test.ts
- [ ] T098 [P] [US3] Write test: Forward child server errors unchanged in tests/unit/routing.test.ts

### US3: Request Routing Implementation

- [ ] T099 [US3] Implement parseToolPrefix() to extract serverKey and toolName in src/server.ts
- [ ] T100 [US3] Implement tools/call request handler with routing logic in src/server.ts
- [ ] T101 [US3] Implement error handling for tool not found (McpError) in src/server.ts
- [ ] T102 [US3] Implement error handling for invalid tool name format in src/server.ts
- [ ] T103 [US3] Implement transparent argument forwarding to child in src/server.ts
- [ ] T104 [US3] Implement transparent response forwarding from child in src/server.ts

**Checkpoint**: Run tests T092-T098 - all should pass.

### US3: Error Handling Tests (TDD - Tests First)

- [ ] T105 [US3] Write test: Handle child server validation errors in tests/unit/error-handling.test.ts
- [ ] T106 [P] [US3] Write test: Handle child server timeout gracefully in tests/unit/error-handling.test.ts
- [ ] T107 [P] [US3] Write test: Handle child crash during tool call in tests/unit/error-handling.test.ts
- [ ] T108 [P] [US3] Write test: Continue serving after child crashes in tests/unit/error-handling.test.ts

### US3: Error Handling Implementation

- [ ] T109 [US3] Implement child error event handlers in src/child-manager.ts
- [ ] T110 [US3] Implement graceful degradation on child crash in src/child-manager.ts
- [ ] T111 [US3] Add error logging for child failures in src/child-manager.ts
- [ ] T112 [US3] Ensure aggregator continues with remaining servers in src/child-manager.ts

**Checkpoint**: Run tests T105-T108 - all should pass.

### US3: Integration Tests

- [ ] T113 [US3] Write integration test: Call tool successfully through aggregator in tests/integration/tool-execution.test.ts
- [ ] T114 [US3] Write integration test: Route to correct server with multiple children in tests/integration/tool-execution.test.ts
- [ ] T115 [US3] Write integration test: Handle invalid arguments from client in tests/integration/tool-execution.test.ts
- [ ] T116 [US3] Write integration test: Handle non-existent tool name in tests/integration/tool-execution.test.ts
- [ ] T117 [US3] Write integration test: Forward large responses correctly in tests/integration/tool-execution.test.ts

**US3 Complete**: Clients can execute tools through aggregator with transparent routing.

---

## Phase 6: Performance & Quality Gates

### Performance Tests

- [ ] T118 [P] Write performance test: Verify 10 servers start within 5 seconds (SC-001) in tests/performance/startup.bench.ts
- [ ] T119 [P] Write performance test: Verify tools/list responds within 1 second (SC-002) in tests/performance/discovery.bench.ts
- [ ] T120 [P] Write performance test: Verify routing overhead < 50ms (SC-003) in tests/performance/routing.bench.ts
- [ ] T121 [P] Write performance test: Measure concurrent tool invocations in tests/performance/concurrency.bench.ts

### Performance Optimization

- [ ] T122 Optimize registry lookup if benchmarks fail SC-002 in src/registry.ts
- [ ] T123 Optimize routing if benchmarks fail SC-003 in src/server.ts
- [ ] T124 Optimize startup if benchmarks fail SC-001 in src/child-manager.ts

### Code Quality

- [ ] T125 [P] Add JSDoc comments to all public functions in src/
- [ ] T126 [P] Add inline comments for complex logic (env var regex, prefix parsing) in src/
- [ ] T127 Run linter and fix all issues across src/
- [ ] T128 Verify TypeScript strict mode has no errors with `npm run build`
- [ ] T129 Verify test coverage ≥ 80% with `npm run test:coverage`

### Documentation

- [ ] T130 [P] Create README.md with installation, usage, and examples in project root
- [ ] T131 [P] Update examples/sample-config.json with comprehensive examples in examples/
- [ ] T132 [P] Add inline examples to error messages in src/config.ts

---

## Dependencies & Parallelization

### User Story Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational)
    ↓
Phase 3 (US1: Configure & Start) ← MUST complete first
    ↓
Phase 4 (US2: Tool Discovery) ← Depends on US1
    ↓
Phase 5 (US3: Tool Execution) ← Depends on US1 + US2
    ↓
Phase 6 (Performance & Quality)
```

### Parallel Execution Opportunities

**Within US1** (after T022 types complete):
- Tests T023-T028, T033-T038, T042-T047, T054-T057 can be written in parallel
- Implementation tasks T029-T032 (config), T039-T041 (env), T048-T053 (child manager), T058-T061 (CLI) can proceed independently after tests

**Within US2** (after US1 complete):
- Tests T067-T073, T079-T083 can be written in parallel
- Implementation tasks T074-T078 (registry), T084-T087 (server) can proceed independently

**Within US3** (after US2 complete):
- Tests T092-T098, T105-T108 can be written in parallel
- Implementation tasks T099-T104 (routing), T109-T112 (error handling) can proceed independently

**Phase 6**:
- All performance tests T118-T121 can run in parallel
- All documentation tasks T130-T132 can be done in parallel

---

## TDD Workflow Summary

For each user story:

1. **Red**: Write failing tests first (T0xx test tasks)
2. **Green**: Write minimal code to pass tests (T0xx implementation tasks)
3. **Refactor**: Clean up after tests pass
4. **Checkpoint**: Verify all tests pass before moving to next section
5. **Integration**: Write end-to-end tests for the complete user story

---

## Implementation Strategy

### MVP (Minimum Viable Product)

**Scope**: User Story 1 only (T001-T066)
- Developers can configure aggregator with MCP config
- Environment variables expand correctly
- Child servers spawn successfully
- Clear error messages for failures

**Delivery**: Validates core architecture, config parsing, child management

### Incremental Delivery

**Phase 1**: US1 (Configure & Start) - T001-T066
**Phase 2**: US1 + US2 (Add Discovery) - T067-T091
**Phase 3**: US1 + US2 + US3 (Add Execution) - T092-T117
**Phase 4**: Full System + Performance - T118-T132

Each phase delivers independently testable value.

---

## Success Metrics

| Metric | Target | Validation Task |
|--------|--------|-----------------|
| Test Coverage | ≥ 80% | T129 |
| Startup Time | < 5s for 10 servers | T118 |
| Discovery Time | < 1s | T119 |
| Routing Overhead | < 50ms | T120 |
| TypeScript Strict | No errors | T128 |
| All Tests Pass | 100% | All test tasks |

---

## Task Statistics

- **Total Tasks**: 132
- **User Story 1 Tasks**: 44 (T023-T066)
- **User Story 2 Tasks**: 25 (T067-T091)
- **User Story 3 Tasks**: 26 (T092-T117)
- **Setup Tasks**: 13 (T001-T013)
- **Foundational Tasks**: 9 (T014-T022)
- **Performance Tasks**: 15 (T118-T132)
- **Parallelizable Tasks**: 89 (marked with [P])

---

**Ready for Implementation**: All tasks defined with clear TDD approach. Begin with T001!

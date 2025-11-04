# Tasks: Configurable Tool Name Separator

**Input**: Design documents from `/specs/005-configurable-separator/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are included per the TDD approach specified in plan.md (Test-First Development principle)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- All paths are relative to repository root: `/Users/gleb/Projects/mcp-simple-aggregator/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No setup tasks needed - existing project structure is sufficient

This feature requires no new infrastructure or project setup. All changes are modifications to existing files.

**Checkpoint**: Skip to Phase 2 - no setup required ✅

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type definitions that all user stories depend on

**⚠️ CRITICAL**: This task MUST be complete before ANY user story implementation can begin

- [x] T001 Add separator field to CliArgs interface in src/types.ts

**Checkpoint**: Type definitions updated - user story implementation can now begin ✅

---

## Phase 3: User Story 1 - Default Colon Separator (Priority: P1) 🎯 MVP

**Goal**: Ensure backward compatibility by maintaining default colon separator behavior when no --separator argument is provided

**Independent Test**: Start aggregator without --separator argument and verify tools are listed with colon-separated names (e.g., `github:create_issue`) and tool calls route correctly

**Dependencies**: T001 (type definitions)

### Tests for User Story 1 - Write FIRST (TDD)

> **TDD: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T002 [P] [US1] Write unit test for parseCliArgs() default separator behavior in tests/unit/cli.test.ts
- [x] T003 [P] [US1] Write unit test for buildToolRegistry() with default separator in tests/unit/registry.test.ts
- [x] T004 [P] [US1] Write unit test for parseToolPrefix() with default colon separator in tests/unit/server.test.ts
- [x] T005 [P] [US1] Write integration test for default separator end-to-end flow in tests/integration/separator.test.ts

### Implementation for User Story 1

- [x] T006 [US1] Add default separator logic in main() function in src/index.ts (set separator = ':' when args.separator is undefined)
- [x] T007 [US1] Update buildToolRegistry() signature to accept separator parameter with default ':' in src/registry.ts
- [x] T008 [US1] Update addServerTools() signature to accept separator parameter with default ':' in src/registry.ts
- [x] T009 [US1] Update removeServerTools() signature to accept separator parameter with default ':' in src/registry.ts
- [x] T010 [US1] Update parseToolPrefix() signature to accept separator parameter with default ':' in src/server.ts
- [x] T011 [US1] Update setupToolCallHandler() signature to accept separator parameter with default ':' in src/server.ts
- [x] T012 [US1] Pass separator parameter from main() to buildToolRegistry() in src/index.ts
- [x] T013 [US1] Pass separator parameter from buildToolRegistry() to addServerTools() in src/registry.ts
- [x] T014 [US1] Pass separator parameter from main() to setupToolCallHandler() in src/index.ts
- [x] T015 [US1] Pass separator parameter from setupToolCallHandler() to parseToolPrefix() in src/server.ts
- [x] T016 [US1] Run tests to verify US1 passes: npm test

**Checkpoint**: User Story 1 complete - backward compatibility verified with default ':' separator ✅

---

## Phase 4: User Story 2 - Custom Separator via CLI (Priority: P2)

**Goal**: Enable users to specify custom separators (e.g., `__`, `.`) via --separator CLI argument, with all tools using the custom separator format

**Independent Test**: Start aggregator with `--separator "__"` and verify all tools use double-underscore format (e.g., `github__create_issue`) and tool calls route correctly

**Dependencies**: Phase 3 (US1) complete

### Tests for User Story 2 - Write FIRST (TDD)

> **TDD: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T017 [P] [US2] Write unit test for parseCliArgs() parsing --separator argument in tests/unit/cli.test.ts
- [x] T018 [P] [US2] Write unit test for parseCliArgs() parsing --separator=value format in tests/unit/cli.test.ts
- [x] T019 [P] [US2] Write unit test for addServerTools() with custom separator '__' in tests/unit/registry.test.ts
- [x] T020 [P] [US2] Write unit test for addServerTools() with multi-character separator '::' in tests/unit/registry.test.ts
- [x] T021 [P] [US2] Write unit test for parseToolPrefix() with custom separator '__' in tests/unit/server.test.ts
- [x] T022 [P] [US2] Write unit test for parseToolPrefix() with dot separator '.' in tests/unit/server.test.ts
- [x] T023 [P] [US2] Write unit test for parseToolPrefix() handling multi-character separators in tests/unit/server.test.ts
- [x] T024 [P] [US2] Write integration test for custom separator '__' end-to-end flow in tests/integration/separator.test.ts

### Implementation for User Story 2

- [x] T025 [US2] Add --separator argument parsing to parseCliArgs() function in src/index.ts
- [x] T026 [US2] Update prefixedName construction to use separator parameter in addServerTools() in src/registry.ts
- [x] T027 [US2] Update prefix construction to use separator parameter in removeServerTools() in src/registry.ts
- [x] T028 [US2] Update parseToolPrefix() to use indexOf(separator) instead of indexOf(':') in src/server.ts
- [x] T029 [US2] Update parseToolPrefix() boundary check for multi-character separators (length - separator.length) in src/server.ts
- [x] T030 [US2] Update parseToolPrefix() slice logic to use separator.length for multi-character support in src/server.ts
- [x] T031 [US2] Update error message in setupToolCallHandler() to include dynamic separator in expected format in src/server.ts
- [x] T032 [US2] Update printHelp() to document --separator argument with examples in src/index.ts
- [x] T033 [US2] Run tests to verify US2 passes: npm test

**Checkpoint**: User Story 2 complete - custom separators working via CLI argument ✅

---

## Phase 5: User Story 3 - Separator Validation (Priority: P3)

**Goal**: Reject invalid separators (empty string, whitespace) with clear error messages before aggregator starts

**Independent Test**: Attempt to start aggregator with invalid separators and verify appropriate error messages are shown

**Dependencies**: Phase 4 (US2) complete

### Tests for User Story 3 - Write FIRST (TDD)

> **TDD: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T034 [P] [US3] Write unit test for validateSeparator() rejecting empty string in tests/unit/cli.test.ts
- [ ] T035 [P] [US3] Write unit test for validateSeparator() rejecting whitespace characters in tests/unit/cli.test.ts
- [ ] T036 [P] [US3] Write unit test for validateSeparator() accepting multi-character separators in tests/unit/cli.test.ts
- [ ] T037 [P] [US3] Write unit test for parseToolPrefix() rejecting prefixed names without separator in tests/unit/server.test.ts
- [ ] T038 [P] [US3] Write unit test for parseToolPrefix() rejecting empty serverKey in tests/unit/server.test.ts
- [ ] T039 [P] [US3] Write unit test for parseToolPrefix() rejecting empty toolName in tests/unit/server.test.ts
- [ ] T040 [P] [US3] Write integration test for empty separator rejection in tests/integration/separator.test.ts
- [ ] T041 [P] [US3] Write integration test for whitespace separator rejection in tests/integration/separator.test.ts

### Implementation for User Story 3

- [ ] T042 [US3] Implement validateSeparator() function with empty string check in src/index.ts
- [ ] T043 [US3] Implement validateSeparator() function with whitespace regex check (/\s/.test()) in src/index.ts
- [ ] T044 [US3] Add clear error message for empty separator in validateSeparator() in src/index.ts
- [ ] T045 [US3] Add clear error message for whitespace separator in validateSeparator() in src/index.ts
- [ ] T046 [US3] Call validateSeparator() in main() after parsing CLI args (when args.separator is provided) in src/index.ts
- [ ] T047 [US3] Run tests to verify US3 passes: npm test

**Checkpoint**: User Story 3 complete - validation prevents invalid separators ✅

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final touches, documentation, and verification

- [ ] T048 [P] Add debug logging for separator value in main() using logDebug() in src/index.ts
- [ ] T049 [P] Run full test suite with coverage: npm run test:coverage
- [ ] T050 [P] Verify ≥80% code coverage for new code
- [ ] T051 [P] Run TypeScript type checking: npm run lint
- [ ] T052 [P] Verify no type errors in strict mode
- [ ] T053 Manual test: Start aggregator with --separator "__" and verify tool listing
- [ ] T054 Manual test: Call tool with custom separator and verify routing works
- [ ] T055 Manual test: Test with various separator formats (., ::, --, etc.)
- [ ] T056 [P] Update CHANGELOG.md with --separator argument documentation
- [ ] T057 [P] Update README.md with custom separator examples

**Checkpoint**: Feature complete and polished ✅

---

## Implementation Strategy

### MVP Scope (Minimum Viable Product)

**Recommended MVP**: User Story 1 (Phase 3) ONLY
- Ensures backward compatibility
- Threads separator parameter through the system
- Sets up foundation for custom separators
- Testable independently

**Time Estimate**: 2-3 hours

### Full Feature Scope

**Phases to deliver after MVP**:
1. Phase 4 (US2): Custom separator functionality - 1-2 hours
2. Phase 5 (US3): Validation and error handling - 1 hour
3. Phase 6: Polish and documentation - 30 minutes

**Total Time Estimate**: 4-6 hours

### Parallel Execution Opportunities

#### Phase 2 (Foundational)
No parallelization - single task

#### Phase 3 (User Story 1)

**Parallel Batch 1 - Tests** (T002-T005):
```bash
# All test files can be written in parallel
- T002: tests/unit/cli.test.ts
- T003: tests/unit/registry.test.ts
- T004: tests/unit/server.test.ts
- T005: tests/integration/separator.test.ts
```

**Sequential Batch 2 - Implementation** (T006-T015):
- Must be done sequentially due to function call dependencies
- Each function signature change must be complete before call sites are updated

**Single Task 3 - Verification** (T016):
- Run tests after implementation

#### Phase 4 (User Story 2)

**Parallel Batch 1 - Tests** (T017-T024):
```bash
# All test files can be written in parallel
- T017-T018: tests/unit/cli.test.ts
- T019-T020: tests/unit/registry.test.ts
- T021-T023: tests/unit/server.test.ts
- T024: tests/integration/separator.test.ts
```

**Parallel Batch 2 - Independent Implementations** (T025, T026-T027, T028-T031):
```bash
# Three parallel groups working on different files
Group A: T025 - src/index.ts (CLI parsing)
Group B: T026-T027 - src/registry.ts (prefixing logic)
Group C: T028-T031 - src/server.ts (parsing logic)
```

**Sequential Batch 3 - Help and Verification** (T032-T033):
- T032: Update help text
- T033: Run tests

#### Phase 5 (User Story 3)

**Parallel Batch 1 - Tests** (T034-T041):
```bash
# All test files can be written in parallel
- T034-T036: tests/unit/cli.test.ts
- T037-T039: tests/unit/server.test.ts
- T040-T041: tests/integration/separator.test.ts
```

**Sequential Batch 2 - Implementation** (T042-T046):
- Validation function implementation (T042-T045)
- Integration into main() (T046)

**Single Task 3 - Verification** (T047):
- Run tests

#### Phase 6 (Polish)

**Parallel Batch 1 - Independent Polish Tasks** (T048-T052, T056-T057):
```bash
# Can all be done in parallel
- T048: Add debug logging
- T049-T052: Testing and linting
- T056: Update CHANGELOG
- T057: Update README
```

**Sequential Batch 2 - Manual Testing** (T053-T055):
- Manual verification tasks (must be done after implementation)

---

## Dependencies Diagram

```text
T001 (Type definitions)
  ↓
Phase 3 (US1) Tests: T002 [P] T003 [P] T004 [P] T005
  ↓
Phase 3 (US1) Implementation: T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015
  ↓
T016 (Verify US1)
  ↓
Phase 4 (US2) Tests: T017 [P] T018 [P] T019 [P] T020 [P] T021 [P] T022 [P] T023 [P] T024
  ↓
Phase 4 (US2) Implementation: T025 [P] (T026 + T027) [P] (T028 + T029 + T030 + T031) → T032
  ↓
T033 (Verify US2)
  ↓
Phase 5 (US3) Tests: T034 [P] T035 [P] T036 [P] T037 [P] T038 [P] T039 [P] T040 [P] T041
  ↓
Phase 5 (US3) Implementation: T042 → T043 → T044 → T045 → T046
  ↓
T047 (Verify US3)
  ↓
Phase 6: T048 [P] T049 [P] T050 [P] T051 [P] T052 [P] T056 [P] T057 → T053 → T054 → T055
```

---

## Task Summary

**Total Tasks**: 57

**By Phase**:
- Phase 1 (Setup): 0 tasks (no setup needed)
- Phase 2 (Foundational): 1 task
- Phase 3 (US1): 15 tasks (4 tests + 10 implementation + 1 verification)
- Phase 4 (US2): 17 tasks (8 tests + 8 implementation + 1 verification)
- Phase 5 (US3): 14 tasks (8 tests + 6 implementation + 1 verification)
- Phase 6 (Polish): 10 tasks (8 automated + 2 manual)

**By Type**:
- Test tasks: 24 (42% - strong TDD focus)
- Implementation tasks: 25 (44%)
- Verification tasks: 3 (5%)
- Documentation/Polish tasks: 5 (9%)

**Parallel Opportunities**:
- 24 tasks marked [P] can be parallelized
- Estimated 40% time savings with parallel execution

**Independent Test Criteria**:
- **US1**: Start without --separator, verify colon-separated tool names
- **US2**: Start with --separator "__", verify double-underscore tool names and routing
- **US3**: Start with invalid separators, verify error messages

---

## Format Validation

✅ All tasks follow required format:
- Checkbox: `- [ ]`
- Task ID: Sequential (T001-T057)
- [P] marker: Present for parallelizable tasks
- [Story] label: Present for user story tasks (US1, US2, US3)
- Description: Includes action and file path
- No template placeholders remain

✅ Task organization:
- Grouped by user story (Phases 3, 4, 5)
- Each story independently testable
- Clear checkpoints after each phase
- Dependencies documented

✅ Path conventions:
- All paths are absolute or repository-relative
- Single project structure (src/, tests/)
- File paths specified for every task

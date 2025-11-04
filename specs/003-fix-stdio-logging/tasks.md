# Tasks: Fix Stdio Logging Protocol Pollution

**Input**: Design documents from `/specs/003-fix-stdio-logging/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks are included based on constitution requirement (Test-First Development principle).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- All paths are absolute from repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization - no new infrastructure needed for this bug fix

**Status**: ✅ Already complete - existing TypeScript project with vitest testing

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core logger infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T001 [P] Write unit test for setDebugMode() in tests/unit/logger.test.ts
- [x] T002 [P] Write unit test for setLogFile() creates WriteStream in tests/unit/logger.test.ts
- [x] T003 [P] Write unit test for logInfo() respects debug mode in tests/unit/logger.test.ts
- [x] T004 [P] Write unit test for logInfo() writes to file with timestamp in tests/unit/logger.test.ts
- [x] T005 [P] Write unit test for logError() always logs regardless of debug mode in tests/unit/logger.test.ts
- [x] T006 [P] Write unit test for file creation error handling in tests/unit/logger.test.ts
- [x] T007 Add fs.WriteStream import to src/logger.ts
- [x] T008 Add logStream variable (WriteStream | null) to src/logger.ts
- [x] T009 Implement setLogFile(filePath: string) function in src/logger.ts with error handler
- [x] T010 Modify logInfo() to write to logStream instead of console.error in src/logger.ts
- [x] T011 Modify logDebug() to write to logStream instead of console.error in src/logger.ts
- [x] T012 Modify logError() to write to logStream with unconditional behavior in src/logger.ts
- [x] T013 Add timestamp formatting to log output in src/logger.ts
- [x] T014 Add log level tags ([INFO], [DEBUG], [ERROR]) to output format in src/logger.ts
- [ ] T015 Run unit tests for logger module to verify all tests pass
- [ ] T016 Add --log-file to CLI arg schema in src/index.ts
- [ ] T017 Add log file initialization logic after setDebugMode() in src/index.ts
- [ ] T018 Import setLogFile from logger.ts in src/index.ts
- [ ] T019 Run TypeScript compilation to verify no type errors

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Clean JSON-RPC Communication (Priority: P1) 🎯 MVP

**Goal**: Ensure only valid JSON-RPC messages appear on stdout and stderr when operating in stdio mode

**Independent Test**: Run aggregator without --debug flag and verify only JSON-RPC messages on stdio, no informational logs

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T020 [P] [US1] Write integration test for stdio cleanliness without --debug in tests/integration/stdio-clean.test.ts
- [ ] T021 [P] [US1] Write integration test to verify every stdout line is valid JSON-RPC in tests/integration/stdio-clean.test.ts
- [ ] T022 [P] [US1] Write integration test to verify every stderr line is valid JSON-RPC in tests/integration/stdio-clean.test.ts
- [ ] T023 [US1] Run integration tests and verify they FAIL (expected - code not yet modified)

### Implementation for User Story 1

- [ ] T024 [US1] Remove logInfo('Aggregator server started successfully') from src/index.ts line 177
- [ ] T025 [US1] Remove logInfo for serving child servers message from src/index.ts line 178
- [ ] T026 [US1] Remove logInfo('[INFO] MCP Aggregator Server started on stdio') from src/server.ts line 146
- [ ] T027 [US1] Build project with npm run build
- [ ] T028 [US1] Run integration tests and verify they PASS
- [ ] T029 [US1] Manual test: spawn aggregator without --debug and verify no non-JSON-RPC output

**Checkpoint**: At this point, User Story 1 should be fully functional - aggregator produces clean JSON-RPC only

---

## Phase 4: User Story 2 - Debug Logging for Troubleshooting (Priority: P2)

**Goal**: Enable verbose logging to file for troubleshooting without breaking JSON-RPC protocol

**Independent Test**: Run with --debug --log-file and verify logs go to file while stdio remains clean

### Tests for User Story 2

- [ ] T030 [P] [US2] Write integration test for debug logging to file in tests/integration/stdio-clean.test.ts
- [ ] T031 [P] [US2] Write integration test to verify log file exists and has content in tests/integration/stdio-clean.test.ts
- [ ] T032 [P] [US2] Write integration test to verify stdio remains clean with --debug enabled in tests/integration/stdio-clean.test.ts
- [ ] T033 [P] [US2] Write integration test to verify log file contains timestamps and level tags in tests/integration/stdio-clean.test.ts
- [ ] T034 [US2] Run integration tests and verify they PASS (foundation already supports this)

### Implementation for User Story 2

- [ ] T035 [US2] Verify default log path uses process.pid for uniqueness in src/index.ts
- [ ] T036 [US2] Test file creation error handling by attempting invalid path
- [ ] T037 [US2] Manual test: run with --debug --log-file /tmp/test.log and verify file created
- [ ] T038 [US2] Manual test: verify log file contains timestamped entries with level tags
- [ ] T039 [US2] Manual test: verify stdio remains clean (only JSON-RPC) with --debug enabled

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - clean stdio + file logging

---

## Phase 5: User Story 3 - Error Visibility (Priority: P3)

**Goal**: Ensure critical errors are visible for production monitoring

**Independent Test**: Trigger fatal errors and verify appropriate handling (pre-transport vs post-transport)

### Tests for User Story 3

- [ ] T040 [P] [US3] Write unit test for fatal error before transport initialization in tests/unit/logger.test.ts
- [ ] T041 [P] [US3] Write integration test for fatal config error displays console.error in tests/integration/stdio-clean.test.ts
- [ ] T042 [US3] Run tests to verify error handling behavior

### Implementation for User Story 3

- [ ] T043 [US3] Review src/index.ts catch block (line 186-188) for fatal error handling
- [ ] T044 [US3] Verify console.error() is used for pre-transport fatal errors
- [ ] T045 [US3] Verify MCP error responses are used for post-transport runtime errors
- [ ] T046 [US3] Manual test: trigger fatal error (missing config) and verify console output
- [ ] T047 [US3] Manual test: verify existing tests still pass with error handling

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, final testing, and validation

- [ ] T048 [P] Update CLAUDE.md with debug logging section showing --debug and --log-file usage
- [ ] T049 [P] Update README.md (if exists) with CLI options documentation for --log-file
- [ ] T050 Run npm run test:coverage to verify ≥80% coverage for logger.ts
- [ ] T051 Run npm run lint to verify TypeScript type safety
- [ ] T052 Run all integration tests to verify no regressions
- [ ] T053 Verify quickstart.md steps against actual implementation
- [ ] T054 Manual test with Claude Desktop: configure aggregator and verify no JSON parsing errors
- [ ] T055 Clean up any temporary test files in /tmp

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: ✅ Already complete - existing project infrastructure
- **Foundational (Phase 2)**: No dependencies - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Builds on US1 but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Validates error handling independently

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Implementation tasks follow test tasks
- Manual testing verifies behavior
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 2 Foundational**: All unit test tasks (T001-T006) can run in parallel
- **Phase 3 User Story 1**: Test tasks (T020-T022) can run in parallel, implementation tasks (T024-T026) can run in parallel
- **Phase 4 User Story 2**: Test tasks (T030-T033) can run in parallel
- **Phase 5 User Story 3**: Test tasks (T040-T041) can run in parallel
- **Phase 6 Polish**: Documentation tasks (T048-T049) can run in parallel
- **Between Stories**: Once Foundational phase completes, all user stories CAN start in parallel if team capacity allows

---

## Parallel Example: Foundational Phase

```bash
# Launch all unit test tasks together (Phase 2):
Task: "Write unit test for setDebugMode() in tests/unit/logger.test.ts"
Task: "Write unit test for setLogFile() creates WriteStream in tests/unit/logger.test.ts"
Task: "Write unit test for logInfo() respects debug mode in tests/unit/logger.test.ts"
Task: "Write unit test for logInfo() writes to file with timestamp in tests/unit/logger.test.ts"
Task: "Write unit test for logError() always logs regardless of debug mode in tests/unit/logger.test.ts"
Task: "Write unit test for file creation error handling in tests/unit/logger.test.ts"
```

## Parallel Example: User Story 1

```bash
# Launch all integration test tasks together (Phase 3):
Task: "Write integration test for stdio cleanliness without --debug in tests/integration/stdio-clean.test.ts"
Task: "Write integration test to verify every stdout line is valid JSON-RPC in tests/integration/stdio-clean.test.ts"
Task: "Write integration test to verify every stderr line is valid JSON-RPC in tests/integration/stdio-clean.test.ts"

# After tests written, launch all removal tasks together:
Task: "Remove logInfo('Aggregator server started successfully') from src/index.ts line 177"
Task: "Remove logInfo for serving child servers message from src/index.ts line 178"
Task: "Remove logInfo('[INFO] MCP Aggregator Server started on stdio') from src/server.ts line 146"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (logger infrastructure) - **CRITICAL**
2. Complete Phase 3: User Story 1 (clean stdio) - **MVP**
3. **STOP and VALIDATE**: Test User Story 1 independently with Claude Desktop
4. Deploy/demo if ready

**Estimated Time**: ~2.5 hours for MVP (Foundational + US1)

### Incremental Delivery

1. Complete Phase 2: Foundational → Logger infrastructure ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP - fixes Claude Desktop!)
3. Add User Story 2 → Test independently → Deploy/Demo (adds debugging capability)
4. Add User Story 3 → Test independently → Deploy/Demo (adds error visibility)
5. Each story adds value without breaking previous stories

**Estimated Time**: ~3-4 hours for all user stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Foundational together (~1 hour)
2. Once Foundational is done:
   - Developer A: User Story 1 (clean stdio) - 30 minutes
   - Developer B: User Story 2 (debug logging) - 30 minutes
   - Developer C: User Story 3 (error visibility) - 20 minutes
3. Stories complete and integrate independently

**Estimated Time**: ~1.5 hours with parallelization

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story (US1, US2, US3) for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD approach)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Constitution compliance: Test-First Development (Principle II) enforced with TDD workflow
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

---

## Task Count Summary

- **Phase 1 (Setup)**: 0 tasks (infrastructure exists)
- **Phase 2 (Foundational)**: 19 tasks (6 parallel tests + 13 implementation)
- **Phase 3 (User Story 1)**: 10 tasks (3 parallel tests + 7 implementation)
- **Phase 4 (User Story 2)**: 10 tasks (4 parallel tests + 6 implementation)
- **Phase 5 (User Story 3)**: 8 tasks (2 parallel tests + 6 implementation)
- **Phase 6 (Polish)**: 8 tasks (2 parallel docs + 6 validation)
- **Total**: 55 tasks

**Parallel Opportunities**: 17 tasks can run in parallel (marked with [P])

**MVP Scope**: Phase 2 (T001-T019) + Phase 3 (T020-T029) = 29 tasks

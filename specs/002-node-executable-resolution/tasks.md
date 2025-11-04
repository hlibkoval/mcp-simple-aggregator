# Tasks: Node Executable Resolution for Child Servers

**Input**: Design documents from `/specs/002-node-executable-resolution/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/command-resolution.md

**Tests**: This feature follows Test-First Development (TDD) as required by the project constitution (Principle II).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- All paths are absolute from project root

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new infrastructure needed - using existing project structure

**Status**: ✅ SKIPPED - Project already initialized with all required dependencies

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

**Status**: ✅ SKIPPED - No foundational work needed. Existing `src/child-manager.ts` provides all infrastructure.

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Spawn Node-based Child Servers Reliably (Priority: P1) 🎯 MVP

**Goal**: Automatically resolve `"node"` command to `process.execPath` to prevent ENOENT errors and ensure child servers spawn successfully

**Independent Test**: Configure a child server with `command: "node"` and verify it spawns successfully even when PATH doesn't include node

### Tests for User Story 1 (TDD - Write FIRST) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T001 [P] [US1] Add unit test: resolveCommand("node") returns process.execPath in tests/unit/child-manager.test.ts
- [x] T002 [P] [US1] Add unit test: resolveCommand("python") returns "python" unchanged in tests/unit/child-manager.test.ts
- [x] T003 [P] [US1] Add unit test: resolveCommand("/usr/bin/node") returns absolute path unchanged in tests/unit/child-manager.test.ts
- [ ] T004 [US1] Add integration test: Child server spawns with command "node" in PATH-less environment in tests/integration/startup.test.ts

### Implementation for User Story 1

- [x] T005 [US1] Implement resolveCommand() function in src/child-manager.ts with basic "node" → process.execPath logic
- [x] T006 [US1] Add path.isAbsolute() check to preserve absolute paths in src/child-manager.ts
- [x] T007 [US1] Integrate resolveCommand() into connectToChild() before StdioClientTransport creation in src/child-manager.ts
- [x] T008 [US1] Verify all tests pass: npm test

**Checkpoint**: At this point, User Story 1 should be fully functional - child servers with `command: "node"` spawn successfully

---

## Phase 4: User Story 2 - Diagnostic Logging for Command Resolution (Priority: P2)

**Goal**: Add logging to show resolved executable paths for debugging

**Independent Test**: Spawn a child server with `command: "node"` and verify logs show "[INFO] Resolved 'node' to '/path/to/node'"

### Tests for User Story 2 (TDD - Write FIRST) ⚠️

- [x] T009 [P] [US2] Add unit test: resolveCommand() logs resolution when command changes in tests/unit/child-manager.test.ts
- [x] T010 [P] [US2] Add unit test: resolveCommand() does not log when command unchanged in tests/unit/child-manager.test.ts
- [ ] T011 [US2] Add integration test: Verify resolution logs appear in child startup flow in tests/integration/startup.test.ts

### Implementation for User Story 2

- [x] T012 [US2] Add console.log with [INFO] prefix when resolvedCommand !== command in src/child-manager.ts
- [ ] T013 [US2] Include serverKey in log message for clarity in src/child-manager.ts
- [x] T014 [US2] Verify all tests pass: npm test

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - resolution works with visible logging

---

## Phase 5: User Story 3 - npm/npx Command Resolution (Priority: P3)

**Goal**: Extend resolution to npm/npx commands by checking same directory as parent's node

**Independent Test**: Configure a child server with `command: "npm"` and verify it spawns using npm from node's directory

### Tests for User Story 3 (TDD - Write FIRST) ⚠️

- [x] T015 [P] [US3] Add unit test: resolveCommand("npm") resolves to dirname(process.execPath)/npm if exists in tests/unit/child-manager.test.ts
- [x] T016 [P] [US3] Add unit test: resolveCommand("npx") resolves to dirname(process.execPath)/npx if exists in tests/unit/child-manager.test.ts
- [x] T017 [P] [US3] Add unit test: resolveCommand("npm") returns "npm" if not found (fallback) in tests/unit/child-manager.test.ts
- [x] T018 [P] [US3] Add unit test: Windows - resolveCommand("npm") checks for .cmd extension in tests/unit/child-manager.test.ts
- [ ] T019 [US3] Add integration test: Child server spawns with command "npm" in tests/integration/startup.test.ts

### Implementation for User Story 3

- [x] T020 [US3] Import path and fs modules in src/child-manager.ts
- [x] T021 [US3] Add npm/npx detection logic in resolveCommand() in src/child-manager.ts
- [x] T022 [US3] Implement path.dirname(process.execPath) directory check in src/child-manager.ts
- [x] T023 [US3] Add Windows .cmd extension check (process.platform === 'win32') in src/child-manager.ts
- [x] T024 [US3] Add fallback to original command if npm/npx not found in src/child-manager.ts
- [x] T025 [US3] Verify all tests pass: npm test

**Checkpoint**: All user stories should now be independently functional - node, npm, and npx all resolve correctly

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, and final validation

- [x] T026 [P] Update README.md with automatic command resolution behavior
- [x] T027 [P] Add JSDoc comments to resolveCommand() function in src/child-manager.ts
- [x] T028 Run full test suite with coverage: npm run test:coverage
- [x] T029 Verify 100% coverage for new resolveCommand() function
- [x] T030 Run linter: npm run lint
- [x] T031 Run build: npm run build
- [x] T032 Validate quickstart.md examples manually
- [x] T033 [P] Update CHANGELOG.md with new feature description
- [x] T034 Final review: Verify all acceptance scenarios from spec.md are met

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: ✅ SKIPPED - Already complete
- **Foundational (Phase 2)**: ✅ SKIPPED - No blocking work needed
- **User Stories (Phase 3-5)**: Can proceed immediately
  - User Story 1 (P1) → Must complete first (MVP)
  - User Story 2 (P2) → Can start after US1 or in parallel
  - User Story 3 (P3) → Can start after US1 or in parallel
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies - Can start immediately (MVP)
- **User Story 2 (P2)**: Depends on US1 (adds logging to existing resolveCommand())
- **User Story 3 (P3)**: Independent of US2 (extends resolveCommand() logic)

**Recommended Order**: US1 → US2 → US3 (priority order for sequential execution)

**Parallel Option**: US1 → (US2 + US3 in parallel) if team has capacity

### Within Each User Story

1. **Tests FIRST** (TDD approach):
   - Write unit tests marked [P] in parallel
   - Write integration tests
   - Ensure all tests FAIL (no implementation yet)

2. **Implementation**:
   - Add minimal code to make tests pass
   - Verify tests pass after each change

3. **Validation**:
   - Run full test suite
   - Verify story independently testable

### Parallel Opportunities

- ✅ All unit tests within a story marked [P] can run in parallel
- ✅ US2 and US3 can be implemented in parallel (modify different parts of resolveCommand())
- ✅ Documentation tasks (T026, T027, T033) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Write all tests for User Story 1 together (TDD):
# Task T001: "resolveCommand('node') returns process.execPath"
# Task T002: "resolveCommand('python') returns 'python' unchanged"
# Task T003: "resolveCommand('/usr/bin/node') preserves absolute path"

# Then implement to make tests pass:
# Task T005: Implement resolveCommand() function
# Task T006: Add absolute path check
# Task T007: Integrate into connectToChild()
```

---

## Parallel Example: User Story 2 + 3 (If Parallel Execution)

```bash
# Developer A works on User Story 2 (Logging):
# Task T009-T011: Write logging tests
# Task T012-T014: Add logging to resolveCommand()

# Developer B works on User Story 3 (npm/npx) AT SAME TIME:
# Task T015-T019: Write npm/npx tests
# Task T020-T025: Extend resolveCommand() for npm/npx

# Both modify resolveCommand() but different aspects - merge carefully
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. ✅ SKIP Phase 1: Setup (already complete)
2. ✅ SKIP Phase 2: Foundational (no blocking work)
3. ✅ Complete Phase 3: User Story 1 (T001-T008)
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Verify child servers with `command: "node"` spawn successfully
   - Test with PATH not containing node
   - Confirm version consistency
5. **MVP READY**: Feature is usable with core functionality

### Incremental Delivery

1. **MVP (US1)**: node command resolution → Test → Ship ✅
2. **v1.1 (US2)**: Add logging → Test → Ship
3. **v1.2 (US3)**: Add npm/npx support → Test → Ship
4. Each story adds value without breaking previous stories

### Sequential Execution (Single Developer)

**Estimated Total**: ~4-6 hours

1. **User Story 1** (~2 hours):
   - T001-T004: Write tests (30 min)
   - T005-T007: Implement (60 min)
   - T008: Validate (30 min)

2. **User Story 2** (~1 hour):
   - T009-T011: Write tests (15 min)
   - T012-T013: Add logging (30 min)
   - T014: Validate (15 min)

3. **User Story 3** (~1.5 hours):
   - T015-T019: Write tests (30 min)
   - T020-T025: Implement npm/npx (45 min)
   - Validate (15 min)

4. **Polish** (~30 min):
   - T026-T034: Documentation and final checks

### Parallel Team Strategy

With two developers:

1. **Both**: Complete User Story 1 together (MVP) - ~2 hours
2. **Split**:
   - Developer A: User Story 2 (logging) - ~1 hour
   - Developer B: User Story 3 (npm/npx) - ~1.5 hours
3. **Both**: Merge and complete Polish phase - ~30 min

**Total Time**: ~3.5 hours (vs 6 hours sequential) - 42% faster

---

## Test Coverage Requirements

Per constitution (Principle II: Test-First Development):

- ✅ Minimum 80% code coverage for new code
- ✅ All tests must pass before merge
- ✅ Tests written BEFORE implementation (TDD)

**Expected Coverage**:
- `resolveCommand()` function: 100% coverage (simple pure function)
- Integration with `connectToChild()`: Covered by existing + new integration tests
- Edge cases: All acceptance scenarios from spec.md have tests

---

## Notes

- [P] tasks = different files or independent test cases, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- **TDD Workflow**: Write tests → Ensure they FAIL → Implement → Ensure tests PASS
- Commit after each task or logical group (T001-T004, T005-T008, etc.)
- Stop at any checkpoint to validate story independently
- All modifications are in `src/child-manager.ts` and test files (minimal scope)
- No new dependencies or files needed (pure enhancement of existing code)

---

## Task Count Summary

- **Total Tasks**: 34
- **User Story 1 (MVP)**: 8 tasks (T001-T008)
- **User Story 2**: 6 tasks (T009-T014)
- **User Story 3**: 11 tasks (T015-T025)
- **Polish**: 9 tasks (T026-T034)

**Parallel Opportunities**:
- 9 tasks marked [P] can run in parallel (26% of total)
- 2 user stories (US2, US3) can run in parallel after US1

**MVP Scope**: First 8 tasks deliver core functionality (24% of total effort for 80% of value)

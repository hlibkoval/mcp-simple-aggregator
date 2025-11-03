<!--
SYNC IMPACT REPORT
==================
Version Change: Initial → 1.0.0
Rationale: First version of constitution establishing core principles for code quality,
           testing standards, user experience consistency, and performance requirements.

Modified Principles:
- All principles are newly added (initial constitution)

Added Sections:
- Core Principles (5 principles)
- Development Standards
- Quality Gates
- Governance

Removed Sections:
- None (initial version)

Templates Status:
✅ plan-template.md - Constitution Check section aligns with principles
✅ spec-template.md - Requirements section aligns with quality standards
✅ tasks-template.md - Test-first approach and structure match principles
✅ checklist-template.md - No changes required (generic template)
✅ agent-file-template.md - No changes required (generic template)

Follow-up TODOs:
- None (all placeholders filled)
-->

# MCP Simple Aggregator Constitution

## Core Principles

### I. Code Quality First

All code MUST meet quality standards before merging:
- Type safety enforced (TypeScript strict mode or equivalent)
- No unused variables, functions, or imports
- Clear, self-documenting naming conventions
- Complexity metrics within acceptable bounds (cyclomatic complexity <10 per function)
- Code reviews required for all changes

**Rationale**: Quality code reduces maintenance burden, prevents bugs, and ensures long-term
project sustainability. Quality gates at commit time prevent technical debt accumulation.

### II. Test-First Development (NON-NEGOTIABLE)

Testing discipline MUST be followed:
- Unit tests required for all business logic
- Integration tests required for external interfaces (MCP server interactions)
- Tests MUST be written before implementation (TDD when practical)
- Minimum 80% code coverage for new code
- All tests MUST pass before merge

**Rationale**: Test-first development catches bugs early, documents expected behavior, and
enables confident refactoring. Integration tests are critical for MCP aggregation correctness.

### III. User Experience Consistency

User-facing interfaces MUST provide consistent, predictable experiences:
- Error messages MUST be clear, actionable, and user-friendly
- API contracts MUST be versioned and backward-compatible within major versions
- Configuration formats MUST be validated with helpful error messages
- Performance degradation MUST be visible to users (logging, metrics)
- Documentation MUST be updated alongside interface changes

**Rationale**: Consistency builds user trust and reduces support burden. Clear errors and
validated configuration prevent user frustration and debugging time.

### IV. Performance by Design

Performance MUST be considered from initial design:
- Latency targets defined in specifications (p95 latency goals)
- Resource limits documented and enforced (memory, connections)
- Concurrent operations handled safely (async/await patterns)
- Bottlenecks identified and mitigated during design phase
- Performance regression tests for critical paths

**Rationale**: Retrofitting performance is expensive. Defining targets early ensures
architecture decisions support performance requirements. MCP aggregation involves I/O
multiplexing requiring careful async design.

### V. Simplicity and Maintainability

Prefer simple, maintainable solutions over clever abstractions:
- YAGNI (You Aren't Gonna Need It) principle enforced
- Maximum 3 levels of abstraction for any feature
- Avoid premature optimization
- Refactor when complexity exceeds thresholds
- Document non-obvious design decisions inline

**Rationale**: Simple code is easier to understand, modify, and debug. Over-engineering
increases cognitive load and maintenance cost without proportional value.

## Development Standards

### Code Structure

- Single responsibility principle for modules and functions
- Dependency injection for testability
- Explicit error handling (no silent failures)
- Logging at appropriate levels (debug, info, warn, error)
- Configuration externalized from code

### Testing Standards

- Unit tests: Fast, isolated, deterministic
- Integration tests: Cover external dependencies (MCP servers)
- Contract tests: Validate MCP protocol compliance
- Tests MUST be runnable locally without external dependencies (mocking where needed)
- Flaky tests are treated as failing tests

### Documentation Requirements

- README with setup, usage, and examples
- API documentation generated from code annotations
- Architecture decision records (ADRs) for significant choices
- Inline comments for complex logic only (code should self-document)
- Changelog maintained for user-facing changes

## Quality Gates

All features MUST pass these gates before considered complete:

1. **Code Review Gate**: At least one approval from peer reviewer
2. **Test Gate**: All tests passing, coverage ≥80% for new code
3. **Type Safety Gate**: No type errors, strict mode enabled
4. **Performance Gate**: No regressions in latency/memory benchmarks
5. **Documentation Gate**: User-facing changes documented

Violations MUST be justified in plan.md Complexity Tracking table with:
- What standard is being violated
- Why the violation is necessary
- What simpler alternative was rejected and why

## Governance

This constitution supersedes all other development practices. Changes to this constitution require:

1. **Proposal**: Document proposed change with rationale
2. **Review**: Discussion with project maintainers
3. **Approval**: Consensus from maintainers
4. **Migration Plan**: If change affects existing code, migration path documented
5. **Version Bump**: Constitution version incremented per semantic versioning

**Amendment Rules**:
- MAJOR version: Principle removed or redefined incompatibly
- MINOR version: New principle added or existing principle materially expanded
- PATCH version: Clarifications, wording improvements, typo fixes

**Compliance**:
- All code reviews MUST verify adherence to constitution principles
- Exceptions MUST be documented in Complexity Tracking section
- Regular audits to ensure ongoing compliance
- Constitution violations justify blocking merge requests

**Version**: 1.0.0 | **Ratified**: 2025-11-03 | **Last Amended**: 2025-11-03
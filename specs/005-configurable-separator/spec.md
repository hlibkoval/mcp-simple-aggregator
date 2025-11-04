# Feature Specification: Configurable Tool Name Separator

**Feature Branch**: `005-configurable-separator`
**Created**: 2025-11-04
**Status**: Draft
**Input**: User description: "instead of using a static ':' to separate namespace from the tool name, the separator must be configurable. ':' is default, but something like '__' must be supported. the separator can be passed as a cli argument"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Default Colon Separator (Priority: P1)

A user runs the MCP aggregator without specifying a separator and expects tools to be namespaced with the default colon separator (e.g., `sourcebot:search_code`). This maintains backward compatibility with existing deployments.

**Why this priority**: This is the most critical story because it ensures backward compatibility. Existing users and configurations must continue working without changes.

**Independent Test**: Can be fully tested by starting the aggregator with any valid config and verifying that tools are listed with colon-separated names (e.g., `serverkey:toolname`), delivering immediate value to existing users.

**Acceptance Scenarios**:

1. **Given** aggregator is started without separator argument, **When** tools are listed, **Then** tool names use colon separator (e.g., `github:create_issue`)
2. **Given** aggregator is started without separator argument, **When** tools are called using colon format, **Then** calls are routed correctly to child servers

---

### User Story 2 - Custom Separator via CLI (Priority: P2)

A user needs to use a different separator (e.g., `__`) because their MCP client or environment has conflicts with the colon character. They start the aggregator with a CLI argument specifying the custom separator.

**Why this priority**: This is the core new functionality that addresses the stated need. It enables users who have conflicts with colons to use alternative separators.

**Independent Test**: Can be fully tested by starting the aggregator with `--separator "__"` and verifying all tools use double-underscore format (e.g., `serverkey__toolname`), delivering value to users with separator conflicts.

**Acceptance Scenarios**:

1. **Given** aggregator is started with `--separator "__"`, **When** tools are listed, **Then** tool names use double-underscore separator (e.g., `github__create_issue`)
2. **Given** aggregator is started with `--separator "__"`, **When** tools are called using double-underscore format, **Then** calls are routed correctly to child servers
3. **Given** aggregator is started with `--separator "."`, **When** tools are listed, **Then** tool names use dot separator (e.g., `github.create_issue`)

---

### User Story 3 - Separator Validation (Priority: P3)

A user attempts to start the aggregator with an invalid separator (e.g., empty string, whitespace, or special characters that could break tool naming). The system rejects the invalid separator and provides clear error messaging.

**Why this priority**: This is important for robustness but not critical for MVP. The feature can work without extensive validation initially.

**Independent Test**: Can be fully tested by attempting to start the aggregator with various invalid separators and verifying appropriate error messages are shown.

**Acceptance Scenarios**:

1. **Given** user starts aggregator with empty separator `--separator ""`, **When** aggregator initializes, **Then** error message explains separator cannot be empty
2. **Given** user starts aggregator with whitespace separator `--separator " "`, **When** aggregator initializes, **Then** error message explains separator cannot contain whitespace
3. **Given** user starts aggregator with multi-character separator `--separator ":::"`, **When** aggregator initializes, **Then** separator is accepted (multi-character separators are valid)

---

### Edge Cases

- What happens when a tool name already contains the configured separator character (e.g., tool named `search:code` with separator `:`)? System should still namespace it (e.g., `github:search:code`), accepting that the separator appears multiple times.
- How does the system handle very long separators (e.g., 50+ characters)? System should accept them but may result in very long tool names.
- What happens when separator is changed between runs? Tools are re-registered with new separator on next startup (no migration needed).
- How does system handle unicode or special characters as separators? System should accept any non-whitespace string as separator.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept an optional `--separator` CLI argument that specifies the character(s) to use between server key and tool name
- **FR-002**: System MUST use colon (`:`) as the default separator when no `--separator` argument is provided
- **FR-003**: System MUST namespace all child server tools using the configured separator (e.g., `serverkey{separator}toolname`)
- **FR-004**: System MUST correctly parse incoming tool calls to extract server key using the configured separator
- **FR-005**: System MUST reject empty string as separator value
- **FR-006**: System MUST reject separators containing whitespace characters (space, tab, newline)
- **FR-007**: System MUST support single-character separators (e.g., `:`, `-`, `_`, `.`)
- **FR-008**: System MUST support multi-character separators (e.g., `__`, `::`, `--`)
- **FR-009**: System MUST provide clear error message when invalid separator is specified
- **FR-010**: System MUST display the configured separator value in debug logs (when debug mode enabled)

### Key Entities

- **Separator Configuration**: Represents the character(s) used to separate server key from tool name. Default value is `:`. Configurable via CLI argument. Used during tool registration and tool call parsing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can start the aggregator without any separator argument and all tools work with colon separator (backward compatibility maintained)
- **SC-002**: Users can specify `--separator "__"` and all tools are namespaced with double-underscore format within 1 second of startup
- **SC-003**: Tool calls using the custom separator are routed correctly to child servers 100% of the time
- **SC-004**: Invalid separator values (empty, whitespace) are rejected before aggregator starts, with clear error messages displayed
- **SC-005**: Debug logs show the configured separator value on every aggregator startup

## Assumptions

- Users who need custom separators know which separator to use for their environment
- Separator conflicts within tool names (e.g., tool named `search:code` with separator `:`) are acceptable edge cases that don't need special handling
- Separator choice does not need to be persisted across runs (CLI argument each time is acceptable)
- Standard separator options will be short strings (1-5 characters typically)

## Scope

### In Scope

- Adding `--separator` CLI argument
- Using custom separator for tool registration (name prefixing)
- Using custom separator for tool call parsing (name splitting)
- Validation of separator value (no empty, no whitespace)
- Maintaining backward compatibility with default colon separator

### Out of Scope

- Persisting separator choice in config files
- Migrating or converting tool names between different separators
- Special handling for tools whose names contain the separator character
- Separator auto-detection based on environment
- Allowing different separators for different child servers
- Escaping or encoding separators within tool names

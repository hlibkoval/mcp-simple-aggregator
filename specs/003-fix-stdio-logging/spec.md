# Feature Specification: Fix Stdio Logging Protocol Pollution

**Feature Branch**: `003-fix-stdio-logging`
**Created**: 2025-11-04
**Status**: Draft
**Input**: User description: "Fix stderr logging that pollutes JSON-RPC protocol communication in MCP stdio transport"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean JSON-RPC Communication (Priority: P1)

As an MCP client (like Claude Desktop), I need the aggregator server to communicate exclusively via JSON-RPC protocol on stdio transport, so that I can properly parse all messages without encountering unexpected text that breaks my JSON parser.

**Why this priority**: This is the core bug fix. Without clean JSON-RPC communication, the server is unusable in Claude Desktop and other strict MCP clients. This represents the minimum viable fix.

**Independent Test**: Can be fully tested by running the aggregator without --debug flag and verifying that only valid JSON-RPC messages appear on both stdout and stderr. Delivers immediate value by making the server work correctly with Claude Desktop.

**Acceptance Scenarios**:

1. **Given** aggregator is configured in Claude Desktop without --debug flag, **When** the server starts and runs normally, **Then** only valid JSON-RPC messages appear on stdout and stderr
2. **Given** aggregator is running in stdio mode, **When** a child server is initialized, **Then** no informational log messages pollute the JSON-RPC stream
3. **Given** aggregator serves tools successfully, **When** examining the stdio output, **Then** every line is valid JSON-RPC format

---

### User Story 2 - Debug Logging for Troubleshooting (Priority: P2)

As a developer integrating the MCP aggregator, I need the ability to enable verbose logging for troubleshooting issues, so that I can diagnose problems with child server initialization and tool routing without breaking the JSON-RPC protocol.

**Why this priority**: Essential for debugging but not required for normal operation. Developers need visibility into what the aggregator is doing when things go wrong.

**Independent Test**: Can be tested independently by running with --debug flag and verifying logs appear in a non-intrusive way (file or clearly separated from JSON-RPC). Delivers diagnostic capabilities without affecting P1 functionality.

**Acceptance Scenarios**:

1. **Given** aggregator is started with --debug flag, **When** the server initializes, **Then** detailed logs are written to a file without interfering with JSON-RPC communication on stdio
2. **Given** debug mode is enabled, **When** a child server fails to start, **Then** diagnostic information is captured in the debug log file for troubleshooting
3. **Given** debug mode is disabled, **When** the server runs, **Then** absolutely no log output appears that could interfere with protocol communication

---

### User Story 3 - Error Visibility (Priority: P3)

As a system administrator, I need critical errors to be visible even without debug mode, so that I can identify and resolve fatal issues without having to enable verbose logging.

**Why this priority**: Nice to have for production monitoring, but fatal errors typically prevent the server from starting anyway, making them self-evident.

**Independent Test**: Can be tested by triggering fatal errors (missing config, invalid JSON) and verifying appropriate error messages appear before the server exits. Delivers operational visibility for production environments.

**Acceptance Scenarios**:

1. **Given** aggregator encounters a fatal startup error, **When** the error occurs before JSON-RPC communication begins, **Then** a clear error message is displayed to help diagnose the issue
2. **Given** aggregator is running in stdio mode, **When** a fatal runtime error occurs, **Then** the error is communicated through MCP error responses rather than console output

---

### Edge Cases

- What happens when logging occurs before the MCP server transport is established? (During early initialization, console output may be acceptable for fatal errors)
- What if the log file cannot be created or written to (permission denied, disk full)?
- Should log files be rotated or appended to across multiple server runs?
- What if --log-file path is invalid or points to a directory?
- How to handle child server stderr output that might contain non-JSON text?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST produce only valid JSON-RPC messages on stdout when operating in stdio transport mode
- **FR-002**: System MUST produce only valid JSON-RPC messages on stderr when operating in stdio transport mode
- **FR-003**: System MUST suppress all informational log messages (logInfo, logDebug) by default when debug mode is not enabled
- **FR-004**: System MUST provide a --debug flag that enables verbose logging for troubleshooting
- **FR-005**: System MUST write debug logs to a file when --debug flag is enabled, ensuring logs do not interfere with JSON-RPC protocol communication on stdio
- **FR-005a**: System MUST provide a --log-file option to specify the debug log file path, with a reasonable default location if not specified
- **FR-006**: System MUST communicate all runtime errors through MCP error responses after the server transport is connected
- **FR-007**: System MUST allow fatal startup errors to display on console before JSON-RPC communication begins
- **FR-008**: System MUST maintain existing functionality while fixing logging behavior (no breaking changes to tool aggregation)

### Key Entities

- **Log Message**: Diagnostic information with severity level (info, debug, error), timestamp, and context
- **Debug Mode**: Boolean flag controlling whether diagnostic logs are captured/displayed
- **Transport State**: Whether the MCP server is pre-initialization (console safe) or post-initialization (JSON-RPC only)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Claude Desktop successfully connects to the aggregator and lists all tools without JSON parsing errors
- **SC-002**: Running aggregator without --debug flag produces zero non-JSON-RPC output on both stdout and stderr
- **SC-003**: All existing integration tests pass with the logging changes
- **SC-004**: Developers can enable debug mode and access diagnostic information without disrupting MCP protocol communication
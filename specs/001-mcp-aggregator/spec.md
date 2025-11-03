# Feature Specification: MCP Server Aggregator

**Feature Branch**: `001-mcp-aggregator`
**Created**: 2025-11-03
**Status**: Draft
**Input**: User description: "Build a simple MCP Server that will aggregate other servers. It must take a standard Claude-compatible MCP config json and expose the tools from the configured MCP servers as prefixed. For example, if there's an MCP server called 'sourcebot' with tool 'search_code', mcp-simple-aggregator will expose it as 'sourcebot:search_code'. The server must support passing through env variables and expansion of them in the config. No extra configuration is supported, only the default MCP config. Only stdio transport is supported"

## Clarifications

### Session 2025-11-03

- Q: Child Server Failure Recovery - What should happen when a child server crashes during operation? → A: Continue operating with remaining servers only (failed servers stay down)
- Q: Environment Variable Expansion Failure Handling - What happens if environment variable expansion results in empty or invalid values? → A: Fail startup with specific error message identifying missing variable
- Q: Logging and Observability - What level of operational visibility should the aggregator provide? → A: Log errors and warnings only (minimal logging)
- Q: Configuration Source - How is the configuration provided to the aggregator? → A: Command-line argument specifying config file path
- Q: Duplicate Server Names in Configuration - What happens when the same server is configured multiple times with different names? → A: Allow and treat as separate instances with distinct prefixes using the MCP server key from the config file as the prefix

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure and Start Aggregator (Priority: P1)

A developer wants to bundle multiple MCP servers into a single unified server that can be configured in Claude Desktop or other MCP clients, reducing the number of server connections needed.

**Why this priority**: This is the core functionality - without the ability to configure and start the aggregator with multiple child servers, no other features have value.

**Independent Test**: Can be fully tested by providing a valid MCP configuration JSON with 2+ servers, starting the aggregator, and verifying it successfully launches and connects to all child servers without errors.

**Acceptance Scenarios**:

1. **Given** a valid config file path provided as a command-line argument, **When** the aggregator starts, **Then** it reads the configuration from that file and successfully spawns all configured child servers via stdio transport
2. **Given** no config file path argument is provided, **When** the aggregator attempts to start, **Then** it fails with a clear error message indicating the required argument
3. **Given** a config with environment variables (e.g., `$HOME`, `${API_KEY}`), **When** the aggregator reads the config, **Then** it correctly expands all environment variables before passing them to child servers
4. **Given** a config with invalid JSON syntax, **When** the aggregator attempts to start, **Then** it provides a clear error message and fails gracefully
5. **Given** a config referencing an undefined environment variable, **When** the aggregator attempts to start, **Then** it fails immediately with an error message identifying the specific missing variable name
6. **Given** a child server that fails to start, **When** the aggregator initializes, **Then** it reports which specific server failed and provides diagnostic information

---

### User Story 2 - Discover Aggregated Tools (Priority: P2)

A client (like Claude Desktop) connects to the aggregator and wants to discover all available tools from all configured child servers, with each tool properly namespaced to avoid name collisions.

**Why this priority**: Tool discovery is essential for the client to know what functionality is available, and proper namespacing prevents conflicts between servers.

**Independent Test**: Can be tested by configuring 2 servers with different tools, connecting a client, listing tools, and verifying each tool appears with the correct prefix (e.g., `serverName:toolName`).

**Acceptance Scenarios**:

1. **Given** the aggregator has 3 child servers running with config keys "sourcebot", "analyzer", and "formatter", **When** a client requests the list of available tools, **Then** all tools from all servers are returned with their config key as prefix (format: `configKey:toolName`)
2. **Given** two servers both have a tool named `search`, **When** tools are listed, **Then** they appear as distinct tools using their respective config keys (e.g., `server1:search` and `server2:search`)
3. **Given** a config key contains special characters, **When** tools are prefixed, **Then** the prefix preserves the config key exactly as specified in the configuration
4. **Given** the same server binary is configured twice with keys "instance1" and "instance2", **When** tools are listed, **Then** tools from both instances appear with distinct prefixes (`instance1:toolName` and `instance2:toolName`)
5. **Given** a child server crashes after initial startup, **When** tools are listed, **Then** only tools from remaining operational servers are shown and the aggregator continues serving requests

---

### User Story 3 - Execute Tools on Child Servers (Priority: P3)

A client wants to invoke a specific tool from a specific child server through the aggregator, passing arguments and receiving results transparently.

**Why this priority**: Tool execution is the final piece of functionality, building on configuration (P1) and discovery (P2).

**Independent Test**: Can be tested by calling a prefixed tool (e.g., `sourcebot:search_code`) with valid arguments and verifying the correct child server receives the request and returns the expected result.

**Acceptance Scenarios**:

1. **Given** a client wants to call `sourcebot:search_code`, **When** the tool is invoked with arguments, **Then** the aggregator routes the request to the sourcebot server and returns its response
2. **Given** a tool call with invalid arguments, **When** the aggregator forwards the request, **Then** it returns the child server's validation error to the client
3. **Given** a child server takes time to respond, **When** a tool is called, **Then** the aggregator waits for the response and forwards it without timeout for reasonable operation durations
4. **Given** a tool call to a non-existent server or tool, **When** the request is made, **Then** the aggregator returns a clear error indicating the tool was not found

---

### Edge Cases

- When a child server crashes during operation, the aggregator continues operating with remaining servers (crashed server stays down and its tools become unavailable)
- How does the system handle circular dependencies if a child server tries to connect back to the aggregator?
- If environment variable expansion encounters missing or undefined variables, the aggregator fails startup immediately with an error message identifying the specific missing variable name
- How does the aggregator handle very large tool responses from child servers?
- When the same server binary is configured multiple times with different configuration keys, each instance is treated as a separate child server with its own prefix based on the MCP server key from the config file
- How are tool schema conflicts handled (e.g., same prefixed name from different versions)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept a configuration file path as a command-line argument and read and parse standard Claude-compatible MCP configuration JSON format from that file
- **FR-002**: System MUST support environment variable expansion in configuration values using `$VAR` and `${VAR}` syntax, and MUST fail startup with a specific error message if any referenced environment variable is missing or undefined
- **FR-003**: System MUST spawn child MCP servers using stdio transport only
- **FR-004**: System MUST prefix all tools from child servers using the MCP server key from the configuration file in format `configKey:toolName`, where configKey is the server's identifier in the config JSON
- **FR-005**: System MUST expose a unified tool list aggregating all tools from all configured child servers
- **FR-006**: System MUST route tool invocation requests to the appropriate child server based on the tool name prefix
- **FR-007**: System MUST forward tool arguments to child servers without modification
- **FR-008**: System MUST return child server responses to clients without modification
- **FR-009**: System MUST handle child server failures gracefully by continuing to operate with remaining servers, reporting failures with clear error messages, and marking failed servers' tools as unavailable
- **FR-010**: System MUST validate configuration JSON before attempting to start child servers
- **FR-011**: System MUST pass environment variables to child servers as specified in the configuration
- **FR-012**: System MUST operate as an MCP server itself, exposing the standard MCP protocol via stdio
- **FR-013**: System MUST NOT require any configuration beyond the standard MCP config format
- **FR-014**: System MUST NOT support transports other than stdio
- **FR-015**: System MUST log errors and warnings only, providing minimal operational visibility to reduce overhead and noise

### Assumptions

- Child servers are assumed to be MCP-compliant and implement the standard protocol correctly
- Environment variables referenced in config are assumed to exist in the execution environment
- Tool names from child servers are assumed to not contain the `:` character (used as separator)
- Configuration file path will be provided as a command-line argument at startup
- The aggregator runs in the same environment where child servers can be spawned

### Key Entities

- **Aggregator Server**: The main MCP server that acts as a proxy/multiplexer for multiple child servers
- **Child Server**: An individual MCP server configured in the aggregator's configuration, spawned via stdio, identified by its configuration key
- **Configuration Key**: The unique identifier for each child server in the MCP config JSON (e.g., "sourcebot", "server1"), used as the prefix for that server's tools
- **Prefixed Tool**: A tool from a child server exposed through the aggregator with format `configKey:toolName`, where configKey is the server's identifier from the config
- **Server Configuration**: The parsed representation of a single child server's config including its key, command, args, and environment variables
- **Tool Registry**: The aggregated collection of all tools from all child servers with their namespaced names using config keys as prefixes

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can configure the aggregator with 10+ child servers and all servers start successfully within 5 seconds
- **SC-002**: Tool discovery returns the complete list of all tools from all child servers within 1 second
- **SC-003**: Tool invocations complete with the same latency as direct child server calls (aggregator adds less than 50ms overhead)
- **SC-004**: 100% of environment variable expansions in configurations are correctly resolved before child server startup
- **SC-005**: Configuration errors are detected and reported with actionable messages before any child servers are started
- **SC-006**: Tool name collisions are eliminated - servers with identically named tools can coexist without conflicts
- **SC-007**: The aggregator successfully handles child server failures without crashing, maintaining access to remaining servers

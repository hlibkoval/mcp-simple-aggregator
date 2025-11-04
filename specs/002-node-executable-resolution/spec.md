# Feature Specification: Node Executable Resolution for Child Servers

**Feature Branch**: `002-node-executable-resolution`
**Created**: 2025-11-04
**Status**: Draft
**Input**: User description: "Resolve child server node command to parent's node executable to prevent spawn ENOENT errors"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Spawn Node-based Child Servers Reliably (Priority: P1)

A developer configures a child MCP server with `"command": "node"` in their aggregator configuration. When the aggregator starts, the child server should spawn successfully using the same Node.js executable that's running the parent aggregator, regardless of the PATH environment variable settings.

**Why this priority**: This is the core functionality that solves the critical "spawn node ENOENT" error preventing child servers from starting. Without this, the entire aggregator is unusable for node-based child servers.

**Independent Test**: Can be fully tested by configuring a simple node-based child server (e.g., with `command: "node"` and `args: ["server.js"]`) and verifying it spawns without ENOENT errors, even when 'node' is not in the PATH.

**Acceptance Scenarios**:

1. **Given** a child server config with `command: "node"`, **When** the aggregator spawns the child process, **Then** the child uses the parent's node executable (process.execPath) instead of searching PATH
2. **Given** a child server config with `command: "node"` and PATH doesn't contain node, **When** the aggregator attempts to spawn the child, **Then** the child spawns successfully without ENOENT errors
3. **Given** a child server config with a command other than "node" (e.g., "python"), **When** the aggregator spawns the child, **Then** the command resolution doesn't interfere and uses the original command as-is
4. **Given** a child server with `command: "node"`, **When** spawned using parent's node v18.0.0, **Then** the child also runs on node v18.0.0 (version consistency)

---

### User Story 2 - Diagnostic Logging for Command Resolution (Priority: P2)

A developer troubleshooting child server connection issues can see which executable path was resolved for the "node" command, helping them verify the resolution logic is working correctly.

**Why this priority**: This provides essential visibility for debugging without being critical for basic functionality. Developers can still use the feature without it, but troubleshooting is harder.

**Independent Test**: Can be tested by enabling debug logging, spawning a child server with `command: "node"`, and verifying the log shows the resolved executable path (e.g., "Resolved 'node' command to '/usr/local/bin/node'").

**Acceptance Scenarios**:

1. **Given** debug logging is enabled, **When** a child server with `command: "node"` is spawned, **Then** the logs show the resolved executable path
2. **Given** a child server with a non-"node" command, **When** the child is spawned, **Then** no resolution logging appears (only "node" is resolved)

---

### User Story 3 - npm/npx Command Resolution (Priority: P3)

A developer configures a child server with `command: "npm"` or `command: "npx"`. The aggregator automatically resolves these commands to the executables in the same directory as the parent's node, preventing ENOENT errors for npm-based child servers.

**Why this priority**: This is a nice-to-have extension that improves the developer experience for npm/npx-based servers, but isn't strictly necessary since developers can work around it by using full paths.

**Independent Test**: Can be tested by configuring a child server with `command: "npx"` and verifying it spawns successfully even when npx isn't in PATH, by finding it in the same directory as the parent's node executable.

**Acceptance Scenarios**:

1. **Given** a child server config with `command: "npm"`, **When** npm exists in the same directory as parent's node, **Then** the aggregator resolves "npm" to that path
2. **Given** a child server config with `command: "npx"`, **When** npx exists in the same directory as parent's node, **Then** the aggregator resolves "npx" to that path
3. **Given** a child server config with `command: "npm"`, **When** npm doesn't exist alongside parent's node, **Then** the original "npm" command is used (fallback to PATH resolution)

---

### Edge Cases

- What happens when process.execPath is unavailable or invalid (should never occur in normal Node.js environments)?
- How does the system handle child servers that specify an absolute path like `command: "/usr/bin/node"` (should not interfere)?
- What happens if the resolved node executable has been deleted or moved after the parent started?
- How does command resolution behave on Windows vs Unix-like systems (path separators, executable extensions)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect when a child server config specifies `command: "node"` and replace it with the absolute path from process.execPath before spawning
- **FR-002**: System MUST preserve the original command value for all commands other than "node", "npm", and "npx"
- **FR-003**: System MUST log the resolved executable path when command resolution occurs (for debugging)
- **FR-004**: System MUST handle npm/npx resolution by checking if they exist in the same directory as process.execPath
- **FR-005**: System MUST fall back to the original command if npm/npx are not found alongside the parent's node executable
- **FR-006**: System MUST perform command resolution before creating the StdioClientTransport instance
- **FR-007**: System MUST maintain backward compatibility with existing configurations (command resolution should be transparent)

### Key Entities

- **Child Server Configuration**: Represents a single child MCP server with `command`, `args`, and `env` properties
- **Resolved Command**: The absolute path to the executable that will actually be spawned (may differ from the configured command)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Child servers with `command: "node"` spawn successfully 100% of the time, regardless of PATH environment variable
- **SC-002**: No ENOENT errors occur for node-based child servers in environments where 'node' is not in PATH
- **SC-003**: Child servers use the same Node.js version as the parent aggregator (version consistency)
- **SC-004**: Developers can verify command resolution by inspecting debug logs showing resolved executable paths
- **SC-005**: Existing child server configurations continue to work without modification (100% backward compatibility)

## Assumptions

- The parent aggregator is always running on Node.js (process.execPath is always available)
- npm and npx executables are typically located in the same directory as the node executable (standard Node.js installation)
- Developers want version consistency between parent and child node processes
- The security model allows using the parent's node executable for child processes
- Child servers that need a different Node.js version will specify an absolute path explicitly

## Dependencies

- No external dependencies required
- Relies on Node.js built-in `process.execPath` property
- Requires modification to `src/child-manager.ts` in the existing codebase

## Out of Scope

- Resolving other executable commands beyond node, npm, and npx
- Version validation (checking if parent and child node versions are compatible)
- Automatic detection of alternative Node.js version managers (nvm, fnm, etc.)
- Configuration options to disable command resolution
- Support for child servers requiring different Node.js versions

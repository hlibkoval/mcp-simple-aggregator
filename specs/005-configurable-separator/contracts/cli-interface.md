# CLI Interface Contract

**Feature**: Configurable Tool Name Separator
**Version**: 0.0.8 (proposed)

## Command Line Interface

### Synopsis

```bash
mcp-simple-aggregator --config <path> [--separator <chars>] [options]
```

### Arguments

#### Required

**`--config <path>`**
- Description: Path to MCP configuration JSON file
- Type: String (file path)
- Example: `--config /path/to/config.json`

#### Optional

**`--separator <chars>`** *(NEW)*
- Description: Character(s) to use for namespacing tool names
- Type: String (non-empty, no whitespace)
- Default: `:` (colon)
- Examples:
  - `--separator "__"` → tools named `serverKey__toolName`
  - `--separator "."` → tools named `serverKey.toolName`
  - `--separator "::"` → tools named `serverKey::toolName`

**`--debug`**
- Description: Enable debug logging to file
- Type: Boolean flag
- Default: `false`

**`--log-file <path>`**
- Description: Path to debug log file (requires --debug)
- Type: String (file path)
- Default: `/tmp/mcp-aggregator-{pid}.log`

**`--name <name>`**
- Description: Server name for identification
- Type: String
- Default: `mcp-simple-aggregator`

**`--version <version>`**
- Description: Server version string
- Type: String
- Default: `1.0.0`

**`--help`, `-h`**
- Description: Display help message and exit
- Type: Boolean flag

### Validation Rules

#### Separator Validation

The `--separator` argument MUST satisfy these constraints:

1. **Non-empty**: `separator.length > 0`
   - Error: "Separator cannot be empty. Use --separator <chars> to specify a separator (default: ":")"
   - Exit code: 1

2. **No whitespace**: `!/\s/.test(separator)`
   - Rejected characters: space, tab, newline, carriage return, form feed
   - Error: "Separator cannot contain whitespace. Use non-whitespace characters like \"__\" or \"-\""
   - Exit code: 1

3. **Any non-whitespace string**: Single-char or multi-char allowed
   - Valid: `:`, `-`, `_`, `.`, `__`, `::`, `--`, `->`, etc.
   - Valid: Unicode characters (e.g., `→`, `•`, etc.)

### Usage Examples

#### Basic Usage (Default Separator)

```bash
# Uses default ':' separator → tools named 'serverKey:toolName'
mcp-simple-aggregator --config config.json
```

#### Custom Single-Character Separator

```bash
# Uses '-' separator → tools named 'serverKey-toolName'
mcp-simple-aggregator --config config.json --separator "-"

# Uses '.' separator → tools named 'serverKey.toolName'
mcp-simple-aggregator --config config.json --separator "."
```

#### Custom Multi-Character Separator

```bash
# Uses '__' separator → tools named 'serverKey__toolName'
mcp-simple-aggregator --config config.json --separator "__"

# Uses '::' separator → tools named 'serverKey::toolName'
mcp-simple-aggregator --config config.json --separator "::"
```

#### With Other Options

```bash
# Custom separator + debug logging
mcp-simple-aggregator \
  --config config.json \
  --separator "__" \
  --debug \
  --log-file /var/log/mcp.log

# Custom separator + server identity
mcp-simple-aggregator \
  --config config.json \
  --separator "." \
  --name my-aggregator \
  --version 2.0.0
```

### Error Cases

#### Missing Config Path

```bash
$ mcp-simple-aggregator --separator "__"
# Error: Config path is required. Use --config <path> to specify the configuration file.
# Exit code: 1
```

#### Empty Separator

```bash
$ mcp-simple-aggregator --config config.json --separator ""
# Error: Separator cannot be empty. Use --separator <chars> to specify a separator (default: ":")
# Exit code: 1
```

#### Whitespace Separator

```bash
$ mcp-simple-aggregator --config config.json --separator " "
# Error: Separator cannot contain whitespace. Use non-whitespace characters like "__" or "-"
# Exit code: 1

$ mcp-simple-aggregator --config config.json --separator "a b"
# Error: Separator cannot contain whitespace. Use non-whitespace characters like "__" or "-"
# Exit code: 1
```

#### Unknown Argument

```bash
$ mcp-simple-aggregator --config config.json --unknown-arg
# Error: Unknown argument: --unknown-arg
# [Help message displayed]
# Exit code: 1
```

### Help Output

```bash
$ mcp-simple-aggregator --help
```

Output:
```text
MCP Simple Aggregator - Aggregate multiple MCP servers into one

Usage:
  mcp-simple-aggregator --config <path> [options]

Required Arguments:
  --config <path>       Path to MCP configuration JSON file

Optional Arguments:
  --separator <chars>   Separator for tool namespacing (default: ":")
                        Examples: "__", ".", "::", "-"
  --debug               Enable debug logging
  --log-file <path>     Path to log file (default: /tmp/mcp-aggregator-{pid}.log)
  --name <name>         Server name (default: mcp-simple-aggregator)
  --version <ver>       Server version (default: 1.0.0)
  --help, -h            Show this help message

Examples:
  # Basic usage (default ':' separator)
  mcp-simple-aggregator --config /path/to/config.json

  # Custom separator
  mcp-simple-aggregator --config /path/to/config.json --separator "__"

  # With debug logging
  mcp-simple-aggregator --config /path/to/config.json --debug

  # Custom separator and log file
  mcp-simple-aggregator --config config.json --separator "." --debug --log-file /var/log/mcp.log

Configuration Format:
  The config file should be a standard Claude Desktop MCP config:

  {
    "mcpServers": {
      "serverKey": {
        "command": "command-to-run",
        "args": ["arg1", "arg2"],
        "env": {
          "ENV_VAR": "${ENV_VAR}"
        }
      }
    }
  }

For more information, visit: https://github.com/hlibkoval/mcp-simple-aggregator
```

## Backward Compatibility

### Breaking Changes

**None**. This feature is fully backward compatible:

- Existing deployments without `--separator` continue working
- Default separator remains `:` (existing tool names unchanged)
- No config file format changes
- No environment variable changes

### Migration Path

Not applicable. Users opt-in to custom separators by adding `--separator` argument. No migration needed.

## Contract Versioning

- **Introduced in**: v0.0.8 (proposed)
- **Status**: New feature (additive change)
- **Stability**: Stable (no breaking changes expected)
- **Deprecation**: None (default separator `:` will always be supported)

# Example Configurations

This directory contains example MCP aggregator configurations for various use cases.

## Files

### `sample-config.json`
Full-featured example demonstrating multiple MCP servers with environment variables.

**Features:**
- Filesystem server for local file access
- GitHub server with token authentication
- PostgreSQL server with database connection

**Usage:**
```bash
# Set required environment variables
export GITHUB_TOKEN="your-github-token"
export DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"

# Run the aggregator
mcp-simple-aggregator --config examples/sample-config.json
```

### `minimal-config.json`
Simplest possible configuration with a single server.

**Usage:**
```bash
mcp-simple-aggregator --config examples/minimal-config.json
```

### `multi-instance-config.json`
Multiple instances of the same server with different configurations.

**Use Case:** Access different filesystem directories with separate tool prefixes.

**Usage:**
```bash
mcp-simple-aggregator --config examples/multi-instance-config.json
```

**Resulting Tools:**
- `fs-home:read_file` - reads from /Users/username/home
- `fs-work:read_file` - reads from /Users/username/work
- `fs-projects:read_file` - reads from /Users/username/projects

## Environment Variables

Many MCP servers require environment variables for configuration. Before running the aggregator, make sure to export all required variables:

```bash
# GitHub
export GITHUB_TOKEN="ghp_your_token_here"

# Database
export DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"

# Custom API
export API_KEY="your-api-key"
export API_URL="https://api.example.com"
```

## Creating Your Own Config

1. Start with `minimal-config.json`
2. Add servers one at a time
3. Test each addition
4. Use unique server keys for prefixing

**Template:**
```json
{
  "mcpServers": {
    "your-server-key": {
      "command": "command-to-run",
      "args": ["arg1", "arg2"],
      "env": {
        "ENV_VAR": "${ENV_VAR}"
      }
    }
  }
}
```

## Tips

- Use descriptive server keys (they become tool prefixes)
- Always use environment variables for secrets (never hardcode)
- Test child servers independently before aggregating
- Use absolute paths for file system servers
- Keep environment variable names uppercase by convention

## Testing Your Config

Verify your config is valid JSON:
```bash
cat your-config.json | jq .
```

Test with debug logging:
```bash
mcp-simple-aggregator --config your-config.json --debug
```

## Resources

- [MCP Specification](https://modelcontextprotocol.io)
- [MCP Server Registry](https://github.com/modelcontextprotocol/servers)
- [Claude Desktop Config](https://docs.anthropic.com/claude/docs/mcp)

import { readFile } from 'fs/promises';
import type {
  McpConfig,
  ConfigValidation,
  ValidationError,
  ExpansionContext
} from './types.js';
import {
  ConfigError,
  ConfigErrorCode
} from './types.js';

/**
 * T029: Read and parse MCP configuration from a JSON file
 * @param filePath - Absolute path to the configuration file
 * @returns Parsed configuration object
 * @throws ConfigError if file not found or invalid JSON
 */
export async function readConfigFile(filePath: string): Promise<McpConfig> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ConfigError(
        `Config file not found: ${filePath}\n\nExample: Create a config file at the specified path:\n  echo '{"mcpServers": {"example": {"command": "node", "args": ["server.js"]}}}' > ${filePath}`,
        ConfigErrorCode.FILE_NOT_FOUND,
        { path: filePath }
      );
    }
    if (error instanceof SyntaxError) {
      throw new ConfigError(
        `Invalid JSON in config file: ${error.message}\n\nExample of valid JSON structure:\n{\n  "mcpServers": {\n    "filesystem": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]\n    }\n  }\n}`,
        ConfigErrorCode.INVALID_JSON,
        { path: filePath, error: error.message }
      );
    }
    throw error;
  }
}

/**
 * T030: Parse and validate the structure of an MCP configuration object
 * @param config - Raw configuration object to parse
 * @returns Validated and typed configuration
 * @throws ConfigError if configuration structure is invalid
 */
export function parseConfig(config: unknown): McpConfig {
  const validation = validateConfig(config);

  if (!validation.isValid) {
    const errorMessages = validation.errors.map(e => `${e.path}: ${e.message}`).join('; ');
    throw new ConfigError(
      `Invalid configuration: ${errorMessages}`,
      ConfigErrorCode.INVALID_SCHEMA,
      { errors: validation.errors }
    );
  }

  return config as McpConfig;
}

/**
 * T031: Validate MCP configuration structure with detailed error messages
 * @param config - Configuration object to validate
 * @returns Validation result with detailed errors if invalid
 */
export function validateConfig(config: unknown): ConfigValidation {
  const errors: ValidationError[] = [];

  // Must be an object
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    return {
      isValid: false,
      errors: [{
        path: '$',
        message: 'Config must be an object',
        value: config
      }]
    };
  }

  const typed = config as Record<string, unknown>;

  // Must have mcpServers field
  if (!('mcpServers' in typed)) {
    errors.push({
      path: '$.mcpServers',
      message: 'Missing required field: mcpServers'
    });
    return { isValid: false, errors };
  }

  const { mcpServers } = typed;

  // mcpServers must be an object
  if (typeof mcpServers !== 'object' || mcpServers === null || Array.isArray(mcpServers)) {
    errors.push({
      path: '$.mcpServers',
      message: 'mcpServers must be an object',
      value: mcpServers
    });
    return { isValid: false, errors };
  }

  // Validate each server configuration
  const serversObj = mcpServers as Record<string, unknown>;
  const serverKeys = Object.keys(serversObj);

  if (serverKeys.length === 0) {
    errors.push({
      path: '$.mcpServers',
      message: 'mcpServers must contain at least one server'
    });
  }

  for (const [serverKey, serverValue] of Object.entries(serversObj)) {
    // Server config must be an object
    if (typeof serverValue !== 'object' || serverValue === null || Array.isArray(serverValue)) {
      errors.push({
        path: `$.mcpServers.${serverKey}`,
        message: 'Server config must be an object',
        value: serverValue
      });
      continue;
    }

    const server = serverValue as Record<string, unknown>;

    // T032: Command field is required
    if (!('command' in server)) {
      errors.push({
        path: `$.mcpServers.${serverKey}.command`,
        message: 'Missing required field: command',
        value: server
      });
    } else if (typeof server.command !== 'string' || server.command.trim() === '') {
      errors.push({
        path: `$.mcpServers.${serverKey}.command`,
        message: 'command must be a non-empty string',
        value: server.command
      });
    }

    // Args must be an array of strings if present
    if ('args' in server) {
      if (!Array.isArray(server.args)) {
        errors.push({
          path: `$.mcpServers.${serverKey}.args`,
          message: 'args must be an array',
          value: server.args
        });
      } else {
        server.args.forEach((arg, index) => {
          if (typeof arg !== 'string') {
            errors.push({
              path: `$.mcpServers.${serverKey}.args[${index}]`,
              message: 'Each arg must be a string',
              value: arg
            });
          }
        });
      }
    }

    // Env must be an object if present
    if ('env' in server) {
      if (typeof server.env !== 'object' || server.env === null || Array.isArray(server.env)) {
        errors.push({
          path: `$.mcpServers.${serverKey}.env`,
          message: 'env must be an object',
          value: server.env
        });
      } else {
        // All env values must be strings
        const envObj = server.env as Record<string, unknown>;
        for (const [envKey, envValue] of Object.entries(envObj)) {
          if (typeof envValue !== 'string') {
            errors.push({
              path: `$.mcpServers.${serverKey}.env.${envKey}`,
              message: 'Environment variable value must be a string',
              value: envValue
            });
          }
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * T039: Expand environment variables in a string using regex replacement
 * Supports both ${VAR} and $VAR syntax
 * @param value - String potentially containing environment variable references
 * @param context - Environment variable context (defaults to process.env)
 * @returns Expanded string with variables replaced
 * @throws ConfigError if any referenced variable is missing
 */
export function expandEnvVar(value: string, context?: ExpansionContext): string {
  const env = context?.env || process.env;
  const missingVars: string[] = [];

  // Regex matches ${VAR} or $VAR (where VAR is uppercase with underscores/numbers)
  const expanded = value.replace(
    /\$\{([^}]+)\}|\$([A-Z_][A-Z0-9_]*)/g,
    (match, curly, plain) => {
      const varName = curly || plain;
      const envValue = env[varName];

      if (envValue === undefined) {
        missingVars.push(varName);
        return match; // Keep original if missing
      }

      return envValue;
    }
  );

  // T041: Error handling with specific variable name
  if (missingVars.length > 0) {
    throw new ConfigError(
      `Missing environment variable${missingVars.length > 1 ? 's' : ''}: ${missingVars.join(', ')}\n\nExample: Set the required variable(s) before running:\n  export ${missingVars[0]}="/path/to/value"\n  mcp-aggregator --config config.json`,
      ConfigErrorCode.MISSING_ENV_VAR,
      {
        variable: missingVars[0],
        missingVariables: missingVars,
        originalValue: value
      }
    );
  }

  return expanded;
}

/**
 * T040: Recursively expand environment variables in config objects
 * Handles nested objects, arrays, and preserves non-string types
 * @param obj - Configuration object to expand
 * @param context - Environment variable context (defaults to process.env)
 * @returns Expanded configuration with all variables replaced
 * @throws ConfigError if any referenced variable is missing
 */
export function expandConfigEnvVars(obj: unknown, context?: ExpansionContext): unknown {
  const env = context?.env || process.env;
  const expansionContext = { env };

  if (typeof obj === 'string') {
    return expandEnvVar(obj, expansionContext);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => expandConfigEnvVars(item, expansionContext));
  }

  if (typeof obj === 'object' && obj !== null) {
    const expanded: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      expanded[key] = expandConfigEnvVars(value, expansionContext);
    }
    return expanded;
  }

  // Preserve non-string primitives (numbers, booleans, null)
  return obj;
}

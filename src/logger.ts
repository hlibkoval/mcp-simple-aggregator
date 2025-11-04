/**
 * Logger Module
 *
 * Provides conditional logging based on debug flag.
 * Errors are always logged, info/debug messages only when debug is enabled.
 */

import { createWriteStream, WriteStream } from 'fs';

/**
 * Global debug flag
 */
let debugEnabled = false;

/**
 * Global log stream for file-based logging
 */
let logStream: WriteStream | null = null;

/**
 * Global log file path for lazy initialization
 */
let logFilePath: string | null = null;

/**
 * Set the debug mode for the logger
 * @param enabled - Whether debug logging should be enabled
 */
export function setDebugMode(enabled: boolean): void {
  debugEnabled = enabled;
}

/**
 * Check if debug mode is enabled
 * @returns True if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  return debugEnabled;
}

/**
 * Initialize the log stream if not already initialized
 */
function initializeLogStream(): void {
  if (logStream || !logFilePath) return;

  try {
    logStream = createWriteStream(logFilePath, { flags: 'a' });
    logStream.on('error', (_err) => {
      // Silent fallback - don't crash server if logging fails
      // Error is ignored to prevent stdio pollution
    });
  } catch (error) {
    // Silent fallback if file creation fails
  }
}

/**
 * Set the log file path for file-based logging
 * @param filePath - Path to the log file
 */
export function setLogFile(filePath: string): void {
  // Close existing stream if any
  if (logStream) {
    logStream.end();
    logStream = null;
  }

  logFilePath = filePath;
  // Don't create stream yet - wait for first write (lazy initialization)
}

/**
 * Reset the logger state (for testing)
 * @internal
 */
export function resetLogger(): void {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
  logFilePath = null;
  debugEnabled = false;
}

/**
 * Log an info message (only if debug is enabled)
 * @param message - Message to log
 * @param args - Additional arguments to log
 */
export function logInfo(message: string, ...args: unknown[]): void {
  if (!debugEnabled) return;

  initializeLogStream();
  if (!logStream) return;

  const timestamp = new Date().toISOString();
  const argsStr = args.length > 0 ? ' ' + args.map(String).join(' ') : '';
  const formatted = `${timestamp} [INFO] ${message}${argsStr}\n`;
  logStream.write(formatted);
}

/**
 * Log a debug message (only if debug is enabled)
 * @param message - Message to log
 * @param args - Additional arguments to log
 */
export function logDebug(message: string, ...args: unknown[]): void {
  if (!debugEnabled) return;

  initializeLogStream();
  if (!logStream) return;

  const timestamp = new Date().toISOString();
  const argsStr = args.length > 0 ? ' ' + args.map(String).join(' ') : '';
  const formatted = `${timestamp} [DEBUG] ${message}${argsStr}\n`;
  logStream.write(formatted);
}

/**
 * Log an error message (always logged)
 * @param message - Message to log
 * @param args - Additional arguments to log
 */
export function logError(message: string, ...args: unknown[]): void {
  initializeLogStream();
  if (!logStream) return;

  const timestamp = new Date().toISOString();
  const argsStr = args.length > 0 ? ' ' + args.map(String).join(' ') : '';
  const formatted = `${timestamp} [ERROR] ${message}${argsStr}\n`;
  logStream.write(formatted);
}

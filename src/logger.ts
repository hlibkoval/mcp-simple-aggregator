/**
 * Logger Module
 *
 * Provides conditional logging based on debug flag.
 * Errors are always logged, info/debug messages only when debug is enabled.
 */

/**
 * Global debug flag
 */
let debugEnabled = false;

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
 * Log an info message (only if debug is enabled)
 * @param message - Message to log
 * @param args - Additional arguments to log
 */
export function logInfo(message: string, ...args: unknown[]): void {
  if (debugEnabled) {
    console.error(message, ...args);
  }
}

/**
 * Log a debug message (only if debug is enabled)
 * @param message - Message to log
 * @param args - Additional arguments to log
 */
export function logDebug(message: string, ...args: unknown[]): void {
  if (debugEnabled) {
    console.error(message, ...args);
  }
}

/**
 * Log an error message (always logged)
 * @param message - Message to log
 * @param args - Additional arguments to log
 */
export function logError(message: string, ...args: unknown[]): void {
  console.error(message, ...args);
}

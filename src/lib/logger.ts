/**
 * Minimal structured logger.
 *
 * Rules:
 *  - one JSON line per event, so hosting platforms can index it;
 *  - never log secrets, tokens, passwords or personal data;
 *  - stack traces are kept out of the payload in production.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

const isProduction = process.env.NODE_ENV === 'production';

/** Keys that must never reach the logs, whatever the caller passes in. */
const REDACTED_KEYS = [
  'password',
  'token',
  'access_token',
  'refresh_token',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'secret',
  'service_role',
  'email',
  'ip',
];

function redact(context: LogContext): LogContext {
  const output: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (REDACTED_KEYS.some((needle) => key.toLowerCase().includes(needle))) {
      output[key] = '[redacted]';
    } else if (value instanceof Error) {
      output[key] = isProduction
        ? { name: value.name, message: value.message }
        : { name: value.name, message: value.message, stack: value.stack };
    } else {
      output[key] = value;
    }
  }
  return output;
}

function emit(level: LogLevel, message: string, context: LogContext = {}): void {
  if (level === 'debug' && isProduction) return;

  const payload = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...redact(context),
  });

  if (level === 'error') {
    console.error(payload);
  } else if (level === 'warn') {
    console.warn(payload);
  } else {
    console.log(payload);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit('debug', message, context),
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, context?: LogContext) => emit('error', message, context),
};

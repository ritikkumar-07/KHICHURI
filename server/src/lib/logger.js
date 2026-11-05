import { env } from '../config/env.js';

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const threshold =
  LEVELS[String(env.logLevel).toLowerCase()] ?? LEVELS.info;

function write(level, event, fields = {}) {
  if (LEVELS[level] < threshold) return;

  const record = {
    timestamp: new Date().toISOString(),
    level,
    service: env.serviceName,
    environment: env.nodeEnv,
    event,
    ...fields,
  };

  const output = `${JSON.stringify(record)}\n`;
  if (level === 'error') process.stderr.write(output);
  else process.stdout.write(output);
}

export function serializeError(error) {
  if (!error) return undefined;
  return {
    name: error.name || 'Error',
    message: error.message || String(error),
    code: error.code,
    status: error.status || error.statusCode,
    stack: error.stack,
  };
}

export const logger = {
  debug(event, fields) {
    write('debug', event, fields);
  },
  info(event, fields) {
    write('info', event, fields);
  },
  warn(event, fields) {
    write('warn', event, fields);
  },
  error(event, fields) {
    write('error', event, fields);
  },
};

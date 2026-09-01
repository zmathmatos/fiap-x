import pino, { type Logger } from 'pino';

export type { Logger };

export function createLogger(name: string): Logger {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? 'info',
    base: { service: name },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'password',
        '*.password',
        'passwordHash',
        '*.passwordHash',
      ],
      censor: '[redacted]',
    },
  });
}

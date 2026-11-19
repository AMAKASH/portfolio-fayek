import { pino } from 'pino';

const nodeEnv = process.env['NODE_ENV'];

export const logger = pino({
  level: nodeEnv === 'test' ? 'silent' : (process.env['LOG_LEVEL'] ?? 'info'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
    ],
    censor: '[redacted]',
  },
  ...(nodeEnv === 'development'
    ? { transport: { target: 'pino-pretty', options: { singleLine: true, translateTime: 'HH:MM:ss' } } }
    : {}),
});

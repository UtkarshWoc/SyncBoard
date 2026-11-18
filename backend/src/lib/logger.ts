import { pino } from 'pino';
import { env } from '../config/env.js';

const usePretty = !env.isProd && !env.isTest && process.stdout.isTTY;

export const logger = pino({
  level: env.logLevel,
  base: { service: 'syncboard-api' },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', '*.password', '*.token'],
    censor: '[redacted]',
  },
  ...(usePretty
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }
    : {}),
});

export type Logger = typeof logger;

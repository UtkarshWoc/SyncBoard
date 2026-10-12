/**
 * Sentry must initialise before Express and other libraries are imported so it
 * can instrument them. Loaded via `node --import ./dist/instrument.js`.
 */
import * as Sentry from '@sentry/node';
import { env } from './config/env.js';

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  });
}

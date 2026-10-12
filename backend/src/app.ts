import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/node';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { httpDuration } from './lib/metrics.js';
import { noopRealtime, type Realtime } from './lib/realtime.js';
import { errorHandler, notFoundHandler } from './http/middleware/error.js';
import { apiLimiter } from './http/middleware/rateLimit.js';
import { authRouter } from './http/routes/auth.js';
import { boardsRouter, invitesRouter } from './http/routes/boards.js';
import { healthRouter, metricsRouter, type HealthDeps } from './http/routes/health.js';
import { profileRouter } from './http/routes/profile.js';

export interface AppDeps extends HealthDeps {
  realtime?: Realtime;
}

export function createApp(deps: AppDeps = {}): Express {
  const realtime = deps.realtime ?? noopRealtime;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url?.startsWith('/api/health') ?? false },
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    }),
  );

  app.use((req, res, next) => {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
      // Use the route pattern, not the URL, to keep label cardinality bounded.
      const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : 'unmatched';
      end({ method: req.method, route, status: String(res.statusCode) });
    });
    next();
  });

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy'],
      maxAge: 600,
    }),
  );
  app.use(cookieParser());

  // Image uploads need a larger body limit than everything else; body-parser skips already-parsed bodies.
  app.use('/api/boards/:id/files', express.json({ limit: '8mb' }));
  app.use(['/api/boards/:id/thumbnail', '/api/boards/:id/versions'], express.json({ limit: '1mb' }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', healthRouter(deps));
  app.use(metricsRouter());

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter(realtime));
  app.use('/api/boards', boardsRouter(realtime));
  app.use('/api/invites', invitesRouter());

  app.use(notFoundHandler);
  if (env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);
  app.use(errorHandler);

  return app;
}

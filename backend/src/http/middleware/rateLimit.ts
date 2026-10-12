import { rateLimit, type Options } from 'express-rate-limit';
import { env } from '../../config/env.js';

const handler: Options['handler'] = (_req, res, _next, options) => {
  res.status(options.statusCode).json({
    error: { code: 'RATE_LIMITED', message: 'Too many requests — please slow down and try again shortly' },
  });
};

const make = (windowMs: number, limit: number) =>
  rateLimit({
    windowMs,
    limit: env.isTest ? 10_000 : limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler,
  });

/** Credential endpoints: login, register, password reset. */
export const authLimiter = make(15 * 60_000, 30);
/** Endpoints that send email. */
export const emailLimiter = make(60 * 60_000, 10);
/** Everything else under /api. */
export const apiLimiter = make(60_000, 300);
/** Large uploads (images, thumbnails). */
export const uploadLimiter = make(60_000, 60);

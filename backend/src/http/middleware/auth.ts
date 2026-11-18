import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../../lib/errors.js';
import { verifyAccessToken } from '../../lib/tokens.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthorized());
  req.userId = verifyAccessToken(header.slice(7));
  next();
}

/** For handlers behind requireAuth. */
export function uid(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}

import type { NextFunction, Request, Response } from 'express';
import { HttpError, toHttpError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.path}` } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // Body parser errors carry a status (400 bad JSON, 413 too large).
  const parserStatus = (err as { status?: number; type?: string }).status;
  if (!(err instanceof HttpError) && parserStatus && parserStatus < 500) {
    const code = parserStatus === 413 ? 'LIMIT_EXCEEDED' : 'BAD_REQUEST';
    res
      .status(parserStatus)
      .json({ error: { code, message: parserStatus === 413 ? 'Request is too large' : 'Malformed request body' } });
    return;
  }

  const httpErr = toHttpError(err);
  if (httpErr.status >= 500) {
    (req.log ?? logger).error({ err }, 'Unhandled error');
  }
  res.status(httpErr.status).json({ error: httpErr.toJSON() });
}

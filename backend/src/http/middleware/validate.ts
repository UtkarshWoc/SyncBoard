import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { validationError } from '../../lib/errors.js';

/** Parse and replace `req.body` with the schema's output (trimmed, defaulted, coerced). */
export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) return next(validationError(result.error));
    req.body = result.data;
    next();
  };
}

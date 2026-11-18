import type { ApiError, ErrorCode } from '@syncboard/shared';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  toJSON(): ApiError {
    return { code: this.code, message: this.message, ...(this.details !== undefined && { details: this.details }) };
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Authentication required') => new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have access to this') => new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Not found') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (message: string) => new HttpError(409, 'CONFLICT', message);
export const limitExceeded = (message: string) => new HttpError(413, 'LIMIT_EXCEEDED', message);

export function validationError(error: ZodError): HttpError {
  const details = error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  const first = details[0];
  const message = first ? (first.path ? `${first.path}: ${first.message}` : first.message) : 'Invalid input';
  return new HttpError(400, 'VALIDATION', message, details);
}

/** Normalise anything thrown into an HttpError so callers can serialise it safely. */
export function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (err instanceof ZodError) return validationError(err);
  return new HttpError(500, 'INTERNAL', 'Something went wrong');
}

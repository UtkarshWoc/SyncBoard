import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env.js';

export const REFRESH_COOKIE = 'sb_rt';

const base = (): CookieOptions => ({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.COOKIE_SAMESITE,
  path: '/api/auth',
  ...(env.COOKIE_DOMAIN && { domain: env.COOKIE_DOMAIN }),
});

export function setRefreshCookie(res: Response, token: string, expires: Date) {
  res.cookie(REFRESH_COOKIE, token, { ...base(), expires });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, base());
}

export function readRefreshCookie(req: Request): string | undefined {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

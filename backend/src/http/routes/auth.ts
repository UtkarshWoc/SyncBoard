import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  googleAuthSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
} from '@syncboard/shared';
import { HttpError, unauthorized } from '../../lib/errors.js';
import * as auth from '../../services/authService.js';
import { getUser } from '../../services/userService.js';
import { toAuthUser } from '../../lib/serialize.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from '../cookies.js';
import { requireAuth, uid } from '../middleware/auth.js';
import { authLimiter, emailLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';

const meta = (req: Request): auth.ClientMeta => ({ userAgent: req.get('user-agent') ?? null, ip: req.ip ?? null });

function respond(res: Response, issued: auth.IssuedTokens, status = 200) {
  setRefreshCookie(res, issued.refreshToken, issued.refreshExpiresAt);
  res.status(status).json(issued.auth);
}

/**
 * Cookie-authenticated endpoints require a custom header. Browsers can't send
 * one cross-site without a CORS preflight, which blocks CSRF even with SameSite=None.
 */
function requireCsrfHeader(req: Request, _res: Response, next: NextFunction) {
  if (req.get('x-requested-with') !== 'syncboard') {
    return next(new HttpError(403, 'FORBIDDEN', 'Missing X-Requested-With header'));
  }
  next();
}

export const authRouter = Router();

authRouter.post('/register', authLimiter, validateBody(registerSchema), async (req, res) => {
  respond(res, await auth.register(req.body, meta(req)), 201);
});

authRouter.post('/login', authLimiter, validateBody(loginSchema), async (req, res) => {
  respond(res, await auth.login(req.body, meta(req)));
});

authRouter.post('/google', authLimiter, validateBody(googleAuthSchema), async (req, res) => {
  respond(res, await auth.googleSignIn(req.body.credential, meta(req)));
});

authRouter.post('/refresh', requireCsrfHeader, async (req, res) => {
  const token = readRefreshCookie(req);
  if (!token) throw unauthorized('No session');
  try {
    respond(res, await auth.refresh(token, meta(req)));
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
});

authRouter.post('/logout', requireCsrfHeader, async (req, res) => {
  await auth.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  res.status(204).end();
});

authRouter.post('/logout-all', requireAuth, async (req, res) => {
  await auth.logoutAll(uid(req));
  clearRefreshCookie(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: toAuthUser(await getUser(uid(req))) });
});

authRouter.post('/verify-email', authLimiter, validateBody(tokenSchema), async (req, res) => {
  await auth.verifyEmail(req.body.token);
  res.status(204).end();
});

authRouter.post('/resend-verification', requireAuth, emailLimiter, async (req, res) => {
  await auth.resendVerification(uid(req));
  res.status(204).end();
});

authRouter.post('/forgot-password', emailLimiter, validateBody(forgotPasswordSchema), async (req, res) => {
  await auth.forgotPassword(req.body.email);
  res.status(204).end();
});

authRouter.post('/reset-password', authLimiter, validateBody(resetPasswordSchema), async (req, res) => {
  await auth.resetPassword(req.body.token, req.body.password);
  clearRefreshCookie(res);
  res.status(204).end();
});

authRouter.post('/change-password', requireAuth, authLimiter, validateBody(changePasswordSchema), async (req, res) => {
  await auth.changePassword(uid(req), req.body.currentPassword, req.body.newPassword);
  res.status(204).end();
});

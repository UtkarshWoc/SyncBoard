import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized } from './errors.js';

interface AccessClaims {
  sub: string;
  typ: 'access';
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ typ: 'access' }, env.jwtSecret, {
    subject: userId,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    issuer: 'syncboard',
  });
}

/** Returns the user id, or throws a 401 HttpError. */
export function verifyAccessToken(token: string): string {
  try {
    const claims = jwt.verify(token, env.jwtSecret, { issuer: 'syncboard' }) as AccessClaims;
    if (claims.typ !== 'access' || !claims.sub) throw new Error('wrong token type');
    return claims.sub;
  } catch {
    throw unauthorized('Invalid or expired access token');
  }
}

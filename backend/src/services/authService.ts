import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import type { AuthPayload } from '@syncboard/shared';
import { env } from '../config/env.js';
import { randomToken, sha256 } from '../lib/crypto.js';
import { HttpError, badRequest, conflict, notFound, unauthorized } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { passwordResetEmail, sendMail, verificationEmail } from '../lib/mailer.js';
import { toAuthUser } from '../lib/serialize.js';
import { signAccessToken } from '../lib/tokens.js';
import { AuthToken } from '../models/AuthToken.js';
import { Session } from '../models/Session.js';
import { User, type UserDoc } from '../models/User.js';

const BCRYPT_ROUNDS = env.isTest ? 4 : 12;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
// A rotated token may be presented again within this window (e.g. two tabs refreshing at once)
// without being treated as theft.
const ROTATION_GRACE_MS = 10_000;

// Compared against when the email is unknown, so response time doesn't reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const googleClient = env.googleClientId ? new OAuth2Client(env.googleClientId) : null;

export interface ClientMeta {
  userAgent?: string | null;
  ip?: string | null;
}

export interface IssuedTokens {
  auth: AuthPayload;
  refreshToken: string;
  refreshExpiresAt: Date;
}

async function createSession(user: UserDoc, meta: ClientMeta, familyId = randomToken(12)): Promise<IssuedTokens> {
  const refreshToken = randomToken(48);
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await Session.create({
    userId: user._id,
    tokenHash: sha256(refreshToken),
    familyId,
    expiresAt: refreshExpiresAt,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
    ip: meta.ip ?? null,
  });
  return {
    auth: {
      accessToken: signAccessToken(user._id.toString()),
      expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
      user: toAuthUser(user),
    },
    refreshToken,
    refreshExpiresAt,
  };
}

async function issueEmailToken(userId: UserDoc['_id'], type: 'verify-email' | 'reset-password', ttlMs: number) {
  // Only the newest link of each type stays valid.
  await AuthToken.deleteMany({ userId, type, usedAt: null });
  const token = randomToken(32);
  await AuthToken.create({ userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

async function consumeEmailToken(token: string, type: 'verify-email' | 'reset-password') {
  const record = await AuthToken.findOneAndUpdate(
    { tokenHash: sha256(token), type, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  );
  if (!record) throw badRequest('This link is invalid or has expired');
  return record;
}

export async function sendVerificationEmail(user: UserDoc): Promise<void> {
  if (user.emailVerified) return;
  const token = await issueEmailToken(user._id, 'verify-email', VERIFY_TTL_MS);
  await sendMail(verificationEmail(user.email, user.displayName, `${env.appUrl}/verify-email?token=${token}`));
}

export async function register(
  input: { email: string; password: string; displayName: string },
  meta: ClientMeta,
): Promise<IssuedTokens> {
  if (await User.exists({ email: input.email })) throw conflict('An account with this email already exists');
  const user = await User.create({
    email: input.email,
    displayName: input.displayName,
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
  });
  logger.info({ userId: user.id }, 'User registered');
  await sendVerificationEmail(user);
  return createSession(user, meta);
}

export async function login(input: { email: string; password: string }, meta: ClientMeta): Promise<IssuedTokens> {
  const user = await User.findOne({ email: input.email });
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    if (user && !user.passwordHash && user.googleId) {
      throw new HttpError(401, 'UNAUTHORIZED', 'This account uses Google sign-in');
    }
    throw new HttpError(401, 'UNAUTHORIZED', 'Incorrect email or password');
  }
  return createSession(user, meta);
}

export async function googleSignIn(credential: string, meta: ClientMeta): Promise<IssuedTokens> {
  if (!googleClient || !env.googleClientId) throw badRequest('Google sign-in is not configured');

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: env.googleClientId });
    payload = ticket.getPayload();
  } catch (err) {
    logger.warn({ err }, 'Google token verification failed');
    throw unauthorized('Google sign-in failed');
  }
  if (!payload?.email || !payload.sub) throw unauthorized('Google sign-in failed');
  // Linking by email is only safe when Google vouches for the address.
  if (!payload.email_verified) throw unauthorized('Your Google email address is not verified');

  const email = payload.email.toLowerCase();
  let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] });
  if (!user) {
    user = await User.create({
      email,
      googleId: payload.sub,
      displayName: (payload.name ?? email.split('@')[0] ?? 'User').slice(0, 40),
      avatarUrl: payload.picture ?? null,
      emailVerified: true,
    });
    logger.info({ userId: user.id }, 'User registered via Google');
  } else {
    let dirty = false;
    if (!user.googleId) {
      user.googleId = payload.sub;
      dirty = true;
    }
    if (!user.emailVerified) {
      user.emailVerified = true;
      dirty = true;
    }
    if (!user.avatarUrl && payload.picture) {
      user.avatarUrl = payload.picture;
      dirty = true;
    }
    if (dirty) await user.save();
  }
  return createSession(user, meta);
}

/**
 * Rotate a refresh token. Presenting an already-rotated token outside the
 * grace window revokes every session in its family.
 */
export async function refresh(refreshToken: string, meta: ClientMeta): Promise<IssuedTokens> {
  const session = await Session.findOne({ tokenHash: sha256(refreshToken) });
  if (!session || session.expiresAt <= new Date()) throw unauthorized('Session expired, please sign in again');

  if (session.revokedAt) {
    const withinGrace = session.rotatedAt && Date.now() - session.rotatedAt.getTime() < ROTATION_GRACE_MS;
    if (!withinGrace) {
      await Session.updateMany({ familyId: session.familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
      logger.warn({ userId: session.userId.toString(), familyId: session.familyId }, 'Refresh token reuse detected');
    }
    throw unauthorized('Session expired, please sign in again');
  }

  // Claim the token atomically so two concurrent refreshes can't both rotate it.
  const claimed = await Session.findOneAndUpdate(
    { _id: session._id, revokedAt: null },
    { $set: { revokedAt: new Date(), rotatedAt: new Date() } },
  );
  if (!claimed) throw unauthorized('Session expired, please sign in again');

  const user = await User.findById(session.userId);
  if (!user) throw unauthorized('Account no longer exists');
  return createSession(user, meta, session.familyId);
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  const session = await Session.findOne({ tokenHash: sha256(refreshToken) });
  if (session)
    await Session.updateMany({ familyId: session.familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function logoutAll(userId: string): Promise<void> {
  await Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function verifyEmail(token: string): Promise<void> {
  const record = await consumeEmailToken(token, 'verify-email');
  await User.updateOne({ _id: record.userId }, { $set: { emailVerified: true } });
}

export async function resendVerification(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');
  if (user.emailVerified) throw badRequest('Your email is already verified');
  await sendVerificationEmail(user);
}

/** Always resolves, so the endpoint can't be used to discover registered emails. */
export async function forgotPassword(email: string): Promise<void> {
  const user = await User.findOne({ email });
  if (!user) return;
  const token = await issueEmailToken(user._id, 'reset-password', RESET_TTL_MS);
  await sendMail(passwordResetEmail(user.email, user.displayName, `${env.appUrl}/reset-password?token=${token}`));
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const record = await consumeEmailToken(token, 'reset-password');
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  // Reaching the inbox proves ownership of the address, so mark it verified too.
  await User.updateOne({ _id: record.userId }, { $set: { passwordHash, emailVerified: true } });
  await logoutAll(record.userId.toString());
}

export async function changePassword(userId: string, currentPassword: string | undefined, newPassword: string) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');
  if (user.passwordHash) {
    if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw badRequest('Current password is incorrect');
    }
  }
  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.save();
}

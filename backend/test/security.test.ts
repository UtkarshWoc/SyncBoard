import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const googlePayload = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    async verifyIdToken() {
      return { getPayload: () => googlePayload.current };
    }
  },
}));

const { createApp } = await import('../src/app.js');
const { registerUser } = await import('./helpers.js');

const app = createApp();
const CSRF = { 'X-Requested-With': 'syncboard' };

describe('Google sign-in linking', () => {
  beforeEach(() => {
    googlePayload.current = {};
  });

  it('wipes a squatter password when Google proves ownership of an unverified email', async () => {
    // Attacker registers the victim's address with their own password (never verified).
    const squat = await request(app)
      .post('/api/auth/register')
      .send({ email: 'victim@example.com', password: 'attacker password', displayName: 'Attacker' })
      .expect(201);
    const attackerCookie = (squat.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

    // The real owner signs in with Google.
    googlePayload.current = { email: 'victim@example.com', email_verified: true, sub: 'google-123', name: 'Victim' };
    const google = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'x'.repeat(40) })
      .expect(200);
    expect(google.body.user).toMatchObject({ email: 'victim@example.com', emailVerified: true, hasPassword: false });

    // The attacker's password and session no longer work.
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'victim@example.com', password: 'attacker password' })
      .expect(401);
    await request(app).post('/api/auth/refresh').set(CSRF).set('Cookie', attackerCookie).expect(401);
  });

  it('keeps the password of an account whose email was already verified', async () => {
    const user = await registerUser(app, 'Verified');
    const { User } = await import('../src/models/User.js');
    await User.updateOne({ _id: user.user.id }, { $set: { emailVerified: true } });

    googlePayload.current = { email: user.user.email, email_verified: true, sub: 'google-456', name: 'Verified' };
    await request(app)
      .post('/api/auth/google')
      .send({ credential: 'x'.repeat(40) })
      .expect(200);
    await request(app)
      .post('/api/auth/login')
      .send({ email: user.user.email, password: 'correct horse battery' })
      .expect(200);
  });

  it('refuses Google accounts whose email Google has not verified', async () => {
    googlePayload.current = { email: 'unverified@example.com', email_verified: false, sub: 'google-789' };
    await request(app)
      .post('/api/auth/google')
      .send({ credential: 'x'.repeat(40) })
      .expect(401);
  });
});

describe('password change', () => {
  it('revokes every other session and issues a fresh one', async () => {
    const user = await registerUser(app, 'Rotator');
    const res = await request(app)
      .post('/api/auth/change-password')
      .set(user.auth)
      .send({ currentPassword: 'correct horse battery', newPassword: 'a whole new password' })
      .expect(200);
    expect(res.body.accessToken).toBeTypeOf('string');
    const fresh = (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

    await request(app).post('/api/auth/refresh').set(CSRF).set('Cookie', user.cookie).expect(401);
    await request(app).post('/api/auth/refresh').set(CSRF).set('Cookie', fresh).expect(200);
  });
});

describe('board password guessing', () => {
  it('locks out a user after repeated wrong guesses, even for the right password', async () => {
    const owner = await registerUser(app, 'Owner');
    const guesser = await registerUser(app, 'Guesser');
    const board = await request(app)
      .post('/api/boards')
      .set(owner.auth)
      .send({ name: 'Locked', generalAccess: 'editor' })
      .expect(201);
    await request(app).patch(`/api/boards/${board.body.id}`).set(owner.auth).send({ password: 'pi314' }).expect(200);

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post(`/api/boards/${board.body.id}/unlock`)
        .set(guesser.auth)
        .send({ password: `guess${i}` });
      expect(res.body.error.code).toBe('INVALID_PASSWORD');
    }
    const locked = await request(app)
      .post(`/api/boards/${board.body.id}/unlock`)
      .set(guesser.auth)
      .send({ password: 'pi314' })
      .expect(429);
    expect(locked.body.error.code).toBe('RATE_LIMITED');
  });
});

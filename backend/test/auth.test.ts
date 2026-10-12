import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { sentMail } from '../src/lib/mailer.js';
import { Session } from '../src/models/Session.js';
import { registerUser } from './helpers.js';

const app = createApp();
const CSRF = { 'X-Requested-With': 'syncboard' };

const linkToken = (text: string) => /token=([\w-]+)/.exec(text)?.[1] ?? '';

describe('registration and login', () => {
  it('registers, sets an httpOnly refresh cookie and returns an access token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'Ada@Example.com ', password: 'analytical engine', displayName: '  Ada ' })
      .expect(201);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({ email: 'ada@example.com', displayName: 'Ada', emailVerified: false });
    const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!;
    expect(cookie).toMatch(/^sb_rt=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
  });

  it('rejects duplicate emails and weak passwords', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'ada@example.com', password: 'another password', displayName: 'Ada 2' })
      .expect(409);
    const weak = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@example.com', password: 'short', displayName: 'X' })
      .expect(400);
    expect(weak.body.error.code).toBe('VALIDATION');
  });

  it('logs in with the right password only', async () => {
    await request(app).post('/api/auth/login').send({ email: 'ada@example.com', password: 'nope nope' }).expect(401);
    await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'nope nope' }).expect(401);
    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ADA@example.com', password: 'analytical engine' })
      .expect(200);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${ok.body.accessToken}`).expect(200);
    expect(me.body.user.email).toBe('ada@example.com');
  });

  it('rejects requests without a valid access token', async () => {
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt').expect(401);
  });
});

describe('refresh token rotation', () => {
  it('requires the CSRF header', async () => {
    const user = await registerUser(app, 'Csrf');
    await request(app).post('/api/auth/refresh').set('Cookie', user.cookie).expect(403);
  });

  it('rotates the refresh token on every use', async () => {
    const user = await registerUser(app, 'Rotate');
    const first = await request(app).post('/api/auth/refresh').set(CSRF).set('Cookie', user.cookie).expect(200);
    const newCookie = (first.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    expect(newCookie).not.toBe(user.cookie);
    expect(first.body.user.id).toBe(user.user.id);
    await request(app).post('/api/auth/refresh').set(CSRF).set('Cookie', newCookie).expect(200);
  });

  it('revokes the whole session family when a rotated token is reused', async () => {
    const user = await registerUser(app, 'Thief');
    const rotated = await request(app).post('/api/auth/refresh').set(CSRF).set('Cookie', user.cookie).expect(200);
    const current = (rotated.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

    // Move the rotation outside the grace window, then replay the old token.
    await Session.updateMany({ rotatedAt: { $ne: null } }, { $set: { rotatedAt: new Date(Date.now() - 60_000) } });
    await request(app).post('/api/auth/refresh').set(CSRF).set('Cookie', user.cookie).expect(401);

    // The legitimate, newer token is now dead too.
    await request(app).post('/api/auth/refresh').set(CSRF).set('Cookie', current).expect(401);
  });

  it('logout revokes the session', async () => {
    const user = await registerUser(app, 'Logout');
    await request(app).post('/api/auth/logout').set(CSRF).set('Cookie', user.cookie).expect(204);
    await request(app).post('/api/auth/refresh').set(CSRF).set('Cookie', user.cookie).expect(401);
  });
});

describe('email verification and password reset', () => {
  let user: Awaited<ReturnType<typeof registerUser>>;

  beforeAll(async () => {
    user = await registerUser(app, 'Mailer');
  });

  it('sends a verification email on signup and verifies with its token', async () => {
    const mail = sentMail.findLast((m) => m.to === user.user.email && m.subject.includes('Verify'));
    expect(mail).toBeDefined();
    const token = linkToken(mail!.text);
    await request(app).post('/api/auth/verify-email').send({ token }).expect(204);
    // Tokens are single-use.
    await request(app).post('/api/auth/verify-email').send({ token }).expect(400);
    const me = await request(app).get('/api/auth/me').set(user.auth).expect(200);
    expect(me.body.user.emailVerified).toBe(true);
  });

  it('does not reveal whether an email is registered', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: 'ghost@example.com' }).expect(204);
  });

  it('resets the password and signs out every session', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: user.user.email }).expect(204);
    const mail = sentMail.findLast((m) => m.to === user.user.email && m.subject.includes('Reset'));
    const token = linkToken(mail!.text);

    await request(app).post('/api/auth/reset-password').send({ token, password: 'brand new password' }).expect(204);
    await request(app).post('/api/auth/refresh').set(CSRF).set('Cookie', user.cookie).expect(401);
    await request(app)
      .post('/api/auth/login')
      .send({ email: user.user.email, password: 'brand new password' })
      .expect(200);
  });

  it('changes the password when the current one is correct', async () => {
    const u = await registerUser(app, 'Changer');
    await request(app)
      .post('/api/auth/change-password')
      .set(u.auth)
      .send({ currentPassword: 'wrong password', newPassword: 'another long password' })
      .expect(400);
    await request(app)
      .post('/api/auth/change-password')
      .set(u.auth)
      .send({ currentPassword: 'correct horse battery', newPassword: 'another long password' })
      .expect(200);
  });
});

describe('profile', () => {
  it('returns real stats and updates the display name', async () => {
    const u = await registerUser(app, 'Profile');
    await request(app).post('/api/boards').set(u.auth).send({ name: 'Algebra' }).expect(201);
    const profile = await request(app).get('/api/profile').set(u.auth).expect(200);
    expect(profile.body.stats).toMatchObject({ boardsCreated: 1, boardsJoined: 0, messagesSent: 0 });

    const updated = await request(app)
      .patch('/api/profile')
      .set(u.auth)
      .send({ displayName: 'Ms. Frizzle' })
      .expect(200);
    expect(updated.body.user.displayName).toBe('Ms. Frizzle');
  });

  it('deletes the account and everything it owns', async () => {
    const u = await registerUser(app, 'Leaver');
    const board = await request(app).post('/api/boards').set(u.auth).send({ name: 'Temp' }).expect(201);
    await request(app).delete('/api/profile').set(u.auth).expect(204);
    const other = await registerUser(app, 'Other');
    await request(app).get(`/api/boards/${board.body.id}`).set(other.auth).expect(404);
  });
});

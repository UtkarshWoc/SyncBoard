import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { applyElements } from '../src/services/sceneService.js';
import { element, registerUser, type TestUser } from './helpers.js';

const app = createApp();

let owner: TestUser;
let student: TestUser;
let stranger: TestUser;

beforeAll(async () => {
  [owner, student, stranger] = await Promise.all([
    registerUser(app, 'Teacher'),
    registerUser(app, 'Student'),
    registerUser(app, 'Stranger'),
  ]);
});

const createBoard = async (body: Record<string, unknown> = {}) =>
  (
    await request(app)
      .post('/api/boards')
      .set(owner.auth)
      .send({ name: 'Fractions', ...body })
      .expect(201)
  ).body;

describe('creating and listing boards', () => {
  it('creates a private board with a readable code by default', async () => {
    const board = await createBoard();
    expect(board.id).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
    expect(board).toMatchObject({ role: 'owner', listed: false, generalAccess: 'restricted', hasPassword: false });
  });

  it('separates owned, shared and public boards', async () => {
    const pub = await createBoard({ name: 'Open Lesson', listed: true, generalAccess: 'viewer' });
    const lists = await request(app).get('/api/boards').set(student.auth).expect(200);
    expect(lists.body.public.map((b: { id: string }) => b.id)).toContain(pub.id);
    expect(lists.body.owned).toHaveLength(0);

    const mine = await request(app).get('/api/boards').set(owner.auth).expect(200);
    expect(mine.body.owned.map((b: { id: string }) => b.id)).toContain(pub.id);
    expect(mine.body.public.map((b: { id: string }) => b.id)).not.toContain(pub.id);
  });

  it('validates input', async () => {
    const res = await request(app).post('/api/boards').set(owner.auth).send({ name: '   ' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });
});

describe('access control', () => {
  it('hides restricted boards from non-members', async () => {
    const board = await createBoard();
    const res = await request(app).get(`/api/boards/${board.id}`).set(stranger.auth).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('grants the general-access role to anyone with the code', async () => {
    const board = await createBoard({ generalAccess: 'viewer' });
    const res = await request(app).get(`/api/boards/${board.id.toLowerCase()}`).set(stranger.auth).expect(200);
    expect(res.body.role).toBe('viewer');
    expect(res.body.invites).toBeUndefined();
  });

  it('only lets the owner change settings or delete', async () => {
    const board = await createBoard({ generalAccess: 'editor' });
    await request(app).patch(`/api/boards/${board.id}`).set(student.auth).send({ name: 'Hacked' }).expect(403);
    await request(app).delete(`/api/boards/${board.id}`).set(student.auth).expect(403);
    const res = await request(app)
      .patch(`/api/boards/${board.id}`)
      .set(owner.auth)
      .send({ name: 'Renamed' })
      .expect(200);
    expect(res.body.name).toBe('Renamed');
    await request(app).delete(`/api/boards/${board.id}`).set(owner.auth).expect(204);
    await request(app).get(`/api/boards/${board.id}`).set(owner.auth).expect(404);
  });

  it('gates link access behind a board password and remembers it once unlocked', async () => {
    const board = await createBoard({ generalAccess: 'editor' });
    await request(app).patch(`/api/boards/${board.id}`).set(owner.auth).send({ password: 'pi314' }).expect(200);

    const locked = await request(app).get(`/api/boards/${board.id}`).set(student.auth).expect(403);
    expect(locked.body.error).toMatchObject({ code: 'PASSWORD_REQUIRED', details: { name: 'Fractions' } });

    const wrong = await request(app)
      .post(`/api/boards/${board.id}/unlock`)
      .set(student.auth)
      .send({ password: 'nope' })
      .expect(403);
    expect(wrong.body.error.code).toBe('INVALID_PASSWORD');

    await request(app).post(`/api/boards/${board.id}/unlock`).set(student.auth).send({ password: 'pi314' }).expect(200);
    const unlocked = await request(app).get(`/api/boards/${board.id}`).set(student.auth).expect(200);
    expect(unlocked.body.role).toBe('editor');
  });
});

describe('invites and members', () => {
  it('lets the owner invite, change roles and remove members', async () => {
    const board = await createBoard();
    const invite = await request(app)
      .post(`/api/boards/${board.id}/invites`)
      .set(owner.auth)
      .send({ role: 'viewer' })
      .expect(201);
    const token = invite.body.token as string;

    const preview = await request(app).get(`/api/invites/${token}`).set(student.auth).expect(200);
    expect(preview.body).toMatchObject({ boardId: board.id, boardName: 'Fractions', role: 'viewer' });

    await request(app).post(`/api/invites/${token}/accept`).set(student.auth).expect(200);
    let details = await request(app).get(`/api/boards/${board.id}`).set(owner.auth).expect(200);
    expect(details.body.members).toHaveLength(1);
    expect(details.body.invites[0].uses).toBe(1);

    details = await request(app)
      .patch(`/api/boards/${board.id}/members/${student.user.id}`)
      .set(owner.auth)
      .send({ role: 'editor' })
      .expect(200);
    expect(details.body.members[0].role).toBe('editor');

    // Accepting a viewer invite never downgrades an editor.
    await request(app).post(`/api/invites/${token}/accept`).set(student.auth).expect(200);
    expect((await request(app).get(`/api/boards/${board.id}`).set(student.auth)).body.role).toBe('editor');

    await request(app).delete(`/api/boards/${board.id}/members/${student.user.id}`).set(owner.auth).expect(204);
    await request(app).get(`/api/boards/${board.id}`).set(student.auth).expect(403);

    await request(app).delete(`/api/boards/${board.id}/invites/${token}`).set(owner.auth).expect(204);
    await request(app).get(`/api/invites/${token}`).set(student.auth).expect(404);
  });

  it('lets members leave on their own', async () => {
    const board = await createBoard();
    const { body } = await request(app)
      .post(`/api/boards/${board.id}/invites`)
      .set(owner.auth)
      .send({ role: 'editor' });
    await request(app).post(`/api/invites/${body.token}/accept`).set(stranger.auth).expect(200);
    await request(app).delete(`/api/boards/${board.id}/members/${stranger.user.id}`).set(stranger.auth).expect(204);
    await request(app).delete(`/api/boards/${board.id}/members/${owner.user.id}`).set(stranger.auth).expect(403);
  });
});

describe('files, thumbnails and versions', () => {
  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  it('stores images for editors and serves them to viewers', async () => {
    const board = await createBoard({ generalAccess: 'viewer' });
    await request(app)
      .post(`/api/boards/${board.id}/files`)
      .set(stranger.auth)
      .send({ id: 'f1', mimeType: 'image/png', dataURL: PNG })
      .expect(403);
    await request(app)
      .post(`/api/boards/${board.id}/files`)
      .set(owner.auth)
      .send({ id: 'f1', mimeType: 'image/png', dataURL: PNG })
      .expect(201);
    const file = await request(app).get(`/api/boards/${board.id}/files/f1`).set(stranger.auth).expect(200);
    expect(file.body).toMatchObject({ id: 'f1', mimeType: 'image/png', dataURL: PNG });
  });

  it('saves thumbnails', async () => {
    const board = await createBoard();
    await request(app).put(`/api/boards/${board.id}/thumbnail`).set(owner.auth).send({ dataURL: PNG }).expect(204);
    const lists = await request(app).get('/api/boards').set(owner.auth);
    expect(lists.body.owned.find((b: { id: string }) => b.id === board.id).thumbnail).toBe(PNG);
  });

  it('snapshots and restores versions', async () => {
    const board = await createBoard();
    await applyElements(board.id, [element('a', 1), element('b', 1)]);

    const saved = await request(app)
      .post(`/api/boards/${board.id}/versions`)
      .set(owner.auth)
      .send({ label: 'Before homework' })
      .expect(201);
    expect(saved.body).toMatchObject({ kind: 'manual', label: 'Before homework', elementCount: 2 });

    // Edit after the snapshot: delete b, add c.
    await applyElements(board.id, [element('b', 2, { isDeleted: true }), element('c', 1)]);

    const restored = await request(app)
      .post(`/api/boards/${board.id}/versions/${saved.body.id}/restore`)
      .set(owner.auth)
      .expect(200);
    expect(restored.body.changed).toBe(3);

    const list = await request(app).get(`/api/boards/${board.id}/versions`).set(owner.auth).expect(200);
    expect(list.body.map((v: { kind: string }) => v.kind)).toEqual(['pre-restore', 'manual']);

    const detail = await request(app)
      .get(`/api/boards/${board.id}/versions/${saved.body.id}`)
      .set(owner.auth)
      .expect(200);
    expect(detail.body.elements.map((e: { id: string }) => e.id).sort()).toEqual(['a', 'b']);
  });
});

import request from 'supertest';
import type { ChatMessage, CommentThread, JoinedBoard, Participant, SceneElement } from '@syncboard/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  call,
  connectSocket,
  element,
  nextEvent,
  noEvent,
  registerUser,
  startServer,
  type ClientSocket,
  type TestServer,
  type TestUser,
} from './helpers.js';

let server: TestServer;
let teacher: TestUser;
let student: TestUser;
let viewer: TestUser;
const sockets: ClientSocket[] = [];

const open = async (user: TestUser) => {
  const s = await connectSocket(server.url, user.accessToken);
  sockets.push(s);
  return s;
};

async function boardWith(access: Record<string, unknown> = {}) {
  const res = await request(server.app)
    .post('/api/boards')
    .set(teacher.auth)
    .send({ name: 'Geometry', generalAccess: 'editor', ...access })
    .expect(201);
  return res.body.id as string;
}

async function addViewer(boardId: string) {
  const invite = await request(server.app)
    .post(`/api/boards/${boardId}/invites`)
    .set(teacher.auth)
    .send({ role: 'viewer' });
  await request(server.app).post(`/api/invites/${invite.body.token}/accept`).set(viewer.auth).expect(200);
}

beforeAll(async () => {
  server = await startServer();
  [teacher, student, viewer] = await Promise.all([
    registerUser(server.app, 'Teacher'),
    registerUser(server.app, 'Student'),
    registerUser(server.app, 'Viewer'),
  ]);
});

afterEach(() => {
  while (sockets.length) sockets.pop()!.close();
});

afterAll(async () => {
  await server.close();
});

describe('handshake', () => {
  it('rejects connections without a valid access token', async () => {
    await expect(connectSocket(server.url, null)).rejects.toThrow('UNAUTHORIZED');
    await expect(connectSocket(server.url, 'garbage')).rejects.toThrow('UNAUTHORIZED');
  });

  it('accepts a valid token', async () => {
    const s = await open(teacher);
    expect(s.connected).toBe(true);
  });
});

describe('joining boards', () => {
  it('returns the scene and announces participants', async () => {
    const boardId = await boardWith();
    const a = await open(teacher);
    const joinA = await call<JoinedBoard>(a, 'board:join', { boardId });
    expect(joinA.ok).toBe(true);
    if (!joinA.ok) return;
    expect(joinA.data.role).toBe('owner');
    expect(joinA.data.elements).toEqual([]);

    const b = await open(student);
    const participantsSeenByA = nextEvent<Participant[]>(a, 'participants');
    const joinB = await call<JoinedBoard>(b, 'board:join', { boardId: boardId.toLowerCase() });
    expect(joinB.ok && joinB.data.role).toBe('editor');
    expect((await participantsSeenByA).map((p) => p.user.id).sort()).toEqual([teacher.user.id, student.user.id].sort());
  });

  it('refuses restricted boards and asks for passwords', async () => {
    const restricted = await boardWith({ generalAccess: 'restricted' });
    const s = await open(student);
    const denied = await call(s, 'board:join', { boardId: restricted });
    expect(!denied.ok && denied.error.code).toBe('FORBIDDEN');

    const locked = await boardWith();
    await request(server.app).patch(`/api/boards/${locked}`).set(teacher.auth).send({ password: 'secret' }).expect(200);
    const needs = await call(s, 'board:join', { boardId: locked });
    expect(!needs.ok && needs.error.code).toBe('PASSWORD_REQUIRED');
    const ok = await call<JoinedBoard>(s, 'board:join', { boardId: locked, password: 'secret' });
    expect(ok.ok).toBe(true);
  });

  it('reports unknown boards', async () => {
    const s = await open(student);
    const res = await call(s, 'board:join', { boardId: 'ZZZZZZZZ' });
    expect(!res.ok && res.error.code).toBe('NOT_FOUND');
  });
});

describe('scene sync', () => {
  it('relays accepted edits to everyone else and persists them', async () => {
    const boardId = await boardWith();
    const a = await open(teacher);
    const b = await open(student);
    await call(a, 'board:join', { boardId });
    await call(b, 'board:join', { boardId });

    const received = nextEvent<{ elements: SceneElement[] }>(b, 'scene:update');
    const ack = await call<{ accepted: number }>(a, 'scene:update', { elements: [element('r1', 1)] });
    expect(ack.ok && ack.data.accepted).toBe(1);
    expect((await received).elements[0]!.id).toBe('r1');

    const c = await open(viewer);
    const joined = await call<JoinedBoard>(c, 'board:join', { boardId });
    expect(joined.ok && joined.data.elements.map((e) => e.id)).toEqual(['r1']);
  });

  it('sends the winning copy back to a client with stale edits', async () => {
    const boardId = await boardWith();
    const a = await open(teacher);
    await call(a, 'board:join', { boardId });
    await call(a, 'scene:update', { elements: [element('r1', 5)] });

    const correction = nextEvent<{ elements: SceneElement[] }>(a, 'scene:update');
    const ack = await call<{ rejected: number }>(a, 'scene:update', { elements: [element('r1', 2)] });
    expect(ack.ok && ack.data.rejected).toBe(1);
    expect((await correction).elements[0]!.version).toBe(5);
  });

  it('blocks viewers from editing', async () => {
    const boardId = await boardWith({ generalAccess: 'restricted' });
    await addViewer(boardId);
    const v = await open(viewer);
    const joined = await call<JoinedBoard>(v, 'board:join', { boardId });
    expect(joined.ok && joined.data.role).toBe('viewer');
    const res = await call(v, 'scene:update', { elements: [element('x', 1)] });
    expect(!res.ok && res.error.code).toBe('FORBIDDEN');
  });

  it('validates payloads', async () => {
    const boardId = await boardWith();
    const a = await open(teacher);
    await call(a, 'board:join', { boardId });
    const res = await call(a, 'scene:update', { elements: [{ id: 'no-version' }] });
    expect(!res.ok && res.error.code).toBe('VALIDATION');
  });

  it('requires joining first', async () => {
    const a = await open(teacher);
    const res = await call(a, 'scene:update', { elements: [element('x', 1)] });
    expect(!res.ok && res.error.code).toBe('NOT_JOINED');
  });

  it('broadcasts presence without echoing it back', async () => {
    const boardId = await boardWith();
    const a = await open(teacher);
    const b = await open(student);
    await call(a, 'board:join', { boardId });
    await call(b, 'board:join', { boardId });
    const seen = nextEvent<{ socketId: string; pointer: { x: number } }>(b, 'presence:update');
    const notEchoed = noEvent(a, 'presence:update');
    a.emit('presence:update', { pointer: { x: 12, y: 34, tool: 'pointer' } });
    expect(await seen).toMatchObject({ socketId: a.id, pointer: { x: 12 } });
    await notEchoed;
  });
});

describe('chat', () => {
  it('broadcasts messages, pages history and lets the owner moderate', async () => {
    const boardId = await boardWith();
    const a = await open(teacher);
    const b = await open(student);
    await call(a, 'board:join', { boardId });
    await call(b, 'board:join', { boardId });

    const incoming = nextEvent<ChatMessage>(a, 'chat:message');
    const sent = await call<ChatMessage>(b, 'chat:send', { text: '  what is 7 x 8?  ' });
    expect(sent.ok && sent.data.text).toBe('what is 7 x 8?');
    expect((await incoming).user.id).toBe(student.user.id);

    const history = await call<{ messages: ChatMessage[] }>(a, 'chat:history', {});
    expect(history.ok && history.data.messages).toHaveLength(1);

    const deleted = nextEvent<{ messageId: string }>(b, 'chat:deleted');
    expect((await call(a, 'chat:delete', { messageId: sent.ok ? sent.data.id : '' })).ok).toBe(true);
    await deleted;

    expect((await call(a, 'chat:mute', { userId: student.user.id, muted: true })).ok).toBe(true);
    const muted = await call(b, 'chat:send', { text: 'hello?' });
    expect(!muted.ok && muted.error.code).toBe('MUTED');

    const notOwner = await call(b, 'chat:mute', { userId: teacher.user.id, muted: true });
    expect(notOwner.ok).toBe(false);
  });
});

describe('comments', () => {
  it('creates, replies to, resolves and deletes pinned threads', async () => {
    const boardId = await boardWith({ generalAccess: 'restricted' });
    await addViewer(boardId);
    const a = await open(teacher);
    const v = await open(viewer);
    await call(a, 'board:join', { boardId });
    await call(v, 'board:join', { boardId });

    // Viewers (students) can still comment.
    const upsert = nextEvent<CommentThread>(a, 'comments:upsert');
    const created = await call<CommentThread>(v, 'comment:create', { x: 100, y: 200, text: 'I am stuck here' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect((await upsert).comments[0]!.text).toBe('I am stuck here');

    const replied = await call<CommentThread>(a, 'comment:reply', { threadId: created.data.id, text: 'Try factoring' });
    expect(replied.ok && replied.data.comments).toHaveLength(2);

    const resolved = await call<CommentThread>(a, 'comment:resolve', { threadId: created.data.id, resolved: true });
    expect(resolved.ok && resolved.data.resolved).toBe(true);

    const removed = nextEvent<{ threadId: string }>(v, 'comments:remove');
    expect((await call(a, 'comment:delete', { threadId: created.data.id })).ok).toBe(true);
    expect((await removed).threadId).toBe(created.data.id);
  });
});

describe('voice and video signalling', () => {
  it('relays signals only between call participants on the same board', async () => {
    const boardId = await boardWith();
    const a = await open(teacher);
    const b = await open(student);
    await call(a, 'board:join', { boardId });
    await call(b, 'board:join', { boardId });

    const first = await call<{ peers: string[] }>(a, 'rtc:join', { audio: true, video: false });
    expect(first.ok && first.data.peers).toEqual([]);

    const peerJoined = nextEvent<{ socketId: string }>(a, 'rtc:peer-joined');
    const second = await call<{ peers: string[] }>(b, 'rtc:join', { audio: true, video: true });
    expect(second.ok && second.data.peers).toEqual([a.id]);
    expect((await peerJoined).socketId).toBe(b.id);

    const signal = nextEvent<{ from: string; data: unknown }>(a, 'rtc:signal');
    b.emit('rtc:signal', { to: a.id!, data: { description: { type: 'offer', sdp: 'v=0' } } });
    expect(await signal).toMatchObject({ from: b.id, data: { description: { type: 'offer' } } });

    const left = nextEvent<{ socketId: string }>(a, 'rtc:peer-left');
    b.emit('rtc:leave');
    expect((await left).socketId).toBe(b.id);
  });
});

describe('access changes while connected', () => {
  it('kicks a member out when the owner removes them', async () => {
    const boardId = await boardWith({ generalAccess: 'restricted' });
    await addViewer(boardId);
    const v = await open(viewer);
    await call(v, 'board:join', { boardId });

    const kicked = nextEvent<{ reason: string }>(v, 'board:removed');
    await request(server.app).delete(`/api/boards/${boardId}/members/${viewer.user.id}`).set(teacher.auth).expect(204);
    expect((await kicked).reason).toBe('access-revoked');

    const res = await call(v, 'chat:send', { text: 'still here?' });
    expect(res.ok).toBe(false);
  });

  it('tells clients when their role changes', async () => {
    const boardId = await boardWith({ generalAccess: 'restricted' });
    await addViewer(boardId);
    const v = await open(viewer);
    await call(v, 'board:join', { boardId });

    const changed = nextEvent<{ role: string }>(v, 'board:role-changed');
    await request(server.app)
      .patch(`/api/boards/${boardId}/members/${viewer.user.id}`)
      .set(teacher.auth)
      .send({ role: 'editor' })
      .expect(200);
    expect((await changed).role).toBe('editor');
    const edit = await call(v, 'scene:update', { elements: [element('promoted', 1)] });
    expect(edit.ok).toBe(true);
  });

  it('notifies everyone when the board is deleted', async () => {
    const boardId = await boardWith();
    const b = await open(student);
    await call(b, 'board:join', { boardId });
    const removed = nextEvent<{ reason: string }>(b, 'board:removed');
    await request(server.app).delete(`/api/boards/${boardId}`).set(teacher.auth).expect(204);
    expect((await removed).reason).toBe('deleted');
  });

  it('pushes restored versions to connected clients', async () => {
    const boardId = await boardWith();
    const a = await open(teacher);
    await call(a, 'board:join', { boardId });
    await call(a, 'scene:update', { elements: [element('keep', 1)] });
    const version = await request(server.app)
      .post(`/api/boards/${boardId}/versions`)
      .set(teacher.auth)
      .send({})
      .expect(201);
    await call(a, 'scene:update', { elements: [element('extra', 1)] });

    const update = nextEvent<{ elements: SceneElement[] }>(a, 'scene:update');
    await request(server.app)
      .post(`/api/boards/${boardId}/versions/${version.body.id}/restore`)
      .set(teacher.auth)
      .expect(200);
    const byId = Object.fromEntries((await update).elements.map((e) => [e.id, e]));
    expect(byId.keep?.isDeleted).toBe(false);
    expect(byId.extra?.isDeleted).toBe(true);
  });
});

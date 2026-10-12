import {
  chatDeleteSchema,
  chatHistorySchema,
  chatMuteSchema,
  chatSendSchema,
  commentCreateSchema,
  commentDeleteSchema,
  commentReplySchema,
  commentResolveSchema,
  joinBoardSchema,
  presenceSchema,
  rtcMediaSchema,
  rtcSignalSchema,
  sceneUpdateSchema,
  type ApiError,
  type JoinedBoard,
  type Result,
  type Role,
  type SceneElement,
} from '@syncboard/shared';
import type { ZodType, z } from 'zod';
import { HttpError, forbidden, toHttpError, validationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { socketEvents } from '../lib/metrics.js';
import * as boards from '../services/boardService.js';
import * as chat from '../services/chatService.js';
import * as comments from '../services/commentService.js';
import * as scene from '../services/sceneService.js';
import { addCollaborationTime } from '../services/userService.js';
import { broadcastParticipants, participantsOf, toParticipant } from './participants.js';
import { createLimiter, type BucketName } from './rateLimiter.js';
import { type AppSocket, type IO, boardRoom } from './types.js';

const ROLE_TTL_MS = 5_000;

type AckFn = (result: Result<unknown>) => void;

interface Joined {
  boardId: string;
  role: Role;
}

export function registerHandlers(io: IO, socket: AppSocket) {
  const allow = createLimiter();
  const log = logger.child({ socketId: socket.id, userId: socket.data.user.id });

  /** Re-read the caller's role at most every few seconds so permission changes apply promptly. */
  async function currentAccess(): Promise<Joined> {
    const { boardId } = socket.data;
    if (!boardId) throw new HttpError(409, 'NOT_JOINED', 'Join a board first');
    if (socket.data.role && Date.now() - socket.data.roleCheckedAt < ROLE_TTL_MS) {
      return { boardId, role: socket.data.role };
    }
    const board = await boards.getBoard(boardId).catch(() => null);
    const role = board ? boards.resolveAccess(board, socket.data.user.id).role : null;
    if (!board || !role) {
      socket.emit('board:removed', { reason: board ? 'access-revoked' : 'deleted' });
      await leaveBoard();
      throw forbidden('You no longer have access to this board');
    }
    socket.data.role = role;
    socket.data.mutedUserIds = board.mutedUserIds.map((id) => id.toString());
    socket.data.roleCheckedAt = Date.now();
    return { boardId, role };
  }

  async function requireRole(min: Role): Promise<Joined> {
    const access = await currentAccess();
    if (!boards.atLeast(access.role, min)) {
      throw forbidden(
        min === 'editor' ? 'You have view-only access to this board' : 'Only the board owner can do that',
      );
    }
    return access;
  }

  /**
   * Wire an event with validation, rate limiting, error mapping and metrics.
   * Handlers return data for the ack; throwing an HttpError acks `{ ok: false }`.
   */
  function on<S extends ZodType>(
    event: string,
    schema: S | null,
    bucket: BucketName,
    handler: (data: z.infer<S>) => Promise<unknown>,
  ) {
    (socket as unknown as { on: (e: string, fn: (...args: unknown[]) => void) => void }).on(event, (...args) => {
      const ack = typeof args[args.length - 1] === 'function' ? (args.pop() as AckFn) : undefined;
      const reply = (result: Result<unknown>) => ack?.(result);
      const fail = (error: ApiError, outcome: string) => {
        socketEvents.inc({ event, outcome });
        reply({ ok: false, error });
      };

      if (!allow(bucket)) {
        // Presence floods are dropped silently; everything else is told to slow down.
        if (bucket !== 'presence')
          fail({ code: 'RATE_LIMITED', message: 'Slow down — too many requests' }, 'rate_limited');
        return;
      }

      let data: unknown = undefined;
      if (schema) {
        const parsed = schema.safeParse(args[0]);
        if (!parsed.success) return fail(validationError(parsed.error).toJSON(), 'invalid');
        data = parsed.data;
      }

      handler(data as z.infer<S>)
        .then((result) => {
          socketEvents.inc({ event, outcome: 'ok' });
          reply({ ok: true, data: result ?? null });
        })
        .catch((err: unknown) => {
          const httpErr = toHttpError(err);
          if (httpErr.status >= 500) log.error({ err, event }, 'Socket handler failed');
          fail(httpErr.toJSON(), 'error');
        });
    });
  }

  async function leaveBoard(): Promise<void> {
    const { boardId, joinedAt, inCall } = socket.data;
    if (!boardId) return;
    const room = boardRoom(boardId);
    socket.data.boardId = null;
    socket.data.role = null;
    socket.data.joinedAt = null;
    socket.data.inCall = false;
    await socket.leave(room);
    if (inCall) socket.to(room).emit('rtc:peer-left', { socketId: socket.id });
    if (joinedAt) await addCollaborationTime(socket.data.user.id, Date.now() - joinedAt);
    await broadcastParticipants(io, boardId);
  }

  // ─── Board session ───────────────────────────────────────────
  on('board:join', joinBoardSchema, 'join', async ({ boardId, password }): Promise<JoinedBoard> => {
    if (socket.data.boardId && socket.data.boardId !== boardId) await leaveBoard();

    const board = await boards.getBoard(boardId);
    const userId = socket.data.user.id;
    const access = boards.resolveAccess(board, userId);
    let role = access.role;
    if (!role) {
      if (!access.needsPassword) throw forbidden('You do not have access to this board');
      if (!password) throw new HttpError(403, 'PASSWORD_REQUIRED', 'This board is password protected');
      role = await boards.unlockWithPassword(board, userId, password);
    }

    // Join the room before loading the scene so no update falls between the two;
    // the client buffers updates that arrive before this ack.
    await socket.join(boardRoom(board._id));
    Object.assign(socket.data, {
      boardId: board._id,
      role,
      roleCheckedAt: Date.now(),
      mutedUserIds: board.mutedUserIds.map((id) => id.toString()),
      joinedAt: socket.data.joinedAt ?? Date.now(),
    });

    const [elements, fileIds, threads, history, participants, summary] = await Promise.all([
      scene.loadElements(board._id),
      scene.listFileIds(board._id),
      comments.listThreads(board._id),
      chat.history(board._id),
      participantsOf(io, board._id),
      boards.summaryFor(board, userId),
    ]);
    socket.to(boardRoom(board._id)).emit('participants', participants);
    void boards.touchBoard(board._id, false);

    return {
      board: { ...summary, role, liveCount: participants.length },
      role,
      me: toParticipant(socket)!,
      participants,
      elements,
      fileIds,
      comments: threads,
      chat: history.messages,
      hasMoreChat: history.hasMore,
      mutedUserIds: socket.data.mutedUserIds,
    };
  });

  on('board:leave', null, 'misc', async () => {
    await leaveBoard();
    return null;
  });

  socket.on('disconnect', (reason) => {
    log.debug({ reason }, 'Socket disconnected');
    leaveBoard().catch((err: unknown) => log.error({ err }, 'Cleanup after disconnect failed'));
  });

  // ─── Scene ───────────────────────────────────────────────────
  on('scene:update', sceneUpdateSchema, 'scene', async ({ elements }) => {
    const { boardId } = await requireRole('editor');
    const { accepted, current, dropped } = await scene.applyElements(boardId, elements as SceneElement[]);
    if (accepted.length) {
      socket.to(boardRoom(boardId)).emit('scene:update', { elements: accepted });
      void boards.touchBoard(boardId, true);
    }
    // Send the winning copies back so a client holding stale versions converges.
    if (current.length) socket.emit('scene:update', { elements: current });
    if (dropped) socket.emit('notice', { level: 'warning', message: `${dropped} oversized element(s) were not saved` });
    return { accepted: accepted.length, rejected: current.length + dropped };
  });

  on('presence:update', presenceSchema, 'presence', async (payload) => {
    const { boardId } = socket.data;
    if (!boardId) return null;
    socket.to(boardRoom(boardId)).volatile.emit('presence:update', { ...payload, socketId: socket.id });
    return null;
  });

  // ─── Chat ────────────────────────────────────────────────────
  on('chat:send', chatSendSchema, 'chat', async ({ text }) => {
    const { boardId } = await currentAccess();
    const message = await chat.sendMessage(boardId, socket.data.user, text, socket.data.mutedUserIds);
    io.to(boardRoom(boardId)).emit('chat:message', message);
    return message;
  });

  on('chat:history', chatHistorySchema, 'misc', async ({ before }) => {
    const { boardId } = await currentAccess();
    return chat.history(boardId, before);
  });

  on('chat:delete', chatDeleteSchema, 'chat', async ({ messageId }) => {
    const { boardId, role } = await currentAccess();
    await chat.deleteMessage(boardId, messageId, socket.data.user.id, role === 'owner');
    io.to(boardRoom(boardId)).emit('chat:deleted', { messageId });
    return null;
  });

  on('chat:mute', chatMuteSchema, 'misc', async ({ userId, muted }) => {
    const { boardId } = await requireRole('owner');
    const board = await boards.getBoard(boardId);
    const mutedUserIds = await boards.setMuted(board, userId, muted);
    socket.data.mutedUserIds = mutedUserIds;
    io.to(boardRoom(boardId)).emit('board:muted', { mutedUserIds });
    // Other instances pick up the change on their next role refresh.
    for (const s of await io.in(boardRoom(boardId)).fetchSockets()) {
      const local = io.of('/').sockets.get(s.id);
      if (local) local.data.roleCheckedAt = 0;
    }
    return null;
  });

  // ─── Comments ────────────────────────────────────────────────
  on('comment:create', commentCreateSchema, 'comment', async ({ x, y, text }) => {
    const { boardId } = await currentAccess();
    const thread = await comments.createThread(boardId, socket.data.user, x, y, text);
    io.to(boardRoom(boardId)).emit('comments:upsert', thread);
    return thread;
  });

  on('comment:reply', commentReplySchema, 'comment', async ({ threadId, text }) => {
    const { boardId } = await currentAccess();
    const thread = await comments.reply(boardId, threadId, socket.data.user, text);
    io.to(boardRoom(boardId)).emit('comments:upsert', thread);
    return thread;
  });

  on('comment:resolve', commentResolveSchema, 'comment', async ({ threadId, resolved }) => {
    const { boardId } = await currentAccess();
    const thread = await comments.setResolved(boardId, threadId, resolved);
    io.to(boardRoom(boardId)).emit('comments:upsert', thread);
    return thread;
  });

  on('comment:delete', commentDeleteSchema, 'comment', async ({ threadId }) => {
    const { boardId, role } = await currentAccess();
    await comments.deleteThread(boardId, threadId, socket.data.user.id, role === 'owner');
    io.to(boardRoom(boardId)).emit('comments:remove', { threadId });
    return null;
  });

  // ─── Voice & video signalling (WebRTC mesh) ──────────────────
  on('rtc:join', rtcMediaSchema, 'rtc', async (media) => {
    const { boardId } = await currentAccess();
    const room = boardRoom(boardId);
    const peers = (await io.in(room).fetchSockets())
      .filter((s) => s.id !== socket.id && s.data.inCall)
      .map((s) => s.id);
    socket.data.inCall = true;
    socket.data.media = media;
    socket.to(room).emit('rtc:peer-joined', { socketId: socket.id, media });
    await broadcastParticipants(io, boardId);
    return { peers };
  });

  on('rtc:leave', null, 'rtc', async () => {
    const { boardId } = socket.data;
    if (!boardId || !socket.data.inCall) return null;
    socket.data.inCall = false;
    socket.to(boardRoom(boardId)).emit('rtc:peer-left', { socketId: socket.id });
    await broadcastParticipants(io, boardId);
    return null;
  });

  on('rtc:media', rtcMediaSchema, 'rtc', async (media) => {
    const { boardId } = socket.data;
    if (!boardId || !socket.data.inCall) return null;
    socket.data.media = media;
    socket.to(boardRoom(boardId)).emit('rtc:media', { socketId: socket.id, media });
    return null;
  });

  on('rtc:signal', rtcSignalSchema, 'rtc', async ({ to, data }) => {
    const { boardId } = socket.data;
    if (!boardId || !socket.data.inCall) throw new HttpError(409, 'NOT_JOINED', 'Join the call first');
    // Only relay to someone in the same board's call — sockets can't be used to message arbitrary ids.
    const target = (await io.in(boardRoom(boardId)).fetchSockets()).find((s) => s.id === to);
    if (!target?.data.inCall) return null;
    io.to(to).emit('rtc:signal', { from: socket.id, data });
    return null;
  });
}

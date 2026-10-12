import type { Realtime } from '../lib/realtime.js';
import { type IO, boardRoom } from './types.js';

/** Live counts for many boards would mean one cross-node round trip each; cap the fan-out. */
const MAX_COUNTED_BOARDS = 60;

export function createRealtime(io: IO): Realtime {
  /** Force local sockets to re-read their role on the next event. Remote ones expire within seconds. */
  const invalidate = (socketIds: string[]) => {
    for (const id of socketIds) {
      const local = io.of('/').sockets.get(id);
      if (local) local.data.roleCheckedAt = 0;
    }
  };

  const socketsIn = (boardId: string) => io.in(boardRoom(boardId)).fetchSockets();

  return {
    filesAdded(boardId, fileIds) {
      io.to(boardRoom(boardId)).emit('files:added', { fileIds });
    },

    sceneChanged(boardId, elements) {
      if (elements.length) io.to(boardRoom(boardId)).emit('scene:update', { elements });
    },

    versionsUpdated(boardId) {
      io.to(boardRoom(boardId)).emit('versions:updated');
    },

    async boardUpdated(boardId, summaryFor) {
      const sockets = await socketsIn(boardId);
      const byUser = new Map<string, typeof sockets>();
      for (const s of sockets) {
        const list = byUser.get(s.data.user.id) ?? [];
        list.push(s);
        byUser.set(s.data.user.id, list);
      }
      await Promise.all(
        [...byUser].map(async ([userId, userSockets]) => {
          const summary = await summaryFor(userId);
          invalidate(userSockets.map((s) => s.id));
          for (const s of userSockets) {
            if (!summary?.role) {
              s.emit('board:removed', { reason: summary ? 'access-revoked' : 'deleted' });
              s.leave(boardRoom(boardId));
              continue;
            }
            s.emit('board:updated', summary);
            if (summary.role !== s.data.role) s.emit('board:role-changed', { role: summary.role });
          }
        }),
      );
    },

    roleChanged(boardId, userId, role) {
      void socketsIn(boardId).then((sockets) => {
        const mine = sockets.filter((s) => s.data.user.id === userId);
        invalidate(mine.map((s) => s.id));
        for (const s of mine) s.emit('board:role-changed', { role });
      });
    },

    async removed(boardId, reason, userIds) {
      const sockets = await socketsIn(boardId);
      for (const s of sockets) {
        if (userIds && !userIds.includes(s.data.user.id)) continue;
        s.emit('board:removed', { reason });
        s.leave(boardRoom(boardId));
        const local = io.of('/').sockets.get(s.id);
        if (local) {
          local.data.boardId = null;
          local.data.role = null;
        }
      }
    },

    async liveCounts(boardIds) {
      const counts = new Map<string, number>();
      const ids = boardIds.slice(0, MAX_COUNTED_BOARDS);
      const results = await Promise.all(
        ids.map((id) =>
          socketsIn(id)
            .then((s) => s.length)
            .catch(() => 0),
        ),
      );
      ids.forEach((id, i) => counts.set(id, results[i] ?? 0));
      return counts;
    },
  };
}

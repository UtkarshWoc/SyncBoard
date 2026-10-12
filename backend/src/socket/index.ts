import type { Server as HttpServer } from 'node:http';
import { colorForUser, LIMITS } from '@syncboard/shared';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { toHttpError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { socketConnections } from '../lib/metrics.js';
import { toPublicUser } from '../lib/serialize.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { User } from '../models/User.js';
import { registerHandlers } from './handlers.js';
import { type IO, userRoom } from './types.js';

export function createSocketServer(httpServer: HttpServer): IO {
  const io: IO = new Server(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
    pingTimeout: env.SOCKET_PING_TIMEOUT,
    pingInterval: env.SOCKET_PING_INTERVAL,
    maxHttpBufferSize: LIMITS.SOCKET_PAYLOAD_BYTES_MAX,
    // No connectionStateRecovery: clients re-join their board on every (re)connect and
    // re-sync by element version, which also works across instances behind the Redis adapter.
  });

  // Authenticate the handshake with the same short-lived access token the REST API uses.
  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
      if (typeof token !== 'string' || !token) throw new Error('missing token');
      const userId = verifyAccessToken(token);
      const user = await User.findById(userId, { displayName: 1, avatarUrl: 1 });
      if (!user) throw new Error('unknown user');

      Object.assign(socket.data, {
        user: toPublicUser(user),
        color: colorForUser(userId),
        boardId: null,
        role: null,
        roleCheckedAt: 0,
        mutedUserIds: [],
        joinedAt: null,
        inCall: false,
        media: { audio: false, video: false },
      });
      next();
    } catch (err) {
      const httpErr = toHttpError(err);
      const error = new Error('UNAUTHORIZED') as Error & { data?: unknown };
      error.data = {
        code: 'UNAUTHORIZED',
        message: httpErr.status === 500 ? 'Authentication failed' : httpErr.message,
      };
      next(error);
    }
  });

  io.on('connection', (socket) => {
    socketConnections.inc();
    socket.on('disconnect', () => socketConnections.dec());
    void socket.join(userRoom(socket.data.user.id));
    logger.debug({ socketId: socket.id, userId: socket.data.user.id }, 'Socket connected');
    registerHandlers(io, socket);
  });

  return io;
}

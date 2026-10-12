import type { ClientToServerEvents, Result, ServerToClientEvents } from '@syncboard/shared';
import { io, type Socket } from 'socket.io-client';
import { getFreshAccessToken, refreshSession } from './api';
import { env } from './env';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * One socket per signed-in session. `auth` is a function so every (re)connect
 * sends a fresh access token rather than the one from page load.
 */
export function createSocket(): AppSocket {
  const socket: AppSocket = io(env.SOCKET_URL ?? '/', {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 8000,
    auth: (cb) => {
      void getFreshAccessToken().then((token) => cb({ token }));
    },
  });

  // A rejected handshake (expired/revoked token) is not retried automatically by Socket.IO.
  let authRetries = 0;
  socket.on('connect', () => {
    authRetries = 0;
  });
  socket.on('connect_error', (err) => {
    if (err.message !== 'UNAUTHORIZED' || authRetries >= 3) return;
    authRetries += 1;
    void refreshSession().then((payload) => {
      if (payload) setTimeout(() => socket.connect(), 300 * authRetries);
    });
  });

  return socket;
}

/** Emit and resolve with the ack, rejecting on timeout so callers never hang. */
export function emitWithAck<T>(
  socket: AppSocket,
  event: string,
  payload?: unknown,
  timeoutMs = 10_000,
): Promise<Result<T>> {
  return new Promise((resolve) => {
    const s = socket.timeout(timeoutMs) as unknown as {
      emit: (event: string, ...args: unknown[]) => void;
    };
    const callback = (err: Error | null, result: Result<T>) => {
      if (err) resolve({ ok: false, error: { code: 'INTERNAL', message: 'The server did not respond in time' } });
      else resolve(result);
    };
    if (payload === undefined) s.emit(event, callback);
    else s.emit(event, payload, callback);
  });
}

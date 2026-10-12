import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { AuthPayload, ClientToServerEvents, Result, ServerToClientEvents } from '@syncboard/shared';
import { io as connect, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { createSocketServer } from '../src/socket/index.js';
import { createRealtime } from '../src/socket/realtime.js';
import type { IO } from '../src/socket/types.js';

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface TestServer {
  app: Express;
  io: IO;
  url: string;
  close: () => Promise<void>;
}

export async function startServer(): Promise<TestServer> {
  const httpServer: Server = createServer();
  const io = createSocketServer(httpServer);
  const app = createApp({ realtime: createRealtime(io) });
  httpServer.on('request', app);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address() as AddressInfo;
  return {
    app,
    io,
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => io.close(() => resolve())),
  };
}

let counter = 0;

export interface TestUser extends AuthPayload {
  cookie: string;
  auth: { Authorization: string };
}

export async function registerUser(app: Express, name = 'User'): Promise<TestUser> {
  counter += 1;
  const email = `${name.toLowerCase().replace(/\W/g, '')}${counter}-${Date.now()}@example.com`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'correct horse battery', displayName: `${name} ${counter}` })
    .expect(201);
  const body = res.body as AuthPayload;
  const setCookie = res.headers['set-cookie'] as unknown as string[];
  return {
    ...body,
    cookie: setCookie.map((c) => c.split(';')[0]).join('; '),
    auth: { Authorization: `Bearer ${body.accessToken}` },
  };
}

export function connectSocket(url: string, token: string | null): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket: ClientSocket = connect(url, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => {
      socket.close();
      reject(err);
    });
  });
}

/** Emit with an ack and resolve with the Result. */
export function call<T>(socket: ClientSocket, event: string, payload?: unknown): Promise<Result<T>> {
  return new Promise((resolve) => {
    const s = socket as unknown as { emit: (e: string, ...args: unknown[]) => void };
    if (payload === undefined) s.emit(event, resolve);
    else s.emit(event, payload, resolve);
  });
}

export function nextEvent<T>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs);
    (socket as unknown as { once: (e: string, fn: (d: T) => void) => void }).once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/** Resolve if the event does NOT arrive within the window. */
export function noEvent(socket: ClientSocket, event: string, windowMs = 300): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = () => reject(new Error(`Unexpected "${event}"`));
    const s = socket as unknown as {
      once: (e: string, fn: () => void) => void;
      off: (e: string, fn: () => void) => void;
    };
    s.once(event, handler);
    setTimeout(() => {
      s.off(event, handler);
      resolve();
    }, windowMs);
  });
}

export const element = (id: string, version: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'rectangle',
  version,
  versionNonce: 1000 + version,
  isDeleted: false,
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...extra,
});

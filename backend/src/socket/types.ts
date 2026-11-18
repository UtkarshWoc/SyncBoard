import type { ClientToServerEvents, PublicUser, RtcMediaState, Role, ServerToClientEvents } from '@syncboard/shared';
import type { RemoteSocket, Server, Socket } from 'socket.io';

export interface SocketData {
  user: PublicUser;
  color: string;
  boardId: string | null;
  role: Role | null;
  /** When `role`/`mutedUserIds` were last re-read from the database. */
  roleCheckedAt: number;
  mutedUserIds: string[];
  joinedAt: number | null;
  inCall: boolean;
  media: RtcMediaState;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InterServerEvents {}

export type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type AnySocket = AppSocket | RemoteSocket<ServerToClientEvents, SocketData>;

export const boardRoom = (boardId: string) => `board:${boardId}`;
export const userRoom = (userId: string) => `user:${userId}`;

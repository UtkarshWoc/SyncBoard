import type { Participant } from '@syncboard/shared';
import { type AnySocket, type IO, boardRoom } from './types.js';

export function toParticipant(socket: AnySocket): Participant | null {
  const { user, color, role, inCall } = socket.data;
  if (!user || !role) return null;
  return { socketId: socket.id, user, color, role, inCall };
}

export async function participantsOf(io: IO, boardId: string): Promise<Participant[]> {
  const sockets = await io.in(boardRoom(boardId)).fetchSockets();
  return sockets.map(toParticipant).filter((p): p is Participant => p !== null);
}

export async function broadcastParticipants(io: IO, boardId: string): Promise<void> {
  io.to(boardRoom(boardId)).emit('participants', await participantsOf(io, boardId));
}

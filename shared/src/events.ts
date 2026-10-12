import type { RtcMediaState, RtcSignalData } from './schemas.js';
import type {
  BoardSummary,
  ChatMessage,
  CommentThread,
  Participant,
  PresencePayload,
  PresenceUpdate,
  Result,
  Role,
  SceneElement,
} from './types.js';

export type Ack<T = null> = (result: Result<T>) => void;

export interface JoinedBoard {
  board: BoardSummary;
  role: Role;
  me: Participant;
  participants: Participant[];
  elements: SceneElement[];
  fileIds: string[];
  comments: CommentThread[];
  chat: ChatMessage[];
  hasMoreChat: boolean;
  mutedUserIds: string[];
}

export interface ClientToServerEvents {
  'board:join': (payload: { boardId: string; password?: string }, ack: Ack<JoinedBoard>) => void;
  'board:leave': (ack?: Ack) => void;

  'scene:update': (payload: { elements: SceneElement[] }, ack?: Ack<{ accepted: number; rejected: number }>) => void;
  'presence:update': (payload: PresencePayload) => void;

  'chat:send': (payload: { text: string }, ack: Ack<ChatMessage>) => void;
  'chat:history': (payload: { before?: string }, ack: Ack<{ messages: ChatMessage[]; hasMore: boolean }>) => void;
  'chat:delete': (payload: { messageId: string }, ack: Ack) => void;
  'chat:mute': (payload: { userId: string; muted: boolean }, ack: Ack) => void;

  'comment:create': (payload: { x: number; y: number; text: string }, ack: Ack<CommentThread>) => void;
  'comment:reply': (payload: { threadId: string; text: string }, ack: Ack<CommentThread>) => void;
  'comment:resolve': (payload: { threadId: string; resolved: boolean }, ack: Ack<CommentThread>) => void;
  'comment:delete': (payload: { threadId: string }, ack: Ack) => void;

  'rtc:join': (payload: RtcMediaState, ack: Ack<{ peers: string[] }>) => void;
  'rtc:leave': () => void;
  'rtc:media': (payload: RtcMediaState) => void;
  'rtc:signal': (payload: { to: string; data: RtcSignalData }) => void;
}

export interface ServerToClientEvents {
  'scene:update': (payload: { elements: SceneElement[] }) => void;
  'files:added': (payload: { fileIds: string[] }) => void;
  'presence:update': (payload: PresenceUpdate) => void;
  participants: (participants: Participant[]) => void;

  'board:updated': (board: BoardSummary) => void;
  'board:role-changed': (payload: { role: Role }) => void;
  'board:removed': (payload: { reason: 'deleted' | 'access-revoked' }) => void;
  'board:muted': (payload: { mutedUserIds: string[] }) => void;
  'versions:updated': () => void;

  'chat:message': (message: ChatMessage) => void;
  'chat:deleted': (payload: { messageId: string }) => void;

  'comments:upsert': (thread: CommentThread) => void;
  'comments:remove': (payload: { threadId: string }) => void;

  'rtc:peer-joined': (payload: { socketId: string; media: RtcMediaState }) => void;
  'rtc:peer-left': (payload: { socketId: string }) => void;
  'rtc:media': (payload: { socketId: string; media: RtcMediaState }) => void;
  'rtc:signal': (payload: { from: string; data: RtcSignalData }) => void;

  notice: (payload: { level: 'info' | 'warning' | 'error'; message: string }) => void;
}

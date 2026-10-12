/** Board-level role. `owner` is implicit (Board.ownerId); members are editors or viewers. */
export type Role = 'owner' | 'editor' | 'viewer';
export type MemberRole = Exclude<Role, 'owner'>;

/** What anyone holding the board code/link gets, Google-Docs style. */
export type GeneralAccess = 'restricted' | 'viewer' | 'editor';

export interface PublicUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface AuthUser extends PublicUser {
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
  createdAt: string;
}

export interface AuthPayload {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  user: AuthUser;
}

export interface UserStats {
  boardsCreated: number;
  boardsJoined: number;
  messagesSent: number;
  timeCollaboratingMs: number;
}

export type BoardBackground = 'plain' | 'grid' | 'dots';

export interface BoardSummary {
  id: string;
  name: string;
  owner: PublicUser | null;
  /** Caller's effective role; null when they cannot open the board without a password/invite. */
  role: Role | null;
  listed: boolean;
  generalAccess: GeneralAccess;
  hasPassword: boolean;
  background: BoardBackground;
  thumbnail: string | null;
  createdAt: string;
  lastActivityAt: string;
  /** Live participant count, when known. */
  liveCount?: number;
}

export interface BoardMember {
  user: PublicUser;
  role: MemberRole;
  addedAt: string;
}

export interface InviteLink {
  token: string;
  role: MemberRole;
  createdAt: string;
  expiresAt: string | null;
  uses: number;
}

export interface BoardDetails extends BoardSummary {
  members: BoardMember[];
  mutedUserIds: string[];
  /** Only returned to the owner. */
  invites?: InviteLink[];
}

export interface BoardLists {
  owned: BoardSummary[];
  shared: BoardSummary[];
  public: BoardSummary[];
}

export interface InvitePreview {
  boardId: string;
  boardName: string;
  role: MemberRole;
  owner: PublicUser | null;
}

/**
 * An Excalidraw element as plain JSON. The server only relies on the sync fields;
 * everything else is stored and relayed verbatim.
 */
export interface SceneElement {
  id: string;
  version: number;
  versionNonce: number;
  isDeleted?: boolean;
  [key: string]: unknown;
}

export interface StoredFile {
  id: string;
  mimeType: string;
  dataURL: string;
  created: number;
}

export interface Participant {
  socketId: string;
  user: PublicUser;
  color: string;
  role: Role;
  inCall: boolean;
}

export interface Viewport {
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
}

export interface PresencePayload {
  pointer?: { x: number; y: number; tool: 'pointer' | 'laser' } | null;
  button?: 'up' | 'down';
  selectedElementIds?: Record<string, true>;
  viewport?: Viewport;
}

export interface PresenceUpdate extends PresencePayload {
  socketId: string;
}

export interface ChatMessage {
  id: string;
  boardId: string;
  user: PublicUser;
  text: string;
  createdAt: string;
}

export interface ThreadComment {
  id: string;
  author: PublicUser;
  text: string;
  createdAt: string;
}

export interface CommentThread {
  id: string;
  boardId: string;
  /** Scene coordinates of the pin. */
  x: number;
  y: number;
  resolved: boolean;
  createdBy: PublicUser;
  createdAt: string;
  comments: ThreadComment[];
}

export type VersionKind = 'auto' | 'manual' | 'pre-restore';

export interface BoardVersionSummary {
  id: string;
  label: string | null;
  kind: VersionKind;
  createdAt: string;
  createdBy: PublicUser | null;
  elementCount: number;
  thumbnail: string | null;
}

export interface BoardVersionDetail extends BoardVersionSummary {
  elements: SceneElement[];
}

/** Stable error codes so the UI can react without parsing messages. */
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PASSWORD_REQUIRED'
  | 'INVALID_PASSWORD'
  | 'NOT_JOINED'
  | 'MUTED'
  | 'LIMIT_EXCEEDED'
  | 'EMAIL_NOT_VERIFIED'
  | 'INTERNAL';

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };

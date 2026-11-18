import type {
  ApiError,
  AuthPayload,
  AuthUser,
  BoardDetails,
  BoardLists,
  BoardSummary,
  BoardVersionDetail,
  BoardVersionSummary,
  CreateBoardInput,
  ErrorCode,
  InvitePreview,
  MemberRole,
  Role,
  StoredFile,
  UpdateBoardInput,
  UserStats,
} from '@syncboard/shared';
import { env } from './env';

export class ApiRequestError extends Error implements ApiError {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

// ─── Access token (memory only — never persisted) ─────────────
let accessToken: string | null = null;
let accessExpiresAt = 0;
let refreshing: Promise<AuthPayload | null> | null = null;
const sessionListeners = new Set<(payload: AuthPayload | null) => void>();

function setSession(payload: AuthPayload | null) {
  accessToken = payload?.accessToken ?? null;
  accessExpiresAt = payload ? Date.now() + payload.expiresIn * 1000 : 0;
  for (const listener of sessionListeners) listener(payload);
}

/** Notified on every sign-in, refresh and sign-out (null). */
export function onSessionChange(listener: (payload: AuthPayload | null) => void): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

async function parseError(res: Response): Promise<ApiRequestError> {
  let body: { error?: ApiError } | null = null;
  try {
    body = (await res.json()) as { error?: ApiError };
  } catch {
    // Non-JSON error (proxy, network) — fall through to a generic message.
  }
  const error = body?.error;
  if (error) return new ApiRequestError(res.status, error.code, error.message, error.details);
  const code: ErrorCode = res.status === 429 ? 'RATE_LIMITED' : res.status >= 500 ? 'INTERNAL' : 'BAD_REQUEST';
  return new ApiRequestError(
    res.status,
    code,
    res.status >= 500 ? 'The server had a problem. Please try again.' : res.statusText,
  );
}

/**
 * Exchange the httpOnly refresh cookie for a new access token. Concurrent callers
 * share one request — the server rotates the token, so parallel refreshes would race.
 */
export function refreshSession(): Promise<AuthPayload | null> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${env.API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'syncboard' },
      });
      if (!res.ok) {
        setSession(null);
        return null;
      }
      const payload = (await res.json()) as AuthPayload;
      setSession(payload);
      return payload;
    } catch {
      // Network error: keep the current session state; callers decide what to do.
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** A token valid for at least the next 30 seconds, refreshing if needed. */
export async function getFreshAccessToken(): Promise<string | null> {
  if (accessToken && accessExpiresAt - Date.now() > 30_000) return accessToken;
  const payload = await refreshSession();
  return payload?.accessToken ?? null;
}

/**
 * Encode a value used as a URL path segment. Ids and tokens can come from the address bar
 * (e.g. /invite/:token), so an unencoded `../` could point a request at a different endpoint.
 */
const seg = (value: string) => encodeURIComponent(value);

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Attach the access token (default true). */
  auth?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = opts;
  const headers: Record<string, string> = { 'X-Requested-With': 'syncboard' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = await getFreshAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${env.API_BASE_URL}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiRequestError(0, 'INTERNAL', 'Could not reach the server. Check your connection.');
  }

  if (res.status === 401 && auth && !retried) {
    // The token may have been revoked or expired early; one refresh attempt, then give up.
    const refreshed = await refreshSession();
    if (refreshed) return request<T>(path, opts, true);
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function authResult(payload: AuthPayload): AuthPayload {
  setSession(payload);
  return payload;
}

export const api = {
  // ─── Auth ──────────────────────────────────────────────────
  async register(email: string, password: string, displayName: string) {
    return authResult(
      await request<AuthPayload>('/auth/register', {
        method: 'POST',
        body: { email, password, displayName },
        auth: false,
      }),
    );
  },
  async login(email: string, password: string) {
    return authResult(
      await request<AuthPayload>('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
    );
  },
  async google(credential: string) {
    return authResult(
      await request<AuthPayload>('/auth/google', { method: 'POST', body: { credential }, auth: false }),
    );
  },
  async logout() {
    try {
      await request<void>('/auth/logout', { method: 'POST', auth: false });
    } finally {
      setSession(null);
    }
  },
  async logoutAll() {
    try {
      await request<void>('/auth/logout-all', { method: 'POST' });
    } finally {
      setSession(null);
    }
  },
  me: () => request<{ user: AuthUser }>('/auth/me'),
  verifyEmail: (token: string) => request<void>('/auth/verify-email', { method: 'POST', body: { token }, auth: false }),
  resendVerification: () => request<void>('/auth/resend-verification', { method: 'POST' }),
  forgotPassword: (email: string) =>
    request<void>('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  resetPassword: (token: string, password: string) =>
    request<void>('/auth/reset-password', { method: 'POST', body: { token, password }, auth: false }),
  async changePassword(currentPassword: string | undefined, newPassword: string) {
    return authResult(
      await request<AuthPayload>('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
    );
  },

  // ─── Profile ───────────────────────────────────────────────
  profile: () => request<{ user: AuthUser; stats: UserStats }>('/profile'),
  updateProfile: (displayName: string) =>
    request<{ user: AuthUser }>('/profile', { method: 'PATCH', body: { displayName } }),
  async deleteAccount() {
    await request<void>('/profile', { method: 'DELETE' });
    setSession(null);
  },

  // ─── Boards ────────────────────────────────────────────────
  listBoards: () => request<BoardLists>('/boards'),
  createBoard: (input: CreateBoardInput) => request<BoardSummary>('/boards', { method: 'POST', body: input }),
  getBoard: (id: string) => request<BoardDetails>(`/boards/${seg(id)}`),
  unlockBoard: (id: string, password: string) =>
    request<{ role: Role }>(`/boards/${seg(id)}/unlock`, { method: 'POST', body: { password } }),
  updateBoard: (id: string, input: UpdateBoardInput) =>
    request<BoardDetails>(`/boards/${seg(id)}`, { method: 'PATCH', body: input }),
  deleteBoard: (id: string) => request<void>(`/boards/${seg(id)}`, { method: 'DELETE' }),
  setThumbnail: (id: string, dataURL: string) =>
    request<void>(`/boards/${seg(id)}/thumbnail`, { method: 'PUT', body: { dataURL } }),
  setMemberRole: (id: string, userId: string, role: MemberRole) =>
    request<BoardDetails>(`/boards/${seg(id)}/members/${seg(userId)}`, { method: 'PATCH', body: { role } }),
  removeMember: (id: string, userId: string) =>
    request<void>(`/boards/${seg(id)}/members/${seg(userId)}`, { method: 'DELETE' }),
  createInvite: (id: string, role: MemberRole, expiresInDays: number | null) =>
    request<{ token: string }>(`/boards/${seg(id)}/invites`, {
      method: 'POST',
      body: { role, expiresInDays },
    }),
  revokeInvite: (id: string, token: string) =>
    request<void>(`/boards/${seg(id)}/invites/${seg(token)}`, { method: 'DELETE' }),
  previewInvite: (token: string) => request<InvitePreview>(`/invites/${seg(token)}`),
  acceptInvite: (token: string) =>
    request<{ boardId: string; role: Role }>(`/invites/${seg(token)}/accept`, { method: 'POST' }),

  // ─── Files ─────────────────────────────────────────────────
  uploadFile: (boardId: string, file: { id: string; mimeType: string; dataURL: string }) =>
    request<{ id: string }>(`/boards/${seg(boardId)}/files`, { method: 'POST', body: file }),
  getFile: (boardId: string, fileId: string) => request<StoredFile>(`/boards/${seg(boardId)}/files/${seg(fileId)}`),

  // ─── Versions ──────────────────────────────────────────────
  listVersions: (boardId: string) => request<BoardVersionSummary[]>(`/boards/${seg(boardId)}/versions`),
  createVersion: (boardId: string, label?: string, thumbnail?: string) =>
    request<BoardVersionSummary>(`/boards/${seg(boardId)}/versions`, {
      method: 'POST',
      body: { label: label || undefined, thumbnail },
    }),
  getVersion: (boardId: string, versionId: string) =>
    request<BoardVersionDetail>(`/boards/${seg(boardId)}/versions/${seg(versionId)}`),
  restoreVersion: (boardId: string, versionId: string) =>
    request<{ changed: number }>(`/boards/${seg(boardId)}/versions/${seg(versionId)}/restore`, {
      method: 'POST',
    }),
};

/** Human-friendly message for anything thrown by the API client. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof ApiRequestError) return err.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** For tests only. */
export const __testing = { setSession, getAccessToken: () => accessToken };

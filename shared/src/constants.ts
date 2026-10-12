/** Limits enforced on both client and server. Keep them in one place so the UI never offers what the API rejects. */
export const LIMITS = {
  BOARD_NAME_MAX: 60,
  DISPLAY_NAME_MAX: 40,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  BOARD_PASSWORD_MAX: 64,
  CHAT_MESSAGE_MAX: 2000,
  CHAT_PAGE_SIZE: 50,
  COMMENT_MAX: 2000,
  COMMENT_REPLIES_MAX: 200,
  VERSION_LABEL_MAX: 80,
  /** Elements accepted in a single `scene:update` message. Clients chunk larger syncs. */
  ELEMENTS_PER_UPDATE: 500,
  /** Serialized size of a single element (freedraw strokes carry many points). */
  ELEMENT_BYTES_MAX: 256 * 1024,
  /** Hard cap on live elements per board, including soft-deleted ones. */
  BOARD_ELEMENTS_MAX: 50_000,
  /** Max size of one image/file (decoded bytes). */
  FILE_BYTES_MAX: 5 * 1024 * 1024,
  THUMBNAIL_BYTES_MAX: 300 * 1024,
  /** Socket.IO max payload — must exceed the largest chunk a client sends. */
  SOCKET_PAYLOAD_BYTES_MAX: 8 * 1024 * 1024,
} as const;

/** Board codes: 8 chars from an alphabet without look-alikes (0/O, 1/I/L). Legacy codes were 8 hex chars. */
export const BOARD_ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const BOARD_ID_LENGTH = 8;
export const BOARD_ID_PATTERN = /^[0-9A-Z]{6,12}$/;

export const PARTICIPANT_COLORS = [
  '#FF2D2D',
  '#22C55E',
  '#F59E0B',
  '#0EA5E9',
  '#E84393',
  '#14B8A6',
  '#F97316',
  '#8B5CF6',
  '#84CC16',
  '#EC4899',
  '#06B6D4',
  '#EAB308',
] as const;

/** Deterministic colour per user so someone keeps the same cursor colour across sessions. */
export function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % PARTICIPANT_COLORS.length;
  return PARTICIPANT_COLORS[index] ?? PARTICIPANT_COLORS[0];
}

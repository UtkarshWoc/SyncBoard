/** All import.meta.env access goes through here. */

function parseIceServers(raw: string | undefined): RTCIceServer[] {
  const fallback: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.length ? (parsed as RTCIceServer[]) : fallback;
  } catch {
    console.warn('VITE_ICE_SERVERS is not valid JSON; using public STUN only');
    return fallback;
  }
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export const env = {
  API_BASE_URL: ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api').replace(/\/$/, ''),
  /** Undefined means "same origin". */
  SOCKET_URL: (import.meta.env.VITE_SOCKET_URL as string | undefined) || undefined,
  APP_NAME: (import.meta.env.VITE_APP_NAME as string | undefined) || 'SyncBoard',
  GOOGLE_CLIENT_ID: googleClientId && googleClientId !== 'your-google-client-id-here' ? googleClientId : undefined,
  ICE_SERVERS: parseIceServers(import.meta.env.VITE_ICE_SERVERS as string | undefined),
  SENTRY_DSN: (import.meta.env.VITE_SENTRY_DSN as string | undefined) || undefined,
  IS_DEV: import.meta.env.DEV,
  /** Exposes the canvas API on window for end-to-end tests. Never set in production builds. */
  EXPOSE_TEST_HOOKS: import.meta.env.DEV || import.meta.env.VITE_E2E === 'true',
};

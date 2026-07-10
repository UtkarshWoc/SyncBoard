/**
 * Centralized environment configuration for the frontend.
 * All env vars are read here — no direct import.meta.env usage elsewhere.
 */
const env = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  SOCKET_URL: import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000',
  APP_NAME: import.meta.env.VITE_APP_NAME || 'SyncBoard',
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
};

export default env;

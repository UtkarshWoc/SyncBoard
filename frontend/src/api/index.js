import env from '../config/env';

const API_BASE = env.API_BASE_URL;

/**
 * Get auth header from localStorage token
 */
function authHeader() {
  const token = localStorage.getItem('syncboard_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Centralized API client for REST endpoints
 */
const api = {
  // ─── Auth ────────────────────────────────────────────
  async register(email, password, displayName) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
    return res.json();
  },

  async login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async googleAuth(token) {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return res.json();
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { ...authHeader() },
    });
    return res.json();
  },

  // ─── Rooms ───────────────────────────────────────────
  async getRooms() {
    const res = await fetch(`${API_BASE}/rooms`, {
      headers: { ...authHeader() },
    });
    return res.json();
  },

  async getRoom(roomId) {
    const res = await fetch(`${API_BASE}/rooms/${roomId}`, {
      headers: { ...authHeader() },
    });
    return res.json();
  },

  async createRoom(name, isPublic = true) {
    const res = await fetch(`${API_BASE}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ name, isPublic }),
    });
    return res.json();
  },

  async checkRoom(roomId) {
    const res = await fetch(`${API_BASE}/rooms/${roomId}/exists`, {
      headers: { ...authHeader() },
    });
    return res.json();
  },

  async healthCheck() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },
};

export default api;

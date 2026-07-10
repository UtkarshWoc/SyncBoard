import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'syncboard_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Auto-load user on mount if token exists
  useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await api.getMe();
        if (res.success) {
          setUser(res.data.user);
        } else {
          // Token expired or invalid
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
      } catch (err) {
        console.error('Failed to load user:', err);
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }
      setIsLoading(false);
    };
    loadUser();
  }, [token]);

  const saveAuth = useCallback((data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (email, password, displayName) => {
    const res = await api.register(email, password, displayName);
    if (res.success) {
      saveAuth(res.data);
    }
    return res;
  }, [saveAuth]);

  const login = useCallback(async (email, password) => {
    const res = await api.login(email, password);
    if (res.success) {
      saveAuth(res.data);
    }
    return res;
  }, [saveAuth]);

  const googleLogin = useCallback(async (googleToken) => {
    const res = await api.googleAuth(googleToken);
    if (res.success) {
      saveAuth(res.data);
    }
    return res;
  }, [saveAuth]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated, isLoading, register, login, googleLogin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

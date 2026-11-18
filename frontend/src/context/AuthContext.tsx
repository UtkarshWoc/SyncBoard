import type { AuthUser } from '@syncboard/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, onSessionChange, refreshSession } from '../lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Any sign-in, rotation or sign-out — including a failed refresh deep inside an API call —
    // flows through here, so the UI can never show a signed-in state with a dead session.
    const off = onSessionChange((payload) => setUser(payload?.user ?? null));
    // Restore the session from the httpOnly refresh cookie on page load.
    void refreshSession().finally(() => setIsLoading(false));
    return off;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await api.login(email, password);
  }, []);
  const register = useCallback(async (email: string, password: string, displayName: string) => {
    await api.register(email, password, displayName);
  }, []);
  const googleLogin = useCallback(async (credential: string) => {
    await api.google(credential);
  }, []);
  const logout = useCallback(async () => {
    await api.logout();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, isAuthenticated: !!user, login, register, googleLogin, logout, setUser }),
    [user, isLoading, login, register, googleLogin, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

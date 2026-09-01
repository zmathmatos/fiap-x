import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiClient } from '../../lib/api-client';
import { authStorage } from '../../lib/auth-storage';
import type { AuthUser } from '../../lib/types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  status: AuthStatus;
  login(input: { email: string; password: string }): Promise<void>;
  register(input: { name: string; email: string; password: string }): Promise<void>;
  logout(): void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [token, setToken] = useState<string | null>(() => authStorage.read());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() =>
    authStorage.read() ? 'loading' : 'anonymous',
  );

  const logout = useCallback(() => {
    authStorage.clear();
    setToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  // Restore the session on first load: a stored token proves nothing until the
  // API confirms it is still valid.
  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    apiClient
      .me({ token, onUnauthorized: logout })
      .then((restored) => {
        if (cancelled) return;
        setUser(restored);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled) logout();
      });

    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  const adopt = useCallback((result: { user: AuthUser; token: string }) => {
    authStorage.write(result.token);
    setToken(result.token);
    setUser(result.user);
    setStatus('authenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      status,
      login: async (input) => adopt(await apiClient.login(input)),
      register: async (input) => adopt(await apiClient.register(input)),
      logout,
    }),
    [user, token, status, adopt, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

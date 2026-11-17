import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/queries';
import type { User } from '../api/types';

interface AuthContextValue {
  /** Usuario autenticado, `null` si no hay sesión, `undefined` mientras se comprueba. */
  user: User | null | undefined;
  isLoading: boolean;
  error: unknown;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Sesión del usuario: se obtiene de GET /api/auth/me (cookie httpOnly).
 * Nunca se guarda ningún token en el navegador.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: api.me,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const user = await api.login(email, password);
      // Se descartan datos de una sesión anterior antes de entrar con la nueva.
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
      qc.setQueryData(queryKeys.me, user);
      return user;
    },
    [qc],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      clearSession(qc);
    }
  }, [qc]);

  const value = useMemo<AuthContextValue>(
    () => ({ user: me.data, isLoading: me.isPending, error: me.error, login, logout }),
    [me.data, me.isPending, me.error, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Limpia toda la caché y marca la sesión como cerrada. */
export function clearSession(qc: QueryClient) {
  void qc.cancelQueries();
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
  qc.setQueryData(queryKeys.me, null);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

/** Usuario autenticado (solo dentro de rutas protegidas). */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser requiere una sesión activa');
  return user;
}

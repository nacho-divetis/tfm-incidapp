import { ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { Role, User } from '../api/types';
import { ButtonLink } from '../components/Button';
import { LoadingBlock } from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/States';
import { useAuth } from './AuthContext';

/** Protege las rutas privadas: sin sesión, redirige a /login recordando el destino. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading, error } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-dvh">
        <LoadingBlock label="Comprobando la sesión…" />
      </div>
    );
  }
  if (error && user === undefined) {
    return (
      <div className="min-h-dvh">
        <ErrorState
          error={error}
          title="No se puede contactar con IncidApp"
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }
  if (!user) {
    const from = location.pathname + location.search;
    return <Navigate to="/login" replace state={from !== '/' ? { from } : undefined} />;
  }
  return <>{children}</>;
}

/** Restringe una sección a ciertos roles (la API también lo comprueba: 403). */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return (
      <EmptyState
        icon={<ShieldAlert className="size-6" />}
        title="Acceso restringido"
        description="Tu rol no tiene permiso para acceder a esta sección."
        action={
          <ButtonLink to="/" variant="secondary">
            Volver al panel
          </ButtonLink>
        }
      />
    );
  }
  return <>{children}</>;
}

/** Reglas de interfaz derivadas del rol (reflejo de la matriz de permisos, docs/specs/02-diseno.md §4). */
export const can = {
  createIncident: (u: User) => u.role !== 'DIRECCION',
  administer: (u: User) => u.role === 'ADMIN',
  manage: (u: User) => u.role === 'ADMIN' || u.role === 'RESPONSABLE',
};

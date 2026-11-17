import { ChevronDown, LogIn } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ApiError, errorMessage } from '../api/client';
import type { Role } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/AppLayout';
import { RoleBadge } from '../components/Badge';
import { Button } from '../components/Button';
import { Field, FormError, Input } from '../components/Field';
import { LoadingBlock } from '../components/Spinner';
import { useDocumentTitle } from '../lib/utils';

const DEMO_PASSWORD = 'Demo1234!';

/** Usuarios de la carga de datos demo (apps/api/src/infrastructure/db/seed.ts). */
const DEMO_USERS: { email: string; name: string; role: Role; scope: string }[] = [
  {
    email: 'admin@incidapp.demo',
    name: 'Ana Administradora',
    role: 'ADMIN',
    scope: 'Toda la empresa',
  },
  {
    email: 'direccion@incidapp.demo',
    name: 'Diego Director',
    role: 'DIRECCION',
    scope: 'Toda la empresa (lectura)',
  },
  {
    email: 'resp.logistica@incidapp.demo',
    name: 'Laura Logística',
    role: 'RESPONSABLE',
    scope: 'Logística',
  },
  {
    email: 'usuario.logistica@incidapp.demo',
    name: 'Luis Almacén',
    role: 'USUARIO',
    scope: 'Logística',
  },
  {
    email: 'resp.calidad@incidapp.demo',
    name: 'Carmen Calidad',
    role: 'RESPONSABLE',
    scope: 'Calidad y Compras',
  },
  {
    email: 'usuario.compras@incidapp.demo',
    name: 'Pablo Compras',
    role: 'USUARIO',
    scope: 'Compras',
  },
  {
    email: 'resp.atc@incidapp.demo',
    name: 'Marta Postventa',
    role: 'RESPONSABLE',
    scope: 'Atención al Cliente',
  },
  {
    email: 'usuario.atc@incidapp.demo',
    name: 'Alba Atención',
    role: 'USUARIO',
    scope: 'Atención al Cliente',
  },
  {
    email: 'resp.tecnico@incidapp.demo',
    name: 'Tomás Técnico',
    role: 'RESPONSABLE',
    scope: 'Departamento Técnico',
  },
  {
    email: 'usuario.tecnico@incidapp.demo',
    name: 'Teresa SAT',
    role: 'USUARIO',
    scope: 'Departamento Técnico',
  },
  {
    email: 'usuario.admin@incidapp.demo',
    name: 'Raúl Facturación',
    role: 'USUARIO',
    scope: 'Administración y Finanzas',
  },
  {
    email: 'resp.produccion@incidapp.demo',
    name: 'Pedro Producción',
    role: 'RESPONSABLE',
    scope: 'Producción',
  },
];

export function LoginPage() {
  useDocumentTitle('Iniciar sesión');
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);

  if (isLoading) return <LoadingBlock label="Comprobando la sesión…" />;
  if (user) return <Navigate to={from} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Introduce tu email y tu contraseña');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      // 401 → mensaje genérico de la API ("Email o contraseña incorrectos"); 429 → bloqueo temporal.
      setError(
        err instanceof ApiError && err.status === 400
          ? 'Email o contraseña incorrectos'
          : errorMessage(err, 'No se ha podido iniciar sesión'),
      );
      setSubmitting(false);
    }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
    submitRef.current?.focus();
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-blue-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="text-2xl" />
          <p className="mt-2 text-sm text-slate-600">
            Gestión de incidencias internas de la empresa
          </p>
        </div>

        <main className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold text-slate-900">Iniciar sesión</h1>
          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            <FormError message={error} />
            <Field label="Email">
              <Input
                type="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                placeholder="nombre@empresa.com"
              />
            </Field>
            <Field label="Contraseña">
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button
              ref={submitRef}
              type="submit"
              className="w-full"
              loading={submitting}
              icon={<LogIn className="size-4" aria-hidden="true" />}
            >
              Entrar
            </Button>
          </form>
        </main>

        <details className="group mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-5 py-4 text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
            Usuarios de demostración
            <ChevronDown
              className="size-4 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="border-t border-slate-200 px-5 pt-3 pb-5">
            <p className="text-xs text-slate-600">
              Todos usan la contraseña{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">{DEMO_PASSWORD}</code>.
              Haz clic en uno para rellenar el formulario.
            </p>
            <ul className="mt-3 divide-y divide-slate-100">
              {DEMO_USERS.map((u) => (
                <li key={u.email}>
                  <button
                    type="button"
                    onClick={() => fillDemo(u.email)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {u.name}
                      </span>
                      <span className="block truncate text-xs text-slate-600">
                        {u.email} · {u.scope}
                      </span>
                    </span>
                    <RoleBadge role={u.role} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </div>
  );
}

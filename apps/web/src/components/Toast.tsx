import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '../lib/utils';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION_MS: Record<ToastKind, number> = { success: 4000, info: 5000, error: 7000 };

/** Notificaciones breves tras una acción ("Incidencia creada", errores…). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), DURATION_MS[kind]);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg',
              t.kind === 'success' && 'border-emerald-200',
              t.kind === 'error' && 'border-red-200',
              t.kind === 'info' && 'border-blue-200',
            )}
          >
            {t.kind === 'success' && (
              <CheckCircle2
                className="mt-0.5 size-5 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
            )}
            {t.kind === 'error' && (
              <XCircle className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden="true" />
            )}
            {t.kind === 'info' && (
              <Info className="mt-0.5 size-5 shrink-0 text-blue-600" aria-hidden="true" />
            )}
            <p className="flex-1 text-slate-800">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="-m-1 rounded p-1 text-slate-400 hover:text-slate-700"
              aria-label="Cerrar notificación"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}

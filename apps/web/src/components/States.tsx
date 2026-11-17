import { AlertTriangle, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { errorMessage } from '../api/client';
import { Button } from './Button';

/** Estado vacío: no hay datos que mostrar. */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-500" aria-hidden="true">
        {icon ?? <Inbox className="size-6" />}
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Estado de error con opción de reintentar. */
export function ErrorState({
  error,
  title = 'No se han podido cargar los datos',
  onRetry,
}: {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-red-50 p-3 text-red-600" aria-hidden="true">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-600">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

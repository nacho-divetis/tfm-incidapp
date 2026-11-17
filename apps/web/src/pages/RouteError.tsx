import { AlertTriangle } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router';

/** Último recurso ante un error de renderizado inesperado. */
export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Error desconocido';

  return (
    <div
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center px-6 text-center"
    >
      <div className="mb-3 rounded-full bg-red-50 p-3 text-red-600" aria-hidden="true">
        <AlertTriangle className="size-6" />
      </div>
      <h1 className="text-lg font-semibold text-slate-900">Algo ha ido mal</h1>
      <p className="mt-1 max-w-md text-sm text-slate-600">
        Se ha producido un error inesperado en la aplicación. Recarga la página para continuar.
      </p>
      <p className="mt-2 max-w-md font-mono text-xs text-slate-500">{message}</p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          Recargar
        </button>
        <a
          href="/"
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
        >
          Ir al inicio
        </a>
      </div>
    </div>
  );
}

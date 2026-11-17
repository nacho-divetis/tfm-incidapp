import { cn } from '../lib/utils';

export function Spinner({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dims =
    size === 'sm' ? 'size-4 border-2' : size === 'lg' ? 'size-10 border-4' : 'size-6 border-2';
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block animate-spin rounded-full border-current border-r-transparent',
        dims,
        className,
      )}
    />
  );
}

/** Indicador de carga a pantalla/sección completa, anunciado a lectores de pantalla. */
export function LoadingBlock({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500"
    >
      <Spinner size="lg" className="text-blue-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

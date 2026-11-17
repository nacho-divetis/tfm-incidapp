import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '../lib/format';
import { Button } from './Button';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Nombre de los elementos en plural ("incidencias", "registros"). */
  itemLabel?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  itemLabel = 'resultados',
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row"
    >
      <p aria-live="polite">
        {total === 0 ? (
          `0 ${itemLabel}`
        ) : (
          <>
            Mostrando <strong className="font-semibold text-slate-900">{formatNumber(from)}</strong>
            –<strong className="font-semibold text-slate-900">{formatNumber(to)}</strong> de{' '}
            <strong className="font-semibold text-slate-900">{formatNumber(total)}</strong>{' '}
            {itemLabel}
          </>
        )}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          icon={<ChevronLeft className="size-4" aria-hidden="true" />}
        >
          Anterior
        </Button>
        <span className="px-1 tabular-nums">
          Página {page} de {pages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
        >
          Siguiente
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}

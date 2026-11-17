import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { api } from '../../api/endpoints';
import { queryKeys } from '../../api/queries';
import type { AuditItem } from '../../api/types';
import { Badge } from '../../components/Badge';
import { Card, PageHeader } from '../../components/Card';
import { Pagination } from '../../components/Pagination';
import { LoadingBlock } from '../../components/Spinner';
import { EmptyState, ErrorState } from '../../components/States';
import { formatDateTime } from '../../lib/format';
import { AUDIT_ACTION_LABEL, AUDIT_ENTITY_LABEL } from '../../lib/labels';
import { cn, useDocumentTitle } from '../../lib/utils';

const PAGE_SIZE = 25;

const ACTION_TONE: Record<string, string> = {
  LOGIN_FAILED: 'bg-red-50 text-red-800 ring-red-200',
  LOGIN: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  PASSWORD_CHANGED: 'bg-amber-50 text-amber-900 ring-amber-200',
  PASSWORD_RESET: 'bg-amber-50 text-amber-900 ring-amber-200',
  USER_CREATED: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  USER_UPDATED: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  ATTACHMENT_DELETED: 'bg-rose-50 text-rose-800 ring-rose-200',
};

/** JSON compacto de los detalles para la tabla. */
const compactJson = (details: Record<string, unknown> | undefined) =>
  details && Object.keys(details).length > 0 ? JSON.stringify(details) : '';

function EntityCell({ item }: { item: AuditItem }) {
  if (!item.entity) return <span className="text-slate-400">—</span>;
  const label = AUDIT_ENTITY_LABEL[item.entity] ?? item.entity;
  const code = typeof item.details?.code === 'string' ? item.details.code : null;
  // Las incidencias enlazan con su detalle (si ya no se puede ver, el detalle mostrará "no encontrada").
  if (item.entity === 'incident' && item.entityId) {
    return (
      <Link to={`/incidencias/${item.entityId}`} className="text-blue-700 hover:underline">
        {label}
        {code ? ` ${code}` : ''}
      </Link>
    );
  }
  return (
    <span title={item.entityId}>
      {label}
      {item.entityId && (
        <span className="block font-mono text-[11px] text-slate-400">
          {item.entityId.slice(0, 8)}…
        </span>
      )}
    </span>
  );
}

/** HU-11: registro de auditoría paginado (solo ADMIN). */
export function AuditPage() {
  useDocumentTitle('Auditoría');
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = Number(searchParams.get('page'));
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const audit = useQuery({
    queryKey: queryKeys.audit(page, PAGE_SIZE),
    queryFn: () => api.audit(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Auditoría"
        subtitle="Inicios de sesión, cambios de contraseña, gestión de usuarios y acciones sobre incidencias y adjuntos."
      />
      <Card>
        {audit.isPending ? (
          <LoadingBlock label="Cargando la auditoría…" />
        ) : audit.isError ? (
          <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />
        ) : audit.data.items.length === 0 ? (
          <EmptyState title="No hay registros de auditoría" />
        ) : (
          <>
            <div
              className={cn('overflow-x-auto', audit.isPlaceholderData && 'opacity-60')}
              aria-busy={audit.isFetching}
            >
              <table className="w-full min-w-[860px] text-left text-sm">
                <caption className="sr-only">Registro de auditoría</caption>
                <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-600 uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Fecha
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Usuario
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Acción
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Entidad
                    </th>
                    <th scope="col" className="px-4 py-3">
                      IP
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Detalles
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {audit.data.items.map((item) => {
                    const details = compactJson(item.details);
                    return (
                      <tr key={item.id} className="align-top">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                          {formatDateTime(item.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-slate-900">
                          {item.actorName ?? <span className="text-slate-400">Desconocido</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={
                              ACTION_TONE[item.action] ??
                              'bg-slate-100 text-slate-700 ring-slate-300'
                            }
                          >
                            {AUDIT_ACTION_LABEL[item.action] ?? item.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <EntityCell item={item} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-slate-600">
                          {item.ip ?? '—'}
                        </td>
                        <td className="max-w-md px-4 py-3">
                          {details ? (
                            <code
                              className="block font-mono text-xs break-all text-slate-600"
                              title={details}
                            >
                              {details}
                            </code>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={audit.data.page}
              pageSize={audit.data.pageSize}
              total={audit.data.total}
              itemLabel="registros"
              onPageChange={(p) => {
                setSearchParams(p > 1 ? { page: String(p) } : {});
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </>
        )}
      </Card>
    </>
  );
}

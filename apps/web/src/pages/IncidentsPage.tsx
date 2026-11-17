import { AlarmClock, FilePlus2, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useCatalog, useIncidentList } from '../api/queries';
import {
  PRIORITIES,
  STATUSES,
  type IncidentListItem,
  type IncidentListParams,
  type IncidentSort,
  type IncidentStatus,
  type Priority,
} from '../api/types';
import { useCurrentUser } from '../auth/AuthContext';
import { can } from '../auth/guards';
import { PriorityBadge, StatusBadge } from '../components/Badge';
import { Button, ButtonLink } from '../components/Button';
import { Card, PageHeader } from '../components/Card';
import { Checkbox, Input, Select } from '../components/Field';
import { Pagination } from '../components/Pagination';
import { LoadingBlock, Spinner } from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/States';
import { formatDate, formatDay, isOverdue } from '../lib/format';
import { PRIORITY_LABEL, SORT_LABEL, STATUS_LABEL } from '../lib/labels';
import { cn, useDocumentTitle } from '../lib/utils';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;
const SORTS = Object.keys(SORT_LABEL) as IncidentSort[];

const oneOf = <T extends string>(value: string | null, allowed: readonly T[]): T | undefined =>
  value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

/** Lee los filtros de la URL (fuente de verdad: se pueden compartir y sobreviven al recargar). */
function readParams(sp: URLSearchParams): IncidentListParams {
  const page = Number(sp.get('page'));
  return {
    q: sp.get('q') || undefined,
    status:
      sp.get('status') === 'OPEN' ? 'OPEN' : oneOf<IncidentStatus>(sp.get('status'), STATUSES),
    typeId: sp.get('typeId') || undefined,
    departmentId: sp.get('departmentId') || undefined,
    priority: oneOf<Priority>(sp.get('priority'), PRIORITIES),
    assignedToMe: sp.get('assignedToMe') === 'true' || undefined,
    mine: sp.get('mine') === 'true' || undefined,
    overdue: sp.get('overdue') === 'true' || undefined,
    sort: oneOf<IncidentSort>(sp.get('sort'), SORTS) ?? 'recent',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: PAGE_SIZE,
  };
}

function DueDate({ incident }: { incident: IncidentListItem }) {
  if (!incident.dueDate) return <span className="text-slate-400">—</span>;
  const overdue = isOverdue(incident.dueDate, incident.status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap',
        overdue &&
          'rounded-md bg-red-50 px-1.5 py-0.5 font-medium text-red-700 ring-1 ring-red-200',
      )}
    >
      {overdue && <AlarmClock className="size-3.5" aria-hidden="true" />}
      {formatDay(incident.dueDate)}
      {overdue && <span className="sr-only"> (vencida)</span>}
    </span>
  );
}

export function IncidentsPage() {
  useDocumentTitle('Incidencias');
  const user = useCurrentUser();
  const { data: catalog } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => readParams(searchParams), [searchParams]);
  const list = useIncidentList(params);

  // Búsqueda con debounce: el campo es local y se vuelca a la URL tras 350 ms sin teclear
  // (o al pulsar Intro).
  const [search, setSearch] = useState(params.q ?? '');
  const searchTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(searchTimer.current), []);
  // `setSearchParams` parte de los parámetros del render en que se creó: el temporizador debe
  // usar siempre la versión más reciente para no pisar filtros cambiados mientras tanto.
  const latestUpdate = useRef(updateParams);
  useEffect(() => {
    latestUpdate.current = updateParams;
  });
  const onSearchChange = (value: string) => {
    setSearch(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(
      () => latestUpdate.current({ q: value.trim() || null }),
      SEARCH_DEBOUNCE_MS,
    );
  };
  const submitSearch = () => {
    window.clearTimeout(searchTimer.current);
    updateParams({ q: search.trim() || null });
  };
  // Si la URL cambia desde fuera (atrás/adelante, limpiar filtros), se sincroniza el campo.
  useEffect(() => {
    setSearch((current) => (current.trim() === (params.q ?? '') ? current : (params.q ?? '')));
  }, [params.q]);

  /** Cambia filtros en la URL; cualquier cambio salvo el de página vuelve a la página 1. */
  function updateParams(changes: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === '') next.delete(key);
          else next.set(key, value);
        }
        if (!('page' in changes)) next.delete('page');
        return next;
      },
      { replace: !('page' in changes) },
    );
  }

  const activeFilters =
    !!params.q ||
    !!params.status ||
    !!params.typeId ||
    !!params.departmentId ||
    !!params.priority ||
    !!params.assignedToMe ||
    !!params.mine ||
    !!params.overdue;

  const clearFilters = () => {
    window.clearTimeout(searchTimer.current);
    setSearch('');
    setSearchParams(params.sort !== 'recent' ? { sort: params.sort ?? 'recent' } : {}, {
      replace: true,
    });
  };

  return (
    <>
      <PageHeader
        title="Incidencias"
        subtitle={
          user.role === 'ADMIN' || user.role === 'DIRECCION'
            ? 'Todas las incidencias de la empresa.'
            : 'Incidencias de tus departamentos.'
        }
        actions={
          can.createIncident(user) && (
            <ButtonLink
              to="/incidencias/nueva"
              icon={<FilePlus2 className="size-4" aria-hidden="true" />}
            >
              Nueva incidencia
            </ButtonLink>
          )
        }
      />

      <Card>
        {/* Filtros */}
        <form
          role="search"
          aria-label="Filtrar incidencias"
          className="space-y-3 border-b border-slate-200 p-4 sm:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
            <div className="relative sm:col-span-2 lg:col-span-4 2xl:col-span-2">
              <label htmlFor="f-q" className="sr-only">
                Buscar
              </label>
              <Search
                className="pointer-events-none absolute top-2.5 left-3 size-4 text-slate-400"
                aria-hidden="true"
              />
              <Input
                id="f-q"
                type="search"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar por código, título, tercero…"
                className="pl-9"
                maxLength={100}
              />
            </div>
            <FilterSelect
              id="f-status"
              label="Estado"
              value={params.status ?? ''}
              onChange={(v) => updateParams({ status: v })}
            >
              <option value="">Todos los estados</option>
              <option value="OPEN">Abiertas (sin resolver)</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              id="f-priority"
              label="Prioridad"
              value={params.priority ?? ''}
              onChange={(v) => updateParams({ priority: v })}
            >
              <option value="">Todas las prioridades</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              id="f-type"
              label="Tipo"
              value={params.typeId ?? ''}
              onChange={(v) => updateParams({ typeId: v })}
            >
              <option value="">Todos los tipos</option>
              {catalog?.types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              id="f-dept"
              label="Departamento"
              value={params.departmentId ?? ''}
              onChange={(v) => updateParams({ departmentId: v })}
            >
              <option value="">Todos los departamentos</option>
              {catalog?.departments
                .filter(
                  (d) =>
                    user.role === 'ADMIN' ||
                    user.role === 'DIRECCION' ||
                    user.departmentIds.includes(d.id),
                )
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </FilterSelect>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {user.role !== 'DIRECCION' && (
                <Checkbox
                  label="Asignadas a mí"
                  checked={!!params.assignedToMe}
                  onChange={(e) => updateParams({ assignedToMe: e.target.checked ? 'true' : null })}
                />
              )}
              {can.createIncident(user) && (
                <Checkbox
                  label="Creadas por mí"
                  checked={!!params.mine}
                  onChange={(e) => updateParams({ mine: e.target.checked ? 'true' : null })}
                />
              )}
              <Checkbox
                label="Solo vencidas"
                checked={!!params.overdue}
                onChange={(e) => updateParams({ overdue: e.target.checked ? 'true' : null })}
              />
              {activeFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  icon={<X className="size-4" aria-hidden="true" />}
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="f-sort" className="text-sm whitespace-nowrap text-slate-600">
                Ordenar por
              </label>
              <Select
                id="f-sort"
                value={params.sort}
                onChange={(e) =>
                  updateParams({ sort: e.target.value === 'recent' ? null : e.target.value })
                }
                className="w-auto"
              >
                {SORTS.map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABEL[s]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </form>

        {/* Resultados */}
        <div className="relative" aria-busy={list.isFetching}>
          {list.isFetching && !list.isPending && (
            <div className="absolute top-2 right-3 text-blue-600" role="status">
              <Spinner size="sm" />
              <span className="sr-only">Actualizando…</span>
            </div>
          )}
          {list.isPending ? (
            <LoadingBlock label="Cargando incidencias…" />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : list.data.items.length === 0 ? (
            <EmptyState
              title={
                activeFilters ? 'Ninguna incidencia coincide con los filtros' : 'No hay incidencias'
              }
              description={
                activeFilters
                  ? 'Prueba a cambiar o limpiar los filtros.'
                  : 'Aún no se ha registrado ninguna incidencia en tu ámbito.'
              }
              action={
                activeFilters ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    Limpiar filtros
                  </Button>
                ) : can.createIncident(user) ? (
                  <ButtonLink to="/incidencias/nueva">Crear la primera</ButtonLink>
                ) : undefined
              }
            />
          ) : (
            <>
              <IncidentTable items={list.data.items} />
              <IncidentCards items={list.data.items} />
              <Pagination
                page={list.data.page}
                pageSize={list.data.pageSize}
                total={list.data.total}
                itemLabel="incidencias"
                onPageChange={(p) => {
                  updateParams({ page: p > 1 ? String(p) : null });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </>
          )}
        </div>
      </Card>
    </>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string | null) => void;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value || null)}>
        {children}
      </Select>
    </div>
  );
}

/** Tabla para pantallas medianas y grandes. */
function IncidentTable({ items }: { items: IncidentListItem[] }) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Listado de incidencias</caption>
        <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-600 uppercase">
          <tr>
            <th scope="col" className="px-3 py-3 pl-5">
              Código y título
            </th>
            <th scope="col" className="px-3 py-3">
              Tipo y departamento
            </th>
            <th scope="col" className="px-3 py-3">
              Prioridad
            </th>
            <th scope="col" className="px-3 py-3">
              Estado
            </th>
            <th scope="col" className="px-3 py-3">
              Asignado
            </th>
            <th scope="col" className="px-3 py-3">
              Objetivo
            </th>
            <th scope="col" className="px-3 py-3 pr-5">
              Creada
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((i) => (
            <tr key={i.id} className="group hover:bg-slate-50">
              <td className="max-w-sm px-3 py-3 pl-5">
                <span className="block font-mono text-xs text-slate-500">{i.code}</span>
                <Link
                  to={`/incidencias/${i.id}`}
                  className="line-clamp-2 font-medium text-slate-900 group-hover:text-blue-800 hover:underline"
                >
                  {i.title}
                </Link>
                {i.thirdParty && (
                  <span className="block truncate text-xs text-slate-500">{i.thirdParty}</span>
                )}
              </td>
              <td className="px-3 py-3">
                <span className="block text-slate-800">{i.typeName}</span>
                <span className="block text-xs text-slate-500">{i.departmentName}</span>
              </td>
              <td className="px-3 py-3">
                <PriorityBadge priority={i.priority} />
              </td>
              <td className="px-3 py-3">
                <StatusBadge status={i.status} />
              </td>
              <td className="px-3 py-3 text-slate-700">
                {i.assigneeName ?? <span className="text-slate-400">Sin asignar</span>}
              </td>
              <td className="px-3 py-3">
                <DueDate incident={i} />
              </td>
              <td className="px-3 py-3 pr-5 whitespace-nowrap text-slate-600">
                {formatDate(i.createdAt)}
                <span className="block text-xs text-slate-500">{i.createdByName}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tarjetas para móvil. */
function IncidentCards({ items }: { items: IncidentListItem[] }) {
  return (
    <ul className="divide-y divide-slate-100 lg:hidden">
      {items.map((i) => (
        <li key={i.id}>
          <Link to={`/incidencias/${i.id}`} className="block space-y-2 px-4 py-4 hover:bg-slate-50">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-slate-500">{i.code}</span>
              <span className="text-xs text-slate-500">{formatDate(i.createdAt)}</span>
            </div>
            <p className="font-medium text-slate-900">{i.title}</p>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={i.status} />
              <PriorityBadge priority={i.priority} />
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-slate-500">Tipo</dt>
              <dd className="text-slate-800">{i.typeName}</dd>
              <dt className="text-slate-500">Departamento</dt>
              <dd className="text-slate-800">{i.departmentName}</dd>
              <dt className="text-slate-500">Asignado</dt>
              <dd className="text-slate-800">{i.assigneeName ?? 'Sin asignar'}</dd>
              <dt className="text-slate-500">Fecha objetivo</dt>
              <dd>
                <DueDate incident={i} />
              </dd>
            </dl>
          </Link>
        </li>
      ))}
    </ul>
  );
}

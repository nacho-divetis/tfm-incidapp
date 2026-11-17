import { useQuery } from '@tanstack/react-query';
import { AlarmClock, CheckCircle2, CircleDot, FilePlus2, Flame, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { api } from '../api/endpoints';
import { queryKeys, useIncidentList } from '../api/queries';
import { PRIORITIES, STATUSES, type IncidentStatus, type Priority } from '../api/types';
import { useCurrentUser } from '../auth/AuthContext';
import { can } from '../auth/guards';
import { PriorityBadge, StatusBadge } from '../components/Badge';
import { ButtonLink } from '../components/Button';
import { Card, CardHeader, PageHeader } from '../components/Card';
import { LoadingBlock } from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/States';
import { formatDuration, formatNumber, formatRelative } from '../lib/format';
import { PRIORITY_COLOR, PRIORITY_LABEL, STATUS_COLOR, STATUS_LABEL } from '../lib/labels';
import { cn, useDocumentTitle } from '../lib/utils';

function StatCard({
  label,
  value,
  icon,
  tone,
  to,
  hint,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone: string;
  to?: string;
  hint?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span
          className={cn('grid size-8 shrink-0 place-items-center rounded-lg', tone)}
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </>
  );
  const cls = 'block rounded-xl border border-slate-200 bg-white p-4 shadow-sm';
  return to ? (
    <Link
      to={to}
      className={cn(cls, 'transition-colors hover:border-blue-300 hover:bg-blue-50/40')}
    >
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}

interface BarRow {
  key: string;
  label: string;
  count: number;
  color: string;
  to?: string;
}

/** Barras horizontales en CSS (sin librerías de gráficos). */
function BarChart({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: BarRow[];
  emptyText: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((acc, r) => acc + r.count, 0);
  return (
    <Card>
      <CardHeader
        title={title}
        actions={<span className="text-xs text-slate-500">Total: {formatNumber(total)}</span>}
      />
      {total === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="space-y-3 px-4 py-4 sm:px-5">
          {rows.map((r) => {
            const pct = total ? Math.round((r.count / total) * 100) : 0;
            const label = r.to ? (
              <Link
                to={r.to}
                className="truncate text-slate-700 hover:text-blue-800 hover:underline"
              >
                {r.label}
              </Link>
            ) : (
              <span className="truncate text-slate-700">{r.label}</span>
            );
            return (
              <li key={r.key}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  {label}
                  <span className="shrink-0 font-medium text-slate-900 tabular-nums">
                    {formatNumber(r.count)}{' '}
                    <span className="font-normal text-slate-500">({pct}%)</span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <div
                    className={cn('h-full rounded-full', r.color)}
                    style={{ width: `${Math.max(r.count > 0 ? 2 : 0, (r.count / max) * 100)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function DashboardPage() {
  useDocumentTitle('Panel');
  const user = useCurrentUser();
  const stats = useQuery({ queryKey: queryKeys.dashboard, queryFn: api.dashboard });
  const recent = useIncidentList({ pageSize: 5, sort: 'recent' });

  const scopeText =
    user.role === 'ADMIN' || user.role === 'DIRECCION'
      ? 'Resumen de las incidencias de toda la empresa.'
      : 'Resumen de las incidencias de tus departamentos.';

  return (
    <>
      <PageHeader
        title={`Hola, ${user.name.split(' ')[0]}`}
        subtitle={scopeText}
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

      {stats.isPending ? (
        <LoadingBlock label="Cargando el cuadro de mando…" />
      ) : stats.isError ? (
        <Card>
          <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
        </Card>
      ) : (
        <>
          <h2 className="sr-only">Indicadores</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Abiertas"
              value={formatNumber(stats.data.totals.open)}
              icon={<CircleDot className="size-5" />}
              tone="bg-blue-50 text-blue-700"
              to="/incidencias?status=OPEN"
              hint={`de ${formatNumber(stats.data.totals.total)} en total`}
            />
            <StatCard
              label="Vencidas"
              value={formatNumber(stats.data.totals.overdue)}
              icon={<AlarmClock className="size-5" />}
              tone="bg-amber-50 text-amber-700"
              to="/incidencias?overdue=true&sort=due"
              hint="abiertas con fecha objetivo pasada"
            />
            <StatCard
              label="Críticas abiertas"
              value={formatNumber(stats.data.totals.criticalOpen)}
              icon={<Flame className="size-5" />}
              tone="bg-red-50 text-red-700"
              to="/incidencias?status=OPEN&priority=CRITICA"
            />
            <StatCard
              label="Resueltas (30 días)"
              value={formatNumber(stats.data.totals.resolvedLast30)}
              icon={<CheckCircle2 className="size-5" />}
              tone="bg-emerald-50 text-emerald-700"
            />
            <StatCard
              label="Tiempo medio de resolución"
              value={formatDuration(stats.data.avgResolutionHours)}
              icon={<Timer className="size-5" />}
              tone="bg-violet-50 text-violet-700"
              hint={
                stats.data.avgResolutionHours === null
                  ? 'aún no hay incidencias resueltas'
                  : undefined
              }
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BarChart
              title="Por estado"
              emptyText="No hay incidencias."
              rows={STATUSES.map((s: IncidentStatus) => ({
                key: s,
                label: STATUS_LABEL[s],
                count: stats.data.byStatus.find((r) => r.key === s)?.count ?? 0,
                color: STATUS_COLOR[s],
                to: `/incidencias?status=${s}`,
              }))}
            />
            <BarChart
              title="Abiertas por prioridad"
              emptyText="No hay incidencias abiertas."
              rows={[...PRIORITIES].reverse().map((p: Priority) => ({
                key: p,
                label: PRIORITY_LABEL[p],
                count: stats.data.byPriority.find((r) => r.key === p)?.count ?? 0,
                color: PRIORITY_COLOR[p],
                to: `/incidencias?status=OPEN&priority=${p}`,
              }))}
            />
            <BarChart
              title="Por tipo"
              emptyText="No hay incidencias."
              rows={stats.data.byType.map((r) => ({
                key: r.key,
                label: r.label,
                count: r.count,
                color: 'bg-blue-600',
              }))}
            />
            <BarChart
              title="Por departamento"
              emptyText="No hay incidencias."
              rows={stats.data.byDepartment.map((r) => ({
                key: r.key,
                label: r.label,
                count: r.count,
                color: 'bg-teal-600',
              }))}
            />
          </div>
        </>
      )}

      <Card className="mt-6">
        <CardHeader
          title="Últimas incidencias"
          actions={
            <Link to="/incidencias" className="text-sm font-medium text-blue-700 hover:underline">
              Ver todas
            </Link>
          }
        />
        {recent.isPending ? (
          <LoadingBlock />
        ) : recent.isError ? (
          <ErrorState error={recent.error} onRetry={() => void recent.refetch()} />
        ) : recent.data.items.length === 0 ? (
          <EmptyState
            title="Todavía no hay incidencias"
            description="Cuando se registre alguna aparecerá aquí."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.data.items.map((i) => (
              <li key={i.id}>
                <Link
                  to={`/incidencias/${i.id}`}
                  className="flex flex-col gap-2 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs text-slate-500">{i.code}</span>
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {i.title}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {i.departmentName} · {formatRelative(i.createdAt)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-wrap gap-2">
                    <PriorityBadge priority={i.priority} />
                    <StatusBadge status={i.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

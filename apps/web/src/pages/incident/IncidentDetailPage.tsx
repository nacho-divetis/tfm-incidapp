import { AlarmClock, ArrowLeft, Pencil } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { isApiError } from '../../api/client';
import { useIncidentDetail } from '../../api/queries';
import type { IncidentDetail } from '../../api/types';
import { PriorityBadge, StatusBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card, CardHeader } from '../../components/Card';
import { LoadingBlock } from '../../components/Spinner';
import { ErrorState } from '../../components/States';
import { formatDateTime, formatDay, formatRelative, isOverdue } from '../../lib/format';
import { useDocumentTitle } from '../../lib/utils';
import { NotFoundPage } from '../NotFoundPage';
import { AssignControl } from './AssignControl';
import { AttachmentsPanel } from './AttachmentsPanel';
import { CommentForm } from './CommentForm';
import { EditIncidentModal } from './EditIncidentModal';
import { StatusActions } from './StatusActions';
import { Timeline } from './Timeline';

export function IncidentDetailPage() {
  const { id = '' } = useParams();
  const detail = useIncidentDetail(id);
  useDocumentTitle(
    detail.data ? `${detail.data.incident.code} · ${detail.data.incident.title}` : 'Incidencia',
  );

  if (detail.isPending) return <LoadingBlock label="Cargando la incidencia…" />;
  if (detail.isError) {
    if (isApiError(detail.error) && detail.error.status === 404) {
      return (
        <NotFoundPage
          title="Incidencia no encontrada"
          description="No existe o no pertenece a ninguno de tus departamentos."
        />
      );
    }
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  }
  return <IncidentView data={detail.data} />;
}

function DataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-2 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-slate-900">{children}</dd>
    </div>
  );
}

function IncidentView({ data }: { data: IncidentDetail }) {
  const { incident, permissions, events, attachments } = data;
  const [editing, setEditing] = useState(false);
  const overdue = isOverdue(incident.dueDate, incident.status);

  return (
    <>
      <Link
        to="/incidencias"
        className="mb-4 inline-flex items-center gap-1 rounded text-sm font-medium text-slate-600 hover:text-blue-800"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a incidencias
      </Link>

      {/* Cabecera */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-sm text-slate-500">{incident.code}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight break-words text-slate-900">
            {incident.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={incident.status} />
            <PriorityBadge priority={incident.priority} />
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200 ring-inset">
                <AlarmClock className="size-3.5" aria-hidden="true" />
                Vencida
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {permissions.canEdit && (
            <Button
              variant="secondary"
              onClick={() => setEditing(true)}
              icon={<Pencil className="size-4" aria-hidden="true" />}
            >
              Editar
            </Button>
          )}
          <StatusActions incident={incident} allowed={permissions.allowedTransitions} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Descripción" />
            <p className="px-4 py-4 text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-800 sm:px-5">
              {incident.description}
            </p>
          </Card>

          <Card>
            <CardHeader title={`Actividad (${events.length})`} />
            <div className="px-4 py-4 sm:px-5">
              <Timeline events={events} />
            </div>
            {permissions.canComment && (
              <div className="border-t border-slate-200 px-4 py-4 sm:px-5">
                <CommentForm incidentId={incident.id} />
              </div>
            )}
          </Card>
        </div>

        {/* Columna lateral */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Datos" />
            <dl className="divide-y divide-slate-100 px-4 py-1 sm:px-5">
              <DataRow label="Tipo">{incident.typeName}</DataRow>
              <DataRow label="Departamento">{incident.departmentName}</DataRow>
              <DataRow label="Tercero implicado">
                {incident.thirdParty ?? <span className="text-slate-400">—</span>}
              </DataRow>
              <DataRow label="Fecha objetivo">
                {incident.dueDate ? (
                  <span className={overdue ? 'font-medium text-red-700' : undefined}>
                    {formatDay(incident.dueDate)}
                    {overdue && ' (vencida)'}
                  </span>
                ) : (
                  <span className="text-slate-400">Sin fecha</span>
                )}
              </DataRow>
              <DataRow label="Creada por">
                {incident.createdByName}
                <span
                  className="block text-xs text-slate-500"
                  title={formatDateTime(incident.createdAt)}
                >
                  {formatDateTime(incident.createdAt)}
                </span>
              </DataRow>
              <DataRow label="Actualizada">
                <span title={formatDateTime(incident.updatedAt)}>
                  {formatRelative(incident.updatedAt)}
                </span>
              </DataRow>
              {incident.resolvedAt && (
                <DataRow label="Resuelta">{formatDateTime(incident.resolvedAt)}</DataRow>
              )}
              {incident.closedAt && (
                <DataRow label="Cerrada">{formatDateTime(incident.closedAt)}</DataRow>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Asignación" />
            <div className="px-4 py-4 sm:px-5">
              <AssignControl incident={incident} canAssign={permissions.canAssign} />
            </div>
          </Card>

          <AttachmentsPanel
            incident={incident}
            attachments={attachments}
            canAttach={permissions.canAttach}
          />
        </div>
      </div>

      <EditIncidentModal
        open={editing}
        onClose={() => setEditing(false)}
        incident={incident}
        canMove={permissions.canMove}
      />
    </>
  );
}

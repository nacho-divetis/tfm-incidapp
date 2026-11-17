import {
  ArrowRightLeft,
  FilePlus2,
  MessageSquare,
  Paperclip,
  PencilLine,
  Trash2,
  UserRoundCheck,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCatalog } from '../../api/queries';
import {
  PRIORITIES,
  type Catalog,
  type FieldChange,
  type IncidentEvent,
  type Priority,
} from '../../api/types';
import { StatusBadge } from '../../components/Badge';
import { formatDateTime, formatDay, formatRelative } from '../../lib/format';
import { INCIDENT_FIELD_LABEL, PRIORITY_LABEL } from '../../lib/labels';
import { cn } from '../../lib/utils';

/** Valor de un campo editado, traducido a texto legible. */
function displayValue(field: string, value: unknown, catalog: Catalog | undefined): string {
  if (value === null || value === undefined || value === '') return 'vacío';
  const s = String(value);
  switch (field) {
    case 'priority':
      return (PRIORITIES as readonly string[]).includes(s) ? PRIORITY_LABEL[s as Priority] : s;
    case 'typeId':
      return catalog?.types.find((t) => t.id === s)?.name ?? 'tipo desconocido';
    case 'departmentId':
      return catalog?.departments.find((d) => d.id === s)?.name ?? 'departamento desconocido';
    case 'dueDate':
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? formatDay(s) : s;
    default:
      return s;
  }
}

function ChangeLine({
  field,
  change,
  catalog,
}: {
  field: string;
  change: FieldChange;
  catalog: Catalog | undefined;
}) {
  const label = INCIDENT_FIELD_LABEL[field] ?? field;
  if (field === 'description') return <li>Ha actualizado la descripción.</li>;
  if (field === 'assigneeId') {
    return <li>Se ha retirado la asignación al trasladar la incidencia.</li>;
  }
  return (
    <li>
      <span className="font-medium">{label}</span>:{' '}
      <span className="text-slate-500 line-through">
        {displayValue(field, change.from, catalog)}
      </span>{' '}
      → <span className="font-medium">{displayValue(field, change.to, catalog)}</span>
    </li>
  );
}

interface Rendered {
  icon: ReactNode;
  tone: string;
  title: ReactNode;
  body?: ReactNode;
}

function renderEvent(e: IncidentEvent, catalog: Catalog | undefined): Rendered {
  const iconCls = 'size-4';
  switch (e.type) {
    case 'CREATED':
      return {
        icon: <FilePlus2 className={iconCls} />,
        tone: 'bg-blue-100 text-blue-700',
        title: 'ha creado la incidencia',
      };
    case 'UPDATED': {
      const entries = Object.entries(e.data.changes ?? {});
      return {
        icon: <PencilLine className={iconCls} />,
        tone: 'bg-slate-100 text-slate-700',
        title: 'ha editado la incidencia',
        body: entries.length > 0 && (
          <ul className="space-y-0.5 text-sm text-slate-700">
            {entries.map(([field, change]) => (
              <ChangeLine key={field} field={field} change={change} catalog={catalog} />
            ))}
          </ul>
        ),
      };
    }
    case 'STATUS_CHANGED':
      return {
        icon: <ArrowRightLeft className={iconCls} />,
        tone: e.data.reopen ? 'bg-amber-100 text-amber-800' : 'bg-violet-100 text-violet-700',
        title: (
          <>
            {e.data.reopen ? 'ha reabierto la incidencia' : 'ha cambiado el estado'}{' '}
            <span className="inline-flex flex-wrap items-center gap-1 align-middle">
              <StatusBadge status={e.data.from} />
              <span aria-hidden="true">→</span>
              <span className="sr-only">a</span>
              <StatusBadge status={e.data.to} />
            </span>
          </>
        ),
        body: e.data.comment && <Quote>{e.data.comment}</Quote>,
      };
    case 'ASSIGNED':
      return {
        icon: <UserRoundCheck className={iconCls} />,
        tone: 'bg-teal-100 text-teal-700',
        title: e.data.toName ? (
          <>
            ha asignado la incidencia a <strong className="font-semibold">{e.data.toName}</strong>
            {e.data.fromName && <> (antes: {e.data.fromName})</>}
          </>
        ) : (
          <>
            ha quitado la asignación
            {e.data.fromName && (
              <>
                {' '}
                a <strong className="font-semibold">{e.data.fromName}</strong>
              </>
            )}
          </>
        ),
      };
    case 'COMMENT':
      return {
        icon: <MessageSquare className={iconCls} />,
        tone: 'bg-sky-100 text-sky-700',
        title: 'ha comentado',
        body: <Quote>{e.data.text}</Quote>,
      };
    case 'ATTACHMENT_ADDED':
      return {
        icon: <Paperclip className={iconCls} />,
        tone: 'bg-emerald-100 text-emerald-700',
        title: (
          <>
            ha adjuntado <strong className="font-semibold break-all">{e.data.filename}</strong>
          </>
        ),
      };
    case 'ATTACHMENT_REMOVED':
      return {
        icon: <Trash2 className={iconCls} />,
        tone: 'bg-rose-100 text-rose-700',
        title: (
          <>
            ha eliminado el adjunto{' '}
            <strong className="font-semibold break-all">{e.data.filename}</strong>
          </>
        ),
      };
    default:
      return {
        icon: <PencilLine className={iconCls} />,
        tone: 'bg-slate-100 text-slate-700',
        title: 'actividad',
      };
  }
}

function Quote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm break-words whitespace-pre-wrap text-slate-800">
      {children}
    </blockquote>
  );
}

/** Línea de tiempo de la incidencia en orden cronológico (HU-04 CA4). */
export function Timeline({ events }: { events: IncidentEvent[] }) {
  const { data: catalog } = useCatalog();
  if (events.length === 0) return <p className="text-sm text-slate-500">Sin actividad.</p>;

  return (
    <ol className="relative space-y-5">
      {events.map((e, idx) => {
        const r = renderEvent(e, catalog);
        const last = idx === events.length - 1;
        return (
          <li key={e.id} className="relative flex gap-3">
            {!last && (
              <span
                className="absolute top-8 bottom-[-1.25rem] left-4 w-px bg-slate-200"
                aria-hidden="true"
              />
            )}
            <span
              className={cn('z-10 grid size-8 shrink-0 place-items-center rounded-full', r.tone)}
              aria-hidden="true"
            >
              {r.icon}
            </span>
            <div className="min-w-0 flex-1 space-y-1.5 pt-1">
              <p className="text-sm text-slate-800">
                <strong className="font-semibold text-slate-900">{e.actorName}</strong> {r.title}
              </p>
              <p className="text-xs text-slate-500">
                <time dateTime={e.createdAt} title={formatDateTime(e.createdAt)}>
                  {formatRelative(e.createdAt)} · {formatDateTime(e.createdAt)}
                </time>
              </p>
              {r.body}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

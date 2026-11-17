import type { ReactNode } from 'react';
import type { IncidentStatus, Priority, Role } from '../api/types';
import {
  PRIORITY_BADGE,
  PRIORITY_LABEL,
  ROLE_BADGE,
  ROLE_LABEL,
  STATUS_BADGE,
  STATUS_COLOR,
  STATUS_LABEL,
} from '../lib/labels';
import { cn } from '../lib/utils';

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        className ?? 'bg-slate-100 text-slate-700 ring-slate-300',
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <Badge className={STATUS_BADGE[status]}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', STATUS_COLOR[status])} />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge className={PRIORITY_BADGE[priority]}>
      <span className="sr-only">Prioridad </span>
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return <Badge className={ROLE_BADGE[role]}>{ROLE_LABEL[role]}</Badge>;
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { errorMessage } from '../../api/client';
import { api } from '../../api/endpoints';
import { invalidateIncidents } from '../../api/queries';
import type { IncidentListItem, IncidentStatus } from '../../api/types';
import { StatusBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Field, FormError, Textarea } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import {
  isReopen,
  STATUS_LABEL,
  transitionLabel,
  transitionRequiresComment,
} from '../../lib/labels';
import { LIMITS } from '../../lib/validation';

const ICON_CLS = 'size-4';

function transitionIcon(from: IncidentStatus, to: IncidentStatus): ReactNode {
  if (isReopen(from, to)) return <RotateCcw className={ICON_CLS} aria-hidden="true" />;
  switch (to) {
    case 'EN_CURSO':
      return <PlayCircle className={ICON_CLS} aria-hidden="true" />;
    case 'PENDIENTE_TERCERO':
      return <PauseCircle className={ICON_CLS} aria-hidden="true" />;
    case 'RESUELTA':
      return <CheckCircle2 className={ICON_CLS} aria-hidden="true" />;
    case 'CERRADA':
      return <Lock className={ICON_CLS} aria-hidden="true" />;
    case 'RECHAZADA':
      return <XCircle className={ICON_CLS} aria-hidden="true" />;
    default:
      return <ArrowRight className={ICON_CLS} aria-hidden="true" />;
  }
}

/** Botones de cambio de estado: uno por cada transición que la API permite a este usuario. */
export function StatusActions({
  incident,
  allowed,
}: {
  incident: IncidentListItem;
  allowed: IncidentStatus[];
}) {
  const [target, setTarget] = useState<IncidentStatus | null>(null);
  if (allowed.length === 0) return null;

  return (
    <>
      {allowed.map((to) => (
        <Button
          key={to}
          variant={to === 'RECHAZADA' ? 'secondary' : 'primary'}
          className={to === 'RECHAZADA' ? 'text-red-700' : undefined}
          onClick={() => setTarget(to)}
          icon={transitionIcon(incident.status, to)}
        >
          {transitionLabel(incident.status, to)}
        </Button>
      ))}
      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target ? `${transitionLabel(incident.status, target)}: ${incident.code}` : ''}
      >
        {target && <StatusForm incident={incident} to={target} onDone={() => setTarget(null)} />}
      </Modal>
    </>
  );
}

function StatusForm({
  incident,
  to,
  onDone,
}: {
  incident: IncidentListItem;
  to: IncidentStatus;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const required = transitionRequiresComment(incident.status, to);
  const reopen = isReopen(incident.status, to);

  const mutation = useMutation({
    mutationFn: () => api.changeStatus(incident.id, to, comment),
    onSuccess: async () => {
      await invalidateIncidents(qc);
      toast.success(reopen ? 'Incidencia reabierta' : `Estado cambiado a «${STATUS_LABEL[to]}»`);
      onDone();
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (required && !comment.trim()) {
      setError('Este cambio de estado requiere un comentario');
      return;
    }
    setError(null);
    mutation.mutate();
  };

  const placeholder =
    to === 'RESUELTA'
      ? 'Explica cómo se ha resuelto la incidencia.'
      : to === 'RECHAZADA'
        ? 'Indica el motivo del rechazo.'
        : reopen
          ? 'Indica por qué se reabre la incidencia.'
          : 'Añade contexto si lo necesitas (opcional).';

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
        <StatusBadge status={incident.status} />
        <ArrowRight className="size-4 text-slate-400" aria-hidden="true" />
        <span className="sr-only">pasa a</span>
        <StatusBadge status={to} />
      </div>
      <FormError message={mutation.isError ? errorMessage(mutation.error) : null} />
      <Field
        label={required ? 'Comentario' : 'Comentario (opcional)'}
        required={required}
        error={error}
        hint={required ? 'Obligatorio para este cambio de estado.' : undefined}
      >
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={LIMITS.commentMax}
          rows={4}
          placeholder={placeholder}
          autoFocus
          disabled={mutation.isPending}
        />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onDone} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variant={to === 'RECHAZADA' ? 'danger' : 'primary'}
          loading={mutation.isPending}
        >
          {transitionLabel(incident.status, to)}
        </Button>
      </div>
    </form>
  );
}

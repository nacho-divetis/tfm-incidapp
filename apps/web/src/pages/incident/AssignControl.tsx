import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../../api/client';
import { api } from '../../api/endpoints';
import { invalidateIncidents, queryKeys } from '../../api/queries';
import type { IncidentListItem } from '../../api/types';
import { Button } from '../../components/Button';
import { Field, Select } from '../../components/Field';
import { useToast } from '../../components/Toast';
import { ROLE_LABEL } from '../../lib/labels';

const UNASSIGNED = '';

/** Muestra el asignado y, si el usuario puede, permite cambiarlo (HU-06). */
export function AssignControl({
  incident,
  canAssign,
}: {
  incident: IncidentListItem;
  canAssign: boolean;
}) {
  const current = (
    <p className="flex items-center gap-2 text-sm">
      <UserRound className="size-4 text-slate-400" aria-hidden="true" />
      {incident.assigneeName ? (
        <span className="font-medium text-slate-900">{incident.assigneeName}</span>
      ) : (
        <span className="text-slate-500">Sin asignar</span>
      )}
    </p>
  );
  if (!canAssign) return current;
  return (
    <AssignForm
      // Se reinicia el formulario si cambia la incidencia, su departamento o su asignado.
      key={`${incident.id}-${incident.departmentId}-${incident.assigneeId ?? ''}`}
      incident={incident}
    />
  );
}

function AssignForm({ incident }: { incident: IncidentListItem }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = useState(incident.assigneeId ?? UNASSIGNED);

  const users = useQuery({
    queryKey: queryKeys.assignable(incident.departmentId),
    queryFn: () => api.assignableUsers(incident.departmentId),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (assigneeId: string | null) => api.assign(incident.id, assigneeId),
    onSuccess: async (_data, assigneeId) => {
      await invalidateIncidents(qc);
      const name = users.data?.find((u) => u.id === assigneeId)?.name;
      toast.success(
        assigneeId
          ? `Incidencia asignada a ${name ?? 'el usuario seleccionado'}`
          : 'Incidencia sin asignar',
      );
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const options = users.data ?? [];
  // El asignado actual puede no estar en la lista (p. ej. desactivado): se muestra igualmente.
  const missingCurrent =
    incident.assigneeId && !options.some((u) => u.id === incident.assigneeId)
      ? { id: incident.assigneeId, name: incident.assigneeName ?? 'Usuario actual' }
      : null;
  const changed = selected !== (incident.assigneeId ?? UNASSIGNED);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (changed) mutation.mutate(selected || null);
      }}
    >
      <Field
        label="Asignado a"
        error={users.isError ? errorMessage(users.error) : null}
        hint={`Usuarios activos de ${incident.departmentName}`}
      >
        <Select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={users.isPending || mutation.isPending}
        >
          <option value={UNASSIGNED}>Sin asignar</option>
          {missingCurrent && <option value={missingCurrent.id}>{missingCurrent.name}</option>}
          {options.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({ROLE_LABEL[u.role]})
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!changed} loading={mutation.isPending}>
          Guardar asignación
        </Button>
        {changed && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(incident.assigneeId ?? UNASSIGNED)}
          >
            Deshacer
          </Button>
        )}
      </div>
    </form>
  );
}

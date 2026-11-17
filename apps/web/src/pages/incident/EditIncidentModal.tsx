import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { errorMessage } from '../../api/client';
import { api } from '../../api/endpoints';
import { invalidateIncidents, useCatalog } from '../../api/queries';
import type { Catalog, IncidentListItem, Priority, UpdateIncidentInput } from '../../api/types';
import { useCurrentUser } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { FormError } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { LoadingBlock } from '../../components/Spinner';
import { ErrorState } from '../../components/States';
import { useToast } from '../../components/Toast';
import {
  hasErrors,
  validateIncident,
  type FormErrors,
  type IncidentFormValues,
} from '../../lib/validation';
import { IncidentFields } from './IncidentFields';

interface EditIncidentModalProps {
  open: boolean;
  onClose: () => void;
  incident: IncidentListItem;
  /** Si es false, no se muestra el campo departamento (traslado reservado a gestores). */
  canMove: boolean;
}

/** HU-07: edición de una incidencia en un diálogo. */
export function EditIncidentModal({ open, onClose, incident, canMove }: EditIncidentModalProps) {
  const catalog = useCatalog();
  return (
    <Modal open={open} onClose={onClose} title={`Editar ${incident.code}`} size="lg">
      {catalog.isPending ? (
        <LoadingBlock />
      ) : catalog.isError ? (
        <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />
      ) : (
        <EditForm incident={incident} canMove={canMove} catalog={catalog.data} onClose={onClose} />
      )}
    </Modal>
  );
}

const toValues = (i: IncidentListItem): IncidentFormValues => ({
  title: i.title,
  description: i.description,
  typeId: i.typeId,
  priority: i.priority,
  departmentId: i.departmentId,
  thirdParty: i.thirdParty ?? '',
  dueDate: i.dueDate ?? '',
});

function EditForm({
  incident,
  canMove,
  catalog,
  onClose,
}: {
  incident: IncidentListItem;
  canMove: boolean;
  catalog: Catalog;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [values, setValues] = useState<IncidentFormValues>(() => toValues(incident));
  const [errors, setErrors] = useState<FormErrors<IncidentFormValues>>({});

  const mutation = useMutation({
    mutationFn: (input: UpdateIncidentInput) => api.updateIncident(incident.id, input),
    onSuccess: async (_updated, input) => {
      const leavesScope =
        !!input.departmentId &&
        user.role !== 'ADMIN' &&
        user.role !== 'DIRECCION' &&
        !user.departmentIds.includes(input.departmentId);
      onClose();
      if (leavesScope) {
        // Trasladada fuera de los departamentos del usuario: ya no puede verla.
        const dept =
          catalog.departments.find((d) => d.id === input.departmentId)?.name ?? 'otro departamento';
        toast.success(`${incident.code} trasladada a ${dept}`);
        navigate('/incidencias', { replace: true });
        await invalidateIncidents(qc);
        return;
      }
      await invalidateIncidents(qc);
      toast.success('Incidencia actualizada');
    },
  });

  /** Solo se envían los campos que han cambiado. */
  const buildChanges = (): UpdateIncidentInput => {
    const original = toValues(incident);
    const changes: UpdateIncidentInput = {};
    if (values.title.trim() !== original.title) changes.title = values.title.trim();
    if (values.description.trim() !== original.description)
      changes.description = values.description.trim();
    if (values.typeId !== original.typeId) changes.typeId = values.typeId;
    if (values.priority !== original.priority) changes.priority = values.priority as Priority;
    if (canMove && values.departmentId !== original.departmentId)
      changes.departmentId = values.departmentId;
    if (values.thirdParty.trim() !== original.thirdParty)
      changes.thirdParty = values.thirdParty.trim() || null;
    if (values.dueDate !== original.dueDate) changes.dueDate = values.dueDate || null;
    return changes;
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateIncident(values);
    setErrors(errs);
    if (hasErrors(errs)) return;
    const changes = buildChanges();
    if (Object.keys(changes).length === 0) {
      toast.info('No hay cambios que guardar');
      onClose();
      return;
    }
    mutation.mutate(changes);
  };

  const moving = canMove && values.departmentId !== incident.departmentId;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={mutation.isError ? errorMessage(mutation.error) : null} />
      <IncidentFields
        values={values}
        errors={errors}
        onChange={(changes) => setValues((v) => ({ ...v, ...changes }))}
        types={catalog.types}
        departments={canMove ? catalog.departments : null}
        departmentHint={
          moving
            ? incident.assigneeId
              ? 'Al trasladarla se quitará la asignación actual.'
              : 'La incidencia se trasladará a este departamento.'
            : 'Cambiarlo traslada la incidencia a otro departamento.'
        }
        disabled={mutation.isPending}
      />
      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}

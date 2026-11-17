import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { errorMessage } from '../api/client';
import { api } from '../api/endpoints';
import { invalidateIncidents, useCatalog } from '../api/queries';
import type { Catalog, Priority, User } from '../api/types';
import { useCurrentUser } from '../auth/AuthContext';
import { can } from '../auth/guards';
import { Button, ButtonLink } from '../components/Button';
import { Card, PageHeader } from '../components/Card';
import { FormError } from '../components/Field';
import { LoadingBlock } from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/States';
import { useToast } from '../components/Toast';
import { useDocumentTitle } from '../lib/utils';
import {
  hasErrors,
  validateIncident,
  type FormErrors,
  type IncidentFormValues,
} from '../lib/validation';
import { IncidentFields } from './incident/IncidentFields';

/** Departamentos en los que el usuario puede crear (ADMIN: todos; resto: los suyos). */
function allowedDepartments(user: User, catalog: Catalog) {
  return user.role === 'ADMIN'
    ? catalog.departments
    : catalog.departments.filter((d) => user.departmentIds.includes(d.id));
}

export function NewIncidentPage() {
  useDocumentTitle('Nueva incidencia');
  const user = useCurrentUser();
  const catalog = useCatalog();

  if (!can.createIncident(user)) {
    return (
      <EmptyState
        icon={<ShieldAlert className="size-6" />}
        title="No puedes crear incidencias"
        description="El rol Dirección tiene acceso de solo lectura."
        action={<ButtonLink to="/incidencias">Ver incidencias</ButtonLink>}
      />
    );
  }
  if (catalog.isPending) return <LoadingBlock />;
  if (catalog.isError)
    return <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />;
  return <NewIncidentForm user={user} catalog={catalog.data} />;
}

function NewIncidentForm({ user, catalog }: { user: User; catalog: Catalog }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const departments = useMemo(() => allowedDepartments(user, catalog), [user, catalog]);

  const [values, setValues] = useState<IncidentFormValues>({
    title: '',
    description: '',
    typeId: '',
    priority: 'MEDIA',
    departmentId: departments.length === 1 ? (departments[0]?.id ?? '') : '',
    thirdParty: '',
    dueDate: '',
  });
  const [errors, setErrors] = useState<FormErrors<IncidentFormValues>>({});
  const [submitted, setSubmitted] = useState(false);

  const create = useMutation({
    mutationFn: api.createIncident,
    onSuccess: async (incident) => {
      await invalidateIncidents(qc);
      toast.success(`Incidencia ${incident.code} creada`);
      navigate(`/incidencias/${incident.id}`);
    },
  });

  const onChange = (changes: Partial<IncidentFormValues>) => {
    const next = { ...values, ...changes };
    // Al elegir el tipo se preselecciona su departamento por defecto (si el usuario puede usarlo).
    if (changes.typeId !== undefined && changes.typeId !== values.typeId) {
      const type = catalog.types.find((t) => t.id === changes.typeId);
      if (type && departments.some((d) => d.id === type.defaultDepartmentId)) {
        next.departmentId = type.defaultDepartmentId;
      }
    }
    setValues(next);
    if (submitted) setErrors(validateIncident(next));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errs = validateIncident(values);
    setErrors(errs);
    if (hasErrors(errs)) {
      toast.error('Revisa los campos marcados');
      return;
    }
    create.mutate({
      title: values.title.trim(),
      description: values.description.trim(),
      typeId: values.typeId,
      priority: values.priority as Priority,
      departmentId: values.departmentId,
      thirdParty: values.thirdParty.trim() || null,
      dueDate: values.dueDate || null,
    });
  };

  const selectedType = catalog.types.find((t) => t.id === values.typeId);
  const typeDept =
    selectedType && catalog.departments.find((d) => d.id === selectedType.defaultDepartmentId);
  const departmentHint =
    typeDept && values.departmentId !== typeDept.id
      ? `El departamento habitual para este tipo es ${typeDept.name}.`
      : user.role === 'ADMIN'
        ? 'Se preselecciona según el tipo.'
        : 'Solo puedes crear incidencias en tus departamentos.';

  if (departments.length === 0) {
    return (
      <EmptyState
        title="No tienes departamentos asignados"
        description="Pide a un administrador que te asigne al menos un departamento para poder crear incidencias."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Nueva incidencia"
        subtitle="Registra una incidencia para que el departamento la gestione."
      />
      <Card className="max-w-3xl">
        <form onSubmit={onSubmit} noValidate className="space-y-5 p-4 sm:p-6">
          <FormError message={create.isError ? errorMessage(create.error) : null} />
          <IncidentFields
            values={values}
            errors={errors}
            onChange={onChange}
            types={catalog.types}
            departments={departments}
            departmentHint={departmentHint}
            disabled={create.isPending}
          />
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <ButtonLink to="/incidencias" variant="secondary">
              Cancelar
            </ButtonLink>
            <Button type="submit" loading={create.isPending}>
              Crear incidencia
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}

import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { api } from '../api/endpoints';
import { useCatalog } from '../api/queries';
import { useCurrentUser } from '../auth/AuthContext';
import { RoleBadge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card, CardHeader, PageHeader } from '../components/Card';
import { Field, FormError, Input } from '../components/Field';
import { useToast } from '../components/Toast';
import { formatDate } from '../lib/format';
import { ROLE_DESCRIPTION } from '../lib/labels';
import { useDocumentTitle } from '../lib/utils';
import { LIMITS, validatePassword } from '../lib/validation';

export function ProfilePage() {
  useDocumentTitle('Mi perfil');
  const user = useCurrentUser();
  const { data: catalog } = useCatalog();
  const departments = catalog?.departments.filter((d) => user.departmentIds.includes(d.id)) ?? [];

  return (
    <>
      <PageHeader title="Mi perfil" subtitle="Tus datos de acceso y tu contraseña." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Datos del usuario" />
          <dl className="divide-y divide-slate-100 px-4 py-1 text-sm sm:px-5">
            <div className="grid grid-cols-[8rem_1fr] gap-2 py-3">
              <dt className="text-slate-500">Nombre</dt>
              <dd className="font-medium text-slate-900">{user.name}</dd>
            </div>
            <div className="grid grid-cols-[8rem_1fr] gap-2 py-3">
              <dt className="text-slate-500">Email</dt>
              <dd className="break-all text-slate-900">{user.email}</dd>
            </div>
            <div className="grid grid-cols-[8rem_1fr] gap-2 py-3">
              <dt className="text-slate-500">Rol</dt>
              <dd>
                <RoleBadge role={user.role} />
                <p className="mt-1 text-xs text-slate-500">{ROLE_DESCRIPTION[user.role]}</p>
              </dd>
            </div>
            <div className="grid grid-cols-[8rem_1fr] gap-2 py-3">
              <dt className="text-slate-500">Departamentos</dt>
              <dd className="text-slate-900">
                {departments.length > 0 ? (
                  <ul className="space-y-0.5">
                    {departments.map((d) => (
                      <li key={d.id}>{d.name}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-slate-500">Ninguno</span>
                )}
              </dd>
            </div>
            <div className="grid grid-cols-[8rem_1fr] gap-2 py-3">
              <dt className="text-slate-500">Alta</dt>
              <dd className="text-slate-900">{formatDate(user.createdAt)}</dd>
            </div>
          </dl>
        </Card>
        <ChangePasswordCard />
      </div>
    </>
  );
}

function ChangePasswordCard() {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});

  const mutation = useMutation({
    mutationFn: () => api.changePassword(current, next),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setConfirm('');
      setErrors({});
      toast.success('Contraseña actualizada');
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!current) errs.current = 'Indica tu contraseña actual';
    const pwError = validatePassword(next);
    if (pwError) errs.next = pwError;
    else if (next === current) errs.next = 'La nueva contraseña debe ser distinta de la actual';
    if (confirm !== next) errs.confirm = 'Las contraseñas no coinciden';
    setErrors(errs);
    if (Object.keys(errs).length === 0) mutation.mutate();
  };

  return (
    <Card>
      <CardHeader title="Cambiar contraseña" />
      <form onSubmit={onSubmit} noValidate className="space-y-4 px-4 py-4 sm:px-5">
        <FormError message={mutation.isError ? errorMessage(mutation.error) : null} />
        <Field label="Contraseña actual" required error={errors.current}>
          <Input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field
          label="Nueva contraseña"
          required
          error={errors.next}
          hint={`Mínimo ${LIMITS.passwordMin} caracteres.`}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            maxLength={LIMITS.passwordMax}
          />
        </Field>
        <Field label="Repite la nueva contraseña" required error={errors.confirm}>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            maxLength={LIMITS.passwordMax}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={mutation.isPending}>
            Cambiar contraseña
          </Button>
        </div>
      </form>
    </Card>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, UserPlus } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { api } from '../../api/endpoints';
import { queryKeys, useCatalog } from '../../api/queries';
import { ROLES, type Department, type Role, type User } from '../../api/types';
import { useCurrentUser } from '../../auth/AuthContext';
import { Badge, RoleBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card, PageHeader } from '../../components/Card';
import { Checkbox, Field, FormError, Input, Select } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { LoadingBlock } from '../../components/Spinner';
import { EmptyState, ErrorState } from '../../components/States';
import { useToast } from '../../components/Toast';
import { ROLE_DESCRIPTION, ROLE_LABEL } from '../../lib/labels';
import { useDocumentTitle } from '../../lib/utils';
import { isValidEmail, LIMITS, validatePassword } from '../../lib/validation';

const requiresDepartment = (role: Role) => role === 'RESPONSABLE' || role === 'USUARIO';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; user: User }
  | { kind: 'password'; user: User }
  | null;

/** HU-02: gestión de usuarios (solo ADMIN). */
export function UsersPage() {
  useDocumentTitle('Usuarios');
  const users = useQuery({ queryKey: queryKeys.adminUsers, queryFn: api.listUsers });
  const catalog = useCatalog();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [filter, setFilter] = useState('');

  const deptName = useMemo(() => {
    const map = new Map(catalog.data?.departments.map((d) => [d.id, d.name]));
    return (id: string) => map.get(id) ?? '—';
  }, [catalog.data]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = [...(users.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    if (!q) return list;
    return list.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users.data, filter]);

  const close = () => setDialog(null);

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle="Alta, roles, departamentos y acceso de las personas que usan IncidApp."
        actions={
          <Button
            onClick={() => setDialog({ kind: 'create' })}
            icon={<UserPlus className="size-4" aria-hidden="true" />}
            disabled={!catalog.data}
          >
            Nuevo usuario
          </Button>
        }
      />
      <Card>
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <label htmlFor="u-filter" className="sr-only">
            Buscar usuario
          </label>
          <Input
            id="u-filter"
            type="search"
            placeholder="Buscar por nombre o email…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-sm"
          />
        </div>
        {users.isPending ? (
          <LoadingBlock label="Cargando usuarios…" />
        ) : users.isError ? (
          <ErrorState error={users.error} onRetry={() => void users.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No hay usuarios que coincidan" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Usuarios de la aplicación</caption>
              <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-600 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Nombre
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Email
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Rol
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Departamentos
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Estado
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => (
                  <tr key={u.id} className={u.active ? undefined : 'bg-slate-50/60 text-slate-500'}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap text-slate-900">
                      {u.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{u.email}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {u.departmentIds.length ? u.departmentIds.map(deptName).join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {u.active ? (
                        <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200">
                          Activo
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600 ring-slate-300">
                          Inactivo
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDialog({ kind: 'edit', user: u })}
                          icon={<Pencil className="size-4" aria-hidden="true" />}
                          aria-label={`Editar a ${u.name}`}
                        >
                          <span className="hidden xl:inline">Editar</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDialog({ kind: 'password', user: u })}
                          icon={<KeyRound className="size-4" aria-hidden="true" />}
                          aria-label={`Restablecer la contraseña de ${u.name}`}
                        >
                          <span className="hidden xl:inline">Contraseña</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {catalog.data && (
        <Modal
          open={dialog?.kind === 'create' || dialog?.kind === 'edit'}
          onClose={close}
          title={dialog?.kind === 'edit' ? `Editar usuario: ${dialog.user.name}` : 'Nuevo usuario'}
          size="lg"
        >
          {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
            <UserForm
              key={dialog.kind === 'edit' ? dialog.user.id : 'new'}
              user={dialog.kind === 'edit' ? dialog.user : null}
              departments={catalog.data.departments}
              onDone={close}
            />
          )}
        </Modal>
      )}
      <Modal
        open={dialog?.kind === 'password'}
        onClose={close}
        title="Restablecer contraseña"
        description={
          dialog?.kind === 'password' ? `${dialog.user.name} (${dialog.user.email})` : undefined
        }
        size="sm"
      >
        {dialog?.kind === 'password' && <ResetPasswordForm user={dialog.user} onDone={close} />}
      </Modal>
    </>
  );
}

function UserForm({
  user,
  departments,
  onDone,
}: {
  user: User | null;
  departments: Department[];
  onDone: () => void;
}) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const toast = useToast();
  const isEdit = user !== null;
  const isSelf = user?.id === me.id;

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<Role>(user?.role ?? 'USUARIO');
  const [password, setPassword] = useState('');
  const [deptIds, setDeptIds] = useState<string[]>(user?.departmentIds ?? []);
  const [active, setActive] = useState(user?.active ?? true);
  const [errors, setErrors] = useState<
    Partial<Record<'name' | 'email' | 'password' | 'departments', string>>
  >({});

  const mutation = useMutation({
    mutationFn: async () => {
      if (user) {
        return api.updateUser(user.id, { name: name.trim(), role, departmentIds: deptIds, active });
      }
      return api.createUser({
        name: name.trim(),
        email: email.trim(),
        role,
        password,
        departmentIds: deptIds,
      });
    },
    onSuccess: async (saved) => {
      await qc.invalidateQueries({ queryKey: queryKeys.adminUsers });
      // Si un admin se edita a sí mismo (nombre, departamentos) se refresca la sesión.
      if (saved.id === me.id) await qc.invalidateQueries({ queryKey: queryKeys.me });
      // Los asignables dependen de roles/departamentos/activo.
      await qc.invalidateQueries({ queryKey: ['assignable'] });
      toast.success(isEdit ? `Usuario ${saved.name} actualizado` : `Usuario ${saved.name} creado`);
      onDone();
    },
  });

  const toggleDept = (id: string, checked: boolean) => {
    setDeptIds((ids) => (checked ? [...ids, id] : ids.filter((d) => d !== id)));
    if (checked) setErrors(({ departments: _cleared, ...rest }) => rest);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    const n = name.trim();
    if (n.length < LIMITS.nameMin)
      errs.name = `El nombre debe tener al menos ${LIMITS.nameMin} caracteres`;
    else if (n.length > LIMITS.nameMax)
      errs.name = `El nombre no puede superar ${LIMITS.nameMax} caracteres`;
    if (!isEdit) {
      if (!isValidEmail(email)) errs.email = 'Introduce un email válido';
      const pw = validatePassword(password);
      if (pw) errs.password = pw;
    }
    if (requiresDepartment(role) && deptIds.length === 0) {
      errs.departments = 'Un responsable o usuario debe pertenecer al menos a un departamento';
    }
    setErrors(errs);
    if (Object.keys(errs).length === 0) mutation.mutate();
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={mutation.isError ? errorMessage(mutation.error) : null} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombre completo" required error={errors.name}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={LIMITS.nameMax}
            autoFocus
          />
        </Field>
        <Field
          label="Email"
          required={!isEdit}
          error={errors.email}
          hint={isEdit ? 'El email no se puede cambiar.' : undefined}
        >
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isEdit}
            autoComplete="off"
            maxLength={200}
          />
        </Field>
        <Field
          label="Rol"
          required
          hint={isSelf ? 'No puedes quitarte el rol de administrador.' : ROLE_DESCRIPTION[role]}
        >
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={isSelf}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        {!isEdit && (
          <Field
            label="Contraseña inicial"
            required
            error={errors.password}
            hint={`Mínimo ${LIMITS.passwordMin} caracteres.`}
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              maxLength={LIMITS.passwordMax}
            />
          </Field>
        )}
      </div>

      <fieldset aria-describedby={errors.departments ? 'u-depts-error' : 'u-depts-hint'}>
        <legend className="mb-1.5 text-sm font-medium text-slate-800">
          Departamentos
          {requiresDepartment(role) && (
            <span className="text-red-600" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </legend>
        <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
          {departments.map((d) => (
            <Checkbox
              key={d.id}
              label={d.name}
              checked={deptIds.includes(d.id)}
              onChange={(e) => toggleDept(d.id, e.target.checked)}
            />
          ))}
        </div>
        {errors.departments ? (
          <p id="u-depts-error" className="mt-1 text-xs font-medium text-red-700">
            {errors.departments}
          </p>
        ) : (
          <p id="u-depts-hint" className="mt-1 text-xs text-slate-500">
            {requiresDepartment(role)
              ? 'Obligatorio: determina qué incidencias puede ver y gestionar.'
              : 'Opcional: este rol ve toda la empresa.'}
          </p>
        )}
      </fieldset>

      {isEdit && (
        <div>
          <Checkbox
            label="Usuario activo (puede iniciar sesión)"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            disabled={isSelf}
          />
          {isSelf && (
            <p className="mt-1 text-xs text-slate-500">No puedes desactivar tu propia cuenta.</p>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onDone} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          {isEdit ? 'Guardar cambios' : 'Crear usuario'}
        </Button>
      </div>
    </form>
  );
}

function ResetPasswordForm({ user, onDone }: { user: User; onDone: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});

  const mutation = useMutation({
    mutationFn: () => api.resetUserPassword(user.id, password),
    onSuccess: () => {
      toast.success(`Contraseña de ${user.name} restablecida`);
      onDone();
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    const pw = validatePassword(password);
    if (pw) errs.password = pw;
    if (confirm !== password) errs.confirm = 'Las contraseñas no coinciden';
    setErrors(errs);
    if (Object.keys(errs).length === 0) mutation.mutate();
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={mutation.isError ? errorMessage(mutation.error) : null} />
      <Field
        label="Nueva contraseña"
        required
        error={errors.password}
        hint={`Mínimo ${LIMITS.passwordMin} caracteres.`}
      >
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          maxLength={LIMITS.passwordMax}
          autoFocus
        />
      </Field>
      <Field label="Repite la contraseña" required error={errors.confirm}>
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          maxLength={LIMITS.passwordMax}
        />
      </Field>
      <p className="text-xs text-slate-500">
        Comunica la nueva contraseña al usuario por un canal seguro.
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onDone} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          Restablecer
        </Button>
      </div>
    </form>
  );
}

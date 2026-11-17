import { conflict, DomainError, forbidden, notFound } from '../../domain/errors.js';
import type { Actor, Role, User } from '../../domain/model.js';
import { requiresDepartment } from '../../domain/model.js';
import { inScope } from '../../domain/policies.js';
import { isManager } from '../../domain/incident-status.js';
import type { Deps } from '../deps.js';
import type { RequestContext } from '../ports.js';
import { createUserSchema, parse, resetPasswordSchema, updateUserSchema } from '../schemas.js';

const assertAdmin = (actor: Actor) => {
  if (actor.role !== 'ADMIN') throw forbidden('Solo un administrador puede gestionar usuarios');
};

async function validateDepartments(
  deps: Deps,
  role: Role,
  departmentIds: string[],
): Promise<string[]> {
  const unique = [...new Set(departmentIds)];
  for (const id of unique) {
    if (!(await deps.catalog.findDepartment(id)))
      throw new DomainError('VALIDATION', 'Departamento no válido');
  }
  if (requiresDepartment(role) && unique.length === 0) {
    throw new DomainError(
      'VALIDATION',
      'Un responsable o usuario debe pertenecer al menos a un departamento',
    );
  }
  // Los roles globales no necesitan departamentos, pero se permiten como información.
  return unique;
}

export async function listUsers(deps: Deps, actor: Actor): Promise<User[]> {
  assertAdmin(actor);
  return deps.users.list();
}

/** HU-02 */
export async function createUser(
  deps: Deps,
  actor: Actor,
  input: unknown,
  ctx: RequestContext = {},
) {
  assertAdmin(actor);
  const data = parse(createUserSchema, input);
  if (await deps.users.findByEmailWithPassword(data.email)) {
    throw conflict('Ya existe un usuario con ese email');
  }
  const departmentIds = await validateDepartments(deps, data.role, data.departmentIds);
  const user = await deps.users.create({
    email: data.email,
    name: data.name,
    role: data.role,
    passwordHash: await deps.hasher.hash(data.password),
    departmentIds,
  });
  await deps.audit.log({
    actorId: actor.id,
    action: 'USER_CREATED',
    entity: 'user',
    entityId: user.id,
    details: { email: user.email, role: user.role },
    ip: ctx.ip,
  });
  return user;
}

export async function updateUser(
  deps: Deps,
  actor: Actor,
  userId: string,
  input: unknown,
  ctx: RequestContext = {},
) {
  assertAdmin(actor);
  const data = parse(updateUserSchema, input);
  const current = await deps.users.findById(userId);
  if (!current) throw notFound('Usuario');

  // Salvaguarda: el sistema nunca se queda sin administradores activos.
  const losesAdmin =
    current.role === 'ADMIN' &&
    current.active &&
    ((data.role !== undefined && data.role !== 'ADMIN') || data.active === false);
  if (losesAdmin) {
    if (userId === actor.id) {
      throw new DomainError(
        'VALIDATION',
        'No puedes quitarte el rol de administrador ni desactivarte',
      );
    }
    if ((await deps.users.countActiveAdmins()) <= 1) {
      throw new DomainError('VALIDATION', 'Debe existir al menos un administrador activo');
    }
  }

  const role = data.role ?? current.role;
  const departmentIds = await validateDepartments(
    deps,
    role,
    data.departmentIds ?? current.departmentIds,
  );
  const updated = await deps.users.update(userId, { ...data, departmentIds });
  await deps.audit.log({
    actorId: actor.id,
    action: 'USER_UPDATED',
    entity: 'user',
    entityId: userId,
    details: { changes: data },
    ip: ctx.ip,
  });
  return updated;
}

export async function resetUserPassword(
  deps: Deps,
  actor: Actor,
  userId: string,
  input: unknown,
  ctx: RequestContext = {},
) {
  assertAdmin(actor);
  const { password } = parse(resetPasswordSchema, input);
  if (!(await deps.users.findById(userId))) throw notFound('Usuario');
  await deps.users.updatePassword(userId, await deps.hasher.hash(password));
  await deps.audit.log({
    actorId: actor.id,
    action: 'PASSWORD_RESET',
    entity: 'user',
    entityId: userId,
    ip: ctx.ip,
  });
}

/** HU-06: usuarios a los que se puede asignar una incidencia de un departamento. */
export async function listAssignableUsers(deps: Deps, actor: Actor, departmentId: string) {
  if (!isManager(actor.role) || !inScope(actor, departmentId)) {
    throw forbidden('No puedes asignar incidencias de este departamento');
  }
  const users = await deps.users.listActiveByDepartment(departmentId);
  // DIRECCION es de solo lectura: no puede tener incidencias asignadas.
  return users
    .filter((u) => u.role !== 'DIRECCION')
    .map((u) => ({ id: u.id, name: u.name, role: u.role }));
}

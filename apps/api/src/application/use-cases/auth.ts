import { DomainError, unauthorized } from '../../domain/errors.js';
import type { Actor, User } from '../../domain/model.js';
import type { Deps } from '../deps.js';
import type { RequestContext } from '../ports.js';
import { changePasswordSchema, loginSchema, parse } from '../schemas.js';

/** Hash ficticio para igualar tiempos cuando el email no existe (evita enumeración de usuarios). */
let dummyHash: string | null = null;

/** HU-01: iniciar sesión. Devuelve el usuario si las credenciales son válidas. */
export async function login(deps: Deps, input: unknown, ctx: RequestContext = {}): Promise<User> {
  const { email, password } = parse(loginSchema, input);
  const user = await deps.users.findByEmailWithPassword(email);

  dummyHash ??= await deps.hasher.hash('dummy-password-for-timing');
  const ok = await deps.hasher.verify(password, user?.passwordHash ?? dummyHash);

  if (!user || !ok || !user.active) {
    await deps.audit.log({
      actorId: user?.id ?? null,
      action: 'LOGIN_FAILED',
      details: { email, reason: !user || !ok ? 'credenciales' : 'usuario inactivo' },
      ip: ctx.ip,
    });
    // Mensaje genérico: no revela si el email existe ni si la cuenta está desactivada.
    throw unauthorized('Email o contraseña incorrectos');
  }

  await deps.audit.log({ actorId: user.id, action: 'LOGIN', ip: ctx.ip });
  const { passwordHash: _omit, ...publicUser } = user;
  return publicUser;
}

/**
 * Carga el actor de la sesión en cada petición. Así, un cambio de rol o una
 * desactivación tienen efecto inmediato aunque el token siga vigente.
 */
export async function resolveActor(
  deps: Deps,
  userId: string,
): Promise<{ actor: Actor; user: User }> {
  const user = await deps.users.findById(userId);
  if (!user || !user.active) throw unauthorized('Sesión no válida');
  return { actor: { id: user.id, role: user.role, departmentIds: user.departmentIds }, user };
}

export async function changeOwnPassword(
  deps: Deps,
  actor: Actor,
  input: unknown,
  ctx: RequestContext = {},
): Promise<void> {
  const { currentPassword, newPassword } = parse(changePasswordSchema, input);
  const user = await deps.users.findByIdWithPassword(actor.id);
  if (!user) throw unauthorized();
  if (!(await deps.hasher.verify(currentPassword, user.passwordHash))) {
    throw new DomainError('VALIDATION', 'La contraseña actual no es correcta');
  }
  await deps.users.updatePassword(actor.id, await deps.hasher.hash(newPassword));
  await deps.audit.log({
    actorId: actor.id,
    action: 'PASSWORD_CHANGED',
    entity: 'user',
    entityId: actor.id,
    ip: ctx.ip,
  });
}

import { DomainError } from './errors.js';
import type { IncidentStatus, Role } from './model.js';

/**
 * Máquina de estados de una incidencia (ver docs/specs/02-diseno.md §3).
 */
interface TransitionRule {
  /** Exige comentario explicativo. */
  requiresComment: boolean;
  /** Solo RESPONSABLE o ADMIN pueden ejecutarla. */
  managerOnly: boolean;
}

const rule = (requiresComment: boolean, managerOnly: boolean): TransitionRule => ({
  requiresComment,
  managerOnly,
});

export const TRANSITIONS: Record<
  IncidentStatus,
  Partial<Record<IncidentStatus, TransitionRule>>
> = {
  ABIERTA: {
    EN_CURSO: rule(false, false),
    RECHAZADA: rule(true, true),
  },
  EN_CURSO: {
    PENDIENTE_TERCERO: rule(false, false),
    RESUELTA: rule(true, false),
    RECHAZADA: rule(true, true),
  },
  PENDIENTE_TERCERO: {
    EN_CURSO: rule(false, false),
    RESUELTA: rule(true, false),
  },
  RESUELTA: {
    CERRADA: rule(false, true),
    EN_CURSO: rule(true, true), // reabrir
  },
  CERRADA: {
    EN_CURSO: rule(true, true), // reabrir
  },
  RECHAZADA: {
    EN_CURSO: rule(true, true), // reabrir
  },
};

/** Estados "finales": la incidencia no se puede editar sin reabrirla. */
export const FINAL_STATUSES: readonly IncidentStatus[] = ['CERRADA', 'RECHAZADA'];
/** Estados que cuentan como "abiertas" (trabajo pendiente). */
export const OPEN_STATUSES: readonly IncidentStatus[] = [
  'ABIERTA',
  'EN_CURSO',
  'PENDIENTE_TERCERO',
];

export const isManager = (role: Role) => role === 'ADMIN' || role === 'RESPONSABLE';

export function getTransitionRule(from: IncidentStatus, to: IncidentStatus): TransitionRule | null {
  return TRANSITIONS[from][to] ?? null;
}

export function isReopen(from: IncidentStatus, to: IncidentStatus): boolean {
  return to === 'EN_CURSO' && (from === 'RESUELTA' || from === 'CERRADA' || from === 'RECHAZADA');
}

/** Transiciones disponibles desde un estado para un rol (sin tener en cuenta propiedad). */
export function availableTransitions(from: IncidentStatus, role: Role): IncidentStatus[] {
  return (Object.entries(TRANSITIONS[from]) as [IncidentStatus, TransitionRule][])
    .filter(([, r]) => !r.managerOnly || isManager(role))
    .map(([to]) => to);
}

/**
 * Valida una transición. Lanza DomainError si no es válida.
 * La comprobación de *quién* puede tocar la incidencia se hace en policies.ts.
 */
export function assertTransition(
  from: IncidentStatus,
  to: IncidentStatus,
  role: Role,
  comment: string | undefined | null,
): TransitionRule {
  const r = getTransitionRule(from, to);
  if (!r) {
    throw new DomainError('INVALID_TRANSITION', `No se puede pasar de ${from} a ${to}`);
  }
  if (r.managerOnly && !isManager(role)) {
    throw new DomainError(
      'FORBIDDEN',
      'Solo un responsable o administrador puede hacer este cambio',
    );
  }
  if (r.requiresComment && !comment?.trim()) {
    throw new DomainError('VALIDATION', 'Este cambio de estado requiere un comentario');
  }
  return r;
}

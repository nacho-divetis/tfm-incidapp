import { forbidden } from '../../domain/errors.js';
import { TRANSITIONS } from '../../domain/incident-status.js';
import type { Actor } from '../../domain/model.js';
import { hasGlobalScope, PRIORITIES, ROLES, STATUSES } from '../../domain/model.js';
import type { Deps } from '../deps.js';
import { paginationSchema, parse } from '../schemas.js';

/** Catálogos para formularios y filtros del frontend. */
export async function getCatalog(deps: Deps) {
  const [departments, types] = await Promise.all([
    deps.catalog.listDepartments(),
    deps.catalog.listIncidentTypes(),
  ]);
  return {
    departments,
    types,
    priorities: PRIORITIES,
    statuses: STATUSES,
    roles: ROLES,
    transitions: Object.fromEntries(
      Object.entries(TRANSITIONS).map(([from, rules]) => [from, Object.keys(rules)]),
    ),
  };
}

/** HU-10: cuadro de mando limitado al ámbito del actor. */
export async function getDashboard(deps: Deps, actor: Actor) {
  const scope = hasGlobalScope(actor.role) ? undefined : actor.departmentIds;
  const today = deps.clock.now().toISOString().slice(0, 10);
  return deps.dashboard.stats(scope, today);
}

/** HU-11: auditoría (solo ADMIN). */
export async function listAudit(deps: Deps, actor: Actor, query: unknown) {
  if (actor.role !== 'ADMIN') throw forbidden('Solo un administrador puede consultar la auditoría');
  const { page, pageSize } = parse(paginationSchema, query);
  const result = await deps.audit.list(page, pageSize);
  return { ...result, page, pageSize };
}

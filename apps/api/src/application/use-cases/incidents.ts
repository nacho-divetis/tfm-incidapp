import { DomainError, forbidden, notFound } from '../../domain/errors.js';
import { assertTransition, isReopen, OPEN_STATUSES } from '../../domain/incident-status.js';
import type { Actor, Incident } from '../../domain/model.js';
import { hasGlobalScope } from '../../domain/model.js';
import {
  allowedTransitionsFor,
  canAssignIncident,
  canChangeStatus,
  canCommentIncident,
  canCreateIncidentIn,
  canEditIncident,
  canMoveIncident,
  canViewIncident,
  incidentPermissions,
} from '../../domain/policies.js';
import type { Deps } from '../deps.js';
import type { IncidentFilter, IncidentListItem, RequestContext } from '../ports.js';
import {
  assignSchema,
  changeStatusSchema,
  commentSchema,
  createIncidentSchema,
  listIncidentsSchema,
  parse,
  updateIncidentSchema,
} from '../schemas.js';

export const formatIncidentCode = (year: number, seq: number) =>
  `INC-${year}-${String(seq).padStart(4, '0')}`;

/**
 * Carga una incidencia comprobando que el actor puede verla.
 * Si no puede, responde "no encontrada" para no revelar que existe (OWASP A01).
 */
export async function loadVisibleIncident(
  deps: Deps,
  actor: Actor,
  id: string,
): Promise<IncidentListItem> {
  const incident = await deps.incidents.findById(id);
  if (!incident || !canViewIncident(actor, incident)) throw notFound('Incidencia');
  return incident;
}

/** HU-03: crear incidencia. */
export async function createIncident(
  deps: Deps,
  actor: Actor,
  input: unknown,
  ctx: RequestContext = {},
) {
  const data = parse(createIncidentSchema, input);
  const type = await deps.catalog.findIncidentType(data.typeId);
  if (!type) throw new DomainError('VALIDATION', 'Tipo de incidencia no válido');

  const departmentId = data.departmentId ?? type.defaultDepartmentId;
  const department = await deps.catalog.findDepartment(departmentId);
  if (!department) throw new DomainError('VALIDATION', 'Departamento no válido');
  if (!canCreateIncidentIn(actor, departmentId)) {
    throw forbidden(`No puedes crear incidencias en el departamento ${department.name}`);
  }

  const now = deps.clock.now();
  const year = now.getFullYear();
  const seq = await deps.incidents.nextSequence(year);
  const incident: Incident = {
    id: deps.ids.next(),
    code: formatIncidentCode(year, seq),
    title: data.title,
    description: data.description,
    typeId: type.id,
    departmentId,
    priority: data.priority,
    status: 'ABIERTA',
    thirdParty: data.thirdParty?.trim() || null,
    dueDate: data.dueDate ?? null,
    createdById: actor.id,
    assigneeId: null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    closedAt: null,
  };
  await deps.incidents.create(incident, [{ type: 'CREATED', actorId: actor.id, data: {} }]);
  await deps.audit.log({
    actorId: actor.id,
    action: 'INCIDENT_CREATED',
    entity: 'incident',
    entityId: incident.id,
    details: { code: incident.code },
    ip: ctx.ip,
  });
  return incident;
}

/** HU-04: listado filtrado y limitado al ámbito del actor. */
export async function listIncidents(deps: Deps, actor: Actor, query: unknown) {
  const q = parse(listIncidentsSchema, query);
  const filter: IncidentFilter = {
    status: q.status === 'OPEN' ? [...OPEN_STATUSES] : q.status,
    typeId: q.typeId,
    departmentId: q.departmentId,
    priority: q.priority,
    assigneeId: q.assignedToMe ? actor.id : undefined,
    createdById: q.mine ? actor.id : undefined,
    text: q.q || undefined,
    overdueBefore: q.overdue ? deps.clock.now().toISOString().slice(0, 10) : undefined,
    scopeDepartmentIds: hasGlobalScope(actor.role) ? undefined : actor.departmentIds,
    page: q.page,
    pageSize: q.pageSize,
    sort: q.sort,
  };
  const { items, total } = await deps.incidents.list(filter);
  return { items, total, page: q.page, pageSize: q.pageSize };
}

/** HU-04 CA4: detalle con línea de tiempo, adjuntos y permisos del actor. */
export async function getIncidentDetail(deps: Deps, actor: Actor, id: string) {
  const incident = await loadVisibleIncident(deps, actor, id);
  const [events, attachments] = await Promise.all([
    deps.incidents.listEvents(id),
    deps.attachments.listByIncident(id),
  ]);
  return {
    incident,
    events,
    attachments: attachments.map(({ storageKey: _k, ...a }) => a),
    permissions: incidentPermissions(actor, incident),
  };
}

const EDITABLE_FIELDS = [
  'title',
  'description',
  'typeId',
  'priority',
  'departmentId',
  'thirdParty',
  'dueDate',
] as const;

/** HU-07: editar. */
export async function updateIncident(
  deps: Deps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestContext = {},
) {
  const data = parse(updateIncidentSchema, input);
  const incident = await loadVisibleIncident(deps, actor, id);
  if (!canEditIncident(actor, incident)) throw forbidden('No puedes editar esta incidencia');

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const next: Incident = { ...incident };
  for (const field of EDITABLE_FIELDS) {
    const value = data[field];
    if (value === undefined) continue;
    const normalized =
      field === 'thirdParty' && typeof value === 'string' ? value.trim() || null : value;
    if (normalized !== incident[field]) {
      changes[field] = { from: incident[field], to: normalized };
      (next as unknown as Record<string, unknown>)[field] = normalized;
    }
  }
  if (Object.keys(changes).length === 0) return incident;

  if (changes.typeId && !(await deps.catalog.findIncidentType(next.typeId))) {
    throw new DomainError('VALIDATION', 'Tipo de incidencia no válido');
  }
  if (changes.departmentId) {
    if (!canMoveIncident(actor, incident)) throw forbidden('No puedes trasladar esta incidencia');
    if (!(await deps.catalog.findDepartment(next.departmentId))) {
      throw new DomainError('VALIDATION', 'Departamento no válido');
    }
    // Al trasladar, la asignación anterior deja de tener sentido.
    if (next.assigneeId) {
      changes.assigneeId = { from: next.assigneeId, to: null };
      next.assigneeId = null;
    }
  }

  next.updatedAt = deps.clock.now();
  await deps.incidents.save(next, [{ type: 'UPDATED', actorId: actor.id, data: { changes } }]);
  await deps.audit.log({
    actorId: actor.id,
    action: 'INCIDENT_UPDATED',
    entity: 'incident',
    entityId: id,
    details: { fields: Object.keys(changes) },
    ip: ctx.ip,
  });
  return next;
}

/** HU-05: cambiar de estado. */
export async function changeIncidentStatus(
  deps: Deps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestContext = {},
) {
  const { status: to, comment } = parse(changeStatusSchema, input);
  const incident = await loadVisibleIncident(deps, actor, id);
  if (!canChangeStatus(actor, incident)) {
    throw forbidden('Solo puedes cambiar el estado de incidencias que creaste o tienes asignadas');
  }
  const from = incident.status;
  assertTransition(from, to, actor.role, comment);
  if (!allowedTransitionsFor(actor, incident).includes(to)) throw forbidden();

  const now = deps.clock.now();
  const next: Incident = { ...incident, status: to, updatedAt: now };
  if (to === 'RESUELTA') next.resolvedAt = now;
  if (to === 'CERRADA') next.closedAt = now;
  if (isReopen(from, to)) {
    next.resolvedAt = null;
    next.closedAt = null;
  }
  await deps.incidents.save(next, [
    {
      type: 'STATUS_CHANGED',
      actorId: actor.id,
      data: { from, to, comment: comment?.trim() || null, reopen: isReopen(from, to) },
    },
  ]);
  await deps.audit.log({
    actorId: actor.id,
    action: 'INCIDENT_STATUS_CHANGED',
    entity: 'incident',
    entityId: id,
    details: { from, to },
    ip: ctx.ip,
  });
  return next;
}

/** HU-06: asignar o desasignar. */
export async function assignIncident(
  deps: Deps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestContext = {},
) {
  const { assigneeId } = parse(assignSchema, input);
  const incident = await loadVisibleIncident(deps, actor, id);
  if (!canAssignIncident(actor, incident)) throw forbidden('No puedes asignar esta incidencia');
  if (assigneeId === incident.assigneeId) return incident;

  let assigneeName: string | null = null;
  if (assigneeId) {
    const assignee = await deps.users.findById(assigneeId);
    if (
      !assignee ||
      !assignee.active ||
      assignee.role === 'DIRECCION' ||
      !assignee.departmentIds.includes(incident.departmentId)
    ) {
      throw new DomainError(
        'VALIDATION',
        'El usuario no pertenece al departamento de la incidencia',
      );
    }
    assigneeName = assignee.name;
  }

  const next: Incident = { ...incident, assigneeId, updatedAt: deps.clock.now() };
  await deps.incidents.save(next, [
    {
      type: 'ASSIGNED',
      actorId: actor.id,
      data: {
        from: incident.assigneeId,
        fromName: incident.assigneeName,
        to: assigneeId,
        toName: assigneeName,
      },
    },
  ]);
  await deps.audit.log({
    actorId: actor.id,
    action: 'INCIDENT_ASSIGNED',
    entity: 'incident',
    entityId: id,
    details: { assigneeId },
    ip: ctx.ip,
  });
  return next;
}

/** HU-08: comentar. */
export async function addComment(deps: Deps, actor: Actor, id: string, input: unknown) {
  const { text } = parse(commentSchema, input);
  const incident = await loadVisibleIncident(deps, actor, id);
  if (!canCommentIncident(actor, incident))
    throw forbidden('No puedes comentar en esta incidencia');
  await deps.incidents.save({ ...incident, updatedAt: deps.clock.now() }, [
    { type: 'COMMENT', actorId: actor.id, data: { text } },
  ]);
}

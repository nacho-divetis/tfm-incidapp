import { availableTransitions, FINAL_STATUSES, isManager } from './incident-status.js';
import type { Actor, Attachment, Incident, IncidentStatus } from './model.js';
import { hasGlobalScope } from './model.js';

/**
 * Políticas de autorización (matriz de permisos de docs/specs/02-diseno.md §4).
 * Son funciones puras: fáciles de testear y reutilizadas por todos los casos de uso.
 */

export const inScope = (actor: Actor, departmentId: string): boolean =>
  hasGlobalScope(actor.role) || actor.departmentIds.includes(departmentId);

export const canViewIncident = (actor: Actor, incident: Pick<Incident, 'departmentId'>): boolean =>
  inScope(actor, incident.departmentId);

export const canCreateIncidentIn = (actor: Actor, departmentId: string): boolean => {
  if (actor.role === 'ADMIN') return true;
  if (actor.role === 'DIRECCION') return false;
  return actor.departmentIds.includes(departmentId);
};

const isFinal = (incident: Incident) => FINAL_STATUSES.includes(incident.status);

export const canEditIncident = (actor: Actor, incident: Incident): boolean => {
  if (!canViewIncident(actor, incident) || isFinal(incident)) return false;
  if (isManager(actor.role)) return true;
  return (
    actor.role === 'USUARIO' && incident.createdById === actor.id && incident.status === 'ABIERTA'
  );
};

/** Trasladar a otro departamento: solo gestores. */
export const canMoveIncident = (actor: Actor, incident: Incident): boolean =>
  isManager(actor.role) && canEditIncident(actor, incident);

export const canAssignIncident = (actor: Actor, incident: Incident): boolean =>
  isManager(actor.role) && canViewIncident(actor, incident) && !isFinal(incident);

export const canCommentIncident = (actor: Actor, incident: Incident): boolean =>
  actor.role !== 'DIRECCION' && canViewIncident(actor, incident);

export const canAttachToIncident = (actor: Actor, incident: Incident): boolean =>
  canCommentIncident(actor, incident) && incident.status !== 'CERRADA';

export const canDeleteAttachment = (
  actor: Actor,
  incident: Incident,
  attachment: Attachment,
): boolean => {
  if (!canAttachToIncident(actor, incident)) return false;
  return isManager(actor.role) || attachment.uploadedById === actor.id;
};

/** ¿Puede el actor operar el estado de esta incidencia (al menos alguna transición)? */
const canOperateStatus = (actor: Actor, incident: Incident): boolean => {
  if (actor.role === 'DIRECCION' || !canViewIncident(actor, incident)) return false;
  if (isManager(actor.role)) return true;
  return incident.createdById === actor.id || incident.assigneeId === actor.id;
};

/** Transiciones que este actor puede ejecutar sobre esta incidencia concreta. */
export const allowedTransitionsFor = (actor: Actor, incident: Incident): IncidentStatus[] =>
  canOperateStatus(actor, incident) ? availableTransitions(incident.status, actor.role) : [];

export const canChangeStatus = (actor: Actor, incident: Incident): boolean =>
  canOperateStatus(actor, incident);

/** Resumen de permisos que se envía al frontend para mostrar u ocultar acciones. */
export const incidentPermissions = (actor: Actor, incident: Incident) => ({
  canEdit: canEditIncident(actor, incident),
  canMove: canMoveIncident(actor, incident),
  canAssign: canAssignIncident(actor, incident),
  canComment: canCommentIncident(actor, incident),
  canAttach: canAttachToIncident(actor, incident),
  allowedTransitions: allowedTransitionsFor(actor, incident),
});
export type IncidentPermissions = ReturnType<typeof incidentPermissions>;

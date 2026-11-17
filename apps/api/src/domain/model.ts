/**
 * Modelo de dominio de IncidApp: tipos puros, sin dependencias externas.
 */

export const ROLES = ['ADMIN', 'DIRECCION', 'RESPONSABLE', 'USUARIO'] as const;
export type Role = (typeof ROLES)[number];

export const PRIORITIES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUSES = [
  'ABIERTA',
  'EN_CURSO',
  'PENDIENTE_TERCERO',
  'RESUELTA',
  'CERRADA',
  'RECHAZADA',
] as const;
export type IncidentStatus = (typeof STATUSES)[number];

/** Usuario autenticado que ejecuta una acción. */
export interface Actor {
  id: string;
  role: Role;
  departmentIds: string[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  departmentIds: string[];
  createdAt: Date;
}

export interface Department {
  id: string;
  code: string;
  name: string;
}

export interface IncidentType {
  id: string;
  code: string;
  name: string;
  defaultDepartmentId: string;
}

export interface Incident {
  id: string;
  code: string;
  title: string;
  description: string;
  typeId: string;
  departmentId: string;
  priority: Priority;
  status: IncidentStatus;
  thirdParty: string | null;
  dueDate: string | null; // YYYY-MM-DD
  createdById: string;
  assigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
}

export const EVENT_TYPES = [
  'CREATED',
  'UPDATED',
  'STATUS_CHANGED',
  'ASSIGNED',
  'COMMENT',
  'ATTACHMENT_ADDED',
  'ATTACHMENT_REMOVED',
] as const;
export type IncidentEventType = (typeof EVENT_TYPES)[number];

export interface IncidentEvent {
  id: string;
  incidentId: string;
  actorId: string;
  type: IncidentEventType;
  data: Record<string, unknown>;
  createdAt: Date;
}

export interface Attachment {
  id: string;
  incidentId: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  uploadedById: string;
  createdAt: Date;
}

/** Roles con ámbito global (ven todas las incidencias). */
export const hasGlobalScope = (role: Role): boolean => role === 'ADMIN' || role === 'DIRECCION';

/** Roles que deben pertenecer al menos a un departamento. */
export const requiresDepartment = (role: Role): boolean =>
  role === 'RESPONSABLE' || role === 'USUARIO';

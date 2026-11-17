/**
 * Tipos que reflejan las respuestas reales de la API (apps/api).
 * Las fechas llegan serializadas como cadenas ISO 8601; `dueDate` es `YYYY-MM-DD`.
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

/** Estados que cuentan como "abiertas" (filtro `status=OPEN`). */
export const OPEN_STATUSES: readonly IncidentStatus[] = [
  'ABIERTA',
  'EN_CURSO',
  'PENDIENTE_TERCERO',
];

export type IsoDateTime = string;
/** Fecha sin hora, formato `YYYY-MM-DD`. */
export type IsoDate = string;

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  departmentIds: string[];
  createdAt: IsoDateTime;
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

export interface Catalog {
  departments: Department[];
  types: IncidentType[];
  priorities: Priority[];
  statuses: IncidentStatus[];
  roles: Role[];
  transitions: Record<IncidentStatus, IncidentStatus[]>;
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
  dueDate: IsoDate | null;
  createdById: string;
  assigneeId: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  resolvedAt: IsoDateTime | null;
  closedAt: IsoDateTime | null;
}

/** Incidencia tal y como la devuelven el listado y el detalle (con nombres resueltos). */
export interface IncidentListItem extends Incident {
  typeName: string;
  departmentName: string;
  assigneeName: string | null;
  createdByName: string;
}

export type IncidentSort = 'recent' | 'oldest' | 'priority' | 'due';

export interface IncidentListResponse {
  items: IncidentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IncidentListParams {
  status?: IncidentStatus | 'OPEN';
  typeId?: string;
  departmentId?: string;
  priority?: Priority;
  assignedToMe?: boolean;
  mine?: boolean;
  overdue?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: IncidentSort;
}

export interface FieldChange {
  from: unknown;
  to: unknown;
}

interface EventBase {
  id: string;
  incidentId: string;
  actorId: string;
  actorName: string;
  createdAt: IsoDateTime;
}

export type IncidentEvent = EventBase &
  (
    | { type: 'CREATED'; data: Record<string, never> }
    | { type: 'UPDATED'; data: { changes: Record<string, FieldChange> } }
    | {
        type: 'STATUS_CHANGED';
        data: { from: IncidentStatus; to: IncidentStatus; comment: string | null; reopen: boolean };
      }
    | {
        type: 'ASSIGNED';
        data: {
          from: string | null;
          fromName: string | null;
          to: string | null;
          toName: string | null;
        };
      }
    | { type: 'COMMENT'; data: { text: string } }
    | { type: 'ATTACHMENT_ADDED'; data: { attachmentId: string; filename: string } }
    | { type: 'ATTACHMENT_REMOVED'; data: { attachmentId: string; filename: string } }
  );

export type IncidentEventType = IncidentEvent['type'];

export interface Attachment {
  id: string;
  incidentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedById: string;
  uploadedByName: string;
  createdAt: IsoDateTime;
}

export interface IncidentPermissions {
  canEdit: boolean;
  canMove: boolean;
  canAssign: boolean;
  canComment: boolean;
  canAttach: boolean;
  allowedTransitions: IncidentStatus[];
}

export interface IncidentDetail {
  incident: IncidentListItem;
  events: IncidentEvent[];
  attachments: Attachment[];
  permissions: IncidentPermissions;
}

export interface CreateIncidentInput {
  title: string;
  description: string;
  typeId: string;
  priority: Priority;
  departmentId?: string;
  thirdParty?: string | null;
  dueDate?: IsoDate | null;
}

export type UpdateIncidentInput = Partial<{
  title: string;
  description: string;
  typeId: string;
  priority: Priority;
  departmentId: string;
  thirdParty: string | null;
  dueDate: IsoDate | null;
}>;

export interface AssignableUser {
  id: string;
  name: string;
  role: Role;
}

export interface CountItem {
  key: string;
  count: number;
}

export interface LabeledCountItem extends CountItem {
  label: string;
}

export interface DashboardStats {
  totals: {
    open: number;
    overdue: number;
    criticalOpen: number;
    resolvedLast30: number;
    total: number;
  };
  byStatus: CountItem[];
  byType: LabeledCountItem[];
  byDepartment: LabeledCountItem[];
  /** Solo incidencias abiertas. */
  byPriority: CountItem[];
  avgResolutionHours: number | null;
}

export interface AuditItem {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ip: string | null;
  createdAt: IsoDateTime;
}

export interface AuditResponse {
  items: AuditItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: Role;
  password: string;
  departmentIds: string[];
}

export type UpdateUserInput = Partial<{
  name: string;
  role: Role;
  active: boolean;
  departmentIds: string[];
}>;

export interface ApiErrorBody {
  error: { code: string; message: string };
}

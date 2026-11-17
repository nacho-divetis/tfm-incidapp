import type {
  Attachment,
  Department,
  Incident,
  IncidentEvent,
  IncidentEventType,
  IncidentStatus,
  IncidentType,
  Priority,
  Role,
  User,
} from '../domain/model.js';

/**
 * Puertos (interfaces) que necesitan los casos de uso.
 * La infraestructura los implementa; los tests pueden sustituirlos.
 */

export interface UserWithPassword extends User {
  passwordHash: string;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmailWithPassword(email: string): Promise<UserWithPassword | null>;
  findByIdWithPassword(id: string): Promise<UserWithPassword | null>;
  list(): Promise<User[]>;
  listActiveByDepartment(departmentId: string): Promise<User[]>;
  countActiveAdmins(): Promise<number>;
  create(data: {
    email: string;
    name: string;
    role: Role;
    passwordHash: string;
    departmentIds: string[];
  }): Promise<User>;
  update(
    id: string,
    data: Partial<{ name: string; role: Role; active: boolean; departmentIds: string[] }>,
  ): Promise<User>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
}

export interface CatalogRepository {
  listDepartments(): Promise<Department[]>;
  listIncidentTypes(): Promise<IncidentType[]>;
  findDepartment(id: string): Promise<Department | null>;
  findIncidentType(id: string): Promise<IncidentType | null>;
}

export interface IncidentFilter {
  status?: IncidentStatus[];
  typeId?: string;
  departmentId?: string;
  priority?: Priority;
  assigneeId?: string;
  createdById?: string;
  text?: string;
  /** Solo abiertas con fecha objetivo anterior a esta fecha (AAAA-MM-DD). */
  overdueBefore?: string;
  /** Restricción de ámbito: si se indica, solo estos departamentos. */
  scopeDepartmentIds?: string[];
  page: number;
  pageSize: number;
  sort: 'recent' | 'oldest' | 'priority' | 'due';
}

export interface IncidentListItem extends Incident {
  typeName: string;
  departmentName: string;
  assigneeName: string | null;
  createdByName: string;
}

export interface NewEvent {
  type: IncidentEventType;
  actorId: string;
  data: Record<string, unknown>;
}

export interface IncidentRepository {
  /** Reserva el siguiente número correlativo del año de forma atómica. */
  nextSequence(year: number): Promise<number>;
  findById(id: string): Promise<IncidentListItem | null>;
  list(filter: IncidentFilter): Promise<{ items: IncidentListItem[]; total: number }>;
  /** Inserta la incidencia y sus eventos en una única transacción. */
  create(incident: Incident, events: NewEvent[]): Promise<void>;
  /** Actualiza la incidencia y añade eventos en una única transacción. */
  save(incident: Incident, events: NewEvent[]): Promise<void>;
  addEvent(incidentId: string, event: NewEvent): Promise<void>;
  listEvents(incidentId: string): Promise<(IncidentEvent & { actorName: string })[]>;
}

export interface AttachmentRepository {
  findById(id: string): Promise<Attachment | null>;
  listByIncident(incidentId: string): Promise<(Attachment & { uploadedByName: string })[]>;
  create(attachment: Attachment): Promise<void>;
  delete(id: string): Promise<void>;
}

/** Almacenamiento binario de adjuntos (BD, disco, nube…). */
export interface FileStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ip?: string | null;
}

export interface AuditLogger {
  log(entry: AuditEntry): Promise<void>;
  list(
    page: number,
    pageSize: number,
  ): Promise<{
    items: (AuditEntry & { id: string; actorName: string | null; createdAt: Date })[];
    total: number;
  }>;
}

export interface DashboardStats {
  totals: {
    open: number;
    overdue: number;
    criticalOpen: number;
    resolvedLast30: number;
    total: number;
  };
  byStatus: { key: string; count: number }[];
  byType: { key: string; label: string; count: number }[];
  byDepartment: { key: string; label: string; count: number }[];
  byPriority: { key: string; count: number }[];
  avgResolutionHours: number | null;
}

export interface DashboardQuery {
  stats(scopeDepartmentIds: string[] | undefined, today: string): Promise<DashboardStats>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

/** Contexto de la petición que acompaña a cada caso de uso. */
export interface RequestContext {
  ip?: string | null;
}

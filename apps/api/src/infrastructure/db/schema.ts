import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => 'bytea',
  fromDriver: (v) => (Buffer.isBuffer(v) ? v : Buffer.from(v)),
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['ADMIN', 'DIRECCION', 'RESPONSABLE', 'USUARIO'] }).notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const userDepartments = pgTable(
  'user_departments',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.departmentId] })],
);

export const incidentTypes = pgTable('incident_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  defaultDepartmentId: uuid('default_department_id')
    .notNull()
    .references(() => departments.id),
});

export const incidents = pgTable(
  'incidents',
  {
    id: uuid('id').primaryKey(),
    code: text('code').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    typeId: uuid('type_id')
      .notNull()
      .references(() => incidentTypes.id),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id),
    priority: text('priority', { enum: ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] }).notNull(),
    status: text('status', {
      enum: ['ABIERTA', 'EN_CURSO', 'PENDIENTE_TERCERO', 'RESUELTA', 'CERRADA', 'RECHAZADA'],
    }).notNull(),
    thirdParty: text('third_party'),
    dueDate: date('due_date', { mode: 'string' }),
    createdById: uuid('created_by')
      .notNull()
      .references(() => users.id),
    assigneeId: uuid('assignee_id').references(() => users.id),
    createdAt: ts('created_at').notNull(),
    updatedAt: ts('updated_at').notNull(),
    resolvedAt: ts('resolved_at'),
    closedAt: ts('closed_at'),
  },
  (t) => [
    index('incidents_department_idx').on(t.departmentId),
    index('incidents_status_idx').on(t.status),
    index('incidents_assignee_idx').on(t.assigneeId),
    index('incidents_created_idx').on(t.createdAt),
  ],
);

export const incidentEvents = pgTable(
  'incident_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    type: text('type').notNull(),
    data: jsonb('data')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('incident_events_incident_idx').on(t.incidentId, t.createdAt)],
);

export const incidentCounters = pgTable('incident_counters', {
  year: integer('year').primaryKey(),
  last: integer('last').notNull(),
});

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    storageKey: text('storage_key').notNull(),
    uploadedById: uuid('uploaded_by')
      .notNull()
      .references(() => users.id),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('attachments_incident_idx').on(t.incidentId)],
);

export const fileBlobs = pgTable('file_blobs', {
  key: text('key').primaryKey(),
  data: bytea('data').notNull(),
});

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entity: text('entity'),
    entityId: text('entity_id'),
    details: jsonb('details').$type<Record<string, unknown>>(),
    ip: text('ip'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('audit_log_created_idx').on(t.createdAt)],
);

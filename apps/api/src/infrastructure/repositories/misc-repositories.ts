import { asc, desc, eq, sql } from 'drizzle-orm';
import type {
  AttachmentRepository,
  AuditEntry,
  AuditLogger,
  DashboardQuery,
  DashboardStats,
  FileStorage,
} from '../../application/ports.js';
import type { Attachment } from '../../domain/model.js';
import { OPEN_STATUSES } from '../../domain/incident-status.js';
import type { Db } from '../db/client.js';
import {
  attachments,
  auditLog,
  departments,
  fileBlobs,
  incidents,
  incidentTypes,
  users,
} from '../db/schema.js';

export class DrizzleAttachmentRepository implements AttachmentRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string) {
    const [row] = await this.db.select().from(attachments).where(eq(attachments.id, id));
    return row ?? null;
  }

  async listByIncident(incidentId: string) {
    const rows = await this.db
      .select({ a: attachments, uploadedByName: users.name })
      .from(attachments)
      .innerJoin(users, eq(users.id, attachments.uploadedById))
      .where(eq(attachments.incidentId, incidentId))
      .orderBy(asc(attachments.createdAt));
    return rows.map((r) => ({ ...r.a, uploadedByName: r.uploadedByName }));
  }

  async create(a: Attachment) {
    await this.db.insert(attachments).values(a);
  }

  async delete(id: string) {
    await this.db.delete(attachments).where(eq(attachments.id, id));
  }
}

/** Adjuntos guardados en la propia base de datos (bytea): portable y sin volúmenes. */
export class DatabaseFileStorage implements FileStorage {
  constructor(private readonly db: Db) {}

  async put(key: string, data: Buffer) {
    await this.db
      .insert(fileBlobs)
      .values({ key, data })
      .onConflictDoUpdate({ target: fileBlobs.key, set: { data } });
  }

  async get(key: string) {
    const [row] = await this.db.select().from(fileBlobs).where(eq(fileBlobs.key, key));
    return row ? row.data : null;
  }

  async delete(key: string) {
    await this.db.delete(fileBlobs).where(eq(fileBlobs.key, key));
  }
}

export class DrizzleAuditLogger implements AuditLogger {
  constructor(private readonly db: Db) {}

  async log(e: AuditEntry) {
    await this.db.insert(auditLog).values({
      actorId: e.actorId,
      action: e.action,
      entity: e.entity ?? null,
      entityId: e.entityId ?? null,
      details: e.details ?? null,
      ip: e.ip ?? null,
    });
  }

  async list(page: number, pageSize: number) {
    const [rows, [count]] = await Promise.all([
      this.db
        .select({ log: auditLog, actorName: users.name })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.actorId))
        .orderBy(desc(auditLog.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ n: sql<number>`count(*)::int` }).from(auditLog),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.log.id,
        actorId: r.log.actorId,
        actorName: r.actorName,
        action: r.log.action,
        entity: r.log.entity ?? undefined,
        entityId: r.log.entityId ?? undefined,
        details: r.log.details ?? undefined,
        ip: r.log.ip,
        createdAt: r.log.createdAt,
      })),
      total: Number(count?.n ?? 0),
    };
  }
}

export class DrizzleDashboardQuery implements DashboardQuery {
  constructor(private readonly db: Db) {}

  async stats(scope: string[] | undefined, today: string): Promise<DashboardStats> {
    if (scope && scope.length === 0) {
      return {
        totals: { open: 0, overdue: 0, criticalOpen: 0, resolvedLast30: 0, total: 0 },
        byStatus: [],
        byType: [],
        byDepartment: [],
        byPriority: [],
        avgResolutionHours: null,
      };
    }
    const scopeSql = scope
      ? sql`${incidents.departmentId} in (${sql.join(
          scope.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql`true`;
    const openList = sql.join(
      OPEN_STATUSES.map((s) => sql`${s}`),
      sql`, `,
    );
    const isOpen = sql`${incidents.status} in (${openList})`;

    const [[totals], byStatus, byType, byDepartment, byPriority] = await Promise.all([
      this.db
        .select({
          total: sql<number>`count(*)::int`,
          open: sql<number>`count(*) filter (where ${isOpen})::int`,
          overdue: sql<number>`count(*) filter (where ${isOpen} and ${incidents.dueDate} < ${today})::int`,
          criticalOpen: sql<number>`count(*) filter (where ${isOpen} and ${incidents.priority} = 'CRITICA')::int`,
          resolvedLast30: sql<number>`count(*) filter (where ${incidents.resolvedAt} >= now() - interval '30 days')::int`,
          avgHours: sql<
            number | null
          >`avg(extract(epoch from (${incidents.resolvedAt} - ${incidents.createdAt})) / 3600) filter (where ${incidents.resolvedAt} is not null)`,
        })
        .from(incidents)
        .where(scopeSql),
      this.db
        .select({ key: incidents.status, count: sql<number>`count(*)::int` })
        .from(incidents)
        .where(scopeSql)
        .groupBy(incidents.status),
      this.db
        .select({
          key: incidentTypes.code,
          label: incidentTypes.name,
          count: sql<number>`count(*)::int`,
        })
        .from(incidents)
        .innerJoin(incidentTypes, eq(incidentTypes.id, incidents.typeId))
        .where(scopeSql)
        .groupBy(incidentTypes.code, incidentTypes.name)
        .orderBy(desc(sql`count(*)`)),
      this.db
        .select({
          key: departments.code,
          label: departments.name,
          count: sql<number>`count(*)::int`,
        })
        .from(incidents)
        .innerJoin(departments, eq(departments.id, incidents.departmentId))
        .where(scopeSql)
        .groupBy(departments.code, departments.name)
        .orderBy(desc(sql`count(*)`)),
      this.db
        .select({ key: incidents.priority, count: sql<number>`count(*)::int` })
        .from(incidents)
        .where(sql`${scopeSql} and ${isOpen}`)
        .groupBy(incidents.priority),
    ]);

    const avg = totals?.avgHours == null ? null : Math.round(Number(totals.avgHours) * 10) / 10;
    return {
      totals: {
        open: Number(totals?.open ?? 0),
        overdue: Number(totals?.overdue ?? 0),
        criticalOpen: Number(totals?.criticalOpen ?? 0),
        resolvedLast30: Number(totals?.resolvedLast30 ?? 0),
        total: Number(totals?.total ?? 0),
      },
      byStatus: byStatus.map((r) => ({ key: r.key, count: Number(r.count) })),
      byType: byType.map((r) => ({ ...r, count: Number(r.count) })),
      byDepartment: byDepartment.map((r) => ({ ...r, count: Number(r.count) })),
      byPriority: byPriority.map((r) => ({ key: r.key, count: Number(r.count) })),
      avgResolutionHours: avg,
    };
  }
}

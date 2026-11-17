import {
  aliasedTable,
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  lt,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { OPEN_STATUSES } from '../../domain/incident-status.js';
import type {
  Incident,
  IncidentEvent,
  IncidentEventType,
  IncidentStatus,
  Priority,
} from '../../domain/model.js';
import type {
  IncidentFilter,
  IncidentListItem,
  IncidentRepository,
  NewEvent,
} from '../../application/ports.js';
import type { Db } from '../db/client.js';
import {
  departments,
  incidentCounters,
  incidentEvents,
  incidents,
  incidentTypes,
  users,
} from '../db/schema.js';

const assignee = aliasedTable(users, 'assignee');
const creator = aliasedTable(users, 'creator');

/** Escapa los comodines de LIKE para que el texto del usuario se busque literalmente. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const priorityOrder = sql`case ${incidents.priority} when 'CRITICA' then 0 when 'ALTA' then 1 when 'MEDIA' then 2 else 3 end`;

export class DrizzleIncidentRepository implements IncidentRepository {
  constructor(private readonly db: Db) {}

  async nextSequence(year: number): Promise<number> {
    // UPSERT atómico: evita códigos duplicados con peticiones concurrentes.
    const [row] = await this.db
      .insert(incidentCounters)
      .values({ year, last: 1 })
      .onConflictDoUpdate({
        target: incidentCounters.year,
        set: { last: sql`${incidentCounters.last} + 1` },
      })
      .returning({ last: incidentCounters.last });
    return row!.last;
  }

  private baseSelect() {
    return this.db
      .select({
        incident: incidents,
        typeName: incidentTypes.name,
        departmentName: departments.name,
        assigneeName: assignee.name,
        createdByName: creator.name,
      })
      .from(incidents)
      .innerJoin(incidentTypes, eq(incidentTypes.id, incidents.typeId))
      .innerJoin(departments, eq(departments.id, incidents.departmentId))
      .innerJoin(creator, eq(creator.id, incidents.createdById))
      .leftJoin(assignee, eq(assignee.id, incidents.assigneeId));
  }

  private toItem(row: {
    incident: typeof incidents.$inferSelect;
    typeName: string;
    departmentName: string;
    assigneeName: string | null;
    createdByName: string;
  }): IncidentListItem {
    return {
      ...row.incident,
      priority: row.incident.priority as Priority,
      status: row.incident.status as IncidentStatus,
      typeName: row.typeName,
      departmentName: row.departmentName,
      assigneeName: row.assigneeName,
      createdByName: row.createdByName,
    };
  }

  async findById(id: string) {
    const [row] = await this.baseSelect().where(eq(incidents.id, id));
    return row ? this.toItem(row) : null;
  }

  async list(f: IncidentFilter) {
    const conds: SQL[] = [];
    if (f.scopeDepartmentIds) {
      if (f.scopeDepartmentIds.length === 0) return { items: [], total: 0 };
      conds.push(inArray(incidents.departmentId, f.scopeDepartmentIds));
    }
    if (f.status?.length) conds.push(inArray(incidents.status, f.status));
    if (f.typeId) conds.push(eq(incidents.typeId, f.typeId));
    if (f.departmentId) conds.push(eq(incidents.departmentId, f.departmentId));
    if (f.priority) conds.push(eq(incidents.priority, f.priority));
    if (f.assigneeId) conds.push(eq(incidents.assigneeId, f.assigneeId));
    if (f.createdById) conds.push(eq(incidents.createdById, f.createdById));
    if (f.overdueBefore) {
      conds.push(inArray(incidents.status, [...OPEN_STATUSES]));
      conds.push(lt(incidents.dueDate, f.overdueBefore));
    }
    if (f.text) {
      const like = `%${escapeLike(f.text)}%`;
      conds.push(
        or(
          ilike(incidents.code, like),
          ilike(incidents.title, like),
          ilike(incidents.thirdParty, like),
          ilike(incidents.description, like),
        )!,
      );
    }
    const where = conds.length ? and(...conds) : undefined;

    const orderBy =
      f.sort === 'oldest'
        ? [asc(incidents.createdAt)]
        : f.sort === 'priority'
          ? [asc(priorityOrder), desc(incidents.createdAt)]
          : f.sort === 'due'
            ? [sql`${incidents.dueDate} asc nulls last`, desc(incidents.createdAt)]
            : [desc(incidents.createdAt)];

    const [rows, [count]] = await Promise.all([
      this.baseSelect()
        .where(where)
        .orderBy(...orderBy)
        .limit(f.pageSize)
        .offset((f.page - 1) * f.pageSize),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(incidents)
        .where(where),
    ]);
    return { items: rows.map((r) => this.toItem(r)), total: Number(count?.n ?? 0) };
  }

  private columns(i: Incident): typeof incidents.$inferInsert {
    return {
      id: i.id,
      code: i.code,
      title: i.title,
      description: i.description,
      typeId: i.typeId,
      departmentId: i.departmentId,
      priority: i.priority,
      status: i.status,
      thirdParty: i.thirdParty,
      dueDate: i.dueDate,
      createdById: i.createdById,
      assigneeId: i.assigneeId,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      resolvedAt: i.resolvedAt,
      closedAt: i.closedAt,
    };
  }

  private eventRows(incidentId: string, events: NewEvent[], at: Date) {
    // Separación de 1 ms entre eventos de la misma operación para conservar el orden.
    return events.map((e, idx) => ({
      incidentId,
      actorId: e.actorId,
      type: e.type,
      data: e.data,
      createdAt: new Date(at.getTime() + idx),
    }));
  }

  async create(incident: Incident, events: NewEvent[]) {
    await this.db.transaction(async (tx) => {
      await tx.insert(incidents).values(this.columns(incident));
      if (events.length)
        await tx
          .insert(incidentEvents)
          .values(this.eventRows(incident.id, events, incident.createdAt));
    });
  }

  async save(incident: Incident, events: NewEvent[]) {
    const {
      id: _id,
      code: _code,
      createdAt: _c,
      createdById: _cb,
      ...changes
    } = this.columns(incident);
    await this.db.transaction(async (tx) => {
      await tx.update(incidents).set(changes).where(eq(incidents.id, incident.id));
      if (events.length)
        await tx
          .insert(incidentEvents)
          .values(this.eventRows(incident.id, events, incident.updatedAt));
    });
  }

  async addEvent(incidentId: string, event: NewEvent) {
    await this.db.insert(incidentEvents).values(this.eventRows(incidentId, [event], new Date()));
  }

  async listEvents(incidentId: string) {
    const rows = await this.db
      .select({ event: incidentEvents, actorName: users.name })
      .from(incidentEvents)
      .innerJoin(users, eq(users.id, incidentEvents.actorId))
      .where(eq(incidentEvents.incidentId, incidentId))
      .orderBy(asc(incidentEvents.createdAt));
    return rows.map((r): IncidentEvent & { actorName: string } => ({
      ...r.event,
      type: r.event.type as IncidentEventType,
      actorName: r.actorName,
    }));
  }
}

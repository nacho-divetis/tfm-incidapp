import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Role, User } from '../../domain/model.js';
import type { UserRepository, UserWithPassword } from '../../application/ports.js';
import type { Db } from '../db/client.js';
import { userDepartments, users } from '../db/schema.js';

type UserRow = typeof users.$inferSelect;

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Db) {}

  private async withDepartments(rows: UserRow[]): Promise<UserWithPassword[]> {
    if (rows.length === 0) return [];
    const links = await this.db
      .select()
      .from(userDepartments)
      .where(
        inArray(
          userDepartments.userId,
          rows.map((r) => r.id),
        ),
      );
    return rows.map((r) => ({
      ...r,
      role: r.role as Role,
      departmentIds: links.filter((l) => l.userId === r.id).map((l) => l.departmentId),
    }));
  }

  private strip(u: UserWithPassword): User {
    const { passwordHash: _p, ...rest } = u;
    return rest;
  }

  async findByIdWithPassword(id: string) {
    const rows = await this.db.select().from(users).where(eq(users.id, id));
    return (await this.withDepartments(rows))[0] ?? null;
  }

  async findById(id: string) {
    const u = await this.findByIdWithPassword(id);
    return u ? this.strip(u) : null;
  }

  async findByEmailWithPassword(email: string) {
    const rows = await this.db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return (await this.withDepartments(rows))[0] ?? null;
  }

  async list() {
    const rows = await this.db.select().from(users).orderBy(asc(users.name));
    return (await this.withDepartments(rows)).map((u) => this.strip(u));
  }

  async listActiveByDepartment(departmentId: string) {
    const rows = await this.db
      .select({ user: users })
      .from(users)
      .innerJoin(userDepartments, eq(userDepartments.userId, users.id))
      .where(and(eq(userDepartments.departmentId, departmentId), eq(users.active, true)))
      .orderBy(asc(users.name));
    return (await this.withDepartments(rows.map((r) => r.user))).map((u) => this.strip(u));
  }

  async countActiveAdmins() {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, 'ADMIN'), eq(users.active, true)));
    return Number(row?.n ?? 0);
  }

  async create(data: {
    email: string;
    name: string;
    role: Role;
    passwordHash: string;
    departmentIds: string[];
  }) {
    const id = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({
          email: data.email.toLowerCase(),
          name: data.name,
          role: data.role,
          passwordHash: data.passwordHash,
        })
        .returning({ id: users.id });
      if (!row) throw new Error('No se pudo crear el usuario');
      if (data.departmentIds.length) {
        await tx
          .insert(userDepartments)
          .values(data.departmentIds.map((departmentId) => ({ userId: row.id, departmentId })));
      }
      return row.id;
    });
    return (await this.findById(id))!;
  }

  async update(
    id: string,
    data: Partial<{ name: string; role: Role; active: boolean; departmentIds: string[] }>,
  ) {
    const { departmentIds, ...fields } = data;
    await this.db.transaction(async (tx) => {
      if (Object.keys(fields).length) await tx.update(users).set(fields).where(eq(users.id, id));
      if (departmentIds) {
        await tx.delete(userDepartments).where(eq(userDepartments.userId, id));
        if (departmentIds.length) {
          await tx
            .insert(userDepartments)
            .values(departmentIds.map((departmentId) => ({ userId: id, departmentId })));
        }
      }
    });
    return (await this.findById(id))!;
  }

  async updatePassword(id: string, passwordHash: string) {
    await this.db.update(users).set({ passwordHash }).where(eq(users.id, id));
  }
}

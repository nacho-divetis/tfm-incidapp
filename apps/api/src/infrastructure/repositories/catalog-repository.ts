import { asc, eq } from 'drizzle-orm';
import type { CatalogRepository } from '../../application/ports.js';
import type { Db } from '../db/client.js';
import { departments, incidentTypes } from '../db/schema.js';

export class DrizzleCatalogRepository implements CatalogRepository {
  constructor(private readonly db: Db) {}

  listDepartments() {
    return this.db.select().from(departments).orderBy(asc(departments.name));
  }

  listIncidentTypes() {
    return this.db.select().from(incidentTypes).orderBy(asc(incidentTypes.name));
  }

  async findDepartment(id: string) {
    const [row] = await this.db.select().from(departments).where(eq(departments.id, id));
    return row ?? null;
  }

  async findIncidentType(id: string) {
    const [row] = await this.db.select().from(incidentTypes).where(eq(incidentTypes.id, id));
    return row ?? null;
  }
}

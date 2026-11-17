import type { AppConfig } from '../config.js';
import type { Db } from '../infrastructure/db/client.js';
import { countUsers, seedCatalog, seedDemoData, settableClock } from '../infrastructure/db/seed.js';
import { buildDeps } from './container.js';

/**
 * Prepara la base de datos al arrancar:
 *  1. Catálogos (departamentos y tipos), siempre de forma idempotente.
 *  2. Si no hay usuarios: datos de demostración (SEED_DEMO=true) o un administrador inicial (ADMIN_EMAIL/ADMIN_PASSWORD).
 */
export async function bootstrapDatabase(
  db: Db,
  config: Pick<AppConfig, 'seedDemo' | 'bootstrapAdmin'>,
) {
  await seedCatalog(db);
  if ((await countUsers(db)) > 0) return { seeded: false as const };

  if (config.seedDemo) {
    const clock = settableClock();
    const result = await seedDemoData(db, buildDeps(db, { clock }), clock);
    return { seeded: 'demo' as const, ...result };
  }
  if (config.bootstrapAdmin) {
    const deps = buildDeps(db);
    await deps.users.create({
      email: config.bootstrapAdmin.email.toLowerCase(),
      name: config.bootstrapAdmin.name,
      role: 'ADMIN',
      passwordHash: await deps.hasher.hash(config.bootstrapAdmin.password),
      departmentIds: [],
    });
    return { seeded: 'admin' as const };
  }
  return { seeded: false as const };
}

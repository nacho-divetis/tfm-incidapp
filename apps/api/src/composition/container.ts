import { randomUUID } from 'node:crypto';
import type { Deps } from '../application/deps.js';
import type { Clock, PasswordHasher } from '../application/ports.js';
import type { Db } from '../infrastructure/db/client.js';
import { DrizzleCatalogRepository } from '../infrastructure/repositories/catalog-repository.js';
import { DrizzleIncidentRepository } from '../infrastructure/repositories/incident-repository.js';
import {
  DatabaseFileStorage,
  DrizzleAttachmentRepository,
  DrizzleAuditLogger,
  DrizzleDashboardQuery,
} from '../infrastructure/repositories/misc-repositories.js';
import { DrizzleUserRepository } from '../infrastructure/repositories/user-repository.js';
import { ScryptPasswordHasher } from '../infrastructure/security/scrypt-hasher.js';

/**
 * Composition root: el único lugar que conoce las implementaciones concretas.
 * Cambiar de almacenamiento o de base de datos solo afecta a este archivo.
 */
export function buildDeps(
  db: Db,
  overrides: Partial<{ hasher: PasswordHasher; clock: Clock }> = {},
): Deps {
  return {
    users: new DrizzleUserRepository(db),
    catalog: new DrizzleCatalogRepository(db),
    incidents: new DrizzleIncidentRepository(db),
    attachments: new DrizzleAttachmentRepository(db),
    storage: new DatabaseFileStorage(db),
    audit: new DrizzleAuditLogger(db),
    dashboard: new DrizzleDashboardQuery(db),
    hasher: overrides.hasher ?? new ScryptPasswordHasher(),
    clock: overrides.clock ?? { now: () => new Date() },
    ids: { next: () => randomUUID() },
  };
}

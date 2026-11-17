import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from './schema.js';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DbHandle {
  db: Db;
  kind: 'postgres' | 'pglite';
  close(): Promise<void>;
}

const here = path.dirname(fileURLToPath(import.meta.url));
/** Carpeta de migraciones SQL generadas por drizzle-kit (apps/api/drizzle). */
export const MIGRATIONS_DIR = path.resolve(here, '../../../drizzle');

/**
 * Traduce el `sslmode` de la URL a la opción `ssl` de node-postgres.
 * Con cualquier modo distinto de `disable` se exige TLS verificando el certificado del servidor
 * (proveedores gestionados como Neon usan certificados públicos válidos).
 */
export function postgresConnection(url: string): pg.PoolConfig {
  const parsed = new URL(url);
  const sslmode = parsed.searchParams.get('sslmode');
  parsed.searchParams.delete('sslmode');
  const ssl = sslmode && sslmode !== 'disable' ? { rejectUnauthorized: true } : undefined;
  return { connectionString: parsed.toString(), ssl };
}

/**
 * Abre la base de datos:
 *  - `postgres://...` → PostgreSQL real (producción).
 *  - `memory://`      → PGlite en memoria (tests).
 *  - ruta o vacío     → PGlite persistente en disco (desarrollo, sin instalar nada).
 * Aplica las migraciones pendientes al arrancar.
 */
export async function openDatabase(url: string | undefined): Promise<DbHandle> {
  if (url && /^postgres(ql)?:\/\//.test(url)) {
    const pool = new pg.Pool({ ...postgresConnection(url), max: 10 });
    const db = drizzlePg({ client: pool, schema });
    await migratePg(db, { migrationsFolder: MIGRATIONS_DIR });
    return { db: db as unknown as Db, kind: 'postgres', close: () => pool.end() };
  }

  let client: PGlite;
  if (url === 'memory://') {
    client = await PGlite.create();
  } else {
    const dataDir = path.resolve(url || 'data/pgdata');
    mkdirSync(dataDir, { recursive: true });
    client = await PGlite.create(dataDir);
  }
  const db = drizzlePglite({ client, schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS_DIR });
  return { db: db as unknown as Db, kind: 'pglite', close: () => client.close() };
}

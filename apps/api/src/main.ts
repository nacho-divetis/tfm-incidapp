import { bootstrapDatabase } from './composition/bootstrap.js';
import { buildDeps } from './composition/container.js';
import { loadConfig } from './config.js';
import { openDatabase } from './infrastructure/db/client.js';
import { buildServer } from './infrastructure/http/server.js';

const config = loadConfig();
const database = await openDatabase(config.databaseUrl);
const seed = await bootstrapDatabase(database.db, config);

const app = await buildServer(buildDeps(database.db), config);
app.log.info({ db: database.kind, seed, web: config.webDist ?? 'no servido' }, 'IncidApp iniciada');

const shutdown = async (signal: string) => {
  app.log.info(`${signal} recibido, cerrando…`);
  await app.close();
  await database.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ port: config.port, host: '0.0.0.0' });

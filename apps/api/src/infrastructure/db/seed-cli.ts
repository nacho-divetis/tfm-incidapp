/**
 * Carga manual de datos demo: `npm run db:seed`.
 * Solo actúa si la base de datos no tiene usuarios.
 */
import { bootstrapDatabase } from '../../composition/bootstrap.js';
import { loadConfig } from '../../config.js';
import { openDatabase } from './client.js';

const config = loadConfig();
const handle = await openDatabase(config.databaseUrl);
const result = await bootstrapDatabase(handle.db, { ...config, seedDemo: true });
console.log(
  result.seeded
    ? `Datos cargados: ${JSON.stringify(result)}`
    : 'La BD ya tenía usuarios: no se ha cargado nada.',
);
await handle.close();

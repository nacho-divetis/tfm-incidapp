import type { FastifyInstance } from 'fastify';
import { bootstrapDatabase } from '../../src/composition/bootstrap.js';
import { buildDeps } from '../../src/composition/container.js';
import { loadConfig } from '../../src/config.js';
import { openDatabase, type DbHandle } from '../../src/infrastructure/db/client.js';
import { DEMO_PASSWORD } from '../../src/infrastructure/db/seed.js';
import { buildServer, SESSION_COOKIE } from '../../src/infrastructure/http/server.js';

export interface TestApp {
  app: FastifyInstance;
  handle: DbHandle;
  login(alias: string): Promise<string>;
  close(): Promise<void>;
}

/** Levanta la API completa sobre PGlite en memoria con los datos demo. */
export async function createTestApp(): Promise<TestApp> {
  const config = loadConfig({ NODE_ENV: 'test', SEED_DEMO: 'true', WEB_DIST: '/nonexistent' });
  const handle = await openDatabase('memory://');
  await bootstrapDatabase(handle.db, config);
  const app = await buildServer(buildDeps(handle.db), config);
  await app.ready();

  const cookies = new Map<string, string>();
  let ipCounter = 0;
  return {
    app,
    handle,
    async login(alias: string) {
      const cached = cookies.get(alias);
      if (cached) return cached;
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        // IP distinta por usuario para no activar el límite de intentos de login.
        remoteAddress: `10.1.0.${++ipCounter}`,
        payload: { email: `${alias}@incidapp.demo`, password: DEMO_PASSWORD },
      });
      if (res.statusCode !== 200) throw new Error(`Login ${alias} falló: ${res.body}`);
      const cookie = res.cookies.find((c) => c.name === SESSION_COOKIE);
      if (!cookie) throw new Error('Sin cookie de sesión');
      const header = `${SESSION_COOKIE}=${cookie.value}`;
      cookies.set(alias, header);
      return header;
    },
    async close() {
      await app.close();
      await handle.close();
    },
  };
}

/** Construye un cuerpo multipart/form-data con un único archivo. */
export function multipartFile(
  filename: string,
  data: Buffer,
  contentType = 'application/octet-stream',
) {
  const boundary = '----incidapp-test-boundary';
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, data, tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

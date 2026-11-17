import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface AppConfig {
  port: number;
  env: 'development' | 'production' | 'test';
  jwtSecret: string;
  databaseUrl: string | undefined;
  seedDemo: boolean;
  secureCookies: boolean;
  /** Carpeta con el frontend compilado (si existe, la API lo sirve). */
  webDist: string | null;
  bootstrapAdmin: { email: string; password: string; name: string } | null;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const DEV_SECRET = 'dev-only-secret-change-me-in-production-0000';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = (env.NODE_ENV as AppConfig['env']) || 'development';
  const isProd = nodeEnv === 'production';

  const jwtSecret = env.JWT_SECRET || (isProd ? '' : DEV_SECRET);
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET es obligatorio y debe tener al menos 32 caracteres');
  }

  const candidate = env.WEB_DIST
    ? path.resolve(env.WEB_DIST)
    : path.resolve(here, '../../web/dist');
  const webDist = existsSync(path.join(candidate, 'index.html')) ? candidate : null;

  return {
    port: Number(env.PORT) || 3000,
    env: nodeEnv,
    jwtSecret,
    databaseUrl: env.DATABASE_URL || undefined,
    seedDemo: (env.SEED_DEMO ?? 'true') === 'true',
    secureCookies: isProd && env.INSECURE_COOKIES !== 'true',
    webDist,
    bootstrapAdmin:
      env.ADMIN_EMAIL && env.ADMIN_PASSWORD
        ? {
            email: env.ADMIN_EMAIL,
            password: env.ADMIN_PASSWORD,
            name: env.ADMIN_NAME || 'Administrador',
          }
        : null,
  };
}

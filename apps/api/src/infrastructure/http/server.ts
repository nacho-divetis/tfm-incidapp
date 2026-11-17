import { readFileSync } from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import type { Deps } from '../../application/deps.js';
import { resolveActor } from '../../application/use-cases/auth.js';
import { DomainError, type DomainErrorCode } from '../../domain/errors.js';
import { MAX_ATTACHMENT_BYTES } from '../../domain/files.js';
import type { Actor, User } from '../../domain/model.js';
import type { AppConfig } from '../../config.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerIncidentRoutes } from './routes/incidents.js';

declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor;
    currentUser: User;
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    deps: Deps;
    config: AppConfig;
  }
}

export const SESSION_COOKIE = 'incidapp_session';
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_TRANSITION: 409,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE: 415,
};

export async function buildServer(deps: Deps, config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      config.env === 'test'
        ? false
        : {
            level: config.env === 'production' ? 'info' : 'debug',
            redact: ['req.headers.cookie', 'req.headers.authorization'],
          },
    trustProxy: config.env === 'production',
    bodyLimit: 1024 * 1024,
    // `/api/health/` y `/api/health` son la misma ruta (chequeos de salud de la plataforma de despliegue).
    routerOptions: { ignoreTrailingSlash: true },
  });

  app.decorate('deps', deps);
  app.decorate('config', config);
  app.decorateRequest('actor', null as unknown as Actor);
  app.decorateRequest('currentUser', null as unknown as User);

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        frameSrc: ["'self'"],
        objectSrc: ["'self'"],
        frameAncestors: ["'self'"],
        // Solo forzar HTTPS cuando la app se sirve con HTTPS (producción); en HTTP de red local rompería la carga.
        upgradeInsecureRequests: config.secureCookies ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(cookie);
  await app.register(jwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: SESSION_COOKIE, signed: false },
    sign: { expiresIn: SESSION_TTL_SECONDS },
  });
  await app.register(rateLimit, { global: false });
  await app.register(multipart, {
    limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1, fields: 5 },
  });

  /** Guarda de autenticación: verifica el JWT de la cookie y recarga el usuario. */
  app.decorate('authenticate', async (req: FastifyRequest) => {
    let payload: { sub?: string };
    try {
      payload = await req.jwtVerify<{ sub: string }>();
    } catch {
      throw new DomainError('UNAUTHORIZED', 'Sesión no válida o caducada');
    }
    if (!payload.sub) throw new DomainError('UNAUTHORIZED', 'Sesión no válida');
    const { actor, user } = await resolveActor(deps, payload.sub);
    req.actor = actor;
    req.currentUser = user;
  });

  app.setErrorHandler((error, req, reply) => {
    if (error instanceof DomainError) {
      return reply
        .status(STATUS_BY_CODE[error.code])
        .send({ error: { code: error.code, message: error.message } });
    }
    const err = error as { code?: string; statusCode?: number; message: string };
    if (err.code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.status(413).send({
        error: { code: 'FILE_TOO_LARGE', message: 'El archivo supera el tamaño máximo de 5 MB' },
      });
    }
    if (err.statusCode === 429) {
      return reply.status(429).send({
        error: { code: 'RATE_LIMITED', message: 'Demasiados intentos. Espera un minuto.' },
      });
    }
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return reply
        .status(err.statusCode)
        .send({ error: { code: 'BAD_REQUEST', message: err.message } });
    }
    req.log.error(error);
    // Nunca se envían detalles internos al cliente (OWASP A05).
    return reply
      .status(500)
      .send({ error: { code: 'INTERNAL', message: 'Error interno del servidor' } });
  });

  await app.register(
    async (api) => {
      api.get('/health', async () => ({ status: 'ok' }));
      await registerAuthRoutes(api);
      await registerIncidentRoutes(api);
      await registerAdminRoutes(api);
    },
    { prefix: '/api' },
  );

  // Frontend compilado (SPA) servido por la misma aplicación: mismo origen, cookies sameSite=strict.
  if (config.webDist) {
    const indexPath = path.join(config.webDist, 'index.html');
    // En producción se cachea; en desarrollo se relee para reflejar nuevos builds sin reiniciar.
    const cachedIndex = readFileSync(indexPath, 'utf8');
    const indexHtml = () =>
      config.env === 'production' ? cachedIndex : readFileSync(indexPath, 'utf8');
    await app.register(fastifyStatic, { root: config.webDist, wildcard: false, index: false });
    app.get('/', (_req, reply) => reply.type('text/html').send(indexHtml()));
    app.setNotFoundHandler((req, reply) => {
      const isPageRequest = req.method === 'GET' || req.method === 'HEAD';
      if (req.url.startsWith('/api/') || !isPageRequest) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } });
      }
      return reply.type('text/html').send(indexHtml());
    });
  } else {
    app.setNotFoundHandler((_req, reply) =>
      reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } }),
    );
  }

  return app;
}

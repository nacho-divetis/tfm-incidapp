import type { FastifyInstance } from 'fastify';
import { changeOwnPassword, login } from '../../../application/use-cases/auth.js';
import { getCatalog } from '../../../application/use-cases/queries.js';
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from '../server.js';

export async function registerAuthRoutes(api: FastifyInstance) {
  const { deps } = api;

  api.post(
    '/auth/login',
    // HU-01 CA4: máximo 10 intentos por minuto y por IP.
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const user = await login(deps, req.body, { ip: req.ip });
      const token = await reply.jwtSign({ sub: user.id });
      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: api.config.secureCookies,
        path: '/',
        maxAge: SESSION_TTL_SECONDS,
      });
      return { user };
    },
  );

  api.post('/auth/logout', async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  api.get('/auth/me', { preHandler: api.authenticate }, async (req) => ({ user: req.currentUser }));

  api.post('/auth/password', { preHandler: api.authenticate }, async (req) => {
    await changeOwnPassword(deps, req.actor, req.body, { ip: req.ip });
    return { ok: true };
  });

  api.get('/catalog', { preHandler: api.authenticate }, async () => getCatalog(deps));
}

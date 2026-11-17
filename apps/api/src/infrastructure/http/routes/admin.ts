import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { listAudit } from '../../../application/use-cases/queries.js';
import {
  createUser,
  listUsers,
  resetUserPassword,
  updateUser,
} from '../../../application/use-cases/users.js';
import { notFound } from '../../../domain/errors.js';

const parseId = (params: unknown) => {
  const r = z.object({ id: z.string().uuid() }).safeParse(params);
  if (!r.success) throw notFound('Usuario');
  return r.data.id;
};

export async function registerAdminRoutes(api: FastifyInstance) {
  const { deps } = api;
  const auth = { preHandler: api.authenticate };

  api.get('/admin/users', auth, async (req) => ({ users: await listUsers(deps, req.actor) }));

  api.post('/admin/users', auth, async (req, reply) => {
    const user = await createUser(deps, req.actor, req.body, { ip: req.ip });
    return reply.status(201).send({ user });
  });

  api.patch('/admin/users/:id', auth, async (req) => ({
    user: await updateUser(deps, req.actor, parseId(req.params), req.body, { ip: req.ip }),
  }));

  api.post('/admin/users/:id/password', auth, async (req) => {
    await resetUserPassword(deps, req.actor, parseId(req.params), req.body, { ip: req.ip });
    return { ok: true };
  });

  api.get('/admin/audit', auth, async (req) => listAudit(deps, req.actor, req.query));
}

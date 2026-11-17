import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  deleteAttachment,
  downloadAttachment,
  uploadAttachment,
} from '../../../application/use-cases/attachments.js';
import {
  addComment,
  assignIncident,
  changeIncidentStatus,
  createIncident,
  getIncidentDetail,
  listIncidents,
  updateIncident,
} from '../../../application/use-cases/incidents.js';
import { getDashboard } from '../../../application/use-cases/queries.js';
import { parse } from '../../../application/schemas.js';
import { listAssignableUsers } from '../../../application/use-cases/users.js';
import { DomainError, notFound, type NotFoundResource } from '../../../domain/errors.js';

const idParam = z.object({ id: z.string().uuid() });

/** Valida el parámetro :id; un id mal formado se trata como "no encontrado". */
const parseId = (params: unknown, what: NotFoundResource = 'Recurso') => {
  const r = idParam.safeParse(params);
  if (!r.success) throw notFound(what);
  return r.data.id;
};

/** Content-Disposition con nombre UTF-8 (RFC 5987) sin riesgo de inyección de cabeceras. */
const contentDisposition = (type: 'inline' | 'attachment', filename: string) => {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};

export async function registerIncidentRoutes(api: FastifyInstance) {
  const { deps } = api;
  const auth = { preHandler: api.authenticate };

  api.get('/dashboard', auth, async (req) => getDashboard(deps, req.actor));

  api.get('/users/assignable', auth, async (req) => {
    const { departmentId } = parse(
      z.object({ departmentId: z.string().uuid('Departamento no válido') }),
      req.query,
    );
    return { users: await listAssignableUsers(deps, req.actor, departmentId) };
  });

  api.get('/incidents', auth, async (req) => listIncidents(deps, req.actor, req.query));

  api.post('/incidents', auth, async (req, reply) => {
    const incident = await createIncident(deps, req.actor, req.body, { ip: req.ip });
    return reply.status(201).send({ incident });
  });

  api.get('/incidents/:id', auth, async (req) =>
    getIncidentDetail(deps, req.actor, parseId(req.params, 'Incidencia')),
  );

  api.patch('/incidents/:id', auth, async (req) => ({
    incident: await updateIncident(deps, req.actor, parseId(req.params, 'Incidencia'), req.body, {
      ip: req.ip,
    }),
  }));

  api.post('/incidents/:id/status', auth, async (req) => ({
    incident: await changeIncidentStatus(
      deps,
      req.actor,
      parseId(req.params, 'Incidencia'),
      req.body,
      {
        ip: req.ip,
      },
    ),
  }));

  api.post('/incidents/:id/assign', auth, async (req) => ({
    incident: await assignIncident(deps, req.actor, parseId(req.params, 'Incidencia'), req.body, {
      ip: req.ip,
    }),
  }));

  api.post('/incidents/:id/comments', auth, async (req, reply) => {
    await addComment(deps, req.actor, parseId(req.params, 'Incidencia'), req.body);
    return reply.status(201).send({ ok: true });
  });

  api.post('/incidents/:id/attachments', auth, async (req, reply) => {
    const incidentId = parseId(req.params, 'Incidencia');
    const file = await req.file();
    if (!file)
      throw new DomainError('VALIDATION', 'No se ha recibido ningún archivo (campo "file")');
    const data = await file.toBuffer();
    const attachment = await uploadAttachment(
      deps,
      req.actor,
      incidentId,
      { filename: file.filename, data },
      {
        ip: req.ip,
      },
    );
    return reply.status(201).send({ attachment });
  });

  api.get('/attachments/:id', auth, async (req, reply) => {
    const { attachment, data } = await downloadAttachment(
      deps,
      req.actor,
      parseId(req.params, 'Adjunto'),
    );
    const asDownload = (req.query as Record<string, unknown>)?.download === '1';
    return reply
      .header('Content-Type', attachment.mimeType)
      .header('Content-Length', data.byteLength)
      .header(
        'Content-Disposition',
        contentDisposition(asDownload ? 'attachment' : 'inline', attachment.filename),
      )
      .header('Cache-Control', 'private, max-age=300')
      .send(data);
  });

  api.delete('/attachments/:id', auth, async (req, reply) => {
    await deleteAttachment(deps, req.actor, parseId(req.params, 'Adjunto'), { ip: req.ip });
    return reply.status(204).send();
  });
}

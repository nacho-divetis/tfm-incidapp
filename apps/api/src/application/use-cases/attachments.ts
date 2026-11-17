import { forbidden, notFound } from '../../domain/errors.js';
import { sanitizeFilename, validateAttachment } from '../../domain/files.js';
import type { Actor, Attachment } from '../../domain/model.js';
import {
  canAttachToIncident,
  canDeleteAttachment,
  canViewIncident,
} from '../../domain/policies.js';
import type { Deps } from '../deps.js';
import type { RequestContext } from '../ports.js';
import { loadVisibleIncident } from './incidents.js';

/** HU-09: subir un adjunto. */
export async function uploadAttachment(
  deps: Deps,
  actor: Actor,
  incidentId: string,
  file: { filename: string; data: Buffer },
  ctx: RequestContext = {},
) {
  const incident = await loadVisibleIncident(deps, actor, incidentId);
  if (!canAttachToIncident(actor, incident))
    throw forbidden('No puedes adjuntar archivos a esta incidencia');

  const mimeType = validateAttachment(file.data);
  const id = deps.ids.next();
  const attachment: Attachment = {
    id,
    incidentId,
    filename: sanitizeFilename(file.filename),
    mimeType,
    size: file.data.byteLength,
    storageKey: `attachments/${incidentId}/${id}`,
    uploadedById: actor.id,
    createdAt: deps.clock.now(),
  };
  await deps.storage.put(attachment.storageKey, file.data);
  await deps.attachments.create(attachment);
  await deps.incidents.addEvent(incidentId, {
    type: 'ATTACHMENT_ADDED',
    actorId: actor.id,
    data: { attachmentId: id, filename: attachment.filename },
  });
  await deps.audit.log({
    actorId: actor.id,
    action: 'ATTACHMENT_UPLOADED',
    entity: 'attachment',
    entityId: id,
    details: { incidentId, filename: attachment.filename, size: attachment.size },
    ip: ctx.ip,
  });
  const { storageKey: _k, ...publicAttachment } = attachment;
  return publicAttachment;
}

async function loadVisibleAttachment(deps: Deps, actor: Actor, attachmentId: string) {
  const attachment = await deps.attachments.findById(attachmentId);
  if (!attachment) throw notFound('Adjunto');
  const incident = await deps.incidents.findById(attachment.incidentId);
  if (!incident || !canViewIncident(actor, incident)) throw notFound('Adjunto');
  return { attachment, incident };
}

/** HU-09 CA3: descarga solo para quien puede ver la incidencia. */
export async function downloadAttachment(deps: Deps, actor: Actor, attachmentId: string) {
  const { attachment } = await loadVisibleAttachment(deps, actor, attachmentId);
  const data = await deps.storage.get(attachment.storageKey);
  if (!data) throw notFound('Adjunto');
  return { attachment, data };
}

/** HU-09 CA4 */
export async function deleteAttachment(
  deps: Deps,
  actor: Actor,
  attachmentId: string,
  ctx: RequestContext = {},
) {
  const { attachment, incident } = await loadVisibleAttachment(deps, actor, attachmentId);
  if (!canDeleteAttachment(actor, incident, attachment))
    throw forbidden('No puedes borrar este adjunto');
  await deps.attachments.delete(attachment.id);
  await deps.storage.delete(attachment.storageKey);
  await deps.incidents.addEvent(incident.id, {
    type: 'ATTACHMENT_REMOVED',
    actorId: actor.id,
    data: { attachmentId: attachment.id, filename: attachment.filename },
  });
  await deps.audit.log({
    actorId: actor.id,
    action: 'ATTACHMENT_DELETED',
    entity: 'attachment',
    entityId: attachment.id,
    details: { incidentId: incident.id, filename: attachment.filename },
    ip: ctx.ip,
  });
}

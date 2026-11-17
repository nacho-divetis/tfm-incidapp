import { describe, expect, it } from 'vitest';
import type { Actor, Attachment, Incident } from '../../src/domain/model.js';
import {
  allowedTransitionsFor,
  canAssignIncident,
  canCommentIncident,
  canCreateIncidentIn,
  canDeleteAttachment,
  canEditIncident,
  canMoveIncident,
  canViewIncident,
} from '../../src/domain/policies.js';

const LOG = 'dep-log';
const ATC = 'dep-atc';

const admin: Actor = { id: 'admin', role: 'ADMIN', departmentIds: [] };
const direccion: Actor = { id: 'dir', role: 'DIRECCION', departmentIds: [] };
const respLog: Actor = { id: 'resp-log', role: 'RESPONSABLE', departmentIds: [LOG] };
const userLog: Actor = { id: 'user-log', role: 'USUARIO', departmentIds: [LOG] };
const otherUserLog: Actor = { id: 'user-log-2', role: 'USUARIO', departmentIds: [LOG] };
const userAtc: Actor = { id: 'user-atc', role: 'USUARIO', departmentIds: [ATC] };

const incident = (over: Partial<Incident> = {}): Incident => ({
  id: 'i1',
  code: 'INC-2026-0001',
  title: 'Título',
  description: 'Descripción larga',
  typeId: 't',
  departmentId: LOG,
  priority: 'MEDIA',
  status: 'ABIERTA',
  thirdParty: null,
  dueDate: null,
  createdById: userLog.id,
  assigneeId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  resolvedAt: null,
  closedAt: null,
  ...over,
});

describe('Matriz de permisos (docs/specs/02-diseno.md §4)', () => {
  it('ver: roles globales todo; el resto solo su ámbito', () => {
    const inc = incident();
    expect(canViewIncident(admin, inc)).toBe(true);
    expect(canViewIncident(direccion, inc)).toBe(true);
    expect(canViewIncident(respLog, inc)).toBe(true);
    expect(canViewIncident(userLog, inc)).toBe(true);
    expect(canViewIncident(userAtc, inc)).toBe(false);
  });

  it('crear: DIRECCION nunca; usuarios solo en sus departamentos; ADMIN en cualquiera', () => {
    expect(canCreateIncidentIn(direccion, LOG)).toBe(false);
    expect(canCreateIncidentIn(userLog, LOG)).toBe(true);
    expect(canCreateIncidentIn(userLog, ATC)).toBe(false);
    expect(canCreateIncidentIn(admin, ATC)).toBe(true);
  });

  it('editar: el creador USUARIO solo mientras está ABIERTA; el responsable siempre que no sea final', () => {
    expect(canEditIncident(userLog, incident())).toBe(true);
    expect(canEditIncident(userLog, incident({ status: 'EN_CURSO' }))).toBe(false);
    expect(canEditIncident(otherUserLog, incident())).toBe(false);
    expect(canEditIncident(respLog, incident({ status: 'EN_CURSO' }))).toBe(true);
    expect(canEditIncident(respLog, incident({ status: 'CERRADA' }))).toBe(false);
    expect(canEditIncident(direccion, incident())).toBe(false);
  });

  it('trasladar y asignar: solo gestores', () => {
    expect(canMoveIncident(userLog, incident())).toBe(false);
    expect(canMoveIncident(respLog, incident())).toBe(true);
    expect(canAssignIncident(userLog, incident())).toBe(false);
    expect(canAssignIncident(respLog, incident())).toBe(true);
    expect(canAssignIncident(admin, incident({ status: 'RECHAZADA' }))).toBe(false);
  });

  it('comentar: todos los que ven, salvo DIRECCION', () => {
    expect(canCommentIncident(direccion, incident())).toBe(false);
    expect(canCommentIncident(otherUserLog, incident())).toBe(true);
    expect(canCommentIncident(userAtc, incident())).toBe(false);
  });

  it('estado: un USUARIO solo si es creador o asignado', () => {
    expect(allowedTransitionsFor(userLog, incident())).toEqual(['EN_CURSO']);
    expect(allowedTransitionsFor(otherUserLog, incident())).toEqual([]);
    expect(allowedTransitionsFor(otherUserLog, incident({ assigneeId: otherUserLog.id }))).toEqual([
      'EN_CURSO',
    ]);
    expect(allowedTransitionsFor(direccion, incident())).toEqual([]);
    expect(allowedTransitionsFor(respLog, incident())).toEqual(['EN_CURSO', 'RECHAZADA']);
  });

  it('borrar adjunto: el autor o un gestor; nunca en incidencias cerradas', () => {
    const att: Attachment = {
      id: 'a',
      incidentId: 'i1',
      filename: 'f.png',
      mimeType: 'image/png',
      size: 1,
      storageKey: 'k',
      uploadedById: userLog.id,
      createdAt: new Date(),
    };
    expect(canDeleteAttachment(userLog, incident(), att)).toBe(true);
    expect(canDeleteAttachment(otherUserLog, incident(), att)).toBe(false);
    expect(canDeleteAttachment(respLog, incident(), att)).toBe(true);
    expect(canDeleteAttachment(respLog, incident({ status: 'CERRADA' }), att)).toBe(false);
  });
});

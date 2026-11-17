import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PNG_1PX } from '../fixtures.js';
import { createTestApp, multipartFile, type TestApp } from './helpers.js';

let t: TestApp;
let catalog: {
  departments: { id: string; code: string }[];
  types: { id: string; code: string; defaultDepartmentId: string }[];
};
const typeId = (code: string) => catalog.types.find((x) => x.code === code)!.id;
const deptId = (code: string) => catalog.departments.find((x) => x.code === code)!.id;

beforeAll(async () => {
  t = await createTestApp();
  const cookie = await t.login('admin');
  catalog = (
    await t.app.inject({ method: 'GET', url: '/api/catalog', headers: { cookie } })
  ).json();
});
afterAll(async () => t.close());

async function create(alias: string, payload: Record<string, unknown>) {
  const cookie = await t.login(alias);
  return t.app.inject({ method: 'POST', url: '/api/incidents', headers: { cookie }, payload });
}

async function list(alias: string, query = '') {
  const cookie = await t.login(alias);
  return (
    await t.app.inject({
      method: 'GET',
      url: `/api/incidents?pageSize=100${query}`,
      headers: { cookie },
    })
  ).json();
}

describe('HU-03 Crear incidencia', () => {
  it('crea en el departamento por defecto del tipo y genera un código correlativo', async () => {
    const res = await create('usuario.logistica', {
      title: 'Camión llega fuera de horario',
      description: 'El transportista llegó a las 20:00, fuera del horario de recepción.',
      typeId: typeId('TRANSPORTE'),
      priority: 'BAJA',
    });
    expect(res.statusCode).toBe(201);
    const inc = res.json().incident;
    expect(inc.status).toBe('ABIERTA');
    expect(inc.departmentId).toBe(deptId('LOG'));
    expect(inc.code).toMatch(/^INC-\d{4}-\d{4}$/);

    const res2 = await create('usuario.logistica', {
      title: 'Otra incidencia de prueba',
      description: 'Segunda incidencia para comprobar la numeración.',
      typeId: typeId('TRANSPORTE'),
    });
    const n1 = Number(inc.code.slice(-4));
    const n2 = Number(res2.json().incident.code.slice(-4));
    expect(n2).toBe(n1 + 1);
  });

  it('impide crear en un departamento ajeno y a DIRECCION', async () => {
    const ajeno = await create('usuario.logistica', {
      title: 'Reclamación de cliente',
      description: 'Intento de crear en Atención al Cliente sin pertenecer.',
      typeId: typeId('CLIENTE'),
    });
    expect(ajeno.statusCode).toBe(403);

    const dir = await create('direccion', {
      title: 'Incidencia de dirección',
      description: 'Dirección es un rol de solo lectura.',
      typeId: typeId('INTERNA'),
    });
    expect(dir.statusCode).toBe(403);
  });

  it('valida los datos de entrada', async () => {
    const res = await create('usuario.logistica', {
      title: 'x',
      description: 'corta',
      typeId: 'no-uuid',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION');
  });
});

describe('HU-04 Visibilidad por departamento (OWASP A01)', () => {
  it('cada usuario solo ve incidencias de su ámbito', async () => {
    const logItems = (await list('usuario.logistica')).items as { departmentId: string }[];
    expect(logItems.length).toBeGreaterThan(0);
    expect(logItems.every((i) => i.departmentId === deptId('LOG'))).toBe(true);

    const calidad = (await list('resp.calidad')).items as { departmentId: string }[];
    expect(calidad.every((i) => [deptId('CAL'), deptId('COMP')].includes(i.departmentId))).toBe(
      true,
    );

    const all = await list('direccion');
    const admin = await list('admin');
    expect(all.total).toBe(admin.total);
    expect(all.total).toBeGreaterThan(logItems.length);
  });

  it('una incidencia ajena responde 404, también en sus acciones', async () => {
    const atcItem = (await list('usuario.atc')).items[0] as { id: string };
    const cookie = await t.login('usuario.logistica');
    for (const [method, url, payload] of [
      ['GET', `/api/incidents/${atcItem.id}`, undefined],
      ['PATCH', `/api/incidents/${atcItem.id}`, { title: 'Hackeado por otro dpto' }],
      ['POST', `/api/incidents/${atcItem.id}/comments`, { text: 'hola' }],
      ['POST', `/api/incidents/${atcItem.id}/status`, { status: 'EN_CURSO' }],
    ] as const) {
      const res = await t.app.inject({ method, url, headers: { cookie }, payload });
      expect(res.statusCode, `${method} ${url}`).toBe(404);
    }
  });

  it('filtra por estado, texto y "asignadas a mí"', async () => {
    const open = await list('admin', '&status=OPEN');
    expect(
      open.items.every((i: { status: string }) =>
        ['ABIERTA', 'EN_CURSO', 'PENDIENTE_TERCERO'].includes(i.status),
      ),
    ).toBe(true);

    const text = await list('admin', '&q=L-4471');
    expect(text.total).toBeGreaterThanOrEqual(1);

    const mine = await list('usuario.tecnico', '&assignedToMe=true');
    expect(mine.total).toBeGreaterThanOrEqual(1);
    const notMine = await list('usuario.tecnico', '&assignedToMe=false');
    expect(notMine.total).toBeGreaterThanOrEqual(mine.total);
  });

  it('filtra las vencidas y coincide con el panel', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const overdue = await list('direccion', '&overdue=true');
    expect(overdue.total).toBeGreaterThan(0);
    for (const i of overdue.items as { status: string; dueDate: string }[]) {
      expect(['ABIERTA', 'EN_CURSO', 'PENDIENTE_TERCERO']).toContain(i.status);
      expect(i.dueDate < today).toBe(true);
    }
    const cookie = await t.login('direccion');
    const dash = (
      await t.app.inject({ method: 'GET', url: '/api/dashboard', headers: { cookie } })
    ).json();
    expect(dash.totals.overdue).toBe(overdue.total);
  });

  it('no se puede inyectar SQL ni comodines por el buscador', async () => {
    const res = await list('admin', `&q=${encodeURIComponent("%' OR 1=1 --")}`);
    expect(res.total).toBe(0);
  });
});

describe('HU-05/06/08 Flujo completo de una incidencia', () => {
  let id: string;

  it('el usuario crea, el responsable asigna y el asignado la trabaja', async () => {
    const created = await create('usuario.compras', {
      title: 'Proveedor envía referencia equivocada',
      description: 'Se recibió la referencia A-200 en lugar de la A-210.',
      typeId: typeId('PROVEEDOR'),
      priority: 'ALTA',
      thirdParty: 'Suministros Industriales Levante',
    });
    id = created.json().incident.id;

    const usuarioCompras = await t.login('usuario.compras');
    const resp = await t.login('resp.calidad');

    // Un USUARIO no puede asignar.
    const forbiddenAssign = await t.app.inject({
      method: 'POST',
      url: `/api/incidents/${id}/assign`,
      headers: { cookie: usuarioCompras },
      payload: { assigneeId: null },
    });
    expect(forbiddenAssign.statusCode).toBe(403);

    const assignable = (
      await t.app.inject({
        method: 'GET',
        url: `/api/users/assignable?departmentId=${deptId('COMP')}`,
        headers: { cookie: resp },
      })
    ).json().users as { id: string; name: string }[];
    const pablo = assignable.find((u) => u.name === 'Pablo Compras')!;
    expect(pablo).toBeTruthy();

    const assigned = await t.app.inject({
      method: 'POST',
      url: `/api/incidents/${id}/assign`,
      headers: { cookie: resp },
      payload: { assigneeId: pablo.id },
    });
    expect(assigned.statusCode).toBe(200);

    // No se puede asignar a alguien de otro departamento.
    const users = (
      await t.app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: { cookie: await t.login('admin') },
      })
    ).json().users;
    const luis = users.find((u: { name: string }) => u.name === 'Luis Almacén');
    const wrong = await t.app.inject({
      method: 'POST',
      url: `/api/incidents/${id}/assign`,
      headers: { cookie: resp },
      payload: { assigneeId: luis.id },
    });
    expect(wrong.statusCode).toBe(400);

    const enCurso = await t.app.inject({
      method: 'POST',
      url: `/api/incidents/${id}/status`,
      headers: { cookie: usuarioCompras },
      payload: { status: 'EN_CURSO' },
    });
    expect(enCurso.json().incident.status).toBe('EN_CURSO');

    const comment = await t.app.inject({
      method: 'POST',
      url: `/api/incidents/${id}/comments`,
      headers: { cookie: usuarioCompras },
      payload: { text: 'Proveedor contactado, enviará la referencia correcta.' },
    });
    expect(comment.statusCode).toBe(201);
  });

  it('aplica las reglas de la máquina de estados', async () => {
    const usuario = await t.login('usuario.compras');
    const resp = await t.login('resp.calidad');
    const post = (cookie: string, payload: object) =>
      t.app.inject({
        method: 'POST',
        url: `/api/incidents/${id}/status`,
        headers: { cookie },
        payload,
      });

    expect((await post(usuario, { status: 'CERRADA' })).statusCode).toBe(409); // transición inexistente
    expect((await post(usuario, { status: 'RESUELTA' })).statusCode).toBe(400); // falta comentario
    const resolved = await post(usuario, {
      status: 'RESUELTA',
      comment: 'Referencia correcta recibida.',
    });
    expect(resolved.json().incident.resolvedAt).toBeTruthy();
    expect((await post(usuario, { status: 'CERRADA' })).statusCode).toBe(403); // solo gestores cierran
    const closed = await post(resp, { status: 'CERRADA' });
    expect(closed.json().incident.closedAt).toBeTruthy();

    // Cerrada: no se puede editar sin reabrir.
    const edit = await t.app.inject({
      method: 'PATCH',
      url: `/api/incidents/${id}`,
      headers: { cookie: resp },
      payload: { priority: 'BAJA' },
    });
    expect(edit.statusCode).toBe(403);

    const reopened = await post(resp, {
      status: 'EN_CURSO',
      comment: 'El proveedor volvió a fallar.',
    });
    expect(reopened.json().incident.closedAt).toBeNull();
  });

  it('el detalle muestra la línea de tiempo completa y los permisos del usuario', async () => {
    const dir = await t.login('direccion');
    const detail = (
      await t.app.inject({ method: 'GET', url: `/api/incidents/${id}`, headers: { cookie: dir } })
    ).json();
    const types = detail.events.map((e: { type: string }) => e.type);
    expect(types[0]).toBe('CREATED');
    expect(types).toEqual(expect.arrayContaining(['ASSIGNED', 'STATUS_CHANGED', 'COMMENT']));
    expect(detail.permissions).toMatchObject({
      canEdit: false,
      canComment: false,
      allowedTransitions: [],
    });
  });
});

describe('HU-07 Editar y trasladar', () => {
  it('el creador edita mientras está ABIERTA pero no puede trasladarla', async () => {
    const created = await create('usuario.atc', {
      title: 'Cliente pide factura duplicada',
      description: 'El cliente necesita un duplicado de la factura de octubre.',
      typeId: typeId('CLIENTE'),
    });
    const id = created.json().incident.id;
    const cookie = await t.login('usuario.atc');

    const ok = await t.app.inject({
      method: 'PATCH',
      url: `/api/incidents/${id}`,
      headers: { cookie },
      payload: { priority: 'ALTA' },
    });
    expect(ok.json().incident.priority).toBe('ALTA');

    const move = await t.app.inject({
      method: 'PATCH',
      url: `/api/incidents/${id}`,
      headers: { cookie },
      payload: { departmentId: deptId('ADM') },
    });
    expect(move.statusCode).toBe(403);

    // El responsable sí la traslada a Administración, y deja de ser visible para ATC.
    const resp = await t.login('resp.atc');
    const moved = await t.app.inject({
      method: 'PATCH',
      url: `/api/incidents/${id}`,
      headers: { cookie: resp },
      payload: { departmentId: deptId('ADM'), typeId: typeId('ADMINISTRATIVA') },
    });
    expect(moved.json().incident.departmentId).toBe(deptId('ADM'));
    expect(
      (await t.app.inject({ method: 'GET', url: `/api/incidents/${id}`, headers: { cookie } }))
        .statusCode,
    ).toBe(404);
    const adm = await t.login('usuario.admin');
    expect(
      (await t.app.inject({ method: 'GET', url: `/api/incidents/${id}`, headers: { cookie: adm } }))
        .statusCode,
    ).toBe(200);
  });
});

describe('HU-09 Adjuntos', () => {
  let incidentId: string;
  let attachmentId: string;

  beforeAll(async () => {
    const created = await create('usuario.tecnico', {
      title: 'Foto de avería en cuadro eléctrico',
      description: 'Se adjunta foto del cuadro con el magnetotérmico disparado.',
      typeId: typeId('TECNICA'),
    });
    incidentId = created.json().incident.id;
  });

  it('sube una imagen válida y la registra en la línea de tiempo', async () => {
    const cookie = await t.login('usuario.tecnico');
    const body = multipartFile('cuadro.png', PNG_1PX, 'image/png');
    const res = await t.app.inject({
      method: 'POST',
      url: `/api/incidents/${incidentId}/attachments`,
      headers: { cookie, ...body.headers },
      payload: body.payload,
    });
    expect(res.statusCode).toBe(201);
    attachmentId = res.json().attachment.id;
    expect(res.json().attachment.mimeType).toBe('image/png');
    expect(res.json().attachment).not.toHaveProperty('storageKey');
  });

  it('rechaza un archivo disfrazado (HTML renombrado a .png)', async () => {
    const cookie = await t.login('usuario.tecnico');
    const body = multipartFile(
      'foto.png',
      Buffer.from('<html><script>alert(1)</script></html>'),
      'image/png',
    );
    const res = await t.app.inject({
      method: 'POST',
      url: `/api/incidents/${incidentId}/attachments`,
      headers: { cookie, ...body.headers },
      payload: body.payload,
    });
    expect(res.statusCode).toBe(415);
  });

  it('solo quien ve la incidencia puede descargar el adjunto', async () => {
    const tecnico = await t.login('resp.tecnico');
    const ok = await t.app.inject({
      method: 'GET',
      url: `/api/attachments/${attachmentId}`,
      headers: { cookie: tecnico },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['content-type']).toBe('image/png');
    expect(ok.rawPayload.equals(PNG_1PX)).toBe(true);

    const otro = await t.login('usuario.logistica');
    const denied = await t.app.inject({
      method: 'GET',
      url: `/api/attachments/${attachmentId}`,
      headers: { cookie: otro },
    });
    expect(denied.statusCode).toBe(404);
  });

  it('un compañero no puede borrar el adjunto de otro, el responsable sí', async () => {
    const admin = await t.login('admin');
    const users = (
      await t.app.inject({ method: 'GET', url: '/api/admin/users', headers: { cookie: admin } })
    ).json().users;
    const tomas = users.find((u: { name: string }) => u.name === 'Tomás Técnico');
    expect(tomas).toBeTruthy();

    // Creamos un segundo usuario técnico para comprobarlo.
    const tec = catalog.departments.find((d) => d.code === 'TEC')!;
    await t.app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: admin },
      payload: {
        email: 'tecnico2@incidapp.demo',
        name: 'Técnico Dos',
        role: 'USUARIO',
        password: 'Demo1234!',
        departmentIds: [tec.id],
      },
    });
    const companero = await t.login('tecnico2');
    const denied = await t.app.inject({
      method: 'DELETE',
      url: `/api/attachments/${attachmentId}`,
      headers: { cookie: companero },
    });
    expect(denied.statusCode).toBe(403);

    const resp = await t.login('resp.tecnico');
    const ok = await t.app.inject({
      method: 'DELETE',
      url: `/api/attachments/${attachmentId}`,
      headers: { cookie: resp },
    });
    expect(ok.statusCode).toBe(204);
  });
});

describe('HU-10 Cuadro de mando', () => {
  it('limita las métricas al ámbito del usuario', async () => {
    const all = (
      await t.app.inject({
        method: 'GET',
        url: '/api/dashboard',
        headers: { cookie: await t.login('direccion') },
      })
    ).json();
    const log = (
      await t.app.inject({
        method: 'GET',
        url: '/api/dashboard',
        headers: { cookie: await t.login('resp.logistica') },
      })
    ).json();
    expect(all.totals.total).toBeGreaterThan(log.totals.total);
    expect(log.byDepartment.every((d: { key: string }) => d.key === 'LOG')).toBe(true);
    expect(all.avgResolutionHours).toBeGreaterThan(0);
  });
});

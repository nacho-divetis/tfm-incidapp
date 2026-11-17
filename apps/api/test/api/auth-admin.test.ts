import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => t.close());

describe('HU-01 Autenticación', () => {
  it('rechaza credenciales incorrectas con un mensaje genérico', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@incidapp.demo', password: 'incorrecta' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toBe('Email o contraseña incorrectos');

    const unknown = await t.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nadie@incidapp.demo', password: 'incorrecta' },
    });
    expect(unknown.json().error.message).toBe('Email o contraseña incorrectos');
  });

  it('crea una cookie de sesión httpOnly y sameSite=strict', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'ADMIN@incidapp.demo', password: 'Demo1234!' },
    });
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies[0]!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Strict');
    expect(res.json().user).not.toHaveProperty('passwordHash');
  });

  it('protege las rutas sin sesión (401)', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/incidents' });
    expect(res.statusCode).toBe(401);
  });

  it('devuelve el usuario actual con /auth/me', async () => {
    const cookie = await t.login('resp.logistica');
    const res = await t.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(res.json().user.role).toBe('RESPONSABLE');
  });

  it('envía cabeceras de seguridad (Helmet)', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
  });
});

describe('HU-02 Gestión de usuarios', () => {
  it('solo ADMIN accede a la gestión de usuarios y a la auditoría', async () => {
    for (const alias of ['direccion', 'resp.logistica', 'usuario.logistica']) {
      const cookie = await t.login(alias);
      expect(
        (await t.app.inject({ method: 'GET', url: '/api/admin/users', headers: { cookie } }))
          .statusCode,
      ).toBe(403);
      expect(
        (await t.app.inject({ method: 'GET', url: '/api/admin/audit', headers: { cookie } }))
          .statusCode,
      ).toBe(403);
    }
    const admin = await t.login('admin');
    const res = await t.app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: { cookie: admin },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().users.length).toBeGreaterThan(5);
  });

  it('crea un usuario, que puede iniciar sesión, y lo desactiva', async () => {
    const admin = await t.login('admin');
    const catalog = (
      await t.app.inject({ method: 'GET', url: '/api/catalog', headers: { cookie: admin } })
    ).json();
    const log = catalog.departments.find((d: { code: string }) => d.code === 'LOG');

    const sinDpto = await t.app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: admin },
      payload: {
        email: 'nuevo@incidapp.demo',
        name: 'Nuevo',
        role: 'USUARIO',
        password: 'Segura123',
        departmentIds: [],
      },
    });
    expect(sinDpto.statusCode).toBe(400);

    const created = await t.app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: admin },
      payload: {
        email: 'nuevo@incidapp.demo',
        name: 'Nuevo',
        role: 'USUARIO',
        password: 'Segura123',
        departmentIds: [log.id],
      },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().user.id;

    const duplicated = await t.app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: admin },
      payload: {
        email: 'NUEVO@incidapp.demo',
        name: 'Otro',
        role: 'USUARIO',
        password: 'Segura123',
        departmentIds: [log.id],
      },
    });
    expect(duplicated.statusCode).toBe(409);

    const ok = await t.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nuevo@incidapp.demo', password: 'Segura123' },
    });
    expect(ok.statusCode).toBe(200);
    const sessionCookie = `${ok.cookies[0]!.name}=${ok.cookies[0]!.value}`;

    await t.app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${id}`,
      headers: { cookie: admin },
      payload: { active: false },
    });

    // La sesión existente deja de valer inmediatamente y no puede volver a entrar.
    expect(
      (
        await t.app.inject({
          method: 'GET',
          url: '/api/auth/me',
          headers: { cookie: sessionCookie },
        })
      ).statusCode,
    ).toBe(401);
    const blocked = await t.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nuevo@incidapp.demo', password: 'Segura123' },
    });
    expect(blocked.statusCode).toBe(401);
  });

  it('un administrador no puede quitarse el rol ni desactivarse', async () => {
    const admin = await t.login('admin');
    const me = (
      await t.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: admin } })
    ).json().user;
    const res = await t.app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${me.id}`,
      headers: { cookie: admin },
      payload: { active: false },
    });
    expect(res.statusCode).toBe(400);
  });

  it('registra en la auditoría los inicios de sesión fallidos', async () => {
    const admin = await t.login('admin');
    const res = await t.app.inject({
      method: 'GET',
      url: '/api/admin/audit?pageSize=100',
      headers: { cookie: admin },
    });
    const actions = res.json().items.map((i: { action: string }) => i.action);
    expect(actions).toContain('LOGIN_FAILED');
    expect(actions).toContain('USER_CREATED');
  });

  it('permite cambiar la propia contraseña verificando la actual', async () => {
    const cookie = await t.login('usuario.admin');
    const bad = await t.app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { cookie },
      payload: { currentPassword: 'mal', newPassword: 'NuevaClave1' },
    });
    expect(bad.statusCode).toBe(400);
    const good = await t.app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { cookie },
      payload: { currentPassword: 'Demo1234!', newPassword: 'NuevaClave1' },
    });
    expect(good.statusCode).toBe(200);
  });
});

describe('HU-01 CA4 Límite de intentos', () => {
  it('bloquea el login tras 10 intentos por minuto', async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) {
      const res = await t.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        remoteAddress: '10.0.0.99',
        payload: { email: 'x@incidapp.demo', password: 'y' },
      });
      last = res.statusCode;
    }
    expect(last).toBe(429);
  });
});

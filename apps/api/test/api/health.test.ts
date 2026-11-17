import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers.js';

describe('Salud y rutas para la plataforma de despliegue', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.close();
  });

  it.each(['/api/health', '/api/health/'])('GET %s responde 200', async (url) => {
    const res = await ctx.app.inject({ method: 'GET', url });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('HEAD /api/health responde 200', async () => {
    const res = await ctx.app.inject({ method: 'HEAD', url: '/api/health' });
    expect(res.statusCode).toBe(200);
  });

  it('una ruta de API inexistente responde 404 en JSON', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/no-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

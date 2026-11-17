import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Permisos por rol y departamento', () => {
  test('un usuario no ve incidencias de otros departamentos ni la administración', async ({
    page,
  }) => {
    // Dirección ve todo: localizamos una incidencia de Atención al Cliente.
    await login(page, 'direccion');
    await page.goto('/incidencias?q=no%20conforme');
    await page.getByText('Cliente reclama producto no conforme').first().click();
    await expect(page).toHaveURL(/\/incidencias\/[0-9a-f-]{36}$/);
    const atcUrl = page.url();
    // Dirección es solo lectura.
    await expect(page.getByLabel('Nuevo comentario')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Nueva incidencia' })).toHaveCount(0);

    await page.context().clearCookies();

    // Un usuario de Logística no puede abrirla por URL (404, OWASP A01).
    await login(page, 'usuario.logistica');
    await page.goto(atcUrl);
    await expect(page.getByText('Incidencia no encontrada')).toBeVisible();

    // Ni accede a la administración.
    await expect(page.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
    await page.goto('/admin/usuarios');
    await expect(page.getByRole('heading', { name: 'Usuarios' })).toHaveCount(0);
  });

  test('el administrador gestiona usuarios y consulta la auditoría', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/usuarios');
    await expect(page.getByText('Laura Logística').first()).toBeVisible();
    await page.goto('/admin/auditoria');
    await expect(page.getByRole('table')).toBeVisible();
  });
});

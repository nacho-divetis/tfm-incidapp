import { expect, test } from '@playwright/test';
import { login, logout } from './helpers';

test.describe('Flujo completo de una incidencia', () => {
  test('un usuario la crea, la responsable la trabaja, la resuelve y la cierra', async ({
    page,
  }) => {
    const title = `Mercancía mojada en recepción ${Date.now()}`;

    // 1. El usuario de Logística crea la incidencia (HU-03).
    await login(page, 'usuario.logistica');
    await page.goto('/incidencias/nueva');
    await page.getByLabel('Título').fill(title);
    await page
      .getByLabel('Descripción')
      .fill('Dos palés llegaron mojados por lluvia durante la descarga.');
    await page.getByLabel('Tipo').selectOption({ label: 'Transporte' });
    await page.getByLabel('Prioridad').selectOption({ label: 'Alta' });
    await page.getByLabel('Tercero implicado').fill('Transportes Rápidos del Norte');
    await page.getByRole('button', { name: 'Crear incidencia' }).click();

    await expect(page).toHaveURL(/\/incidencias\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    const url = page.url();

    // Un USUARIO no puede rechazar (HU-05 CA3).
    await expect(page.getByRole('button', { name: 'Rechazar' })).toHaveCount(0);

    // 2. Comenta (HU-08).
    await page.getByLabel('Nuevo comentario').fill('Avisado el transportista por teléfono.');
    await page.getByRole('button', { name: 'Comentar' }).click();
    await expect(page.getByText('Avisado el transportista por teléfono.')).toBeVisible();
    await logout(page);

    // 3. La responsable la pone en curso.
    await login(page, 'resp.logistica');
    await page.goto(url);
    await page.getByRole('button', { name: 'Iniciar trabajo' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Iniciar trabajo' }).click();
    await expect(page.getByRole('button', { name: 'Resolver' })).toBeVisible();

    // 4. Resolver exige comentario (HU-05 CA2).
    await page.getByRole('button', { name: 'Resolver' }).click();
    await dialog.getByRole('button', { name: 'Resolver' }).click();
    await expect(dialog).toBeVisible();
    await dialog
      .getByLabel('Comentario')
      .fill('El transportista asume el coste de la mercancía dañada.');
    await dialog.getByRole('button', { name: 'Resolver' }).click();
    await expect(dialog).toBeHidden();

    // 5. Cerrar y comprobar que aparece la reapertura y la línea de tiempo.
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reabrir' })).toBeVisible();
    await expect(
      page.getByText('El transportista asume el coste de la mercancía dañada.'),
    ).toBeVisible();
  });
});

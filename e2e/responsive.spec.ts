import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('la aplicación es usable en un móvil', async ({ page }) => {
  await login(page, 'resp.atc');
  const menu = page.getByRole('button', { name: 'Abrir menú' });
  await expect(menu).toBeVisible();
  await menu.click();
  await page.getByRole('link', { name: 'Incidencias', exact: true }).last().click();
  await expect(page).toHaveURL(/\/incidencias/);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

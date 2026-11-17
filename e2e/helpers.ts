import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'Demo1234!';

export async function login(page: Page, alias: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(`${alias}@incidapp.demo`);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login/);
}

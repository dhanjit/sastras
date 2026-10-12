import { test, expect } from '@playwright/test';

test('a block page shows its Sanskrit title and English gloss', async ({ page }) => {
  await page.goto('/advaita-vedanta');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Advaita Vedānta');
  await expect(page.locator('p.gloss')).toContainText('non-dualism');
});

test('a block page shows where it sits, its status, its sources and a correction link', async ({ page }) => {
  await page.goto('/advaita-vedanta');
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs.getByRole('link', { name: 'Map' })).toHaveAttribute('href', '/');
  await expect(crumbs.getByRole('link', { name: 'Vedānta' })).toHaveAttribute('href', '/vedanta');
  await expect(page.locator('.layer-strip li.on')).toHaveCount(1);
  await expect(page.locator('.pill')).toContainText('draft');
  await expect(page.locator('#src-wiki a')).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Advaita_Vedanta');
  await expect(page.getByRole('link', { name: 'Suggest a correction' })).toHaveAttribute('href', /github\.com\/dhanjit\/sastras\/issues\/new/);
});

test('a parent page lists its children under "Go deeper"', async ({ page }) => {
  await page.goto('/vedanta');
  const deeper = page.locator('section', { has: page.getByRole('heading', { name: 'Go deeper' }) });
  await deeper.getByRole('link', { name: /Advaita Vedānta/ }).click();
  await expect(page).toHaveURL(/\/advaita-vedanta$/);
});

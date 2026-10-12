import { test, expect } from '@playwright/test';

test('the home page shows all five layers in study order', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h2.layer-title')).toHaveText([/Ādhāra/, /Pramāṇa/, /Darśana/, /Śruti and Śāstra/, /Vāda/]);
});

test('written blocks are links, unwritten ones say "in preparation"', async ({ page }) => {
  await page.goto('/');
  const schools = page.locator('#schools');
  await expect(schools.getByRole('link', { name: /Vedānta/ })).toHaveAttribute('href', '/vedanta');
  const carvaka = schools.locator('.row', { hasText: 'Cārvāka' });
  await expect(carvaka).toContainText('in preparation');
  await expect(carvaka.locator('.row-tag')).toHaveCount(0);
  await expect(page.locator('.intro .legend')).toContainText('bold');
  await expect(schools.getByRole('link', { name: /Cārvāka/ })).toHaveCount(0);
});

test('schools are grouped by whether they accept the Veda, with their pramāṇas', async ({ page }) => {
  await page.goto('/');
  const labels = page.locator('#schools .side-label');
  await expect(labels).toHaveCount(3);
  await expect(labels.nth(0)).toContainText('nāstika');
  const vedanta = page.locator('#schools li', { has: page.getByRole('link', { name: /Vedānta/ }) });
  await expect(vedanta.locator('.chip')).toHaveCount(6);
});

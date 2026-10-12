import { test, expect } from '@playwright/test';

test('a block page shows its Sanskrit title and English gloss', async ({ page }) => {
  await page.goto('/advaita-vedanta');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Advaita Vedānta');
  await expect(page.locator('p.gloss')).toContainText('non-dualism');
});

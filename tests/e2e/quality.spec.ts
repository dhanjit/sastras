import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// '/no-such-page' is served the 404 page by `astro preview`.
const pages = ['/', '/advaita-vedanta', '/vedanta', '/about', '/glossary', '/no-such-page'];

for (const path of pages) {
  test(`${path} never scrolls sideways`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${path} has no serious accessibility problems (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze();
      const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
}

test('dark mode switches to the lamp-lit palette', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/advaita-vedanta');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(28, 25, 20)');
});

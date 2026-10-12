import { test, expect } from '@playwright/test';

test('every page points at its own preview image, and the image exists', async ({ page, request }) => {
  await page.goto('/advaita-vedanta');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toMatch(/^https:\/\/sastras\.dhanjit\.me\/og\/advaita-vedanta\.png\?v=[0-9a-f]{8}$/); // the query busts crawler caches after an edit
  const res = await request.get('/og/advaita-vedanta.png');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
  const buf = await res.body();
  expect(buf.readUInt32BE(16)).toBe(1200); // PNG IHDR: width, then height
  expect(buf.readUInt32BE(20)).toBe(630);
  expect((await request.get(og!.replace('https://sastras.dhanjit.me', ''))).status()).toBe(200); // the versioned URL resolves
  expect((await request.get('/og/home.png')).status()).toBe(200);
});

test('block pages describe themselves, not just repeat the title', async ({ page }) => {
  await page.goto('/advaita-vedanta');
  const desc = await page.locator('meta[name="description"]').getAttribute('content');
  expect(desc).toMatch(/^Non-dualism/);
  expect(desc!.length).toBeGreaterThan(60);
  expect(desc!.length).toBeLessThanOrEqual(155);
  expect(desc).not.toMatch(/:note|:cite|\[|\]/);
  expect(await page.locator('meta[property="og:description"]').getAttribute('content')).toBe(desc);
  expect(await page.locator('meta[property="og:type"]').getAttribute('content')).toBe('article');
  expect(await page.locator('meta[property="og:image:alt"]').getAttribute('content')).toContain('Advaita Vedānta');
  expect(await page.locator('meta[name="twitter:image:alt"]').getAttribute('content')).toContain('Advaita Vedānta');
  expect(await page.locator('meta[property="og:image:type"]').getAttribute('content')).toBe('image/png');
  expect(await page.locator('meta[property="og:locale"]').getAttribute('content')).toBe('en_US');
});

test('the home page stays a website', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('meta[property="og:type"]').getAttribute('content')).toBe('website');
});

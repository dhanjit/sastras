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
  await expect(page.locator('.layer-strip a[aria-current="location"]')).toHaveAttribute('href', '/#schools');
  await expect(page.getByRole('navigation', { name: 'Map layers' })).toBeVisible();
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

test('a citation links to its source and a note opens', async ({ page }, info) => {
  await page.goto('/advaita-vedanta');
  await expect(page.locator('sup.cite a')).toHaveAttribute('href', '#src-wiki');
  const body = page.locator('.note-body').first();
  if (info.project.name === 'phone') {
    await expect(body).toBeHidden();
    await page.locator('.note-mark').first().tap();
    await expect(body).toBeVisible();
  } else {
    await expect(body).toBeVisible(); // margin note, always shown on wide screens
    const prose = await page.locator('.prose').boundingBox();
    const nb = await body.boundingBox();
    expect(nb!.x).toBeGreaterThan(prose!.x + prose!.width);
  }
});

test('a Sanskrit term shows its meaning when tapped or clicked', async ({ page }, info) => {
  await page.goto('/advaita-vedanta');
  const term = page.locator('a.term', { hasText: 'ātman' }).first();
  if (info.project.name === 'phone') await term.tap();
  else await term.click();
  await expect(page.locator('#gloss-pop')).toBeVisible();
  await expect(page.locator('#gloss-pop')).toContainText('self');
  await expect(page).toHaveURL(/\/advaita-vedanta$/); // stayed on the page
  await expect(term).toHaveAccessibleDescription(/self/); // screen readers get the meaning without the pop-up
  // tapping or clicking inside the pop-up must not close it
  if (info.project.name === 'phone') await page.locator('#gloss-pop').tap();
  else await page.locator('#gloss-pop').click();
  await expect(page.locator('#gloss-pop')).toBeVisible();
});

test('a stub child shows as "in preparation" and is not a link', async ({ page }) => {
  await page.goto('/vedanta');
  const deeper = page.locator('section', { has: page.getByRole('heading', { name: 'Go deeper' }) });
  await expect(deeper.locator('.row.prep', { hasText: /^Dvaita/ })).toContainText('in preparation');
  await expect(deeper.getByRole('link', { name: /^Dvaita/ })).toHaveCount(0);
});

test('every glossed term links to an entry that exists on the glossary page', async ({ page }) => {
  await page.goto('/advaita-vedanta');
  const hrefs = await page.locator('a.term').evaluateAll((els) => els.map((e) => e.getAttribute('href')!));
  expect(hrefs.length).toBeGreaterThan(0);
  const ids = hrefs.map((h) => h.split('#')[1]);
  await page.goto('/glossary');
  for (const id of ids) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
  await expect(page.locator('.glossary > div')).not.toHaveCount(0);
});

test('a term near the bottom of the window opens its pop-up above it', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'hover placement is a mouse behaviour');
  await page.goto('/advaita-vedanta');
  const term = page.locator('a.term', { hasText: 'ātman' }).first();
  const box = (await term.boundingBox())!;
  await page.setViewportSize({ width: 1280, height: Math.ceil(box.y + box.height) + 10 }); // no room below the term
  await term.hover();
  const pop = page.locator('#gloss-pop');
  await expect(pop).toBeVisible();
  await expect(pop).toHaveAttribute('data-side', 'above');
  const pb = (await pop.boundingBox())!;
  expect(pb.y + pb.height).toBeLessThanOrEqual(box.y); // sits above the term, not over it
});

test('Enter on a focused term follows the link to its glossary entry', async ({ page }) => {
  await page.goto('/advaita-vedanta');
  await page.locator('a.term', { hasText: 'ātman' }).first().focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/glossary#g-aatman$/);
  await expect(page.locator('#g-aatman')).toBeVisible();
});

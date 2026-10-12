import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// '/no-such-page' is served the 404 page by `astro preview`.
const pages = ['/', '/advaita-vedanta', '/vedanta', '/about', '/glossary', '/no-such-page'];
const schemes = ['light', 'dark'] as const;

// A failure names the elements that stick out, not just a pixel count. The skip link is off-screen on purpose.
async function expectNoSidewaysScroll(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const { overflow, offenders } = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    return {
      overflow: document.documentElement.scrollWidth - vw,
      offenders: [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > vw + 0.5 && !el.classList.contains('skip'))
        .map((el) => `${el.tagName.toLowerCase()}.${(el as HTMLElement).className}`),
    };
  });
  expect({ overflow: Math.max(0, overflow), offenders }).toEqual({ overflow: 0, offenders: [] });
}

async function expectNoSeriousA11yProblems(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

for (const path of pages) {
  test(`${path} never scrolls sideways`, async ({ page }) => {
    await page.goto(path);
    await expectNoSidewaysScroll(page);
  });

  for (const colorScheme of schemes) {
    test(`${path} has no serious accessibility problems (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      await expectNoSeriousA11yProblems(page);
    });
  }
}

// The glossary pop-up and a note are the only things drawn over the page; audit them while open.
for (const colorScheme of schemes) {
  test(`open glossary pop-up and note stay inside the page and accessible (${colorScheme})`, async ({ page }, info) => {
    const phone = info.project.name === 'phone';
    await page.emulateMedia({ colorScheme });
    await page.goto('/advaita-vedanta');
    if (phone) {
      // Note first: the pop-up would sit over the note mark and swallow the tap.
      await page.locator('.note-mark').first().tap();
      await expect(page.locator('.note-body').first()).toBeVisible();
    }
    const term = page.locator('a.term').first();
    await (phone ? term.tap() : term.click());
    await expect(page.locator('#gloss-pop')).toBeVisible();
    await expectNoSidewaysScroll(page);
    await expectNoSeriousA11yProblems(page);
  });
}

// WCAG 1.4.10 Reflow: no sideways scroll at 320 CSS px wide.
test('pages reflow at 320px wide', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'width is set explicitly; one project is enough');
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ['/', '/advaita-vedanta', '/glossary']) {
    await page.goto(path);
    await expectNoSidewaysScroll(page);
  }
});

test('dark mode switches to the lamp-lit palette', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/advaita-vedanta');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(28, 25, 20)');
});

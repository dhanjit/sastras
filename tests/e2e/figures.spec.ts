import { test, expect, type Locator } from '@playwright/test';

// A test-only page (src/pages/figure-test/[id].astro), built because playwright.config.ts sets E2E_FIGURES=1.
// It draws the example figure through the same code as a block page, below a spacer, so it starts off screen.
const PAGE = '/figure-test/example-system';

const animations = (fig: Locator) =>
  fig.evaluate((f) => f.getAnimations({ subtree: true }).map((a) => ({ state: a.playState, time: Number(a.currentTime ?? 0) })));
const finished = (fig: Locator) => async () => (await animations(fig)).every((a) => a.state === 'finished');
const animationNames = (fig: Locator) => fig.locator('.anim').evaluateAll((els) => els.map((e) => getComputedStyle(e).animationName));

test('a figure is drawn inline, named by its title and desc, with a caption', async ({ page }) => {
  await page.goto(PAGE);
  const fig = page.locator('figure.fig');
  const svg = fig.locator('svg');
  await expect(svg).toHaveAttribute('role', 'img');
  // aria-labelledby names it by its <title> and then its <desc>: the pattern screen readers support best
  const text = async (tag: string) => ((await svg.locator(tag).textContent()) ?? '').replace(/\s+/g, ' ').trim();
  const [title, desc] = [await text('title'), await text('desc')];
  expect(title && desc).toBeTruthy();
  await expect(svg).toHaveAccessibleName(`${title} ${desc}`);
  await expect(fig.locator('figcaption')).not.toBeEmpty();
});

test('one classic script in <head> arms the page before first paint and also plays the figures', async ({ request }) => {
  const html = await (await request.get(PAGE)).text();
  const head = html.slice(0, html.indexOf('</head>'));
  // a classic inline script runs before the body is parsed, so Replay never pops in and the figure never jumps; arming
  // and observing in the same script means a failure elsewhere can't leave a figure armed with nothing to play it
  const script = head.match(/<script>((?:(?!<\/script>)[\s\S])*figs-armed(?:(?!<\/script>)[\s\S])*)<\/script>/)?.[1] ?? '';
  expect(script).toContain('new IntersectionObserver');
  expect(script).toContain('fig-replay');
  expect(script).not.toMatch(/\?\.|\?\?/); // ES2017: Safari 12.1–13.0 have IntersectionObserver but not ?. or ??
});

test('without IntersectionObserver the page is never armed: final frame, no Replay', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as { IntersectionObserver?: unknown }).IntersectionObserver;
  });
  await page.goto(PAGE);
  const fig = page.locator('figure.fig[data-animated]');
  await expect(page.locator('html')).not.toHaveClass(/\bfigs-armed\b/);
  expect(new Set(await animationNames(fig))).toEqual(new Set(['none']));
  await expect(fig.locator('.fig-replay')).toBeHidden();
});

test('an observer without isIntersecting (Edge 15) never arms the page: final frame, no Replay', async ({ page }) => {
  await page.addInitScript(() => {
    delete (IntersectionObserverEntry.prototype as { isIntersecting?: boolean }).isIntersecting;
  });
  await page.goto(PAGE);
  const fig = page.locator('figure.fig[data-animated]');
  await expect(page.locator('html')).not.toHaveClass(/\bfigs-armed\b/);
  expect(new Set(await animationNames(fig))).toEqual(new Set(['none']));
  await expect(fig.locator('.fig-replay')).toBeHidden();
});

test('if the observer fails to start, the page disarms: final frame, no Replay', async ({ page }) => {
  await page.addInitScript(() => {
    (window as { IntersectionObserver?: unknown }).IntersectionObserver = function () {
      throw new Error('observer unavailable');
    };
  });
  await page.goto(PAGE);
  const fig = page.locator('figure.fig[data-animated]');
  await expect(page.locator('html')).not.toHaveClass(/\bfigs-armed\b/);
  expect(new Set(await animationNames(fig))).toEqual(new Set(['none']));
  await expect(fig.locator('.fig-replay')).toBeHidden();
});

test('an animated figure holds its first frame until it is on screen, then plays', async ({ page }) => {
  await page.goto(PAGE);
  const fig = page.locator('figure.fig[data-animated]');
  await expect(page.locator('html')).toHaveClass(/\bfigs-armed\b/);
  await expect(fig.locator('.fig-replay')).toBeVisible();
  await expect(fig).not.toHaveClass(/\bin-view\b/);
  const before = await animations(fig);
  expect(before.length).toBeGreaterThan(0);
  expect(before.every((a) => a.state === 'paused' && a.time === 0)).toBe(true);
  await fig.scrollIntoViewIfNeeded();
  await expect(fig).toHaveClass(/\bin-view\b/);
  await expect.poll(finished(fig), { timeout: 10_000 }).toBe(true);
});

test('Replay starts a finished animation over', async ({ page }) => {
  await page.goto(PAGE);
  const fig = page.locator('figure.fig[data-animated]');
  await fig.scrollIntoViewIfNeeded();
  await expect.poll(finished(fig), { timeout: 10_000 }).toBe(true);
  // click and read in one task, so a short animation can't finish in between
  const times = await fig.evaluate((f) => {
    f.querySelector<HTMLButtonElement>('.fig-replay')!.click();
    return f.getAnimations({ subtree: true }).map((a) => Number(a.currentTime ?? 0));
  });
  expect(times.length).toBeGreaterThan(0);
  expect(Math.max(...times)).toBeLessThan(100);
  await expect.poll(finished(fig), { timeout: 10_000 }).toBe(true);
});

test('with reduced motion, a figure shows its final frame and no Replay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(PAGE);
  const fig = page.locator('figure.fig[data-animated]');
  await fig.scrollIntoViewIfNeeded();
  await expect(fig).toHaveClass(/\bin-view\b/);
  expect(await animations(fig)).toEqual([]);
  await expect(fig.locator('.fig-replay')).toBeHidden();
});

test('in print, a figure shows its final frame and no Replay', async ({ page }) => {
  await page.emulateMedia({ media: 'print' });
  await page.goto(PAGE);
  const fig = page.locator('figure.fig[data-animated]');
  expect(new Set(await animationNames(fig))).toEqual(new Set(['none']));
  await expect(fig.locator('.fig-replay')).toBeHidden();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('a figure shows its final frame and no Replay', async ({ page }) => {
    await page.goto(PAGE);
    const fig = page.locator('figure.fig[data-animated]');
    await expect(page.locator('html')).not.toHaveClass(/\bfigs-armed\b/);
    expect(new Set(await animationNames(fig))).toEqual(new Set(['none']));
    await expect(fig.locator('.fig-replay')).toBeHidden();
  });
});

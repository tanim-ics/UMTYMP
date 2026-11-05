// Task 23: the app installs and runs with no network after the first visit, and a mock makes no network requests.
// These run against the production build (`vite preview`, projects `offline-*` in playwright.config.ts), because the
// service worker exists only there. Production has no test hooks, so everything goes through the screen.
import { expect, test, type BrowserContext, type Page, type Request } from '@playwright/test';

/** First visit: wait until the service worker has cached the app and controls the page. */
async function firstVisit(page: Page) {
  await page.goto('/');
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready;
    return navigator.serviceWorker.controller !== null;
  });
}

async function makeStudent(page: Page) {
  await expect(page.getByRole('heading', { name: 'Welcome to Comparia Academy!' })).toBeVisible();
  await page.getByTestId('profiles.name').fill('Robin');
  await page.getByTestId('profiles.house-starhorn').check();
  await page.getByTestId('profiles.color-sky').check();
  await page.getByTestId('profiles.save').click();
  await expect(page.getByTestId('home.player')).toContainText('Robin');
}

/** Answers every question of a Grand Trial, then finishes it. */
async function takeMock(page: Page) {
  await page.getByTestId('home.start').click();
  const position = page.getByTestId('trial.position');
  await expect(position).toBeVisible();
  const total = Number(/of (\d+)/.exec((await position.textContent()) ?? '')?.[1]);
  expect(total).toBeGreaterThan(0);
  for (let i = 0; i < total; i++) {
    await expect(position).toHaveText(`Question ${i + 1} of ${total}`);
    await expect(page.locator('.katex').first()).toBeVisible();
    await page.keyboard.press(String((i % 4) + 1));
    if (i < total - 1) await page.getByTestId('trial.next').click();
  }
  await page.getByTestId('trial.finish').click();
  await expect(page.getByTestId('result.score')).toContainText(`of ${total} correct`);
}

/** Every request that reached the network: from the page but not answered by the service worker, or from it. */
function networkLog(context: BrowserContext, page: Page) {
  const seen: Request[] = [];
  page.on('request', (r) => seen.push(r));
  context.on('request', (r) => {
    if (r.serviceWorker() !== null) seen.push(r);
  });
  return async () => {
    const network: string[] = [];
    for (const r of seen) {
      const response = await r.response();
      if (r.serviceWorker() !== null || response === null || !response.fromServiceWorker()) {
        network.push(r.url());
      }
    }
    return network;
  };
}

test('installable: a manifest with name, start page, standalone display and icons, and a service worker', async ({
  page,
  request,
}) => {
  await firstVisit(page);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).not.toBeNull();
  const manifest = (await (await request.get(href ?? '')).json()) as {
    name: string;
    short_name: string;
    start_url: string;
    display: string;
    icons: { src: string; sizes: string; type: string; purpose?: string }[];
  };
  expect(manifest).toMatchObject({ name: 'Comparia Academy', display: 'standalone' });
  expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  expect(manifest.start_url).toBe('/');
  for (const size of ['192x192', '512x512']) {
    const icon = manifest.icons.find((i) => i.sizes === size);
    expect(icon, size).toBeDefined();
    expect((await request.get(icon?.src ?? '')).ok(), size).toBe(true);
  }
  expect(manifest.icons.some((i) => i.purpose?.includes('maskable'))).toBe(true);
  // iPad Safari ignores manifest icons for the home screen and uses this one.
  const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await request.get(touch ?? '')).ok()).toBe(true);
});

test('after the first visit, the whole app works with the network off', async ({
  page,
  context,
}) => {
  await firstVisit(page);
  await context.setOffline(true);
  await page.reload();
  await makeStudent(page);
  await takeMock(page);
  await page.getByTestId('result.review').click();
  await expect(page.getByTestId('review.item').first()).toBeVisible();
  await page.getByTestId('review.back').click();
  await page.getByTestId('result.home').click();
  await page.getByTestId('home.spellbook').click();
  await expect(page.getByTestId('spellbook.art')).toBeVisible();
  // Pictures and fonts came from the cache too, not just the page.
  await page.waitForFunction(() => [...document.images].every((img) => img.complete));
  await page.evaluate(() => document.fonts.ready);
  const missing = await page.evaluate(() => [
    ...[...document.images]
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.src),
    ...[...document.fonts].filter((f) => f.status === 'error').map((f) => f.family),
  ]);
  expect(missing).toEqual([]);
});

test('a Grand Trial makes no network requests', async ({ page, context }) => {
  await firstVisit(page);
  await page.reload();
  await makeStudent(page);
  const network = networkLog(context, page);
  await takeMock(page);
  expect(await network()).toEqual([]);
});

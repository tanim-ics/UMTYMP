// Task 19: the theme's fonts, palettes and reduced-motion rule, seen in a real browser.
import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers.ts';

const bodyBackground = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('the theme fonts load from the app itself, never from a font service', async ({ page }) => {
  const fontHosts = new Set<string>();
  page.on('request', (r) => {
    if (r.resourceType() === 'font') fontHosts.add(new URL(r.url()).host);
  });
  await openApp(page);

  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('400 16px Nunito'),
      document.fonts.load('600 16px Grenze'),
    ]);
    return {
      nunito: document.fonts.check('400 16px Nunito'),
      grenze: document.fonts.check('600 16px Grenze'),
      body: getComputedStyle(document.body).fontFamily,
      heading: getComputedStyle(document.querySelector('h1') as Element).fontFamily,
    };
  });
  expect(loaded).toMatchObject({ nunito: true, grenze: true });
  expect(loaded.body).toMatch(/^"?Nunito/);
  expect(loaded.heading).toMatch(/^"?Grenze/);
  expect([...fontHosts]).toEqual([new URL(page.url()).host]);
});

test('parchment in light mode and night sky in dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openApp(page);
  expect(await bodyBackground(page)).toBe('rgb(244, 234, 213)');
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await bodyBackground(page)).toBe('rgb(20, 18, 51)');
});

/** Adds an element that would animate and fade, and reads how long the browser will actually run both. */
const probeMotion = (page: Page) =>
  page.evaluate(() => {
    const el = document.createElement('div');
    el.style.cssText = 'transition: opacity 250ms; animation: probe 250ms infinite;';
    document.body.append(el);
    const s = getComputedStyle(el);
    const result = {
      transition: s.transitionDuration,
      animation: s.animationDuration,
      token: getComputedStyle(document.documentElement).getPropertyValue('--motion-base').trim(),
    };
    el.remove();
    return result;
  });

test('reduced motion stops every CSS animation and transition', async ({ page }) => {
  await openApp(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await probeMotion(page)).toEqual({
    transition: '0.25s',
    animation: '0.25s',
    token: '250ms',
  });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await probeMotion(page)).toEqual({ transition: '0s', animation: '0s', token: '0ms' });
});

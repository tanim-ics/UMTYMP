// Task 21: the themed screens in a real browser. A timed mock stays still (only the timer text changes), the one
// celebration plays on the results screen and stops under reduced motion, and the static screens keep their look.
import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers.ts';

/** Everything that moves or could move: running Web Animations, and any element with a CSS animation or transition. */
const motionOnPage = (page: Page) =>
  page.evaluate(() => {
    const running = document.getAnimations().filter((a) => a.playState === 'running').length;
    const moving = [...document.querySelectorAll('*')]
      .filter((el) => {
        const s = getComputedStyle(el);
        const transitions = s.transitionDuration.split(',').some((d) => parseFloat(d) > 0);
        return s.animationName !== 'none' || transitions;
      })
      .map((el) => el.getAttribute('data-testid') ?? el.tagName.toLowerCase());
    return { running, moving };
  });

const imagesLoaded = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('img')].every((img) => img.complete && img.naturalWidth > 0),
  );

test('a timed Grand Trial has nothing that moves, while answering, flagging and moving on', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openApp(page, '?clock=fake');
  await page.getByTestId('home.start').click();
  await expect(page.getByTestId('trial.mascot')).toBeVisible();
  expect(await imagesLoaded(page)).toBe(true);
  expect(await motionOnPage(page)).toEqual({ running: 0, moving: [] });

  await page.keyboard.press('1');
  await page.keyboard.press('f');
  await page.getByTestId('trial.answer-B').hover();
  expect(await motionOnPage(page)).toEqual({ running: 0, moving: [] });
  await page.keyboard.press('Enter');
  await page.evaluate(() => window.__umtymp?.clock?.advance(61_000));
  await expect(page.getByTestId('trial.timer')).toHaveText('23:59');
  expect(await motionOnPage(page)).toEqual({ running: 0, moving: [] });
});

test('the results screen celebrates, and reduced motion keeps it still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openApp(page);
  await page.getByTestId('home.start').click();
  await page.getByTestId('trial.finish').click();
  await expect(page.getByTestId('result.celebrate')).toBeVisible();
  expect((await motionOnPage(page)).running).toBeGreaterThan(0);

  await page.getByTestId('result.home').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByTestId('home.start').click();
  await page.getByTestId('trial.finish').click();
  await expect(page.getByTestId('result.celebrate')).toBeVisible();
  expect((await motionOnPage(page)).running).toBe(0);
});

// Screenshots only of screens with nothing that changes (CLAUDE.md §8). Baselines live next to this file;
// refresh them with `docker compose run --rm e2e npx playwright test screens --update-snapshots` after a look change.
for (const colorScheme of ['light', 'dark'] as const) {
  test(`static screens look right (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome to Comparia Academy!' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await imagesLoaded(page)).toBe(true);
    await expect(page).toHaveScreenshot(`welcome-${colorScheme}.png`, { fullPage: true });

    await openApp(page);
    await page.evaluate(() => document.fonts.ready);
    expect(await imagesLoaded(page)).toBe(true);
    await expect(page).toHaveScreenshot(`home-${colorScheme}.png`, { fullPage: true });

    await page.getByTestId('home.castle').click();
    await expect(page.getByTestId('castle.empty')).toBeVisible();
    expect(await imagesLoaded(page)).toBe(true);
    await expect(page).toHaveScreenshot(`castle-empty-${colorScheme}.png`, { fullPage: true });
  });
}

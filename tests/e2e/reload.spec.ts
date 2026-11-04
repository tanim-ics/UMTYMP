import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers.ts';

// The real clock on purpose: the point is that time keeps running across a reload.
async function open(page: Page) {
  await openApp(page);
}

/** Seconds left on the trial timer, read from the screen. */
async function secondsLeft(page: Page): Promise<number> {
  const [m = '0', s = '0'] = (await page.getByTestId('trial.timer').innerText()).split(':');
  return Number(m) * 60 + Number(s);
}

test('a reload mid-mock resumes where the student was, with the clock still running', async ({
  page,
}) => {
  await open(page);
  await page.getByTestId('home.start').click();
  await page.keyboard.press('2');
  await page.keyboard.press('f');
  await page.keyboard.press('Enter');
  await page.keyboard.press('3');
  await page.waitForTimeout(2500);

  // Reload only after the last change is saved; see docs/CONTRACTS.md (unload limit).
  await page.evaluate(() => window.__umtymp?.flush());
  await page.reload();
  await expect(page.getByTestId('trial.position')).toHaveText(/^Question 2 of/);
  await expect(page.getByTestId('trial.answer-C')).toHaveAttribute('aria-pressed', 'true');
  const left = await secondsLeft(page);
  expect(left).toBeLessThanOrEqual(25 * 60 - 2);
  // Still counting down after the reload.
  await expect.poll(() => secondsLeft(page), { timeout: 5000 }).toBeLessThan(left);

  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('trial.answer-B')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('trial.flag')).toHaveAttribute('aria-pressed', 'true');
});

test('finished mocks are listed on the home screen after a reload', async ({ page }) => {
  await open(page);
  await page.getByTestId('home.start').click();
  await page.keyboard.press('2');
  await page.getByTestId('trial.finish').click();
  await page.getByTestId('result.home').click();
  await expect(page.getByTestId('home.history-item')).toHaveCount(1);

  // Reload only after the last change is saved; see docs/CONTRACTS.md (unload limit).
  await page.evaluate(() => window.__umtymp?.flush());
  await page.reload();
  await expect(page.getByTestId('home.start')).toBeVisible();
  await expect(page.getByTestId('home.history-item')).toHaveCount(1);
  await expect(page.getByTestId('home.history-item')).toContainText('finished');
});

test('a finished mock is not resumed after a reload', async ({ page }) => {
  await open(page);
  await page.getByTestId('home.start').click();
  await page.getByTestId('trial.finish').click();
  // Reload only after the last change is saved; see docs/CONTRACTS.md (unload limit).
  await page.evaluate(() => window.__umtymp?.flush());
  await page.reload();
  await expect(page.getByTestId('home.start')).toBeVisible();
});

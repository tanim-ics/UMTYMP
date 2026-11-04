import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const MOCK_MS = 25 * 60_000;

interface TrialSnapshot {
  screen: string;
  index: number;
  total: number;
  endReason: string | null;
  answers: { itemId: string; status: string; choice: string | null }[];
}

/** Opens the app with the fake clock, so time moves only through the test hook. */
async function open(page: Page) {
  await page.goto('/?clock=fake');
  await page.waitForFunction(() => window.__umtymp !== undefined);
}

const snapshot = (page: Page) => page.evaluate(() => window.__umtymp?.state() as TrialSnapshot);

test('a full Grand Trial can be done with the keyboard only', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('home.start')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('trial.position')).toBeVisible();

  const { total } = await snapshot(page);
  for (let i = 0; i < total; i++) {
    await expect(page.getByTestId('trial.position')).toHaveText(`Question ${i + 1} of ${total}`);
    await page.keyboard.press(String((i % 4) + 1));
    await page.keyboard.press('Enter');
  }
  // The last Enter only moves focus to Finish; this one presses it.
  await expect(page.getByTestId('trial.finish')).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('result.score')).toContainText(`of ${total} correct`);
  const end = await snapshot(page);
  expect(end.endReason).toBe('completed');
  expect(end.answers).toHaveLength(total);
  expect(end.answers.every((a) => a.status === 'answered')).toBe(true);
});

test('going back and changing an answer keeps one answer per question', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__umtymp?.seed(1));
  await page.keyboard.press('1');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('3');
  await expect(page.getByTestId('trial.answer-C')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('trial.answer-A')).toHaveAttribute('aria-pressed', 'false');
  const { answers } = await snapshot(page);
  expect(answers).toEqual([expect.objectContaining({ choice: 'C', status: 'answered' })]);
});

test('time-up ends the trial and records unanswered questions', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__umtymp?.seed(2));
  await page.keyboard.press('2');
  await expect(page.getByTestId('trial.timer')).toHaveText('25:00');
  await page.evaluate((ms) => window.__umtymp?.clock?.advance(ms), 60_000);
  await expect(page.getByTestId('trial.timer')).toHaveText('24:00');
  await page.evaluate((ms) => window.__umtymp?.clock?.advance(ms), MOCK_MS);

  await expect(page.getByTestId('result.reason')).toContainText('time ran out');
  const end = await snapshot(page);
  expect(end.endReason).toBe('time_up');
  expect(end.answers.filter((a) => a.status === 'answered')).toHaveLength(1);
  expect(end.answers.filter((a) => a.status === 'unanswered')).toHaveLength(end.total - 1);
});

test('skipping every question still records each one', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__umtymp?.seed(3));
  const { total } = await snapshot(page);
  for (let i = 0; i < total; i++) await page.keyboard.press('s');
  await page.getByTestId('trial.finish').click();
  const end = await snapshot(page);
  expect(end.answers.map((a) => a.status)).toEqual(Array(total).fill('skipped'));
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`@a11y no serious or critical axe issues on home, trial and result (${colorScheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await open(page);
    const scan = async (where: string) => {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${where}: ${v.id} (${v.nodes.length})`);
      expect(blocking).toEqual([]);
    };
    await scan('home');
    await page.getByTestId('home.start').click();
    await page.keyboard.press('2');
    await page.keyboard.press('f');
    await scan('trial');
    await page.getByTestId('trial.finish').click();
    await scan('result');
  });
}

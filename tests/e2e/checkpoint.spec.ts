import { expect, test, type Page } from '@playwright/test';

// Checkpoint B: a full 50-item mock (seed bank repeated, dev only) runs end to end and survives a reload.
// Real clock on purpose, so the reload happens while time is really running.

interface Snapshot {
  total: number;
  endReason: string | null;
  answers: { status: string }[];
}
const snapshot = (page: Page) => page.evaluate(() => window.__umtymp?.state() as Snapshot);

async function answerFrom(page: Page, from: number, to: number) {
  for (let i = from; i < to; i++) {
    await expect(page.getByTestId('trial.position')).toHaveText(`Question ${i + 1} of 50`);
    await page.keyboard.press(String((i % 4) + 1));
    await page.keyboard.press('Enter');
  }
}

test('Checkpoint B: a full 50-item mock runs end to end and survives a reload', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('/?bank=repeat');
  await page.waitForFunction(() => window.__umtymp !== undefined);
  await page.getByTestId('home.start').click();
  expect((await snapshot(page)).total).toBe(50);

  await answerFrom(page, 0, 25);
  // Reload only after the last change is saved; see docs/CONTRACTS.md (unload limit).
  await page.evaluate(() => window.__umtymp?.flush());
  await page.reload();
  await page.waitForFunction(() => window.__umtymp !== undefined);
  await expect(page.getByTestId('trial.position')).toHaveText('Question 26 of 50');
  expect((await snapshot(page)).answers.filter((a) => a.status === 'answered')).toHaveLength(25);

  await answerFrom(page, 25, 50);
  await expect(page.getByTestId('trial.finish')).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('result.score')).toContainText('of 50 correct');
  const end = await snapshot(page);
  expect(end.endReason).toBe('completed');
  expect(end.answers).toHaveLength(50);
  expect(end.answers.every((a) => a.status === 'answered')).toBe(true);

  await page.getByTestId('result.home').click();
  // Reload only after the last change is saved; see docs/CONTRACTS.md (unload limit).
  await page.evaluate(() => window.__umtymp?.flush());
  await page.reload();
  await expect(page.getByTestId('home.history-item')).toHaveCount(1);
  await expect(page.getByTestId('home.history-item')).toContainText('of 50 correct');
});

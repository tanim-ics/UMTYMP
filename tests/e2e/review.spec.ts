import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers.ts';

interface Snapshot {
  total: number;
  answers: { status: string; correct: boolean }[];
}
const snapshot = (page: Page) => page.evaluate(() => window.__umtymp?.state() as Snapshot);
const advance = (page: Page, ms: number) =>
  page.evaluate((t) => window.__umtymp?.clock?.advance(t), ms);

/** A mock with one slow answer (40 s), one flagged answer, one skip, the rest left unanswered. */
async function finishMock(page: Page) {
  await openApp(page, '?clock=fake');
  await page.evaluate(() => window.__umtymp?.seed(4));
  await advance(page, 40_000);
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await page.keyboard.press('f');
  await page.keyboard.press('2');
  await page.keyboard.press('Enter');
  await page.keyboard.press('s');
  await page.getByTestId('trial.finish').click();
  await expect(page.getByTestId('result.score')).toBeVisible();
}

test('after a mock the results lead to a review that filters wrong, slow and flagged', async ({
  page,
}) => {
  await finishMock(page);
  const { total, answers } = await snapshot(page);
  const right = answers.filter((a) => a.correct).length;
  await expect(page.getByTestId('result.score')).toHaveText(`${right} of ${total} correct`);
  await expect(page.getByTestId('result.summary')).toContainText('1 skipped');
  await expect(page.getByTestId('result.summary')).toContainText(`${total - 3} unanswered`);
  await expect(page.getByTestId('result.summary')).toContainText('1 slow');

  await page.getByTestId('result.review').click();
  await expect(page.getByTestId('review.item')).toHaveCount(total);

  await page.getByTestId('review.filter-wrong').click();
  await expect(page.getByTestId('review.item')).toHaveCount(total - right);

  await page.getByTestId('review.filter-slow').click();
  await expect(page.getByTestId('review.item')).toHaveCount(1);
  await expect(page.getByTestId('review.time')).toHaveText('40 s · slow');

  await page.getByTestId('review.filter-flagged').click();
  await expect(page.getByTestId('review.item')).toHaveCount(1);
  await expect(page.getByTestId('review.flagged')).toBeVisible();

  await page.getByTestId('review.back').click();
  await expect(page.getByTestId('result.score')).toBeVisible();
});

test('the review works with the keyboard alone', async ({ page }) => {
  await finishMock(page);
  await page.getByTestId('result.review').focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('review.filter-slow').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('review.item')).toHaveCount(1);
  await page.getByTestId('review.back').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('result.score')).toBeVisible();
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`@a11y no serious or critical axe issues on results and review (${colorScheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await finishMock(page);
    const scan = async (where: string) => {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${where}: ${v.id} (${v.nodes.length})`);
      expect(blocking).toEqual([]);
    };
    await scan('results');
    await page.getByTestId('result.review').click();
    await scan('review');
    await page.getByTestId('review.filter-flagged').click();
    await scan('review filtered');
  });
}

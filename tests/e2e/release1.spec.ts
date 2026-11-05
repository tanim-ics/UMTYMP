// Checkpoint D: the Release 1 story details that other specs cover only in unit tests, seen in a real browser.
import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers.ts';

const state = (page: Page) =>
  page.evaluate(() => window.__umtymp?.state() as Record<string, unknown> & { answers: unknown[] });

/** Pretends the tab was hidden or shown again (Playwright tabs are always "visible"). */
async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (h ? 'hidden' : 'visible'),
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test('S1: a Grand Trial can be answered by tap alone, with going back to change an answer', async ({
  page,
}) => {
  await openApp(page, '?bank=repeat&clock=fake');
  await page.getByTestId('home.start').click();
  await page.getByTestId('trial.answer-A').click();
  await page.getByTestId('trial.next').click();
  await page.getByTestId('trial.answer-C').click();
  await page.getByTestId('trial.back').click();
  await page.getByTestId('trial.answer-B').click();
  await page.getByTestId('trial.finish').click();

  await expect(page.getByTestId('result.score')).toContainText('of 50 correct');
  const end = await state(page);
  expect(end.answers.slice(0, 2)).toMatchObject([
    { status: 'answered', choice: 'B' },
    { status: 'answered', choice: 'C' },
  ]);
});

test('S1: hiding the tab does not stop the clock, and the hidden spell is recorded', async ({
  page,
}) => {
  await openApp(page, '?bank=repeat&clock=fake');
  await page.getByTestId('home.start').click();
  await expect(page.getByTestId('trial.timer')).toHaveText('25:00');

  await setHidden(page, true);
  await page.evaluate(() => window.__umtymp?.clock?.advance(60_000));
  await setHidden(page, false);

  await expect(page.getByTestId('trial.timer')).toHaveText('24:00');
  expect(await state(page)).toMatchObject({ screen: 'trial', hiddenCount: 1 });
});

test('S5: a timed Spellbook set counts down and ends at time-up, recording what was left', async ({
  page,
}) => {
  await openApp(page, '?bank=repeat&clock=fake');
  await page.getByTestId('home.spellbook').click();
  await page.getByTestId('spellbook.timed').check();
  await page.getByTestId('spellbook.length').fill('5');
  await page.getByTestId('spellbook.start').click();

  // 5 questions × 30 s.
  await expect(page.getByTestId('trial.timer')).toHaveText('2:30');
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await page.evaluate(() => window.__umtymp?.clock?.advance(150_000));

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Practice complete!');
  const end = await state(page);
  expect(end).toMatchObject({ endReason: 'time_up', total: 5 });
  expect(end.answers.map((a) => (a as { status: string }).status)).toEqual([
    'answered',
    'unanswered',
    'unanswered',
    'unanswered',
    'unanswered',
  ]);
});

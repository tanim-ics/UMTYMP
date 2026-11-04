import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers.ts';

interface Snapshot {
  total: number;
  endReason: string | null;
  answers: { status: string }[];
}
const snapshot = (page: Page) => page.evaluate(() => window.__umtymp?.state() as Snapshot);

async function open(page: Page) {
  // The seed bank has only 4 level-3 questions; the dev-only repeat makes a set of 5 possible.
  await openApp(page, '?bank=repeat&clock=fake');
  await page.getByTestId('home.spellbook').click();
}

test('an untimed level-3 set of 5 runs and ends on its results', async ({ page }) => {
  await open(page);
  await page.getByTestId('spellbook.level-3').check();
  await page.getByTestId('spellbook.length').fill('5');
  await expect(page.getByTestId('spellbook.matching')).toHaveText('16 questions match.');
  await page.getByTestId('spellbook.start').click();

  await expect(page.getByTestId('trial.position')).toHaveText('Question 1 of 5');
  await expect(page.getByTestId('trial.timer')).toHaveText('0:00');
  await page.evaluate(() => window.__umtymp?.clock?.advance(65_000));
  await expect(page.getByTestId('trial.timer')).toHaveText('1:05');

  for (let i = 0; i < 5; i++) {
    await page.keyboard.press(String((i % 4) + 1));
    await page.keyboard.press('Enter');
  }
  await expect(page.getByTestId('trial.finish')).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Practice complete!');
  await expect(page.getByTestId('result.score')).toContainText('of 5 correct');
  const end = await snapshot(page);
  expect(end.total).toBe(5);
  expect(end.answers.every((a) => a.status === 'answered')).toBe(true);
  await page.getByTestId('result.home').click();
  await expect(page.getByTestId('home.start')).toBeVisible();
});

test('a set can be chosen and started with the keyboard alone', async ({ page }) => {
  await open(page);
  await page.getByTestId('spellbook.level-3').focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('spellbook.level-3')).toBeChecked();
  await page.getByTestId('spellbook.timed').focus();
  await page.keyboard.press('Space');
  await page.getByTestId('spellbook.length').focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('5');
  await page.getByTestId('spellbook.start').focus();
  await page.keyboard.press('Enter');
  // Timed: 5 × 30 s.
  await expect(page.getByTestId('trial.timer')).toHaveText('2:30');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`@a11y no serious or critical axe issues on the Spellbook (${colorScheme})`, async ({
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
    await scan('spellbook');
    await page.getByTestId('spellbook.length').fill('99');
    await scan('spellbook with a length error');
    await page.getByTestId('spellbook.length').fill('5');
    await page.getByTestId('spellbook.start').click();
    await scan('practice session');
  });
}

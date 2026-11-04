import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers.ts';

async function open(page: Page, query = '?bank=repeat&clock=fake') {
  await openApp(page, query);
}

/** A full 50-item mock answered by keyboard; the answers cycle 1–4 so some are right and some wrong. */
async function playMock(page: Page) {
  await page.getByTestId('home.start').click();
  for (let i = 0; i < 50; i++) {
    await page.keyboard.press(String((i % 4) + 1));
    await page.keyboard.press('Enter');
  }
  await page.keyboard.press('Enter'); // focus is on Finish after the last Enter
  await expect(page.getByTestId('result.score')).toBeVisible();
}

test('mock → coach → potion drill → back to the mock results', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  await playMock(page);
  const mockScore = await page.getByTestId('result.score').innerText();

  await expect(page.getByTestId('coach.strength')).toContainText('Strongest spell:');
  await expect(page.getByTestId('coach.bottleneck')).toContainText(
    /Biggest leak|Nothing slipped|No single/,
  );
  await page.getByTestId('coach.brew').click();

  await expect(page.getByTestId('drill.position')).toContainText('Potion question 1 of');
  const total = Number(
    (await page.getByTestId('drill.position').innerText()).match(/of (\d+)/)?.[1] ?? 0,
  );
  expect(total).toBeGreaterThan(0);

  // Pause hides the question; resume brings it back.
  await page.keyboard.press('p');
  await expect(page.getByTestId('drill.paused')).toBeVisible();
  await expect(page.getByTestId('trial.quantity-a')).toHaveCount(0);
  await page.keyboard.press('p');

  for (let i = 0; i < total; i++) {
    await page.keyboard.press('1');
    await expect(page.getByTestId('drill.feedback')).toContainText('Shortcut:');
    await page.keyboard.press('Enter');
  }
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Potion brewed!');

  await page.getByTestId('result.back').click();
  await expect(page.getByTestId('result.score')).toHaveText(mockScore);
  await expect(page.getByTestId('coach.card')).toBeVisible();
});

test('loadFixture shows a known coach state', async ({ page }) => {
  await open(page, '?clock=fake');
  // "Not enough data" first: fixtures are saved like real mocks, and the coach reads the whole history.
  await page.evaluate(() => window.__umtymp?.loadFixture('not-enough-data'));
  await expect(page.getByTestId('coach.not-enough')).toBeVisible();
  await page.getByTestId('result.home').click();
  await page.evaluate(() => window.__umtymp?.loadFixture('all-right'));
  await expect(page.getByTestId('coach.bottleneck')).toHaveText(/^Nothing slipped/);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`@a11y no serious or critical axe issues on the coach card and the drill (${colorScheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await open(page, '?clock=fake');
    await page.evaluate(() => window.__umtymp?.loadFixture('all-wrong'));
    const scan = async (where: string) => {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${where}: ${v.id} (${v.nodes.length})`);
      expect(blocking).toEqual([]);
    };
    await expect(page.getByTestId('coach.card')).toBeVisible();
    await scan('coach card');
    await page.getByTestId('coach.brew').click();
    await page.keyboard.press('1');
    await expect(page.getByTestId('drill.feedback')).toBeVisible();
    await scan('drill with feedback');
    await page.keyboard.press('p');
    await scan('drill paused');
  });
}

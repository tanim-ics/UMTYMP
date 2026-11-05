import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers.ts';

/** Answers a full 50-item mock by keyboard (cycling 1–4) and returns home. */
async function playMock(page: Page) {
  await page.getByTestId('home.start').click();
  for (let i = 0; i < 50; i++) {
    await page.keyboard.press(String((i % 4) + 1));
    await page.keyboard.press('Enter');
  }
  await page.keyboard.press('Enter');
  await page.getByTestId('result.home').click();
}

async function blockingAxe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.nodes.length})`);
}

test('a new student sees where to start, and Start opens a Grand Trial', async ({ page }) => {
  await openApp(page, '?clock=fake');
  await page.getByTestId('home.castle').click();
  await expect(page.getByTestId('castle.empty')).toContainText('Start with a Grand Trial');
  await expect(page.getByTestId('castle.tower').first()).toContainText('locked');
  await page.getByTestId('castle.start').click();
  await expect(page.getByTestId('trial.timer')).toBeVisible();
});

test('after a mock the map shows its trend row, tables and opened towers', async ({ page }) => {
  test.setTimeout(90_000);
  await openApp(page, '?bank=repeat&clock=fake');
  await playMock(page);
  await page.getByTestId('home.castle').click();

  const rows = page.getByTestId('castle.trend').locator('tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('of 50');
  await expect(page.getByTestId('castle.topics').locator('tbody tr').first()).toBeVisible();
  await expect(page.getByTestId('castle.levels').locator('tbody tr')).toHaveCount(5);
  await expect(page.locator('[data-testid="castle.tower"][data-unlocked="true"]')).toContainText([
    'Gate Tower: open',
    'Clock Tower: open',
  ]);
  await expect(page.getByTestId('castle.empty')).toHaveCount(0);

  await page.getByTestId('castle.back').click();
  await expect(page.getByRole('heading', { name: 'Comparia Academy' })).toBeVisible();
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`@a11y no serious or critical axe issues on the castle map (${colorScheme})`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme });
    await openApp(page, '?bank=repeat&clock=fake');
    await page.getByTestId('home.castle').click();
    await expect(page.getByTestId('castle.empty')).toBeVisible();
    expect(await blockingAxe(page)).toEqual([]);
    await page.getByTestId('castle.back').click();
    await playMock(page);
    await page.getByTestId('home.castle').click();
    await expect(page.getByTestId('castle.trend')).toBeVisible();
    expect(await blockingAxe(page)).toEqual([]);
  });
}

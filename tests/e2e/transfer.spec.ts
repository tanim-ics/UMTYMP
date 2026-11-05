import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
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
  await expect(page.getByTestId('home.history-item')).toHaveCount(1);
}

/** What the student sees: the history line and Hoot's numbers. */
async function studentNumbers(page: Page) {
  await page.evaluate(() => window.__umtymp?.flush());
  // The history list loads after home appears; read it only once it is there.
  await expect(page.getByTestId('home.history-item')).toHaveCount(1);
  return {
    history: await page.getByTestId('home.history-item').allInnerTexts(),
    coach: await page.evaluate(() => window.__umtymp?.coachTexts()),
  };
}

test('export → reset → import gives identical history and coach numbers', async ({ page }) => {
  test.setTimeout(90_000);
  await openApp(page, '?bank=repeat&clock=fake');
  await playMock(page);
  const before = await studentNumbers(page);
  expect(before.coach?.strength).toMatch(/^Strongest spell/);

  await page.getByTestId('home.switch').click();
  await page.getByTestId('profiles.settings').click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Tester' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^comparia-tester-\d{4}-\d{2}-\d{2}\.json$/);
  const saved = await download.path();
  const text = await readFile(saved, 'utf8');
  expect(JSON.parse(text)).toMatchObject({ app: 'comparia-academy', format: 1 });

  await page.getByTestId('settings.reset').click();
  await page.getByTestId('settings.confirm-reset').click();
  await expect(page.getByRole('heading', { name: 'Welcome to Comparia Academy!' })).toBeVisible();

  // A new device: import straight from the Welcome screen.
  await page.getByTestId('profiles.settings').click();
  await page.getByTestId('settings.import').setInputFiles(saved);
  await expect(page.getByTestId('settings.import-ok')).toHaveText('Added Tester.');
  await page.getByTestId('settings.back').click();
  await page.getByTestId('profiles.choose').click();
  await expect(page.getByTestId('home.player')).toContainText('Playing as Tester');

  expect(await studentNumbers(page)).toEqual(before);
});

test('a damaged file is refused with a clear message', async ({ page }) => {
  await openApp(page, '?clock=fake');
  await page.getByTestId('home.switch').click();
  await page.getByTestId('profiles.settings').click();
  await page.getByTestId('settings.import').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"app":"comparia-academy","format":1,"profile":{}}'),
  });
  await expect(page.getByTestId('settings.import-error')).toContainText("can't be imported");
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`@a11y no serious or critical axe issues on Settings & data (${colorScheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await openApp(page, '?clock=fake');
    await page.getByTestId('home.switch').click();
    await page.getByTestId('profiles.settings').click();
    const scan = async (where: string) => {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${where}: ${v.id} (${v.nodes.length})`);
      expect(blocking).toEqual([]);
    };
    await scan('settings');
    await page.getByTestId('settings.import').setInputFiles({
      name: 'x.json',
      mimeType: 'application/json',
      buffer: Buffer.from('nope'),
    });
    await expect(page.getByTestId('settings.import-error')).toBeVisible();
    await scan('settings with an import error');
    await page.getByTestId('settings.reset').click();
    await scan('reset confirmation');
  });
}

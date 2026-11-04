import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers.ts';

async function addStudent(page: Page, name: string, house: string, color: string) {
  await page.getByTestId('home.switch').click();
  await page.getByTestId('profiles.add').click();
  await page.getByTestId('profiles.name').fill(name);
  await page.getByTestId(`profiles.house-${house}`).check();
  await page.getByTestId(`profiles.color-${color}`).check();
  await page.getByTestId('profiles.save').click();
  await expect(page.getByTestId('home.player')).toContainText(`Playing as ${name}`);
}

/** Every row of one object store in the app's real IndexedDB. */
function readStore(page: Page, store: string) {
  return page.evaluate(
    (name) =>
      new Promise<unknown[]>((resolve, reject) => {
        const open = indexedDB.open('umtymp');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result.transaction(name).objectStore(name).getAll();
          request.onsuccess = () => {
            resolve(request.result as unknown[]);
            open.result.close();
          };
          request.onerror = () => reject(request.error);
        };
      }),
    store,
  );
}

test('create → switch → delete, and each student keeps their own history', async ({ page }) => {
  await openApp(page, '?clock=fake'); // creates "Tester"
  await page.getByTestId('home.start').click();
  await page.getByTestId('trial.finish').click();
  await page.getByTestId('result.home').click();
  await expect(page.getByTestId('home.history-item')).toHaveCount(1);

  await addStudent(page, 'Ali', 'starhorn', 'rose');
  await expect(page.getByTestId('home.history-item')).toHaveCount(0); // Ali's history is empty

  await page.getByTestId('home.switch').click();
  await page.getByTestId('profiles.choose').filter({ hasText: 'Tester' }).click();
  await expect(page.getByTestId('home.player')).toContainText('Playing as Tester');
  await expect(page.getByTestId('home.history-item')).toHaveCount(1);

  await page.getByTestId('home.switch').click();
  await page.getByTestId('profiles.manage').click();
  await page.getByTestId('profiles.delete').last().click(); // sorted by name: Ali, Tester
  await expect(page.getByRole('alertdialog')).toContainText(
    'Delete Tester and all of their progress?',
  );
  await page.getByTestId('profiles.confirm-delete').click();
  await expect(page.getByTestId('profiles.rename-input')).toHaveCount(1);
  expect(await readStore(page, 'sessions')).toEqual([]); // Tester's mock went with Tester

  await page.getByTestId('profiles.manage').click();
  await page.getByTestId('profiles.choose').click();
  await expect(page.getByTestId('home.player')).toContainText('Playing as Ali');
});

test('storage holds nothing about a child beyond a display name, a house and a colour', async ({
  page,
}) => {
  await openApp(page, '?clock=fake');
  await addStudent(page, 'Ali', 'emberwing', 'gold');
  await page.getByTestId('home.start').click();
  await page.keyboard.press('2');
  await page.evaluate(() => window.__umtymp?.flush());

  const profiles = (await readStore(page, 'profiles')) as Record<string, unknown>[];
  expect(profiles).toHaveLength(2);
  for (const p of profiles) {
    expect(Object.keys(p).sort()).toEqual(['displayName', 'house', 'id', 'mascotColor']);
  }
  // Sessions point at a profile by id only; no other personal field anywhere.
  const sessions = (await readStore(page, 'sessions')) as Record<string, unknown>[];
  for (const s of sessions) {
    expect(Object.keys(s).sort()).toEqual([
      'endReason',
      'flags',
      'id',
      'index',
      'itemIds',
      'lastShownAt',
      'mode',
      'profileId',
      'shownAt',
      'startedAt',
      'timer',
    ]);
  }
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`@a11y no serious or critical axe issues on the profile screens (${colorScheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/?clock=fake');
    await page.waitForFunction(() => window.__umtymp !== undefined);
    const scan = async (where: string) => {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${where}: ${v.id} (${v.nodes.length})`);
      expect(blocking).toEqual([]);
    };
    await expect(page.getByRole('heading', { name: 'Welcome to Comparia Academy!' })).toBeVisible();
    await scan('welcome');
    await page.getByTestId('profiles.save').click();
    await scan('welcome with an error');
    await page.getByTestId('profiles.name').fill('Mo');
    await page.getByTestId('profiles.house-foxglen').check();
    await page.getByTestId('profiles.color-teal').check();
    await page.getByTestId('profiles.save').click();
    await scan('home with player');
    await page.getByTestId('home.switch').click();
    await scan("who's playing");
    await page.getByTestId('profiles.manage').click();
    await scan('manage');
    await page.getByTestId('profiles.delete').click();
    await scan('delete confirmation');
  });
}

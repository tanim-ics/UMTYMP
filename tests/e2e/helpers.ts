import { expect, type Page } from '@playwright/test';

/**
 * Opens the app and gets to home. A fresh browser context has no profiles, so the first run's Welcome form is filled
 * in with a test student; after that, the single profile is picked automatically.
 */
export async function openApp(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await page.waitForFunction(() => window.__umtymp !== undefined);
  const welcome = page.getByRole('heading', { name: 'Welcome to Comparia Academy!' });
  const home = page.getByTestId('home.player');
  await expect(welcome.or(home)).toBeVisible();
  if (await welcome.isVisible()) {
    await page.getByTestId('profiles.name').fill('Tester');
    await page.getByTestId('profiles.house-owlcrest').check();
    await page.getByTestId('profiles.color-purple').check();
    await page.getByTestId('profiles.save').click();
  }
  await expect(home).toBeVisible();
}

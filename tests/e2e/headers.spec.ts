// Task 24: the security headers from docker/security-headers.conf, in a real browser. `vite preview` sends the same
// file's headers as nginx (vite.config.ts reads it), so a policy that would break the app breaks here first: every
// screen is used once and the browser must report no Content-Security-Policy violation.
import { expect, test } from '@playwright/test';

test('every response carries the security headers', async ({ page, request }) => {
  await page.goto('/');
  const asset = await page.locator('script[type="module"]').first().getAttribute('src');
  for (const path of ['/', asset ?? '', '/sw.js', '/manifest.webmanifest', '/art/hoot.svg']) {
    const headers = (await request.get(path)).headers();
    expect(headers['content-security-policy'], path).toContain("default-src 'self'");
    expect(headers['x-content-type-options'], path).toBe('nosniff');
    expect(headers['referrer-policy'], path).toBe('no-referrer');
  }
});

test('the content security policy blocks nothing the app does', async ({ page }) => {
  const violations: string[] = [];
  await page.exposeFunction('reportViolation', (v: string) => violations.push(v));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { reportViolation: (v: string) => void }).reportViolation(
        `${e.violatedDirective} ${e.blockedURI} at ${e.sourceFile}:${e.lineNumber}:${e.columnNumber}`,
      );
    });
  });
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content.Security.Policy/i.test(m.text()))
      violations.push(m.text());
  });

  await page.goto('/');
  await page.getByTestId('profiles.name').fill('Robin');
  await page.getByTestId('profiles.house-foxglen').check();
  await page.getByTestId('profiles.color-gold').check();
  await page.getByTestId('profiles.save').click();
  await page.getByTestId('home.start').click();
  await page.keyboard.press('2');
  await page.keyboard.press('Enter');
  await page.keyboard.press('f');
  await page.getByTestId('trial.finish').click();
  await page.getByTestId('result.review').click();
  await expect(page.locator('.katex').first()).toBeVisible();
  await page.getByTestId('review.back').click();
  await page.getByTestId('result.home').click();
  await page.getByTestId('home.spellbook').click();
  await page.getByTestId('spellbook.back').click();
  await page.getByTestId('home.castle').click();
  await page.getByTestId('castle.back').click();
  await page.getByTestId('home.switch').click();
  await page.getByTestId('profiles.settings').click();
  const download = page.waitForEvent('download');
  await page.getByTestId('settings.export').click();
  await download;
  await page.evaluate(() => document.fonts.ready);
  expect(violations).toEqual([]);
});

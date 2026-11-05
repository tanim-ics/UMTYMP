// Task 22: the accessibility pass over every screen, in a real browser (Chromium and WebKit), light and dark.
// axe-core checks WCAG 2.1 A/AA. It doesn't check the house rules from CLAUDE.md §7, so this spec does: every control
// has a `<screen>.<control>` test id and a target of at least 48 px, Tab reaches every control, and the focused
// control shows a solid ring at least 2 px wide. Formulas are announced in words, and a student can get from the
// first visit to the review of a finished mock with the keyboard alone.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { spokenMath } from '../../src/core/questions/spoken.ts';
import { openApp } from './helpers.ts';

const MOCK_MS = 25 * 60_000;

async function axeProblems(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `axe ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

/** Test ids and tap targets of every visible, enabled control. A radio or checkbox is tapped through its label. */
const controlProblems = (page: Page) =>
  page.evaluate(() => {
    const problems: string[] = [];
    const controls = [
      ...document.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, a[href], [tabindex]',
      ),
    ].filter((el) => el.getClientRects().length > 0 && !el.matches(':disabled'));
    for (const el of controls) {
      const id = el.getAttribute('data-testid');
      const what =
        id ?? `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}"`;
      if (id === null || !/^[a-z]+\.[a-zA-Z0-9_-]+$/.test(id))
        problems.push(`${what}: no <screen>.<control> test id`);
      const target = el.closest('label') ?? el;
      const { width, height } = target.getBoundingClientRect();
      if (width < 47.5 || height < 47.5)
        problems.push(`${what}: target ${Math.round(width)}×${Math.round(height)}`);
    }
    return problems;
  });

/**
 * Presses Tab from the top of the page until focus comes back round, and reports controls Tab never reaches and
 * stops with no visible ring. Radios count once per group, because Tab enters a group once and arrows move inside.
 */
async function focusProblems(page: Page): Promise<string[]> {
  const keyOf = () =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (el === null || el === document.body) return null;
      const key =
        el instanceof HTMLInputElement && el.type === 'radio'
          ? `radio:${el.name}`
          : (el.dataset.testid ?? el.tagName);
      const s = getComputedStyle(el);
      const ring =
        s.outlineStyle !== 'none' && s.outlineStyle !== 'auto' && parseFloat(s.outlineWidth) >= 2;
      return { key, ring };
    });
  const expected = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]')]
      .filter((el) => el.getClientRects().length > 0 && !el.matches(':disabled'))
      .map((el) =>
        el instanceof HTMLInputElement && el.type === 'radio'
          ? `radio:${el.name}`
          : (el.dataset.testid ?? el.tagName),
      ),
  );
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const reached = new Map<string, boolean>();
  for (let i = 0; i < expected.length + 5; i++) {
    await page.keyboard.press('Tab');
    const stop = await keyOf();
    if (stop === null) continue;
    if (reached.has(stop.key) && i > 0 && stop.key === [...reached.keys()][0]) break;
    reached.set(stop.key, (reached.get(stop.key) ?? true) && stop.ring);
  }
  const problems = [...new Set(expected)]
    .filter((key) => !reached.has(key))
    .map((key) => `${key}: Tab never reaches it`);
  for (const [key, ring] of reached) if (!ring) problems.push(`${key}: no visible focus ring`);
  return problems;
}

/** Everything this spec checks on the screen as it is now; an empty list means it passes. */
async function audit(page: Page, where: string): Promise<string[]> {
  await page.evaluate(() => document.fonts.ready);
  const problems = [
    ...(await axeProblems(page)),
    ...(await controlProblems(page)),
    ...(await focusProblems(page)),
  ];
  return problems.map((p) => `${where}: ${p}`);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`every screen (${colorScheme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    });

    test('@a11y first visit, profiles and settings', async ({ page }) => {
      await page.goto('/?clock=fake');
      await expect(
        page.getByRole('heading', { name: 'Welcome to Comparia Academy!' }),
      ).toBeVisible();
      const problems = await audit(page, 'welcome');
      await openApp(page, '?clock=fake');
      problems.push(...(await audit(page, 'home')));
      await page.getByTestId('home.switch').click();
      problems.push(...(await audit(page, "who's playing")));
      await page.getByTestId('profiles.manage').click();
      problems.push(...(await audit(page, 'manage')));
      await page.getByTestId('profiles.delete').click();
      problems.push(...(await audit(page, 'delete confirmation')));
      await page.getByTestId('profiles.keep').click();
      await page.getByTestId('profiles.settings').click();
      problems.push(...(await audit(page, 'settings')));
      await page.getByTestId('settings.reset').click();
      problems.push(...(await audit(page, 'reset confirmation')));
      expect(problems).toEqual([]);
    });

    test('@a11y Grand Trial, results, review, castle map', async ({ page }) => {
      test.setTimeout(120_000);
      await openApp(page, '?clock=fake');
      await page.getByTestId('home.castle').click();
      await expect(page.getByTestId('castle.empty')).toBeVisible();
      const problems = await audit(page, 'castle map, empty');
      await page.getByTestId('castle.back').click();

      await page.getByTestId('home.start').click();
      await page.keyboard.press('2');
      await page.keyboard.press('f');
      problems.push(...(await audit(page, 'trial')));
      // Move on until an item with a "Given" line, so the condition is scanned too.
      for (let i = 0; i < 50 && (await page.getByTestId('trial.condition').count()) === 0; i++) {
        await page.getByTestId('trial.next').click();
      }
      problems.push(...(await audit(page, 'trial with a condition')));
      await page.getByTestId('trial.finish').click();
      problems.push(...(await audit(page, 'results')));
      await page.getByTestId('result.review').click();
      problems.push(...(await audit(page, 'review')));
      await page.getByTestId('review.back').click();
      await page.getByTestId('result.home').click();
      await page.getByTestId('home.castle').click();
      await expect(page.getByTestId('castle.trend')).toBeVisible();
      problems.push(...(await audit(page, 'castle map, after a mock')));
      await page.getByTestId('castle.back').click();

      await page.getByTestId('home.start').click();
      await page.evaluate((ms) => window.__umtymp?.clock?.advance(ms), MOCK_MS);
      await expect(page.getByTestId('result.reason')).toContainText('time ran out');
      problems.push(...(await audit(page, 'results after time-up')));
      expect(problems).toEqual([]);
    });

    test('@a11y coach card and potion drill', async ({ page }) => {
      await openApp(page, '?clock=fake');
      await page.evaluate(() => window.__umtymp?.loadFixture('all-wrong'));
      await expect(page.getByTestId('coach.card')).toBeVisible();
      const problems = await audit(page, 'home with the coach card');
      await page.getByTestId('coach.brew').click();
      problems.push(...(await audit(page, 'drill')));
      await page.keyboard.press('1');
      await expect(page.getByTestId('drill.feedback')).toBeVisible();
      problems.push(...(await audit(page, 'drill with feedback')));
      await page.keyboard.press('p');
      await expect(page.getByTestId('drill.paused')).toBeVisible();
      problems.push(...(await audit(page, 'drill paused')));
      expect(problems).toEqual([]);
    });

    test('@a11y Spellbook', async ({ page }) => {
      await openApp(page, '?clock=fake');
      await page.getByTestId('home.spellbook').click();
      const problems = await audit(page, 'spellbook');
      await page.getByTestId('spellbook.length').fill('99');
      problems.push(...(await audit(page, 'spellbook with a length error')));
      await page.getByTestId('spellbook.length').fill('5');
      await page.getByTestId('spellbook.start').click();
      problems.push(...(await audit(page, 'practice session')));
      expect(problems).toEqual([]);
    });
  });
}

test('@a11y formulas are announced in words, not symbols', async ({ page }) => {
  await openApp(page, '?clock=fake');
  await page.getByTestId('home.start').click();
  for (let i = 0; i < 50 && (await page.getByTestId('trial.condition').count()) === 0; i++) {
    await page.getByTestId('trial.next').click();
  }
  for (const id of ['trial.condition', 'trial.quantity-a', 'trial.quantity-b']) {
    const math = page.getByTestId(id);
    const latex = await math.locator('annotation[encoding="application/x-tex"]').textContent();
    const spoken = spokenMath(latex ?? '');
    expect(spoken, id).not.toBeNull();
    // What the browser's accessibility tree exposes, not just the attribute.
    await expect(page.getByRole('img', { name: spoken ?? '', exact: true }).first()).toBeVisible();
    await expect(math).toHaveAccessibleName(spoken ?? '');
  }
});

/** Presses Tab until the control has focus. */
async function tabTo(page: Page, testId: string) {
  const control = page.getByTestId(testId);
  for (let i = 0; i < 40 && !(await control.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(control).toBeFocused();
}

test('@a11y a new student can sign up, take a mock and read the review with the keyboard only', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/?clock=fake');
  await expect(page.getByRole('heading', { name: 'Welcome to Comparia Academy!' })).toBeVisible();
  await tabTo(page, 'profiles.name');
  await page.keyboard.type('Kim');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space'); // the first house
  await page.keyboard.press('ArrowRight'); // move to the second, which selects it
  await expect(page.getByTestId('profiles.house-emberwing')).toBeChecked();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space'); // the first mascot colour
  await tabTo(page, 'profiles.save');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('home.player')).toContainText('Kim');

  await tabTo(page, 'home.start');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('trial.position')).toBeVisible();
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await page.keyboard.press('s');
  await tabTo(page, 'trial.finish');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('result.score')).toBeVisible();

  await tabTo(page, 'result.review');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('review.item').first()).toBeVisible();
  await tabTo(page, 'review.back');
  await page.keyboard.press('Enter');
  await tabTo(page, 'result.home');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('home.player')).toBeVisible();
});

// Task 24: moving on to the next question stays under 50 ms (p95) on a slow device: Chromium with the CPU slowed 4×,
// on the production build (React's dev build is several times slower and isn't what students get). Chromium only:
// CPU throttling is a Chrome DevTools feature. It runs in its own `perf` project, after all other tests, so nothing
// else shares the CPU; three mocks give enough samples that p95 isn't simply the slowest one.
import { expect, test } from '@playwright/test';

const BUDGET_MS = 50;
const MOCKS = 3;

test('answer → next question is under 50 ms (p95) with 4× CPU throttling', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('profiles.name').fill('Robin');
  await page.getByTestId('profiles.house-owlcrest').check();
  await page.getByTestId('profiles.color-purple').check();
  await page.getByTestId('profiles.save').click();
  const position = page.getByTestId('trial.position');

  // From the key's own timestamp to the frame after the next question appears: what the student waits for.
  await page.evaluate(() => {
    const w = window as unknown as { latencies: number[] };
    w.latencies = [];
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Enter') return;
        const before = document.querySelector('[data-testid="trial.position"]')?.textContent;
        const observer = new MutationObserver(() => {
          const now = document.querySelector('[data-testid="trial.position"]')?.textContent;
          if (now === before) return;
          observer.disconnect();
          requestAnimationFrame(() =>
            setTimeout(() => w.latencies.push(performance.now() - event.timeStamp)),
          );
        });
        observer.observe(document.body, { subtree: true, childList: true, characterData: true });
      },
      true,
    );
  });

  const cdp = await page.context().newCDPSession(page);
  let transitions = 0;
  for (let mock = 0; mock < MOCKS; mock++) {
    await page.getByTestId('home.start').click();
    await expect(position).toBeVisible();
    const total = Number(/of (\d+)/.exec((await position.textContent()) ?? '')?.[1]);
    await expect(page.locator('.katex').first()).toBeVisible();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    for (let i = 0; i < total - 1; i++) {
      await page.keyboard.press(String((i % 4) + 1));
      await page.keyboard.press('Enter');
      await expect(position).toHaveText(`Question ${i + 2} of ${total}`);
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    transitions += total - 1;
    await page.getByTestId('trial.finish').click();
    await page.getByTestId('result.home').click();
  }

  const latencies = await page.evaluate(
    () => (window as unknown as { latencies: number[] }).latencies,
  );
  expect(latencies).toHaveLength(transitions);
  const sorted = [...latencies].sort((a, b) => a - b);
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Infinity;
  console.log(
    `answer → next, 4× CPU: p95 ${p95.toFixed(1)} ms, max ${sorted.at(-1)?.toFixed(1)} ms, n=${sorted.length}`,
  );
  expect(p95).toBeLessThan(BUDGET_MS);
});

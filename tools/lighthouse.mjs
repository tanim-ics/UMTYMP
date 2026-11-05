// Lighthouse on the production image (Task 24). Mirrors the "Page performance" row of docs/CONSTRAINTS.md, which
// is the source of truth for these numbers. Runs in the e2e container against the `web` service:
//   docker compose up -d --build web && docker compose run --rm e2e npm run check:lighthouse
// Lighthouse's default mobile run: a mid-range phone on slow 4G with a 4× slower CPU (simulated).
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://web/';
const BUDGET = { performance: 95, accessibility: 95, lcpMs: 2500, cls: 0.1 };

const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const result = await lighthouse(url, {
    port: chrome.port,
    onlyCategories: ['performance', 'accessibility'],
    output: 'json',
    logLevel: 'error',
  });
  if (result === undefined) throw new Error('Lighthouse returned no result');
  const { categories, audits } = result.lhr;
  const got = {
    performance: Math.round((categories.performance?.score ?? 0) * 100),
    accessibility: Math.round((categories.accessibility?.score ?? 0) * 100),
    lcpMs: Math.round(audits['largest-contentful-paint']?.numericValue ?? Infinity),
    cls: audits['cumulative-layout-shift']?.numericValue ?? Infinity,
  };
  const failures = [
    got.performance < BUDGET.performance &&
      `performance ${got.performance} < ${BUDGET.performance}`,
    got.accessibility < BUDGET.accessibility &&
      `accessibility ${got.accessibility} < ${BUDGET.accessibility}`,
    got.lcpMs > BUDGET.lcpMs && `LCP ${got.lcpMs} ms > ${BUDGET.lcpMs} ms`,
    got.cls > BUDGET.cls && `CLS ${got.cls.toFixed(3)} > ${BUDGET.cls}`,
  ].filter(Boolean);
  const fcp = Math.round(audits['first-contentful-paint']?.numericValue ?? 0);
  const tbt = Math.round(audits['total-blocking-time']?.numericValue ?? 0);
  console.log(
    `lighthouse ${url}: performance ${got.performance}, accessibility ${got.accessibility}, ` +
      `FCP ${fcp} ms, LCP ${got.lcpMs} ms, TBT ${tbt} ms, CLS ${got.cls.toFixed(3)}`,
  );
  // Which element Lighthouse counted as the largest paint, and what held it back: the first thing to look at.
  const lcpItems = audits['largest-contentful-paint-element']?.details?.items ?? [];
  for (const table of lcpItems) {
    for (const row of table.items ?? []) {
      if (row.node?.snippet) console.log(`  LCP element: ${row.node.snippet}`);
      if (row.phase) console.log(`  LCP ${row.phase}: ${Math.round(row.timing ?? 0)} ms`);
    }
  }
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exitCode = failures.length > 0 ? 1 : 0;
} finally {
  await chrome.kill();
}

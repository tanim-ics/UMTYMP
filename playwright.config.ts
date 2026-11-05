import { defineConfig, devices } from '@playwright/test';

// Runs inside the `e2e` container (docker compose run --rm e2e). Most specs use the dev server, because the test
// hooks on window.__umtymp exist only in dev builds. The offline spec needs the service worker, which only the
// production build has, so it runs against `vite preview` of a fresh build on its own port; so do the security
// header and timing specs (Task 24), which must see what students get.
const PREVIEW = 'http://localhost:4173';
const PROD_SPECS = /(offline|headers|perf)\.spec/;
const OTHER_PROJECTS = ['chromium', 'webkit', 'prod-chromium', 'prod-webkit'];

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      url: PREVIEW,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: PROD_SPECS },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: PROD_SPECS },
    {
      name: 'prod-chromium',
      use: { ...devices['Desktop Chrome'], baseURL: PREVIEW, serviceWorkers: 'allow' },
      testMatch: /(offline|headers)\.spec/,
    },
    {
      name: 'prod-webkit',
      use: { ...devices['Desktop Safari'], baseURL: PREVIEW, serviceWorkers: 'allow' },
      testMatch: /(offline|headers)\.spec/,
    },
    {
      // The timing spec runs alone, after everything else: other tests sharing the CPU would be measured too.
      name: 'perf',
      use: { ...devices['Desktop Chrome'], baseURL: PREVIEW },
      testMatch: /perf\.spec/,
      dependencies: OTHER_PROJECTS,
    },
  ],
});

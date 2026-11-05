# Constraints

The quality bar for this project. Last reviewed: 2026-11-03 by the owner (interview via
`agent-skills:constraint-driven-development`). Owner choices: enforce coverage, security, and accessibility +
performance on top of the floor; **every failing check blocks**; **stricter** numbers; the task check stays
under **90 s**.

This file is the source of truth. `package.json` scripts and `vitest.config.ts` mirror it; if they drift, this file
wins. Tightening a number needs no discussion. Loosening one needs the owner, in its own commit, never in the commit
of the change that was failing.

## Floor (always enforced)

- No new suppressions: `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `istanbul`/`v8`/`c8 ignore`,
  `gitleaks:allow`, `prettier-ignore` — checked by `npm run floor`
- No unfinished work: "not implemented" throws, empty `catch`, `TODO` — checked by `npm run floor`
- No easier tests: no `.skip`/`.only`/`.todo`, no deleted test files, no assertions removed — checked by `npm run floor`
- No weakened rule in this file and no new exception row without the owner — checked by `npm run floor`
- No secrets in the repository — checked by `npm run secrets` (gitleaks, values redacted)
- No question in the bank that fails the verifier — checked by `npm run verify`

## Enforced with numbers (all block)

| Dimension | Rule | Checked by | Runs at | Why this number |
|---|---|---|---|---|
| Types | 0 errors, strict mode | `npm run typecheck` | every edit | Strict types catch timer/metric unit mistakes early |
| Lint | 0 errors and 0 warnings; no `any`, no `@ts-ignore` | `npm run lint` | every edit | Warnings nobody fixes become noise |
| Format | Prettier clean | `npm run format:check` | every edit | No style diffs in review |
| Floor | 0 floor violations | `npm run floor` | every edit | Stops the cheapest road to green |
| Secrets | 0 findings | `npm run secrets` | every edit | External rule set (gitleaks defaults) |
| Coverage: app | at least 90% lines, branches, functions, statements in `src/` (entry and dev hooks excluded) | `npm run test` | task end | Owner chose stricter than the 80% default; the app is new, so it can start high |
| Coverage: core | at least 95% lines, branches, functions, statements in `src/core/` | `npm run test` | task end | Timer, metrics and verifier decide what students are told |
| Questions | 100% of the bank passes the verifier | `npm run verify` | task end | A wrong key teaches a wrong habit |
| Timer | Drift under 100 ms over 25 min of irregular frames | `npm run test` (`tests/unit/timer.test.ts`) | task end | 0.1 s is below what a student can see on a seconds display |
| Accessibility: Grand Trial | 0 serious or critical axe-core issues (WCAG 2.1 A/AA) on home, trial and result, light and dark, Chromium and WebKit | `npm run check:a11y` in the `e2e` container | full check | External rule set (axe-core); every screen joins in task 22 |
| Keyboard: Grand Trial | A full mock is possible with the keyboard only, on Chromium and WebKit | `npm run e2e` (`tests/e2e/trial.spec.ts`) in the `e2e` container | full check | Students who can't or don't use a mouse must be able to take the whole exam |
| Accessibility: every screen | 0 serious or critical axe-core issues (WCAG 2.1 A/AA) on every screen, light and dark, Chromium and WebKit; every control has a `<screen>.<control>` test id, a target of at least 48 px and a solid focus ring of at least 2 px, and Tab reaches it | `npm run check:a11y` in the `e2e` container (`tests/e2e/a11y.spec.ts`) | full check | Task 22: the scheduled row below, plus the CLAUDE.md §7 rules axe doesn't check |
| Keyboard: first visit to review | Sign-up, a mock, results and the review are possible with the keyboard only, on Chromium and WebKit | `npm run check:a11y` in the `e2e` container (`tests/e2e/a11y.spec.ts`) | full check | A student's first visit must not need a mouse either |
| Dependencies: shipped | 0 advisories at moderate or above in packages that reach the browser | `npm run audit:shipped` | full check | Owner chose stricter than "high"; this is what reaches children; external advisory database |
| Dependencies: dev tools | 0 high or critical advisories | `npm run audit:dev` | full check | Dev tools run only in our containers; high and critical still block |
| Dependencies: dev moderate | at most 11 moderate advisories (ratchet) | `npm run audit:dev` (`tools/audit-ratchet.mjs 11`) | full check | Owner decision 2026-11-03: all 11 are one minimatch issue inside ESLint with no fix released; the count may only go down |

Stages: **fast** = `npm run check:fast` (every edit, a few seconds) · **task** = `npm run check:task` (before a task
counts as done, at most 90 s; measured 3 s on 2026-11-03) · **full** = `npm run check:full` (before a checkpoint
or merge; no time limit; needs network). All run in Docker: `docker compose run --rm check npm run <script>`.
Browser rows run in the `e2e` container (Playwright image, Chromium + WebKit): `docker compose run --rm e2e`
(all browser specs, includes `@a11y`) is part of the full check.

## Scheduled (agreed numbers, not yet enforceable)

These need a running app or browser tests that don't exist yet. Each becomes an enforced row above, with its command,
in the task named here. Until then it is **not** a constraint and nothing may claim it passes.

| Dimension | Rule | Will be checked by | Wired in |
|---|---|---|---|
| Accessibility | 0 serious or critical axe-core issues on every screen, light and dark | Playwright + `@axe-core/playwright` (`npm run check:a11y`) | Task 9 (first screen), full suite task 22 |
| Keyboard | A full mock is possible with the keyboard only | Playwright spec | Task 9 |
| Responsiveness | Answer → next item under 50 ms (p95) with 4× CPU throttling | Playwright timing spec | Task 24 |
| Timer | Drift under 100 ms over 25 min | Vitest fake-clock test (counts under coverage: core) | Task 7 |
| Page performance | Lighthouse performance at least 95, accessibility at least 95; LCP at most 2500 ms; CLS at most 0.1 | Lighthouse in the e2e container | Task 24 |
| Image size | Production image at most 50 MB (20.4 MB on 2026-11-03) | Size check script against `docker image inspect` | Task 25 |
| Offline | 0 network requests during a mock | Playwright network log | Task 23 |
| Franchise names | 0 Harry Potter names in code, content, art | `tools/check-names.ts` | Task 25 |

## Measured, not yet enforced

| Metric | Today | Direction |
|---|---|---|
| Task check duration | 3 s | must stay under 90 s |
| Dev-tool moderate advisories | 11 (minimatch via ESLint, GHSA-g3hv-75wg-m249) | must not grow; lower the cap when ESLint ships a fix |
| Production JS bundle (gzip) | measured in task 24 | must not grow without a reason |

## Exceptions

None. A new row needs an ID (W1, W2…), the rule, the path, the reason, the owner and an expiry at most 90 days out.

| ID | Rule | Path | Reason | Owner | Expires |
|---|---|---|---|---|---|

## Known limits of the floor guard

- With no remote, it compares against the last commit, so it sees uncommitted work only. Before the first commit it
  compares against an empty project. Once `origin/main` exists it compares against the branch point.
- Paths in `.constraintsignore` skip the pattern checks (docs that describe the rules, the guard itself). Rule
  weakening in this file is always checked. Adding a path there needs the owner.

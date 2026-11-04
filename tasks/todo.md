# Release 1 task list

Each task also meets the definition of done in `CLAUDE.md` §8. "Task check" = `docker compose run --rm check npm run check:task`.
"E2E" = `docker compose run --rm e2e`. Sizes: S = 1–2 files, M = 3–5 files.

**Plan approved by owner 2026-11-03.** **Current task:** none. **Done:** Tasks 1–6 (committed and pushed to
`github.com/tanim-ics/UMTYMP`; Checkpoint A approved by owner 2026-11-04). **Next:** Task 7.

**Handoff (after Task 6):** `docs/CONTENT.md` (rules, levels, tags with id prefixes, traps with habits, domain format,
5 worked examples) and `content/questions/seed.json`: 20 original items, 4 per level, answers A 6 / B 5 / C 5 / D 4;
all pass `npm run verify` (4591 value checks). Writing them found a verifier bug: domain rules were split on every
comma, breaking `mod(n, 2) == 1`; fixed with a failing test first (75 tests). Coverage gaps expected at 20 items: no
item yet for traps `zero` or `not_to_scale`, and most tags appear at fewer than 3 levels; content batches C1–C8 close
that. Not machine-checked: that each `domain` matches its displayed `condition` (owner review).

**Handoff (after Task 5):** `verifyItem` in `src/core/questions/evaluate.ts` proves keys with `mathjs` (dev
dependency, no new advisories; dev moderate still 11). Domain format and proof rules are in `docs/CONTRACTS.md`.
37 new tests (74 total); `evaluate.ts` 99% lines; the one uncovered line re-throws unexpected (non-verifier) errors.
Proven on real files: correct bank → exit 0 with 507 value checks; wrong C key → `key is A but x = 0 gives C`; wrong
witness → `witness 2 says B but x = 3 gives A`; figure item without `reviewed_by` → exit 1. Mutation check: dropping
the edge values turns the ½ and 1 edge tests red. Not checked by machine: that `domain` matches the displayed
`condition`, so reviewers must compare them.

**Handoff (after Task 4):** owner approved `zod` (shipped audit still 0). Also added `@types/node` (dev) for the
tools. Schema in `src/core/questions/schema.ts`, vocabulary in `vocabulary.ts`, pure `parseBank` in `load.ts`;
37 tests, `src/core` 100% coverage. `npm run verify` now validates real bank files (proven: valid file → 0, bad
item → 1 with every problem listed, broken JSON → 1). Core files import each other with `.ts` extensions so Node can
run the verifier directly (`allowImportingTsExtensions` in tsconfig).

**Handoff (after Task 3):** `docs/CONSTRAINTS.md` written from the owner interview (all checks block, stricter
numbers, task check ≤ 90 s, measured 3 s). Added: floor guard (`tools/floor-guard.mjs`, `.constraintsignore`),
gitleaks in a `check` image stage, coverage thresholds (90% `src/`, 95% `src/core/`), split dependency audits with a
ratchet (`tools/audit-ratchet.mjs 11`). Vitest upgraded 3 → 5 to clear 2 critical advisories. Every enforced row was
proven red on a planted violation and green on clean code. Accessibility/performance rows are scheduled for tasks
7, 9, 22–25. The floor guard sees everything as new until the first commit.

**Handoff (after Task 2):** `docker compose run --rm check npm run check:task` is green (typecheck, ESLint strict +
no `any`/`@ts-ignore`, Prettier, Vitest smoke test, verifier stub). Proven red: type error → exit 2, `any` → lint
exit 1, bad formatting → exit 1. Verifier runs with Node's built-in TypeScript stripping (no extra tool). After
adding a dependency, rebuild with `docker compose build` and start `dev` with `-V` so its node_modules volume refreshes.

**Handoff (2026-11-03, after Task 1):** git repo initialised, nothing committed yet. Containers `dev` (:5173) and
`web` (:8080) were left running. Verified: dev page renders and reloads on edit; production `/` and deep links
return 200; hashed assets cached for a year; `web` image 20.4 MB on `nginx:1.27-alpine-slim`. Open: owner answers
on `zod` (task 4), `/constraints` interview (task 3), CI (task 25).

---

## Phase 0 — Foundation

### Task 1: Docker dev and production containers
Scaffold a Vite + React + TypeScript app that runs only through Docker, with design-token CSS variables in place.
- [x] `docker compose up dev` serves the app at :5173, and editing a file reloads the page
- [x] `docker compose up --build web` serves the built app from nginx at :8080; image ≤ 50 MB (20.4 MB)
- [x] `git init` done (owner OK) and `.gitignore`, `.dockerignore` present
- **Verify:** both commands on this Mac; `docker image ls` size; edit-reload check
- **Depends on:** none · **Files:** `compose.yaml`, `docker/Dockerfile`, `docker/nginx.conf`, `package.json`, `src/main.tsx` · **Size:** M

### Task 2: Check scripts and test runner
- [x] `check:fast` runs `tsc --noEmit`, ESLint and Prettier; `check:task` adds Vitest and `npm run verify` (stub)
- [x] `check` service in compose runs both; a deliberately broken file makes `check:fast` fail
- **Verify:** run both scripts green, then red with a broken file
- **Depends on:** 1 · **Files:** `package.json`, `eslint.config.js`, `vitest.config.ts`, `compose.yaml`, `tests/unit/smoke.test.ts` · **Size:** M

### Task 3: Quality bar
- [x] `docs/CONSTRAINTS.md` lists every threshold from the spec (perf, a11y, image size, coverage, drift) with its checking command (browser-based rows scheduled with their task)
- **Verify:** each listed command exists and runs
- **Depends on:** 2 · **Files:** `docs/CONSTRAINTS.md` · **Size:** S

### Task 4: Question schema and bank loader
- [x] `zod` schema for items (levels 1–5, tags/traps from vocabulary, `expr_*`, `domain`, witnesses rule for `D`)
- [x] Loader reads `content/questions/*.json` and reports every invalid item with its id and reason
- [x] `docs/CONTRACTS.md` documents the schema
- **Verify:** unit tests for valid item, each rejection reason, empty bank
- **Depends on:** 2 · **Files:** `src/core/questions/schema.ts`, `src/core/questions/load.ts`, `tests/unit/questions.test.ts`, `docs/CONTRACTS.md` · **Size:** M

### Task 5: Answer-key verifier (high risk)
- [x] `npm run verify` evaluates `expr_a`/`expr_b` with `mathjs` over ≥ 500 random values per variable in its domain, plus edge values (−1, 0, ½, 1, 2, large)
- [x] Rejects a wrong `A`/`B`/`C` key with a counter-example; checks `D` witnesses disagree; enforces level time limits
- [x] Items without `expr_*` must have `reviewed_by`
- **Verify:** unit tests with known-good and known-wrong items (incl. x² vs x, √(x²) vs x)
- **Depends on:** 4 · **Files:** `tools/verify-questions.ts`, `src/core/questions/evaluate.ts`, `tests/unit/verify.test.ts` · **Size:** M

### Task 6: Content guide and seed bank
- [x] `docs/CONTENT.md`: tag, trap and level vocabulary, writing rules, 5 worked examples (one per level)
- [x] 20 original seed items (4 per level) pass the verifier
- **Verify:** `npm run verify` green; owner reads the 20 items
- **Depends on:** 5 · **Files:** `docs/CONTENT.md`, `content/questions/seed.json` · **Size:** S

### Checkpoint A — after tasks 1–6
- [x] Task check green in Docker; verifier proves all seed items; owner reviews seed items; checkpoint commit (owner approved 2026-11-04)

---

## Phase 1 — Exam core

### Task 7: Session clock
- [ ] `Clock` interface (real = `performance.now()`, fake for tests); countdown, time-up event, pause for drills only
- [ ] Drift < 100 ms over a simulated 25 min; correct after a simulated hidden tab
- **Verify:** unit tests with fake clock
- **Depends on:** 2 · **Files:** `src/core/timer/clock.ts`, `src/core/timer/session.ts`, `tests/unit/timer.test.ts` · **Size:** S

### Task 8: Mock and drill builders
- [ ] Seeded shuffle; mock uses the level mix (6/10/14/12/8) and avoids items from the last 3 mocks while possible
- [ ] Drill builder: 10 items by tag, trap or level; practice builder: filters + length 5–50
- **Verify:** unit tests: same seed → same set; no repeats; graceful fallback when the bank is small
- **Depends on:** 4 · **Files:** `src/core/questions/build.ts`, `src/core/config/exam.ts`, `tests/unit/build.test.ts` · **Size:** S

### Task 9: Grand Trial screen (plain)
- [ ] Shows one item with KaTeX, timer, answer buttons with words + letters; tap and keys `1`–`4`/`A`–`D`, `Enter`/`→`, `S`, `F`, back
- [ ] Time-up ends the mock; each answer creates an `AttemptEvent` in the Zustand store
- [ ] Dev-only test hooks on `window.__umtymp`
- **Verify:** component tests for keys; E2E: full mock with fake clock on Chromium + WebKit
- **Depends on:** 7, 8 · **Files:** `src/ui/screens/GrandTrial.tsx`, `src/ui/components/MathView.tsx`, `src/store/session.ts`, `src/dev/testHooks.ts`, `tests/e2e/trial.spec.ts` · **Size:** M

### Task 10: Saving attempts locally
- [ ] Dexie schema v1 (profiles, sessions, attempts); every answer saved as it happens
- [ ] Reload mid-mock resumes with the clock still running; finished mocks listed
- **Verify:** unit tests (fake IndexedDB); E2E reload test
- **Depends on:** 9 · **Files:** `src/data/db.ts`, `src/data/attempts.ts`, `tests/unit/data.test.ts`, `tests/e2e/reload.spec.ts` · **Size:** M

### Checkpoint B — after tasks 7–10
- [ ] A full 50-item mock (seed bank repeated in dev) runs end to end and survives reload; E2E green; commit

---

## Phase 2 — Insights

### Task 11: Metrics
- [ ] All 7 metrics from `CLAUDE.md` §4 as pure functions; `null` below 5 attempts
- **Verify:** unit tests against hand-computed fixtures
- **Depends on:** 9 · **Files:** `src/core/analytics/metrics.ts`, `tests/unit/metrics.test.ts`, `tests/fixtures/histories.ts` · **Size:** S

### Task 12: Coach and habit badges
- [ ] Picks one strength, the biggest bottleneck and one habit + drill target; "not enough data" case
- [ ] Habit badges (e.g. finished in time, tested a negative) from events
- **Verify:** ≥ 10 fixture histories give the expected output
- **Depends on:** 11 · **Files:** `src/core/analytics/coach.ts`, `src/core/analytics/badges.ts`, `tests/unit/coach.test.ts` · **Size:** M

### Task 13: Results and review screen
- [ ] Score, then every item with answer, key, shortcut, explanation; filters wrong / slow (> 35 s) / flagged
- **Verify:** component test of filters; E2E after a mock
- **Depends on:** 10, 11 · **Files:** `src/ui/screens/Results.tsx`, `src/ui/screens/Review.tsx`, `tests/e2e/review.spec.ts` · **Size:** M

### Task 14: Coach card and potion drill
- [ ] Coach card on results with "Brew a potion" → 10-item drill; drill may pause and shows the shortcut after each answer
- **Verify:** E2E: mock → coach → drill → back to results
- **Depends on:** 12, 13 · **Files:** `src/ui/components/CoachCard.tsx`, `src/ui/screens/PotionDrill.tsx`, `tests/e2e/drill.spec.ts` · **Size:** M

### Task 15: Spellbook practice
- [ ] Choose topics, traps, levels 1–5, timed/untimed, length 5–50; runs through the same session screen
- **Verify:** E2E for an untimed level-3 set of 5
- **Depends on:** 9 · **Files:** `src/ui/screens/Spellbook.tsx`, `tests/e2e/spellbook.spec.ts` · **Size:** S

### Checkpoint C — after tasks 11–15
- [ ] Mock → review → coach → drill loop works on Chromium + WebKit; owner tries it; commit

---

## Phase 3 — Profiles and data

### Task 16: Profiles and house choice
- [ ] First run: display name, house (Owlcrest/Emberwing/Foxglen/Starhorn), colour; parent can add, rename, delete profiles
- **Verify:** E2E for create → switch → delete; no other personal fields exist in storage
- **Depends on:** 10 · **Files:** `src/ui/screens/Profiles.tsx`, `src/data/profiles.ts`, `tests/e2e/profiles.spec.ts` · **Size:** M

### Task 17: Export, import, reset
- [ ] Export a profile to JSON; import validates with `zod` and rejects bad files; reset all with confirmation
- **Verify:** E2E: export → reset → import gives identical history and dashboard numbers
- **Depends on:** 16 · **Files:** `src/data/transfer.ts`, `src/ui/screens/Settings.tsx`, `tests/e2e/transfer.spec.ts` · **Size:** M

### Task 18: Castle map progress (plain)
- [ ] Per-mock trend (score, median time, trap rate, false-D, stamina); per topic and level table; empty state
- [ ] Towers unlock from habits and progress, never from daily streaks
- **Verify:** component tests with fixtures; E2E empty and filled states
- **Depends on:** 11, 16 · **Files:** `src/ui/screens/CastleMap.tsx`, `src/core/analytics/progress.ts`, `tests/unit/progress.test.ts` · **Size:** M

### Checkpoint D — after tasks 16–18
- [ ] Every Release 1 story works without the theme; E2E green; commit

---

## Phase 4 — Magic world

### Task 19: Theme system
- [ ] Parchment (light) and night-sky (dark) tokens, open-licence fonts, motion settings that switch off for reduced motion
- [ ] `docs/ASSETS.md` started; WCAG AA contrast for every text/background pair
- **Verify:** contrast unit test over token pairs; E2E reduced-motion check
- **Depends on:** D · **Files:** `src/ui/theme/tokens.css`, `src/ui/theme/motion.ts`, `tests/unit/contrast.test.ts`, `docs/ASSETS.md` · **Size:** M

### Task 20: Original art
- [ ] SVGs: Professor Hoot, 4 house crests, castle map with towers, potion bottle, spellbook; all original, logged in `docs/ASSETS.md`
- **Verify:** owner reviews the art sheet; no franchise look-alikes
- **Depends on:** 19 · **Files:** `public/art/*.svg`, `docs/ASSETS.md` · **Size:** M

### Task 21: Themed screens
- [ ] Theme applied to every screen; Grand Trial stays still (only the timer changes); celebration only on results
- **Verify:** E2E asserts no running animations during a timed mock; screenshots of static screens
- **Depends on:** 20 · **Files:** `src/ui/components/*`, `src/ui/screens/*` (style files only) · **Size:** M

### Task 22: Accessibility pass
- [ ] axe-core: zero serious/critical issues on every screen, both themes; full keyboard-only mock; spoken-form math labels
- **Verify:** E2E axe suite + keyboard-only spec
- **Depends on:** 21 · **Files:** `tests/e2e/a11y.spec.ts`, fixes in touched components · **Size:** M

### Checkpoint E — after tasks 19–22
- [ ] Owner reviews the look on a laptop and an iPad; commit

---

## Phase 5 — Offline and ship

### Task 23: Offline (PWA)
- [ ] Installable; works with the network off after first load; no requests during a mock
- **Verify:** E2E with network blocked; network log check
- **Depends on:** E · **Files:** `vite.config.ts`, `src/main.tsx`, `tests/e2e/offline.spec.ts` · **Size:** S

### Task 24: Performance and nginx hardening
- [ ] Answer → next < 50 ms p95 with 4× CPU throttle; Lighthouse performance ≥ 90, accessibility ≥ 95
- [ ] nginx security headers (CSP, no-sniff, referrer policy), long-cache hashed assets
- **Verify:** Playwright timing test; Lighthouse in the e2e container
- **Depends on:** 23 · **Files:** `docker/nginx.conf`, `tests/e2e/perf.spec.ts` · **Size:** S

### Task 25: CI and franchise-name check
- [ ] Word-list check fails on Harry Potter names in code, content and art; CI runs the full check (if approved)
- **Verify:** check fails on a planted word; CI run green
- **Depends on:** 2 · **Files:** `tools/check-names.ts`, `.github/workflows/ci.yml` · **Size:** S

### Checkpoint F — Release 1
- [ ] All 10 success criteria in `docs/SPEC.md` met with evidence; owner sign-off; tag `v1.0.0`

---

## Content track (after task 6, beside the build)

Each batch: 50 original items, verified, then owner review of wording and level. Running target ≥ 400 by
checkpoint F with the level minimum 60 / 90 / 100 / 90 / 60; every tag and trap at ≥ 3 levels.

- [ ] C1 · [ ] C2 · [ ] C3 · [ ] C4 · [ ] C5 · [ ] C6 · [ ] C7 · [ ] C8

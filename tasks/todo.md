# Release 1 task list

Each task also meets the definition of done in `CLAUDE.md` §8. "Task check" = `docker compose run --rm check npm run check:task`.
"E2E" = `docker compose run --rm e2e`. Sizes: S = 1–2 files, M = 3–5 files.

**Plan approved by owner 2026-11-03.** **Current task:** none. **Done:** Tasks 1–6 (committed and pushed to
`github.com/tanim-ics/UMTYMP`; Checkpoint A approved by owner 2026-11-04). **Next:** Task 19 (theme system). Checkpoint D passed and committed 2026-11-05.

**Handoff (Checkpoint D):** every Release 1 story mapped to a browser test, Chromium + WebKit:
S1 `trial`, `checkpoint`, `reload`, `release1` · S2 `review` · S3 `drill` (coach, fixtures incl. not enough data) ·
S4 `drill` · S5 `spellbook`, `release1` · S6 `castle` · S7 + P1 `profiles` · P2 `transfer` · C1 `npm run verify`.
New `tests/e2e/release1.spec.ts` for details only unit tests had: answering by tap with going back to change an
answer; a hidden tab keeps the clock running and is recorded; a timed Spellbook set counts down and ends at time-up
with the rest unanswered. Results: full check green (413 unit, verifier 20/20, floor guard clean, no leaks, shipped
audit 0, dev 7 moderate under cap 11); E2E 74/74; production image has no dev code (0 hits). **Not shown in a
browser:** no repeats across the last 3 mocks: the bank has 20 items, fewer than one mock, so it is proven in unit
tests only (`build.test.ts`) until content batches grow the bank.

**Handoff (after Task 18):** castle map: `src/core/analytics/progress.ts` (`mockTrend`, `progressTable`, `towers`;
`medianTime` added to metrics) and `CastleMap.tsx`, opened from Home. Six towers: five from the habit badges plus
Rising (a later mock beats the first); none reads dates. Tests: 413 unit/component + 68 E2E (new
`tests/e2e/castle.spec.ts`: empty state → Start; after a mock one trend row, tables, Gate and Clock open; axe
light/dark, Chromium + WebKit). Mutation checks 6/6 red. Seen live: a blank screen while history waited for the save
→ heading plus "Opening the castle map…" (failing test first); no sideways page scroll at phone width. Dev-only: the
fake clock dates sessions 1/1/1970. **Owner may want to read:** tower names and their "To open" sentences.

**Handoff (after Task 17):** `src/data/transfer.ts` (versioned export, zod-strict import with consistency checks,
new ids on import, reset) and `Settings.tsx` (export per student, import from file, reset with confirmation),
reachable from Who's playing? and Welcome. Dev hook `coachTexts()`. Tests: 387 unit/component + 60 E2E (new
`tests/e2e/transfer.spec.ts`: export → reset → import gives identical history and coach numbers with a real
download; damaged file refused; axe light/dark); full suite 120/120 over two repeats. Mutation checks 5/5 red.
Found: right after a mock, home sometimes listed no past trials (the save hadn't landed) → history reads now wait for
pending saves; failing test first. A transfer-test flake was my test reading the list before it loaded (fixed in the
test). Seen live: settings panels reused the centred quantity style → plain `.card`; file input and reset button
sized. "Dashboard numbers" compared via history + coach until the castle map (Task 18) exists.

**Handoff (after Task 16):** student profiles: `src/data/profiles.ts` (houses, named colours, validation, repo with
adopt-on-first and cascade delete), `Profiles.tsx` (Welcome, Who's playing?, manage/rename/delete with confirm),
App profile gate; attempt repo and persistence are per profile. Tests: 362 unit/component + 52 E2E (new
`tests/e2e/profiles.spec.ts`: create → switch → delete, per-student history, real-IndexedDB check that profile rows
have only id/displayName/house/mascotColor, axe light/dark; every spec now opens through `tests/e2e/helpers.ts`).
Mutation checks 5/5 red. Seen live: radio buttons tiny and the checked choice hard to see → 24 px controls plus a
bold, outlined chosen option (Spellbook too). **Open for the owner:** the floor guard flags 8 `assertion-removed`
lines in `tests/unit/data.test.ts`; each assertion is still there, rewritten to pass a profile id (same matcher).
Cleared by pushing (the guard compares with `origin/main`); refining the rule for same-matcher rewrites is still
an option. I did not change the guard.

**Handoff (after Task 15):** Spellbook (`Spellbook.tsx`): topics, traps, levels, timed/untimed, length 5–50, live
match count; practice runs on the mock's session screen (count-up clock when untimed). Store `startPractice`; core
`countMatching`; `EXAM.secondsPerQuestion` (the metrics' pace line now reads it instead of its own 30). Names for
students: `LEVEL_NAMES`, `TRAP_NAMES` (vocabulary) and `src/ui/labels.ts`. Tests: 335 unit/component + 44 E2E (new
`tests/e2e/spellbook.spec.ts`: untimed level-3 set of 5, keyboard-only start, axe light/dark). Mutation checks 4/4
red. Found and fixed (failing tests first): Back to start after practice returned to the Spellbook; two checkboxes
both named "Absolute value"; trap names generated from ids ("Fraction 0 1 trap") on screen and in Hoot's sentences.

**Handoff (after Task 14):** coach card on mock results, potion drill (untimed, pause hides the question, shortcut
after each answer, answer locks), back to the mock's results. Core: `pauseTrial`/`resumeTrial`, drill answer lock,
no input while paused; store `startDrill`/`backToResults`/`pause`/`unpause`/`returnTo`; repo `listHistory`.
`loadFixture` dev hook done (`all-right`, `all-wrong`, `not-enough-data`). Mock and drill screens share
`Question.tsx` and `useTrialControls.ts`. Tests: 318 unit/component + 36 E2E (new `tests/e2e/drill.spec.ts`: mock →
coach → drill with pause → back; fixtures; axe on coach card and drill, light/dark). Mutation checks: 1 of 4 survived
(the mock counted twice when storage already has it) → test added, now red. Seen live, both fixed with failing
tests first: a 0 % "strength" ("0 of 8 right") → effort strength instead; the coach picked an older mock as latest
when clocks differed → the card names the shown mock. Owner may want to read Hoot's wording on the card.

**Handoff (after Task 13):** `Results.tsx` replaces the bare result view; `Review.tsx` lists every question with
filters (All / Wrong or missed / Slow / Flagged). Filter and summary rules are pure in `src/core/analytics/review.ts`
(no metric logic in components). 19 new unit/component tests (290 total) + `tests/e2e/review.spec.ts` (review after a
real mock, keyboard-only review, axe on results and review in light/dark): 28 E2E green on Chromium + WebKit.
Mutation checks 3/3 red. Seen live: review cards were centred (inherited from quantity cards), hard to read for
paragraphs → left-aligned. Owner may want to look at: "Wrong or missed" includes skipped and unanswered questions.
`loadFixture` hook moved to Task 14 (coach card shows saved history). A test-helper infinite loop hung one run; the
helper is now bounded.

**Handoff (after Task 12):** `coach.ts` (strength, biggest bottleneck by questions lost, habit, drill; texts in
Professor Hoot's voice) and `badges.ts` (5 habit badges). Rules in `docs/CONTRACTS.md`. 27 tests: 14 coach fixtures
(incl. empty, too little data, each bottleneck kind, challenge, tie-breaks, newest-first history, early finish) + 7
badge cases; `badges.ts` 100 %, `coach.ts` 100 % lines (uncovered branches are type-only fallbacks that can't fire).
Mutation checks: 2 of 6 survived at first, which exposed a redundant tie-break list (removed: the push order already
decides ties) and an untested early-finish case (test added); now all red. Rates are compared as exact fractions.

**Handoff (after Task 11):** `src/core/analytics/metrics.ts`: all 7 metrics, definitions in `docs/CONTRACTS.md`
(attempted = answered; time per question from answered items only; pace by `answeredAt`; stamina windows first and
last 10 min of a ≥ 20 min session). Fixtures in `tests/fixtures/histories.ts` (`ev`, `many`); 26 tests, every value
hand-computed; `metrics.ts` 100 % lines. Found: floating point made an exact 15-point stamina drop read 14.999… (no
tip) → failing test, then rounded. Task 12 should compare rates the same careful way. Mutation checks 5/5 red.
`loadFixture` dev hook is still open; it fits Task 13 (results/review screens), where a fixture history is shown.

**Handoff (Checkpoint B):** `?bank=repeat` (dev only, `src/dev/devBank.ts`) pads the 20 seed items 4× so a full
mock fills the 6/10/14/12/8 mix. `tests/e2e/checkpoint.spec.ts`: 50 items by keyboard, reload after 25 (resumes at
question 26 with 25 answers), finish, history shows "of 50 correct" after another reload. Found: Chromium lost the
last action when Playwright reloaded within milliseconds of it (the browser abandons IndexedDB writes in flight at
unload). Measured save time 0.5 ms median / 2.6 ms max; recorded as a limit in `docs/CONTRACTS.md`; tests now wait
for the `flush()` hook before reloading. 20 E2E × 3 repeats = 60/60 green; full check green (218 unit tests, shipped
audit 0, dev moderate 7 under cap 11). Production image has no dev code (searched for padding ids, hooks, fake clock,
mathjs: 0 hits).

**Handoff (after Task 10):** Dexie schema v1 (`src/data/db.ts`: profiles, sessions, attempts) and
`src/data/attempts.ts` (repo + `connectPersistence`). Every change to the trial is saved as it happens; a reload
resumes the newest unfinished mock; finished mocks are listed on home and feed the "avoid last 3 mocks" rule.
**Clock change:** `systemClock` is now `performance.timeOrigin + performance.now()` (monotonic within a page,
comparable across reloads); `elapsedMs` clamps at 0. New deps: dexie (stack), fake-indexeddb (dev, for the unit
tests the plan names). Tests: 214 unit/component + 18 E2E (new `tests/e2e/reload.spec.ts`: resume with clock
running, history after reload, finished mock not resumed) on Chromium + WebKit. Mutation checks 4/4 red. Seen live:
a reload left the timer "hidden" forever (the old page hides as it unloads) → fixed with a failing test first.
Not tested live: storage blocked or full (unit-tested: app keeps working, home says saving is off). After adding a
dependency, restart `dev` with `docker compose up -d --build -V dev`.

**Handoff (after Task 9):** plain Grand Trial: pure rules in `src/core/session/trial.ts` (+ `AttemptEvent` in
`attempt.ts`), Zustand store `src/store/session.ts`, `MathView` (KaTeX 0.19, HTML + MathML), `GrandTrial` screen with
result view, `App` home, `src/ui/bank.ts` (bank bundled via `import.meta.glob`), dev hooks `src/dev/testHooks.ts`
(`?clock=fake`). New deps (ADR 0001 stack): katex, zustand; dev: @testing-library/react + dom, jsdom (Testing
Library's DOM, not named in the ADR), @playwright/test, @axe-core/playwright. New `e2e` compose service on the
Playwright 1.64.1 image. Tests: 188 unit/component (all `src/` files ≥ 94% lines) + 12 E2E (6 specs × Chromium,
WebKit). axe found a real WCAG 2.5.3 issue (answer-button names didn't match their text), fixed. Floor-guard skip
pattern narrowed to test-framework calls (it flagged the app's Skip button); proven to still catch `it.skip`,
`describe.only`, `test.todo`, `test.fixme`, `it.skipIf`, `xit`. Mutation checks: 4/4 red. Seen in the browser:
KaTeX text is invisible until its font loads (KaTeX uses `font-display: block`); revisit with offline caching
(task 23) and Lighthouse (task 24), along with the 523 kB JS bundle. Not tested live: hiding the tab (Playwright
can't; covered by unit tests). Dev-tool moderate advisories fell 11 → 7; lowering the ratchet cap needs the owner.
`loadFixture` hook waits for tasks 10–11.

**Handoff (after Task 8):** `src/core/config/exam.ts` (`EXAM` constants), `src/core/questions/build.ts`
(`buildMock`, `buildDrill`, `buildPractice`, `seededShuffle`) and `src/core/random.ts` (seeded PRNG + shuffle, now
also used by the verifier; verify output unchanged at 4591 checks). Contract in `docs/CONTRACTS.md`. 26 new tests
(125 total), new files 100% covered. Mutation checks: counting 4 past mocks instead of 3 → 2 red; no borrowing
between levels → 1 red; no drill ramp → 1 red. Assumption: mock order is shuffled (official order unknown); the mix
is kept ahead of freshness when the bank is short. Task 8 uncommitted (owner moved straight to Task 9).

**Handoff (after Task 7):** `src/core/timer/clock.ts` (`Clock`, `systemClock`, `createFakeClock`) and
`session.ts` (immutable `TimerState` + pure functions of `now`; contract in `docs/CONTRACTS.md`). 24 new tests (99
total), both files 100% covered. Drift test: 25 min of jittered frames, error < 100 ms (it is 0 by design: time is
derived, not accumulated). Mutation checks: ignoring pauses → 2 tests red; removing the time-up cap → 5 red. The
timer-drift rule is now an Enforced row in `docs/CONSTRAINTS.md`. Its Scheduled row stays: the floor guard flags
any deleted row (it compares numbers by position, so dropping "Task 7" reads as a lost threshold); removing it
needs the owner's OK. Committed and pushed.

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
- [x] `Clock` interface (real = `performance.now()`, fake for tests); countdown, time-up event, pause for drills only
- [x] Drift < 100 ms over a simulated 25 min; correct after a simulated hidden tab
- **Verify:** unit tests with fake clock
- **Depends on:** 2 · **Files:** `src/core/timer/clock.ts`, `src/core/timer/session.ts`, `tests/unit/timer.test.ts` · **Size:** S

### Task 8: Mock and drill builders
- [x] Seeded shuffle; mock uses the level mix (6/10/14/12/8) and avoids items from the last 3 mocks while possible
- [x] Drill builder: 10 items by tag, trap or level; practice builder: filters + length 5–50
- **Verify:** unit tests: same seed → same set; no repeats; graceful fallback when the bank is small
- **Depends on:** 4 · **Files:** `src/core/questions/build.ts`, `src/core/config/exam.ts`, `tests/unit/build.test.ts` · **Size:** S

### Task 9: Grand Trial screen (plain)
- [x] Shows one item with KaTeX, timer, answer buttons with words + letters; tap and keys `1`–`4`/`A`–`D`, `Enter`/`→`, `S`, `F`, back
- [x] Time-up ends the mock; each answer creates an `AttemptEvent` in the Zustand store
- [x] Dev-only test hooks on `window.__umtymp`
- **Verify:** component tests for keys; E2E: full mock with fake clock on Chromium + WebKit
- **Depends on:** 7, 8 · **Files:** `src/ui/screens/GrandTrial.tsx`, `src/ui/components/MathView.tsx`, `src/store/session.ts`, `src/dev/testHooks.ts`, `tests/e2e/trial.spec.ts` · **Size:** M

### Task 10: Saving attempts locally
- [x] Dexie schema v1 (profiles, sessions, attempts); every answer saved as it happens
- [x] Reload mid-mock resumes with the clock still running; finished mocks listed
- **Verify:** unit tests (fake IndexedDB); E2E reload test
- **Depends on:** 9 · **Files:** `src/data/db.ts`, `src/data/attempts.ts`, `tests/unit/data.test.ts`, `tests/e2e/reload.spec.ts` · **Size:** M

### Checkpoint B — after tasks 7–10
- [x] A full 50-item mock (seed bank repeated in dev) runs end to end and survives reload; E2E green; commit

---

## Phase 2 — Insights

### Task 11: Metrics
- [x] All 7 metrics from `CLAUDE.md` §4 as pure functions; `null` below 5 attempts
- **Verify:** unit tests against hand-computed fixtures
- **Depends on:** 9 · **Files:** `src/core/analytics/metrics.ts`, `tests/unit/metrics.test.ts`, `tests/fixtures/histories.ts` · **Size:** S

### Task 12: Coach and habit badges
- [x] Picks one strength, the biggest bottleneck and one habit + drill target; "not enough data" case
- [x] Habit badges (e.g. finished in time, tested a negative) from events
- **Verify:** ≥ 10 fixture histories give the expected output
- **Depends on:** 11 · **Files:** `src/core/analytics/coach.ts`, `src/core/analytics/badges.ts`, `tests/unit/coach.test.ts` · **Size:** M

### Task 13: Results and review screen
- [x] Score, then every item with answer, key, shortcut, explanation; filters wrong / slow (> 35 s) / flagged
- **Verify:** component test of filters; E2E after a mock
- **Depends on:** 10, 11 · **Files:** `src/ui/screens/Results.tsx`, `src/ui/screens/Review.tsx`, `tests/e2e/review.spec.ts` · **Size:** M

### Task 14: Coach card and potion drill
- [x] Coach card on results with "Brew a potion" → 10-item drill; drill may pause and shows the shortcut after each answer
- **Verify:** E2E: mock → coach → drill → back to results
- **Depends on:** 12, 13 · **Files:** `src/ui/components/CoachCard.tsx`, `src/ui/screens/PotionDrill.tsx`, `tests/e2e/drill.spec.ts` · **Size:** M

### Task 15: Spellbook practice
- [x] Choose topics, traps, levels 1–5, timed/untimed, length 5–50; runs through the same session screen
- **Verify:** E2E for an untimed level-3 set of 5
- **Depends on:** 9 · **Files:** `src/ui/screens/Spellbook.tsx`, `tests/e2e/spellbook.spec.ts` · **Size:** S

### Checkpoint C — after tasks 11–15
- [x] Mock → review → coach → drill loop works on Chromium + WebKit; owner tries it (2026-11-04: "seems good"); committed with Tasks 13–16

---

## Phase 3 — Profiles and data

### Task 16: Profiles and house choice
- [x] First run: display name, house (Owlcrest/Emberwing/Foxglen/Starhorn), colour; parent can add, rename, delete profiles
- **Verify:** E2E for create → switch → delete; no other personal fields exist in storage
- **Depends on:** 10 · **Files:** `src/ui/screens/Profiles.tsx`, `src/data/profiles.ts`, `tests/e2e/profiles.spec.ts` · **Size:** M

### Task 17: Export, import, reset
- [x] Export a profile to JSON; import validates with `zod` and rejects bad files; reset all with confirmation
- **Verify:** E2E: export → reset → import gives identical history and dashboard numbers
- **Depends on:** 16 · **Files:** `src/data/transfer.ts`, `src/ui/screens/Settings.tsx`, `tests/e2e/transfer.spec.ts` · **Size:** M

### Task 18: Castle map progress (plain)
- [x] Per-mock trend (score, median time, trap rate, false-D, stamina); per topic and level table; empty state
- [x] Towers unlock from habits and progress, never from daily streaks
- **Verify:** component tests with fixtures; E2E empty and filled states
- **Depends on:** 11, 16 · **Files:** `src/ui/screens/CastleMap.tsx`, `src/core/analytics/progress.ts`, `tests/unit/progress.test.ts` · **Size:** M

### Checkpoint D — after tasks 16–18
- [x] Every Release 1 story works without the theme; E2E green (74/74, 2026-11-05); commit

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

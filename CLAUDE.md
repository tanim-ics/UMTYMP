# CLAUDE.md — UMTYMP Test Prep

A web app, run in Docker, for practising the UMTYMP (University of Minnesota Talented Youth Mathematics Program)
Algebra Qualifying Exam's quantitative-comparison format. It has a cartoon magic-school look for students in grades 5–8
(the exam itself is for grades 5–7). **Version 0.2.0 · phase: DEFINE · `docs/SPEC.md` v0.2 awaiting owner approval.**

Always-loaded rules (≤ 200 lines). Load `docs/` sections only when the task needs them:

| Doc | What's in it | Update when |
|---|---|---|
| `docs/SPEC.md` | Objective, look and feel, levels, stories, success criteria, open questions | Scope changes (owner approves) |
| `tasks/plan.md`, `tasks/todo.md` | Plan and task list (from `/plan`), current task, handoff notes | A task starts or finishes |
| `docs/CONSTRAINTS.md` | Quality bar with numbers + the command that checks each | Owner changes the bar — never to get green |
| `docs/CONTRACTS.md` | Question schema, core APIs, `AttemptEvent`, storage schema, test hooks | Before changing an interface |
| `docs/CONTENT.md` | Question-writing guide, tag/trap vocabulary, level guide, worked examples | Tags, traps, levels or style change |
| `docs/ASSETS.md` | Every image, font and sound with its source and licence | An asset is added |
| `docs/decisions/NNNN-*.md` | ADRs: context, decision, consequences, date | The owner decides something |
| `docs/EXAM_FACTS.md` | Official exam facts **with source + date checked** | Each exam season |
| `README.md` | Short guide for students, parents, and running with Docker | User-visible behaviour changes |

## 1. Product

**Exam (official, see `docs/EXAM_FACTS.md`):** 50 quantitative-comparison questions, an average of 30 s each, built on
pre-algebra; it rewards reasoning and speed, not computation. The 25-minute total is our assumption. Exam constants
live only in `src/core/config/exam.ts`.

**Answer encoding (data and code):** `A` = Quantity A greater · `B` = Quantity B greater · `C` = equal ·
`D` = not enough information. The UI shows words *and* letters.

**Goals:** real-feeling mocks · a ≤ 30 s shortcut for every question · trap recognition (negatives, zero, fractions
0–1, square roots) · coaching from the student's own data · a playful world 10–13-year-olds want to come back to.

**Non-goals (for now):** other exam sections; leaderboards or comparing students; an AI tutor chat; accounts and
cloud sync (Release 2).

**Privacy.** Users are children (COPPA, GDPR). Release 1 has no backend: everything stays in the browser (IndexedDB).
Store nothing about a child beyond a display name, house and mascot colour. No ads, trackers or analytics scripts.

## 2. Educational rules (binding for questions, UI and feedback)

- **Anti-computation:** no item needs long division, multi-step algebra or more arithmetic than a strong student does in
  their head in seconds. If computing is the only route, rewrite the item.
- **30-second rule:** every item has `shortcut_explanation` (≤ 3 sentences) and `target_seconds` within its level's
  limit (level 1 ≤ 10 s, 2 ≤ 15, 3 ≤ 20, 4 ≤ 25, 5 ≤ 30). Level definitions: `docs/SPEC.md` → Difficulty levels.
- **Trap teaching:** a `trap` item teaches the habit that beats it ("test 2, 0, −1, ½", "√ is the non-negative root",
  "figures are not to scale", "an even power hides the sign").
- **Correct keys, proven:** every item passes `npm run verify` before it enters the bank. `A`/`B`/`C`: a proof in
  `full_explanation` plus a randomized check over the condition's domain (negatives, 0, fractions, large values).
  `D`: two `witnesses` with different relations. Items the verifier can't evaluate need `reviewed_by` from a human.
- **Original content only:** never copy official samples, the registrant practice site or prep books.
- **Tone:** encouraging and concrete for a 10–13-year-old. Name the habit to change; never shame.

## 3. Question format

Practice material is ALWAYS a JSON array of items like this (full schema in `docs/CONTRACTS.md`; tags/traps only from
`docs/CONTENT.md` — propose new ones, don't invent them silently):

```json
{
  "id": "ineq-0042", "quantity_a": "x^2", "quantity_b": "x", "condition": "x \\neq 0",
  "expr_a": "x^2", "expr_b": "x", "domain": {"x": "real, x != 0"},
  "correct_answer": "D", "tags": ["inequalities", "exponents"], "trap": "fraction_0_1",
  "difficulty": 3, "target_seconds": 15,
  "witnesses": [{"x": 2, "relation": "A"}, {"x": 0.5, "relation": "B"}],
  "shortcut_explanation": "Try x = 2 (A wins) and x = ½ (B wins). Two different results → D.",
  "full_explanation": "For x > 1, x² > x; for 0 < x < 1, x² < x. The relation depends on x."
}
```

`quantity_*`/`condition` are KaTeX LaTeX for display (no `$`); `expr_*` are `mathjs` expressions for the verifier.
`condition` may be `null`. `difficulty` 1–5. `witnesses` only for `D`. After generating, report counts per
level/tag/trap and say the items still need the verifier and owner review.

## 4. Analytics and the Coach

Each answer produces an `AttemptEvent`: item, session, mode, choice (or `skipped`), correct, `shown_at`/`answered_at`
(ms from `performance.now()`), answer changes, position, level. Saved to IndexedDB as it happens.

| Metric | Definition | Use |
|---|---|---|
| Time per question | `answered_at − shown_at`, monotonic, never `Date.now()` | > 35 s flagged; median per tag and level |
| Pace | Answered vs. the 30 s/question line | "Behind pace" at 5-min marks |
| Concept accuracy | Correct ÷ attempted, per tag and level | Weakest tags drive drills |
| Trap susceptibility | Wrong on `D`-key items and on `trap` items, per trap | Trap drills |
| False D rate | `D` chosen when the key is `A`/`B`/`C` | Balances over-caution |
| Stamina | Accuracy, first 10 min vs. last 10 min of a full mock | Drop ≥ 15 points → stamina tip |
| Skips | Count + tags at time-out | No guessing advice until the penalty rule is known |

Metrics are pure, unit-tested functions in `src/core/analytics/`; never computed in components. No claim about a tag
with < 5 attempts. **Coach (Professor Hoot)** always says: one strength with its number → the biggest bottleneck with
its number → one habit plus a 10-question drill. Too little data → say so and suggest a full mock.

## 5. Tech stack and architecture

**Stack (ADR 0001, 2026-11-03, replaces Flutter):** TypeScript (strict) · React 18 + Vite · React Router · Zustand ·
CSS Modules + design tokens · Framer Motion (outside timed tests only) · KaTeX · `mathjs` (verifier) · Dexie
(IndexedDB) · `vite-plugin-pwa` (offline) · Vitest + Testing Library · Playwright + axe-core · Docker: Node 22 LTS
build stage → `nginx:alpine` runtime, `compose.yaml` services `dev`, `web`, `check`, `e2e`.

| Module | Responsibility |
|---|---|
| `src/core/questions/` | Load + validate bank, filter by tag/trap/level, seeded shuffle, build mocks and drills |
| `src/core/timer/` | Session clock from a `Clock` interface over `performance.now()`; pause rules; time-up |
| `src/core/analytics/` | `AttemptEvent[]` → metrics → coach feedback and habit badges |
| `src/data/` | Dexie repositories, schema migrations, export/import |
| `src/ui/` | Theme tokens, components, mascots, screens (CastleMap, GrandTrial, Review, Coach, PotionDrill, Spellbook, Profiles) |

`src/core/` is plain TypeScript: it never imports React, Dexie or browser APIs. Data flows test screen → events →
Zustand store → Dexie. Mock exams never pause; drills may; hiding the tab during a mock is recorded.

**Pattern to follow** (pure core function, tested with fixtures):

```ts
/** Share of D-key items answered A/B/C. Null when there is too little data to say anything. */
export function trapSusceptibility(events: readonly AttemptEvent[], minAttempts = 5): number | null {
  const dItems = events.filter((e) => e.correctAnswer === 'D' && e.choice !== null);
  if (dItems.length < minAttempts) return null;
  return dItems.filter((e) => e.choice !== 'D').length / dItems.length;
}
```

## 6. Commands (everything runs in Docker)

| Task | Command |
|---|---|
| Dev server (hot reload) | `docker compose up dev` → http://localhost:5173 |
| Production build | `docker compose up --build web` → http://localhost:8080 |
| Fast check (after each edit) | `docker compose run --rm check npm run check:fast` → types, ESLint, Prettier, floor guard, gitleaks |
| Task check (before calling a task done, ≤ 90 s) | `docker compose run --rm check npm run check:task` → fast + Vitest with coverage + `npm run verify` |
| Full check (before a checkpoint or merge) | `docker compose run --rm check npm run check:full` → task + dependency audits (browser tests join later) |
| Verify question bank | `docker compose run --rm check npm run verify` |

**Read `docs/CONSTRAINTS.md` before writing code. Do not weaken it to make a change pass.** It is the source of truth.

## 7. Boundaries

**Always**
- Run the task check before saying a task is done, and show the output.
- Test new pure logic first (failing test → pass); keep `src/core/` free of React and browser APIs.
- Use the monotonic clock for timing; exam constants in `exam.ts`; questions in `content/questions/*.json`.
- Accessibility: every control has an accessible name and a `data-testid="<screen>.<control>"`; targets ≥ 48 px;
  no colour-only right/wrong; WCAG AA contrast in light and dark themes; `prefers-reduced-motion` respected;
  keys `1`–`4`/`A`–`D` answer, `Enter`/`→` next, `S` skip, `F` flag.
- **Calm test screen:** themed but still — only the timer changes; no animation, sparkles or sound during a timed
  test; answer → next item < 50 ms; timer drift < 100 ms over 25 min (fake-clock test).
- **Theme:** our own magic academy (castle, owls, potions, spellbooks, houses Owlcrest/Emberwing/Foxglen/Starhorn).
  Original SVG art or CC0 only, logged in `docs/ASSETS.md`; open-licence Google Fonts. Rewards are for habits and
  progress, never for beating other students.
- Code: strict TypeScript, no `any`, ESLint + Prettier clean, immutable data in core, comments explain *why*.
  Data: versioned Dexie schema with migrations; export/import (JSON); "reset all data" with confirmation.

**Ask first**
- Adding a dependency, Docker service or network request; changing the question schema, `AttemptEvent`, storage
  schema, levels or capability map.
- Changing any threshold in `docs/CONSTRAINTS.md` or scope in `docs/SPEC.md`.
- Commits: only when asked; ask for a checkpoint commit at the end of every slice.

**Never**
- Use Harry Potter (or other franchise) names, characters, places, spells, crests, art or look-alike fonts.
- Add a backend, account, ads, trackers or analytics in Release 1; collect a child's email, real name or location.
- Ship a question that hasn't passed the verifier, or "fix" a failing check by editing the key without a proof.
- Skip, delete or weaken tests, add `eslint-disable`/`@ts-ignore`, or lower a threshold to get green.
- Run Node/npm on the host for project tasks (use the compose services); state exam facts without an official source.

## 8. Definition of done (every change)

1. **Correct:** acceptance criteria met; behaviour seen in the running container via Playwright or the test hooks,
   including edge cases (time-up with unanswered items, all skipped, empty history, tab hidden, offline, keyboard only).
2. **Tested:** new tests fail without the change and pass with it; task check green, no regressions.
3. **Clean:** scoped to the task; no dead code, `console.log` or unrelated refactors.
4. **Documented:** `docs/CONTRACTS.md`, `tasks/todo.md` and any ADR updated; say what couldn't be tested live.

**Test hooks** (dev build only, `window.__umtymp`): `state()` → JSON of screen, item, timer, answers; `seed(n)`;
fake `clock.advance(ms)`; `answer(letter)`; `loadFixture(name)`. Screenshot comparisons only for static screens.

## 9. How to work here (agent-skills plugin)

**Before any task, pick the matching skill and follow its steps in order, verification included.** No spec → `/spec`.

**Operating behaviours (non-negotiable):** (1) surface assumptions before non-trivial work; (2) on conflicting or
missing requirements, stop, name it, give options, wait; (3) push back with the concrete downside and an alternative;
(4) simplest thing that works; (5) touch only what the task needs; (6) verify with evidence, never "looks right".

| Phase | Command | Skills (`agent-skills:` prefix) | Output in this repo |
|---|---|---|---|
| Define | `/spec` | `interview-me`, `idea-refine`, `spec-driven-development` | `docs/SPEC.md` (owner approves) |
| Quality bar | `/constraints` | `constraint-driven-development` | `docs/CONSTRAINTS.md`, `check:*` scripts |
| Plan | `/plan` | `planning-and-task-breakdown` | `tasks/plan.md`, `tasks/todo.md` |
| Build | `/build` | `incremental-implementation`, `context-engineering`, `source-driven-development` (React, Vite, Dexie, Docker docs), `api-and-interface-design` (core APIs), `frontend-ui-engineering` (screens, theme), `doubt-driven-development` (timer, metrics, verifier) | One slice per task |
| Verify | `/test` | `test-driven-development`, `browser-testing-with-devtools`, `debugging-and-error-recovery` | Failing test first, then green |
| Review | `/agent-skills:review`, `/code-simplify`, `/webperf` | `code-review-and-quality`, `security-and-hardening` (child data, GDPR/COPPA, nginx headers), `performance-optimization`, `code-simplification` | Findings fixed or recorded |
| Ship | `/ship` | `git-workflow-and-versioning`, `ci-cd-and-automation`, `documentation-and-adrs`, `shipping-and-launch` | ADRs, changelog, image |

- **Review agents:** `agent-skills:code-reviewer` before merge; `agent-skills:security-auditor` for storage, export/
  import, nginx config and anything near child data; `agent-skills:test-engineer` for core and verifier tests;
  `agent-skills:web-performance-auditor` before a release.
- **Session handoff:** stop at a finished task. Record in `tasks/todo.md` the status, next task, files changed,
  verification commands + results, and open questions. A new session reads this file, `tasks/todo.md` and
  `git status` first, and never assumes approval that isn't written down.
- **Agents in parallel** only for large independent slices with owned files; end each round with the app-dev-playbook retro.

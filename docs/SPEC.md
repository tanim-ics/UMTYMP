# Spec: UMTYMP Test Prep (web app)

**Status: APPROVED v0.2 — owner approved 2026-11-03.** Replaces v0.1 (Flutter). Open questions were approved with
the defaults written in this spec; answers that change them update this file first.
Binding rules live in `CLAUDE.md`; exam facts and their sources in `docs/EXAM_FACTS.md`.

## Changes from v0.1 (owner request, 2026-11-03)

- **Web app only**, no Flutter. Runs in the browser; built and served with **Docker**.
- **Cartoon wizard-school look** for grades 5–8, with five difficulty levels.
- Corrections to the request are listed under "Corrections" below.

## Corrections to the request

1. **Grades.** UMTYMP lets only students in **grades 5–7** take this exam (`docs/EXAM_FACTS.md`). Content and
   difficulty target grades 5–7. The look and reading level work for grades 5–8, so an 8th grader can still use it
   for practice.
2. **"Harry Potter vibe" must be our own magic theme.** Harry Potter names, characters, houses, crests, places,
   spells, fonts and artwork are owned by Warner Bros. and J.K. Rowling, and using them could get the app taken down.
   We build an **original magic school** with the same feel: castle, spellbooks, potions, owls, starry skies,
   houses with their own names. See "Look and feel".
3. **"The most verified questions you can find."** There is no public bank of real UMTYMP questions. The official
   site shows **2 sample questions**, and registered students get a private practice site. Copying those or
   paid prep books would break copyright, and third-party answer keys aren't reliable. So **every question is
   original**, written by Claude, reviewed by you, and checked by the verifier. The bank grows in batches; the target
   is below.
4. **Exam time.** The official page says 50 questions at **an average of 30 s**. "25 minutes" is our own
   calculation, not an official number, so it stays a setting.

## Assumptions (correct these before approving)

1. **Release 1 is offline-only:** no accounts and no server data. Progress is saved in the browser on that device
   (IndexedDB). Parent accounts and sync across devices come in Release 2.
2. **Docker:** one `docker compose up` runs the app. Release 1 is a static site served by nginx in a container;
   Release 2 adds an API and a database container.
3. **Devices:** Chrome on Chromebooks and laptops, and Safari on iPad, at sizes from 768 px up. Phones work but aren't
   optimised. The app installs as a PWA and works offline after the first visit.
4. **No AI at runtime:** coaching is rule-based; the app never calls an LLM.
5. **English only.** Several student profiles per device (siblings), no passwords in Release 1.

## Objective

Students preparing for the UMTYMP Algebra Qualifying Exam practise its quantitative-comparison format under real
conditions and learn to solve each item in about 30 seconds by reasoning, not computing. The app measures *how* they
answer (time, traps, stamina) and tells them the one habit to change next, with a drill for it. A playful magic-school
world keeps 10–13-year-olds coming back.

**Users:** student (grades 5–7, design fits 5–8) · parent (profiles, progress, data control) · content author (owner).

**Success looks like:** after 4 weeks of use, a student finishes a full mock in time, and their time per question
and trap mistakes go down across mocks (shown on the dashboard).

## Look and feel

**Theme: an original magic academy** (working name: *Comparia Academy* — final name is an open question).

| Real app feature | Magic-school version |
|---|---|
| Home / dashboard | The castle map: towers unlock as the student improves |
| Full mock exam | "The Grand Trial" in the Great Library |
| Drill (10 questions) | "Potion practice": brew a potion by answering a drill |
| Topic practice | "Spellbook chapters", one per topic |
| Review of answers | "Review scroll": each question with its shortcut "spell" |
| Coach | A friendly owl mentor, *Professor Hoot* (original character) |
| Houses | 4 original houses chosen at sign-up, for colour and mascot only: **Owlcrest** (owl), **Emberwing** (dragon), **Foxglen** (fox), **Starhorn** (unicorn) |
| Rewards | Stars and badges for **habits** (e.g. "tested a negative number", "finished in time"), never for beating others |

**Design rules**
- Cartoon style: rounded shapes, thick outlines, warm night-sky and parchment palette, friendly mascots.
  All art is original SVG made for this app (or licensed CC0), recorded in `docs/ASSETS.md`.
- Fonts from Google Fonts with open licences: a storybook display font for headings (e.g. *Cinzel Decorative* or
  *Grenze*), a round readable font for text (e.g. *Nunito* or *Fredoka*). Never a Harry Potter–style font.
- **Calm during timed tests:** the test screen keeps the theme (parchment card, static mascot) but nothing moves
  except the timer: no sparkles, no sound, no confetti. Celebrations happen only on the results screen.
- Animations use CSS/Framer Motion, are short (< 400 ms), and are turned off when the device asks for reduced motion.
- Light "parchment" and dark "night sky" modes; text contrast meets WCAG AA in both.
- Large answer buttons (≥ 48 px), labels in words *and* letters: "A is greater · B is greater · Equal · Not enough info".

## Difficulty levels

Five levels, stored as `difficulty: 1–5`. Every item still follows the 30-second rule.

| Level | Name | What it looks like | Target time | Example idea |
|---|---|---|---|---|
| 1 | Apprentice | One idea, numbers only, no trap | ≤ 10 s | 3/4 vs 0.7 |
| 2 | Novice | One idea plus one simple shortcut or trap | ≤ 15 s | 2⁵ vs 5² |
| 3 | Adept | A variable with a condition; test cases needed | ≤ 20 s | x² vs x, x ≠ 0 |
| 4 | Expert | Two ideas combined, or a hidden trap | ≤ 25 s | √(x²) vs x |
| 5 | Archmage | Hardest exam-style items: subtle conditions, C vs D | ≤ 30 s | a/b vs b/a with a > b > 0 |

**Question bank target (all verified):**

| Batch | Level 1 | Level 2 | Level 3 | Level 4 | Level 5 | Total |
|---|---|---|---|---|---|---|
| Release 1 minimum | 60 | 90 | 100 | 90 | 60 | **400** |
| Release 1 goal | 100 | 150 | 150 | 130 | 70 | **600** |

Every topic tag and trap has items at ≥ 3 levels. A full mock mixes levels (default 6 / 10 / 14 / 12 / 8 per
level); a drill uses one level or ramps up.

## Capability map

| Module id | Responsibility | Depends on | Release |
|---|---|---|---|
| `content` | Question schema, bank, tag/trap/level vocabulary, verifier | — | 1 |
| `exam-session` | Mock/drill builders (seeded), session clock, test screen, keyboard + tap input, `AttemptEvent` | `content` | 1 |
| `history` | Profiles, attempt storage (IndexedDB), migrations, export/import, reset | `exam-session` | 1 |
| `analytics` | Metrics, coach feedback, drill choice, habit badges | `exam-session` | 1 |
| `world-ui` | Theme system, castle map, results, review, dashboard, mascots | `analytics`, `history` | 1 |
| `platform` | Docker images, compose, nginx, PWA/offline, CI | — | 1 |
| `sync` | Parent accounts, API + database containers, consent, sync | `history`, `platform` | 2 |

Build order: `platform` + `content` → `exam-session` → `history` + `analytics` → `world-ui` → `sync`.
Each module gets `docs/SPEC-<module-id>.md` once this map is approved.

## User stories and acceptance criteria (Release 1)

**S1 — Grand Trial (full mock).** 50 items (setting) and a 25:00 clock (setting) that counts down and is always visible.
Answer by tap or keys `1`–`4` / `A`–`D`; `Enter`/`→` next, `S` skip, `F` flag; go back and change answers. No pause;
at 0:00 it ends and unanswered items are recorded. Hiding the tab doesn't stop the clock. No item repeats across a
student's last 3 mocks while the bank allows it.

**S2 — Review.** Score, then every item with my answer, the key, the shortcut and the full explanation; filter to
wrong, slow (> 35 s) and flagged.

**S3 — Coach.** Professor Hoot shows exactly: one strength with its number, the biggest bottleneck with its number, one
habit and a "Brew a potion" (10-item drill) button. With too little data he says so and suggests a full mock.

**S4 — Potion drill.** 10 items for one tag, trap or level; may pause; shows the shortcut right after each answer.

**S5 — Spellbook practice.** Pick topics, traps and levels 1–5; timed or untimed; 5–50 items.

**S6 — Castle map and progress.** Per mock over time: score, median time per question, trap rate, false-D rate,
stamina drop; per topic and level: accuracy and median time. Towers unlock from habits and progress, not from
streaks that punish missed days. Empty state tells a new student where to start.

**S7 — Choose a house.** At first run the student picks a display name, a house and a mascot colour. No other data.

**P1 — Profiles.** A parent creates, renames and deletes student profiles on the device.

**P2 — Data control.** Export a profile to a JSON file, import it on another device, reset all data (with confirmation).

**C1 — Content.** Items live in `content/questions/*.json`. `npm run verify` rejects schema errors, unknown
tags/traps, a level outside 1–5, `target_seconds` above the level's limit, a `D` key without two disagreeing
witnesses, and any `A`/`B`/`C` key that a randomized check disproves. Items that can't be checked numerically
(geometry figures, word problems) need `"reviewed_by"` set by a human.

## Tech stack

| Part | Choice |
|---|---|
| Language | TypeScript (strict) |
| App | React 18 + Vite, React Router |
| State | Zustand |
| Styling | CSS Modules with design tokens (CSS variables); Framer Motion for non-test animation |
| Math | KaTeX for display; `mathjs` in the verifier for evaluating expressions |
| Storage | IndexedDB via Dexie; versioned schema |
| Offline | PWA via `vite-plugin-pwa` (service worker caches app + question bank) |
| Tests | Vitest + Testing Library (unit, components), Playwright (end-to-end), axe-core (accessibility) |
| Containers | Node 22 LTS build stage → `nginx:alpine` runtime; `docker compose` for dev, test and prod |
| Release 2 (later) | API (Node + Fastify) and PostgreSQL containers; decided in an ADR then |

## Commands

| Task | Command |
|---|---|
| Run dev (hot reload) | `docker compose up dev` → http://localhost:5173 |
| Run production build | `docker compose up web` → http://localhost:8080 |
| Fast check | `docker compose run --rm check npm run check:fast` (typecheck + lint + format) |
| Task check | `docker compose run --rm check npm run check:task` (fast + unit tests + `npm run verify`) |
| Full check | `docker compose run --rm e2e` (task + Playwright + axe) |
| Verify questions | `docker compose run --rm check npm run verify` |

## Project structure

```
src/core/questions/   → schema, bank loading, mock/drill builders (pure TS, no React)
src/core/timer/       → Clock interface, session clock (pure TS)
src/core/analytics/   → metrics, coach feedback, badges (pure TS)
src/data/             → Dexie repositories, export/import
src/ui/theme/         → tokens, fonts, light/dark, motion settings
src/ui/components/    → buttons, cards, mascots, math display
src/ui/screens/       → CastleMap, GrandTrial, Review, Coach, PotionDrill, Spellbook, Profiles
content/questions/    → question bank JSON, one file per topic
public/art/           → original SVG art (licences in docs/ASSETS.md)
tools/verify-questions.ts
tests/unit/ · tests/e2e/
docker/               → Dockerfile, nginx.conf; compose.yaml at the root
docs/                 → SPEC, CONSTRAINTS, CONTRACTS, CONTENT, ASSETS, EXAM_FACTS, decisions/
tasks/                → plan.md, todo.md (from /plan)
```

## Code style

See `CLAUDE.md` §5: pure functions over immutable data in `src/core/`, `null` when data is too thin, no `any`.

## Testing strategy

| Level | Tool | Covers |
|---|---|---|
| Unit | Vitest | Builders, seeded shuffle, clock (fake), every metric, coach choice, badges, verifier |
| Component | Vitest + Testing Library | Test screen keys and taps, timer text, coach card, empty states, reduced motion |
| End-to-end | Playwright (Chromium + WebKit) in Docker | S1–S7, P1–P2 through test hooks; offline mode |
| Accessibility | axe-core in Playwright | Zero serious/critical issues on every screen, both themes |
| Content | verifier | Whole bank on every task check |

## Boundaries

As in `CLAUDE.md` §7. Additionally for Release 1: **never** add a backend, account or network call besides loading
the app; **never** use Harry Potter names, art or fonts; **ask first** before changing the capability map, the
level definitions, or moving a story between releases.

## Success criteria (Release 1 is done when)

1. S1–S7, P1–P2 and C1 pass as Playwright tests in Docker on Chromium and WebKit (iPad viewport).
2. `docker compose up web` on a clean machine serves the app; image ≤ 50 MB.
3. Answer → next item < 50 ms (p95) with 4× CPU throttling; timer drift < 100 ms over 25 min (fake-clock test).
4. ≥ 400 verified items across 5 levels, matching the minimum per level above; every tag and trap at ≥ 3 levels.
5. With the network off after first load, every screen works; the network log shows no requests during a mock.
6. axe-core: zero serious/critical issues; keyboard-only Grand Trial possible end to end; reduced motion respected.
7. Coach output matches the expected strength/bottleneck/drill on ≥ 10 fixture histories.
8. Export → reset → import gives identical history and dashboard numbers.
9. Lighthouse on the production build meets `docs/CONSTRAINTS.md` (owner raised it to performance ≥ 95,
   accessibility ≥ 95 on 2026-11-03).
10. No Harry Potter names, art or fonts anywhere (checked against a word list in CI).

## Open questions

1. **App name:** keep the working name *Comparia Academy*, or another?
2. **House names and mascots:** OK with Owlcrest, Emberwing, Foxglen, Starhorn?
3. **Bank size:** is 400 items (about 8 batches of 50 for you to review) realistic for Release 1?
4. **Figure questions:** include geometry items with drawn figures in Release 1, or text-only first?
5. **Sound:** none at all, or optional sound effects outside timed tests (off by default)?
6. **Hosting:** where will the Docker image run (your laptop only, a school server, or a cloud host)?
7. **Wrong-answer penalty:** unknown from official sources; until known, the app gives no guessing advice.

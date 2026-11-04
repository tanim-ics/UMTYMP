# Implementation Plan: UMTYMP Test Prep — Release 1

**Status: DRAFT — awaiting owner review.** 2026-11-03. Source: `docs/SPEC.md` v0.2 (approved). Tasks: `tasks/todo.md`.

## Overview

Release 1 is an offline web app in Docker. Students take timed 50-question mocks, review answers with shortcuts, get
coaching from Professor Hoot, and practise with drills and topic sets, in an original cartoon magic-school world.
All data stays in the browser. The plan builds risky foundations first (Docker, verifier, timer), then one working
path from question → mock → saved attempts → coaching, then profiles and data, then the magic-school look, then
offline and performance. Writing questions runs alongside as its own track.

## Architecture decisions

- **Stack:** ADR 0001 (TypeScript, React + Vite, Zustand, Dexie, KaTeX, `mathjs`, Vitest, Playwright, nginx in Docker).
- **Pure core first:** `src/core/` (questions, timer, analytics) is plain TypeScript with unit tests. Screens only
  call it, so most logic is tested without a browser.
- **Look last, but not an afterthought:** screens are built plain first (working and accessible), then the theme is
  applied through design tokens and components. This keeps logic tasks small and lets art change without touching
  logic. Theme tokens exist from task 1 so plain screens aren't rewritten later.
- **Verifier before content:** no question enters the bank until `npm run verify` exists and passes, so wrong answer
  keys never reach students.
- **Runtime validation with `zod`** for the question bank and imported files (new dependency; needs your OK, see
  open questions).
- **Content as a parallel track:** batches of 50 items (C1–C8) start after task 6 and run beside the build; each
  batch needs your review.

## Phases (detail in `tasks/todo.md`)

| Phase | Tasks | Delivers | Checkpoint |
|---|---|---|---|
| 0 Foundation | 1–6 | Docker dev/prod, checks, question schema, verifier, 20 seed items | A: containers run, verifier proves seed bank |
| 1 Exam core | 7–10 | Clock, builders, plain Grand Trial, saved attempts | B: a full mock runs and survives reload |
| 2 Insights | 11–15 | Metrics, coach, results/review, potion drill, spellbook practice | C: mock → coach → drill loop works |
| 3 Profiles & data | 16–18 | Profiles + houses, export/import/reset, castle-map progress | D: all stories work, unthemed |
| 4 Magic world | 19–22 | Theme, original art, themed screens, accessibility pass | E: themed app passes axe + keyboard-only |
| 5 Offline & ship | 23–25 | PWA offline, performance, CI + franchise-name check | F: all 10 success criteria |
| Content | C1–C8 | ≥ 400 verified items in the level mix | Each batch reviewed by owner |

## Parallel work

- **Safe in parallel:** content batches beside any build task; tasks 11–12 (pure analytics) beside 13; art (20)
  beside 16–18.
- **Must be sequential:** schema (4) → verifier (5) → content; clock (7) → Grand Trial (9) → storage (10).
- Default is one task at a time inline. Parallel agents only if you ask, each with owned files.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Verifier can't evaluate some items (geometry figures, word problems) | High | `reviewed_by` field; text-only items first; geometry only if you approve (spec open question 4) |
| Reviewing 400+ items is slow for you | High | Batches of 50 with a compact review sheet; the verifier catches keys, you check wording and level |
| Browsers slow timers in hidden tabs | Med | Time always computed from `performance.now()` differences, never by counting ticks; test with tab hidden |
| Vite hot reload doesn't notice file changes in Docker on macOS | Med | Polling watcher in dev compose service; checked in task 1 |
| iPad Safari (WebKit) differences: IndexedDB, PWA, keyboard | Med | Playwright WebKit project from task 9 on; manual iPad check at checkpoint E |
| Theme drifts toward Harry Potter look-alikes | Med | Original names list in spec; word-list check in CI (task 25); art reviewed by you at checkpoint E |
| KaTeX math unreadable for screen readers | Med | KaTeX MathML output plus a spoken-form `aria-label` per expression |
| No git repo yet: no checkpoints to roll back to | Med | Task 1 starts with `git init` (with your OK) and a checkpoint commit after each checkpoint |

## Open questions (need your answer before the task that uses them)

1. **Git:** may I run `git init` in this folder at task 1? (Needed for checkpoint commits.)
2. **`zod`** for validating questions and imports — OK to add? (Task 4.)
3. **Quality bar:** run `/constraints` at task 3 with a short interview, or accept the spec's numbers as the bar?
4. **CI:** GitHub Actions running the compose checks, or no CI for now? (Task 25.)
5. Spec open questions 1–6 still use their defaults (name *Comparia Academy*, houses, 400 items, text-only first,
   no sound, local hosting). Say if any changes.

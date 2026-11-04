# Contracts

Binding interfaces between modules. Change one here first (ask the owner), then the code and its tests.

## Question item (`src/core/questions/schema.ts`)

One JSON object per question, stored in arrays in `content/questions/*.json`. Validated with zod; unknown fields are
rejected so typos fail loudly. Vocabulary lives in `src/core/questions/vocabulary.ts` and is explained in
`docs/CONTENT.md`.

| Field | Type | Rule |
|---|---|---|
| `id` | string | `topic-0001` form: lowercase words joined by `-`, then 4 digits; unique across the whole bank |
| `quantity_a`, `quantity_b` | string | KaTeX LaTeX shown to the student; not blank |
| `condition` | string \| null | KaTeX LaTeX, e.g. `x \neq 0`; `null` when there is none |
| `expr_a`, `expr_b` | string, optional | `mathjs` expressions the verifier evaluates; both or neither |
| `domain` | object, optional | Variable → allowed values, e.g. `{"x": "real, x != 0"}`; format below |
| `correct_answer` | `A` \| `B` \| `C` \| `D` | A greater · B greater · equal · not enough information |
| `tags` | string[] | At least one, no repeats, all from `TAGS` |
| `trap` | string \| null, optional | From `TRAPS` |
| `difficulty` | 1–5 | Level (Apprentice … Archmage) |
| `target_seconds` | positive integer | At most the level limit: 10 / 15 / 20 / 25 / 30 s |
| `witnesses` | array, only for `D` | At least 2, each `{ relation: "A"\|"B"\|"C", <variable>: number, … }`, with at least 2 different relations |
| `shortcut_explanation` | string | The fast route; at most 3 sentences (a decimal point is not a sentence end) |
| `full_explanation` | string | The full reasoning or proof |
| `reviewed_by` | string, optional | Who checked an item the verifier can't evaluate; required when `expr_*` are absent |

## Bank parsing (`src/core/questions/load.ts`)

```ts
interface BankFile { name: string; data: unknown }            // a file after JSON.parse
interface BankError { file: string; id: string | null; message: string }
function parseBank(files: readonly BankFile[]): { items: QuestionItem[]; errors: BankError[] };
```

- Pure: no file or browser access. Callers read files (`tools/verify-questions.ts` with Node `fs`; the app via Vite
  in task 8/9) and pass parsed JSON.
- Reports **every** problem: one error per failed rule, with `field.path: message`. `id` is `null` when the item has
  no readable id.
- Keeps valid items even when others fail. A repeated id keeps the first and reports the later one as `duplicate id`.
- A file that isn't a JSON array is one error.

## Verifier CLI (`npm run verify`)

Reads `content/questions/*.json` (sorted), runs `parseBank`, then `verifyItem` on every valid item, and prints every
problem (`file [id] …` for schema problems, `[id] …` for key problems; ids are unique). Exit `0` all valid (an empty or
missing bank is valid), `1` any problem (including invalid JSON), `2` could not read the folder.

## Domain format

`"<kind>[, <rule>, …]"` per variable. `kind` is `real` or `integer`. Each rule is a `mathjs` boolean expression and may
use any variable of the item: `"real, 0 < x < 1"`, `"integer, x > 0"`, `{"x": "real", "y": "real, y < x"}`.
No `domain` means the item has no variables. The domain must say what the displayed `condition` says (a human check).

## Answer-key proof (`src/core/questions/evaluate.ts`)

```ts
const SAMPLES_PER_ITEM = 500;
interface VerifyResult { problems: string[]; checks: number }   // checks = value assignments evaluated
function verifyItem(item: QuestionItem): VerifyResult;          // pure, deterministic (seeded by item id)
```

- **No `expr_*`:** passes only with `reviewed_by`.
- **`A`/`B`/`C`:** the key must hold at every edge combination inside the domain (real: −1, 0, ½, 1, 2, −½, −2,
  ±10⁶; integer: −1, 0, 1, 2, −2, ±10⁶) and at 500 random domain values (mixed small, fractional and large
  magnitudes). The first failure is reported as a counter-example: `key is A but x = 0 gives C`.
- **`D`:** every witness must give a value to each domain variable (and no others), lie inside the domain, and really
  produce its stated `relation`. The schema already requires two different relations.
- Equality uses a relative tolerance of 10⁻⁹, so `0.1 + 0.2` equals `0.3`.
- Also reported: unreadable expressions or rules, a `kind` other than `real`/`integer`, a domain with no values or
  too narrow to find 500, and a result that is not a finite real number (e.g. `sqrt(x)` at a negative x).
- `mathjs` is a dev dependency: only the verifier imports this file, so it never ships in the app bundle.

## Clock and session timer (`src/core/timer/`)

```ts
interface Clock { now(): number }                        // monotonic ms; never Date.now()
const systemClock: Clock;                                // performance.timeOrigin + performance.now()
function createFakeClock(start?: number): Clock & { advance(ms: number): void };  // tests, dev hook

type TimerMode = 'mock' | 'drill';
type TimerStatus = 'running' | 'paused' | 'time_up';
interface TimerState { mode; durationMs: number | null; startedAt; pausedAt; pausedMs; hiddenAt; hiddenMs;
                       hiddenCount; timeUpFired }       // all readonly
startTimer({ mode, durationMs }, now) → TimerState       // durationMs null = untimed, counts up
elapsedMs(s, now) · remainingMs(s, now) → number | null · timerStatus(s, now) · hiddenMs(s, now)
pauseTimer(s, now) · resumeTimer(s, now) · markHidden(s, now) · markVisible(s, now) → TimerState
checkTimeUp(s, now) → { state, fired }                   // fired is true exactly once
msUntilTimeUp(s, now) → number | null                    // null when untimed or paused
```

- Pure functions of `now`; state is immutable (a change returns a new object, a no-op returns the same one).
- `systemClock` is monotonic within a page and on the epoch scale, so a session saved before a reload resumes with
  its clock still running. `elapsedMs` is clamped at 0 in case the device clock moved back between reloads.
- Time is derived from the clock on every read, never accumulated per tick, so frame jitter and a throttled hidden
  tab cannot cause drift.
- `elapsedMs` excludes pauses and stops at the duration; `remainingMs` never goes below 0.
- A mock cannot pause (`pauseTimer` throws). A drill can, unless its time is up. A paused timer never reaches time-up.
- Hiding the tab never stops the clock; it only records `hiddenCount` and `hiddenMs` for the attempt log.
- The screen calls `checkTimeUp` on each tick and on `visibilitychange`, and may schedule one wake-up from
  `msUntilTimeUp`.

## Exam settings (`src/core/config/exam.ts`)

`EXAM`: `questionCount` 50 (official) · `durationMs` 25 min (assumption: 50 × 30 s) · `levelMix` 6/10/14/12/8 ·
`recentMocksToAvoid` 3 · `drillLength` 10 · `practiceLength` 5–50. Exam constants live nowhere else.

## Set builders (`src/core/questions/build.ts`, `src/core/random.ts`)

```ts
interface BuiltSet { items: QuestionItem[]; missing: number }         // missing = requested − returned
interface BuiltMock extends BuiltSet { reusedRecent: number }
seededShuffle<T>(list, seed) → T[]
buildMock(bank, { seed, recentMocks?: string[][] }) → BuiltMock        // recentMocks oldest → newest, item ids
buildDrill(bank, { seed, focus: {kind:'tag',tag} | {kind:'trap',trap} | {kind:'level',level} }) → BuiltSet
buildPractice(bank, { seed, length, tags?, traps?, levels? }) → BuiltSet   // throws RangeError outside 5–50
```

- Pure and seeded (mulberry32 in `random.ts`, shared with the verifier): same bank + options + seed → same items in
  the same order. Inputs are never changed. No item appears twice in a set.
- **Mock:** each level gets its `levelMix` count, fresh items first, then items from the last 3 mocks; only then does a
  short level borrow from the nearest levels (easier first on a tie), again fresh before recent. The difficulty mix
  is kept ahead of freshness. The final order is shuffled because the official difficulty order is unknown.
- **Drill:** 10 items matching the focus, sorted easiest first (stable, so same-level items keep their shuffle).
- **Practice:** an item matches when it has any chosen tag, any chosen trap and any chosen level; an empty filter
  allows all.
- A small bank never throws: the builders return what exists and report `missing`; the screen decides what to say.

## `AttemptEvent` (`src/core/session/attempt.ts`)

One per item per session, created or updated the moment the student answers or skips; the rest are added as
`unanswered` when the session ends. Changing this shape needs the owner (`CLAUDE.md` §7) and a storage migration
once task 10 saves it.

| Field | Meaning |
|---|---|
| `sessionId`, `mode` | Which session; `mock` · `drill` · `practice` |
| `itemId`, `position` | The item and its 0-based place in the session |
| `level`, `tags`, `trap`, `correctAnswer` | Copied from the item so metrics never need the bank |
| `choice` | `A`–`D`, or `null` when skipped or unanswered |
| `status` | `answered` · `skipped` (pressed Skip) · `unanswered` (session ended first) |
| `correct` | `choice === correctAnswer` |
| `shownAt`, `answeredAt` | Monotonic ms: last display of the item before the final answer/skip, and that answer/skip. Time per question = `answeredAt − shownAt`. `answeredAt` is `null` when unanswered; `shownAt` is `null` if never shown |
| `answerChanges` | Switches from one letter to another; pressing the chosen letter again is not a new answer and keeps `answeredAt` |
| `flagged` | The item's flag at its last update |

## Trial rules (`src/core/session/trial.ts`)

`startTrial({ sessionId, mode, items, durationMs }, now)` → `TrialState`; actions `answerItem(s, letter, now)`,
`skipItem`, `nextItem`, `backItem` (`(s, now)`), `toggleFlag(s)`, `finishTrial(s, 'completed' | 'time_up')`,
`tickTrial(s, now)`. All pure; a no-op returns the same object.

- Skip records `skipped` only if the item has no event yet, then moves on; answering a skipped item turns it into an
  answer. Next/Back stop at the ends.
- After the trial ends every action is a no-op. `tickTrial` ends a timed trial at time-up.

## Session store (`src/store/session.ts`)

`createSessionStore(clock)` → Zustand store `{ trial, now, startMock(bank, seed, recentMocks?), answer, skip, next,
back, flag, finish, tick, setHidden(hidden), reset }`. Each action reads `clock.now()` once and applies a trial
rule; `setHidden(false)` also checks time-up. `resume(trial)` continues a saved
session: it ends the hidden spell the old page opened while unloading, then checks time-up. `saveFailed` /
`reportSaveError()` let the home screen say saving is off. The screen ticks every 250 ms and on `visibilitychange`.

## Grand Trial keys (`src/ui/screens/GrandTrial.tsx`)

`1`–`4` or `A`–`D` answer (any case) · `Enter`/`→` next · `←` back · `S` skip · `F` flag · keys with Ctrl/Alt/Meta
are ignored. On the last item `Enter` moves focus to **Finish trial** and a second `Enter` presses it, so one stray
key never ends a mock. A focused control button handles its own `Enter`; a focused answer button does not.
Answer buttons are named by their visible text ("A Quantity A is greater"); `aria-pressed` marks the choice.

## Dev test hooks (`src/dev/testHooks.ts`, dev builds only)

`window.__umtymp`: `state()` → `{ screen: 'home' | 'trial' | 'result', index, itemId, total, remainingMs,
endReason, answers[{ itemId, status, choice }], hiddenCount }` · `seed(n)` starts a mock with seed `n` ·
`answer(letter)` · `flush()` resolves once every change so far is saved · `clock.advance(ms)` only with
`?clock=fake` (the fake clock replaces the real one and the hook
ticks the store). `?bank=repeat` pads the seed bank 4× under ids like `copy-a-frac-0001`
(`src/dev/devBank.ts`) so a full 50-item mock runs before the real bank is big enough. `loadFixture(name)` arrives
with the metrics (task 11).

## Local storage (`src/data/db.ts`, schema v1)

Dexie database `umtymp`. Changing a table needs the owner (`CLAUDE.md` §7) and a new `version(n)` with an upgrade;
version 1 is never edited.

| Table | Key / indexes | Row |
|---|---|---|
| `profiles` | `id` | `{ id, displayName, house: 'owlcrest' \| 'emberwing' \| 'foxglen' \| 'starhorn' \| null, mascotColor }`; nothing else about a child |
| `sessions` | `id`; `startedAt`, `profileId` | Session snapshot: `mode`, `itemIds` (order), `index`, `shownAt`, `lastShownAt`, `flags`, `timer` (`TimerState`), `endReason`, `startedAt`, `profileId` (null until profiles exist) |
| `attempts` | `[sessionId+position]`; `sessionId`, `itemId` | One `AttemptEvent` per item per session |

## Attempt repository (`src/data/attempts.ts`)

```ts
createAttemptRepo(db) → {
  saveTrial(trial): Promise<void>            // session row + all events, one transaction (upsert)
  loadActive(bank): Promise<TrialState | null> // newest unfinished session; null if the bank lost one of its items
  listFinished(): Promise<FinishedSession[]> // mocks only, newest first: { sessionId, startedAt, total, correct, endReason, itemIds }
}
connectPersistence(store, repo, onError) → { flush(): Promise<void>; disconnect(): void }
```

- Saves whenever `trial` changes (answer, skip, flag, move, hide/show, end), never on ticks that change nothing; writes
  run in order. A failed write calls `onError` and the trial continues.
- **Unload limit:** a browser abandons an IndexedDB write still running when the page unloads, and nothing can make
  unload wait for it. A save takes 0.5 ms median, 2.6 ms max (50 events, dev build, 2026-11-04), so only an action
  in the last few milliseconds before a reload or tab close can be lost. Browser tests call the `flush()` hook before
  reloading for that reason.
- Boot (`main.tsx`): open the database (failure → run without saving, home says so), resume `loadActive`, connect
  persistence. The home screen lists `listFinished()` and passes their `itemIds` (oldest first) to `startMock` so a
  new mock avoids the last 3 mocks' items.

## Metrics (`src/core/analytics/metrics.ts`)

Pure functions of `AttemptEvent[]`. `METRICS`: `minAttempts` 5 · `slowSeconds` 35 · `paceSecondsPerQuestion` 30 ·
`paceMarkMs` 5 min · `staminaWindowMs` 10 min · `staminaDropPoints` 15. Every rate is `null` below 5 answers; counts
are always given.

| # | Function | Definition |
|---|---|---|
| 1 | `timeMs(e)`, `slowEvents(events)`, `medianTimeBy(events, 'tag' \| 'level')` | `answeredAt − shownAt` for **answered** items only (skips are near-instant and would skew medians); slow = more than 35 s; median per tag/level, null below 5 |
| 2 | `paceMarks(events, { startedAt, endedAt })` | At each 5-min mark up to `endedAt`: answered so far (by `answeredAt`, inclusive) vs `floor(mark / 30 s)`; `behind` when fewer |
| 3 | `accuracy(events)`, `accuracyBy(events, 'tag' \| 'level')` | correct ÷ **answered**; skipped and unanswered are not attempts. `{ attempted, correct, accuracy }` per group |
| 4 | `trapSusceptibility(events)`, `trapSusceptibilityByTrap(events)` | Share of D-key items answered A/B/C (the `CLAUDE.md` pattern); per trap: wrong ÷ answered among items carrying it |
| 5 | `falseDRate(events)` | Share of answered A/B/C-key items answered D |
| 6 | `stamina(events, { startedAt, durationMs })` | Accuracy of answers in `[start, start+10 min)` vs `[end−10 min, end]`; null if the session is under 20 min or a window has < 5 answers; `dropPoints` rounded to 1/10 000 point (floating point made 95 % − 80 % read 14.999…); `tip` at ≥ 15 |
| 7 | `skips(events)` | `{ skipped, unanswered, tags }`, tags counted over skipped + unanswered items |

An item with several tags counts under each. Metrics are computed here only, never in components.

## Coach (`src/core/analytics/coach.ts`)

```ts
interface SessionRecord { sessionId; mode; startedAt; durationMs: number | null; endReason: EndReason | null; events }
coach(history: SessionRecord[]) → CoachFeedback
  | { kind: 'feedback'; strength; bottleneck; drill: DrillFocus; strengthText; bottleneckText; habitText }
  | { kind: 'not_enough_data'; answered; neededPerTopic: 5 }
```

- **Not enough data:** no topic has 5 answers yet → Hoot says so and suggests a full mock.
- **Strength:** the topic with the best accuracy (≥ 5 answers), compared as exact fractions; ties → more answers,
  then vocabulary order.
- **Bottleneck = most questions lost**, among: a trap (wrong answers), D questions answered A/B/C, D chosen on
  fixed-answer questions, questions left when the latest mock **timed out**, a stamina tip on the latest mock
  (drop × 20 questions in 10 min), a topic (wrong answers; never the strength topic). Each needs ≥ 5 answers. Equal
  losses go to the more specific habit, in that order. Nothing lost → `challenge` with a drill one level up (max 5);
  its text says "Nothing slipped" only when every answer was right.
- **Drill:** the trap or topic itself; D misses → their most common trap (no trap → level 3); false D, time-out and
  stamina → the most common topic among those questions.
- Time and stamina use the latest finished mock only; everything else uses the whole history.

## Habit badges (`src/core/analytics/badges.ts`)

`earnedBadges(history) → { id, title, evidence }[]`, from finished sessions only. Habits and progress, never
comparison with others.

| Id | Earned when |
|---|---|
| `first_trial` | A mock is finished |
| `finished_in_time` | A finished mock has no unanswered question |
| `steady_pace` | A finished mock is on the 30 s line at every 5-minute mark (at least one mark) |
| `negative_tester` | 5 right answers on `negative_numbers` trap items |
| `d_detector` | ≥ 10 D-key questions answered, ≥ 80 % right (compared as whole numbers) |

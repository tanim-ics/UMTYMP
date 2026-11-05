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

`EXAM`: `questionCount` 50 (official) · `secondsPerQuestion` 30 (official average; also the metrics' pace line) ·
`durationMs` 25 min (assumption: 50 × 30 s) · `levelMix` 6/10/14/12/8 ·
`recentMocksToAvoid` 3 · `drillLength` 10 · `practiceLength` 5–50. Exam constants live nowhere else.

## Set builders (`src/core/questions/build.ts`, `src/core/random.ts`)

```ts
interface BuiltSet { items: QuestionItem[]; missing: number }         // missing = requested − returned
interface BuiltMock extends BuiltSet { reusedRecent: number }
seededShuffle<T>(list, seed) → T[]
buildMock(bank, { seed, recentMocks?: string[][] }) → BuiltMock        // recentMocks oldest → newest, item ids
buildDrill(bank, { seed, focus: {kind:'tag',tag} | {kind:'trap',trap} | {kind:'level',level} }) → BuiltSet
buildPractice(bank, { seed, length, tags?, traps?, levels? }) → BuiltSet   // throws RangeError outside 5–50
countMatching(bank, { tags?, traps?, levels? }) → number                  // what a Spellbook set can draw from
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
- `pauseTrial(s, now)` / `resumeTrial(s, now)`: drills and practice only (a mock throws). While paused, answer,
  skip, move and flag are no-ops; resuming moves the current item's `shownAt` forward by the pause, so time per
  question counts only time on screen.
- In a **drill** an answer is final once given: the shortcut is shown right after it.

## Session store (`src/store/session.ts`)

`createSessionStore(clock)` → Zustand store `{ trial, now, startMock(bank, seed, recentMocks?), answer, skip, next,
back, flag, finish, tick, setHidden(hidden), reset }`. Each action reads `clock.now()` once and applies a trial
rule; `setHidden(false)` also checks time-up. `startDrill(bank, focus, seed)` starts an untimed 10-item drill and, when
the current trial is a finished mock, keeps it in `returnTo`; `backToResults()` returns to it (or home);
`pause()` / `unpause()`. `startPractice(bank, { tags, traps, levels, length, timed }, seed)`: mode `practice`,
timed = 30 s × the questions actually drawn, untimed = no countdown; answers can change; no pause. `resume(trial)` continues a saved
session: it ends the hidden spell the old page opened while unloading, then checks time-up. `saveFailed` /
`reportSaveError()` let the home screen say saving is off. The screen ticks every 250 ms and on `visibilitychange`.

## Grand Trial keys (`src/ui/screens/GrandTrial.tsx`)

`1`–`4` or `A`–`D` answer (any case) · `Enter`/`→` next · `←` back · `S` skip · `F` flag · keys with Ctrl/Alt/Meta
are ignored. On the last item `Enter` moves focus to **Finish trial** and a second `Enter` presses it, so one stray
key never ends a mock. A focused control button handles its own `Enter`; a focused answer button does not.
Answer buttons are named by their visible text ("A Quantity A is greater"); `aria-pressed` marks the choice.

## Dev test hooks (`src/dev/testHooks.ts`, dev builds only)

`window.__umtymp`: `state()` → `{ screen: 'home' | 'trial' | 'result', index, itemId, total, remainingMs,
endReason, answers[{ itemId, status, choice, correct }], hiddenCount }` · `seed(n)` starts a mock with seed `n` ·
`answer(letter)` · `flush()` resolves once every change so far is saved · `clock.advance(ms)` only with
`?clock=fake` (the fake clock replaces the real one and the hook
ticks the store). `coachTexts()` → Hoot's strength and leak sentences for the current student from storage.
`loadFixture('all-right' | 'all-wrong' | 'not-enough-data')` shows the results of a
finished sample mock built from the bank (`src/dev/fixtures.ts`); it is saved like a real mock. `?bank=repeat` pads the seed bank 4× under ids like `copy-a-frac-0001`
(`src/dev/devBank.ts`) so a full 50-item mock runs before the real bank is big enough. 

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
  saveTrial(trial, profileId): Promise<void>        // session row + all events, one transaction (upsert)
  loadActive(bank, profileId): Promise<TrialState | null> // the profile's newest unfinished session
  listFinished(profileId): Promise<FinishedSession[]> // the profile's mocks, newest first
  listHistory(profileId): Promise<SessionRecord[]>    // the profile's finished sessions, oldest first (coach input)
}
connectPersistence(store, repo, onError) → { flush(): Promise<void>; disconnect(): void }   // saves under store.profileId
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
| 1 | `timeMs(e)`, `slowEvents(events)`, `medianTime(events)`, `medianTimeBy(events, 'tag' \| 'level')` | `answeredAt − shownAt` for **answered** items only (skips are near-instant and would skew medians); slow = more than 35 s; median per tag/level, null below 5 |
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
coach(history: SessionRecord[], { latestSessionId? }) → CoachFeedback
  | { kind: 'feedback'; strength; bottleneck; drill: DrillFocus; strengthText; bottleneckText; habitText }
  | { kind: 'not_enough_data'; answered; neededPerTopic: 5 }
```

- **Not enough data:** no topic has 5 answers yet → Hoot says so and suggests a full mock.
- **Strength:** the topic with the best accuracy (≥ 5 answers), compared as exact fractions; ties → more answers,
  then vocabulary order.
  If no topic has a right answer yet, the strength is the effort (`{ kind: 'effort', answered, total }`): Hoot
  never calls "0 of 8 right" a strength.
- **Bottleneck = most questions lost**, among: a trap (wrong answers), D questions answered A/B/C, D chosen on
  fixed-answer questions, questions left when the latest mock **timed out**, a stamina tip on the latest mock
  (drop × 20 questions in 10 min), a topic (wrong answers; never the strength topic). Each needs ≥ 5 answers. Equal
  losses go to the more specific habit, in that order. Nothing lost → `challenge` with a drill one level up (max 5);
  its text says "Nothing slipped" only when every answer was right.
- **Drill:** the trap or topic itself; D misses → their most common trap (no trap → level 3); false D, time-out and
  stamina → the most common topic among those questions.
- Time and stamina use the latest finished mock only (the one named by `latestSessionId`, else the one that
  started last); everything else uses the whole history.

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

## Results and review (`src/core/analytics/review.ts`, `src/ui/screens/Results.tsx`, `Review.tsx`)

`resultSummary(events)` → `{ total, correct, wrong, skipped, unanswered, slow }` (wrong = answered but not right).
`matchesFilter(e, 'all' | 'wrong' | 'slow' | 'flagged')`, `filterCounts(events)`. **"Wrong" means wrong or missed**:
skipped and unanswered questions count, because they are the ones to look at again. "Slow" is the metric's > 35 s.

- Results: score, summary line, how it ended; **Review answers** and **Back to start**.
- Review: every question in exam order with verdict in words (Right · Wrong · Skipped · No answer), flag, condition,
  quantities, your answer and the key (letter + words), time (with "slow"), shortcut and full explanation. One
  filter at a time (`aria-pressed`), each with its count; an empty filter says "Nothing to show here".
- Answer words live in `src/ui/answers.ts`, shared by the trial and the review.

## Coach card and potion drill (`src/ui/components/CoachCard.tsx`, `src/ui/screens/PotionDrill.tsx`)

- The results of a **mock** show the coach card: strength, biggest leak, "Habit to try" and **Brew a potion: …**
  (disabled with a note when the bank has no questions for it). Input: `listHistory()` plus the shown mock, counted
  once, named as the latest. Not enough data → "needs at least 5 answers in one topic … A full Grand Trial".
- The drill: "Potion question n of N", a count-up timer, **Pause (P)**. Paused hides the question. After each answer:
  "Right!" or "Not quite. The answer is B, …", then the shortcut (`role="status"`); the answer buttons lock.
  Keys as in the mock, plus `P`. Its results say "Potion brewed!", have no coach card, and **Back to trial
  results** returns to the mock.
- Shared pieces: `components/Question.tsx` (question, answers, nav) and `components/useTrialControls.ts` (keys,
  tick, hidden tab).

## Spellbook (`src/ui/screens/Spellbook.tsx`) and labels (`src/ui/labels.ts`)

- Checkboxes for every topic, trap ("… trap", so names stay unique: `absolute_value` is both) and level ("Level 3:
  Adept"); a length box (whole number 5–50, otherwise an error and Start is disabled); **Timed: 30 seconds per
  question**. A live count says how many questions match; fewer than the length → "The set will have N questions".
  Start closes the Spellbook, so the results' **Back to start** goes home.
- Practice runs on the mock's session screen ("Spellbook practice", **Finish practice**); untimed shows a count-up
  clock labelled "Time spent". Results say "Practice complete!", with no coach card.
- Student-facing names: `LEVEL_NAMES` (Apprentice … Archmage) and `TRAP_NAMES` (e.g. `fraction_0_1` → "fractions
  between 0 and 1") in `src/core/questions/vocabulary.ts`, used by the coach's sentences and `labels.ts`.

## Profiles (`src/data/profiles.ts`, `src/ui/screens/Profiles.tsx`)

```ts
HOUSES: { id: 'owlcrest' | 'emberwing' | 'foxglen' | 'starhorn'; name; mascot }[]
MASCOT_COLORS: { id; name; hex }[]          // always shown with the name, never colour alone
validateName(raw) · validateProfile({ displayName, house, mascotColor }) → { ok, value } | { ok: false, error }
createProfileRepo(db) → { list(), create(input), rename(id, name), remove(id) }
```

- A profile row is exactly `{ id, displayName, house, mascotColor }` (checked by the E2E storage test). Names: trimmed,
  1–20 characters, one line. The form asks for a nickname and warns against a full real name.
- `create`: the **first** profile adopts sessions saved before profiles existed (`profileId` null). `remove`: the
  profile, its sessions and their answers, in one transaction; nobody else's.
- Store: `profileId` + `setProfile(id | null)` (switching forgets the session on screen; it stays saved). Every session
  is saved under `profileId`; resume, history, the coach and the last-3-mocks rule see only that student.
- App (`data` prop): no profiles → Welcome form; one → picked automatically on the **first load only**; otherwise
  "Who's playing?". Choosing a student resumes their unfinished mock. Home shows "Playing as …" and **Switch student**.
  **Manage students (for parents)**: rename, and delete behind an `alertdialog` that names what is lost.
- No active-profile memory between visits (no new storage): each visit starts at "Who's playing?", which suits a
  shared family device.

## Export, import and reset (`src/data/transfer.ts`, `src/ui/screens/Settings.tsx`)

File format 1 (JSON, `comparia-<nickname>-<date>.json`):

```ts
{ app: 'comparia-academy', format: 1, exportedAt: string,
  profile: { displayName, house, mascotColor },     // the three profile fields, nothing else
  sessions: SessionRow-without-profileId[],          // an allowlist of fields, so new columns can't leak
  attempts: AttemptEvent[] }
exportProfile(db, profileId) · serializeExport(file) · parseExport(text) → { ok, value } | { ok: false, error }
importProfile(db, file) → ProfileRow · resetAll(db) · createTransfer(db) → { exportText, importText, resetAll }
```

- **parseExport** refuses: more than 10 MB; not JSON or another app ("not a Comparia Academy file"); a newer format
  ("update the app"); any unknown field anywhere (zod strict); an invalid profile; a session whose `index`, `flags`
  or `lastShownAt` doesn't fit its questions; an answer that belongs to no session or to the wrong question. Errors
  are written for a parent and never echo the file.
- **importProfile** always adds a **new** student with new profile and session ids, in one transaction, so importing
  twice or onto a device with data never overwrites or merges anyone's progress.
- **resetAll** clears profiles, sessions and answers; the app returns to Welcome.
- Settings & data (for parents) is reached from "Who's playing?" and from the Welcome form (a new device can import
  before any student exists). Reset sits behind an `alertdialog` ("Export first if you want to keep anything").
- History reads wait for pending saves (`data.whenSaved`), so a mock finished a moment ago is always listed.

## Castle map (`src/core/analytics/progress.ts`, `src/ui/screens/CastleMap.tsx`)

```ts
mockTrend(history) → { sessionId, startedAt, endReason, correct, total,
                       medianMs, trapRate, falseDRate, staminaDropPoints }[]   // finished mocks, oldest first
progressTable(history) → { tags: ProgressRow<Tag>[], levels: ProgressRow<Level>[] }
  // ProgressRow = { key, attempted, correct, accuracy, medianMs }, every finished session (mock, drill, practice),
  // vocabulary order, only keys with answers
towers(history) → { id, name, unlocked, evidence, howTo }[]                    // fixed order, always all six
```

- **Trap rate** (per mock): wrong ÷ answered among items with a `trap` or a D key. Every rate and median is `null`
  below 5 answers (shown as "—", explained under the tables).
- **Towers:** Gate (`first_trial`), Clock (`finished_in_time`), Hourglass (`steady_pace`), Shadow
  (`negative_tester`), Mist (`d_detector`) open from the habit badges; **Rising** opens when a later mock has a
  higher share right than the first (compared as whole numbers; evidence "From 40% to 70% right since your first
  Grand Trial"). Nothing reads dates, so a break never locks a tower (tested).
- Home → **Castle map** (`home.castle`). Empty state (`castle.empty`) when there is no finished session: says to
  start with a Grand Trial and offers `castle.start`; its results lead home. Test ids: `castle.tower`
  (`data-unlocked`), `castle.trend`, `castle.topics`, `castle.levels`, `castle.back`. Tables scroll sideways on a
  phone instead of widening the page.

## Theme (`src/ui/theme/tokens.css`, `src/ui/theme/motion.ts`)

| Token | Use | Checked |
|---|---|---|
| `--color-bg`, `--color-surface` | Page and card backgrounds | — |
| `--color-text`, `--color-muted`, `--color-accent`, `--color-right`, `--color-wrong` | Text on either background | ≥ 4.5 : 1 |
| `--color-on-accent` | Text on an accent fill | ≥ 4.5 : 1 on `--color-accent` |
| `--color-accent`, `--color-ink` | Focus rings, chosen borders, control outlines | ≥ 3 : 1 on either background |
| `--color-border` | Decorative card edges only (low contrast on purpose) | — |
| `--color-art-bg` | The light disc behind every picture | art outline `#2b2238` ≥ 3 : 1 on it |
| `--font-display` (Grenze), `--font-body` (Nunito) | Headings, timer, letters / everything else | — |
| `--motion-fast` 150 ms, `--motion-base` 250 ms | CSS animation lengths; 0 ms under reduced motion | — |

Dark mode (`prefers-color-scheme: dark`) redefines every colour token. Reduced motion sets every `--motion-*` to 0 and
stops all CSS animations and transitions. `motionMs(speed)` returns `MOTION_MS[speed]`, or 0 when
`prefersReducedMotion()` is true; that function also returns true when the browser has no `matchMedia`. Use
`motionMs` for script-driven motion, and never on a timed test screen.

**Screens (Task 21).** All screens share `src/ui/screens/GrandTrial.module.css`. Controls (`.button`, inputs) have a
`--color-ink` outline; `.primary` is the one filled main action per screen. The file has no transitions at all, so
nothing on a timed test can move; its only animation is the results celebration (`.star`, 380 ms, once).
`<Art name size testId>` (`src/ui/components/Art.tsx`) shows a picture from `public/art/`: `name` is one of `ART`
(a missing file is a type error and a unit-test failure), `size` is `icon` 48 px, `medium` 96 px or `banner`
480 × 300 (scales down), and the picture is always decorative (`alt=""`), so the words beside it must say the same.
Where: home (castle banner, the student's crest), Welcome (a crest per house), Grand Trial (a still Hoot), potion
drill (potion), Spellbook (book), castle map (banner), results (celebration), coach card (Hoot).

**Accessibility (Task 22).** Every control — buttons, fields, radios, the file picker — shows the same 3 px
`--color-accent` ring on `:focus-visible`. `spokenMath(latex): string | null` (`src/core/questions/spoken.ts`, pure)
turns a bank formula into words: `x^2` → "x squared", `(-2)^4` → "open bracket negative 2 close bracket to the
power 4", `\frac{x + 1}{y + 1}` → "the fraction x plus 1 over y plus 1, end fraction". It returns null for LaTeX
outside the subset in `docs/CONTENT.md` (rule 9). `<MathView latex testId>` renders KaTeX and, when there is a
spoken form, is `role="img"` with that form as its `aria-label`; otherwise it keeps KaTeX's MathML for screen
readers. `tests/e2e/a11y.spec.ts` checks every screen (both themes, Chromium and WebKit) for axe, a
`<screen>.<control>` test id and a 48 px target on every control (a radio's label is its target), Tab reaching
every control (once per radio group) and a solid ring of at least 2 px on each.


## Offline and install (`vite.config.ts`, Task 23)

`vite-plugin-pwa` (ADR 0001) adds a web manifest (name "Comparia Academy", short name "Comparia", `start_url` `/`,
standalone, icons 192, 512 and a maskable 512) and a Workbox service worker in **production builds only**; dev has
none. On the first visit it precaches every `js, css, html, svg, png, woff2` file in the build: the code, the question
bank (bundled in the JS), the art, the app fonts and KaTeX's woff2 fonts. `clientsClaim` makes the first page
controlled at once, so the app works offline from then on. `registerType: 'prompt'` with no prompt shown: a new
version waits until every tab of the app is closed, so an update never reloads a page during a mock. Unknown paths
fall back to `index.html`. Service workers need a secure context (https or localhost): from an iPad at a plain-IP
address the app runs but doesn't install or cache. `index.html` adds `theme-color` and `apple-touch-icon` (iPad
Safari's home-screen icon).

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
const systemClock: Clock;                                // performance.now()
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
- Time is derived from the clock on every read, never accumulated per tick, so frame jitter and a throttled hidden
  tab cannot cause drift.
- `elapsedMs` excludes pauses and stops at the duration; `remainingMs` never goes below 0.
- A mock cannot pause (`pauseTimer` throws). A drill can, unless its time is up. A paused timer never reaches time-up.
- Hiding the tab never stops the clock; it only records `hiddenCount` and `hiddenMs` for the attempt log.
- The screen calls `checkTimeUp` on each tick and on `visibilitychange`, and may schedule one wake-up from
  `msUntilTimeUp`.

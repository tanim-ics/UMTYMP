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
| `domain` | object, optional | Variable → allowed values, e.g. `{"x": "real, x != 0"}` (format fixed in task 5) |
| `correct_answer` | `A` \| `B` \| `C` \| `D` | A greater · B greater · equal · not enough information |
| `tags` | string[] | At least one, no repeats, all from `TAGS` |
| `trap` | string \| null, optional | From `TRAPS` |
| `difficulty` | 1–5 | Level (Apprentice … Archmage) |
| `target_seconds` | positive integer | At most the level limit: 10 / 15 / 20 / 25 / 30 s |
| `witnesses` | array, only for `D` | At least 2, each `{ relation: "A"\|"B"\|"C", <variable>: number, … }`, with at least 2 different relations |
| `shortcut_explanation` | string | The fast route; at most 3 sentences (a decimal point is not a sentence end) |
| `full_explanation` | string | The full reasoning or proof |
| `reviewed_by` | string, optional | Who checked an item the verifier can't evaluate (rule enforced in task 5) |

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

Reads `content/questions/*.json` (sorted), runs `parseBank`, prints every problem. Exit `0` all valid (an empty or
missing bank is valid), `1` any problem (including invalid JSON), `2` could not read the folder. Task 5 adds the
answer-key math checks on top.

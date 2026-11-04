# Content guide

How to write questions for the bank. Binding rules are in `CLAUDE.md` §2–3; the item format is in
`docs/CONTRACTS.md`; the vocabulary below lives in `src/core/questions/vocabulary.ts`. Adding a tag or trap is a content
decision: propose it to the owner, then add it here and in `vocabulary.ts` together.

## Every item, before it enters the bank

1. **Original.** Never copy or lightly reword the official samples, the registrant practice site or prep books.
2. **Reasoning, not computing.** A strong grade 5–7 student finds the answer in their head in seconds. If the only
   route is arithmetic, rewrite it.
3. **A shortcut** in `shortcut_explanation`: at most 3 sentences, the fast route a student can use next time.
4. **A proof** in `full_explanation`: why the key is right for *every* allowed value, not just the ones tried.
5. **A machine check.** `expr_a`/`expr_b` in `mathjs` syntax and a `domain` that says exactly what `condition` says
   (`x \neq 0` ↔ `"real, x != 0"`). Items the verifier can't evaluate (figures) need `reviewed_by`.
6. **`D` items** have two `witnesses` with different relations, chosen to show the student the two cases.
7. **`npm run verify` passes**, then the owner reads the item.
8. **Tone.** Encouraging and concrete for a 10–13-year-old; name the habit, never the student's mistake.

**Bank balance.** Across a batch, keep each answer near 25% so guessing one letter never pays. Every tag and trap
should appear at ≥ 3 levels (`docs/SPEC.md`).

## Levels

| Level | Name | Target | Write it like this |
|---|---|---|---|
| 1 | Apprentice | ≤ 10 s | Numbers only, one idea, no trap (`trap: null`). |
| 2 | Novice | ≤ 15 s | One idea plus one shortcut or one trap; a variable is allowed without a condition. |
| 3 | Adept | ≤ 20 s | A variable with a condition; the student must test cases (2, 0, −1, ½). |
| 4 | Expert | ≤ 25 s | Two ideas combined, or a trap hidden inside an ordinary-looking item. |
| 5 | Archmage | ≤ 30 s | Subtle conditions, several variables, C-versus-D judgements. |

`target_seconds` is how long a prepared student should take; it must not exceed the level's limit.

## Tags (topic) and id prefixes

An id is `<prefix>-NNNN`, numbered per prefix. Use the prefix of the item's main tag.

| Tag | Prefix | Covers |
|---|---|---|
| `arithmetic` | `arith` | Whole-number operations, mental-math patterns like (50 − 1)(50 + 1) |
| `fractions` | `frac` | Comparing, reciprocals, fractions of quantities |
| `decimals` | `dec` | Place value, decimal–fraction conversion |
| `percents` | `pct` | Percent of, percent change, successive changes |
| `ratios` | `ratio` | Part-to-part and part-to-whole ratios, scaling |
| `exponents` | `exp` | Powers, signs of powers, comparing powers |
| `roots` | `root` | Square roots, the principal root |
| `inequalities` | `ineq` | Ordering, how operations move an inequality |
| `absolute_value` | `abs` | Distance from zero, \|x\| versus x |
| `number_theory` | `num` | Even/odd, primes, divisibility, remainders |
| `averages` | `avg` | Mean, effect of adding or changing values |
| `expressions` | `expr` | Equivalent forms, expanding, simplifying |
| `geometry` | `geom` | Angles, perimeter, area (figures not to scale) |
| `triangle_inequality` | `tri` | What third sides are possible |

## Traps and the habit that beats each

| Trap | What catches students | Habit to teach |
|---|---|---|
| `negative_numbers` | Assuming a variable is positive | "Test a negative." |
| `zero` | Forgetting 0 is allowed | "Test 0." |
| `fraction_0_1` | Thinking powers always grow | "Test ½: powers of a fraction shrink." |
| `principal_root` | Reading √ as ± | "√ means the non-negative root." |
| `even_power` | Thinking x² tells you x's sign | "An even power hides the sign." |
| `absolute_value` | Treating \|x\| as x | "\|x\| is a distance, never negative." |
| `not_to_scale` | Trusting how a figure looks | "Figures are not to scale; use only what is given." |
| `integer_assumption` | Assuming a variable is a whole number | "Unless it says integer, test a fraction." |
| `order_of_operations` | Misreading −2⁴ or a fraction bar | "Exponents before the minus sign." |

Students see each trap by its `TRAP_NAMES` name in `vocabulary.ts` (e.g. `fraction_0_1` → "fractions between 0
and 1"); a new trap needs one there too.

The default test set for any variable item is **2, 0, −1, ½** (plus a large number when size matters). If two of
them give different relations, the answer is D.

## Domain format (for the verifier)

`"real"` or `"integer"`, then optional `mathjs` rules separated by commas: `"real, 0 < x < 1"`, `"integer, x > 0"`,
`"real, mod(n, 2) == 1"`. A rule may use other variables: `{"x": "real", "y": "real, 0 < y < x"}`. When a quantity
is fixed by the condition (e.g. `x:y = 2:3`), write `expr_b` in terms of the free variable. Full rules:
`docs/CONTRACTS.md`.

## Worked examples (one per level, from `content/questions/seed.json`)

**Level 1, `frac-0001`: 5/8 vs 0.6 → A.** One conversion: 5/8 = 0.625. No variable, no trap, so the domain is
empty and the verifier evaluates the two numbers once.

**Level 2, `exp-0001`: (−2)⁴ vs −2⁴ → A.** The trap is `order_of_operations`: in −2⁴ the exponent happens first,
giving −16, while (−2)⁴ = 16. The shortcut names the habit: "exponents before the minus sign".

**Level 3, `exp-0002`: x³ vs x² with x > 0 → D.** The student must test cases. Witnesses x = 2 (A wins) and x = ½
(B wins) are exactly the two tests the shortcut tells the student to try; `trap: fraction_0_1`.

**Level 4, `ineq-0002`: x vs 4 with 3 < x < 5 → D.** Looks like "the middle is 4", but nothing says x is an
integer; `trap: integer_assumption`, witnesses 4.5 and 3.5.

**Level 5, `exp-0004`: x vs 3 with x² = 9 → D.** A C-versus-D judgement: x could be 3 (equal) or −3 (B wins);
`trap: even_power`. The domain `"real, x^2 == 9"` says exactly what the condition says.

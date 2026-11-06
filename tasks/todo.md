# Release 1 task list

Each task also meets the definition of done in `CLAUDE.md` §8. "Task check" = `docker compose run --rm check npm run check:task`.
"E2E" = `docker compose run --rm e2e`. Sizes: S = 1–2 files, M = 3–5 files.

**Plan approved by owner 2026-11-03.** **Current task:** none. **Done:** Tasks 1–6 (committed and pushed to
`github.com/tanim-ics/UMTYMP`; Checkpoint A approved by owner 2026-11-04). **Next:** owner review of batches C1–C5, then C6. C1 committed 2026-11-05; C2 and C3 written, verified and committed 2026-11-05; C4 written, verified and committed 2026-11-05; C5 written, verified and committed 2026-11-06; owner review of C1–C5 wording open. Owner's plan 2026-11-05: after Task 25, write the question bank (C1–C8) by difficulty level. Checkpoint D passed and committed 2026-11-05. Task 19 done and committed 2026-11-05. Task 20 done, art approved by owner and committed 2026-11-05. Setup fix (`tools/doctor.sh`, README) committed 2026-11-05. Task 21 done and committed 2026-11-05. Task 22 done and committed 2026-11-05. Checkpoint E approved by owner 2026-11-05. Task 23 done and committed 2026-11-05. Task 24 done and committed 2026-11-05. Task 25 done and committed 2026-11-05; CI = GitHub Actions (owner, ADR 0002).

**Handoff (batch C5, 2026-11-06):** `content/questions/c5.json`, 50 original items, levels 7 / 11 / 13 / 11 / 8,
answers A 13 · B 14 · C 12 · D 11. Bank now 270 items: levels 39 / 59 / 69 / 59 / 44 (minimum 60 / 90 / 100 / 90 / 60
still to reach in C6–C8), answers A 70 · B 68 · C 68 · D 64; all pass `npm run verify` (56,651 value checks). Every
tag is now on 4–5 levels and every trap (except `not_to_scale`, text-only bank) on levels 2–5: C5 added
`order_of_operations` and `zero` at level 5, geometry, ratios and decimals at level 5, triangle_inequality at level 2.
Traps on 16 items. Re-read word by word: 11 texts changed (one double "So", "a percent of the smaller number a is a
bigger percent", "7 parts out of 4", "twenty 3s", "1 divided by the power", "dividing by a fraction makes a number
bigger"). **Duplicates:** `duplicates.test.ts` passes; shape groups read by hand, and two items replaced before the
first commit: 1/x vs 10 (same lesson as the new `frac-0019`, now 1/3 vs 0.333) and the count of whole-number third
sides (overlapped `tri-0008` and `tri-0005`, now 10ⁿ ÷ 9 remainder). Kept on purpose: `abs-0016` (|x| + |y| vs |x + y|
with xy < 0, A) beside `abs-0004` (no condition, D); `exp-0027` (x³ vs 0, odd power) beside `exp-0022` (x² vs 0).
mathjs ranges with a step (`sum(1:2:19)`) used for the odd-number sum. Mutation: eight planted wrong answers or
examples each failed. Task check passed; full suite 119 passed. **For the owner:** the C5 review sheet.

**Handoff (batch C4, 2026-11-05):** `content/questions/c4.json`, 50 original items, levels 7 / 11 / 13 / 11 / 8,
answers A 12 · B 10 · C 12 · D 16 (leaning D as planned). Bank now 220 items: levels 32 / 48 / 56 / 48 / 36, answers
A 57 · B 54 · C 56 · D 53; all pass `npm run verify` (46,606 value checks). Fills gaps: geometry at level 2, ratios at
level 1, triangle_inequality at level 4; traps on 14 items, and `integer_assumption`, `even_power`, `fraction_0_1`,
`absolute_value`, `principal_root` and `negative_numbers` are now on levels 2–5. Written to "Writing for a student",
then re-read word by word: 18 texts changed (double "So", "3 lots of x + 2" without brackets, "which side of 10 x is",
"product", three D explanations that never said why you can't tell). **Duplicates:** `duplicates.test.ts` passes; the
shape groups were read by hand and two items that repeated a lesson were replaced before the first commit
(x + 0.5 vs 0.5x, like `ineq-0010`/`dec-0010`; the square's area vs perimeter, like `geom-0005`). Kept on purpose:
`avg-0016` (average vs middle of a < b < c, D) beside `avg-0008` (C when a + c = 2b), and `abs-0014` (|x| vs x when
x³ > x²) beside the other |x| vs x conditions. New mathjs functions used: `lcm`, `isPrime` (D witnesses only).
Mutation: six planted wrong answers or examples each failed. Task check 571 passed; full suite 119 passed.
**For the owner:** the C4 review sheet.

**Handoff (duplicate check, 2026-11-05):** the owner asked that the bank have no duplicates. Machine check across all
170: no exact, swapped (A↔B), renamed (x↔y) or same-machine-check pairs. Same-shape groups (numbers → N, letters →
v) were then read by hand; 8 items repeated a lesson already in the bank and were replaced with new ones (ids
kept, all in C2/C3, committed 2026-11-05): `dec-0007` (0.2 × 5 vs 0.5), `num-0011` (biggest number dividing 12 and
18, vs 4; mathjs `gcd`), `tri-0006` (perimeter vs 18, an upper limit), `pct-0011` (what percent of 20 is 5),
`exp-0017` (4³ vs 8²), `dec-0005` (0.9 + 0.09 vs 1), `abs-0007` (|x| vs |−x|), `arith-0007` (9 × 111 vs 1000). Kept
on purpose: different methods that look alike (3/4 vs 4/5, 2/3 vs 3/5, 5/6 vs 5/7) and condition variants of one
pair (|x| vs x with x < 0, with no condition). New `tests/unit/duplicates.test.ts` (5; planted copies caught) and the
rule in `docs/CONTENT.md`; this answers the open "verifier duplicate-content rule" question with a test rather
than a verifier change. Bank answers now A 45 · B 44 · C 44 · D 37: later batches should lean D. Task check 571
passed; full suite 119 passed.

**Handoff (batches C2 and C3, 2026-11-05):** `content/questions/c2.json` and `c3.json`, 50 items each, both 7 / 11 /
13 / 11 / 8 by level; answers C2 A 12 · B 13 · C 13 · D 12, C3 A 13 · B 11 · C 14 · D 12. Bank now 170 items (levels
25 / 37 / 43 / 37 / 28, answers A 44 · B 43 · C 44 · D 39), all passing `npm run verify` (35,970 value checks). Written
to "Writing for a student" from the start, then re-read word by word: eight texts changed in that pass (double "So",
"x stretched further from 0", "Double a positive number is bigger", "3 becomes 5", the a² − b² trick without an
example, two others). Ids are numbered by the generator after the highest existing id, so none can repeat; no two
items show the same question. **Coverage:** every tag and every trap except `not_to_scale` (text-only bank) is now on
at least 3 levels; C2/C3 filled arithmetic 3–5, zero 2–5, order_of_operations 3–4, principal_root 3–5,
integer_assumption 2 and 5, fraction_0_1 3 and 5. Fixed while writing: four C3 items had lost their condition
(caught in code review before the first run); `pct-0010` (x% rise then fall) now has 10 ≤ x ≤ 50, because for tiny x
the drop fell inside the verifier's 10⁻⁹ tolerance; `num-0014` (n³ − n) is limited to 0 < n < 1000 so n³ stays exact;
"sum of 1 to 20" uses mathjs `sum(1:20)`, an independent check. Mutation: four wrong answers or examples in C2/C3 each
failed with a counter-example. Full suite 119 passed; timing p95 33 ms. **For the owner:** the review sheet.

**Handoff (kid-friendly texts, 2026-11-05):** the owner found the C1 shortcuts and explanations too grown-up and asked
for "answer", not "key". All 70 items (seed + C1) were rewritten: short sentences, everyday words, a real-number try
first, the reason for each step, and every explanation ends "So the answer is X: <the app's answer words>". Only the
two text fields changed (checked field by field). New rules in `docs/CONTENT.md` "Writing for a student";
`tests/unit/explanations.test.ts` (4) checks at most 25 words a sentence, no words from a grown-up list (relation,
domain, consecutive, key, …) and the closing answer sentence; it failed on the old texts. The app already said
"Answer:"; "Key:" was only on the review sheet and in one guide line. **Every batch from now on:** re-read every word
by hand as well. Committed 2026-11-05.

**Handoff (batch C1, 2026-11-05):** `content/questions/c1.json`, 50 original items, all passing `npm run verify`
(bank now 70 items, 15,842 value checks). Levels 7 / 11 / 13 / 11 / 8 (the 60/90/100/90/60 target scaled to 50);
answers A 13 · B 14 · C 12 · D 11; all 14 tags; traps on 20 items (negative_numbers 6, even_power 4, fraction_0_1 3,
absolute_value 3, one each of order_of_operations, integer_assumption, principal_root, zero); level 1 has no traps;
every target within its level limit. Mutation check: three wrong keys/witnesses each failed with a counter-example.
Fixed while writing: a prime-count item whose expressions were just `4` vs `4` (replaced by a remainder item the
verifier really checks); `\%` inside `\text{}` (screen readers would say "backslash"); `frac-0006` rewritten
(x/(x+1) vs 2x/(2x+1)) because its first form differed by 10⁻¹² at x = 10⁶, inside the verifier's tolerance.
**Still on fewer than 3 levels across the bank** (for later batches): `arithmetic` (1, 2), traps `order_of_operations`
(2), `fraction_0_1` (2, 3), `integer_assumption` (3, 4), `principal_root` (2, 4), `zero` (4); `not_to_scale` has no
items (the bank is text-only). **Side effects of a full 50-item mock:** home no longer shows the "20 questions so far"
note, so the four home screenshot baselines were refreshed (checked by eye: only the note is gone);
`spellbook.spec.ts` now counts level-3 items from the bank instead of a hard-coded 16 (owner chose this 2026-11-05;
the floor guard flags the changed line until it is pushed). Full suite 119 passed; timing p95 19 ms over 147
samples. **For the owner:** read the review sheet (wording, level, shortcuts) before C1 is ticked.

**Handoff (after Task 25):** `tools/check-names.ts` (`npm run names`, in `check:fast`) scans `src`, `content`,
`public`, `index.html` and `vite.config.ts` for the names in `tools/franchise-names.txt` (houses, places,
characters, spells, things, the look-alike font), as whole words through camelCase, kebab-case, snake_case,
apostrophes and plurals; ordinary words our theme uses (potter, potion, owl, hat, castle) aren't listed. Docs aren't
scanned (they name the franchise to forbid it). A planted `'Gryffindor'` in `src/` failed it with file and line.
`tools/image-size.sh` (host, POSIX sh; asks Compose for the image name, which follows the folder name): the image is
23.7 MB of 50. Owner chose CI = GitHub Actions (ADR 0002): `.github/workflows/ci.yml` runs `check:full`, the browser
suite, Lighthouse on the nginx image and the image size on every push and pull request to `main`; it marks `/app` as
a safe git folder inside the container (Linux runners) and fetches full history for the floor guard. Tests:
`checkNames.test.ts` (19), `imageSize.test.ts` (4). **Not yet seen:** a real CI run (it starts with the push). Risk:
the timing budget on shared runner CPUs.

**Handoff (after Task 24):** budgets from `docs/CONSTRAINTS.md` (Lighthouse performance ≥ 95: the task line said 90, the
owner raised it). **Before → after:** Lighthouse (mobile, slow 4G, 4× CPU, on the nginx image) performance 69 → 98–99,
LCP 5101 → 2101–2251 ms, accessibility 100, CLS 0; answer → next p95 61 → 28–31 ms (57 samples, 4× CPU). What it took:
nginx gzip (the 683 kB script went out raw); KaTeX split into its own chunk and loaded 1.5 s after the first screen
(it had competed with that screen; any formula on screen loads it at once); the first screen's three fonts preloaded
(they were requested only after the script rendered the heading). **Headers:** `docker/security-headers.conf`, included
in every nginx location, read by `vite preview` via `tools/security-headers.ts`. The browser test found two
violations: an inlined `data:` KaTeX font (now never inlined) and zod's `new Function` probe (zod comes only from
`src/core/zod.ts` with `jitless`; ESLint enforces it). New: `tools/lighthouse.mjs` (`npm run check:lighthouse`,
Lighthouse 13.5.0 dev dependency, the tool CONSTRAINTS names; 13.6.0 was under two weeks old),
`tests/e2e/perf.spec.ts` (project `perf`, runs alone after the others), `tests/e2e/headers.spec.ts` (Chromium and
WebKit), `tests/unit/securityHeaders.test.ts` (6, includes the nginx include trap), `mathView.test.tsx` +2. Projects
`offline-*` renamed `prod-*`. Three new CONSTRAINTS rows (Responsiveness, Page performance, Security headers); the
scheduled rows are left (the floor guard blocks editing them). The floor guard reads a changed `vitest` import line as
a removed assertion, so new imports go on their own line (owner decision on that rule still open). **Seen once, not
reproduced in 7 runs:** `castle.spec` a11y (WebKit, dark) failed in a slow 2.1-minute run, likely its 90 s limit on a
50-question mock. **Not done:** HSTS (needs https); Lighthouse is a separate command, not inside `docker compose run e2e`.

**Handoff (after Task 23):** `vite-plugin-pwa` 2.0.0 (in the ADR 0001 stack; dev dependency, ships only the
generated service worker and `workbox-window`) makes production builds installable and offline: manifest, icons in
`public/icons/` (rendered from Hoot, logged in ASSETS), Workbox precache of `js, css, html, svg, png, woff2`,
`clientsClaim` so the first visit already counts, `registerType: 'prompt'` with no prompt so an update never reloads a
mock. `index.html` adds `theme-color` and `apple-touch-icon`. `tests/e2e/offline.spec.ts` runs on the production build:
`playwright.config.ts` now starts a second server (`npm run build && vite preview` on 4173) and has projects
`offline-chromium`/`offline-webkit`; the dev projects ignore that spec. Tests: manifest and icons; offline after the first
visit (sign-up, a full mock, review, Spellbook, pictures and fonts all load); a mock makes 0 network requests. All 6
failed before the PWA existed. Mutation: caching only `js, css, html` → the mock fetched Hoot and two KaTeX fonts, red.
**Flake fixed:** under the extra load, `screens.spec.ts` sometimes checked pictures before they finished loading; it now
waits for `complete` before asserting they rendered (same assertion). Full suite 114 passed 5 runs in a row. Audits:
shipped 0; dev 10 moderate (cap 11; lowering it is the owner's call) plus 2 low. **Not tested:** installing on a real
iPad (needs https or localhost; over the home-network IP it won't install). New CONSTRAINTS row: Offline. **nginx:** `docker/nginx.conf` now serves `/manifest.webmanifest` as
`application/manifest+json` (it went out as octet-stream); checked with curl on the `web` image, together with `sw.js`
(`no-cache`, JavaScript). The offline spec runs on `vite preview`, not nginx.

**Handoff (Checkpoint E prep, 2026-11-05):** opening the app from another device at a plain-IP address
(`http://10.10.3.36:5173`) is not a secure context, so `crypto.randomUUID` is missing and **Start my adventure did
nothing, with no error shown**. Every test ran on localhost, so none caught it. Fixed: `newId()` (`src/data/ids.ts`,
`getRandomValues`, RFC 9562 v4) for profile, import and session ids. `tests/unit/ids.test.ts` (4; the profile case
failed before the fix). Seen working over the IP in WebKit. Still open: a failed save shows no message to the student.
Screens for the owner's review were taken at laptop (1280×800, Chromium) and iPad (810×1080, WebKit) sizes, light and
dark. Committed with the Checkpoint E approval.

**Handoff (after Task 22):** `tests/e2e/a11y.spec.ts` walks every screen (Welcome, home, who's playing, manage,
delete confirmation, Settings, reset confirmation, castle map empty and after a mock, Grand Trial with and without a
"Given" line, results after finishing and after time-up, review, coach card, drill, drill feedback, drill paused,
Spellbook, its length error, a practice session) in light and dark on Chromium and WebKit. On each it runs axe
(WCAG 2.1 A/AA, 0 serious/critical) plus the CLAUDE.md §7 rules axe doesn't check: every control has a
`<screen>.<control>` test id and a 48 px target (a radio's label counts), Tab reaches every control, and each shows a
solid ring of at least 2 px. **Found and fixed:** text fields, radios and the file picker showed only the browsers'
thin default ring; they now get the same 3 px accent ring as buttons (`GrandTrial.module.css`). **Spoken math:**
`spokenMath` (`src/core/questions/spoken.ts`, pure) turns bank LaTeX into words ("x squared", "open bracket negative
2 close bracket to the power 4", "…, end fraction"), so −2⁴ and (−2)⁴ sound different. `MathView` is then
`role="img"` with that label, or keeps KaTeX's MathML when there is no spoken form. A unit test fails if any bank
formula has no spoken form; `docs/CONTENT.md` rule 9 lists the allowed LaTeX. A keyboard-only spec goes from the first
visit (sign-up form) through a mock to the review and back home. Tests: `tests/unit/spoken.test.ts` (38),
`tests/unit/mathView.test.tsx` (2), `tests/e2e/a11y.spec.ts` (12 per browser). Mutation checks: no focus ring on
inputs → 6 findings per run; `--tap-target` 40 px → every control flagged. `docs/CONSTRAINTS.md`: two new enforced
rows (every screen; keyboard from first visit to review). The old Grand Trial rows and the scheduled Accessibility
and Keyboard rows are left as they were: the floor guard blocks editing a row, so tidying them is the owner's call. **Not tested:** a real
screen reader (VoiceOver/NVDA) reading the labels; the scheduled Keyboard row (Task 9) is stale like the Timer row.
**For the owner (Checkpoint E):** the look on a laptop and an iPad; try VoiceOver on the iPad on one question.

**Handoff (after Task 21):** the Task 20 art is on the screens through `src/ui/components/Art.tsx` (decorative,
`alt=""`, fixed sizes): castle banner and the student's crest on home, a crest per house on Welcome, a still Hoot on
the Grand Trial, the potion on a drill, the book on the Spellbook, the castle on the map, Hoot on the coach card.
Pictures sit on a light disc (`--color-art-bg`) so their dark outlines read on the night sky. Controls now use the
3 : 1 `--color-ink` outline (closes the Task 19 gap); `.primary` fills the main action (Start Grand Trial, Start my
adventure, the castle's Start). Towers: open ones solid and accent-edged, locked ones dashed (the words say it too).
The shared CSS has no transitions; the one animation is two stars popping once beside the mascot on results, and
the reduced-motion rule cuts it to nothing. Small JSX changes were needed for the pictures (the task said "style
files only"). Tests: `tests/unit/themedScreens.test.tsx` (every name has a file, decorative, each screen's picture,
celebration on results only), a contrast case for the art backdrop, `tests/e2e/screens.spec.ts` (a timed mock has no
running animation and no element with an animation or transition, through answering, flagging, hovering, moving
on and the clock ticking; results celebrate, reduced motion stills it; screenshot baselines of Welcome, home and the
empty castle map in light and dark, Chromium and WebKit, in `tests/e2e/screens.spec.ts-snapshots/`). Mutation checks
2/2 red (a button transition; a dark art backdrop). Seen live: home, trial and results in dark. **For the owner
(Checkpoint E):** the look on a laptop and an iPad. After a deliberate look change, refresh the baselines with
`docker compose run --rm e2e npx playwright test screens --update-snapshots`.

**Handoff (setup fix, 2026-11-05, outside the task list):** on a Linux clone, `docker compose up` failed twice
because of Docker Desktop leftovers on the host: a dead `~/.docker/cli-plugins/docker-buildx` link and
`"credsStore": "desktop"` with no `docker-credential-desktop`. Neither can be fixed from inside the repo, so
`tools/doctor.sh` (POSIX sh, runs on macOS, Linux, WSL and Git Bash) checks docker, the daemon, Compose v2, buildx and
the credential helper, prints the fix for each OS, and with `--fix` removes the dead link and the dead `credsStore`
(keeps `config.json.bak`). Tests `tests/unit/doctor.test.ts` (11, a fake docker and a throwaway HOME; 9 failed before
the script existed). The JSON repair was also checked by hand with macOS's BSD `sed`. New `README.md` covers running with Docker
and these errors. Not tested on a real Linux host: the owner's machine is the live check.

**Handoff (after Task 20):** eight original SVGs in `public/art/` (served at `/art/…`): `hoot.svg`, four
`crest-*.svg`, `castle-map.svg`, `potion.svg`, `spellbook.svg`. Cartoon style: thick #2b2238 outlines, rounded
shapes, theme colours. Crests are round medallions (not shields); house colours avoid the franchise pairs. Each logged
in `docs/ASSETS.md`. Test `tests/unit/art.test.ts` (every planned file present, a title, no script, links, embedded
images or lettering, under 12 KB, a row in ASSETS). Review sheet `docs/art-sheet.html` (not shipped). Seen live: the
first dragon read as a cow, so it was redrawn with fins, swept horns and a fang. **Owner to review:** the art sheet.
**Known look:** on the night-sky background the dark outlines blend in; the shapes still read. Task 21 can sit art on a
surface card in dark mode if that's wanted. Not used by any screen yet (Task 21).

**Handoff (after Task 19):** theme tokens in `src/ui/theme/tokens.css`: parchment (light) and night sky (dark),
following the device (owner choice: no manual pick for now). New colour tokens `--color-on-accent`, `--color-ink`
(control outlines, 3 : 1), `--color-right`, `--color-wrong`; Task 21 puts them to use. Fonts (owner choice): Grenze for
headings, Nunito for text, self-hosted through the new dependencies `@fontsource/grenze` and `@fontsource/nunito`
(OFL, CSS and font files only), logged in `docs/ASSETS.md`. Motion: `--motion-fast` 150 ms and `--motion-base` 250 ms,
the same as `src/ui/theme/motion.ts` (`MOTION_MS`, `motionMs`, `prefersReducedMotion`, which counts "can't tell" as
reduced). Under reduced motion every token is 0 and a global rule stops CSS animations and transitions. Tests:
`tests/unit/contrast.test.ts` (every text pair ≥ 4.5 : 1 and outline pair ≥ 3 : 1 in both palettes, read from the CSS
file), `tests/unit/motion.test.ts`, `tests/e2e/theme.spec.ts` (fonts load from our own host only; both palettes;
reduced motion stops a probe animation and transition). Mutation checks 4/4 red. Seen live: home and trial in light
and dark. **Not done here:** input borders still use the low-contrast `--color-border`; switching them to
`--color-ink` is styling work for Task 21. After pulling, rebuild the images (`docker compose build`) and recreate dev
with `docker compose up -d --force-recreate -V dev`, so the containers get the new packages.

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
- [x] Parchment (light) and night-sky (dark) tokens, open-licence fonts, motion settings that switch off for reduced motion
- [x] `docs/ASSETS.md` started; WCAG AA contrast for every text/background pair
- **Verify:** contrast unit test over token pairs; E2E reduced-motion check
- **Depends on:** D · **Files:** `src/ui/theme/tokens.css`, `src/ui/theme/motion.ts`, `tests/unit/contrast.test.ts`, `docs/ASSETS.md` · **Size:** M

### Task 20: Original art
- [x] SVGs: Professor Hoot, 4 house crests, castle map with towers, potion bottle, spellbook; all original, logged in `docs/ASSETS.md`
- **Verify:** owner reviews the art sheet; no franchise look-alikes
- **Depends on:** 19 · **Files:** `public/art/*.svg`, `docs/ASSETS.md` · **Size:** M

### Task 21: Themed screens
- [x] Theme applied to every screen; Grand Trial stays still (only the timer changes); celebration only on results
- **Verify:** E2E asserts no running animations during a timed mock; screenshots of static screens
- **Depends on:** 20 · **Files:** `src/ui/components/*`, `src/ui/screens/*` (style files only) · **Size:** M

### Task 22: Accessibility pass
- [x] axe-core: zero serious/critical issues on every screen, both themes; full keyboard-only mock; spoken-form math labels
- **Verify:** E2E axe suite + keyboard-only spec
- **Depends on:** 21 · **Files:** `tests/e2e/a11y.spec.ts`, fixes in touched components · **Size:** M

### Checkpoint E — after tasks 19–22
- [x] Owner reviews the look on a laptop and an iPad; commit (approved by owner 2026-11-05)

---

## Phase 5 — Offline and ship

### Task 23: Offline (PWA)
- [x] Installable; works with the network off after first load; no requests during a mock
- **Verify:** E2E with network blocked; network log check
- **Depends on:** E · **Files:** `vite.config.ts`, `src/main.tsx`, `tests/e2e/offline.spec.ts` · **Size:** S

### Task 24: Performance and nginx hardening
- [x] Answer → next < 50 ms p95 with 4× CPU throttle; Lighthouse performance ≥ 90, accessibility ≥ 95 (CONSTRAINTS: ≥ 95)
- [x] nginx security headers (CSP, no-sniff, referrer policy), long-cache hashed assets
- **Verify:** Playwright timing test; Lighthouse in the e2e container
- **Depends on:** 23 · **Files:** `docker/nginx.conf`, `tests/e2e/perf.spec.ts` · **Size:** S

### Task 25: CI and franchise-name check
- [x] Word-list check fails on Harry Potter names in code, content and art; CI runs the full check (if approved)
- **Verify:** check fails on a planted word; CI run green
- **Depends on:** 2 · **Files:** `tools/check-names.ts`, `.github/workflows/ci.yml` · **Size:** S

### Checkpoint F — Release 1
- [ ] All 10 success criteria in `docs/SPEC.md` met with evidence; owner sign-off; tag `v1.0.0`

---

## Content track (after task 6, beside the build)

Each batch: 50 original items, verified, then owner review of wording and level. Running target ≥ 400 by
checkpoint F with the level minimum 60 / 90 / 100 / 90 / 60; every tag and trap at ≥ 3 levels.

- [ ] C1 · [ ] C2 · [ ] C3 · [ ] C4 · [ ] C5 · [ ] C6 · [ ] C7 · [ ] C8

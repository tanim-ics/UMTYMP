// Builds mocks, drills and practice sets from the bank. Pure and seeded: the same bank, options and seed always
// give the same items in the same order. When the bank is too small the builders return what they can and say
// how many items are missing, rather than failing.
import { EXAM } from '../config/exam.ts';
import { makeRandom, shuffleWith, type Random } from '../random.ts';
import type { QuestionItem } from './schema.ts';
import { LEVELS, type Level, type Tag, type Trap } from './vocabulary.ts';

export interface BuiltSet {
  items: QuestionItem[];
  /** How many items short of the requested length the set is. */
  missing: number;
}

export interface BuiltMock extends BuiltSet {
  /** How many items had to come from the last mocks because the bank had no fresh ones left. */
  reusedRecent: number;
}

export function seededShuffle<T>(list: readonly T[], seed: number): T[] {
  return shuffleWith(list, makeRandom(seed));
}

/** Takes up to `count` items from the front of `pool`, removing them from it. */
function take(pool: QuestionItem[], count: number): QuestionItem[] {
  return pool.splice(0, Math.max(0, count));
}

/** Other levels, nearest first; on a tie the easier level comes first. */
function neighbours(level: Level): Level[] {
  return LEVELS.filter((l) => l !== level).sort(
    (a, b) => Math.abs(a - level) - Math.abs(b - level) || a - b,
  );
}

/**
 * A full mock. Fills each level of the mix with fresh items first, then with recent ones, so the difficulty mix
 * stays exam-like; a level the bank can't fill borrows from the nearest levels. The final order is shuffled because
 * the official order of difficulty is unknown (docs/EXAM_FACTS.md).
 */
export function buildMock(
  bank: readonly QuestionItem[],
  options: { seed: number; recentMocks?: readonly (readonly string[])[] },
): BuiltMock {
  const random = makeRandom(options.seed);
  const recent = new Set((options.recentMocks ?? []).slice(-EXAM.recentMocksToAvoid).flat());
  const byLevel = (keep: (i: QuestionItem) => boolean) =>
    Object.fromEntries(
      LEVELS.map((level) => [
        level,
        shuffleWith(
          bank.filter((i) => i.difficulty === level && keep(i)),
          random,
        ),
      ]),
    ) as Record<Level, QuestionItem[]>;
  const fresh = byLevel((i) => !recent.has(i.id));
  const stale = byLevel((i) => recent.has(i.id));

  const chosen: QuestionItem[] = [];
  const shortfall = { ...EXAM.levelMix };
  for (const level of LEVELS) {
    const picked = take(fresh[level], shortfall[level]);
    picked.push(...take(stale[level], shortfall[level] - picked.length));
    chosen.push(...picked);
    shortfall[level] -= picked.length;
  }
  for (const level of LEVELS) {
    for (const source of [fresh, stale]) {
      for (const other of neighbours(level)) {
        const borrowed = take(source[other], shortfall[level]);
        chosen.push(...borrowed);
        shortfall[level] -= borrowed.length;
      }
    }
  }

  return {
    items: shuffleWith(chosen, random),
    missing: EXAM.questionCount - chosen.length,
    reusedRecent: chosen.filter((i) => recent.has(i.id)).length,
  };
}

export type DrillFocus =
  { kind: 'tag'; tag: Tag } | { kind: 'trap'; trap: Trap } | { kind: 'level'; level: Level };

function matchesFocus(item: QuestionItem, focus: DrillFocus): boolean {
  if (focus.kind === 'tag') return item.tags.includes(focus.tag);
  if (focus.kind === 'trap') return item.trap === focus.trap;
  return item.difficulty === focus.level;
}

function pick(matching: readonly QuestionItem[], length: number, random: Random): BuiltSet {
  const items = shuffleWith(matching, random).slice(0, length);
  return { items, missing: length - items.length };
}

/** A potion drill: 10 items for one tag, trap or level, ramping up from the easiest (docs/SPEC.md). */
export function buildDrill(
  bank: readonly QuestionItem[],
  options: { seed: number; focus: DrillFocus },
): BuiltSet {
  const matching = bank.filter((i) => matchesFocus(i, options.focus));
  const set = pick(matching, EXAM.drillLength, makeRandom(options.seed));
  // Array.prototype.sort is stable, so items of one level keep their shuffled order.
  return { ...set, items: set.items.sort((a, b) => a.difficulty - b.difficulty) };
}

/**
 * Spellbook practice: any of the chosen tags, any of the chosen traps and any of the chosen levels; an empty or
 * missing filter allows everything.
 */
export function buildPractice(
  bank: readonly QuestionItem[],
  options: {
    seed: number;
    length: number;
    tags?: readonly Tag[];
    traps?: readonly Trap[];
    levels?: readonly Level[];
  },
): BuiltSet {
  const { min, max } = EXAM.practiceLength;
  const { length, tags = [], traps = [], levels = [] } = options;
  if (!Number.isInteger(length) || length < min || length > max) {
    throw new RangeError(
      `practice length must be a whole number from ${min} to ${max}, not ${length}`,
    );
  }
  const matching = bank.filter(
    (i) =>
      (tags.length === 0 || i.tags.some((t) => tags.includes(t))) &&
      (traps.length === 0 || (i.trap != null && traps.includes(i.trap))) &&
      (levels.length === 0 || levels.includes(i.difficulty)),
  );
  return pick(matching, length, makeRandom(options.seed));
}

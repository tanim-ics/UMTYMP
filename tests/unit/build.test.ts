import { describe, expect, it } from 'vitest';
import { EXAM } from '../../src/core/config/exam.ts';
import {
  buildDrill,
  buildMock,
  buildPractice,
  countMatching,
  seededShuffle,
} from '../../src/core/questions/build.ts';
import type { QuestionItem } from '../../src/core/questions/schema.ts';
import type { Level, Tag, Trap } from '../../src/core/questions/vocabulary.ts';

function item(
  id: string,
  difficulty: Level,
  tags: Tag[] = ['arithmetic'],
  trap: Trap | null = null,
) {
  const q: QuestionItem = {
    id,
    quantity_a: '1',
    quantity_b: '2',
    condition: null,
    correct_answer: 'B',
    tags,
    trap,
    difficulty,
    target_seconds: 5,
    shortcut_explanation: '1 is less than 2.',
    full_explanation: '1 < 2.',
    reviewed_by: 'test',
  };
  return q;
}

/** `perLevel` items at every level, ids like `lvl-3-0007`. */
function bank(perLevel: number): QuestionItem[] {
  return ([1, 2, 3, 4, 5] as const).flatMap((level) =>
    Array.from({ length: perLevel }, (_, i) =>
      item(`lvl-${level}-${String(i).padStart(4, '0')}`, level),
    ),
  );
}

const ids = (items: readonly QuestionItem[]) => items.map((i) => i.id);

/** `count` past mocks, each built avoiding the ones before it, so they share as few items as possible. */
function pastMocks(source: readonly QuestionItem[], count: number): string[][] {
  const past: string[][] = [];
  for (let seed = 1; seed <= count; seed++) {
    past.push(ids(buildMock(source, { seed, recentMocks: past }).items));
  }
  return past;
}
const levelCounts = (items: readonly QuestionItem[]) =>
  items.reduce<Record<number, number>>((acc, i) => {
    acc[i.difficulty] = (acc[i.difficulty] ?? 0) + 1;
    return acc;
  }, {});

describe('exam settings', () => {
  it('a full mock is 50 items in 25 minutes with the 6/10/14/12/8 level mix', () => {
    expect(EXAM.questionCount).toBe(50);
    expect(EXAM.durationMs).toBe(25 * 60_000);
    expect(EXAM.levelMix).toEqual({ 1: 6, 2: 10, 3: 14, 4: 12, 5: 8 });
    const mixTotal = Object.values(EXAM.levelMix).reduce((a, b) => a + b, 0);
    expect(mixTotal).toBe(EXAM.questionCount);
  });
});

describe('seededShuffle', () => {
  const list = Array.from({ length: 30 }, (_, i) => i);

  it('gives the same order for the same seed', () => {
    expect(seededShuffle(list, 42)).toEqual(seededShuffle(list, 42));
  });

  it('gives a different order for a different seed', () => {
    expect(seededShuffle(list, 42)).not.toEqual(seededShuffle(list, 43));
  });

  it('keeps every element exactly once and leaves the input alone', () => {
    const before = [...list];
    const shuffled = seededShuffle(list, 7);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(list);
    expect(list).toEqual(before);
  });
});

describe('buildMock', () => {
  it('builds 50 distinct items with the level mix', () => {
    const mock = buildMock(bank(30), { seed: 1 });
    expect(mock.items).toHaveLength(50);
    expect(new Set(ids(mock.items)).size).toBe(50);
    expect(levelCounts(mock.items)).toEqual({ 1: 6, 2: 10, 3: 14, 4: 12, 5: 8 });
    expect(mock.missing).toBe(0);
  });

  it('is reproducible: same seed → same items in the same order', () => {
    expect(ids(buildMock(bank(30), { seed: 9 }).items)).toEqual(
      ids(buildMock(bank(30), { seed: 9 }).items),
    );
  });

  it('a different seed gives a different mock', () => {
    expect(ids(buildMock(bank(30), { seed: 1 }).items)).not.toEqual(
      ids(buildMock(bank(30), { seed: 2 }).items),
    );
  });

  it('mixes levels through the exam instead of grouping them', () => {
    const levels = buildMock(bank(30), { seed: 3 }).items.map((i) => i.difficulty);
    const sorted = [...levels].sort((a, b) => a - b);
    expect(levels).not.toEqual(sorted);
  });

  it('avoids every item from the last 3 mocks when the bank allows it', () => {
    const big = bank(60);
    const past = pastMocks(big, 4);
    const mock = buildMock(big, { seed: 5, recentMocks: past });
    const lastThree = new Set(past.slice(-3).flat());
    expect(ids(mock.items).filter((id) => lastThree.has(id))).toEqual([]);
    expect(mock.reusedRecent).toBe(0);
  });

  it('only counts the last 3 mocks as recent', () => {
    // Level 3 has 60 items and 4 disjoint past mocks used 56 of them: only 4 would be fresh if all 4 counted.
    const big = bank(60);
    const past = pastMocks(big, 4);
    expect(new Set(past.flat()).size).toBe(200);
    const mock = buildMock(big, { seed: 6, recentMocks: past });
    expect(mock.reusedRecent).toBe(0);
    expect(mock.items).toHaveLength(50);
  });

  it('reuses recent items when it must, and says how many', () => {
    const exact = bank(14); // 70 items: level 3 has exactly 14, all used by the first mock
    const first = ids(buildMock(exact, { seed: 1 }).items);
    const second = buildMock(exact, { seed: 2, recentMocks: [first] });
    expect(second.items).toHaveLength(50);
    expect(levelCounts(second.items)).toEqual({ 1: 6, 2: 10, 3: 14, 4: 12, 5: 8 });
    expect(second.reusedRecent).toBeGreaterThan(0);
    const fresh = ids(second.items).filter((id) => !first.includes(id));
    // Every level with spare items uses fresh ones first.
    expect(fresh.length).toBe(50 - second.reusedRecent);
  });

  it('fills a short level from the nearest other levels', () => {
    const lopsided = [...bank(20)].filter((i) => !(i.difficulty === 5 && i.id > 'lvl-5-0002'));
    const mock = buildMock(lopsided, { seed: 1 });
    expect(mock.items).toHaveLength(50);
    const counts = levelCounts(mock.items);
    expect(counts[5]).toBe(3);
    expect(counts[4]).toBe(12 + 5); // level 4 is nearest to level 5
    expect(mock.missing).toBe(0);
  });

  it('uses the whole bank and reports what is missing when it is smaller than a mock', () => {
    const tiny = bank(4); // 20 items
    const mock = buildMock(tiny, { seed: 1 });
    expect(mock.items).toHaveLength(20);
    expect(mock.missing).toBe(30);
    expect(new Set(ids(mock.items)).size).toBe(20);
  });

  it('returns an empty mock for an empty bank', () => {
    expect(buildMock([], { seed: 1 })).toEqual({ items: [], missing: 50, reusedRecent: 0 });
  });
});

describe('buildDrill', () => {
  const mixed = [
    ...bank(10),
    item('trap-0001', 2, ['roots'], 'principal_root'),
    item('trap-0002', 4, ['roots', 'absolute_value'], 'principal_root'),
    item('trap-0003', 5, ['exponents'], 'even_power'),
  ];

  it('builds 10 items for one level', () => {
    const drill = buildDrill(mixed, { seed: 1, focus: { kind: 'level', level: 3 } });
    expect(drill.items).toHaveLength(EXAM.drillLength);
    expect(drill.items.every((i) => i.difficulty === 3)).toBe(true);
  });

  it('builds a tag drill that ramps up in difficulty', () => {
    const drill = buildDrill(mixed, { seed: 1, focus: { kind: 'tag', tag: 'arithmetic' } });
    expect(drill.items).toHaveLength(10);
    expect(drill.items.every((i) => i.tags.includes('arithmetic'))).toBe(true);
    const levels = drill.items.map((i) => i.difficulty);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it('builds a trap drill and reports the shortfall when the bank is small', () => {
    const drill = buildDrill(mixed, { seed: 1, focus: { kind: 'trap', trap: 'principal_root' } });
    expect(ids(drill.items)).toEqual(['trap-0001', 'trap-0002']);
    expect(drill.missing).toBe(8);
  });

  it('is reproducible for the same seed', () => {
    const focus = { kind: 'level', level: 2 } as const;
    expect(ids(buildDrill(mixed, { seed: 4, focus }).items)).toEqual(
      ids(buildDrill(mixed, { seed: 4, focus }).items),
    );
  });

  it('returns nothing when no item matches', () => {
    const drill = buildDrill(mixed, { seed: 1, focus: { kind: 'tag', tag: 'percents' } });
    expect(drill).toEqual({ items: [], missing: 10 });
  });
});

describe('buildPractice', () => {
  const mixed = [
    ...bank(10),
    item('frac-0001', 1, ['fractions']),
    item('frac-0002', 3, ['fractions', 'inequalities'], 'fraction_0_1'),
    item('dec-0001', 2, ['decimals']),
  ];

  it.each([4, 51, 7.5])('rejects length %s (practice is 5–50 items)', (length) => {
    expect(() => buildPractice(mixed, { seed: 1, length })).toThrow(/5.*50/);
  });

  it('with no filters draws from the whole bank', () => {
    const practice = buildPractice(mixed, { seed: 1, length: 50 });
    expect(practice.items).toHaveLength(50);
    expect(practice.missing).toBe(0);
  });

  it('matches any chosen tag', () => {
    const practice = buildPractice(mixed, { seed: 1, length: 5, tags: ['fractions', 'decimals'] });
    expect(ids(practice.items).sort()).toEqual(['dec-0001', 'frac-0001', 'frac-0002']);
    expect(practice.missing).toBe(2);
  });

  it('combines tag, trap and level filters', () => {
    const practice = buildPractice(mixed, {
      seed: 1,
      length: 5,
      tags: ['fractions'],
      traps: ['fraction_0_1'],
      levels: [3, 4],
    });
    expect(ids(practice.items)).toEqual(['frac-0002']);
  });

  it('is reproducible for the same seed', () => {
    const options = { seed: 8, length: 12, levels: [2, 3] as Level[] };
    expect(ids(buildPractice(mixed, options).items)).toEqual(
      ids(buildPractice(mixed, options).items),
    );
  });
});

describe('countMatching', () => {
  const mixed = [
    ...bank(2),
    item('frac-0001', 1, ['fractions']),
    item('frac-0002', 3, ['fractions', 'inequalities'], 'fraction_0_1'),
  ];

  it('counts what buildPractice would draw from, with the same filter rules', () => {
    expect(countMatching(mixed, {})).toBe(12);
    expect(countMatching(mixed, { tags: ['fractions'] })).toBe(2);
    expect(countMatching(mixed, { tags: ['fractions'], levels: [3] })).toBe(1);
    expect(countMatching(mixed, { traps: ['fraction_0_1'] })).toBe(1);
    expect(countMatching(mixed, { traps: ['zero'] })).toBe(0);
  });
});

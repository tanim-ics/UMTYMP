import { describe, expect, it } from 'vitest';
import { EXAM } from '../../src/core/config/exam.ts';
import { buildMock } from '../../src/core/questions/build.ts';
import { questionItemSchema } from '../../src/core/questions/schema.ts';
import { repeatBank } from '../../src/dev/devBank.ts';
import { fetchBank } from '../../src/ui/bank.ts';

// Top-level await: vitest runs test files as ES modules.
const seed = await fetchBank();

describe('repeatBank (dev only)', () => {
  it('makes the given number of copies with unique, schema-valid ids', () => {
    const padded = repeatBank(seed, 4);
    expect(padded).toHaveLength(seed.length * 4);
    expect(new Set(padded.map((i) => i.id)).size).toBe(padded.length);
    expect(padded.every((i) => questionItemSchema.safeParse(i).success)).toBe(true);
  });

  it('keeps the originals first and unchanged', () => {
    expect(repeatBank(seed, 2).slice(0, seed.length)).toEqual(seed);
  });

  it('lets the seed bank fill a full mock with the level mix', () => {
    const mock = buildMock(repeatBank(seed, 4), { seed: 1 });
    expect(mock.items).toHaveLength(EXAM.questionCount);
    expect(mock.missing).toBe(0);
    const perLevel = mock.items.reduce<Record<number, number>>((acc, i) => {
      acc[i.difficulty] = (acc[i.difficulty] ?? 0) + 1;
      return acc;
    }, {});
    expect(perLevel).toEqual(EXAM.levelMix);
  });

  it('refuses a copy count it cannot name', () => {
    expect(() => repeatBank(seed, 0)).toThrow();
    expect(() => repeatBank(seed, 28)).toThrow();
    expect(repeatBank(seed, 27)).toHaveLength(seed.length * 27);
  });
});

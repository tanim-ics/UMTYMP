import { describe, expect, it } from 'vitest';
import { parseBank } from '../../src/core/questions/load.ts';
import { LEVEL_TIME_LIMITS } from '../../src/core/questions/vocabulary.ts';

// A complete, valid D item (x² vs x). Each test changes one thing from it.
const validD = {
  id: 'ineq-0042',
  quantity_a: 'x^2',
  quantity_b: 'x',
  condition: 'x \\neq 0',
  expr_a: 'x^2',
  expr_b: 'x',
  domain: { x: 'real, x != 0' },
  correct_answer: 'D',
  tags: ['inequalities', 'exponents'],
  trap: 'fraction_0_1',
  difficulty: 3,
  target_seconds: 15,
  witnesses: [
    { x: 2, relation: 'A' },
    { x: 0.5, relation: 'B' },
  ],
  shortcut_explanation: 'Try x = 2 (A wins) and x = ½ (B wins). Two different results → D.',
  full_explanation: 'For x > 1, x² > x; for 0 < x < 1, x² < x. The relation depends on x.',
};

const validA = {
  id: 'frac-0001',
  quantity_a: '\\frac{3}{4}',
  quantity_b: '0.7',
  condition: null,
  expr_a: '3/4',
  expr_b: '0.7',
  correct_answer: 'A',
  tags: ['fractions', 'decimals'],
  difficulty: 1,
  target_seconds: 10,
  shortcut_explanation: '3/4 is 0.75, which is more than 0.7.',
  full_explanation: '3/4 = 0.75 and 0.75 > 0.70, so Quantity A is greater.',
};

function errorsFor(item: unknown): string[] {
  return parseBank([{ name: 'test.json', data: [item] }]).errors.map((e) => e.message);
}

describe('parseBank: valid items', () => {
  it('accepts a complete D item with two disagreeing witnesses', () => {
    const result = parseBank([{ name: 'test.json', data: [validD] }]);
    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('ineq-0042');
  });

  it('accepts an A item with no condition, no trap and no witnesses', () => {
    expect(errorsFor(validA)).toEqual([]);
  });

  it('accepts items spread across several files', () => {
    const result = parseBank([
      { name: 'a.json', data: [validA] },
      { name: 'b.json', data: [validD] },
    ]);
    expect(result.items.map((i) => i.id)).toEqual(['frac-0001', 'ineq-0042']);
  });

  it('returns no items and no errors for an empty bank', () => {
    expect(parseBank([])).toEqual({ items: [], errors: [] });
  });
});

describe('parseBank: rejections name the file, the id and the reason', () => {
  it('reports file and id for an invalid item', () => {
    const [error] = parseBank([{ name: 'bad.json', data: [{ ...validA, difficulty: 6 }] }]).errors;
    expect(error).toMatchObject({ file: 'bad.json', id: 'frac-0001' });
  });

  it('reports a null id when the item has no usable id', () => {
    const [error] = parseBank([{ name: 'bad.json', data: [{ ...validA, id: 42 }] }]).errors;
    expect(error?.id).toBeNull();
  });

  it('reports a null id when an entry is not an object at all', () => {
    const [error] = parseBank([{ name: 'bad.json', data: ['frac-0001'] }]).errors;
    expect(error).toMatchObject({ file: 'bad.json', id: null });
  });

  it('rejects a file that is not a JSON array', () => {
    const result = parseBank([{ name: 'bad.json', data: { items: [] } }]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toMatch(/array/i);
  });

  it('keeps valid items when another item in the same file is invalid', () => {
    const result = parseBank([{ name: 'mixed.json', data: [validA, { ...validD, tags: [] }] }]);
    expect(result.items.map((i) => i.id)).toEqual(['frac-0001']);
    expect(result.errors).toHaveLength(1);
  });

  it('rejects an id that is not prefix-NNNN', () => {
    expect(errorsFor({ ...validA, id: 'Frac_1' })).not.toEqual([]);
  });

  it('rejects the same id appearing twice across files', () => {
    const result = parseBank([
      { name: 'a.json', data: [validA] },
      { name: 'b.json', data: [validA] },
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ file: 'b.json', id: 'frac-0001' });
    expect(result.errors[0]?.message).toMatch(/duplicate/i);
  });

  it('rejects an unknown field (catches typos like "correct_anwser")', () => {
    expect(errorsFor({ ...validA, correct_anwser: 'A' })).not.toEqual([]);
  });

  it('rejects an answer outside A–D', () => {
    expect(errorsFor({ ...validA, correct_answer: 'E' })).not.toEqual([]);
  });

  it('rejects a tag that is not in the vocabulary', () => {
    expect(errorsFor({ ...validA, tags: ['fractions', 'calculus'] })).not.toEqual([]);
  });

  it('rejects an item with no tags', () => {
    expect(errorsFor({ ...validA, tags: [] })).not.toEqual([]);
  });

  it('rejects the same tag listed twice', () => {
    expect(errorsFor({ ...validA, tags: ['fractions', 'fractions'] })).not.toEqual([]);
  });

  it('rejects a trap that is not in the vocabulary', () => {
    expect(errorsFor({ ...validD, trap: 'tricky' })).not.toEqual([]);
  });

  it.each([0, 6, 2.5])('rejects difficulty %s (levels are whole numbers 1–5)', (difficulty) => {
    expect(errorsFor({ ...validA, difficulty })).not.toEqual([]);
  });

  it.each([1, 2, 3, 4, 5] as const)('rejects target_seconds above the level %i limit', (level) => {
    const over = LEVEL_TIME_LIMITS[level] + 1;
    const messages = errorsFor({ ...validA, difficulty: level, target_seconds: over });
    expect(messages.join(' ')).toMatch(/target_seconds/);
  });

  it('accepts target_seconds exactly at the level limit', () => {
    expect(errorsFor({ ...validA, difficulty: 5, target_seconds: 30 })).toEqual([]);
  });

  it('rejects empty quantity text', () => {
    expect(errorsFor({ ...validA, quantity_a: '  ' })).not.toEqual([]);
  });

  it('rejects expr_a without expr_b', () => {
    const withoutB = Object.fromEntries(Object.entries(validA).filter(([k]) => k !== 'expr_b'));
    expect(errorsFor(withoutB).join(' ')).toMatch(/expr_a and expr_b/);
  });

  it('rejects a shortcut longer than 3 sentences', () => {
    const shortcut = 'One. Two. Three. Four.';
    expect(errorsFor({ ...validA, shortcut_explanation: shortcut }).join(' ')).toMatch(
      /3 sentences/,
    );
  });

  it('accepts a one-phrase shortcut with no punctuation', () => {
    expect(errorsFor({ ...validA, shortcut_explanation: '3/4 is 0.75 so A wins' })).toEqual([]);
  });

  it('does not count a decimal point as a sentence end', () => {
    const shortcut = '3/4 is 0.75. That beats 0.7. So A.';
    expect(errorsFor({ ...validA, shortcut_explanation: shortcut })).toEqual([]);
  });
});

describe('parseBank: witnesses', () => {
  it('rejects a D item without witnesses', () => {
    const noWitnesses = Object.fromEntries(
      Object.entries(validD).filter(([k]) => k !== 'witnesses'),
    );
    expect(errorsFor(noWitnesses).join(' ')).toMatch(/witnesses/);
  });

  it('rejects a D item whose witnesses all give the same relation', () => {
    const sameRelation = [
      { x: 2, relation: 'A' },
      { x: 3, relation: 'A' },
    ];
    expect(errorsFor({ ...validD, witnesses: sameRelation }).join(' ')).toMatch(/different/);
  });

  it('rejects a D item with only one witness', () => {
    expect(errorsFor({ ...validD, witnesses: [{ x: 2, relation: 'A' }] })).not.toEqual([]);
  });

  it('rejects a witness whose relation is D', () => {
    const witnesses = [
      { x: 2, relation: 'A' },
      { x: 0.5, relation: 'D' },
    ];
    expect(errorsFor({ ...validD, witnesses })).not.toEqual([]);
  });

  it('rejects witnesses on an item whose key is not D', () => {
    const witnesses = validD.witnesses;
    expect(errorsFor({ ...validA, witnesses }).join(' ')).toMatch(/only for D/);
  });
});

import { describe, expect, it } from 'vitest';
import { verifyItem, SAMPLES_PER_ITEM } from '../../src/core/questions/evaluate.ts';
import { parseBank } from '../../src/core/questions/load.ts';
import type { QuestionItem } from '../../src/core/questions/schema.ts';

// A constant comparison (3/4 vs 0.7). Tests override only what they are about.
const base = {
  id: 'test-0001',
  quantity_a: '\\frac{3}{4}',
  quantity_b: '0.7',
  condition: null,
  expr_a: '3/4',
  expr_b: '0.7',
  correct_answer: 'A',
  tags: ['fractions'],
  difficulty: 1,
  target_seconds: 10,
  shortcut_explanation: '3/4 is 0.75.',
  full_explanation: '0.75 > 0.7.',
};

/** Builds an item the way the verifier gets one: through the schema, which must accept it. */
function toItem(overrides: Record<string, unknown>): QuestionItem {
  const { items, errors } = parseBank([{ name: 'test.json', data: [{ ...base, ...overrides }] }]);
  expect(errors).toEqual([]);
  const [item] = items;
  if (item === undefined) throw new Error('schema rejected the test item');
  return item;
}

function problems(overrides: Record<string, unknown>): string[] {
  return verifyItem(toItem(overrides)).problems;
}

describe('verifyItem: constant comparisons', () => {
  it('accepts a correct A key', () => {
    expect(problems({})).toEqual([]);
  });

  it('rejects a wrong key and says what the values give', () => {
    const [problem] = problems({ correct_answer: 'B' });
    expect(problem).toMatch(/key is B/);
    expect(problem).toMatch(/gives A/);
  });

  it('treats 0.1 + 0.2 and 0.3 as equal (no floating-point false alarm)', () => {
    expect(problems({ expr_a: '0.1 + 0.2', expr_b: '0.3', correct_answer: 'C' })).toEqual([]);
  });

  it('rejects D on a constant comparison, which always has one answer', () => {
    const witnesses = [{ relation: 'A' as const }, { relation: 'B' as const }];
    expect(problems({ correct_answer: 'D', witnesses }).join(' ')).toMatch(/witness/);
  });
});

describe('verifyItem: x² vs x', () => {
  const square = { expr_a: 'x^2', expr_b: 'x', quantity_a: 'x^2', quantity_b: 'x' };

  it('accepts D over all reals with witnesses that really disagree', () => {
    const witnesses = [
      { x: 2, relation: 'A' as const },
      { x: 0.5, relation: 'B' as const },
    ];
    const result = verifyItem(
      toItem({ ...square, domain: { x: 'real' }, correct_answer: 'D', witnesses }),
    );
    expect(result.problems).toEqual([]);
  });

  it('rejects A over all reals with a counter-example value of x', () => {
    const [problem] = problems({ ...square, domain: { x: 'real' }, correct_answer: 'A' });
    expect(problem).toMatch(/x = /);
    expect(problem).toMatch(/gives (B|C)/);
  });

  it('accepts A when x > 1', () => {
    expect(problems({ ...square, domain: { x: 'real, x > 1' } })).toEqual([]);
  });

  it('accepts B for 0 < x < 1 (chained comparison)', () => {
    expect(problems({ ...square, domain: { x: 'real, 0 < x < 1' }, correct_answer: 'B' })).toEqual(
      [],
    );
  });

  it('checks at least the required number of values', () => {
    const result = verifyItem(toItem({ ...square, domain: { x: 'real, x > 1' } }));
    expect(SAMPLES_PER_ITEM).toBeGreaterThanOrEqual(500);
    expect(result.checks).toBeGreaterThanOrEqual(SAMPLES_PER_ITEM);
  });
});

describe('verifyItem: √(x²) vs x', () => {
  const root = { expr_a: 'sqrt(x^2)', expr_b: 'x' };

  it('rejects C over all reals: a negative x makes A greater', () => {
    const [problem] = problems({ ...root, domain: { x: 'real' }, correct_answer: 'C' });
    expect(problem).toMatch(/gives A/);
  });

  it('accepts C when x >= 0', () => {
    expect(problems({ ...root, domain: { x: 'real, x >= 0' }, correct_answer: 'C' })).toEqual([]);
  });
});

describe('verifyItem: edge values are always tried', () => {
  // Each key below is wrong at exactly one edge value, which random sampling would almost never hit.
  it.each([
    ['0', 'x^2', '0'],
    ['−1', 'abs(x + 1)', '0'],
    ['½', 'abs(x - 0.5)', '0'],
    ['1', 'abs(x - 1)', '0'],
    ['2', 'abs(x - 2)', '0'],
  ])('finds the counter-example at x = %s', (_label, exprA, exprB) => {
    expect(problems({ expr_a: exprA, expr_b: exprB, domain: { x: 'real' } })).not.toEqual([]);
  });

  it('finds a counter-example that only a large value reveals', () => {
    const big = { expr_a: '100000', expr_b: 'x', domain: { x: 'real, x > 0' } };
    expect(problems(big).join(' ')).toMatch(/gives B/);
  });
});

describe('verifyItem: integer domains', () => {
  it('accepts x + 1 > x for integers', () => {
    expect(problems({ expr_a: 'x + 1', expr_b: 'x', domain: { x: 'integer' } })).toEqual([]);
  });

  it('rejects A for 2x vs x + 1 over positive integers: x = 1 makes them equal', () => {
    const item = { expr_a: '2x', expr_b: 'x + 1', domain: { x: 'integer, x > 0' } };
    expect(problems(item).join(' ')).toMatch(/x = 1 gives C/);
  });

  it('only tries whole numbers', () => {
    // x² >= x holds for every integer but fails at x = ½.
    expect(problems({ expr_a: 'x^2 >= x ? 1 : 0', expr_b: '0', domain: { x: 'integer' } })).toEqual(
      [],
    );
  });
});

describe('verifyItem: several variables', () => {
  it('accepts x + y > x when y > 0', () => {
    const item = { expr_a: 'x + y', expr_b: 'x', domain: { x: 'real', y: 'real, y > 0' } };
    expect(problems(item)).toEqual([]);
  });

  it('honours a condition that links two variables', () => {
    const item = { expr_a: 'x', expr_b: 'y', domain: { x: 'real', y: 'real, y < x' } };
    expect(problems(item)).toEqual([]);
  });
});

describe('verifyItem: D witnesses', () => {
  const dItem = {
    expr_a: 'x^2',
    expr_b: 'x',
    domain: { x: 'real' },
    correct_answer: 'D' as const,
  };

  it('rejects a witness whose stated relation is not what the values give', () => {
    const witnesses = [
      { x: 2, relation: 'A' as const },
      { x: 3, relation: 'B' as const },
    ];
    expect(problems({ ...dItem, witnesses }).join(' ')).toMatch(/witness 2.*says B.*gives A/);
  });

  it('rejects a witness outside the domain', () => {
    const witnesses = [
      { x: 2, relation: 'A' as const },
      { x: 0.5, relation: 'B' as const },
    ];
    const item = { ...dItem, domain: { x: 'real, x > 1' }, witnesses };
    expect(problems(item).join(' ')).toMatch(/witness 2.*outside the domain/);
  });

  it('rejects a fractional witness for an integer variable', () => {
    const witnesses = [
      { x: 2, relation: 'A' as const },
      { x: 0.5, relation: 'B' as const },
    ];
    const item = { ...dItem, domain: { x: 'integer' }, witnesses };
    expect(problems(item).join(' ')).toMatch(/witness 2.*outside the domain/);
  });

  it('rejects a witness that sets a variable with no domain', () => {
    const witnesses = [
      { x: 2, relation: 'A' as const },
      { x: 0.5, y: 1, relation: 'B' as const },
    ];
    expect(problems({ ...dItem, witnesses }).join(' ')).toMatch(/witness 2.*y/);
  });

  it('rejects a witness that leaves out a variable', () => {
    const witnesses = [{ x: 2, relation: 'A' as const }, { relation: 'B' as const }];
    expect(problems({ ...dItem, witnesses }).join(' ')).toMatch(/witness 2.*x/);
  });
});

describe('verifyItem: items the verifier cannot evaluate', () => {
  const figure = { expr_a: undefined, expr_b: undefined, domain: undefined };

  it('requires reviewed_by when there are no expressions', () => {
    expect(problems(figure).join(' ')).toMatch(/reviewed_by/);
  });

  it('accepts a human-reviewed item without expressions', () => {
    const result = verifyItem(toItem({ ...figure, reviewed_by: 'owner' }));
    expect(result).toEqual({ problems: [], checks: 0 });
  });
});

describe('verifyItem: broken expressions and domains', () => {
  it('reports a variable that has no domain', () => {
    expect(problems({ expr_a: 'x', expr_b: '1' }).join(' ')).toMatch(/x/);
  });

  it('reports an expression mathjs cannot parse', () => {
    expect(problems({ expr_a: '3 / (', expr_b: '1' }).join(' ')).toMatch(/expr_a/);
  });

  it('reports a domain that does not start with real or integer', () => {
    expect(problems({ expr_a: 'x', expr_b: '1', domain: { x: 'complex' } }).join(' ')).toMatch(
      /real or integer/,
    );
  });

  it('reports a domain rule mathjs cannot parse', () => {
    const domain = { x: 'real, x >' };
    expect(problems({ expr_a: 'x', expr_b: '1', domain }).join(' ')).toMatch(/domain/);
  });

  it('reports a domain rule that fails to evaluate', () => {
    const domain = { x: 'real, x > z' };
    expect(problems({ expr_a: 'x', expr_b: '1', domain }).join(' ')).toMatch(/rule "x > z" failed/);
  });

  it('reports a domain too narrow to sample enough values', () => {
    const domain = { x: 'real, 0.4999 < x < 0.5001' };
    expect(problems({ expr_a: 'x', expr_b: '1', domain }).join(' ')).toMatch(/found only/);
  });

  it('reports a domain no value satisfies', () => {
    const domain = { x: 'real, x > 1, x < 0' };
    expect(problems({ expr_a: 'x', expr_b: '1', domain }).join(' ')).toMatch(/no values/);
  });

  it('reports a result that is not a real number', () => {
    const item = { expr_a: 'sqrt(x)', expr_b: '0', domain: { x: 'real' } };
    expect(problems(item).join(' ')).toMatch(/not a real number/);
  });
});

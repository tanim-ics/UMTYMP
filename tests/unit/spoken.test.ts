// Task 22: what a screen reader says for a bank formula. KaTeX's MathML is read unevenly (well by VoiceOver, barely
// by some others), so each formula also gets a plain spoken form: "x squared", not "x caret 2".
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseBank } from '../../src/core/questions/load.ts';
import { spokenMath } from '../../src/core/questions/spoken.ts';

const DIR = 'content/questions';

describe('spokenMath', () => {
  it.each([
    ['x', 'x'],
    ['0.6', '0.6'],
    ['x^2', 'x squared'],
    ['x^3', 'x cubed'],
    ['(-1)^n', 'open bracket negative 1 close bracket to the power n'],
    // The even-power trap: the two must not sound the same.
    ['-2^4', 'negative 2 to the power 4'],
    ['(-2)^4', 'open bracket negative 2 close bracket to the power 4'],
    ['(x + 1)^2 - 1', 'open bracket x plus 1 close bracket squared minus 1'],
    ['2x', '2 x'],
    ['x(x + 2)', 'x open bracket x plus 2 close bracket'],
    ['49 \\times 51', '49 times 51'],
    ['12 \\div 4 \\cdot 2', '12 divided by 4 times 2'],
    ['\\frac{5}{8}', '5 over 8'],
    ['\\frac{x + 1}{y + 1}', 'the fraction x plus 1 over y plus 1, end fraction'],
    ['\\frac12', '1 over 2'],
    ['\\sqrt{25}', 'the square root of 25'],
    ['\\sqrt{x^2}', 'the square root of x squared, end root'],
    ['|x|', 'the absolute value of x'],
    ['|x - 3|', 'the absolute value of x minus 3, end absolute value'],
    ['2^{n+1}', '2 to the power n plus 1, end power'],
    ['2^{10}', '2 to the power 10'],
    ['20\\% \\text{ of } 45', '20 percent of 45'],
    ['x : y = 2 : 3 \\text{ and } x > 0', 'x to y equals 2 to 3 and x is greater than 0'],
    ['3 < x < 5', '3 is less than x is less than 5'],
    ['x \\neq 0', 'x is not equal to 0'],
    ['x \\le 1, y \\geq 2', 'x is less than or equal to 1, y is greater than or equal to 2'],
    ['\\text{a triangle has sides } 3, 7 \\text{ and } x', 'a triangle has sides 3, 7 and x'],
    ['{x}^2', 'x squared'],
  ])('%s → %s', (latex, spoken) => {
    expect(spokenMath(latex)).toBe(spoken);
  });

  it.each(['\\int x', 'x^', '\\frac{1}', '(x', 'x)', '{x', '|x', '\\', '\\sqrt'])(
    'says null for %s, so the MathML is read instead',
    (latex) => {
      expect(spokenMath(latex)).toBeNull();
    },
  );

  it('has a spoken form for every formula in the bank', () => {
    const files = readdirSync(DIR)
      .filter((name) => name.endsWith('.json'))
      .map((name) => ({
        name,
        data: JSON.parse(readFileSync(join(DIR, name), 'utf8')) as unknown,
      }));
    const { items } = parseBank(files);
    expect(items.length).toBeGreaterThan(0);
    const formulas = items.flatMap((item) => [
      item.quantity_a,
      item.quantity_b,
      item.condition ?? '',
    ]);
    const unspoken = formulas.filter((latex) => latex !== '' && spokenMath(latex) === null);
    expect(unspoken).toEqual([]);
  });
});

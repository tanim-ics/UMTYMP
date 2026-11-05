// No question appears twice in the bank (owner, 2026-11-05). Caught here: the same question, the same question with
// A and B swapped, the same question with other letters (x vs y), and two items whose machine checks are identical.
// "Same idea, different numbers" can't be judged by a machine, so each batch is also compared by hand.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseBank } from '../../src/core/questions/load.ts';
import type { QuestionItem } from '../../src/core/questions/schema.ts';

const DIR = 'content/questions';

/** Renames single-letter variables to V0, V1 … in order of first use, so x/y and a/b questions compare equal. */
function shape(item: QuestionItem): { forward: string; swapped: string } {
  const parts = [item.quantity_a, item.quantity_b, item.condition ?? ''];
  const names = new Map<string, string>();
  const rename = (latex: string) =>
    latex
      .split(/(\\text\{[^}]*\}|\\[a-zA-Z]+)/)
      .map((piece) =>
        piece.startsWith('\\')
          ? piece
          : piece.replace(/(?<![a-zA-Z])[a-z](?![a-zA-Z])/g, (v) => {
              if (!names.has(v)) names.set(v, `V${names.size}`);
              return names.get(v) ?? v;
            }),
      )
      .join('')
      .replace(/\s+/g, '');
  const [a, b, c] = parts.map(rename);
  return { forward: `${a}|${b}|${c}`, swapped: `${b}|${a}|${c}` };
}

function checkKey(item: QuestionItem): string | null {
  if (item.expr_a === undefined || item.expr_b === undefined) return null;
  const domain = JSON.stringify(Object.entries(item.domain ?? {}).sort());
  return `${item.expr_a.replace(/\s+/g, '')}|${item.expr_b.replace(/\s+/g, '')}|${domain}`;
}

/** Every pair of ids that is the same question, as "first = second (how)". */
export function duplicates(items: readonly QuestionItem[]): string[] {
  const found: string[] = [];
  const shapes = new Map<string, string>();
  const checks = new Map<string, string>();
  for (const item of items) {
    const { forward, swapped } = shape(item);
    const same = shapes.get(forward) ?? shapes.get(swapped);
    if (same !== undefined) found.push(`${same} = ${item.id} (same question)`);
    shapes.set(forward, item.id);
    const key = checkKey(item);
    if (key !== null) {
      const twin = checks.get(key);
      if (twin !== undefined) found.push(`${twin} = ${item.id} (same machine check)`);
      checks.set(key, item.id);
    }
  }
  return found;
}

const { items } = parseBank(
  readdirSync(DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({ name, data: JSON.parse(readFileSync(join(DIR, name), 'utf8')) as unknown })),
);

describe('no duplicate questions', () => {
  const base = items[0] as QuestionItem;

  it('the bank has no question twice', () => {
    expect(items.length).toBeGreaterThan(0);
    expect(duplicates(items)).toEqual([]);
  });

  it('catches an exact copy', () => {
    expect(duplicates([base, { ...base, id: 'copy-0001' }])).toEqual([
      `${base.id} = copy-0001 (same question)`,
      `${base.id} = copy-0001 (same machine check)`,
    ]);
  });

  it('catches A and B swapped', () => {
    const swapped = {
      ...base,
      id: 'copy-0001',
      quantity_a: base.quantity_b,
      quantity_b: base.quantity_a,
    };
    expect(duplicates([base, { ...swapped, expr_a: 'different', expr_b: 'too' }])).toEqual([
      `${base.id} = copy-0001 (same question)`,
    ]);
  });

  it('catches the same question with other letters', () => {
    const x: QuestionItem = {
      ...base,
      id: 'x-0001',
      quantity_a: 'x^2',
      quantity_b: 'x',
      condition: 'x > 0',
    };
    const y: QuestionItem = {
      ...base,
      id: 'y-0001',
      quantity_a: 'y^2',
      quantity_b: 'y',
      condition: 'y > 0',
    };
    expect(duplicates([x, y])).toContain('x-0001 = y-0001 (same question)');
  });

  it('leaves the words inside \\text alone, and different conditions apart', () => {
    const a: QuestionItem = {
      ...base,
      id: 'a-0001',
      quantity_a: '|x|',
      quantity_b: 'x',
      condition: 'x < 0',
      expr_a: '1',
    };
    const b: QuestionItem = {
      ...base,
      id: 'b-0001',
      quantity_a: '|x|',
      quantity_b: 'x',
      condition: 'x > 0',
      expr_a: '2',
    };
    expect(duplicates([a, b])).toEqual([]);
  });
});

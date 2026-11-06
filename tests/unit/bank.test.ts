import { describe, expect, it } from 'vitest';
import { fetchBank, loadBank } from '../../src/ui/bank.ts';

describe('loadBank', () => {
  it('fetches every item of the real bank files', async () => {
    const bank = await fetchBank();
    expect(bank.length).toBeGreaterThanOrEqual(20);
    expect(bank.map((i) => i.id)).toContain('frac-0001');
  });

  it('reads files in name order, so the bank order never depends on the bundler', () => {
    const item = (id: string) => ({
      id,
      quantity_a: '1',
      quantity_b: '2',
      condition: null,
      correct_answer: 'B',
      tags: ['arithmetic'],
      difficulty: 1,
      target_seconds: 5,
      shortcut_explanation: 'Look.',
      full_explanation: 'Proof.',
      reviewed_by: 'test',
    });
    const bank = loadBank({ 'b.json': [item('two-0001')], 'a.json': [item('one-0001')] });
    expect(bank.map((i) => i.id)).toEqual(['one-0001', 'two-0001']);
  });

  it('drops invalid items instead of showing them', () => {
    expect(loadBank({ 'bad.json': [{ id: 'nope' }] })).toEqual([]);
  });
});

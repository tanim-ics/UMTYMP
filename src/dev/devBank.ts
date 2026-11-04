// Dev builds only (`?bank=repeat`): pads the small seed bank so a full 50-item mock can run end to end before the
// real bank is big enough (Checkpoint B). Copies are the same questions under new ids; they never ship.
import type { QuestionItem } from '../core/questions/schema.ts';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** The originals followed by `copies − 1` copies with ids like `copy-a-frac-0001` (still schema-valid). */
export function repeatBank(bank: readonly QuestionItem[], copies: number): QuestionItem[] {
  if (!Number.isInteger(copies) || copies < 1 || copies > LETTERS.length + 1) {
    throw new RangeError(`copies must be a whole number from 1 to ${LETTERS.length + 1}`);
  }
  const extra = Array.from({ length: copies - 1 }, (_, k) =>
    bank.map((item) => ({ ...item, id: `copy-${LETTERS[k]}-${item.id}` })),
  );
  return [...bank, ...extra.flat()];
}

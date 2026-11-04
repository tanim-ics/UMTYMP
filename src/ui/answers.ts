import type { Answer } from '../core/questions/vocabulary.ts';

/** The words shown with each letter, everywhere an answer appears (CLAUDE.md: words *and* letters). */
export const ANSWER_WORDS: Readonly<Record<Answer, string>> = {
  A: 'Quantity A is greater',
  B: 'Quantity B is greater',
  C: 'The two quantities are equal',
  D: 'Not enough information',
};

export const LETTERS: readonly Answer[] = ['A', 'B', 'C', 'D'];

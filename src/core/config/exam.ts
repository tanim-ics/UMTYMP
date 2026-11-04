// Exam constants live only here (CLAUDE.md). Official facts and their sources: docs/EXAM_FACTS.md.
import type { Level } from '../questions/vocabulary.ts';

export const EXAM = {
  /** Official: 50 questions. */
  questionCount: 50,
  /** Official: "an average of 30 seconds" per question. */
  secondsPerQuestion: 30,
  /** Assumption: 50 × the official average of 30 s. A setting, not an official limit. */
  durationMs: 25 * 60_000,
  /** Our default mix of levels in a full mock (docs/SPEC.md); sums to questionCount. */
  levelMix: { 1: 6, 2: 10, 3: 14, 4: 12, 5: 8 } as Readonly<Record<Level, number>>,
  /** A new mock avoids items from this many previous mocks while the bank allows it (SPEC S1). */
  recentMocksToAvoid: 3,
  /** Potion drill length (SPEC S4). */
  drillLength: 10,
  /** Spellbook practice length range (SPEC S5). */
  practiceLength: { min: 5, max: 50 },
} as const;

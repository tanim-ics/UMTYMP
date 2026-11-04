import type { Answer, Level, Tag, Trap } from '../questions/vocabulary.ts';

export type SessionMode = 'mock' | 'drill' | 'practice';

/**
 * One item's outcome in one session, saved as it happens (CLAUDE.md §4). It carries the item's key, level, tags and
 * trap so the analytics never need the bank to compute a metric.
 */
export interface AttemptEvent {
  readonly sessionId: string;
  readonly mode: SessionMode;
  readonly itemId: string;
  /** 0-based place of the item in the session. */
  readonly position: number;
  readonly level: Level;
  readonly tags: readonly Tag[];
  readonly trap: Trap | null;
  readonly correctAnswer: Answer;
  /** null when skipped or unanswered. */
  readonly choice: Answer | null;
  /** `skipped`: the student pressed Skip. `unanswered`: the session ended before any answer. */
  readonly status: 'answered' | 'skipped' | 'unanswered';
  readonly correct: boolean;
  /** Monotonic ms when the item was last shown before this outcome; null if it was never shown. */
  readonly shownAt: number | null;
  /** Monotonic ms of the final answer or skip; null when unanswered. Time per question = answeredAt − shownAt. */
  readonly answeredAt: number | null;
  /** How often the student switched from one letter to another. */
  readonly answerChanges: number;
  readonly flagged: boolean;
}

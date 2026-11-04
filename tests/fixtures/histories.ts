// Hand-made AttemptEvent histories for analytics tests. Every expected number in the tests is worked out by hand
// from these, so keep them small and change them only together with the expectations.
import type { AttemptEvent } from '../../src/core/session/attempt.ts';
import type { Answer, Level, Tag, Trap } from '../../src/core/questions/vocabulary.ts';

const SECOND = 1000;
export const MINUTE = 60 * SECOND;

interface EventSpec {
  key?: Answer;
  choice?: Answer | null;
  status?: AttemptEvent['status'];
  level?: Level;
  tags?: Tag[];
  trap?: Trap | null;
  /** Seconds from when the item was shown to the answer. */
  seconds?: number;
  /** When the answer was given, in ms after the session started. */
  at?: number;
}

/** One event; `choice` defaults to the key (a correct answer). */
export function ev(position: number, spec: EventSpec = {}): AttemptEvent {
  const key = spec.key ?? 'A';
  const status = spec.status ?? 'answered';
  const choice = status === 'answered' ? (spec.choice === undefined ? key : spec.choice) : null;
  const at = spec.at ?? (position + 1) * 20 * SECOND;
  const seconds = spec.seconds ?? 20;
  return {
    sessionId: 's1',
    mode: 'mock',
    itemId: `test-${String(position + 1).padStart(4, '0')}`,
    position,
    level: spec.level ?? 1,
    tags: spec.tags ?? ['arithmetic'],
    trap: spec.trap ?? null,
    correctAnswer: key,
    choice,
    status,
    correct: choice !== null && choice === key,
    shownAt: status === 'unanswered' ? null : at - seconds * SECOND,
    answeredAt: status === 'unanswered' ? null : at,
    answerChanges: 0,
    flagged: false,
  };
}

/** `n` events built by `spec(i)`, positions 0…n−1. */
export function many(n: number, spec: (i: number) => EventSpec): AttemptEvent[] {
  return Array.from({ length: n }, (_, i) => ev(i, spec(i)));
}

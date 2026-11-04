// What the results and review screens show, computed here so components never compute metrics (CLAUDE.md §4).
import type { AttemptEvent } from '../session/attempt.ts';
import { slowEvents } from './metrics.ts';

export type ReviewFilter = 'all' | 'wrong' | 'slow' | 'flagged';
export const REVIEW_FILTERS: readonly ReviewFilter[] = ['all', 'wrong', 'slow', 'flagged'];

/** "wrong" is wrong *or missed*: skipped and unanswered questions are the ones a student most needs to see again. */
export function matchesFilter(event: AttemptEvent, filter: ReviewFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'wrong':
      return !event.correct;
    case 'slow':
      return slowEvents([event]).length === 1;
    case 'flagged':
      return event.flagged;
  }
}

export function filterCounts(events: readonly AttemptEvent[]): Record<ReviewFilter, number> {
  const counts = { all: 0, wrong: 0, slow: 0, flagged: 0 };
  for (const filter of REVIEW_FILTERS) {
    counts[filter] = events.filter((e) => matchesFilter(e, filter)).length;
  }
  return counts;
}

export interface ResultSummary {
  total: number;
  correct: number;
  /** Answered but not right. */
  wrong: number;
  skipped: number;
  unanswered: number;
  slow: number;
}

export function resultSummary(events: readonly AttemptEvent[]): ResultSummary {
  const answered = events.filter((e) => e.status === 'answered');
  return {
    total: events.length,
    correct: answered.filter((e) => e.correct).length,
    wrong: answered.filter((e) => !e.correct).length,
    skipped: events.filter((e) => e.status === 'skipped').length,
    unanswered: events.filter((e) => e.status === 'unanswered').length,
    slow: slowEvents(events).length,
  };
}

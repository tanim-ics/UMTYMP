import { describe, expect, it } from 'vitest';
import { filterCounts, matchesFilter, resultSummary } from '../../src/core/analytics/review.ts';
import { ev } from '../fixtures/histories.ts';

const events = [
  ev(0, {}), // right, 20 s
  ev(1, { choice: 'B' }), // wrong
  ev(2, { status: 'skipped' }),
  ev(3, { status: 'unanswered' }),
  ev(4, { seconds: 40 }), // right but slow
  { ...ev(5, { choice: 'C', seconds: 36 }), flagged: true }, // wrong, slow, flagged
  { ...ev(6, {}), flagged: true }, // right, flagged
];

describe('review filters', () => {
  it('"all" keeps everything', () => {
    expect(events.filter((e) => matchesFilter(e, 'all'))).toHaveLength(7);
  });

  it('"wrong" means wrong or missed: wrong answers, skips and unanswered', () => {
    expect(events.filter((e) => matchesFilter(e, 'wrong')).map((e) => e.position)).toEqual([
      1, 2, 3, 5,
    ]);
  });

  it('"slow" means answered in more than 35 s', () => {
    expect(events.filter((e) => matchesFilter(e, 'slow')).map((e) => e.position)).toEqual([4, 5]);
  });

  it('"flagged" means flagged by the student', () => {
    expect(events.filter((e) => matchesFilter(e, 'flagged')).map((e) => e.position)).toEqual([
      5, 6,
    ]);
  });

  it('counts every filter', () => {
    expect(filterCounts(events)).toEqual({ all: 7, wrong: 4, slow: 2, flagged: 2 });
  });
});

describe('result summary', () => {
  it('splits a session into right, wrong, skipped, unanswered and slow', () => {
    expect(resultSummary(events)).toEqual({
      total: 7,
      correct: 3,
      wrong: 2,
      skipped: 1,
      unanswered: 1,
      slow: 2,
    });
  });

  it('is all zero for an empty session', () => {
    expect(resultSummary([])).toEqual({
      total: 0,
      correct: 0,
      wrong: 0,
      skipped: 0,
      unanswered: 0,
      slow: 0,
    });
  });
});

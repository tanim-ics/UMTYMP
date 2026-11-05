import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '../../src/core/analytics/coach.ts';
import { mockTrend, progressTable, towers } from '../../src/core/analytics/progress.ts';
import type { AttemptEvent } from '../../src/core/session/attempt.ts';
import { many, MINUTE } from '../fixtures/histories.ts';

const MOCK_MS = 25 * MINUTE;
const DAY = 24 * 60 * MINUTE;

function session(
  sessionId: string,
  events: AttemptEvent[],
  overrides: Partial<SessionRecord> = {},
): SessionRecord {
  return {
    sessionId,
    mode: 'mock',
    startedAt: 0,
    durationMs: MOCK_MS,
    endReason: 'completed',
    events: events.map((e) => ({ ...e, sessionId })),
    ...overrides,
  };
}

/** A mock with `right` of `total` answered correctly, 20 s each, spread over 20 s steps. */
const mockWith = (id: string, right: number, total = 10, startedAt = 0) =>
  session(
    id,
    many(total, (i) => ({ choice: i < right ? 'A' : 'B' })),
    { startedAt },
  );

describe('mockTrend', () => {
  it('is empty for an empty history', () => {
    expect(mockTrend([])).toEqual([]);
  });

  it('lists finished mocks only, oldest first', () => {
    const history = [
      mockWith('later', 6, 10, 2 * DAY),
      mockWith('first', 4, 10, DAY),
      session(
        'drill',
        many(10, () => ({})),
        { mode: 'drill', durationMs: null },
      ),
      session(
        'open',
        many(10, () => ({})),
        { endReason: null, startedAt: 3 * DAY },
      ),
    ];
    expect(mockTrend(history).map((p) => [p.sessionId, p.correct, p.total])).toEqual([
      ['first', 4, 10],
      ['later', 6, 10],
    ]);
  });

  it('gives the median time of answered questions, ignoring skips and unanswered', () => {
    const events = many(8, (i) => ({
      seconds: [10, 20, 30, 40, 50, 60, 5, 5][i],
      status: i >= 6 ? (i === 6 ? 'skipped' : 'unanswered') : 'answered',
    }));
    // Answered times: 10, 20, 30, 40, 50, 60 → median 35 s.
    expect(mockTrend([session('m', events)])[0]?.medianMs).toBe(35_000);
  });

  it('makes no time, trap or false-D claim on fewer than 5 answers', () => {
    const point = mockTrend([
      session(
        'm',
        many(4, () => ({ key: 'D' })),
      ),
    ])[0];
    expect(point).toMatchObject({ medianMs: null, trapRate: null, falseDRate: null });
  });

  it('trap rate: wrong share of questions with a trap or a D key', () => {
    const events = many(10, (i) => {
      if (i < 3) return { trap: 'zero', choice: i === 0 ? 'B' : 'A' }; // 1 wrong of 3
      if (i < 6) return { key: 'D', choice: i === 3 ? 'A' : 'D' }; // 1 wrong of 3
      return {}; // plain questions don't count
    });
    expect(mockTrend([session('m', events)])[0]?.trapRate).toBeCloseTo(2 / 6);
  });

  it('false-D rate: D chosen when the key is A, B or C', () => {
    const events = many(10, (i) => ({ choice: i < 2 ? 'D' : 'A' }));
    expect(mockTrend([session('m', events)])[0]?.falseDRate).toBeCloseTo(0.2);
  });

  it('stamina drop in points from the first to the last 10 minutes', () => {
    const early = many(10, (i) => ({ at: (i + 1) * 30_000 })); // all right, minutes 0–5
    const late = many(10, (i) => ({ at: 16 * MINUTE + i * 30_000, choice: i < 5 ? 'B' : 'A' })); // half right
    const events = [...early, ...late].map((e, i) => ({ ...e, position: i }));
    expect(mockTrend([session('m', events)])[0]?.staminaDropPoints).toBe(50);
  });

  it('stamina is null when a window has too few answers', () => {
    expect(mockTrend([mockWith('m', 10)])[0]?.staminaDropPoints).toBeNull();
  });
});

describe('progressTable', () => {
  it('is empty for an empty history', () => {
    expect(progressTable([])).toEqual({ tags: [], levels: [] });
  });

  it('accuracy and median time per topic and per level, over every finished session', () => {
    const mock = session(
      'm',
      many(6, (i) => ({ tags: ['fractions'], level: 2, choice: i < 3 ? 'A' : 'B', seconds: 10 })),
    );
    const drill = session(
      'd',
      many(4, () => ({ tags: ['roots'], level: 2, seconds: 30 })),
      { mode: 'drill', durationMs: null },
    );
    const open = session(
      'o',
      many(5, () => ({ tags: ['percents'] })),
      { endReason: null },
    );
    expect(progressTable([mock, drill, open])).toEqual({
      tags: [
        { key: 'fractions', attempted: 6, correct: 3, accuracy: 0.5, medianMs: 10_000 },
        { key: 'roots', attempted: 4, correct: 4, accuracy: null, medianMs: null },
      ],
      levels: [{ key: 2, attempted: 10, correct: 7, accuracy: 0.7, medianMs: 10_000 }],
    });
  });

  it('lists topics and levels in the vocabulary order', () => {
    const events = many(4, (i) => ({
      tags: [(['roots', 'arithmetic', 'geometry', 'fractions'] as const)[i] ?? 'roots'],
      level: ([5, 1, 3, 1] as const)[i],
    }));
    const table = progressTable([session('m', events)]);
    expect(table.tags.map((r) => r.key)).toEqual(['arithmetic', 'fractions', 'roots', 'geometry']);
    expect(table.levels.map((r) => r.key)).toEqual([1, 3, 5]);
  });
});

describe('towers', () => {
  const ids = (history: SessionRecord[]) =>
    towers(history)
      .filter((t) => t.unlocked)
      .map((t) => t.id);

  it('a new student sees every tower locked, each saying how to open it', () => {
    const all = towers([]);
    expect(all.length).toBeGreaterThanOrEqual(5);
    for (const t of all) {
      expect(t.unlocked).toBe(false);
      expect(t.evidence).toBeNull();
      expect(t.howTo.length).toBeGreaterThan(0);
    }
  });

  it('habit towers open from the habit badges, with the student’s own numbers', () => {
    const opened = towers([mockWith('m', 10)]).filter((t) => t.unlocked);
    expect(opened.map((t) => t.id)).toEqual(['first_trial', 'finished_in_time']);
    expect(opened[0]?.evidence).toBe('1 Grand Trial finished');
  });

  it('the progress tower opens when a later mock beats the first one', () => {
    expect(ids([mockWith('a', 4, 10, 0), mockWith('b', 4, 10, DAY)])).not.toContain('rising');
    const history = [
      mockWith('a', 4, 10, 0),
      mockWith('b', 7, 10, DAY),
      mockWith('c', 5, 10, 2 * DAY),
    ];
    const rising = towers(history).find((t) => t.id === 'rising');
    expect(rising).toMatchObject({
      unlocked: true,
      evidence: 'From 40% to 70% right since your first Grand Trial',
    });
  });

  it('progress compares shares, so a shorter mock does not count as a drop', () => {
    expect(ids([mockWith('a', 5, 10, 0), mockWith('b', 4, 5, DAY)])).toContain('rising');
  });

  it('never depends on days: a long break locks nothing that was open', () => {
    const close = [mockWith('a', 4, 10, 0), mockWith('b', 7, 10, MINUTE * 30)];
    const apart = [mockWith('a', 4, 10, 0), mockWith('b', 7, 10, 90 * DAY)];
    expect(towers(apart)).toEqual(towers(close));
  });
});

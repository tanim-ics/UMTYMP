import { describe, expect, it } from 'vitest';
import {
  METRICS,
  accuracy,
  accuracyBy,
  falseDRate,
  medianTimeBy,
  paceMarks,
  skips,
  slowEvents,
  stamina,
  timeMs,
  trapSusceptibility,
  trapSusceptibilityByTrap,
} from '../../src/core/analytics/metrics.ts';
import { ev, many, MINUTE } from '../fixtures/histories.ts';

describe('thresholds', () => {
  it('match CLAUDE.md §4', () => {
    expect(METRICS).toEqual({
      minAttempts: 5,
      slowSeconds: 35,
      paceSecondsPerQuestion: 30,
      paceMarkMs: 5 * MINUTE,
      staminaWindowMs: 10 * MINUTE,
      staminaDropPoints: 15,
    });
  });
});

describe('time per question', () => {
  it('is answeredAt − shownAt for an answered item', () => {
    expect(timeMs(ev(0, { seconds: 12 }))).toBe(12_000);
  });

  it('is null for skipped and unanswered items', () => {
    expect(timeMs(ev(0, { status: 'skipped' }))).toBeNull();
    expect(timeMs(ev(0, { status: 'unanswered' }))).toBeNull();
  });

  it('flags answers slower than 35 s, not exactly 35 s', () => {
    const events = [ev(0, { seconds: 35 }), ev(1, { seconds: 35.5 }), ev(2, { seconds: 50 })];
    expect(slowEvents(events).map((e) => e.position)).toEqual([1, 2]);
  });

  it('gives the median per tag, counting an item under each of its tags', () => {
    // arithmetic: 10, 20, 30, 40, 50 → 30. fractions (items 0–5): 10, 20, 30, 40, 50, 60 → (30+40)/2 = 35.
    const events = [
      ...many(5, (i) => ({ seconds: (i + 1) * 10, tags: ['arithmetic', 'fractions'] })),
      ev(5, { seconds: 60, tags: ['fractions'] }),
    ];
    expect(medianTimeBy(events, 'tag')).toEqual({ arithmetic: 30_000, fractions: 35_000 });
  });

  it('gives the median per level and null below 5 answers', () => {
    const events = [
      ...many(5, (i) => ({ seconds: i + 1, level: 2 })), // 1–5 s → 3 s
      ev(5, { seconds: 9, level: 4 }),
    ];
    expect(medianTimeBy(events, 'level')).toEqual({ 2: 3000, 4: null });
  });
});

describe('concept accuracy', () => {
  it('is correct ÷ answered; skips and unanswered do not count', () => {
    const events = [
      ...many(4, () => ({})),
      ev(4, { choice: 'B' }),
      ev(5, { status: 'skipped' }),
      ev(6, { status: 'unanswered' }),
    ];
    expect(accuracy(events)).toBe(4 / 5);
  });

  it('is null below 5 answers', () => {
    expect(accuracy(many(4, () => ({})))).toBeNull();
  });

  it('per tag and per level, with counts even when too few to claim a rate', () => {
    const events = [
      ...many(6, (i) => ({ tags: ['fractions'], level: 3, choice: i < 2 ? 'B' : 'A' })),
      ev(6, { tags: ['roots'], level: 3 }),
    ];
    expect(accuracyBy(events, 'tag')).toEqual({
      fractions: { attempted: 6, correct: 4, accuracy: 4 / 6 },
      roots: { attempted: 1, correct: 1, accuracy: null },
    });
    expect(accuracyBy(events, 'level')).toEqual({
      3: { attempted: 7, correct: 5, accuracy: 5 / 7 },
    });
  });
});

describe('trap susceptibility', () => {
  it('is the share of D-key items answered A, B or C (the CLAUDE.md pattern)', () => {
    const events = [
      ...many(3, () => ({ key: 'D' })),
      ev(3, { key: 'D', choice: 'A' }),
      ev(4, { key: 'D', choice: 'C' }),
      ev(5, { key: 'D', status: 'skipped' }), // no choice: not counted
      ev(6, { key: 'A', choice: 'B' }), // not a D item
    ];
    expect(trapSusceptibility(events)).toBe(2 / 5);
  });

  it('is null below 5 answered D items', () => {
    expect(trapSusceptibility(many(4, () => ({ key: 'D', choice: 'A' })))).toBeNull();
  });

  it('per trap: wrong ÷ answered for items carrying that trap', () => {
    const events = [
      ...many(5, (i) => ({ trap: 'negative_numbers', choice: i === 0 ? 'C' : 'A' })),
      ...many(2, () => ({ trap: 'zero', choice: 'B' })).map((e, i) => ({ ...e, position: 5 + i })),
      ev(7, { trap: null, choice: 'B' }),
    ];
    expect(trapSusceptibilityByTrap(events)).toEqual({
      negative_numbers: { attempted: 5, wrong: 1, rate: 1 / 5 },
      zero: { attempted: 2, wrong: 2, rate: null },
    });
  });
});

describe('false D rate', () => {
  it('is the share of A/B/C-key items answered D', () => {
    const events = [
      ...many(4, () => ({ key: 'B' })),
      ev(4, { key: 'C', choice: 'D' }),
      ev(5, { key: 'A', choice: 'D' }),
      ev(6, { key: 'D' }), // D key: not counted
      ev(7, { key: 'A', status: 'skipped' }),
    ];
    expect(falseDRate(events)).toBe(2 / 6);
  });

  it('is null below 5 answered A/B/C items', () => {
    expect(falseDRate(many(4, () => ({ key: 'B', choice: 'D' })))).toBeNull();
  });
});

describe('pace', () => {
  it('compares answers so far with the 30 s line at every 5-minute mark', () => {
    // Answers at 1, 2, …, 12 min → by 5 min: 5 (line 10, behind); by 10 min: 10 (line 20, behind).
    // Then a burst: 25 answers in minute 14 → by 15 min: 35 (line 30, on pace).
    const events = [
      ...many(12, (i) => ({ at: (i + 1) * MINUTE })),
      ...many(25, (i) => ({ at: 14 * MINUTE + i * 1000 })).map((e, i) => ({
        ...e,
        position: 12 + i,
      })),
    ];
    expect(paceMarks(events, { startedAt: 0, endedAt: 16 * MINUTE })).toEqual([
      { atMs: 5 * MINUTE, answered: 5, expected: 10, behind: true },
      { atMs: 10 * MINUTE, answered: 10, expected: 20, behind: true },
      { atMs: 15 * MINUTE, answered: 37, expected: 30, behind: false },
    ]);
  });

  it('counts an answer given exactly at a mark, and works from any start time', () => {
    const start = 1_000_000;
    const events = many(10, () => ({ at: start + 5 * MINUTE }));
    expect(paceMarks(events, { startedAt: start, endedAt: start + 6 * MINUTE })).toEqual([
      { atMs: 5 * MINUTE, answered: 10, expected: 10, behind: false },
    ]);
  });

  it('skips and unanswered items are not progress', () => {
    const events = many(10, () => ({ status: 'skipped', at: MINUTE }));
    expect(paceMarks(events, { startedAt: 0, endedAt: 5 * MINUTE })[0]?.answered).toBe(0);
  });

  it('has no marks for a session shorter than 5 minutes', () => {
    expect(
      paceMarks(
        many(3, () => ({})),
        { startedAt: 0, endedAt: 4 * MINUTE },
      ),
    ).toEqual([]);
  });
});

describe('stamina', () => {
  const session = { startedAt: 0, durationMs: 25 * MINUTE };

  it('compares accuracy in the first and last 10 minutes and gives a tip at a 15-point drop', () => {
    // First 10 min: 10 answers, 9 right (90%). Middle: ignored. Last 10 min (15–25): 10 answers, 7 right (70%).
    const events = [
      ...many(10, (i) => ({ at: (i + 0.5) * MINUTE, choice: i === 0 ? 'B' : 'A' })),
      ...many(5, () => ({ at: 12 * MINUTE, choice: 'B' })).map((e, i) => ({
        ...e,
        position: 10 + i,
      })),
      ...many(10, (i) => ({ at: (15.5 + i) * MINUTE, choice: i < 3 ? 'B' : 'A' })).map((e, i) => ({
        ...e,
        position: 15 + i,
      })),
    ];
    const result = stamina(events, session);
    expect(result?.first).toBeCloseTo(0.9);
    expect(result?.last).toBeCloseTo(0.7);
    expect(result?.dropPoints).toBeCloseTo(20);
    expect(result?.tip).toBe(true);
  });

  it('gives no tip for a drop under 15 points', () => {
    const events = [
      ...many(10, (i) => ({ at: (i + 0.5) * MINUTE })), // 100%
      ...many(10, (i) => ({ at: (15.5 + i) * MINUTE, choice: i < 1 ? 'B' : 'A' })).map((e, i) => ({
        ...e,
        position: 10 + i,
      })), // 90%
    ];
    expect(stamina(events, session)).toMatchObject({ dropPoints: 10, tip: false });
  });

  it('a drop of exactly 15 points earns the tip, despite floating point (0.95 − 0.8 is 0.1499…)', () => {
    const events = [
      ...many(20, (i) => ({ at: i * 25_000, choice: i < 1 ? 'B' : 'A' })), // 19/20 = 95%
      ...many(20, (i) => ({ at: 15 * MINUTE + i * 25_000, choice: i < 4 ? 'B' : 'A' })).map(
        (e, i) => ({ ...e, position: 20 + i }),
      ), // 16/20 = 80%
    ];
    expect(stamina(events, session)).toMatchObject({ dropPoints: 15, tip: true });
  });

  it('is null when either window has fewer than 5 answers', () => {
    const events = [
      ...many(10, (i) => ({ at: (i + 0.5) * MINUTE })),
      ...many(4, (i) => ({ at: (20 + i) * MINUTE })).map((e, i) => ({ ...e, position: 10 + i })),
    ];
    expect(stamina(events, session)).toBeNull();
  });

  it('is null for a session too short to have two separate 10-minute windows', () => {
    expect(
      stamina(
        many(20, (i) => ({ at: i * 1000 })),
        { startedAt: 0, durationMs: 15 * MINUTE },
      ),
    ).toBeNull();
  });
});

describe('skips', () => {
  it('counts skipped and unanswered items and the tags they carry', () => {
    const events = [
      ev(0, { status: 'skipped', tags: ['roots', 'exponents'] }),
      ev(1, { status: 'unanswered', tags: ['roots'] }),
      ev(2, { status: 'unanswered', tags: ['fractions'] }),
      ev(3, {}),
    ];
    expect(skips(events)).toEqual({
      skipped: 1,
      unanswered: 2,
      tags: { roots: 2, exponents: 1, fractions: 1 },
    });
  });

  it('is all zero for a fully answered session', () => {
    expect(skips(many(3, () => ({})))).toEqual({ skipped: 0, unanswered: 0, tags: {} });
  });
});

describe('empty history', () => {
  it('every metric copes with no events', () => {
    expect(accuracy([])).toBeNull();
    expect(accuracyBy([], 'tag')).toEqual({});
    expect(medianTimeBy([], 'level')).toEqual({});
    expect(trapSusceptibility([])).toBeNull();
    expect(trapSusceptibilityByTrap([])).toEqual({});
    expect(falseDRate([])).toBeNull();
    expect(slowEvents([])).toEqual([]);
    expect(paceMarks([], { startedAt: 0, endedAt: 25 * MINUTE })).toHaveLength(5);
    expect(stamina([], { startedAt: 0, durationMs: 25 * MINUTE })).toBeNull();
    expect(skips([])).toEqual({ skipped: 0, unanswered: 0, tags: {} });
  });
});

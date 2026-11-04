import { describe, expect, it } from 'vitest';
import { earnedBadges } from '../../src/core/analytics/badges.ts';
import { coach, type SessionRecord } from '../../src/core/analytics/coach.ts';
import type { Tag } from '../../src/core/questions/vocabulary.ts';
import type { AttemptEvent } from '../../src/core/session/attempt.ts';
import { ev, many, MINUTE } from '../fixtures/histories.ts';

const MOCK_MS = 25 * MINUTE;

/** A finished mock session at the end of `history`. */
function session(events: AttemptEvent[], overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    sessionId: 's1',
    mode: 'mock',
    startedAt: 0,
    durationMs: MOCK_MS,
    endReason: 'completed',
    events,
    ...overrides,
  };
}

/** Renumbers positions so several `many()` blocks form one session. */
function join(...blocks: AttemptEvent[][]): AttemptEvent[] {
  return blocks.flat().map((e, i) => ({ ...e, position: i }));
}

describe('coach: not enough data', () => {
  it('1. an empty history says so and suggests a full mock', () => {
    expect(coach([])).toEqual({ kind: 'not_enough_data', answered: 0, neededPerTopic: 5 });
  });

  it('2. 4 answers in each of three topics is still not enough for any claim', () => {
    const events = join(
      many(4, () => ({ tags: ['fractions'] })),
      many(4, () => ({ tags: ['roots'] })),
      many(4, () => ({ tags: ['percents'] })),
    );
    expect(coach([session(events)])).toMatchObject({ kind: 'not_enough_data', answered: 12 });
  });
});

describe('coach: strength, bottleneck, habit, drill', () => {
  it('3. a weak topic: strength and bottleneck each come with their number', () => {
    const events = join(
      many(10, (i) => ({ tags: ['fractions'], choice: i === 0 ? 'B' : 'A' })), // 9/10
      many(8, (i) => ({ tags: ['roots'], choice: i < 5 ? 'B' : 'A' })), // 3/8
    );
    const feedback = coach([session(events)]);
    expect(feedback).toMatchObject({
      kind: 'feedback',
      strength: { tag: 'fractions', correct: 9, attempted: 10 },
      bottleneck: { kind: 'tag', tag: 'roots', lost: 5 },
      drill: { kind: 'tag', tag: 'roots' },
    });
    if (feedback.kind !== 'feedback') throw new Error('expected feedback');
    expect(feedback.strengthText).toBe('Strongest spell: Fractions, 9 of 10 right (90%).');
    expect(feedback.bottleneckText).toBe('Biggest leak: Roots, 3 of 8 right (38%).');
    expect(feedback.habitText).toMatch(/shortcut/i);
  });

  it('4. a trap that keeps catching the student beats a topic with fewer misses', () => {
    const events = join(
      many(10, () => ({ tags: ['fractions'] })), // strength 10/10
      many(6, (i) => ({
        tags: ['inequalities'],
        trap: 'negative_numbers',
        choice: i < 5 ? 'B' : 'A',
      })),
      many(6, (i) => ({ tags: ['percents'], choice: i < 2 ? 'B' : 'A' })),
    );
    // Misses: trap negative_numbers 5, inequalities 5 (same answers), percents 2 → tie 5–5, the trap wins.
    const feedback = coach([session(events)]);
    expect(feedback).toMatchObject({
      bottleneck: { kind: 'trap', trap: 'negative_numbers', lost: 5 },
      drill: { kind: 'trap', trap: 'negative_numbers' },
      habitText: 'Test a negative.',
    });
    if (feedback.kind !== 'feedback') throw new Error('expected feedback');
    expect(feedback.bottleneckText).toBe(
      'Biggest leak: the negative numbers trap caught you 5 times in 6 (83%).',
    );
  });

  it('4b. a trap is named in words, not by its id', () => {
    const events = join(
      many(10, () => ({ tags: ['fractions'] })),
      many(5, () => ({ tags: ['exponents'], trap: 'fraction_0_1', choice: 'B' })),
    );
    const feedback = coach([session(events)]);
    if (feedback.kind !== 'feedback') throw new Error('expected feedback');
    expect(feedback.bottleneckText).toBe(
      'Biggest leak: the fractions between 0 and 1 trap caught you 5 times in 5 (100%).',
    );
  });

  it('5. missing "not enough information" questions teaches the four test values', () => {
    const events = join(
      many(10, () => ({ tags: ['fractions'] })),
      many(8, (i) => ({
        key: 'D',
        choice: i < 6 ? 'A' : 'D',
        tags: ['exponents', 'inequalities'],
        trap: i < 4 ? 'fraction_0_1' : 'zero',
      })),
    );
    // D misses 6 (4 fraction_0_1, 2 zero) beat trap fraction_0_1 (4), exponents/inequalities (6 each, tie: d_key wins).
    const feedback = coach([session(events)]);
    expect(feedback).toMatchObject({
      bottleneck: { kind: 'd_key', lost: 6, attempted: 8 },
      drill: { kind: 'trap', trap: 'fraction_0_1' },
    });
    if (feedback.kind !== 'feedback') throw new Error('expected feedback');
    expect(feedback.habitText).toMatch(/2, 0, −1 and ½/);
    expect(feedback.bottleneckText).toMatch(/6 of 8/);
  });

  it('6. choosing D too often is named as over-caution, with a drill in its most common topic', () => {
    const events = join(
      many(10, () => ({ tags: ['fractions'] })),
      many(7, (i) => ({ key: 'B', choice: 'D', tags: i < 5 ? ['ratios'] : ['decimals'] })),
      many(5, () => ({ key: 'B', tags: ['ratios'] })),
    );
    // False D: 7. ratios: 5 wrong of 10; decimals 2 wrong of 2 (no rate). 7 > 5.
    const feedback = coach([session(events)]);
    expect(feedback).toMatchObject({
      bottleneck: { kind: 'false_d', lost: 7, attempted: 22 },
      drill: { kind: 'tag', tag: 'ratios' },
    });
    if (feedback.kind !== 'feedback') throw new Error('expected feedback');
    expect(feedback.habitText).toMatch(/only when two test values disagree/);
  });

  it('7. questions left at time-out are named as the bottleneck when they cost the most', () => {
    const events = join(
      many(12, () => ({ tags: ['fractions'] })),
      many(9, (i) => ({ status: 'unanswered', tags: i < 6 ? ['geometry'] : ['roots'] })),
    );
    const feedback = coach([session(events, { endReason: 'time_up' })]);
    expect(feedback).toMatchObject({
      bottleneck: { kind: 'time', lost: 9 },
      drill: { kind: 'tag', tag: 'geometry' },
    });
    if (feedback.kind !== 'feedback') throw new Error('expected feedback');
    expect(feedback.bottleneckText).toBe('Biggest leak: 9 questions were left when time ran out.');
    expect(feedback.habitText).toMatch(/30 seconds/);
  });

  it('7b. questions left after finishing early are not lost to the clock', () => {
    const events = join(
      many(12, () => ({ tags: ['fractions'] })),
      many(6, (i) => ({ tags: ['roots'], choice: i < 2 ? 'B' : 'A' })),
      many(9, () => ({ status: 'unanswered', tags: ['geometry'] })),
    );
    expect(coach([session(events, { endReason: 'completed' })])).toMatchObject({
      bottleneck: { kind: 'tag', tag: 'roots', lost: 2 },
    });
  });

  it('8. a stamina drop in the last 10 minutes is named with both percentages', () => {
    // First 10 min: 10/10. Last 10 min: 6 of 10 spread over five topics (2 answers each, too few for a topic
    // claim), so no topic can beat the 8-question stamina loss.
    const lastTopics: Tag[] = ['roots', 'percents', 'ratios', 'decimals', 'averages'];
    const events = join(
      many(10, (i) => ({ at: (i + 0.5) * MINUTE, tags: ['fractions'] })),
      many(10, (i) => ({
        at: (15.5 + i) * MINUTE,
        tags: [lastTopics[i % 5] ?? 'roots'],
        choice: i < 4 ? 'B' : 'A',
      })),
    );
    const feedback = coach([session(events)]);
    expect(feedback).toMatchObject({ bottleneck: { kind: 'stamina', lost: 8 } });
    if (feedback.kind !== 'feedback') throw new Error('expected feedback');
    expect(feedback.bottleneckText).toBe(
      'Biggest leak: your accuracy fell from 100% in the first 10 minutes to 60% in the last 10.',
    );
    expect(feedback.habitText).toMatch(/last 10 minutes/);
  });

  it('9. nothing missed turns the bottleneck into a challenge one level up', () => {
    const events = join(
      many(6, () => ({ tags: ['fractions'], level: 2 })),
      many(6, () => ({ tags: ['roots'], level: 3 })),
    );
    const feedback = coach([session(events)]);
    expect(feedback).toMatchObject({
      bottleneck: { kind: 'challenge', lost: 0 },
      drill: { kind: 'level', level: 4 },
    });
    if (feedback.kind !== 'feedback') throw new Error('expected feedback');
    expect(feedback.bottleneckText).toBe('Nothing slipped: 12 of 12 right.');
  });

  it('10. the challenge drill never goes past level 5', () => {
    const feedback = coach([session(many(6, () => ({ level: 5 })))]);
    expect(feedback).toMatchObject({ drill: { kind: 'level', level: 5 } });
  });

  it('11. the strength topic is never also the bottleneck', () => {
    // Only one topic has data: it is the strength, so its 2 misses can't be the bottleneck → challenge.
    const events = many(10, (i) => ({ tags: ['fractions'], choice: i < 2 ? 'B' : 'A' }));
    const feedback = coach([session(events)]);
    expect(feedback).toMatchObject({
      strength: { tag: 'fractions' },
      bottleneck: { kind: 'challenge' },
    });
    // Two answers were wrong, so "nothing slipped" would be untrue.
    if (feedback.kind !== 'feedback') throw new Error('expected feedback');
    expect(feedback.bottleneckText).toBe('No single leak stands out yet: 8 of 10 right overall.');
  });

  it('12. equal accuracy: the topic with more answers is the strength', () => {
    const events = join(
      many(5, (i) => ({ tags: ['roots'], choice: i === 0 ? 'B' : 'A' })), // 4/5 = 80%
      many(10, (i) => ({ tags: ['percents'], choice: i < 2 ? 'B' : 'A' })), // 8/10 = 80%
    );
    expect(coach([session(events)])).toMatchObject({ strength: { tag: 'percents' } });
  });

  it('13. uses every session in the history, and time/stamina from the latest mock only', () => {
    const old = session(
      join(
        many(10, () => ({ tags: ['fractions'] })),
        many(9, () => ({ status: 'unanswered' })),
      ),
      { sessionId: 'old', endReason: 'time_up' },
    );
    const latest = session(
      many(6, (i) => ({ tags: ['roots'], choice: i < 3 ? 'B' : 'A' })),
      {
        sessionId: 'new',
        startedAt: 30 * MINUTE,
      },
    );
    // The old mock's 9 time-outs are history; the latest mock had none, so roots (3 lost) is the bottleneck.
    expect(coach([old, latest])).toMatchObject({
      strength: { tag: 'fractions', attempted: 10 },
      bottleneck: { kind: 'tag', tag: 'roots', lost: 3 },
    });
  });
});

describe('coach: edge cases', () => {
  it('with no right answer anywhere, the strength is the effort, never "0 of 8 right"', () => {
    const events = join(
      many(8, () => ({ tags: ['inequalities'], choice: 'B' })),
      many(6, () => ({ tags: ['roots'], choice: 'C' })),
    );
    const feedback = coach([session(events)]);
    expect(feedback).toMatchObject({
      kind: 'feedback',
      strength: { kind: 'effort', answered: 14 },
    });
    if (feedback.kind !== 'feedback') throw new Error('expected feedback');
    expect(feedback.strengthText).toBe('Strongest spell: you answered 14 of 14 questions.');
    // Every topic is now a candidate leak; the bigger one wins.
    expect(feedback.bottleneck).toMatchObject({ kind: 'tag', tag: 'inequalities', lost: 8 });
  });

  it('the screen can name the latest session, whatever the start times say', () => {
    const shown = session(
      many(12, () => ({ tags: ['fractions'] })),
      { sessionId: 'shown', startedAt: 0 },
    );
    const older = session(
      join(
        many(6, () => ({ tags: ['roots'] })),
        many(9, () => ({ status: 'unanswered' })),
      ),
      {
        sessionId: 'older',
        startedAt: 1e12, // e.g. saved on a different clock
        endReason: 'time_up',
      },
    );
    expect(coach([older, shown], { latestSessionId: 'shown' })).toMatchObject({
      bottleneck: { kind: 'challenge' },
    });
  });

  it('works on a drill-only history: no time or stamina claims without a finished mock', () => {
    const drill = session(
      join(
        many(10, () => ({ tags: ['fractions'] })),
        many(6, (i) => ({ tags: ['roots'], choice: i < 2 ? 'B' : 'A' })),
      ),
      { mode: 'drill', durationMs: null },
    );
    expect(coach([drill])).toMatchObject({ bottleneck: { kind: 'tag', tag: 'roots', lost: 2 } });
  });

  it('with only "not enough information" questions there is no false-D claim', () => {
    const events = many(10, (i) => ({
      key: 'D',
      tags: ['inequalities'],
      choice: i < 3 ? 'A' : 'D',
    }));
    // The only topic is the strength; the 3 D misses are the bottleneck.
    expect(coach([session(events)])).toMatchObject({ bottleneck: { kind: 'd_key', lost: 3 } });
  });

  it('missed D questions without traps get a level-3 drill', () => {
    const events = join(
      many(10, () => ({ tags: ['fractions'] })),
      many(6, (i) => ({ key: 'D', tags: ['inequalities'], choice: i < 4 ? 'B' : 'D' })),
    );
    expect(coach([session(events)])).toMatchObject({
      bottleneck: { kind: 'd_key', lost: 4 },
      drill: { kind: 'level', level: 3 },
    });
  });

  it('finds the latest mock whatever the order of the history', () => {
    const latest = session(
      many(12, () => ({ tags: ['fractions'] })),
      {
        sessionId: 'new',
        startedAt: 30 * MINUTE,
      },
    );
    const old = session(
      join(
        many(6, () => ({ tags: ['roots'] })),
        many(9, () => ({ status: 'unanswered' })),
      ),
      {
        sessionId: 'old',
        endReason: 'time_up',
      },
    );
    // Newest first: the old time-outs must still not count as the latest mock's.
    expect(coach([latest, old])).toMatchObject({ bottleneck: { kind: 'challenge' } });
  });
});

describe('habit badges', () => {
  it('counts several finished trials in the evidence', () => {
    const badges = earnedBadges([
      session(
        many(3, () => ({})),
        { sessionId: 'a' },
      ),
      session(
        many(3, () => ({})),
        { sessionId: 'b', startedAt: 30 * MINUTE },
      ),
    ]);
    expect(badges.find((b) => b.id === 'first_trial')?.evidence).toBe('2 Grand Trials finished');
    expect(badges.find((b) => b.id === 'finished_in_time')?.evidence).toBe(
      '2 Grand Trials with every question reached',
    );
  });

  it('an early finish with questions left is not "steady pace" past the last answer', () => {
    // 12 answers every 25 s (5 min), then finished with 3 left: one mark at 5 min, on pace.
    const early = session(
      join(
        many(12, (i) => ({ at: (i + 1) * 25_000 })),
        many(3, () => ({ status: 'unanswered' })),
      ),
      { endReason: 'completed' },
    );
    const ids = earnedBadges([early]).map((b) => b.id);
    expect(ids).toContain('steady_pace');
    expect(ids).not.toContain('finished_in_time');
  });

  it('a first finished trial earns the first badge', () => {
    expect(earnedBadges([session(many(3, () => ({})))]).map((b) => b.id)).toContain('first_trial');
  });

  it('no badges for an empty history', () => {
    expect(earnedBadges([])).toEqual([]);
  });

  it('finishing a mock with nothing left unanswered earns "finished in time"', () => {
    const done = session(
      many(5, () => ({})),
      { endReason: 'time_up' },
    );
    const left = session(
      join(
        many(5, () => ({})),
        [ev(5, { status: 'unanswered' })],
      ),
      {
        endReason: 'time_up',
      },
    );
    expect(earnedBadges([done]).map((b) => b.id)).toContain('finished_in_time');
    expect(earnedBadges([left]).map((b) => b.id)).not.toContain('finished_in_time');
  });

  it('being on pace at every 5-minute mark of a mock earns "steady pace"', () => {
    // One answer every 25 s for 25 minutes: 60 answers, always ahead of the 30 s line.
    const steady = session(
      many(60, (i) => ({ at: (i + 1) * 25_000 })),
      { endReason: 'completed' },
    );
    const slow = session(
      many(40, (i) => ({ at: (i + 1) * 37_000 })),
      { endReason: 'time_up' },
    );
    expect(earnedBadges([steady]).map((b) => b.id)).toContain('steady_pace');
    expect(earnedBadges([slow]).map((b) => b.id)).not.toContain('steady_pace');
  });

  it('5 right answers on negative-number traps earn "negative tester", with the evidence', () => {
    const events = many(5, () => ({ trap: 'negative_numbers' }));
    const badge = earnedBadges([session(events)]).find((b) => b.id === 'negative_tester');
    expect(badge).toMatchObject({ evidence: '5 negative-number traps beaten' });
    expect(
      earnedBadges([session(many(4, () => ({ trap: 'negative_numbers' })))]).map((b) => b.id),
    ).not.toContain('negative_tester');
  });

  it('80% or better on at least 10 "not enough information" questions earns "D detector"', () => {
    const good = many(10, (i) => ({ key: 'D', choice: i < 2 ? 'A' : 'D' })); // 8/10
    const few = many(9, () => ({ key: 'D' }));
    const weak = many(10, (i) => ({ key: 'D', choice: i < 3 ? 'A' : 'D' })); // 7/10
    expect(earnedBadges([session(good)]).map((b) => b.id)).toContain('d_detector');
    expect(earnedBadges([session(few)]).map((b) => b.id)).not.toContain('d_detector');
    expect(earnedBadges([session(weak)]).map((b) => b.id)).not.toContain('d_detector');
  });

  it('drills and unfinished sessions do not earn mock badges', () => {
    const drill = session(
      many(10, () => ({})),
      { mode: 'drill', durationMs: null },
    );
    const running = session(
      many(10, () => ({})),
      { endReason: null },
    );
    expect(earnedBadges([drill, running]).map((b) => b.id)).toEqual([]);
  });
});

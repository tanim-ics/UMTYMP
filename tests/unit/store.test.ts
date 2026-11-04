import { describe, expect, it } from 'vitest';
import { EXAM } from '../../src/core/config/exam.ts';
import type { QuestionItem } from '../../src/core/questions/schema.ts';
import { createFakeClock } from '../../src/core/timer/clock.ts';
import { remainingMs } from '../../src/core/timer/session.ts';
import { createSessionStore } from '../../src/store/session.ts';

const bank: QuestionItem[] = [1, 2, 3].map((n) => ({
  id: `test-${String(n).padStart(4, '0')}`,
  quantity_a: '1',
  quantity_b: '2',
  condition: null,
  correct_answer: 'B',
  tags: ['arithmetic'],
  difficulty: 1,
  target_seconds: 5,
  shortcut_explanation: 'Look.',
  full_explanation: 'Proof.',
  reviewed_by: 'test',
}));

function setup() {
  const clock = createFakeClock(1000);
  const store = createSessionStore(clock);
  return { clock, store, s: () => store.getState() };
}

describe('session store', () => {
  it('starts with no trial', () => {
    expect(setup().s().trial).toBeNull();
  });

  it('starts a mock from the bank with the exam duration', () => {
    const { s } = setup();
    s().startMock(bank, 7);
    const trial = s().trial;
    expect(trial?.mode).toBe('mock');
    expect(trial?.items).toHaveLength(3);
    expect(trial?.timer.durationMs).toBe(EXAM.durationMs);
    expect(trial?.sessionId).toMatch(/^mock-/);
  });

  it('gives each mock its own session id', () => {
    const { s } = setup();
    s().startMock(bank, 7);
    const first = s().trial?.sessionId;
    s().startMock(bank, 7);
    expect(s().trial?.sessionId).not.toBe(first);
  });

  it('does not start a mock from an empty bank', () => {
    const { s } = setup();
    s().startMock([], 1);
    expect(s().trial).toBeNull();
  });

  it('stamps every action with the clock reading', () => {
    const { clock, s } = setup();
    s().startMock(bank, 1);
    clock.advance(4000);
    s().answer('B');
    expect(s().trial?.events[0]).toMatchObject({ shownAt: 1000, answeredAt: 5000, correct: true });
  });

  it('moves, skips, flags and finishes through the trial rules', () => {
    const { s } = setup();
    s().startMock(bank, 1);
    s().flag();
    s().skip();
    expect(s().trial?.index).toBe(1);
    s().next();
    s().back();
    expect(s().trial?.index).toBe(1);
    s().finish();
    expect(s().trial?.endReason).toBe('completed');
    expect(s().trial?.events[0]).toMatchObject({ status: 'skipped', flagged: true });
  });

  it('tick updates the shown time and ends the mock when time is up', () => {
    const { clock, s } = setup();
    s().startMock(bank, 1);
    clock.advance(60_000);
    s().tick();
    const trial = s().trial;
    expect(trial && remainingMs(trial.timer, s().now)).toBe(EXAM.durationMs - 60_000);
    clock.advance(EXAM.durationMs);
    s().tick();
    expect(s().trial?.endReason).toBe('time_up');
  });

  it('records a hidden tab without stopping the clock', () => {
    const { clock, s } = setup();
    s().startMock(bank, 1);
    s().setHidden(true);
    clock.advance(30_000);
    s().setHidden(false);
    expect(s().trial?.timer.hiddenCount).toBe(1);
    expect(s().trial?.timer.hiddenMs).toBe(30_000);
  });

  it('ends a mock whose time ran out while the tab was hidden, on return', () => {
    const { clock, s } = setup();
    s().startMock(bank, 1);
    s().setHidden(true);
    clock.advance(EXAM.durationMs + 1);
    s().setHidden(false);
    expect(s().trial?.endReason).toBe('time_up');
  });

  it('actions without a trial do nothing', () => {
    const { s } = setup();
    for (const act of [
      () => s().answer('A'),
      s().skip,
      s().next,
      s().back,
      s().flag,
      s().finish,
      s().tick,
      () => s().setHidden(true),
    ]) {
      act();
    }
    expect(s().trial).toBeNull();
  });

  it('reset returns to no trial', () => {
    const { s } = setup();
    s().startMock(bank, 1);
    s().reset();
    expect(s().trial).toBeNull();
  });

  it('a potion drill from the results keeps the mock to come back to', () => {
    const { s } = setup();
    s().startMock(bank, 1);
    s().finish();
    const mock = s().trial;
    s().startDrill(bank, { kind: 'tag', tag: 'arithmetic' }, 2);
    expect(s().trial?.mode).toBe('drill');
    expect(s().trial?.timer.durationMs).toBeNull();
    expect(s().trial?.items).toHaveLength(3);
    expect(s().returnTo).toBe(mock);
    s().finish();
    s().backToResults();
    expect(s().trial).toBe(mock);
    expect(s().returnTo).toBeNull();
  });

  it('a drill started from home has nothing to go back to', () => {
    const { s } = setup();
    s().startDrill(bank, { kind: 'level', level: 1 }, 2);
    expect(s().returnTo).toBeNull();
    s().finish();
    s().backToResults();
    expect(s().trial).toBeNull();
  });

  it('does not start a drill with no matching questions', () => {
    const { s } = setup();
    s().startDrill(bank, { kind: 'tag', tag: 'geometry' }, 2);
    expect(s().trial).toBeNull();
  });

  it('pauses and resumes a drill on the clock', () => {
    const { clock, s } = setup();
    s().startDrill(bank, { kind: 'level', level: 1 }, 2);
    s().pause();
    expect(s().trial?.timer.pausedAt).toBe(clock.now());
    clock.advance(5000);
    s().unpause();
    expect(s().trial?.timer.pausedMs).toBe(5000);
  });

  it('reset also forgets the mock kept for later', () => {
    const { s } = setup();
    s().startMock(bank, 1);
    s().finish();
    s().startDrill(bank, { kind: 'level', level: 1 }, 2);
    s().reset();
    expect(s().returnTo).toBeNull();
  });

  it('starts untimed practice from the chosen filters', () => {
    const { s } = setup();
    s().startPractice(bank, { levels: [1], length: 5, timed: false }, 3);
    expect(s().trial?.mode).toBe('practice');
    expect(s().trial?.timer.durationMs).toBeNull();
    expect(s().trial?.items).toHaveLength(3); // the bank only has 3
  });

  it('timed practice gets 30 s per question', () => {
    const { s } = setup();
    s().startPractice(bank, { length: 5, timed: true }, 3);
    expect(s().trial?.timer.durationMs).toBe(3 * 30_000);
  });

  it('does not start practice when nothing matches', () => {
    const { s } = setup();
    s().startPractice(bank, { tags: ['geometry'], length: 5, timed: false }, 3);
    expect(s().trial).toBeNull();
  });

  it('switching profile forgets the session on screen', () => {
    const { s } = setup();
    s().startMock(bank, 1);
    s().setProfile('ali');
    expect(s().profileId).toBe('ali');
    expect(s().trial).toBeNull();
  });
});

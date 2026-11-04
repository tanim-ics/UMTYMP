import { describe, expect, it } from 'vitest';
import {
  answerItem,
  backItem,
  finishTrial,
  nextItem,
  pauseTrial,
  resumeTrial,
  skipItem,
  startTrial,
  tickTrial,
  toggleFlag,
  type TrialState,
} from '../../src/core/session/trial.ts';
import type { QuestionItem } from '../../src/core/questions/schema.ts';
import type { Answer, Level } from '../../src/core/questions/vocabulary.ts';

const MOCK_MS = 25 * 60_000;

function item(n: number, key: Answer = 'A', level: Level = 1): QuestionItem {
  return {
    id: `test-${String(n).padStart(4, '0')}`,
    quantity_a: '1',
    quantity_b: '2',
    condition: null,
    correct_answer: key,
    tags: ['arithmetic'],
    trap: key === 'D' ? 'zero' : null,
    difficulty: level,
    target_seconds: 5,
    shortcut_explanation: 'Look.',
    full_explanation: 'Proof.',
    reviewed_by: 'test',
  };
}

const items = [item(1, 'A', 1), item(2, 'B', 3), item(3, 'D', 5)];

function start(now = 0): TrialState {
  return startTrial({ sessionId: 's1', mode: 'mock', items, durationMs: MOCK_MS }, now);
}

describe('startTrial', () => {
  it('shows the first item with nothing answered', () => {
    const trial = start(100);
    expect(trial.index).toBe(0);
    expect(trial.shownAt).toBe(100);
    expect(trial.events).toEqual([]);
    expect(trial.endReason).toBeNull();
  });

  it('refuses an empty item list', () => {
    expect(() =>
      startTrial({ sessionId: 's', mode: 'mock', items: [], durationMs: MOCK_MS }, 0),
    ).toThrow(/at least one item/);
  });
});

describe('answering', () => {
  it('creates an AttemptEvent with time, key, level and position', () => {
    const trial = answerItem(start(1000), 'A', 4000);
    expect(trial.events).toEqual([
      {
        sessionId: 's1',
        mode: 'mock',
        itemId: 'test-0001',
        position: 0,
        level: 1,
        tags: ['arithmetic'],
        trap: null,
        correctAnswer: 'A',
        choice: 'A',
        status: 'answered',
        correct: true,
        shownAt: 1000,
        answeredAt: 4000,
        answerChanges: 0,
        flagged: false,
      },
    ]);
  });

  it('marks a wrong answer as not correct', () => {
    const trial = answerItem(start(), 'C', 10);
    expect(trial.events[0]).toMatchObject({ choice: 'C', correct: false });
  });

  it('updates the same event when the answer changes, and counts the change', () => {
    let trial = answerItem(start(), 'B', 10);
    trial = answerItem(trial, 'A', 20);
    trial = answerItem(trial, 'A', 30); // the same letter again is not a new decision
    expect(trial.events).toHaveLength(1);
    expect(trial.events[0]).toMatchObject({
      choice: 'A',
      correct: true,
      answerChanges: 1,
      answeredAt: 20,
    });
  });

  it('times an answer from when the item was last shown', () => {
    let trial = nextItem(start(0), 5000); // item 2 shown at 5 s
    trial = backItem(trial, 9000); // item 1 shown again at 9 s
    trial = answerItem(trial, 'A', 12_000);
    expect(trial.events[0]).toMatchObject({ shownAt: 9000, answeredAt: 12_000 });
  });

  it('leaves the state alone (immutable)', () => {
    const trial = start();
    const before = JSON.stringify(trial);
    answerItem(trial, 'A', 10);
    expect(JSON.stringify(trial)).toBe(before);
  });
});

describe('moving between items', () => {
  it('next and back move one item and stop at the ends', () => {
    let trial = start();
    trial = backItem(trial, 1);
    expect(trial.index).toBe(0);
    trial = nextItem(nextItem(nextItem(trial, 2), 3), 4);
    expect(trial.index).toBe(2);
    expect(trial.shownAt).toBe(3);
  });

  it('skip records a skipped event and moves on', () => {
    const trial = skipItem(start(0), 2500);
    expect(trial.index).toBe(1);
    expect(trial.events[0]).toMatchObject({
      itemId: 'test-0001',
      status: 'skipped',
      choice: null,
      correct: false,
      answeredAt: 2500,
    });
  });

  it('skip does not erase an answer already given', () => {
    const trial = skipItem(answerItem(start(), 'A', 10), 20);
    expect(trial.events[0]).toMatchObject({ status: 'answered', choice: 'A' });
    expect(trial.index).toBe(1);
  });

  it('answering a skipped item turns it into an answer', () => {
    let trial = skipItem(start(), 10);
    trial = answerItem(backItem(trial, 20), 'A', 30);
    expect(trial.events).toHaveLength(1);
    expect(trial.events[0]).toMatchObject({ status: 'answered', answerChanges: 0 });
  });

  it('flags and unflags the current item; the flag shows on its event', () => {
    let trial = toggleFlag(start());
    expect(trial.flags[0]).toBe(true);
    trial = answerItem(trial, 'A', 10);
    expect(trial.events[0]?.flagged).toBe(true);
    trial = toggleFlag(trial);
    expect(trial.events[0]?.flagged).toBe(false);
  });
});

describe('ending the trial', () => {
  it('finishing records every unanswered item and stops input', () => {
    let trial = answerItem(start(0), 'A', 10);
    trial = finishTrial(trial, 'completed');
    expect(trial.endReason).toBe('completed');
    expect(trial.events.map((e) => e.status)).toEqual(['answered', 'unanswered', 'unanswered']);
    expect(trial.events[1]).toMatchObject({
      choice: null,
      correct: false,
      answeredAt: null,
      shownAt: null,
    });

    const after = answerItem(trial, 'B', 60);
    expect(after).toBe(trial);
    expect(nextItem(trial, 60)).toBe(trial);
    expect(skipItem(trial, 60)).toBe(trial);
    expect(toggleFlag(trial)).toBe(trial);
    expect(finishTrial(trial, 'time_up')).toBe(trial);
  });

  it('an unanswered item that was seen keeps when it was shown', () => {
    const trial = finishTrial(nextItem(start(0), 400), 'completed');
    expect(trial.events[1]).toMatchObject({ status: 'unanswered', shownAt: 400 });
  });

  it('time-up ends a mock on the next tick', () => {
    let trial = answerItem(start(0), 'A', 10);
    trial = tickTrial(trial, MOCK_MS - 1);
    expect(trial.endReason).toBeNull();
    trial = tickTrial(trial, MOCK_MS + 30);
    expect(trial.endReason).toBe('time_up');
    expect(trial.events).toHaveLength(3);
    expect(trial.events.filter((e) => e.status === 'unanswered')).toHaveLength(2);
  });

  it('a tick before time-up returns the same state', () => {
    const trial = start();
    expect(tickTrial(trial, 1000)).toBe(trial);
  });

  it('all items skipped still gives one event per item', () => {
    let trial = start();
    trial = skipItem(skipItem(skipItem(trial, 1), 2), 3);
    trial = finishTrial(trial, 'completed');
    expect(trial.events.map((e) => e.status)).toEqual(['skipped', 'skipped', 'skipped']);
  });

  it('events are ordered by position', () => {
    let trial = nextItem(nextItem(start(), 1), 2);
    trial = answerItem(trial, 'D', 3);
    trial = answerItem(backItem(backItem(trial, 4), 5), 'A', 6);
    expect(trial.events.map((e) => e.position)).toEqual([0, 2]);
  });
});

describe('drills: pause and the answer lock', () => {
  function drill(now = 0) {
    return startTrial({ sessionId: 'd1', mode: 'drill', items, durationMs: null }, now);
  }

  it('a mock cannot pause', () => {
    expect(() => pauseTrial(start(), 10)).toThrow(/mock/i);
  });

  it('time per question leaves out the pause', () => {
    let trial = drill(0);
    trial = pauseTrial(trial, 4000); // 4 s of thinking, then a 60 s break
    trial = resumeTrial(trial, 64_000);
    trial = answerItem(trial, 'A', 70_000); // 6 more seconds
    const e = trial.events[0];
    expect(e && e.answeredAt !== null && e.shownAt !== null && e.answeredAt - e.shownAt).toBe(
      10_000,
    );
  });

  it('nothing can be answered, skipped, moved or flagged while paused', () => {
    const paused = pauseTrial(drill(0), 1000);
    expect(answerItem(paused, 'A', 2000)).toBe(paused);
    expect(skipItem(paused, 2000)).toBe(paused);
    expect(nextItem(paused, 2000)).toBe(paused);
    expect(backItem(paused, 2000)).toBe(paused);
    expect(toggleFlag(paused)).toBe(paused);
  });

  it('pausing twice or resuming a running drill changes nothing', () => {
    const running = drill(0);
    expect(resumeTrial(running, 10)).toBe(running);
    const paused = pauseTrial(running, 10);
    expect(pauseTrial(paused, 20)).toBe(paused);
  });

  it('a finished drill cannot pause or resume', () => {
    const done = finishTrial(drill(0), 'completed');
    expect(pauseTrial(done, 10)).toBe(done);
    expect(resumeTrial(done, 10)).toBe(done);
  });

  it('a drill answer is final once given, because the shortcut is shown right after', () => {
    const answered = answerItem(drill(0), 'B', 1000);
    expect(answerItem(answered, 'A', 2000)).toBe(answered);
  });

  it('a mock answer can still be changed', () => {
    const changed = answerItem(answerItem(start(0), 'B', 1000), 'A', 2000);
    expect(changed.events[0]?.choice).toBe('A');
  });
});

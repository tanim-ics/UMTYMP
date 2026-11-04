import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { EXAM } from '../../src/core/config/exam.ts';
import type { QuestionItem } from '../../src/core/questions/schema.ts';
import {
  answerItem,
  finishTrial,
  nextItem,
  skipItem,
  startTrial,
  toggleFlag,
  type TrialState,
} from '../../src/core/session/trial.ts';
import { createFakeClock } from '../../src/core/timer/clock.ts';
import { markHidden, remainingMs } from '../../src/core/timer/session.ts';
import { connectPersistence, createAttemptRepo } from '../../src/data/attempts.ts';
import { openDb, type UmtympDb } from '../../src/data/db.ts';
import { createSessionStore } from '../../src/store/session.ts';

const bank: QuestionItem[] = [1, 2, 3, 4].map((n) => ({
  id: `test-${String(n).padStart(4, '0')}`,
  quantity_a: '1',
  quantity_b: '2',
  condition: null,
  correct_answer: 'B',
  tags: ['arithmetic'],
  trap: null,
  difficulty: 1,
  target_seconds: 5,
  shortcut_explanation: 'Look.',
  full_explanation: 'Proof.',
  reviewed_by: 'test',
}));

const opened: UmtympDb[] = [];
/** A fresh, empty in-memory IndexedDB for every test. */
function freshDb(): UmtympDb {
  const db = openDb('test', { indexedDB: new IDBFactory(), IDBKeyRange });
  opened.push(db);
  return db;
}
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});

function mock(id: string, now = 1000, items = bank.slice(0, 3)): TrialState {
  return startTrial({ sessionId: id, mode: 'mock', items, durationMs: EXAM.durationMs }, now);
}

describe('database schema v1', () => {
  it('has the profiles, sessions and attempts tables at version 1', async () => {
    const db = freshDb();
    await db.open();
    expect(db.verno).toBe(1);
    expect(db.tables.map((t) => t.name).sort()).toEqual(['attempts', 'profiles', 'sessions']);
  });

  it('keys attempts by session and position, so one item has one row per session', async () => {
    const db = freshDb();
    await db.open();
    expect(db.attempts.schema.primKey.keyPath).toEqual(['sessionId', 'position']);
  });
});

describe('attempt repository', () => {
  it('saves a trial and loads it back exactly', async () => {
    const repo = createAttemptRepo(freshDb());
    let trial = answerItem(mock('m1'), 'B', 2000);
    trial = toggleFlag(nextItem(trial, 3000));
    trial = { ...trial, timer: markHidden(trial.timer, 3500) };
    await repo.saveTrial(trial, 'p1');
    expect(await repo.loadActive(bank, 'p1')).toEqual(trial);
  });

  it('saves every answer as an attempt row', async () => {
    const db = freshDb();
    const repo = createAttemptRepo(db);
    // Answer item 1, move to item 2, skip it.
    await repo.saveTrial(skipItem(nextItem(answerItem(mock('m1'), 'B', 2000), 2200), 2500), 'p1');
    const rows = await db.attempts.where('sessionId').equals('m1').sortBy('position');
    expect(rows.map((r) => [r.itemId, r.status, r.choice])).toEqual([
      ['test-0001', 'answered', 'B'],
      ['test-0002', 'skipped', null],
    ]);
  });

  it('a changed answer updates its row instead of adding one', async () => {
    const db = freshDb();
    const repo = createAttemptRepo(db);
    const first = answerItem(mock('m1'), 'A', 2000);
    await repo.saveTrial(first, 'p1');
    await repo.saveTrial(answerItem(first, 'B', 3000), 'p1');
    const rows = await db.attempts.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ choice: 'B', answerChanges: 1 });
  });

  it('returns null when there is no unfinished session', async () => {
    const repo = createAttemptRepo(freshDb());
    expect(await repo.loadActive(bank, 'p1')).toBeNull();
    await repo.saveTrial(finishTrial(mock('m1'), 'completed'), 'p1');
    expect(await repo.loadActive(bank, 'p1')).toBeNull();
  });

  it('resumes the newest unfinished session', async () => {
    const repo = createAttemptRepo(freshDb());
    await repo.saveTrial(mock('old', 1000), 'p1');
    await repo.saveTrial(mock('new', 5000), 'p1');
    expect((await repo.loadActive(bank, 'p1'))?.sessionId).toBe('new');
  });

  it('does not resume a session whose items are no longer in the bank', async () => {
    const repo = createAttemptRepo(freshDb());
    await repo.saveTrial(mock('m1'), 'p1');
    expect(await repo.loadActive(bank.slice(1), 'p1')).toBeNull();
  });

  it('lists finished mocks newest first with their score', async () => {
    const repo = createAttemptRepo(freshDb());
    await repo.saveTrial(
      finishTrial(answerItem(mock('first', 1000), 'B', 1500), 'completed'),
      'p1',
    );
    await repo.saveTrial(finishTrial(mock('second', 9000, bank.slice(1, 4)), 'time_up'), 'p1');
    await repo.saveTrial(mock('running', 20_000), 'p1');
    const list = await repo.listFinished('p1');
    expect(list).toEqual([
      {
        sessionId: 'second',
        startedAt: 9000,
        total: 3,
        correct: 0,
        endReason: 'time_up',
        itemIds: ['test-0002', 'test-0003', 'test-0004'],
      },
      {
        sessionId: 'first',
        startedAt: 1000,
        total: 3,
        correct: 1,
        endReason: 'completed',
        itemIds: ['test-0001', 'test-0002', 'test-0003'],
      },
    ]);
  });

  it('lists only mocks', async () => {
    const repo = createAttemptRepo(freshDb());
    const drill = startTrial(
      { sessionId: 'd1', mode: 'drill', items: bank, durationMs: null },
      1000,
    );
    await repo.saveTrial(finishTrial(drill, 'completed'), 'p1');
    expect(await repo.listFinished('p1')).toEqual([]);
  });
});

describe('history for the coach', () => {
  it('returns finished sessions of every mode, oldest first, with their events', async () => {
    const repo = createAttemptRepo(freshDb());
    const drill = startTrial(
      { sessionId: 'd1', mode: 'drill', items: bank, durationMs: null },
      5000,
    );
    await repo.saveTrial(finishTrial(answerItem(drill, 'B', 6000), 'completed'), 'p1');
    await repo.saveTrial(finishTrial(answerItem(mock('m1', 1000), 'B', 2000), 'time_up'), 'p1');
    await repo.saveTrial(mock('running', 9000), 'p1');
    const history = await repo.listHistory('p1');
    expect(history.map((h) => [h.sessionId, h.mode, h.endReason, h.events.length])).toEqual([
      ['m1', 'mock', 'time_up', 3],
      ['d1', 'drill', 'completed', 4],
    ]);
    expect(history[0]).toMatchObject({ startedAt: 1000, durationMs: EXAM.durationMs });
    expect(history[1]?.durationMs).toBeNull();
  });

  it('is empty before anything is finished', async () => {
    expect(await createAttemptRepo(freshDb()).listHistory('p1')).toEqual([]);
  });
});

describe('saving from the live store', () => {
  function setup(repo = createAttemptRepo(freshDb())) {
    const clock = createFakeClock(1000);
    const store = createSessionStore(clock);
    store.getState().setProfile('p1');
    const errors: unknown[] = [];
    const persistence = connectPersistence(store, repo, (e) => errors.push(e));
    return { clock, store, repo, persistence, errors, s: () => store.getState() };
  }

  it('saves after every answer, as it happens', async () => {
    const { s, repo, persistence } = setup();
    s().startMock(bank, 1);
    s().answer('B');
    await persistence.flush();
    const saved = await repo.loadActive(bank, 'p1');
    expect(saved?.events).toHaveLength(1);
    expect(saved).toEqual(s().trial);
  });

  it('does not write on ticks that change nothing', async () => {
    let writes = 0;
    const real = createAttemptRepo(freshDb());
    const counting = {
      ...real,
      saveTrial: (t: TrialState, p: string | null) => ((writes += 1), real.saveTrial(t, p)),
    };
    const { s, persistence } = setup(counting);
    s().startMock(bank, 1);
    await persistence.flush();
    const afterStart = writes;
    for (let i = 0; i < 10; i++) s().tick();
    await persistence.flush();
    expect(writes).toBe(afterStart);
  });

  it('keeps the trial running and reports the error when saving fails', async () => {
    const failing = {
      ...createAttemptRepo(freshDb()),
      saveTrial: () => Promise.reject(new Error('quota exceeded')),
    };
    const { s, persistence, errors } = setup(failing);
    s().startMock(bank, 1);
    s().answer('B');
    await persistence.flush();
    expect(errors.length).toBeGreaterThan(0);
    expect(s().trial?.events).toHaveLength(1);
  });

  it('stops saving after disconnect', async () => {
    let writes = 0;
    const real = createAttemptRepo(freshDb());
    const counting = {
      ...real,
      saveTrial: (t: TrialState, p: string | null) => ((writes += 1), real.saveTrial(t, p)),
    };
    const { s, persistence } = setup(counting);
    persistence.disconnect();
    s().startMock(bank, 1);
    await persistence.flush();
    expect(writes).toBe(0);
  });

  it('a reload resumes the mock with the clock still running', async () => {
    const repo = createAttemptRepo(freshDb());
    const clock = createFakeClock(1000);
    const before = createSessionStore(clock);
    before.getState().setProfile('p1');
    const persistence = connectPersistence(before, repo, () => {});
    before.getState().startMock(bank, 1);
    before.getState().answer('B');
    await persistence.flush();

    clock.advance(90_000); // the page is gone for 90 s
    const after = createSessionStore(clock);
    after.getState().setProfile('p1');
    const saved = await repo.loadActive(bank, 'p1');
    if (saved === null) throw new Error('nothing to resume');
    after.getState().resume(saved);
    const trial = after.getState().trial;
    expect(trial?.events).toHaveLength(1);
    expect(trial && remainingMs(trial.timer, after.getState().now)).toBe(EXAM.durationMs - 90_000);
  });

  it('a reload counts as one hidden spell that ends when the page is back', async () => {
    const repo = createAttemptRepo(freshDb());
    const clock = createFakeClock(1000);
    const before = createSessionStore(clock);
    before.getState().setProfile('p1');
    const persistence = connectPersistence(before, repo, () => {});
    before.getState().startMock(bank, 1);
    before.getState().setHidden(true); // the browser hides the page as it unloads
    await persistence.flush();

    clock.advance(4000);
    const after = createSessionStore(clock);
    after.getState().setProfile('p1');
    const saved = await repo.loadActive(bank, 'p1');
    if (saved === null) throw new Error('nothing to resume');
    after.getState().resume(saved);
    expect(after.getState().trial?.timer).toMatchObject({
      hiddenAt: null,
      hiddenMs: 4000,
      hiddenCount: 1,
    });
    // A later tab switch is still recorded.
    after.getState().setHidden(true);
    expect(after.getState().trial?.timer.hiddenCount).toBe(2);
  });

  it('a mock whose time ran out while the page was closed ends on resume', async () => {
    const repo = createAttemptRepo(freshDb());
    const clock = createFakeClock(1000);
    const before = createSessionStore(clock);
    before.getState().setProfile('p1');
    const persistence = connectPersistence(before, repo, () => {});
    before.getState().startMock(bank, 1);
    await persistence.flush();

    clock.advance(EXAM.durationMs + 5000);
    const after = createSessionStore(clock);
    after.getState().setProfile('p1');
    const afterPersistence = connectPersistence(after, repo, () => {});
    const saved = await repo.loadActive(bank, 'p1');
    if (saved === null) throw new Error('nothing to resume');
    after.getState().resume(saved);
    await afterPersistence.flush();
    expect(after.getState().trial?.endReason).toBe('time_up');
    expect(await repo.loadActive(bank, 'p1')).toBeNull();
    expect((await repo.listFinished('p1'))[0]?.endReason).toBe('time_up');
  });
});

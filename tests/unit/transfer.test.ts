import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { coach } from '../../src/core/analytics/coach.ts';
import { EXAM } from '../../src/core/config/exam.ts';
import type { QuestionItem } from '../../src/core/questions/schema.ts';
import { answerItem, finishTrial, nextItem, startTrial } from '../../src/core/session/trial.ts';
import { createAttemptRepo } from '../../src/data/attempts.ts';
import { openDb, type UmtympDb } from '../../src/data/db.ts';
import { createProfileRepo } from '../../src/data/profiles.ts';
import {
  MAX_IMPORT_BYTES,
  exportProfile,
  importProfile,
  parseExport,
  resetAll,
  serializeExport,
} from '../../src/data/transfer.ts';

const bank: QuestionItem[] = [1, 2, 3, 4, 5, 6].map((n) => ({
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
function freshDb(): UmtympDb {
  const db = openDb('test', { indexedDB: new IDBFactory(), IDBKeyRange });
  opened.push(db);
  return db;
}
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});

/** A student with one finished mock (5 of 6 answered, 4 right) and one unfinished one. */
async function studentWithHistory(db: UmtympDb, name = 'Mo') {
  const profile = await createProfileRepo(db).create({
    displayName: name,
    house: 'foxglen',
    mascotColor: 'teal',
  });
  const attempts = createAttemptRepo(db);
  let mock = startTrial(
    { sessionId: 'm1', mode: 'mock', items: bank, durationMs: EXAM.durationMs },
    1000,
  );
  for (const [i, letter] of (['B', 'B', 'A', 'B', 'C'] as const).entries()) {
    mock = nextItem(answerItem(mock, letter, 2000 + i * 1000), 2000 + i * 1000);
  }
  await attempts.saveTrial(finishTrial(mock, 'completed'), profile.id);
  await attempts.saveTrial(
    startTrial({ sessionId: 'm2', mode: 'mock', items: bank, durationMs: EXAM.durationMs }, 90_000),
    profile.id,
  );
  return { profile, attempts };
}

/** What a student would see: their finished list and Hoot's numbers. */
async function numbers(db: UmtympDb, profileId: string) {
  const attempts = createAttemptRepo(db);
  // Session ids are new after an import; everything a student sees must be the same.
  const finished = (await attempts.listFinished(profileId)).map((f) =>
    Object.fromEntries(Object.entries(f).filter(([key]) => key !== 'sessionId')),
  );
  const feedback = coach(await attempts.listHistory(profileId));
  return {
    finished,
    feedback,
    active: (await attempts.loadActive(bank, profileId))?.events.length ?? null,
  };
}

describe('export', () => {
  it('writes the profile, its sessions and answers in a versioned file', async () => {
    const db = freshDb();
    const { profile } = await studentWithHistory(db);
    const file = await exportProfile(db, profile.id, new Date('2026-11-05T10:00:00Z'));
    expect(file).toMatchObject({
      app: 'comparia-academy',
      format: 1,
      exportedAt: '2026-11-05T10:00:00.000Z',
      profile: { displayName: 'Mo', house: 'foxglen', mascotColor: 'teal' },
    });
    expect(file.sessions.map((s) => s.id).sort()).toEqual(['m1', 'm2']);
    expect(file.attempts).toHaveLength(6);
  });

  it('holds nothing about the child beyond the three profile fields', async () => {
    const db = freshDb();
    const { profile } = await studentWithHistory(db);
    const file = await exportProfile(db, profile.id);
    expect(Object.keys(file.profile).sort()).toEqual(['displayName', 'house', 'mascotColor']);
    for (const s of file.sessions) expect(s).not.toHaveProperty('profileId');
  });

  it('leaves out other students', async () => {
    const db = freshDb();
    const { profile } = await studentWithHistory(db, 'Mo');
    const ali = await createProfileRepo(db).create({
      displayName: 'Ali',
      house: 'owlcrest',
      mascotColor: 'gold',
    });
    await createAttemptRepo(db).saveTrial(
      finishTrial(
        startTrial({ sessionId: 'ali', mode: 'mock', items: bank, durationMs: EXAM.durationMs }, 5),
        'completed',
      ),
      ali.id,
    );
    const file = await exportProfile(db, profile.id);
    expect(file.sessions.map((s) => s.id)).not.toContain('ali');
  });

  it('refuses a profile that does not exist', async () => {
    await expect(exportProfile(freshDb(), 'nobody')).rejects.toThrow(/not found/i);
  });
});

describe('export → import round trip', () => {
  it('another device gets identical history, coach numbers and unfinished mock', async () => {
    const home = freshDb();
    const { profile } = await studentWithHistory(home);
    const before = await numbers(home, profile.id);
    const text = serializeExport(await exportProfile(home, profile.id));

    const other = freshDb();
    const parsed = parseExport(text);
    if (!parsed.ok) throw new Error(parsed.error);
    const imported = await importProfile(other, parsed.value);
    expect(imported).toMatchObject({ displayName: 'Mo', house: 'foxglen', mascotColor: 'teal' });
    expect(await numbers(other, imported.id)).toEqual(before);
  });

  it('importing on the same device makes a separate student with new ids, touching nobody', async () => {
    const db = freshDb();
    const { profile } = await studentWithHistory(db);
    const before = await numbers(db, profile.id);
    const parsed = parseExport(serializeExport(await exportProfile(db, profile.id)));
    if (!parsed.ok) throw new Error(parsed.error);
    const copy = await importProfile(db, parsed.value);
    const again = await importProfile(db, parsed.value);

    expect(new Set([profile.id, copy.id, again.id]).size).toBe(3);
    expect(await db.sessions.count()).toBe(6);
    expect(await numbers(db, profile.id)).toEqual(before);
    expect(await numbers(db, again.id)).toEqual(before);
  });
});

describe('parseExport rejects bad files', () => {
  async function goodFile() {
    const db = freshDb();
    const { profile } = await studentWithHistory(db);
    return JSON.parse(serializeExport(await exportProfile(db, profile.id))) as Record<
      string,
      unknown
    >;
  }
  const errorFor = (value: unknown) => {
    const result = parseExport(typeof value === 'string' ? value : JSON.stringify(value));
    return result.ok ? null : result.error;
  };

  it('not JSON', () => {
    expect(errorFor('{ nope')).toMatch(/not a Comparia Academy file/i);
  });

  it('another app or a newer format', async () => {
    const good = await goodFile();
    expect(errorFor({ ...good, app: 'other' })).toMatch(/not a Comparia Academy file/i);
    expect(errorFor({ ...good, format: 2 })).toMatch(/newer version/i);
  });

  it('an extra field anywhere, so nothing else can sneak in', async () => {
    const good = await goodFile();
    expect(errorFor({ ...good, email: 'x@y.z' })).not.toBeNull();
    expect(
      errorFor({ ...good, profile: { ...(good.profile as object), realName: 'X' } }),
    ).not.toBeNull();
    const sessions = good.sessions as Record<string, unknown>[];
    expect(
      errorFor({ ...good, sessions: [{ ...sessions[0], school: 'X' }, ...sessions.slice(1)] }),
    ).not.toBeNull();
  });

  it('an invalid profile (bad house or name)', async () => {
    const good = await goodFile();
    expect(
      errorFor({ ...good, profile: { ...(good.profile as object), house: 'moonhall' } }),
    ).not.toBeNull();
    expect(
      errorFor({ ...good, profile: { ...(good.profile as object), displayName: '' } }),
    ).not.toBeNull();
  });

  it('an answer that belongs to no session, or to the wrong question', async () => {
    const good = await goodFile();
    const attempts = good.attempts as Record<string, unknown>[];
    expect(errorFor({ ...good, attempts: [{ ...attempts[0], sessionId: 'ghost' }] })).toMatch(
      /session/i,
    );
    expect(errorFor({ ...good, attempts: [{ ...attempts[0], itemId: 'test-0099' }] })).toMatch(
      /question/i,
    );
    expect(errorFor({ ...good, attempts: [{ ...attempts[0], position: 99 }] })).toMatch(
      /question/i,
    );
  });

  it('a file that is too big', () => {
    expect(errorFor('x'.repeat(MAX_IMPORT_BYTES + 1))).toMatch(/too big/i);
  });

  it('accepts the good file', async () => {
    expect(errorFor(await goodFile())).toBeNull();
  });
});

describe('reset all', () => {
  it('removes every profile, session and answer', async () => {
    const db = freshDb();
    await studentWithHistory(db, 'Mo');
    await studentWithHistory(db, 'Ali');
    await resetAll(db);
    expect([
      await db.profiles.count(),
      await db.sessions.count(),
      await db.attempts.count(),
    ]).toEqual([0, 0, 0]);
  });
});

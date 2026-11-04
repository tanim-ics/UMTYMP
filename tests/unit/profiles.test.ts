import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { EXAM } from '../../src/core/config/exam.ts';
import type { QuestionItem } from '../../src/core/questions/schema.ts';
import { answerItem, finishTrial, startTrial } from '../../src/core/session/trial.ts';
import { createAttemptRepo } from '../../src/data/attempts.ts';
import { openDb, type UmtympDb } from '../../src/data/db.ts';
import {
  HOUSES,
  MASCOT_COLORS,
  createProfileRepo,
  validateProfile,
} from '../../src/data/profiles.ts';

const bank: QuestionItem[] = [1, 2, 3].map((n) => ({
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

const mock = (id: string, now = 1000) =>
  startTrial({ sessionId: id, mode: 'mock', items: bank, durationMs: EXAM.durationMs }, now);

describe('profile choices', () => {
  it('offers the four houses and a named colour palette', () => {
    expect(HOUSES.map((h) => h.id)).toEqual(['owlcrest', 'emberwing', 'foxglen', 'starhorn']);
    expect(HOUSES.map((h) => h.mascot)).toEqual(['owl', 'dragon', 'fox', 'unicorn']);
    expect(MASCOT_COLORS.length).toBeGreaterThanOrEqual(4);
    for (const c of MASCOT_COLORS) expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('validateProfile', () => {
  const ok = { displayName: 'Mo', house: 'foxglen', mascotColor: 'teal' } as const;

  it('accepts a nickname, a house and a colour, trimming the name', () => {
    expect(validateProfile({ ...ok, displayName: '  Mo  ' })).toEqual({
      ok: true,
      value: { displayName: 'Mo', house: 'foxglen', mascotColor: 'teal' },
    });
  });

  it.each([
    ['', /name/i],
    ['   ', /name/i],
    ['A'.repeat(21), /20/],
    ['Mo\nX', /one line/i],
  ])('rejects the name %j', (displayName, message) => {
    const result = validateProfile({ ...ok, displayName });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });

  it('rejects an unknown house or colour', () => {
    expect(validateProfile({ ...ok, house: 'moonhall' }).ok).toBe(false);
    expect(validateProfile({ ...ok, mascotColor: '#ff0000' }).ok).toBe(false);
  });
});

describe('profile repository', () => {
  it('creates profiles that hold only a display name, a house and a colour', async () => {
    const db = freshDb();
    const profiles = createProfileRepo(db);
    const created = await profiles.create({
      displayName: 'Mo',
      house: 'owlcrest',
      mascotColor: 'gold',
    });
    const rows = await db.profiles.toArray();
    expect(rows).toEqual([created]);
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      'displayName',
      'house',
      'id',
      'mascotColor',
    ]);
  });

  it('refuses an invalid profile', async () => {
    const profiles = createProfileRepo(freshDb());
    await expect(
      profiles.create({ displayName: '', house: 'owlcrest', mascotColor: 'gold' }),
    ).rejects.toThrow(/name/i);
  });

  it('lists profiles by name', async () => {
    const profiles = createProfileRepo(freshDb());
    await profiles.create({ displayName: 'Zara', house: 'starhorn', mascotColor: 'rose' });
    await profiles.create({ displayName: 'ali', house: 'foxglen', mascotColor: 'teal' });
    expect((await profiles.list()).map((p) => p.displayName)).toEqual(['ali', 'Zara']);
  });

  it('renames a profile, with the same name rules', async () => {
    const profiles = createProfileRepo(freshDb());
    const p = await profiles.create({ displayName: 'Mo', house: 'owlcrest', mascotColor: 'gold' });
    await profiles.rename(p.id, '  Momo ');
    expect((await profiles.list())[0]?.displayName).toBe('Momo');
    await expect(profiles.rename(p.id, '')).rejects.toThrow(/name/i);
  });

  it('the first profile adopts sessions saved before profiles existed', async () => {
    const db = freshDb();
    const attempts = createAttemptRepo(db);
    await attempts.saveTrial(finishTrial(mock('early'), 'completed'), null);
    const p = await createProfileRepo(db).create({
      displayName: 'Mo',
      house: 'owlcrest',
      mascotColor: 'gold',
    });
    expect((await attempts.listFinished(p.id)).map((f) => f.sessionId)).toEqual(['early']);
  });

  it('a second profile does not take anyone else’s sessions', async () => {
    const db = freshDb();
    const attempts = createAttemptRepo(db);
    const profiles = createProfileRepo(db);
    const first = await profiles.create({
      displayName: 'Mo',
      house: 'owlcrest',
      mascotColor: 'gold',
    });
    await attempts.saveTrial(finishTrial(mock('mine'), 'completed'), first.id);
    const second = await profiles.create({
      displayName: 'Ali',
      house: 'foxglen',
      mascotColor: 'teal',
    });
    expect(await attempts.listFinished(second.id)).toEqual([]);
  });

  it('deleting a profile removes it with all its sessions and answers, and nobody else’s', async () => {
    const db = freshDb();
    const attempts = createAttemptRepo(db);
    const profiles = createProfileRepo(db);
    const mo = await profiles.create({ displayName: 'Mo', house: 'owlcrest', mascotColor: 'gold' });
    const ali = await profiles.create({
      displayName: 'Ali',
      house: 'foxglen',
      mascotColor: 'teal',
    });
    await attempts.saveTrial(finishTrial(answerItem(mock('mo-1'), 'B', 1500), 'completed'), mo.id);
    await attempts.saveTrial(
      finishTrial(answerItem(mock('ali-1', 2000), 'B', 2500), 'completed'),
      ali.id,
    );

    await profiles.remove(mo.id);
    expect((await profiles.list()).map((p) => p.displayName)).toEqual(['Ali']);
    expect(await db.sessions.where('profileId').equals(mo.id).count()).toBe(0);
    expect(await db.attempts.where('sessionId').equals('mo-1').count()).toBe(0);
    expect(await db.attempts.where('sessionId').equals('ali-1').count()).toBe(3);
  });
});

describe('sessions belong to one profile', () => {
  it('resume, history and the finished list only see the chosen profile', async () => {
    const attempts = createAttemptRepo(freshDb());
    await attempts.saveTrial(mock('mo-running', 1000), 'mo');
    await attempts.saveTrial(finishTrial(mock('mo-done', 500), 'completed'), 'mo');
    await attempts.saveTrial(mock('ali-running', 2000), 'ali');

    expect((await attempts.loadActive(bank, 'mo'))?.sessionId).toBe('mo-running');
    expect((await attempts.loadActive(bank, 'ali'))?.sessionId).toBe('ali-running');
    expect(await attempts.loadActive(bank, 'nobody')).toBeNull();
    expect((await attempts.listFinished('mo')).map((f) => f.sessionId)).toEqual(['mo-done']);
    expect(await attempts.listFinished('ali')).toEqual([]);
    expect((await attempts.listHistory('mo')).map((h) => h.sessionId)).toEqual(['mo-done']);
  });
});

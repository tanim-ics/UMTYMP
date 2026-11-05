// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import type { QuestionItem } from '../../src/core/questions/schema.ts';
import { createFakeClock } from '../../src/core/timer/clock.ts';
import { connectPersistence, createAttemptRepo } from '../../src/data/attempts.ts';
import { openDb, type UmtympDb } from '../../src/data/db.ts';
import { createProfileRepo } from '../../src/data/profiles.ts';
import { createTransfer } from '../../src/data/transfer.ts';
import { createSessionStore } from '../../src/store/session.ts';
import { App } from '../../src/ui/App.tsx';

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

const opened: UmtympDb[] = [];
afterEach(() => {
  cleanup();
  for (const db of opened.splice(0)) db.close();
});

async function setup(names: string[] = ['Mo', 'Ali']) {
  const db = openDb('test', { indexedDB: new IDBFactory(), IDBKeyRange });
  opened.push(db);
  for (const name of names) {
    await createProfileRepo(db).create({
      displayName: name,
      house: 'foxglen',
      mascotColor: 'teal',
    });
  }
  const store = createSessionStore(createFakeClock());
  const downloads: { name: string; text: string }[] = [];
  const data = {
    profiles: createProfileRepo(db),
    attempts: createAttemptRepo(db),
    transfer: createTransfer(db),
  };
  connectPersistence(store, data.attempts, () => {});
  render(
    <App
      bank={bank}
      store={store}
      seed={1}
      data={data}
      download={(name, text) => downloads.push({ name, text })}
    />,
  );
  return { db, store, downloads };
}

async function openSettings() {
  // One student is picked automatically, so go back to the list (the parents' area) first.
  const home = await screen.findByTestId('home.switch').catch(() => null);
  if (home !== null) fireEvent.click(home);
  fireEvent.click(await screen.findByTestId('profiles.settings'));
  await screen.findByRole('heading', { name: 'Settings & data' });
}

function chooseFile(text: string, name = 'saved.json') {
  const file = new File([text], name, { type: 'application/json' });
  fireEvent.change(screen.getByTestId('settings.import'), { target: { files: [file] } });
}

describe('settings: export', () => {
  it('offers one export per student and saves a file named after them', async () => {
    const { downloads } = await setup();
    await openSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Export Mo' }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]?.name).toMatch(/^comparia-mo-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(downloads[0]?.text ?? '')).toMatchObject({
      app: 'comparia-academy',
      profile: { displayName: 'Mo' },
    });
  });

  it('keeps only safe letters in the file name', async () => {
    const { downloads } = await setup(['Zoë & Co']);
    await openSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Export Zoë & Co' }));
    await waitFor(() => expect(downloads[0]?.name).toMatch(/^comparia-zo-co-/));
  });
});

describe('settings: import', () => {
  it('adds the student from a good file and says so', async () => {
    const { downloads, db } = await setup(['Mo']);
    await openSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Export Mo' }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    chooseFile(downloads[0]?.text ?? '');
    expect((await screen.findByTestId('settings.import-ok')).textContent).toBe('Added Mo.');
    expect(await db.profiles.count()).toBe(2);
  });

  it('explains a bad file and adds nobody', async () => {
    const { db } = await setup(['Mo']);
    await openSettings();
    chooseFile('{"app":"other"}');
    expect((await screen.findByTestId('settings.import-error')).textContent).toMatch(
      /not a Comparia Academy file/,
    );
    expect(await db.profiles.count()).toBe(1);
  });

  it('works on a new device before any student exists (from the Welcome screen)', async () => {
    await setup([]);
    fireEvent.click(await screen.findByTestId('profiles.settings'));
    expect(await screen.findByRole('heading', { name: 'Settings & data' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Export/ })).toBeNull();
  });
});

describe('settings: reset all', () => {
  it('asks first, and Keep my data changes nothing', async () => {
    const { db } = await setup();
    await openSettings();
    fireEvent.click(screen.getByTestId('settings.reset'));
    expect(screen.getByRole('alertdialog').textContent).toMatch(
      /Delete every student and all progress on this device\?.*Export first.*can.t be undone/,
    );
    fireEvent.click(screen.getByTestId('settings.keep'));
    expect(await db.profiles.count()).toBe(2);
  });

  it('confirming deletes everything and starts again at Welcome', async () => {
    const { db, store } = await setup();
    await openSettings();
    fireEvent.click(screen.getByTestId('settings.reset'));
    fireEvent.click(screen.getByTestId('settings.confirm-reset'));
    expect(
      await screen.findByRole('heading', { name: 'Welcome to Comparia Academy!' }),
    ).toBeTruthy();
    expect(await db.profiles.count()).toBe(0);
    expect(store.getState().profileId).toBeNull();
  });

  it('Back returns to the student list', async () => {
    await setup();
    await openSettings();
    fireEvent.click(screen.getByTestId('settings.back'));
    expect(await screen.findByRole('heading', { name: "Who's playing?" })).toBeTruthy();
  });
});

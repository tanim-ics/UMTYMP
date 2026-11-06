// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import type { QuestionItem } from '../../src/core/questions/schema.ts';
import { createFakeClock } from '../../src/core/timer/clock.ts';
import { connectPersistence, createAttemptRepo } from '../../src/data/attempts.ts';
import { openDb, type UmtympDb } from '../../src/data/db.ts';
import { createProfileRepo } from '../../src/data/profiles.ts';
import { createSessionStore, type SessionStoreApi } from '../../src/store/session.ts';
import { App } from '../../src/ui/App.tsx';

// The bank loads after the first screen (Task 24 budget: the questions no longer sit in the first download), so
// App gets `bank={null}` until it arrives. These tests pin what a student sees in that short wait.

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

function newDb() {
  const db = openDb('test', { indexedDB: new IDBFactory(), IDBKeyRange });
  opened.push(db);
  return db;
}

function withData(db: UmtympDb, store: SessionStoreApi) {
  const data = { profiles: createProfileRepo(db), attempts: createAttemptRepo(db) };
  const persistence = connectPersistence(store, data.attempts, () => {});
  return { data, persistence };
}

describe('while the questions are still loading', () => {
  it('the first-run form shows without waiting for them', async () => {
    const store = createSessionStore(createFakeClock());
    const { data } = withData(newDb(), store);
    render(<App bank={null} store={store} seed={1} data={data} />);
    expect(
      await screen.findByRole('heading', { name: 'Welcome to Comparia Academy!' }),
    ).toBeTruthy();
  });

  it('a picked student waits on a short loading note, then goes home', async () => {
    const db = newDb();
    await createProfileRepo(db).create({
      displayName: 'Mo',
      house: 'owlcrest',
      mascotColor: 'gold',
    });
    const store = createSessionStore(createFakeClock());
    const { data } = withData(db, store);
    const view = render(<App bank={null} store={store} seed={1} data={data} />);
    expect((await screen.findByTestId('app.loading')).textContent).toMatch(
      /Getting the questions ready/,
    );
    expect(screen.queryByTestId('home.start')).toBeNull();

    view.rerender(<App bank={bank} store={store} seed={1} data={data} />);
    expect((await screen.findByTestId('home.player')).textContent).toMatch(/Mo/);
    expect(screen.queryByTestId('app.loading')).toBeNull();
  });

  it('an unfinished mock is resumed once the questions arrive', async () => {
    const db = newDb();
    const first = createSessionStore(createFakeClock());
    const before = withData(db, first);
    await createProfileRepo(db).create({
      displayName: 'Mo',
      house: 'owlcrest',
      mascotColor: 'gold',
    });
    const [mo] = await before.data.profiles.list();
    first.getState().setProfile(mo?.id ?? null);
    first.getState().startMock(bank, 1);
    first.getState().answer('B');
    await before.persistence.flush();
    const sessionId = first.getState().trial?.sessionId;

    // A reload: a fresh store, and the bank not here yet.
    const store = createSessionStore(createFakeClock());
    const { data } = withData(db, store);
    const view = render(<App bank={null} store={store} seed={1} data={data} />);
    await screen.findByTestId('app.loading');
    expect(store.getState().trial).toBeNull();

    view.rerender(<App bank={bank} store={store} seed={1} data={data} />);
    await waitFor(() => expect(store.getState().trial?.sessionId).toBe(sessionId));
    expect(store.getState().trial?.events).toHaveLength(1);
  });

  it('a student added before the questions arrive goes home once they do', async () => {
    const store = createSessionStore(createFakeClock());
    const { data } = withData(newDb(), store);
    const view = render(<App bank={null} store={store} seed={1} data={data} />);
    fireEvent.change(await screen.findByTestId('profiles.name'), { target: { value: 'Mo' } });
    fireEvent.click(screen.getByTestId('profiles.house-foxglen'));
    fireEvent.click(screen.getByTestId('profiles.color-teal'));
    fireEvent.click(screen.getByTestId('profiles.save'));
    await screen.findByTestId('app.loading');

    view.rerender(<App bank={bank} store={store} seed={1} data={data} />);
    expect((await screen.findByTestId('home.player')).textContent).toMatch(/Mo · Foxglen/);
  });

  it('without storage, the loading note shows until home can open', async () => {
    const store = createSessionStore(createFakeClock());
    const view = render(<App bank={null} store={store} seed={1} storageAvailable={false} />);
    expect(screen.getByTestId('app.loading')).toBeTruthy();
    view.rerender(<App bank={bank} store={store} seed={1} storageAvailable={false} />);
    expect(screen.getByTestId('home.start')).toBeTruthy();
  });
});

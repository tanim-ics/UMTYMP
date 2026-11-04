// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import type { QuestionItem } from '../../src/core/questions/schema.ts';
import { createFakeClock } from '../../src/core/timer/clock.ts';
import { connectPersistence, createAttemptRepo } from '../../src/data/attempts.ts';
import { openDb, type UmtympDb } from '../../src/data/db.ts';
import { createProfileRepo } from '../../src/data/profiles.ts';
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

function setup(db = openDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })) {
  opened.push(db);
  const store = createSessionStore(createFakeClock());
  const data = { profiles: createProfileRepo(db), attempts: createAttemptRepo(db) };
  const persistence = connectPersistence(store, data.attempts, () => {});
  render(<App bank={bank} store={store} seed={1} data={data} />);
  return { db, store, data, persistence };
}

async function createProfile(name: string, house = 'foxglen', color = 'teal') {
  fireEvent.change(await screen.findByTestId('profiles.name'), { target: { value: name } });
  fireEvent.click(screen.getByTestId(`profiles.house-${house}`));
  fireEvent.click(screen.getByTestId(`profiles.color-${color}`));
  fireEvent.click(screen.getByTestId('profiles.save'));
}

describe('first run', () => {
  it('asks for a nickname, a house and a colour, with a privacy hint', async () => {
    setup();
    expect(
      await screen.findByRole('heading', { name: 'Welcome to Comparia Academy!' }),
    ).toBeTruthy();
    expect(screen.getByText(/Don.t type your full real name/)).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Owlcrest (owl)' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Teal' })).toBeTruthy();
    expect(screen.queryByTestId('profiles.cancel')).toBeNull();
  });

  it('explains what is missing instead of saving', async () => {
    const { db } = setup();
    fireEvent.change(await screen.findByTestId('profiles.name'), { target: { value: 'Mo' } });
    fireEvent.click(screen.getByTestId('profiles.save'));
    expect(screen.getByTestId('profiles.error').textContent).toMatch(/house/);
    expect(await db.profiles.count()).toBe(0);
  });

  it('creating the first profile goes straight home, playing as that student', async () => {
    const { store } = setup();
    await createProfile('Mo');
    expect((await screen.findByTestId('home.player')).textContent).toMatch(
      /Playing as Mo · Foxglen/,
    );
    expect(store.getState().profileId).not.toBeNull();
  });
});

describe('who is playing', () => {
  it('a single profile is picked automatically on load', async () => {
    const db = openDb('test', { indexedDB: new IDBFactory(), IDBKeyRange });
    await createProfileRepo(db).create({
      displayName: 'Mo',
      house: 'owlcrest',
      mascotColor: 'gold',
    });
    setup(db);
    expect((await screen.findByTestId('home.player')).textContent).toMatch(/Mo/);
  });

  it('switching shows the list even with one profile, and adding a second one works', async () => {
    const { store } = setup();
    await createProfile('Mo');
    fireEvent.click(await screen.findByTestId('home.switch'));
    expect(await screen.findByRole('heading', { name: "Who's playing?" })).toBeTruthy();
    fireEvent.click(screen.getByTestId('profiles.add'));
    await createProfile('Ali', 'starhorn', 'rose');
    expect((await screen.findByTestId('home.player')).textContent).toMatch(/Ali · Starhorn/);
    fireEvent.click(screen.getByTestId('home.switch'));
    const buttons = await screen.findAllByTestId('profiles.choose');
    expect(buttons.map((b) => b.textContent)).toEqual([
      expect.stringMatching(/^Ali · Starhorn · Rose/),
      expect.stringMatching(/^Mo · Foxglen · Teal/),
    ]);
    const before = store.getState().profileId;
    fireEvent.click(buttons[1] as HTMLElement);
    await waitFor(() => expect(store.getState().profileId).not.toBe(before));
  });

  it('a student finds their own unfinished mock again, and only theirs', async () => {
    const { store, persistence } = setup();
    await createProfile('Mo');
    await screen.findByTestId('home.player');
    fireEvent.click(screen.getByTestId('home.start'));
    store.getState().answer('B');
    await persistence.flush();
    const moSession = store.getState().trial?.sessionId;

    store.getState().setProfile(null);
    fireEvent.click(await screen.findByTestId('profiles.add'));
    await createProfile('Ali');
    await screen.findByTestId('home.player');
    expect(store.getState().trial).toBeNull(); // Ali starts fresh

    store.getState().setProfile(null);
    const mo = (await screen.findAllByTestId('profiles.choose')).find((b) =>
      b.textContent?.startsWith('Mo'),
    );
    fireEvent.click(mo as HTMLElement);
    await waitFor(() => expect(store.getState().trial?.sessionId).toBe(moSession));
    expect(store.getState().trial?.events).toHaveLength(1);
  });
});

describe('managing students', () => {
  async function twoStudents() {
    const ctx = setup();
    await createProfile('Mo');
    fireEvent.click(await screen.findByTestId('home.switch'));
    fireEvent.click(await screen.findByTestId('profiles.add'));
    await createProfile('Ali');
    fireEvent.click(await screen.findByTestId('home.switch'));
    fireEvent.click(await screen.findByTestId('profiles.manage'));
    return ctx;
  }

  it('renames a student, refusing an empty name', async () => {
    const { data } = await twoStudents();
    const [aliInput] = screen.getAllByTestId('profiles.rename-input');
    fireEvent.change(aliInput as HTMLElement, { target: { value: '' } });
    expect(screen.getByTestId('profiles.rename-error').textContent).toMatch(/name/i);
    fireEvent.change(aliInput as HTMLElement, { target: { value: 'Alia' } });
    fireEvent.click(screen.getAllByTestId('profiles.rename')[0] as HTMLElement);
    await waitFor(async () =>
      expect((await data.profiles.list()).map((p) => p.displayName)).toEqual(['Alia', 'Mo']),
    );
  });

  it('delete asks first, says what will be lost, and Keep cancels', async () => {
    const { data } = await twoStudents();
    fireEvent.click(screen.getAllByTestId('profiles.delete')[1] as HTMLElement);
    expect(screen.getByRole('alertdialog').textContent).toMatch(
      /Delete Mo and all of their progress\? This can.t be undone/,
    );
    fireEvent.click(screen.getByTestId('profiles.keep'));
    expect(await data.profiles.list()).toHaveLength(2);
  });

  it('confirming deletes the student', async () => {
    const { data } = await twoStudents();
    fireEvent.click(screen.getAllByTestId('profiles.delete')[1] as HTMLElement);
    fireEvent.click(screen.getByTestId('profiles.confirm-delete'));
    await waitFor(async () =>
      expect((await data.profiles.list()).map((p) => p.displayName)).toEqual(['Ali']),
    );
    expect(screen.queryAllByTestId('profiles.rename-input')).toHaveLength(1);
  });

  it('deleting the last student returns to the first-run form', async () => {
    setup();
    await createProfile('Mo');
    fireEvent.click(await screen.findByTestId('home.switch'));
    fireEvent.click(await screen.findByTestId('profiles.manage'));
    fireEvent.click(screen.getByTestId('profiles.delete'));
    fireEvent.click(screen.getByTestId('profiles.confirm-delete'));
    expect(
      await screen.findByRole('heading', { name: 'Welcome to Comparia Academy!' }),
    ).toBeTruthy();
  });

  it('Cancel on the add form goes back to the list', async () => {
    setup();
    await createProfile('Mo');
    fireEvent.click(await screen.findByTestId('home.switch'));
    fireEvent.click(await screen.findByTestId('profiles.add'));
    fireEvent.click(screen.getByTestId('profiles.cancel'));
    expect(await screen.findByRole('heading', { name: "Who's playing?" })).toBeTruthy();
  });
});

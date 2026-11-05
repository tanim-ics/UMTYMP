// @vitest-environment jsdom
// Task 21: the art from Task 20 on the screens. Pictures are decorative (the words next to them say the same), the
// test screen gets a still mascot, and the one celebration lives on the results screen only.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import type { QuestionItem } from '../../src/core/questions/schema.ts';
import { createFakeClock } from '../../src/core/timer/clock.ts';
import { createAttemptRepo } from '../../src/data/attempts.ts';
import { openDb, type UmtympDb } from '../../src/data/db.ts';
import { createProfileRepo } from '../../src/data/profiles.ts';
import { createSessionStore } from '../../src/store/session.ts';
import { App } from '../../src/ui/App.tsx';
import { ART, Art } from '../../src/ui/components/Art.tsx';

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

const srcOf = (testId: string) => screen.getByTestId(testId).getAttribute('src') ?? '';

function plainApp() {
  const store = createSessionStore(createFakeClock());
  render(<App bank={bank} store={store} seed={1} />);
  return store;
}

describe('Art', () => {
  it('every picture the screens can ask for is a file in public/art', () => {
    for (const name of ART) {
      // Vitest runs from the project root; import.meta.url isn't a file URL under jsdom.
      const file = resolve('public/art', `${name}.svg`);
      expect(existsSync(file), name).toBe(true);
    }
  });

  it('is decorative: empty alt text, so screen readers skip it', () => {
    render(<Art name="hoot" testId="x.art" />);
    const img = screen.getByTestId('x.art');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('src')).toBe('/art/hoot.svg');
  });
});

describe('themed screens', () => {
  it('home shows the castle and the student’s own house crest', async () => {
    const db = openDb('test', { indexedDB: new IDBFactory(), IDBKeyRange });
    opened.push(db);
    const profiles = createProfileRepo(db);
    await profiles.create({ displayName: 'Mo', house: 'foxglen', mascotColor: 'purple' });
    const store = createSessionStore(createFakeClock());
    render(
      <App
        bank={bank}
        store={store}
        seed={1}
        data={{ profiles, attempts: createAttemptRepo(db) }}
      />,
    );
    await screen.findByTestId('home.player');
    expect(srcOf('home.crest')).toBe('/art/crest-foxglen.svg');
    expect(srcOf('home.art')).toBe('/art/castle-map.svg');
  });

  it('the Welcome form shows each house’s crest next to its name', async () => {
    const db = openDb('test', { indexedDB: new IDBFactory(), IDBKeyRange });
    opened.push(db);
    render(
      <App
        bank={bank}
        store={createSessionStore(createFakeClock())}
        seed={1}
        data={{ profiles: createProfileRepo(db), attempts: createAttemptRepo(db) }}
      />,
    );
    await screen.findByRole('heading', { name: 'Welcome to Comparia Academy!' });
    expect(srcOf('profiles.crest-starhorn')).toBe('/art/crest-starhorn.svg');
    // The radio's name stays the house's words, not the picture.
    expect(screen.getByRole('radio', { name: /Starhorn \(unicorn\)/ })).toBeTruthy();
  });

  it('the Grand Trial shows a still Professor Hoot and no celebration', () => {
    plainApp();
    fireEvent.click(screen.getByTestId('home.start'));
    expect(srcOf('trial.mascot')).toBe('/art/hoot.svg');
    expect(screen.queryByTestId('result.celebrate')).toBeNull();
  });

  it('the results screen is where the celebration is', () => {
    plainApp();
    fireEvent.click(screen.getByTestId('home.start'));
    fireEvent.click(screen.getByTestId('trial.finish'));
    expect(screen.getByTestId('result.celebrate')).toBeTruthy();
  });

  it('a potion drill shows the potion, the Spellbook its book, the castle map its castle', async () => {
    const store = plainApp();
    fireEvent.click(screen.getByTestId('home.spellbook'));
    expect(srcOf('spellbook.art')).toBe('/art/spellbook.svg');
    fireEvent.click(screen.getByTestId('spellbook.back'));
    fireEvent.click(screen.getByTestId('home.castle'));
    expect(srcOf('castle.art')).toBe('/art/castle-map.svg');
    fireEvent.click(await screen.findByTestId('castle.back'));
    act(() => store.getState().startDrill(bank, { kind: 'tag', tag: 'arithmetic' }, 1));
    expect(srcOf('drill.art')).toBe('/art/potion.svg');
  });
});

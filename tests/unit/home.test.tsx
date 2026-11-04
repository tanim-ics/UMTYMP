// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { QuestionItem } from '../../src/core/questions/schema.ts';
import { createFakeClock } from '../../src/core/timer/clock.ts';
import type { FinishedSession } from '../../src/data/attempts.ts';
import { createSessionStore } from '../../src/store/session.ts';
import { App } from '../../src/ui/App.tsx';

afterEach(cleanup);

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

const finished: FinishedSession[] = [
  {
    sessionId: 'newer',
    startedAt: Date.UTC(2026, 10, 4, 15),
    total: 3,
    correct: 2,
    endReason: 'time_up',
    itemIds: ['test-0003'],
  },
  {
    sessionId: 'older',
    startedAt: Date.UTC(2026, 10, 3, 15),
    total: 3,
    correct: 3,
    endReason: 'completed',
    itemIds: ['test-0001'],
  },
];

function renderHome(options: { list?: FinishedSession[]; storageAvailable?: boolean } = {}) {
  const store = createSessionStore(createFakeClock());
  const history = {
    listFinished: () => Promise.resolve(options.list ?? finished),
    listHistory: () => Promise.resolve([]),
  };
  render(
    <App
      bank={bank}
      store={store}
      seed={1}
      history={history}
      storageAvailable={options.storageAvailable ?? true}
    />,
  );
  return store;
}

describe('home: past Grand Trials', () => {
  it('lists finished trials, newest first, with score and how they ended', async () => {
    renderHome();
    const items = await screen.findAllByTestId('home.history-item');
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringMatching(/2 of 3 correct.*time ran out/i),
      expect.stringMatching(/3 of 3 correct.*finished/i),
    ]);
  });

  it('shows no history section before the first trial', async () => {
    renderHome({ list: [] });
    await screen.findByTestId('home.start');
    expect(screen.queryByTestId('home.history')).toBeNull();
  });

  it('passes the past trials, oldest first, so a new mock avoids their items', async () => {
    const store = renderHome();
    await screen.findAllByTestId('home.history-item');
    const calls: unknown[][] = [];
    store.setState({ startMock: (...args: unknown[]) => void calls.push(args) });
    fireEvent.click(screen.getByTestId('home.start'));
    expect(calls[0]?.[2]).toEqual([['test-0001'], ['test-0003']]);
  });

  it('refreshes the list after a trial ends', async () => {
    const store = createSessionStore(createFakeClock());
    let list: FinishedSession[] = [];
    const history = {
      listFinished: () => Promise.resolve(list),
      listHistory: () => Promise.resolve([]),
    };
    render(<App bank={bank} store={store} seed={1} history={history} storageAvailable />);
    fireEvent.click(await screen.findByTestId('home.start'));
    fireEvent.click(screen.getByTestId('trial.finish'));
    list = finished;
    fireEvent.click(screen.getByTestId('result.home'));
    expect(await screen.findAllByTestId('home.history-item')).toHaveLength(2);
  });
});

describe('home: when saving is not possible', () => {
  it('says answers will not be kept when storage is unavailable', () => {
    renderHome({ storageAvailable: false });
    expect(screen.getByTestId('home.saving-off').textContent).toMatch(/won.t be kept/i);
  });

  it('says so after a save fails, and the app keeps working', async () => {
    const store = renderHome();
    await screen.findAllByTestId('home.history-item');
    expect(screen.queryByTestId('home.saving-off')).toBeNull();
    store.getState().reportSaveError();
    expect(await screen.findByTestId('home.saving-off')).toBeTruthy();
    fireEvent.click(screen.getByTestId('home.start'));
    expect(screen.getByTestId('trial.position')).toBeTruthy();
  });

  it('works without any history source', () => {
    const store = createSessionStore(createFakeClock());
    render(<App bank={bank} store={store} seed={1} />);
    expect(screen.queryByTestId('home.history')).toBeNull();
    expect(screen.queryByTestId('home.saving-off')).toBeNull();
  });
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionRecord } from '../../src/core/analytics/coach.ts';
import type { QuestionItem } from '../../src/core/questions/schema.ts';
import type { AttemptEvent } from '../../src/core/session/attempt.ts';
import { createFakeClock } from '../../src/core/timer/clock.ts';
import { createSessionStore } from '../../src/store/session.ts';
import { App } from '../../src/ui/App.tsx';
import { CastleMap } from '../../src/ui/screens/CastleMap.tsx';
import { many, MINUTE } from '../fixtures/histories.ts';

afterEach(cleanup);

const mock = (id: string, events: AttemptEvent[], startedAt = 0): SessionRecord => ({
  sessionId: id,
  mode: 'mock',
  startedAt,
  durationMs: 25 * MINUTE,
  endReason: 'completed',
  events: events.map((e) => ({ ...e, sessionId: id })),
});

const historyOf = (sessions: SessionRecord[]) => ({ listHistory: async () => sessions });

function renderMap(sessions: SessionRecord[]) {
  const onStart = vi.fn();
  const onBack = vi.fn();
  render(<CastleMap history={historyOf(sessions)} onStart={onStart} onBack={onBack} />);
  return { onStart, onBack };
}

describe('castle map: empty', () => {
  it('tells a new student where to start, and Start begins a Grand Trial', async () => {
    const { onStart } = renderMap([]);
    const empty = await screen.findByTestId('castle.empty');
    expect(empty.textContent).toMatch(/Start with a Grand Trial/);
    fireEvent.click(screen.getByTestId('castle.start'));
    expect(onStart).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('castle.trend')).toBeNull();
  });

  it('shows every tower locked, with how to open it in words (not colour)', async () => {
    renderMap([]);
    const towers = await screen.findAllByTestId('castle.tower');
    expect(towers.length).toBeGreaterThanOrEqual(5);
    for (const t of towers) expect(t.textContent).toMatch(/locked.*To open:/);
  });

  it('shows the heading while history is still loading, not a blank page', () => {
    render(
      <CastleMap
        history={{ listHistory: () => new Promise(() => {}) }}
        onStart={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Castle map' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/Opening the castle map/);
    expect(screen.queryByTestId('castle.empty')).toBeNull();
  });

  it('an unfinished mock alone still counts as empty', async () => {
    renderMap([
      {
        ...mock(
          'open',
          many(5, () => ({})),
        ),
        endReason: null,
      },
    ]);
    expect(await screen.findByTestId('castle.empty')).toBeTruthy();
  });
});

describe('castle map: filled', () => {
  const first = mock(
    'a',
    many(10, (i) => ({ choice: i < 4 ? 'A' : 'B', tags: ['fractions'], level: 2, seconds: 12 })),
    Date.UTC(2026, 10, 1),
  );
  const second = mock(
    'b',
    many(10, (i) => ({ choice: i < 7 ? 'A' : 'D', tags: ['fractions'], level: 2, seconds: 18 })),
    Date.UTC(2026, 10, 3),
  );

  it('one trend row per mock, oldest first, with each number', async () => {
    renderMap([second, first]);
    const rows = within(await screen.findByTestId('castle.trend'))
      .getAllByRole('row')
      .slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      `${new Date(first.startedAt).toLocaleDateString()}4 of 1012 s—0%—`,
      `${new Date(second.startedAt).toLocaleDateString()}7 of 1018 s—30%—`,
    ]);
  });

  it('topics and levels tables with accuracy and median time', async () => {
    renderMap([first, second]);
    const topics = within(await screen.findByTestId('castle.topics')).getAllByRole('row');
    expect(topics[1]?.textContent).toBe('Fractions11 of 2055%15 s');
    const levels = within(screen.getByTestId('castle.levels')).getAllByRole('row');
    expect(levels[1]?.textContent).toBe('Level 2: Novice11 of 2055%15 s');
  });

  it('opened towers show the student’s own numbers', async () => {
    renderMap([first, second]);
    await screen.findByTestId('castle.trend');
    const open = screen
      .getAllByTestId('castle.tower')
      .filter((t) => t.getAttribute('data-unlocked') === 'true')
      .map((t) => t.textContent);
    expect(open).toContain('Gate Tower: open2 Grand Trials finished');
    expect(open).toContain('Rising Tower: openFrom 40% to 70% right since your first Grand Trial');
  });

  it('stamina reads as a drop (−) or a gain (+) in points', async () => {
    const run = (earlyRight: number, lateRight: number) =>
      [
        ...many(10, (i) => ({ at: (i + 1) * 30_000, choice: i < earlyRight ? 'A' : 'B' })),
        ...many(10, (i) => ({ at: 16 * MINUTE + i * 30_000, choice: i < lateRight ? 'A' : 'B' })),
      ].map((e, i) => ({ ...e, position: i }));
    renderMap([mock('drop', run(10, 5), 0), mock('gain', run(5, 10), 1)]);
    const rows = within(await screen.findByTestId('castle.trend'))
      .getAllByRole('row')
      .slice(1);
    expect(rows.map((r) => r.lastElementChild?.textContent)).toEqual(['−50 pts', '+50 pts']);
  });

  it('Back leaves the map', async () => {
    const { onBack } = renderMap([first]);
    fireEvent.click(await screen.findByTestId('castle.back'));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('castle map from home', () => {
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

  it('Home opens the map, Back returns home, and the empty map can start a trial', async () => {
    const store = createSessionStore(createFakeClock());
    render(
      <App
        bank={bank}
        store={store}
        seed={1}
        history={{ listFinished: async () => [], listHistory: async () => [] }}
      />,
    );
    fireEvent.click(screen.getByTestId('home.castle'));
    expect(await screen.findByRole('heading', { name: 'Castle map' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('castle.back'));
    expect(screen.getByRole('heading', { name: 'Comparia Academy' })).toBeTruthy();

    fireEvent.click(screen.getByTestId('home.castle'));
    fireEvent.click(await screen.findByTestId('castle.start'));
    expect(store.getState().trial?.mode).toBe('mock');
    // Its results lead home, not back to the map.
    act(() => store.getState().finish());
    fireEvent.click(await screen.findByTestId('result.home'));
    expect(screen.getByRole('heading', { name: 'Comparia Academy' })).toBeTruthy();
  });
});

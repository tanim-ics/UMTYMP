// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { SessionRecord } from '../../src/core/analytics/coach.ts';
import type { QuestionItem } from '../../src/core/questions/schema.ts';
import type { Tag } from '../../src/core/questions/vocabulary.ts';
import { createFakeClock } from '../../src/core/timer/clock.ts';
import { createSessionStore } from '../../src/store/session.ts';
import { drillLabel } from '../../src/ui/labels.ts';
import { GrandTrial } from '../../src/ui/screens/GrandTrial.tsx';

afterEach(cleanup);

/** 6 fraction questions and 6 root questions, all with key B. */
const bank: QuestionItem[] = Array.from({ length: 12 }, (_, i) => ({
  id: `test-${String(i + 1).padStart(4, '0')}`,
  quantity_a: '1',
  quantity_b: '2',
  condition: null,
  correct_answer: 'B',
  tags: [(i < 6 ? 'fractions' : 'roots') as Tag],
  difficulty: 1,
  target_seconds: 5,
  shortcut_explanation: `Shortcut ${i + 1}.`,
  full_explanation: `Proof ${i + 1}.`,
  reviewed_by: 'test',
}));

/** A finished mock: every fraction right, roots wrong except one → strength fractions, bottleneck roots. */
function finishedMock(history?: { listHistory: () => Promise<SessionRecord[]> }) {
  const clock = createFakeClock();
  const store = createSessionStore(clock);
  const s = () => store.getState();
  s().startMock(bank, 1);
  const trial = s().trial;
  if (trial === null) throw new Error('no mock');
  for (const item of trial.items) {
    const rootsRight = item.id === 'test-0007';
    s().answer(item.tags.includes('roots') && !rootsRight ? 'A' : 'B');
    s().next();
  }
  s().finish();
  render(<GrandTrial store={store} bank={bank} history={history} />);
  return { clock, store, s };
}

const key = (k: string) => fireEvent.keyDown(document.activeElement ?? document.body, { key: k });

describe('coach card on the results', () => {
  it('shows one strength, the biggest leak and one habit, each with numbers', async () => {
    finishedMock();
    expect((await screen.findByTestId('coach.strength')).textContent).toBe(
      'Strongest spell: Fractions, 6 of 6 right (100%).',
    );
    expect(screen.getByTestId('coach.bottleneck').textContent).toBe(
      'Biggest leak: Roots, 1 of 6 right (17%).',
    );
    expect(screen.getByTestId('coach.habit').textContent).toMatch(/shortcut/i);
    expect(screen.getByTestId('coach.brew').textContent).toMatch(/Roots/);
  });

  it('uses the saved history as well as this mock', async () => {
    const past: SessionRecord = {
      sessionId: 'old',
      mode: 'mock',
      startedAt: -100_000,
      durationMs: 25 * 60_000,
      endReason: 'completed',
      events: [],
    };
    let asked = 0;
    finishedMock({ listHistory: () => ((asked += 1), Promise.resolve([past])) });
    await screen.findByTestId('coach.strength');
    expect(asked).toBe(1);
  });

  it('counts the finished mock once even though storage already holds it', async () => {
    // The mock is saved the moment it ends, so listHistory returns it too.
    let store: ReturnType<typeof createSessionStore> | null = null;
    const history = {
      // Answers a microtask later, like IndexedDB, by which time `store` below is set.
      listHistory: () =>
        Promise.resolve().then(() => {
          const t = store?.getState().trial;
          if (!t) throw new Error('store not ready');
          return [
            {
              sessionId: t.sessionId,
              mode: t.mode,
              startedAt: t.timer.startedAt,
              durationMs: t.timer.durationMs,
              endReason: t.endReason,
              events: t.events,
            },
          ];
        }),
    };
    ({ store } = finishedMock(history));
    expect((await screen.findByTestId('coach.strength')).textContent).toBe(
      'Strongest spell: Fractions, 6 of 6 right (100%).',
    );
  });

  it('names the potion after a topic, a trap or a level', () => {
    expect(drillLabel({ kind: 'tag', tag: 'absolute_value' })).toBe('Absolute value');
    expect(drillLabel({ kind: 'trap', trap: 'negative_numbers' })).toBe(
      'the negative numbers trap',
    );
    expect(drillLabel({ kind: 'level', level: 4 })).toBe('level 4 questions');
  });

  it('says when there is not enough data yet and suggests a full trial', async () => {
    const store = createSessionStore(createFakeClock());
    store.getState().startMock(bank.slice(0, 3), 1);
    store.getState().finish();
    render(<GrandTrial store={store} bank={bank} />);
    expect((await screen.findByTestId('coach.not-enough')).textContent).toMatch(
      /5 answers.*full Grand Trial/i,
    );
    expect(screen.queryByTestId('coach.brew')).toBeNull();
  });
});

describe('potion drill', () => {
  async function startDrill() {
    const ctx = finishedMock();
    fireEvent.click(await screen.findByTestId('coach.brew'));
    return ctx;
  }

  it('Brew a potion starts a 10-question drill on the bottleneck', async () => {
    const { s } = await startDrill();
    expect(s().trial?.mode).toBe('drill');
    expect(s().trial?.items.every((i) => i.tags.includes('roots'))).toBe(true);
    expect(screen.getByTestId('drill.position').textContent).toBe('Potion question 1 of 6');
  });

  it('shows whether the answer was right and the shortcut, then locks the answer', async () => {
    const { s } = await startDrill();
    key('1');
    const feedback = screen.getByTestId('drill.feedback');
    expect(feedback.textContent).toMatch(/Not quite.*B, Quantity B is greater/);
    expect(feedback.textContent).toMatch(/Shortcut \d+\./);
    expect((screen.getByTestId('trial.answer-B') as HTMLButtonElement).disabled).toBe(true);
    key('2');
    expect(s().trial?.events[0]?.choice).toBe('A');
  });

  it('says "Right!" for a right answer', async () => {
    await startDrill();
    key('b');
    expect(screen.getByTestId('drill.feedback').textContent).toMatch(/^Right!/);
  });

  it('counts time up instead of down', async () => {
    const { clock, store } = await startDrill();
    expect(screen.getByTestId('drill.timer').textContent).toBe('0:00');
    act(() => {
      clock.advance(65_000);
      store.getState().tick();
    });
    expect(screen.getByTestId('drill.timer').textContent).toBe('1:05');
  });

  it('pause hides the question and blocks answers until resumed (button or P)', async () => {
    const { s } = await startDrill();
    fireEvent.click(screen.getByTestId('drill.pause'));
    expect(screen.getByTestId('drill.paused')).toBeTruthy();
    expect(screen.queryByTestId('trial.quantity-a')).toBeNull();
    key('2');
    expect(s().trial?.events).toEqual([]);
    key('p');
    expect(screen.queryByTestId('drill.paused')).toBeNull();
    key('p');
    expect(screen.getByTestId('drill.paused')).toBeTruthy();
    fireEvent.click(screen.getByTestId('drill.resume'));
    key('2');
    expect(s().trial?.events[0]?.choice).toBe('B');
  });

  it('finishing the drill shows its result, and Back to results returns to the mock', async () => {
    const { s } = await startDrill();
    for (let i = 0; i < 6; i++) {
      key('2');
      key('Enter');
    }
    expect(document.activeElement).toBe(screen.getByTestId('trial.finish'));
    fireEvent.click(screen.getByTestId('trial.finish'));
    expect(screen.getByTestId('result.score').textContent).toBe('6 of 6 correct');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Potion brewed!');
    fireEvent.click(screen.getByTestId('result.back'));
    expect(s().trial?.mode).toBe('mock');
    await waitFor(() => expect(screen.getByTestId('coach.strength')).toBeTruthy());
  });

  it('a drill result has no coach card of its own', async () => {
    await startDrill();
    fireEvent.click(screen.getByTestId('trial.finish'));
    expect(screen.queryByTestId('coach.card')).toBeNull();
  });
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EXAM } from '../../src/core/config/exam.ts';
import type { QuestionItem } from '../../src/core/questions/schema.ts';
import { createFakeClock } from '../../src/core/timer/clock.ts';
import { createSessionStore } from '../../src/store/session.ts';
import { App } from '../../src/ui/App.tsx';

afterEach(cleanup);

const bank: QuestionItem[] = [1, 2, 3].map((n) => ({
  id: `test-${String(n).padStart(4, '0')}`,
  quantity_a: `\\frac{${n}}{4}`,
  quantity_b: '0.5',
  condition: n === 2 ? 'x > 0' : null,
  correct_answer: 'B',
  tags: ['fractions'],
  difficulty: 1,
  target_seconds: 5,
  shortcut_explanation: 'Look.',
  full_explanation: 'Proof.',
  reviewed_by: 'test',
}));

function setup(items: readonly QuestionItem[] = bank) {
  const clock = createFakeClock();
  const store = createSessionStore(clock);
  render(<App bank={items} store={store} seed={1} />);
  const trial = () => store.getState().trial;
  const key = (k: string, init: KeyboardEventInit = {}) =>
    fireEvent.keyDown(document.activeElement ?? document.body, { key: k, ...init });
  return { clock, store, trial, key };
}

function startTrial() {
  const ctx = setup();
  fireEvent.click(screen.getByTestId('home.start'));
  return ctx;
}

describe('home', () => {
  it('offers to start a Grand Trial', () => {
    setup();
    expect(screen.getByRole('button', { name: /start grand trial/i })).toBeTruthy();
  });

  it('says when the bank is smaller than a full trial', () => {
    setup();
    expect(screen.getByTestId('home.bank-note').textContent).toMatch(/3 .* 50/);
  });

  it('starts with a random seed when none is fixed', () => {
    const store = createSessionStore(createFakeClock());
    render(<App bank={bank} store={store} />);
    fireEvent.click(screen.getByTestId('home.start'));
    expect(store.getState().trial?.items).toHaveLength(3);
  });

  it('cannot start with an empty bank', () => {
    setup([]);
    expect((screen.getByTestId('home.start') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Grand Trial screen', () => {
  it('shows the first item, its position and the full time', () => {
    const { trial } = startTrial();
    expect(screen.getByTestId('trial.position').textContent).toBe('Question 1 of 3');
    expect(screen.getByTestId('trial.timer').textContent).toBe('25:00');
    expect(trial()?.index).toBe(0);
  });

  it('renders the quantities with KaTeX, including MathML for screen readers', () => {
    startTrial();
    const a = screen.getByTestId('trial.quantity-a');
    expect(a.querySelector('.katex')).not.toBeNull();
    expect(a.querySelector('math')).not.toBeNull();
  });

  it('shows the condition only when the item has one', () => {
    const { key } = startTrial();
    expect(screen.queryByTestId('trial.condition')).toBeNull();
    key('Enter');
    expect(screen.getByTestId('trial.condition').querySelector('.katex')).not.toBeNull();
  });

  it('answer buttons are named by their visible letter and words (WCAG 2.5.3)', () => {
    startTrial();
    expect(screen.getByRole('button', { name: 'A Quantity A is greater' })).toBe(
      screen.getByTestId('trial.answer-A'),
    );
    expect(screen.getByRole('button', { name: 'D Not enough information' })).toBe(
      screen.getByTestId('trial.answer-D'),
    );
  });

  it('a chosen answer keeps its name; aria-pressed carries the choice', () => {
    startTrial();
    fireEvent.click(screen.getByTestId('trial.answer-C'));
    const chosen = screen.getByRole('button', { name: 'C The two quantities are equal' });
    expect(chosen.getAttribute('aria-pressed')).toBe('true');
  });

  it('tapping an answer records it and marks it chosen with text, not only colour', () => {
    const { trial } = startTrial();
    fireEvent.click(screen.getByTestId('trial.answer-B'));
    expect(trial()?.events[0]).toMatchObject({ choice: 'B', correct: true });
    const chosen = screen.getByTestId('trial.answer-B');
    expect(chosen.getAttribute('aria-pressed')).toBe('true');
    expect(chosen.textContent).toMatch(/chosen/i);
  });

  it.each([
    ['1', 'A'],
    ['2', 'B'],
    ['3', 'C'],
    ['4', 'D'],
    ['a', 'A'],
    ['B', 'B'],
    ['c', 'C'],
    ['d', 'D'],
  ])('key %s answers %s', (k, letter) => {
    const { trial, key } = startTrial();
    key(k);
    expect(trial()?.events[0]?.choice).toBe(letter);
  });

  it('ignores keys pressed with Ctrl, Alt or Meta', () => {
    const { trial, key } = startTrial();
    key('a', { ctrlKey: true });
    key('b', { metaKey: true });
    key('c', { altKey: true });
    expect(trial()?.events).toEqual([]);
  });

  it('Enter and → go to the next item, ← goes back', () => {
    const { trial, key } = startTrial();
    key('Enter');
    expect(trial()?.index).toBe(1);
    key('ArrowRight');
    expect(trial()?.index).toBe(2);
    key('ArrowLeft');
    expect(screen.getByTestId('trial.position').textContent).toBe('Question 2 of 3');
  });

  it('Enter goes on to the next item even right after tapping an answer', () => {
    const { trial, key } = startTrial();
    const answer = screen.getByTestId('trial.answer-A');
    answer.focus();
    fireEvent.click(answer);
    key('Enter');
    expect(trial()?.index).toBe(1);
    expect(trial()?.events[0]?.choice).toBe('A');
  });

  it('S skips and F flags', () => {
    const { trial, key } = startTrial();
    key('f');
    expect(screen.getByTestId('trial.flag').getAttribute('aria-pressed')).toBe('true');
    key('s');
    expect(trial()?.events[0]).toMatchObject({ status: 'skipped', flagged: true });
    expect(trial()?.index).toBe(1);
  });

  it('the Back, Skip and Next buttons work by tap', () => {
    const { trial } = startTrial();
    fireEvent.click(screen.getByTestId('trial.next'));
    fireEvent.click(screen.getByTestId('trial.back'));
    expect(trial()?.index).toBe(0);
    fireEvent.click(screen.getByTestId('trial.skip'));
    expect(trial()?.index).toBe(1);
    fireEvent.click(screen.getByTestId('trial.flag'));
    expect(trial()?.flags[1]).toBe(true);
  });

  it('Back is disabled on the first item', () => {
    startTrial();
    expect((screen.getByTestId('trial.back') as HTMLButtonElement).disabled).toBe(true);
  });

  it('on the last item Enter moves focus to Finish instead of ending at once', () => {
    const { trial, key } = startTrial();
    key('Enter');
    key('Enter');
    expect(screen.queryByTestId('trial.next')).toBeNull();
    key('Enter');
    expect(document.activeElement).toBe(screen.getByTestId('trial.finish'));
    expect(trial()?.endReason).toBeNull();
  });

  it('Finish ends the trial and shows the result, with unanswered items recorded', () => {
    const { trial, key } = startTrial();
    key('2');
    key('Enter');
    key('Enter');
    fireEvent.click(screen.getByTestId('trial.finish'));
    expect(trial()?.endReason).toBe('completed');
    expect(trial()?.events.map((e) => e.status)).toEqual(['answered', 'unanswered', 'unanswered']);
    expect(screen.getByTestId('result.score').textContent).toBe('1 of 3 correct');
  });

  it('the timer counts down as time passes', () => {
    const { clock, store } = startTrial();
    act(() => {
      clock.advance(61_000);
      store.getState().tick();
    });
    expect(screen.getByTestId('trial.timer').textContent).toBe('23:59');
  });

  it('time-up ends the trial and says so', () => {
    const { clock, store, trial } = startTrial();
    act(() => {
      clock.advance(EXAM.durationMs);
      store.getState().tick();
    });
    expect(trial()?.endReason).toBe('time_up');
    expect(screen.getByTestId('result.reason').textContent).toMatch(/time/i);
    expect(trial()?.events).toHaveLength(3);
  });

  it('keys do nothing once the trial is over', () => {
    const { trial, key } = startTrial();
    fireEvent.click(screen.getByTestId('trial.skip'));
    fireEvent.click(screen.getByTestId('trial.skip'));
    fireEvent.click(screen.getByTestId('trial.finish'));
    const events = trial()?.events;
    key('1');
    expect(trial()?.events).toBe(events);
  });

  it('records a hidden tab', () => {
    const { trial } = startTrial();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(trial()?.timer.hiddenCount).toBe(1);
  });

  it('from the result, Back to start returns home', () => {
    startTrial();
    fireEvent.click(screen.getByTestId('trial.finish'));
    fireEvent.click(screen.getByTestId('result.home'));
    expect(screen.getByTestId('home.start')).toBeTruthy();
  });
});

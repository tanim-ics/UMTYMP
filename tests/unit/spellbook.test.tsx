// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { QuestionItem } from '../../src/core/questions/schema.ts';
import type { Level, Tag } from '../../src/core/questions/vocabulary.ts';
import { createFakeClock } from '../../src/core/timer/clock.ts';
import { createSessionStore } from '../../src/store/session.ts';
import { App } from '../../src/ui/App.tsx';

afterEach(cleanup);

/** 6 fraction items at level 1 and 6 root items at level 3 (one of them a zero trap). */
const bank: QuestionItem[] = Array.from({ length: 12 }, (_, i) => ({
  id: `test-${String(i + 1).padStart(4, '0')}`,
  quantity_a: '1',
  quantity_b: '2',
  condition: null,
  correct_answer: 'B',
  tags: [(i < 6 ? 'fractions' : 'roots') as Tag],
  trap: i === 11 ? 'zero' : null,
  difficulty: (i < 6 ? 1 : 3) as Level,
  target_seconds: 5,
  shortcut_explanation: 'Look.',
  full_explanation: 'Proof.',
  reviewed_by: 'test',
}));

function openSpellbook() {
  const clock = createFakeClock();
  const store = createSessionStore(clock);
  render(<App bank={bank} store={store} seed={1} />);
  fireEvent.click(screen.getByTestId('home.spellbook'));
  return { clock, store };
}

const check = (testId: string) => fireEvent.click(screen.getByTestId(testId));
const setLength = (value: string) =>
  fireEvent.change(screen.getByTestId('spellbook.length'), { target: { value } });

describe('Spellbook: choosing a set', () => {
  it('offers every topic, trap and level by name', () => {
    openSpellbook();
    expect(screen.getByRole('checkbox', { name: 'Absolute value' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Absolute value trap' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Triangle inequality' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Negative numbers trap' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Level 3: Adept' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Level 5: Archmage' })).toBeTruthy();
  });

  it('names traps in words a student knows, not their ids', () => {
    openSpellbook();
    expect(screen.getByRole('checkbox', { name: 'Fractions between 0 and 1 trap' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Square root trap' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Whole-number assumption trap' })).toBeTruthy();
  });

  it('shows how many questions match as choices change', () => {
    openSpellbook();
    expect(screen.getByTestId('spellbook.matching').textContent).toBe('12 questions match.');
    check('spellbook.level-3');
    expect(screen.getByTestId('spellbook.matching').textContent).toBe('6 questions match.');
    check('spellbook.trap-zero');
    expect(screen.getByTestId('spellbook.matching').textContent).toBe('1 question matches.');
    check('spellbook.trap-zero');
    check('spellbook.tag-fractions');
    expect(screen.getByTestId('spellbook.matching').textContent).toBe('0 questions match.');
    expect((screen.getByTestId('spellbook.start') as HTMLButtonElement).disabled).toBe(true);
  });

  it('says the set will be shorter when fewer questions match than asked for', () => {
    openSpellbook();
    check('spellbook.level-3');
    setLength('10');
    expect(screen.getByTestId('spellbook.shorter').textContent).toMatch(/6 questions/);
  });

  it.each(['4', '51', '7.5', ''])('refuses a length of "%s" (5–50)', (value) => {
    openSpellbook();
    setLength(value);
    expect((screen.getByTestId('spellbook.start') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('spellbook.length-error').textContent).toMatch(/5.*50/);
  });

  it('Back returns home without starting anything', () => {
    const { store } = openSpellbook();
    fireEvent.click(screen.getByTestId('spellbook.back'));
    expect(screen.getByTestId('home.start')).toBeTruthy();
    expect(store.getState().trial).toBeNull();
  });
});

describe('Spellbook: running the set', () => {
  it('an untimed level-3 set of 5 runs on the session screen with a count-up clock', () => {
    const { clock, store } = openSpellbook();
    check('spellbook.level-3');
    setLength('5');
    check('spellbook.start');
    const trial = store.getState().trial;
    expect(trial?.mode).toBe('practice');
    expect(trial?.items).toHaveLength(5);
    expect(trial?.items.every((i) => i.difficulty === 3)).toBe(true);
    expect(screen.getByTestId('trial.position').textContent).toBe('Question 1 of 5');
    expect(screen.getByTestId('trial.timer').textContent).toBe('0:00');
    act(() => {
      clock.advance(42_000);
      store.getState().tick();
    });
    expect(screen.getByTestId('trial.timer').textContent).toBe('0:42');
    expect(screen.getByTestId('trial.timer').getAttribute('aria-label')).toBe('Time spent');
  });

  it('a timed set counts down from 30 s per question', () => {
    const { store } = openSpellbook();
    check('spellbook.level-1');
    setLength('5');
    check('spellbook.timed');
    check('spellbook.start');
    expect(store.getState().trial?.timer.durationMs).toBe(5 * 30_000);
    expect(screen.getByTestId('trial.timer').textContent).toBe('2:30');
  });

  it('finishing shows "Practice complete!" without a coach card', () => {
    openSpellbook();
    setLength('5');
    check('spellbook.start');
    fireEvent.click(screen.getByTestId('trial.finish'));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Practice complete!');
    expect(screen.queryByTestId('coach.card')).toBeNull();
    expect(screen.queryByTestId('result.reason')).toBeNull();
    fireEvent.click(screen.getByTestId('result.home'));
    expect(screen.getByTestId('home.start')).toBeTruthy();
  });
});

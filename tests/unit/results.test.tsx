// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { QuestionItem } from '../../src/core/questions/schema.ts';
import { createFakeClock } from '../../src/core/timer/clock.ts';
import { createSessionStore } from '../../src/store/session.ts';
import { GrandTrial } from '../../src/ui/screens/GrandTrial.tsx';

afterEach(cleanup);

// Keys: item 1 → A, 2 → B, 3 → C, 4 → D.
const bank: QuestionItem[] = (['A', 'B', 'C', 'D'] as const).map((key, i) => ({
  id: `test-${String(i + 1).padStart(4, '0')}`,
  quantity_a: `\\frac{${i + 1}}{2}`,
  quantity_b: '1',
  condition: i === 1 ? 'x > 0' : null,
  correct_answer: key,
  tags: ['fractions'],
  difficulty: 1,
  target_seconds: 5,
  shortcut_explanation: `Shortcut ${i + 1}.`,
  full_explanation: `Proof ${i + 1}.`,
  reviewed_by: 'test',
  ...(key === 'D' ? { trap: 'zero' as const } : {}),
}));

/**
 * A finished trial: item 1 right in 10 s; item 2 wrong (A) in 40 s and flagged; item 3 skipped; item 4 unanswered.
 * The mock builder shuffles, so each step looks up the item on screen by its id.
 */
function finishedTrial() {
  const clock = createFakeClock();
  const store = createSessionStore(clock);
  store.getState().startMock(bank, 1);
  const s = () => store.getState();
  // Moves to the item with this id: back to the start, then forward. Bounded, so a missing id can't hang the test.
  const goTo = (id: string) => {
    const trial = s().trial;
    if (trial === null) throw new Error('no trial');
    for (let i = 0; i < trial.items.length; i++) s().back();
    for (
      let i = 0;
      i < trial.items.length && s().trial?.items[s().trial?.index ?? 0]?.id !== id;
      i++
    ) {
      s().next();
    }
    if (s().trial?.items[s().trial?.index ?? 0]?.id !== id) throw new Error(`item ${id} not found`);
  };
  // Start every item's clock from its own display.
  goTo('test-0001');
  clock.advance(10_000);
  s().answer('A');
  goTo('test-0002');
  clock.advance(40_000);
  s().answer('A');
  s().flag();
  goTo('test-0003');
  s().skip();
  s().finish();
  render(<GrandTrial store={store} />);
  return store;
}

describe('results screen', () => {
  it('shows the score and how the trial went', () => {
    finishedTrial();
    expect(screen.getByTestId('result.score').textContent).toBe('1 of 4 correct');
    expect(screen.getByTestId('result.summary').textContent).toMatch(
      /1 right.*1 wrong.*1 skipped.*1 unanswered.*1 slow/,
    );
  });

  it('offers to review the answers and to go back to start', () => {
    const store = finishedTrial();
    expect(screen.getByRole('button', { name: 'Review answers' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('result.home'));
    expect(store.getState().trial).toBeNull();
  });
});

describe('review screen', () => {
  function openReview() {
    finishedTrial();
    fireEvent.click(screen.getByTestId('result.review'));
    return screen.getAllByTestId('review.item');
  }

  it('lists every question in exam order', () => {
    const items = openReview();
    expect(items).toHaveLength(4);
    expect(items.map((i) => i.querySelector('h2')?.textContent)).toEqual([
      'Question 1',
      'Question 2',
      'Question 3',
      'Question 4',
    ]);
  });

  it('shows your answer, the right answer, the shortcut and the explanation', () => {
    openReview();
    const wrong = screen
      .getAllByTestId('review.item')
      .find((i) => i.textContent?.includes('Shortcut 2.'));
    if (!wrong) throw new Error('item 2 not shown');
    const view = within(wrong);
    expect(view.getByTestId('review.verdict').textContent).toBe('Wrong');
    expect(view.getByTestId('review.your-answer').textContent).toBe(
      'Your answer: A, Quantity A is greater',
    );
    expect(view.getByTestId('review.key').textContent).toBe('Answer: B, Quantity B is greater');
    expect(view.getByTestId('review.time').textContent).toBe('40 s · slow');
    expect(view.getByTestId('review.flagged')).toBeTruthy();
    expect(view.getByText('Proof 2.')).toBeTruthy();
    expect(view.getByTestId('review.condition').querySelector('.katex')).not.toBeNull();
  });

  it('says right, skipped and no answer in words', () => {
    openReview();
    const verdicts = screen.getAllByTestId('review.verdict').map((v) => v.textContent);
    expect([...verdicts].sort()).toEqual(['No answer', 'Right', 'Skipped', 'Wrong']);
    expect(screen.getAllByTestId('review.your-answer').map((v) => v.textContent)).toContain(
      'Your answer: skipped',
    );
  });

  it.each([
    ['all', 4],
    ['wrong', 3],
    ['slow', 1],
    ['flagged', 1],
  ])('the %s filter shows %i questions and says how many', (filter, count) => {
    openReview();
    const button = screen.getByTestId(`review.filter-${filter}`);
    expect(button.textContent).toMatch(new RegExp(`\\(${count}\\)`));
    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryAllByTestId('review.item')).toHaveLength(count);
  });

  it('only one filter is active at a time', () => {
    openReview();
    fireEvent.click(screen.getByTestId('review.filter-slow'));
    fireEvent.click(screen.getByTestId('review.filter-flagged'));
    expect(screen.getByTestId('review.filter-slow').getAttribute('aria-pressed')).toBe('false');
  });

  it('says so when a filter has nothing to show', () => {
    const clock = createFakeClock();
    const store = createSessionStore(clock);
    store.getState().startMock(bank, 1);
    for (const letter of ['A', 'B', 'C', 'D'] as const) {
      const item = store.getState().trial?.items[store.getState().trial?.index ?? 0];
      store.getState().answer(item?.correct_answer ?? letter);
      store.getState().next();
    }
    store.getState().finish();
    render(<GrandTrial store={store} />);
    fireEvent.click(screen.getByTestId('result.review'));
    fireEvent.click(screen.getByTestId('review.filter-wrong'));
    expect(screen.getByTestId('review.empty').textContent).toMatch(/nothing/i);
  });

  it('Back to results leaves the review', () => {
    openReview();
    fireEvent.click(screen.getByTestId('review.back'));
    expect(screen.getByTestId('result.score')).toBeTruthy();
  });
});

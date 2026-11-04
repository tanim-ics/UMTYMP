// A test session (mock, drill or practice) as immutable state plus pure actions taking the clock reading `now`.
// Every answer or skip updates `events` at once, so the store can save each one as it happens.
import type { QuestionItem } from '../questions/schema.ts';
import type { Answer } from '../questions/vocabulary.ts';
import { checkTimeUp, startTimer, type TimerState } from '../timer/session.ts';
import type { AttemptEvent, SessionMode } from './attempt.ts';

export type EndReason = 'completed' | 'time_up';

export interface TrialState {
  readonly sessionId: string;
  readonly mode: SessionMode;
  readonly items: readonly QuestionItem[];
  readonly index: number;
  /** When the current item was shown. */
  readonly shownAt: number;
  /** When each item was last shown; null if never. */
  readonly lastShownAt: readonly (number | null)[];
  readonly flags: readonly boolean[];
  /** At most one event per item, ordered by position. */
  readonly events: readonly AttemptEvent[];
  readonly timer: TimerState;
  readonly endReason: EndReason | null;
}

export function startTrial(
  options: {
    sessionId: string;
    mode: SessionMode;
    items: readonly QuestionItem[];
    durationMs: number | null;
  },
  now: number,
): TrialState {
  const { sessionId, mode, items, durationMs } = options;
  if (items.length === 0) throw new Error('a trial needs at least one item');
  return {
    sessionId,
    mode,
    items,
    index: 0,
    shownAt: now,
    lastShownAt: items.map((_, i) => (i === 0 ? now : null)),
    flags: items.map(() => false),
    events: [],
    // Only a mock forbids pausing; drills and practice use the pausable timer.
    timer: startTimer({ mode: mode === 'mock' ? 'mock' : 'drill', durationMs }, now),
    endReason: null,
  };
}

function eventAt(state: TrialState, position: number): AttemptEvent | undefined {
  return state.events.find((e) => e.position === position);
}

function withEvent(state: TrialState, event: AttemptEvent): TrialState {
  const others = state.events.filter((e) => e.position !== event.position);
  return { ...state, events: [...others, event].sort((a, b) => a.position - b.position) };
}

function baseEvent(state: TrialState, position: number) {
  const item = state.items[position] as QuestionItem;
  return {
    sessionId: state.sessionId,
    mode: state.mode,
    itemId: item.id,
    position,
    level: item.difficulty,
    tags: item.tags,
    trap: item.trap ?? null,
    correctAnswer: item.correct_answer,
    flagged: state.flags[position] ?? false,
  };
}

function moveTo(state: TrialState, index: number, now: number): TrialState {
  if (index < 0 || index >= state.items.length || index === state.index) return state;
  const lastShownAt = state.lastShownAt.map((t, i) => (i === index ? now : t));
  return { ...state, index, shownAt: now, lastShownAt };
}

export function answerItem(state: TrialState, choice: Answer, now: number): TrialState {
  if (state.endReason !== null) return state;
  const previous = eventAt(state, state.index);
  const changed = previous?.status === 'answered' && previous.choice !== choice;
  if (previous?.status === 'answered' && !changed) return state;
  const base = baseEvent(state, state.index);
  return withEvent(state, {
    ...base,
    choice,
    status: 'answered',
    correct: choice === base.correctAnswer,
    shownAt: state.shownAt,
    answeredAt: now,
    answerChanges: (previous?.answerChanges ?? 0) + (changed ? 1 : 0),
  });
}

/** Records a skip (unless the item already has an answer) and moves to the next item. */
export function skipItem(state: TrialState, now: number): TrialState {
  if (state.endReason !== null) return state;
  const skipped =
    eventAt(state, state.index) === undefined
      ? withEvent(state, {
          ...baseEvent(state, state.index),
          choice: null,
          status: 'skipped',
          correct: false,
          shownAt: state.shownAt,
          answeredAt: now,
          answerChanges: 0,
        })
      : state;
  return moveTo(skipped, state.index + 1, now);
}

export function nextItem(state: TrialState, now: number): TrialState {
  return state.endReason === null ? moveTo(state, state.index + 1, now) : state;
}

export function backItem(state: TrialState, now: number): TrialState {
  return state.endReason === null ? moveTo(state, state.index - 1, now) : state;
}

export function toggleFlag(state: TrialState): TrialState {
  if (state.endReason !== null) return state;
  const flagged = !state.flags[state.index];
  const flags = state.flags.map((f, i) => (i === state.index ? flagged : f));
  const event = eventAt(state, state.index);
  const next = { ...state, flags };
  return event === undefined ? next : withEvent(next, { ...event, flagged });
}

/** Ends the session and records every item without an event as unanswered (docs/SPEC.md S1). */
export function finishTrial(state: TrialState, reason: EndReason): TrialState {
  if (state.endReason !== null) return state;
  let ended: TrialState = { ...state, endReason: reason };
  state.items.forEach((_, position) => {
    if (eventAt(ended, position) !== undefined) return;
    ended = withEvent(ended, {
      ...baseEvent(ended, position),
      choice: null,
      status: 'unanswered',
      correct: false,
      shownAt: state.lastShownAt[position] ?? null,
      answeredAt: null,
      answerChanges: 0,
    });
  });
  return ended;
}

/** Call on every screen tick and on returning to the tab: ends the session when its time is up. */
export function tickTrial(state: TrialState, now: number): TrialState {
  const { state: timer, fired } = checkTimeUp(state.timer, now);
  return fired ? finishTrial({ ...state, timer }, 'time_up') : state;
}

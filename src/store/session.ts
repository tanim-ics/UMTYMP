// The live session for the screens. All rules live in src/core/session/trial.ts; this store only reads the clock,
// applies a rule and keeps the result, so screens re-render. Task 10 saves `trial.events` to IndexedDB from here.
import { createStore, type StoreApi } from 'zustand/vanilla';
import { EXAM } from '../core/config/exam.ts';
import { buildMock } from '../core/questions/build.ts';
import type { QuestionItem } from '../core/questions/schema.ts';
import type { Answer } from '../core/questions/vocabulary.ts';
import {
  answerItem,
  backItem,
  finishTrial,
  nextItem,
  skipItem,
  startTrial,
  tickTrial,
  toggleFlag,
  type TrialState,
} from '../core/session/trial.ts';
import type { Clock } from '../core/timer/clock.ts';
import { markHidden, markVisible } from '../core/timer/session.ts';

export interface SessionStore {
  trial: TrialState | null;
  /** The clock reading at the last action or tick; screens derive the timer text from it. */
  now: number;
  /** True once a save to this browser's storage has failed; the home screen then says answers aren't kept. */
  saveFailed: boolean;
  reportSaveError(): void;
  startMock(bank: readonly QuestionItem[], seed: number, recentMocks?: readonly string[][]): void;
  /** Continues a saved session after a reload: closes the reload's hidden spell, ends it if time ran out. */
  resume(trial: TrialState): void;
  answer(choice: Answer): void;
  skip(): void;
  next(): void;
  back(): void;
  flag(): void;
  finish(): void;
  tick(): void;
  setHidden(hidden: boolean): void;
  reset(): void;
}

export type SessionStoreApi = StoreApi<SessionStore>;

export function createSessionStore(clock: Clock): SessionStoreApi {
  let sessions = 0;
  return createStore<SessionStore>()((set, get) => {
    /** Applies a trial rule at the current clock reading; does nothing without a trial. */
    const apply = (rule: (trial: TrialState, now: number) => TrialState) => {
      const { trial } = get();
      if (trial === null) return;
      const now = clock.now();
      set({ trial: rule(trial, now), now });
    };
    return {
      trial: null,
      now: clock.now(),
      saveFailed: false,
      reportSaveError: () => set({ saveFailed: true }),
      startMock(bank, seed, recentMocks) {
        const { items } = buildMock(bank, { seed, recentMocks });
        if (items.length === 0) return;
        const now = clock.now();
        sessions += 1;
        const sessionId = `mock-${seed}-${Math.round(now)}-${sessions}`;
        set({
          trial: startTrial({ sessionId, mode: 'mock', items, durationMs: EXAM.durationMs }, now),
          now,
        });
      },
      resume(trial) {
        const now = clock.now();
        // The old page was hidden as it unloaded; the new page is the student coming back, so that hidden spell
        // ends now. Otherwise hidden time would grow for the rest of the mock and later switches go unrecorded.
        const back = { ...trial, timer: markVisible(trial.timer, now) };
        set({ trial: tickTrial(back, now), now });
      },
      answer: (choice) => apply((t, now) => answerItem(t, choice, now)),
      skip: () => apply(skipItem),
      next: () => apply(nextItem),
      back: () => apply(backItem),
      flag: () => apply(toggleFlag),
      finish: () => apply((t) => finishTrial(t, 'completed')),
      tick: () => apply(tickTrial),
      setHidden: (hidden) =>
        apply((t, now) =>
          hidden
            ? { ...t, timer: markHidden(t.timer, now) }
            : tickTrial({ ...t, timer: markVisible(t.timer, now) }, now),
        ),
      reset: () => set({ trial: null, now: clock.now() }),
    };
  });
}

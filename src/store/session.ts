// The live session for the screens. All rules live in src/core/session/trial.ts; this store only reads the clock,
// applies a rule and keeps the result, so screens re-render. Task 10 saves `trial.events` to IndexedDB from here.
import { createStore, type StoreApi } from 'zustand/vanilla';
import { EXAM } from '../core/config/exam.ts';
import {
  buildDrill,
  buildMock,
  buildPractice,
  type DrillFocus,
  type PracticeFilters,
} from '../core/questions/build.ts';
import type { QuestionItem } from '../core/questions/schema.ts';
import type { Answer } from '../core/questions/vocabulary.ts';
import {
  answerItem,
  backItem,
  finishTrial,
  nextItem,
  pauseTrial,
  resumeTrial,
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
  /** Who is playing; every saved session belongs to this profile. */
  profileId: string | null;
  /** Switches student: forgets any session on screen (the old one stays saved under its own profile). */
  setProfile(profileId: string | null): void;
  /** The finished mock a potion drill was started from, so the student can go back to its results. */
  returnTo: TrialState | null;
  /** True once a save to this browser's storage has failed; the home screen then says answers aren't kept. */
  saveFailed: boolean;
  reportSaveError(): void;
  startMock(bank: readonly QuestionItem[], seed: number, recentMocks?: readonly string[][]): void;
  /** Continues a saved session after a reload: closes the reload's hidden spell, ends it if time ran out. */
  resume(trial: TrialState): void;
  /** A 10-question potion drill (untimed, may pause). Started from a finished mock, that mock is kept in `returnTo`. */
  startDrill(bank: readonly QuestionItem[], focus: DrillFocus, seed: number): void;
  /** Spellbook practice; timed means the exam pace of 30 s per question. Answers can change, as in a mock. */
  startPractice(
    bank: readonly QuestionItem[],
    options: PracticeFilters & { length: number; timed: boolean },
    seed: number,
  ): void;
  /** Back to the results of the mock the drill came from, or home if there is none. */
  backToResults(): void;
  pause(): void;
  unpause(): void;
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
      returnTo: null,
      profileId: null,
      setProfile: (profileId) => set({ profileId, trial: null, returnTo: null, now: clock.now() }),
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
      startDrill(bank, focus, seed) {
        const { items } = buildDrill(bank, { seed, focus });
        if (items.length === 0) return;
        const now = clock.now();
        sessions += 1;
        const current = get().trial;
        set({
          trial: startTrial(
            {
              sessionId: `drill-${seed}-${Math.round(now)}-${sessions}`,
              mode: 'drill',
              items,
              durationMs: null,
            },
            now,
          ),
          returnTo: current?.mode === 'mock' && current.endReason !== null ? current : null,
          now,
        });
      },
      startPractice(bank, options, seed) {
        const { items } = buildPractice(bank, { ...options, seed });
        if (items.length === 0) return;
        const now = clock.now();
        sessions += 1;
        const durationMs = options.timed ? items.length * EXAM.secondsPerQuestion * 1000 : null;
        set({
          trial: startTrial(
            {
              sessionId: `practice-${seed}-${Math.round(now)}-${sessions}`,
              mode: 'practice',
              items,
              durationMs,
            },
            now,
          ),
          returnTo: null,
          now,
        });
      },
      backToResults: () => set({ trial: get().returnTo, returnTo: null, now: clock.now() }),
      pause: () => apply(pauseTrial),
      unpause: () => apply(resumeTrial),
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
      reset: () => set({ trial: null, returnTo: null, now: clock.now() }),
    };
  });
}

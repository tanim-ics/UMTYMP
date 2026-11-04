// Dev-build-only hooks for Playwright and manual checks (CLAUDE.md §8). main.tsx loads this file only when
// import.meta.env.DEV is true, so it never reaches the production bundle.
import type { QuestionItem } from '../core/questions/schema.ts';
import type { Answer } from '../core/questions/vocabulary.ts';
import type { FakeClock } from '../core/timer/clock.ts';
import { remainingMs } from '../core/timer/session.ts';
import type { SessionStoreApi } from '../store/session.ts';

export interface TestHooks {
  state(): unknown;
  seed(n: number): void;
  answer(letter: Answer): void;
  /** Resolves when every change so far is saved (tests reload only after this). */
  flush(): Promise<void>;
  clock?: { advance(ms: number): void };
}

declare global {
  interface Window {
    __umtymp?: TestHooks;
  }
}

export function installTestHooks(options: {
  store: SessionStoreApi;
  bank: readonly QuestionItem[];
  fakeClock: FakeClock | null;
  flush: () => Promise<void>;
}): void {
  const { store, bank, fakeClock, flush } = options;
  window.__umtymp = {
    state() {
      const { trial, now } = store.getState();
      if (trial === null) return { screen: 'home', bankSize: bank.length };
      return {
        screen: trial.endReason === null ? 'trial' : 'result',
        index: trial.index,
        itemId: trial.items[trial.index]?.id ?? null,
        total: trial.items.length,
        remainingMs: remainingMs(trial.timer, now),
        endReason: trial.endReason,
        answers: trial.events.map((e) => ({
          itemId: e.itemId,
          status: e.status,
          choice: e.choice,
        })),
        hiddenCount: trial.timer.hiddenCount,
      };
    },
    seed: (n) => store.getState().startMock(bank, n),
    answer: (letter) => store.getState().answer(letter),
    flush,
    ...(fakeClock === null
      ? {}
      : {
          clock: {
            advance(ms: number) {
              fakeClock.advance(ms);
              store.getState().tick();
            },
          },
        }),
  };
}

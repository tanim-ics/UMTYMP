// Dev-build-only hooks for Playwright and manual checks (CLAUDE.md §8). main.tsx loads this file only when
// import.meta.env.DEV is true, so it never reaches the production bundle.
import { coach, type SessionRecord } from '../core/analytics/coach.ts';
import type { QuestionItem } from '../core/questions/schema.ts';
import type { Answer } from '../core/questions/vocabulary.ts';
import type { FakeClock } from '../core/timer/clock.ts';
import { buildFixture, FIXTURES, type FixtureName } from './fixtures.ts';
import { remainingMs } from '../core/timer/session.ts';
import type { SessionStoreApi } from '../store/session.ts';

export interface TestHooks {
  state(): unknown;
  seed(n: number): void;
  answer(letter: Answer): void;
  /** Resolves when every change so far is saved (tests reload only after this). */
  flush(): Promise<void>;
  /** Hoot's sentences for the current student from saved history (null fields when there isn't enough data). */
  coachTexts(): Promise<{ strength: string | null; bottleneck: string | null }>;
  /** Shows the results of a finished sample mock: `all-right`, `all-wrong` or `not-enough-data`. */
  loadFixture(name: FixtureName): void;
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
  /** Saved history by profile; absent when storage is unavailable. */
  listHistory?: (profileId: string) => Promise<SessionRecord[]>;
}): void {
  const { store, bank, fakeClock, flush, listHistory } = options;
  window.__umtymp = {
    state() {
      const { trial, now } = store.getState();
      const { profileId } = store.getState();
      if (trial === null) return { screen: 'home', bankSize: bank.length, profileId };
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
          correct: e.correct,
        })),
        hiddenCount: trial.timer.hiddenCount,
        profileId,
      };
    },
    seed: (n) => store.getState().startMock(bank, n),
    answer: (letter) => store.getState().answer(letter),
    flush,
    async coachTexts() {
      const { profileId } = store.getState();
      const history =
        profileId === null || listHistory === undefined ? [] : await listHistory(profileId);
      const feedback = coach(history);
      return feedback.kind === 'feedback'
        ? { strength: feedback.strengthText, bottleneck: feedback.bottleneckText }
        : { strength: null, bottleneck: null };
    },
    loadFixture(name) {
      if (!FIXTURES.includes(name))
        throw new Error(`unknown fixture "${name}"; use ${FIXTURES.join(', ')}`);
      store.getState().resume(buildFixture(name, bank, store.getState().now));
    },
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

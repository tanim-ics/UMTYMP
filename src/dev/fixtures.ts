// Dev builds only: finished sample mocks for `window.__umtymp.loadFixture(name)`, built from the real bank with the
// real trial rules, so the results and coach screens can be shown in a known state.
import { EXAM } from '../core/config/exam.ts';
import { buildMock } from '../core/questions/build.ts';
import type { QuestionItem } from '../core/questions/schema.ts';
import type { Answer } from '../core/questions/vocabulary.ts';
import {
  answerItem,
  finishTrial,
  nextItem,
  startTrial,
  type TrialState,
} from '../core/session/trial.ts';

export const FIXTURES = ['all-right', 'all-wrong', 'not-enough-data'] as const;
export type FixtureName = (typeof FIXTURES)[number];

const WRONG: Readonly<Record<Answer, Answer>> = { A: 'B', B: 'C', C: 'D', D: 'A' };

/** A finished mock: every item right, every item wrong, or only 3 answers (too few for the coach). */
export function buildFixture(
  name: FixtureName,
  bank: readonly QuestionItem[],
  now: number,
): TrialState {
  const { items } = buildMock(bank, { seed: 7 });
  let trial = startTrial(
    {
      sessionId: `fixture-${name}-${Math.round(now)}`,
      mode: 'mock',
      items,
      durationMs: EXAM.durationMs,
    },
    now,
  );
  const answers = name === 'not-enough-data' ? 3 : items.length;
  for (let i = 0; i < answers; i++) {
    const key = trial.items[trial.index]?.correct_answer ?? 'A';
    // 20 s per answer: well inside the 30 s pace, so the fixture never looks slow.
    trial = answerItem(trial, name === 'all-wrong' ? WRONG[key] : key, now + (i + 1) * 20_000);
    trial = nextItem(trial, now + (i + 1) * 20_000);
  }
  return finishTrial(trial, 'completed');
}

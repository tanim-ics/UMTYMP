import { useRef } from 'react';
import { useStore } from 'zustand';
import type { QuestionItem } from '../../core/questions/schema.ts';
import type { TrialState } from '../../core/session/trial.ts';
import { elapsedMs, remainingMs } from '../../core/timer/session.ts';
import type { ProfileHistory } from '../../data/attempts.ts';
import type { SessionStoreApi } from '../../store/session.ts';
import { Art } from '../components/Art.tsx';
import { AnswerButtons, NavButtons, QuestionView } from '../components/Question.tsx';
import { formatTime, useTrialControls } from '../components/useTrialControls.ts';
import styles from './GrandTrial.module.css';
import { PotionDrill } from './PotionDrill.tsx';
import { Results } from './Results.tsx';

export interface SessionScreenProps {
  store: SessionStoreApi;
  /** The bank potion drills are drawn from. */
  bank?: readonly QuestionItem[];
  /** Saved sessions for the coach; absent when storage is unavailable. */
  history?: Pick<ProfileHistory, 'listHistory'>;
}

/** Shows the running session (mock or drill) or, once it ends, its results. */
export function GrandTrial({ store, bank = [], history }: SessionScreenProps) {
  const trial = useStore(store, (s) => s.trial);
  if (trial === null) return null;
  if (trial.endReason !== null) {
    return <Results trial={trial} store={store} bank={bank} history={history} />;
  }
  if (trial.mode === 'drill') return <PotionDrill trial={trial} store={store} />;
  return <MockScreen trial={trial} store={store} />;
}

function MockScreen({ trial, store }: { trial: TrialState; store: SessionStoreApi }) {
  const now = useStore(store, (s) => s.now);
  const finishRef = useRef<HTMLButtonElement>(null);
  useTrialControls(store, finishRef, { canPause: false });

  const item = trial.items[trial.index];
  if (item === undefined) return null;
  const chosen = trial.events.find((e) => e.position === trial.index)?.choice ?? null;
  const flagged = trial.flags[trial.index] ?? false;
  const { answer, back, skip, next, flag, finish } = store.getState();
  // Untimed Spellbook practice has no countdown, so the clock counts up instead.
  const left = remainingMs(trial.timer, now);

  return (
    <main
      className={styles.screen}
      aria-label={trial.mode === 'mock' ? 'Grand Trial' : 'Spellbook practice'}
    >
      <div className={styles.bar}>
        <span data-testid="trial.position" className={styles.player}>
          <Art name="hoot" testId="trial.mascot" />
          Question {trial.index + 1} of {trial.items.length}
        </span>
        <span
          className={styles.timer}
          role="timer"
          aria-label={left === null ? 'Time spent' : 'Time left'}
          data-testid="trial.timer"
        >
          {left === null ? formatTime(elapsedMs(trial.timer, now), 'down') : formatTime(left, 'up')}
        </span>
        <button
          type="button"
          className={styles.button}
          aria-pressed={flagged}
          onClick={flag}
          data-testid="trial.flag"
        >
          {flagged ? 'Flagged (F)' : 'Flag (F)'}
        </button>
      </div>
      <QuestionView item={item} />
      <AnswerButtons chosen={chosen} onAnswer={answer} />
      <NavButtons
        index={trial.index}
        total={trial.items.length}
        finishLabel={trial.mode === 'mock' ? 'Finish trial' : 'Finish practice'}
        finishRef={finishRef}
        onBack={back}
        onSkip={skip}
        onNext={next}
        onFinish={finish}
      />
    </main>
  );
}

import { useState } from 'react';
import { useStore } from 'zustand';
import { resultSummary } from '../../core/analytics/review.ts';
import type { QuestionItem } from '../../core/questions/schema.ts';
import type { TrialState } from '../../core/session/trial.ts';
import type { ProfileHistory } from '../../data/attempts.ts';
import type { SessionStoreApi } from '../../store/session.ts';
import { Art } from '../components/Art.tsx';
import { CoachCard } from '../components/CoachCard.tsx';
import styles from './GrandTrial.module.css';
import { Review } from './Review.tsx';

function heading(trial: TrialState): string {
  if (trial.mode === 'drill') return 'Potion brewed!';
  if (trial.mode === 'practice') return 'Practice complete!';
  return trial.endReason === 'time_up' ? 'Time is up!' : 'Trial complete!';
}

export function Results(props: {
  trial: TrialState;
  store: SessionStoreApi;
  bank: readonly QuestionItem[];
  history?: Pick<ProfileHistory, 'listHistory'>;
}) {
  const { trial, store, bank, history } = props;
  const [reviewing, setReviewing] = useState(false);
  const hasMockToReturnTo = useStore(store, (s) => s.returnTo !== null);
  if (reviewing) return <Review trial={trial} onBack={() => setReviewing(false)} />;

  const s = resultSummary(trial.events);
  return (
    <main className={`${styles.screen} ${styles.result}`} aria-label="Results">
      {/* The only celebration in the app: results come after the clock has stopped (docs/SPEC.md, calm tests). */}
      <div className={styles.celebrate} aria-hidden="true" data-testid="result.celebrate">
        <span className={styles.star} />
        <Art name={trial.mode === 'drill' ? 'potion' : 'hoot'} size="medium" testId="result.art" />
        <span className={styles.star} />
      </div>
      <h1>{heading(trial)}</h1>
      <p data-testid="result.score">
        {s.correct} of {s.total} correct
      </p>
      <p data-testid="result.summary">
        {s.correct} right · {s.wrong} wrong · {s.skipped} skipped · {s.unanswered} unanswered ·{' '}
        {s.slow} slow
      </p>
      {trial.mode === 'mock' && (
        <p data-testid="result.reason">
          {trial.endReason === 'time_up'
            ? 'The time ran out, so questions without an answer were saved as unanswered.'
            : 'You finished the trial. Questions without an answer were saved as unanswered.'}
        </p>
      )}
      {trial.mode === 'mock' && (
        <CoachCard trial={trial} bank={bank} store={store} history={history} />
      )}
      <div className={styles.nav}>
        <button
          type="button"
          className={styles.button}
          onClick={() => setReviewing(true)}
          data-testid="result.review"
        >
          Review answers
        </button>
        {hasMockToReturnTo ? (
          <button
            type="button"
            className={styles.button}
            onClick={store.getState().backToResults}
            data-testid="result.back"
          >
            Back to trial results
          </button>
        ) : (
          <button
            type="button"
            className={styles.button}
            onClick={store.getState().reset}
            data-testid="result.home"
          >
            Back to start
          </button>
        )}
      </div>
    </main>
  );
}

import { useState } from 'react';
import { timeMs } from '../../core/analytics/metrics.ts';
import {
  REVIEW_FILTERS,
  filterCounts,
  matchesFilter,
  type ReviewFilter,
} from '../../core/analytics/review.ts';
import type { AttemptEvent } from '../../core/session/attempt.ts';
import type { TrialState } from '../../core/session/trial.ts';
import { ANSWER_WORDS } from '../answers.ts';
import { MathView } from '../components/MathView.tsx';
import styles from './GrandTrial.module.css';

const FILTER_LABELS: Record<ReviewFilter, string> = {
  all: 'All',
  wrong: 'Wrong or missed',
  slow: 'Slow',
  flagged: 'Flagged',
};

function verdict(e: AttemptEvent): string {
  if (e.status === 'skipped') return 'Skipped';
  if (e.status === 'unanswered') return 'No answer';
  return e.correct ? 'Right' : 'Wrong';
}

function yourAnswer(e: AttemptEvent): string {
  if (e.choice !== null) return `Your answer: ${e.choice}, ${ANSWER_WORDS[e.choice]}`;
  return e.status === 'skipped' ? 'Your answer: skipped' : 'Your answer: none';
}

export function Review({ trial, onBack }: { trial: TrialState; onBack: () => void }) {
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const counts = filterCounts(trial.events);
  const shown = trial.events.filter((e) => matchesFilter(e, filter));

  return (
    <main className={styles.screen} aria-label="Review answers">
      <button
        type="button"
        className={styles.topBack}
        onClick={onBack}
        data-testid="review.back-top"
      >
        ← Back to results
      </button>
      <h1>Review answers</h1>
      <div className={styles.nav} role="group" aria-label="Show">
        {REVIEW_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`${styles.button} ${filter === f ? styles.chosen : ''}`}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            data-testid={`review.filter-${f}`}
          >
            {FILTER_LABELS[f]} ({counts[f]})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p data-testid="review.empty">Nothing to show here. Well done!</p>
      ) : (
        <ol className={styles.reviewList}>
          {shown.map((e) => {
            const item = trial.items[e.position];
            if (item === undefined) return null;
            const ms = timeMs(e);
            const slow = matchesFilter(e, 'slow');
            return (
              <li key={e.position} className={styles.quantity} data-testid="review.item">
                <article aria-labelledby={`review-q-${e.position}`}>
                  <h2 id={`review-q-${e.position}`}>Question {e.position + 1}</h2>
                  <p>
                    <strong data-testid="review.verdict">{verdict(e)}</strong>
                    {e.flagged && <span data-testid="review.flagged"> · flagged</span>}
                  </p>
                  {item.condition !== null && (
                    <p>
                      Given: <MathView latex={item.condition} testId="review.condition" />
                    </p>
                  )}
                  <p>
                    A: <MathView latex={item.quantity_a} /> · B:{' '}
                    <MathView latex={item.quantity_b} />
                  </p>
                  <p data-testid="review.your-answer">{yourAnswer(e)}</p>
                  <p data-testid="review.key">
                    Answer: {e.correctAnswer}, {ANSWER_WORDS[e.correctAnswer]}
                  </p>
                  {ms !== null && (
                    <p data-testid="review.time">
                      {Math.round(ms / 1000)} s{slow ? ' · slow' : ''}
                    </p>
                  )}
                  <p>
                    <strong>Shortcut:</strong> {item.shortcut_explanation}
                  </p>
                  <p>
                    <strong>Why:</strong> {item.full_explanation}
                  </p>
                </article>
              </li>
            );
          })}
        </ol>
      )}

      <button type="button" className={styles.button} onClick={onBack} data-testid="review.back">
        ← Back to results
      </button>
    </main>
  );
}

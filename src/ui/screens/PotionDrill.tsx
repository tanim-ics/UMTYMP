import { useRef } from 'react';
import { useStore } from 'zustand';
import type { TrialState } from '../../core/session/trial.ts';
import { elapsedMs } from '../../core/timer/session.ts';
import type { SessionStoreApi } from '../../store/session.ts';
import { ANSWER_WORDS } from '../answers.ts';
import { AnswerButtons, NavButtons, QuestionView } from '../components/Question.tsx';
import { formatTime, useTrialControls } from '../components/useTrialControls.ts';
import styles from './GrandTrial.module.css';

/**
 * A potion drill (docs/SPEC.md S4): untimed, may pause, and shows the shortcut right after each answer. While
 * paused the question is hidden, so a pause can't hide thinking time.
 */
export function PotionDrill({ trial, store }: { trial: TrialState; store: SessionStoreApi }) {
  const now = useStore(store, (s) => s.now);
  const finishRef = useRef<HTMLButtonElement>(null);
  useTrialControls(store, finishRef, { canPause: true });

  const item = trial.items[trial.index];
  if (item === undefined) return null;
  const event = trial.events.find((e) => e.position === trial.index);
  const answered = event?.status === 'answered';
  const paused = trial.timer.pausedAt !== null;
  const { answer, back, skip, next, finish, pause, unpause } = store.getState();

  return (
    <main className={styles.screen} aria-label="Potion practice">
      <div className={styles.bar}>
        <span data-testid="drill.position">
          Potion question {trial.index + 1} of {trial.items.length}
        </span>
        <span
          className={styles.timer}
          role="timer"
          aria-label="Time spent"
          data-testid="drill.timer"
        >
          {formatTime(elapsedMs(trial.timer, now), 'down')}
        </span>
        <button
          type="button"
          className={styles.button}
          onClick={paused ? unpause : pause}
          data-testid="drill.pause"
        >
          {paused ? 'Resume (P)' : 'Pause (P)'}
        </button>
      </div>

      {paused ? (
        <section className={`${styles.quantity} ${styles.result}`} data-testid="drill.paused">
          <h2>Paused</h2>
          <p>The question is hidden while you rest. Come back when you are ready.</p>
          <button
            type="button"
            className={styles.button}
            onClick={unpause}
            data-testid="drill.resume"
          >
            Resume
          </button>
        </section>
      ) : (
        <>
          <QuestionView item={item} />
          <AnswerButtons chosen={event?.choice ?? null} onAnswer={answer} locked={answered} />
          {answered && (
            <p role="status" className={styles.quantity} data-testid="drill.feedback">
              {event.correct
                ? 'Right! '
                : `Not quite. The answer is ${item.correct_answer}, ${ANSWER_WORDS[item.correct_answer]}. `}
              <strong>Shortcut:</strong> {item.shortcut_explanation}
            </p>
          )}
          <NavButtons
            index={trial.index}
            total={trial.items.length}
            finishLabel="Finish potion"
            finishRef={finishRef}
            onBack={back}
            onSkip={skip}
            onNext={next}
            onFinish={finish}
          />
        </>
      )}
    </main>
  );
}

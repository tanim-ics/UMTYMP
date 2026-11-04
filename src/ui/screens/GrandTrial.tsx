import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import type { Answer } from '../../core/questions/vocabulary.ts';
import type { TrialState } from '../../core/session/trial.ts';
import { remainingMs } from '../../core/timer/session.ts';
import type { SessionStoreApi } from '../../store/session.ts';
import { MathView } from '../components/MathView.tsx';
import styles from './GrandTrial.module.css';

const ANSWER_WORDS: Record<Answer, string> = {
  A: 'Quantity A is greater',
  B: 'Quantity B is greater',
  C: 'The two quantities are equal',
  D: 'Not enough information',
};
const LETTERS: readonly Answer[] = ['A', 'B', 'C', 'D'];
const KEY_TO_ANSWER: Readonly<Record<string, Answer>> = {
  '1': 'A',
  '2': 'B',
  '3': 'C',
  '4': 'D',
  a: 'A',
  b: 'B',
  c: 'C',
  d: 'D',
};
// The clock is read on each tick; 250 ms keeps the seconds display within a quarter second of the truth.
const TICK_MS = 250;

function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function GrandTrial({ store }: { store: SessionStoreApi }) {
  const trial = useStore(store, (s) => s.trial);
  const now = useStore(store, (s) => s.now);
  const finishRef = useRef<HTMLButtonElement>(null);
  const running = trial !== null && trial.endReason === null;

  useEffect(() => {
    if (!running) return undefined;
    const { tick, setHidden } = store.getState();
    const interval = setInterval(tick, TICK_MS);
    const onVisibility = () => setHidden(document.visibilityState === 'hidden');
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const s = store.getState();
      const t = s.trial;
      if (t === null || t.endReason !== null) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      // A focused control button (Back, Finish…) handles its own Enter; answer buttons don't, so Enter moves on.
      const onControl = target?.tagName === 'BUTTON' && target.dataset.answer === undefined;
      if (e.key === 'Enter' || e.key === 'ArrowRight') {
        if (e.key === 'Enter' && onControl) return;
        e.preventDefault();
        // Finishing ends the trial for good, so the last Enter only moves focus to Finish.
        if (t.index === t.items.length - 1) finishRef.current?.focus();
        else s.next();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        s.back();
        return;
      }
      const key = e.key.toLowerCase();
      const letter = KEY_TO_ANSWER[key];
      if (letter !== undefined) s.answer(letter);
      else if (key === 's') s.skip();
      else if (key === 'f') s.flag();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [running, store]);

  if (trial === null) return null;
  if (trial.endReason !== null) return <TrialResult trial={trial} store={store} />;

  const item = trial.items[trial.index];
  if (item === undefined) return null;
  const chosen = trial.events.find((e) => e.position === trial.index)?.choice ?? null;
  const flagged = trial.flags[trial.index] ?? false;
  const isLast = trial.index === trial.items.length - 1;
  const { answer, back, skip, next, flag, finish } = store.getState();

  return (
    <main className={styles.screen} aria-label="Grand Trial">
      <div className={styles.bar}>
        <span data-testid="trial.position">
          Question {trial.index + 1} of {trial.items.length}
        </span>
        <span
          className={styles.timer}
          role="timer"
          aria-label="Time left"
          data-testid="trial.timer"
        >
          {formatTime(remainingMs(trial.timer, now) ?? 0)}
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

      {item.condition !== null && (
        <p className={styles.condition}>
          Given: <MathView latex={item.condition} testId="trial.condition" />
        </p>
      )}

      <div className={styles.quantities}>
        <section className={styles.quantity} aria-label="Quantity A">
          <h2>Quantity A</h2>
          <MathView latex={item.quantity_a} testId="trial.quantity-a" />
        </section>
        <section className={styles.quantity} aria-label="Quantity B">
          <h2>Quantity B</h2>
          <MathView latex={item.quantity_b} testId="trial.quantity-b" />
        </section>
      </div>

      <div className={styles.answers} role="group" aria-label="Your answer">
        {LETTERS.map((letter) => (
          <button
            key={letter}
            type="button"
            data-answer={letter}
            data-testid={`trial.answer-${letter}`}
            aria-pressed={chosen === letter}
            className={`${styles.answer} ${chosen === letter ? styles.chosen : ''}`}
            onClick={() => answer(letter)}
          >
            {/* The visible text is the accessible name (WCAG 2.5.3), so voice users can say what they see.
                aria-pressed already announces the choice, so the mark is hidden from screen readers. */}
            <span className={styles.letter}>{letter}</span> <span>{ANSWER_WORDS[letter]}</span>
            {chosen === letter && (
              <span className={styles.chosenMark} aria-hidden="true">
                ✓ chosen
              </span>
            )}
          </button>
        ))}
      </div>

      <div className={styles.nav}>
        <button
          type="button"
          className={styles.button}
          onClick={back}
          disabled={trial.index === 0}
          data-testid="trial.back"
        >
          ← Back
        </button>
        <button type="button" className={styles.button} onClick={skip} data-testid="trial.skip">
          Skip (S)
        </button>
        {!isLast && (
          <button type="button" className={styles.button} onClick={next} data-testid="trial.next">
            Next →
          </button>
        )}
        <button
          type="button"
          ref={finishRef}
          className={styles.button}
          onClick={finish}
          data-testid="trial.finish"
        >
          Finish trial
        </button>
      </div>
    </main>
  );
}

function TrialResult({ trial, store }: { trial: TrialState; store: SessionStoreApi }) {
  const correct = trial.events.filter((e) => e.correct).length;
  return (
    <main className={`${styles.screen} ${styles.result}`} aria-label="Trial result">
      <h1>{trial.endReason === 'time_up' ? 'Time is up!' : 'Trial complete!'}</h1>
      <p data-testid="result.score">
        {correct} of {trial.items.length} correct
      </p>
      <p data-testid="result.reason">
        {trial.endReason === 'time_up'
          ? 'The time ran out, so questions without an answer were saved as unanswered.'
          : 'You finished the trial. Questions without an answer were saved as unanswered.'}
      </p>
      <button
        type="button"
        className={styles.button}
        onClick={store.getState().reset}
        data-testid="result.home"
      >
        Back to start
      </button>
    </main>
  );
}

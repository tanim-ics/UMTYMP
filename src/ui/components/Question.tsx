import type { RefObject } from 'react';
import type { QuestionItem } from '../../core/questions/schema.ts';
import type { Answer } from '../../core/questions/vocabulary.ts';
import { ANSWER_WORDS, LETTERS } from '../answers.ts';
import styles from '../screens/GrandTrial.module.css';
import { MathView } from './MathView.tsx';

/** The condition and the two quantities of one item. */
export function QuestionView({ item }: { item: QuestionItem }) {
  return (
    <>
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
    </>
  );
}

export function AnswerButtons(props: {
  chosen: Answer | null;
  onAnswer: (letter: Answer) => void;
  /** A drill locks the answer once given. */
  locked?: boolean;
}) {
  const { chosen, onAnswer, locked = false } = props;
  return (
    <div className={styles.answers} role="group" aria-label="Your answer">
      {LETTERS.map((letter) => (
        <button
          key={letter}
          type="button"
          data-answer={letter}
          data-testid={`trial.answer-${letter}`}
          aria-pressed={chosen === letter}
          disabled={locked}
          className={`${styles.answer} ${chosen === letter ? styles.chosen : ''}`}
          onClick={() => onAnswer(letter)}
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
  );
}

/** Back · Skip · Next (not on the last item) · Finish. */
export function NavButtons(props: {
  index: number;
  total: number;
  finishLabel: string;
  finishRef: RefObject<HTMLButtonElement>;
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  const { index, total, finishLabel, finishRef, onBack, onSkip, onNext, onFinish } = props;
  return (
    <div className={styles.nav}>
      <button
        type="button"
        className={styles.button}
        onClick={onBack}
        disabled={index === 0}
        data-testid="trial.back"
      >
        ← Back
      </button>
      <button type="button" className={styles.button} onClick={onSkip} data-testid="trial.skip">
        Skip (S)
      </button>
      {index < total - 1 && (
        <button type="button" className={styles.button} onClick={onNext} data-testid="trial.next">
          Next →
        </button>
      )}
      <button
        type="button"
        ref={finishRef}
        className={styles.button}
        onClick={onFinish}
        data-testid="trial.finish"
      >
        {finishLabel}
      </button>
    </div>
  );
}

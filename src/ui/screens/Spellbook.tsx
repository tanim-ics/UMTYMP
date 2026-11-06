import { useState } from 'react';
import { EXAM } from '../../core/config/exam.ts';
import { countMatching } from '../../core/questions/build.ts';
import type { QuestionItem } from '../../core/questions/schema.ts';
import {
  LEVELS,
  TAGS,
  TRAPS,
  type Level,
  type Tag,
  type Trap,
} from '../../core/questions/vocabulary.ts';
import type { SessionStoreApi } from '../../store/session.ts';
import { levelLabel, tagLabel, trapLabel } from '../labels.ts';
import { Art } from '../components/Art.tsx';
import styles from './GrandTrial.module.css';

const DEFAULT_LENGTH = '10';

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Spellbook practice (docs/SPEC.md S5): topics, traps and levels, timed or untimed, 5–50 questions. */
export function Spellbook(props: {
  bank: readonly QuestionItem[];
  store: SessionStoreApi;
  seed?: number;
  /** Leaves the Spellbook: on Back, and once a set has started (so its results lead back home). */
  onClose: () => void;
}) {
  const { bank, store, seed, onClose } = props;
  const [tags, setTags] = useState<Tag[]>([]);
  const [traps, setTraps] = useState<Trap[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [timed, setTimed] = useState(false);
  const [lengthText, setLengthText] = useState(DEFAULT_LENGTH);

  const { min, max } = EXAM.practiceLength;
  const length = /^\d+$/.test(lengthText) ? Number(lengthText) : Number.NaN;
  const lengthOk = Number.isInteger(length) && length >= min && length <= max;
  const matching = countMatching(bank, { tags, traps, levels });

  const start = () => {
    store
      .getState()
      .startPractice(
        bank,
        { tags, traps, levels, length, timed },
        seed ?? Math.floor(Math.random() * 2 ** 31),
      );
    onClose();
  };

  return (
    <main className={styles.screen} aria-label="Spellbook">
      <button
        type="button"
        className={styles.topBack}
        onClick={onClose}
        data-testid="spellbook.back-top"
      >
        ← Back
      </button>
      <h1 className={styles.titled}>
        <Art name="spellbook" size="medium" testId="spellbook.art" />
        Spellbook practice
      </h1>
      <p>Pick what to practise. Leave a group empty to include all of it.</p>

      <fieldset>
        <legend>Topics</legend>
        {TAGS.map((tag) => (
          <label key={tag} className={styles.choice}>
            <input
              type="checkbox"
              checked={tags.includes(tag)}
              onChange={() => setTags(toggle(tags, tag))}
              data-testid={`spellbook.tag-${tag}`}
            />
            {tagLabel(tag)}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Traps</legend>
        {TRAPS.map((trap) => (
          <label key={trap} className={styles.choice}>
            <input
              type="checkbox"
              checked={traps.includes(trap)}
              onChange={() => setTraps(toggle(traps, trap))}
              data-testid={`spellbook.trap-${trap}`}
            />
            {/* "trap" keeps names unique: absolute_value is a topic and a trap. */}
            {trapLabel(trap)} trap
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Levels</legend>
        {LEVELS.map((level) => (
          <label key={level} className={styles.choice}>
            <input
              type="checkbox"
              checked={levels.includes(level)}
              onChange={() => setLevels(toggle(levels, level))}
              data-testid={`spellbook.level-${level}`}
            />
            {levelLabel(level)}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>How long</legend>
        <label className={styles.choice}>
          Questions ({min}–{max}):{' '}
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={lengthText}
            onChange={(e) => setLengthText(e.target.value)}
            aria-describedby={lengthOk ? undefined : 'spellbook-length-error'}
            className={styles.number}
            data-testid="spellbook.length"
          />
        </label>
        {!lengthOk && (
          <p id="spellbook-length-error" data-testid="spellbook.length-error">
            Choose a whole number from {min} to {max}.
          </p>
        )}
        <label className={styles.choice}>
          <input
            type="checkbox"
            checked={timed}
            onChange={() => setTimed(!timed)}
            data-testid="spellbook.timed"
          />
          Timed: {EXAM.secondsPerQuestion} seconds per question
        </label>
      </fieldset>

      <p data-testid="spellbook.matching" aria-live="polite">
        {matching} {matching === 1 ? 'question matches' : 'questions match'}.
      </p>
      {lengthOk && matching > 0 && matching < length && (
        <p data-testid="spellbook.shorter">
          The set will have {matching} questions, because that is all that match.
        </p>
      )}

      <div className={styles.nav}>
        <button
          type="button"
          className={styles.button}
          onClick={onClose}
          data-testid="spellbook.back"
        >
          ← Back
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={start}
          disabled={!lengthOk || matching === 0}
          data-testid="spellbook.start"
        >
          Start practice
        </button>
      </div>
    </main>
  );
}

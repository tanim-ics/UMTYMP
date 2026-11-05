import { useEffect, useState } from 'react';
import { coach, type SessionRecord } from '../../core/analytics/coach.ts';
import { buildDrill } from '../../core/questions/build.ts';
import type { QuestionItem } from '../../core/questions/schema.ts';
import type { TrialState } from '../../core/session/trial.ts';
import type { ProfileHistory } from '../../data/attempts.ts';
import type { SessionStoreApi } from '../../store/session.ts';
import { drillLabel } from '../labels.ts';
import styles from '../screens/GrandTrial.module.css';
import { Art } from './Art.tsx';

function recordOf(trial: TrialState): SessionRecord {
  return {
    sessionId: trial.sessionId,
    mode: trial.mode,
    startedAt: trial.timer.startedAt,
    durationMs: trial.timer.durationMs,
    endReason: trial.endReason,
    events: trial.events,
  };
}

/** Professor Hoot on the results of a mock: strength, biggest leak, one habit and a potion drill for it. */
export function CoachCard(props: {
  trial: TrialState;
  bank: readonly QuestionItem[];
  store: SessionStoreApi;
  history?: Pick<ProfileHistory, 'listHistory'>;
}) {
  const { trial, bank, store, history } = props;
  const [past, setPast] = useState<SessionRecord[] | null>(history === undefined ? [] : null);

  useEffect(() => {
    if (history === undefined) return undefined;
    let current = true;
    void history.listHistory().then((list) => {
      if (current) setPast(list);
    });
    return () => {
      current = false;
    };
  }, [history]);

  if (past === null) return null;
  // The finished mock is usually saved already; count it once.
  const feedback = coach(
    [...past.filter((p) => p.sessionId !== trial.sessionId), recordOf(trial)],
    {
      latestSessionId: trial.sessionId,
    },
  );

  if (feedback.kind === 'not_enough_data') {
    return (
      <section className={styles.quantity} aria-label="Professor Hoot" data-testid="coach.card">
        <h2 className={styles.titled}>
          <Art name="hoot" testId="coach.art" />
          Professor Hoot
        </h2>
        <p data-testid="coach.not-enough">
          Professor Hoot needs at least {feedback.neededPerTopic} answers in one topic to coach you.
          A full Grand Trial gives plenty.
        </p>
      </section>
    );
  }

  const canBrew = buildDrill(bank, { seed: 0, focus: feedback.drill }).items.length > 0;
  return (
    <section className={styles.quantity} aria-label="Professor Hoot" data-testid="coach.card">
      <h2 className={styles.titled}>
        <Art name="hoot" testId="coach.art" />
        Professor Hoot
      </h2>
      <p data-testid="coach.strength">{feedback.strengthText}</p>
      <p data-testid="coach.bottleneck">{feedback.bottleneckText}</p>
      <p>
        <strong>Habit to try: </strong>
        <span data-testid="coach.habit">{feedback.habitText}</span>
      </p>
      <button
        type="button"
        className={styles.button}
        disabled={!canBrew}
        onClick={() =>
          store.getState().startDrill(bank, feedback.drill, Math.floor(Math.random() * 2 ** 31))
        }
        data-testid="coach.brew"
      >
        Brew a potion: {drillLabel(feedback.drill)}
      </button>
      {!canBrew && <p>There are no questions for this potion yet.</p>}
    </section>
  );
}

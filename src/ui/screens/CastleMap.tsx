import { useEffect, useState } from 'react';
import type { SessionRecord } from '../../core/analytics/coach.ts';
import {
  mockTrend,
  progressTable,
  towers,
  type ProgressRow,
} from '../../core/analytics/progress.ts';
import type { ProfileHistory } from '../../data/attempts.ts';
import { levelLabel, tagLabel } from '../labels.ts';
import { Art } from '../components/Art.tsx';
import styles from './GrandTrial.module.css';

const NO_CLAIM = '—';
const seconds = (ms: number | null) => (ms === null ? NO_CLAIM : `${Math.round(ms / 1000)} s`);
const share = (rate: number | null) => (rate === null ? NO_CLAIM : `${Math.round(rate * 100)}%`);
const points = (drop: number | null) =>
  drop === null
    ? NO_CLAIM
    : `${drop > 0 ? '−' : drop < 0 ? '+' : ''}${Math.round(Math.abs(drop))} pts`;

/** Castle map (docs/SPEC.md S6): towers from habits and progress, the trend per mock, topics and levels. */
export function CastleMap(props: {
  history?: Pick<ProfileHistory, 'listHistory'>;
  onStart: () => void;
  onBack: () => void;
}) {
  const { history, onStart, onBack } = props;
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);

  useEffect(() => {
    let current = true;
    void (history?.listHistory() ?? Promise.resolve([])).then((list) => {
      if (current) setSessions(list);
    });
    return () => {
      current = false;
    };
  }, [history]);

  if (sessions === null) {
    // History waits for pending saves, so this can take a moment right after a trial.
    return (
      <main className={styles.screen} aria-label="Castle map">
        <h1>Castle map</h1>
        <Art name="castle-map" size="banner" testId="castle.art" />
        <p role="status">Opening the castle map…</p>
      </main>
    );
  }
  const trend = mockTrend(sessions);
  const table = progressTable(sessions);
  const castle = towers(sessions);
  const empty = trend.length === 0 && table.tags.length === 0;

  return (
    <main className={styles.screen} aria-label="Castle map">
      <button
        type="button"
        className={styles.topBack}
        onClick={onBack}
        data-testid="castle.back-top"
      >
        ← Back
      </button>
      <h1>Castle map</h1>
      <Art name="castle-map" size="banner" testId="castle.art" />
      {empty && (
        <section className={styles.card} data-testid="castle.empty">
          <h2>Your castle is waiting</h2>
          <p>
            Start with a Grand Trial: 50 questions in 25 minutes. Afterwards Professor Hoot shows
            your strongest spell, and the towers here begin to open.
          </p>
          <button
            type="button"
            className={styles.primary}
            onClick={onStart}
            data-testid="castle.start"
          >
            Start Grand Trial
          </button>
        </section>
      )}

      <section aria-labelledby="towers-heading">
        <h2 id="towers-heading">Towers</h2>
        <p>Towers open from good habits and from getting better. A break never closes one.</p>
        <ul className={styles.reviewList}>
          {castle.map((t) => (
            <li
              key={t.id}
              className={t.unlocked ? styles.towerOpen : styles.tower}
              data-testid="castle.tower"
              data-unlocked={t.unlocked}
            >
              <strong>
                {t.name}: {t.unlocked ? 'open' : 'locked'}
              </strong>
              <br />
              {t.unlocked ? t.evidence : `To open: ${t.howTo}`}
            </li>
          ))}
        </ul>
      </section>

      {!empty && (
        <>
          <section aria-labelledby="trend-heading">
            <h2 id="trend-heading">Your Grand Trials</h2>
            {trend.length === 0 ? (
              <p>No Grand Trial yet. Finish one to see your trend.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table} data-testid="castle.trend">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Score</th>
                      <th scope="col">Median time</th>
                      <th scope="col">Trap rate</th>
                      <th scope="col">False D</th>
                      <th scope="col">Stamina</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trend.map((p) => (
                      <tr key={p.sessionId}>
                        <th scope="row">{new Date(p.startedAt).toLocaleDateString()}</th>
                        <td>
                          {p.correct} of {p.total}
                        </td>
                        <td>{seconds(p.medianMs)}</td>
                        <td>{share(p.trapRate)}</td>
                        <td>{share(p.falseDRate)}</td>
                        <td>{points(p.staminaDropPoints)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <ProgressTable
            id="topics"
            title="Topics"
            rows={table.tags}
            label={tagLabel}
            testId="castle.topics"
          />
          <ProgressTable
            id="levels"
            title="Levels"
            rows={table.levels}
            label={levelLabel}
            testId="castle.levels"
          />
          <p data-testid="castle.note">
            {NO_CLAIM} means fewer than 5 answers, too few to tell. Trap rate is the share of trap
            and &quot;not enough information&quot; questions answered wrong. Stamina compares the
            first and last 10 minutes.
          </p>
        </>
      )}

      <button type="button" className={styles.button} onClick={onBack} data-testid="castle.back">
        ← Back
      </button>
    </main>
  );
}

function ProgressTable<K extends string | number>(props: {
  id: string;
  title: string;
  rows: readonly ProgressRow<K>[];
  label: (key: K) => string;
  testId: string;
}) {
  const { id, title, rows, label, testId } = props;
  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{title}</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table} data-testid={testId}>
          <thead>
            <tr>
              <th scope="col">{title.slice(0, -1)}</th>
              <th scope="col">Right</th>
              <th scope="col">Accuracy</th>
              <th scope="col">Median time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.key)}>
                <th scope="row">{label(r.key)}</th>
                <td>
                  {r.correct} of {r.attempted}
                </td>
                <td>{share(r.accuracy)}</td>
                <td>{seconds(r.medianMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { EXAM } from '../core/config/exam.ts';
import type { QuestionItem } from '../core/questions/schema.ts';
import type { AttemptRepo, FinishedSession } from '../data/attempts.ts';
import type { SessionStoreApi } from '../store/session.ts';
import { GrandTrial } from './screens/GrandTrial.tsx';
import styles from './screens/GrandTrial.module.css';

interface AppProps {
  bank: readonly QuestionItem[];
  store: SessionStoreApi;
  /** Fixed in tests and the dev hooks; otherwise each trial gets a fresh random seed. */
  seed?: number;
  /** Past sessions from this browser's storage; absent when storage could not be opened. */
  history?: Pick<AttemptRepo, 'listFinished'>;
  /** False when this browser won't let us save (e.g. some private modes). */
  storageAvailable?: boolean;
}

export function App(props: AppProps) {
  const hasTrial = useStore(props.store, (s) => s.trial !== null);
  return hasTrial ? <GrandTrial store={props.store} /> : <Home {...props} />;
}

function Home({ bank, store, seed, history, storageAvailable = true }: AppProps) {
  const saveFailed = useStore(store, (s) => s.saveFailed);
  const [past, setPast] = useState<FinishedSession[]>([]);

  // Home mounts again after every trial, so this also refreshes the list once a trial ends.
  useEffect(() => {
    let current = true;
    void history?.listFinished().then((list) => {
      if (current) setPast(list);
    });
    return () => {
      current = false;
    };
  }, [history]);

  const start = () => {
    // The builder wants past mocks oldest first; the list is newest first.
    const recent = [...past].reverse().map((p) => p.itemIds);
    store.getState().startMock(bank, seed ?? Math.floor(Math.random() * 2 ** 31), recent);
  };

  return (
    <main className={styles.screen} aria-label="Home">
      <h1>Comparia Academy</h1>
      {(!storageAvailable || saveFailed) && (
        <p data-testid="home.saving-off">
          Saving is off in this browser, so your answers won&apos;t be kept after you close the
          page.
        </p>
      )}
      {bank.length < EXAM.questionCount && (
        <p data-testid="home.bank-note">
          The question bank has {bank.length} questions so far; a full Grand Trial uses{' '}
          {EXAM.questionCount}.
        </p>
      )}
      <button
        type="button"
        className={styles.button}
        onClick={start}
        disabled={bank.length === 0}
        data-testid="home.start"
      >
        Start Grand Trial
      </button>
      {past.length > 0 && (
        <section aria-labelledby="history-heading" data-testid="home.history">
          <h2 id="history-heading">Past Grand Trials</h2>
          <ul>
            {past.map((p) => (
              <li key={p.sessionId} data-testid="home.history-item">
                {new Date(p.startedAt).toLocaleDateString()}: {p.correct} of {p.total} correct ·{' '}
                {p.endReason === 'time_up' ? 'time ran out' : 'finished'}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

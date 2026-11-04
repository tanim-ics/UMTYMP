import { useStore } from 'zustand';
import { EXAM } from '../core/config/exam.ts';
import type { QuestionItem } from '../core/questions/schema.ts';
import type { SessionStoreApi } from '../store/session.ts';
import { GrandTrial } from './screens/GrandTrial.tsx';
import styles from './screens/GrandTrial.module.css';

interface AppProps {
  bank: readonly QuestionItem[];
  store: SessionStoreApi;
  /** Fixed in tests and the dev hooks; otherwise each trial gets a fresh random seed. */
  seed?: number;
}

export function App({ bank, store, seed }: AppProps) {
  const hasTrial = useStore(store, (s) => s.trial !== null);
  if (hasTrial) return <GrandTrial store={store} />;

  const start = () => store.getState().startMock(bank, seed ?? Math.floor(Math.random() * 2 ** 31));
  return (
    <main className={styles.screen} aria-label="Home">
      <h1>Comparia Academy</h1>
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
    </main>
  );
}

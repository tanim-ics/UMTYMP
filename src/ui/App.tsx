import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { EXAM } from '../core/config/exam.ts';
import type { QuestionItem } from '../core/questions/schema.ts';
import type { AttemptRepo, FinishedSession, ProfileHistory } from '../data/attempts.ts';
import type { ProfileRow } from '../data/db.ts';
import { HOUSES, type ProfileRepo } from '../data/profiles.ts';
import type { SessionStoreApi } from '../store/session.ts';
import { GrandTrial } from './screens/GrandTrial.tsx';
import styles from './screens/GrandTrial.module.css';
import { Profiles } from './screens/Profiles.tsx';
import { Spellbook } from './screens/Spellbook.tsx';

interface AppProps {
  bank: readonly QuestionItem[];
  store: SessionStoreApi;
  /** Fixed in tests and the dev hooks; otherwise each trial gets a fresh random seed. */
  seed?: number;
  /** Past sessions from this browser's storage; absent when storage could not be opened. */
  history?: ProfileHistory;
  /** False when this browser won't let us save (e.g. some private modes). */
  storageAvailable?: boolean;
  /** Local storage. With it, the app starts at "Who's playing?" and everything is saved per student. */
  data?: {
    profiles: ProfileRepo;
    attempts: Pick<AttemptRepo, 'listFinished' | 'listHistory' | 'loadActive'>;
  };
}

export function App(props: AppProps) {
  return props.data === undefined ? (
    <Main {...props} />
  ) : (
    <ProfileGate {...props} data={props.data} />
  );
}

/** Picks the student, resumes their unfinished mock, and binds history to them. */
function ProfileGate(props: AppProps & { data: NonNullable<AppProps['data']> }) {
  const { store, bank, data } = props;
  const profileId = useStore(store, (s) => s.profileId);
  const [profiles, setProfiles] = useState<ProfileRow[] | null>(null);
  // A single profile is picked automatically on the first load only, so "Switch student" still shows the list.
  const firstLoad = useRef(true);

  const reload = useCallback(async () => setProfiles(await data.profiles.list()), [data]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const choose = useCallback(
    async (id: string) => {
      store.getState().setProfile(id);
      const saved = await data.attempts.loadActive(bank, id).catch(() => null);
      if (saved === null) return;
      // Resume the mock left open by a reload or a closed tab; its clock kept running meanwhile.
      store.getState().resume(saved);
      if (document.visibilityState === 'hidden') store.getState().setHidden(true);
    },
    [store, data, bank],
  );

  useEffect(() => {
    if (profiles === null || !firstLoad.current) return;
    firstLoad.current = false;
    const only = profiles.length === 1 ? profiles[0] : undefined;
    if (only !== undefined && profileId === null) void choose(only.id);
  }, [profiles, profileId, choose]);

  const history = useMemo(
    () =>
      profileId === null
        ? undefined
        : {
            listFinished: () => data.attempts.listFinished(profileId),
            listHistory: () => data.attempts.listHistory(profileId),
          },
    [data, profileId],
  );

  if (profiles === null) return null;
  const player = profiles.find((p) => p.id === profileId);
  if (profileId === null || player === undefined) {
    return (
      <Profiles
        profiles={profiles}
        repo={data.profiles}
        onChoose={(id) => void choose(id)}
        onChanged={reload}
      />
    );
  }
  return (
    <Main
      {...props}
      history={history}
      player={player}
      onSwitch={() => store.getState().setProfile(null)}
    />
  );
}

function Main(props: AppProps & { player?: ProfileRow; onSwitch?: () => void }) {
  const hasTrial = useStore(props.store, (s) => s.trial !== null);
  const [spellbook, setSpellbook] = useState(false);
  if (hasTrial) return <GrandTrial store={props.store} bank={props.bank} history={props.history} />;
  if (spellbook) {
    return (
      <Spellbook
        bank={props.bank}
        store={props.store}
        seed={props.seed}
        onClose={() => setSpellbook(false)}
      />
    );
  }
  return <Home {...props} onSpellbook={() => setSpellbook(true)} />;
}

function Home({
  bank,
  store,
  seed,
  history,
  storageAvailable = true,
  onSpellbook,
  player,
  onSwitch,
}: AppProps & { onSpellbook: () => void; player?: ProfileRow; onSwitch?: () => void }) {
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
      {player !== undefined && (
        <p data-testid="home.player">
          Playing as {player.displayName} · {HOUSES.find((h) => h.id === player.house)?.name}{' '}
          <button
            type="button"
            className={styles.button}
            onClick={onSwitch}
            data-testid="home.switch"
          >
            Switch student
          </button>
        </p>
      )}
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
      <button
        type="button"
        className={styles.button}
        onClick={onSpellbook}
        disabled={bank.length === 0}
        data-testid="home.spellbook"
      >
        Open the Spellbook
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

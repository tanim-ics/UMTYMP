import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { EXAM } from '../core/config/exam.ts';
import type { QuestionItem } from '../core/questions/schema.ts';
import type { AttemptRepo, FinishedSession, ProfileHistory } from '../data/attempts.ts';
import type { ProfileRow } from '../data/db.ts';
import { HOUSES, type ProfileRepo } from '../data/profiles.ts';
import type { Transfer } from '../data/transfer.ts';
import { downloadText } from './download.ts';
import type { SessionStoreApi } from '../store/session.ts';
import { GrandTrial } from './screens/GrandTrial.tsx';
import styles from './screens/GrandTrial.module.css';
import { CastleMap } from './screens/CastleMap.tsx';
import { Profiles } from './screens/Profiles.tsx';
import { Settings } from './screens/Settings.tsx';
import { Spellbook } from './screens/Spellbook.tsx';
import { Art } from './components/Art.tsx';

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
    /** Export, import and reset (Settings & data). */
    transfer?: Transfer;
    /** Resolves when every change so far is saved; history waits for it, so a just-finished mock is listed. */
    whenSaved?: () => Promise<void>;
  };
  /** Saves an exported file; tests pass a fake. */
  download?: (fileName: string, text: string) => void;
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
  const [settings, setSettings] = useState(false);
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
            // Saving runs in the background; read only after it lands, or the mock just finished is missing.
            listFinished: async () => {
              await data.whenSaved?.();
              return data.attempts.listFinished(profileId);
            },
            listHistory: async () => {
              await data.whenSaved?.();
              return data.attempts.listHistory(profileId);
            },
          },
    [data, profileId],
  );

  if (profiles === null) return null;
  if (settings && data.transfer !== undefined) {
    return (
      <Settings
        profiles={profiles}
        transfer={data.transfer}
        download={props.download ?? downloadText}
        onChanged={reload}
        onReset={() => {
          store.getState().setProfile(null);
          setSettings(false);
        }}
        onBack={() => setSettings(false)}
      />
    );
  }
  const player = profiles.find((p) => p.id === profileId);
  if (profileId === null || player === undefined) {
    return (
      <Profiles
        profiles={profiles}
        repo={data.profiles}
        onChoose={(id) => void choose(id)}
        onChanged={reload}
        onSettings={data.transfer === undefined ? undefined : () => setSettings(true)}
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
  const [castle, setCastle] = useState(false);
  if (hasTrial) return <GrandTrial store={props.store} bank={props.bank} history={props.history} />;
  if (castle) {
    return (
      <CastleMap
        history={props.history}
        onStart={() => {
          // The map offers Start only before any finished mock, so there are no recent items to avoid.
          setCastle(false);
          props.store
            .getState()
            .startMock(props.bank, props.seed ?? Math.floor(Math.random() * 2 ** 31), []);
        }}
        onBack={() => setCastle(false)}
      />
    );
  }
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
  return (
    <Home {...props} onSpellbook={() => setSpellbook(true)} onCastle={() => setCastle(true)} />
  );
}

function Home({
  bank,
  store,
  seed,
  history,
  storageAvailable = true,
  onSpellbook,
  onCastle,
  player,
  onSwitch,
}: AppProps & {
  onSpellbook: () => void;
  onCastle: () => void;
  player?: ProfileRow;
  onSwitch?: () => void;
}) {
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
      <Art name="castle-map" size="banner" testId="home.art" />
      {player !== undefined && (
        <p data-testid="home.player" className={styles.player}>
          {player.house !== null && <Art name={`crest-${player.house}`} testId="home.crest" />}
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
        className={styles.primary}
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
      <button type="button" className={styles.button} onClick={onCastle} data-testid="home.castle">
        Castle map
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

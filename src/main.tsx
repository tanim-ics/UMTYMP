import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createFakeClock, systemClock } from './core/timer/clock.ts';
import { connectPersistence, createAttemptRepo } from './data/attempts.ts';
import { createProfileRepo } from './data/profiles.ts';
import { createTransfer } from './data/transfer.ts';
import { openDb } from './data/db.ts';
import { createSessionStore } from './store/session.ts';
import { App } from './ui/App.tsx';
import { loadBank } from './ui/bank.ts';
import './ui/theme/tokens.css';

// Dev builds only: `?clock=fake` freezes time so Playwright can move it with window.__umtymp.clock.advance;
// `?bank=repeat` pads the seed bank to fill a full mock (src/dev/devBank.ts).
const params = new URLSearchParams(location.search);
const fakeClock = import.meta.env.DEV && params.get('clock') === 'fake' ? createFakeClock() : null;
const store = createSessionStore(fakeClock ?? systemClock);

/** Opens local storage; null when the browser blocks IndexedDB, and the app then runs without saving. */
async function openData() {
  try {
    const db = openDb();
    await db.open();
    return {
      attempts: createAttemptRepo(db),
      profiles: createProfileRepo(db),
      transfer: createTransfer(db),
    };
  } catch {
    return null;
  }
}

async function loadAppBank() {
  const bank = loadBank();
  if (!import.meta.env.DEV || params.get('bank') !== 'repeat') return bank;
  const { repeatBank } = await import('./dev/devBank.ts');
  return repeatBank(bank, 4);
}

async function boot() {
  const bank = await loadAppBank();
  const data = await openData();
  let flush = () => Promise.resolve();
  if (data !== null) {
    // Sessions are saved under the student chosen on "Who's playing?"; App resumes their unfinished mock.
    ({ flush } = connectPersistence(store, data.attempts, () =>
      store.getState().reportSaveError(),
    ));
  }
  if (import.meta.env.DEV) {
    const { installTestHooks } = await import('./dev/testHooks.ts');
    installTestHooks({
      store,
      bank,
      fakeClock,
      flush,
      listHistory: data === null ? undefined : (id) => data.attempts.listHistory(id),
    });
  }
  const root = document.getElementById('root');
  if (!root) throw new Error('Missing #root element');
  createRoot(root).render(
    <StrictMode>
      <App
        bank={bank}
        store={store}
        data={data === null ? undefined : { ...data, whenSaved: flush }}
        storageAvailable={data !== null}
      />
    </StrictMode>,
  );
}

void boot();

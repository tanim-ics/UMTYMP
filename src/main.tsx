import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createFakeClock, systemClock } from './core/timer/clock.ts';
import { connectPersistence, createAttemptRepo, type AttemptRepo } from './data/attempts.ts';
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
async function openRepo(): Promise<AttemptRepo | null> {
  try {
    const db = openDb();
    await db.open();
    return createAttemptRepo(db);
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
  const repo = await openRepo();
  let flush = () => Promise.resolve();
  if (repo !== null) {
    // Resume a mock left open by a reload or a closed tab; its clock kept running meanwhile.
    const saved = await repo.loadActive(bank).catch(() => null);
    if (saved !== null) {
      store.getState().resume(saved);
      // Opened in a background tab: the student isn't back yet.
      if (document.visibilityState === 'hidden') store.getState().setHidden(true);
    }
    ({ flush } = connectPersistence(store, repo, () => store.getState().reportSaveError()));
  }
  if (import.meta.env.DEV) {
    const { installTestHooks } = await import('./dev/testHooks.ts');
    installTestHooks({ store, bank, fakeClock, flush });
  }
  const root = document.getElementById('root');
  if (!root) throw new Error('Missing #root element');
  createRoot(root).render(
    <StrictMode>
      <App bank={bank} store={store} history={repo ?? undefined} storageAvailable={repo !== null} />
    </StrictMode>,
  );
}

void boot();

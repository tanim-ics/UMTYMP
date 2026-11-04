import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createFakeClock, systemClock } from './core/timer/clock.ts';
import { createSessionStore } from './store/session.ts';
import { App } from './ui/App.tsx';
import { loadBank } from './ui/bank.ts';
import './ui/theme/tokens.css';

// `?clock=fake` (dev build only) freezes time so Playwright can move it with window.__umtymp.clock.advance.
const fakeClock =
  import.meta.env.DEV && new URLSearchParams(location.search).get('clock') === 'fake'
    ? createFakeClock()
    : null;
const store = createSessionStore(fakeClock ?? systemClock);
const bank = loadBank();

if (import.meta.env.DEV) {
  void import('./dev/testHooks.ts').then(({ installTestHooks }) =>
    installTestHooks({ store, bank, fakeClock }),
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <App bank={bank} store={store} />
  </StrictMode>,
);

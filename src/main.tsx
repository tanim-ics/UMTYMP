import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/theme/tokens.css';

function App() {
  return (
    <main style={{ padding: 'var(--space)', fontFamily: 'var(--font-display)' }}>
      <h1>Comparia Academy</h1>
      <p style={{ color: 'var(--color-muted)' }}>The castle is being built.</p>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

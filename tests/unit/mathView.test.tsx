// @vitest-environment jsdom
// Task 22: a formula is announced by its spoken form; one the reader can't speak keeps KaTeX's MathML.
// Task 24: KaTeX loads after the first screen (it isn't needed there), so a formula shown before it arrives is a
// labelled placeholder that fills in once KaTeX is ready, and renders at once after that.
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.resetModules();
});

/** A fresh copy of the module, as on a first visit: KaTeX not loaded yet. */
const fresh = () => import('../../src/ui/components/MathView.tsx');

describe('MathView', () => {
  it('is announced as its spoken form, and still shows KaTeX', async () => {
    const { MathView, loadMath } = await fresh();
    await loadMath();
    render(<MathView latex="x^2" testId="t.math" />);
    const math = screen.getByRole('img', { name: 'x squared' });
    expect(math.getAttribute('data-testid')).toBe('t.math');
    expect(math.querySelector('.katex')).not.toBeNull();
  });

  it('keeps the MathML for screen readers when there is no spoken form', async () => {
    const { MathView, loadMath } = await fresh();
    await loadMath();
    render(<MathView latex="\int x" testId="t.math" />);
    const math = screen.getByTestId('t.math');
    expect(math.getAttribute('role')).toBeNull();
    expect(math.getAttribute('aria-label')).toBeNull();
    expect(math.querySelector('math')).not.toBeNull();
  });

  it('before KaTeX has loaded, shows a labelled placeholder, then the formula', async () => {
    const { MathView, loadMath } = await fresh();
    render(<MathView latex="x^2" testId="t.math" />);
    const placeholder = screen.getByTestId('t.math');
    expect(placeholder.querySelector('.katex')).toBeNull();
    expect(screen.getByRole('img', { name: 'x squared' })).toBe(placeholder);
    await act(() => loadMath());
    expect(screen.getByTestId('t.math').querySelector('.katex')).not.toBeNull();
  });

  it('loads KaTeX once, however often it is asked', async () => {
    const { loadMath } = await fresh();
    expect(loadMath()).toBe(loadMath());
    await loadMath();
  });
});

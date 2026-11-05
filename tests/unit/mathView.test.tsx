// @vitest-environment jsdom
// Task 22: a formula is announced by its spoken form; one the reader can't speak keeps KaTeX's MathML.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MathView } from '../../src/ui/components/MathView.tsx';

afterEach(cleanup);

describe('MathView', () => {
  it('is announced as its spoken form, and still shows KaTeX', () => {
    render(<MathView latex="x^2" testId="t.math" />);
    const math = screen.getByRole('img', { name: 'x squared' });
    expect(math.getAttribute('data-testid')).toBe('t.math');
    expect(math.querySelector('.katex')).not.toBeNull();
  });

  it('keeps the MathML for screen readers when there is no spoken form', () => {
    render(<MathView latex="\int x" testId="t.math" />);
    const math = screen.getByTestId('t.math');
    expect(math.getAttribute('role')).toBeNull();
    expect(math.getAttribute('aria-label')).toBeNull();
    expect(math.querySelector('math')).not.toBeNull();
  });
});

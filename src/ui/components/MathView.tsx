import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';

/**
 * Renders a bank LaTeX string. KaTeX escapes text and runs with `trust: false`, and the bank is our own verified
 * content, so the generated markup is safe to insert. The MathML copy is what screen readers read.
 */
export function MathView({ latex, testId }: { latex: string; testId?: string }) {
  const html = useMemo(
    () => katex.renderToString(latex, { throwOnError: false, output: 'htmlAndMathml' }),
    [latex],
  );
  return <span data-testid={testId} dangerouslySetInnerHTML={{ __html: html }} />;
}

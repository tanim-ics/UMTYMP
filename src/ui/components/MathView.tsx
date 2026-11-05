import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';
import { spokenMath } from '../../core/questions/spoken.ts';

/**
 * Renders a bank LaTeX string. KaTeX escapes text and runs with `trust: false`, and the bank is our own verified
 * content, so the generated markup is safe to insert.
 *
 * Screen readers get the spoken form ("x squared") as the name of a single image, because KaTeX's MathML is read
 * well by some of them and barely by others. A formula with no spoken form keeps the MathML instead (Task 22).
 */
export function MathView({ latex, testId }: { latex: string; testId?: string }) {
  const html = useMemo(
    () => katex.renderToString(latex, { throwOnError: false, output: 'htmlAndMathml' }),
    [latex],
  );
  const spoken = useMemo(() => spokenMath(latex), [latex]);
  if (spoken === null)
    return <span data-testid={testId} dangerouslySetInnerHTML={{ __html: html }} />;
  return (
    <span
      data-testid={testId}
      role="img"
      aria-label={spoken}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

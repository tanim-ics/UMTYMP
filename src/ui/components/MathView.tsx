import { useEffect, useMemo, useState } from 'react';
import { spokenMath } from '../../core/questions/spoken.ts';

type RenderMath = (latex: string) => string;

let renderMath: RenderMath | null = null;
let loading: Promise<void> | null = null;

/**
 * Loads KaTeX (code, styles and, through the styles, its fonts) once. It's a third of the app's code and no first
 * screen needs it, so it's split off and fetched right after the first render instead of delaying it (Task 24).
 * main.tsx starts this at boot, so it's ready long before the first question; offline it comes from the cache.
 */
export function loadMath(): Promise<void> {
  loading ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([katex]) => {
    renderMath = (latex) =>
      katex.default.renderToString(latex, { throwOnError: false, output: 'htmlAndMathml' });
  });
  return loading;
}

/**
 * Renders a bank LaTeX string. KaTeX escapes text and runs with `trust: false`, and the bank is our own verified
 * content, so the generated markup is safe to insert.
 *
 * Screen readers get the spoken form ("x squared") as the name of a single image, because KaTeX's MathML is read
 * well by some of them and barely by others. A formula with no spoken form keeps the MathML instead (Task 22).
 * Once KaTeX is loaded it renders at once; before that (only on a very fast click on the first visit) the
 * placeholder already carries the spoken label.
 */
export function MathView({ latex, testId }: { latex: string; testId?: string }) {
  const [ready, setReady] = useState(renderMath !== null);
  useEffect(() => {
    if (!ready) void loadMath().then(() => setReady(true));
  }, [ready]);
  const html = useMemo(
    () => (ready && renderMath !== null ? renderMath(latex) : null),
    [ready, latex],
  );
  const spoken = useMemo(() => spokenMath(latex), [latex]);
  const label = spoken === null ? {} : { role: 'img', 'aria-label': spoken };
  if (html === null) return <span data-testid={testId} {...label} />;
  return <span data-testid={testId} {...label} dangerouslySetInnerHTML={{ __html: html }} />;
}

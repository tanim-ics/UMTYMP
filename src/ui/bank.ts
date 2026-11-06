import { parseBank, type BankFile } from '../core/questions/load.ts';
import type { QuestionItem } from '../core/questions/schema.ts';

// Each bank file becomes its own chunk, fetched after the first screen is up. Bundled in the entry chunk, every new
// batch of questions slowed the first paint (CI Lighthouse, C6: LCP 2551 ms over the 2500 ms budget). The chunks
// are same-origin JS, so the CSP is unchanged and the service worker still precaches them for offline use.
const loaders = import.meta.glob<unknown>('../../content/questions/*.json', { import: 'default' });

/** Fetches every bank file in parallel and parses them. */
export async function fetchBank(): Promise<QuestionItem[]> {
  const entries = await Promise.all(
    Object.entries(loaders).map(async ([name, load]) => [name, await load()] as const),
  );
  return loadBank(Object.fromEntries(entries));
}

/**
 * Parses bank files. `npm run verify` blocks any invalid item before it reaches a build, so a rejected item here
 * can only mean a broken check; it is dropped rather than shown to a child.
 */
export function loadBank(files: Record<string, unknown>): QuestionItem[] {
  const list: BankFile[] = Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, data]) => ({ name, data }));
  return parseBank(list).items;
}

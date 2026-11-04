import { parseBank, type BankFile } from '../core/questions/load.ts';
import type { QuestionItem } from '../core/questions/schema.ts';

// Vite bundles every bank file at build time, so the app needs no network request for questions.
const modules = import.meta.glob<unknown>('../../content/questions/*.json', {
  eager: true,
  import: 'default',
});

/**
 * Parses bundled bank files. `npm run verify` blocks any invalid item before it reaches a build, so a rejected
 * item here can only mean a broken check; it is dropped rather than shown to a child.
 */
export function loadBank(files: Record<string, unknown> = modules): QuestionItem[] {
  const list: BankFile[] = Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, data]) => ({ name, data }));
  return parseBank(list).items;
}

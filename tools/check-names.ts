// Fails when a Harry Potter name appears in what ships (Task 25; CLAUDE.md §7, docs/SPEC.md success criterion 10).
//   npm run names
// The names are in tools/franchise-names.txt. Docs aren't scanned: they have to name the franchise to forbid it.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Everything that reaches a student: code, questions, art, the HTML shell and the build config (app manifest). */
export const SCANNED = ['src', 'content', 'public', 'index.html', 'vite.config.ts'] as const;

const TEXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.json',
  '.svg',
  '.html',
  '.css',
  '.md',
  '.txt',
  '.webmanifest',
]);

export interface Hit {
  name: string;
  line: number;
}

export interface FileHit extends Hit {
  file: string;
}

export function readNameList(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

/**
 * Splits camelCase ("gryffindorHouse" → "gryffindor house") and drops apostrophes ("marauder's" → "marauders"), so
 * a name is found however code or prose spells it.
 */
function normalize(text: string): string {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/['’]/g, '')
    .toLowerCase();
}

/** A name as a whole word: any of space, `_`, `-` or `.` (or nothing) between its words, and an optional plural. */
function pattern(name: string): RegExp {
  const words = name.split(' ').map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(?<![a-z])${words.join('[\\s_.-]*')}(?:e?s)?(?![a-z])`);
}

export function findNames(text: string, names: readonly string[]): Hit[] {
  const patterns = names.map((name) => ({ name, re: pattern(name) }));
  const hits: Hit[] = [];
  normalize(text)
    .split('\n')
    .forEach((line, i) => {
      for (const { name, re } of patterns) if (re.test(line)) hits.push({ name, line: i + 1 });
    });
  return hits;
}

function* walk(path: string): Generator<string> {
  if (!existsSync(path)) return;
  if (statSync(path).isDirectory()) {
    for (const entry of readdirSync(path).sort()) yield* walk(join(path, entry));
  } else if (TEXT.has(extname(path))) {
    yield path;
  }
}

/** Every hit in the scanned paths under `root`, by file. */
export function scanFiles(root: string, names: readonly string[]): FileHit[] {
  const hits: FileHit[] = [];
  for (const top of SCANNED) {
    for (const file of walk(join(root, top))) {
      const shown = relative(root, file);
      for (const hit of findNames(readFileSync(file, 'utf8'), names))
        hits.push({ file: shown, ...hit });
    }
  }
  return hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const hits = scanFiles('.', readNameList('tools/franchise-names.txt'));
  if (hits.length === 0) {
    console.log(`check-names: clean (${SCANNED.join(', ')})`);
  } else {
    console.log(`check-names: ${hits.length} franchise name(s) found:`);
    for (const h of hits) console.log(`  ${h.file}:${h.line}  ${h.name}`);
    console.log('Use our own magic academy instead (CLAUDE.md §7).');
    process.exitCode = 1;
  }
}

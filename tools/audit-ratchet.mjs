#!/usr/bin/env node
// Ratchet for dev-tool advisories (docs/CONSTRAINTS.md): the moderate count may not grow.
// Usage: node tools/audit-ratchet.mjs <max-moderate>
// Exit: 0 at or under the cap, 1 over it, 2 could not run. A 2 never reads as clean.
import { execFileSync } from 'node:child_process';

const max = Number(process.argv[2]);
if (!Number.isInteger(max) || max < 0) {
  console.error(
    'audit-ratchet: pass the allowed moderate count, e.g. `node tools/audit-ratchet.mjs 11`',
  );
  process.exit(2);
}

// npm audit exits non-zero whenever it finds anything, so read its JSON from either outcome.
let raw;
try {
  raw = execFileSync('npm', ['audit', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  raw = typeof e.stdout === 'string' ? e.stdout : '';
}
let moderate;
try {
  moderate = JSON.parse(raw).metadata.vulnerabilities.moderate;
} catch {
  console.error('audit-ratchet: npm audit gave no readable report (offline?)');
  process.exit(2);
}
if (typeof moderate !== 'number') {
  console.error('audit-ratchet: npm audit report has no moderate count');
  process.exit(2);
}

if (moderate > max) {
  console.error(
    `audit-ratchet: ${moderate} moderate advisories, cap is ${max}. Run \`npm audit\` to see the new ones.`,
  );
  process.exit(1);
}
if (moderate < max) {
  console.log(
    `audit-ratchet: ${moderate} moderate (cap ${max}). Improved: lower the cap in docs/CONSTRAINTS.md and package.json to ${moderate}.`,
  );
} else {
  console.log(`audit-ratchet: ${moderate} moderate, at the cap of ${max}.`);
}

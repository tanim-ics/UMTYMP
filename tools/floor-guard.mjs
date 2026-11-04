#!/usr/bin/env node
// floor-guard.mjs — diff-scoped enforcement of the docs/CONSTRAINTS.md floor.
// Adapted from the agent-skills constraint-driven-development reference (floor-guard.md).
// Usage: node tools/floor-guard.mjs [--base <ref>]
// Exit: 0 clean, 1 floor violation, 2 could not run. A 2 never reads as clean.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

// `git diff --no-index` exits 1 whenever the two sides differ (the normal case for a new file),
// so that output is kept. Any other failure is null, and null never reads as clean.
const git = (args, { diffExit = false } = {}) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return diffExit && e.status === 1 && typeof e.stdout === 'string' ? e.stdout : null;
  }
};
const bail = (msg) => {
  console.error('floor-guard: ' + msg);
  process.exit(2);
};

const top = git(['rev-parse', '--show-toplevel'])?.trim();
if (!top) bail('not inside a git work tree');
process.chdir(top);

// Base: --base, else origin/main once a remote exists, else the last commit. Before the first
// commit there is nothing to compare with, so every file counts as added (git's empty tree).
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const argBase = (() => {
  const i = process.argv.indexOf('--base');
  return i > -1 ? process.argv[i + 1] : null;
})();
const hasCommits = git(['rev-parse', '--verify', '--quiet', 'HEAD']) !== null;
let mergeBase;
if (argBase) mergeBase = git(['merge-base', argBase, 'HEAD'])?.trim();
else if (!hasCommits) mergeBase = EMPTY_TREE;
else if (git(['rev-parse', '--verify', '--quiet', 'origin/main']) !== null)
  mergeBase = git(['merge-base', 'origin/main', 'HEAD'])?.trim();
else mergeBase = 'HEAD';
if (!mergeBase) bail('no merge base against ' + (argBase ?? 'origin/main'));

const tracked = git(['diff', '--unified=0', mergeBase, '--']);
if (tracked === null) bail('could not diff against ' + mergeBase);
const untrackedFiles = git(['ls-files', '--others', '--exclude-standard']);
if (untrackedFiles === null) bail('could not list untracked files');
const untracked = untrackedFiles
  .split('\n')
  .filter(Boolean)
  .map((f) => {
    const d = git(['diff', '--no-index', '--unified=0', '/dev/null', f], { diffExit: true });
    if (d === null) bail('could not diff untracked file ' + f);
    return d;
  })
  .join('\n');
const diff = tracked + '\n' + untracked;

// Paths exempt from the pattern checks (docs that describe the rules, this file). The
// CONSTRAINTS.md weakening checks below always run.
const globToRegex = (g) => {
  const body = g
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '@@GLOBSTAR@@')
    .replace(/\*/g, '[^/]*')
    .replace(/@@GLOBSTAR@@/g, '.*');
  return new RegExp(g.includes('/') ? `^${body}$` : `(^|/)${body}$`);
};
const ignores = existsSync('.constraintsignore')
  ? readFileSync('.constraintsignore', 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map(globToRegex)
  : [];
const isIgnored = (f) => ignores.some((re) => re.test(f));

// `---`/`+++` are headers only between a file's `diff` line and its first `@@` hunk.
const added = [];
const removed = [];
const deleted = [];
const pathOf = (s) => s.replace(/^[ab]\//, '');
let file = '';
let oldFile = '';
let inHeader = false;
for (const line of diff.split('\n')) {
  if (line.startsWith('diff ')) inHeader = true;
  else if (line.startsWith('@@')) inHeader = false;
  else if (inHeader) {
    if (line.startsWith('--- ')) oldFile = pathOf(line.slice(4));
    else if (line.startsWith('+++ ')) {
      const newFile = pathOf(line.slice(4));
      file = newFile === '/dev/null' ? oldFile : newFile;
      if (newFile === '/dev/null') deleted.push(file);
    }
  } else if (line.startsWith('+')) added.push({ file, text: line.slice(1) });
  else if (line.startsWith('-')) removed.push({ file, text: line.slice(1) });
}

const findings = [];
const flag = (rule, f, text) => findings.push({ rule, file: f, text: text.trim().slice(0, 120) });
const isTest = (f) => /\.(test|spec)\./.test(f);
const isConstraints = (f) => /CONSTRAINTS\.md$/.test(f);

const SUPPRESSIONS =
  /@ts-ignore|@ts-nocheck|@ts-expect-error|eslint-disable|istanbul ignore|v8 ignore|c8 ignore|gitleaks:allow|prettier-ignore/;
const STUBS =
  /throw new Error\(.*[Nn]ot implemented|catch\s*\(\w*\)\s*\{\s*\}|catch\s*\{\s*\}|\bTODO\b/;
const SKIPS = /\.(skip|todo|only)\b|\bxit\(|\bxdescribe\(/;

for (const { file: f, text } of added) {
  if (isConstraints(f) && /^\| *(W|E)\d+ *\|/.test(text)) flag('new-exception', f, text);
  if (isIgnored(f)) continue;
  if (SUPPRESSIONS.test(text)) flag('silenced-checker', f, text);
  if (STUBS.test(text)) flag('unfinished-work', f, text);
  if (SKIPS.test(text)) flag('test-made-easier', f, text);
}

for (const f of deleted) if (isTest(f)) flag('test-deleted', f, 'file deleted');
for (const { file: f, text } of removed) {
  if (isTest(f) && !deleted.includes(f) && /\b(expect|assert)\b/.test(text)) {
    flag('assertion-removed', f, text);
  }
}

// A rule in CONSTRAINTS.md weakened or removed: numbers are paired by direction (minimum vs
// maximum); an undirected number that changes is reported because tightening can't be told apart.
const ruleKey = (t) => {
  const s = t.trim();
  if (s.startsWith('|'))
    return (
      s
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean)[0] ?? ''
    );
  if (/^[-*] /.test(s)) return s.slice(2).split(':')[0].trim();
  return null;
};
const isException = (t) => /^\| *(W|E)\d+ *\|/.test(t.trim());
const MIN_BEFORE = /(>=|>|≥|at least|minimum|\bmin\b|no less than|not fall|not drop)\s*$/;
const MAX_BEFORE =
  /(<=|<|≤|at most|maximum|\bmax\b|no more than|under|below|not grow|not exceed)\s*$/;
const MIN_AFTER = /^\s*\S*\s*(?:\|\s*)?(or more|or higher|must not fall|must not drop)/;
const MAX_AFTER = /^\s*\S*\s*(?:\|\s*)?(or less|or lower|must not grow|must not exceed)/;
const thresholds = (t) => {
  const out = [];
  const re = /\d+(?:\.\d+)?/g;
  let m;
  while ((m = re.exec(t))) {
    const before = t.slice(Math.max(0, m.index - 24), m.index).toLowerCase();
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 40).toLowerCase();
    const dir =
      MIN_BEFORE.test(before) || MIN_AFTER.test(after)
        ? 'min'
        : MAX_BEFORE.test(before) || MAX_AFTER.test(after)
          ? 'max'
          : null;
    out.push({ n: Number(m[0]), dir });
  }
  return out;
};
const removedRules = removed.filter((l) => isConstraints(l.file) && ruleKey(l.text) !== null);
const addedRules = added.filter((l) => isConstraints(l.file) && ruleKey(l.text) !== null);
for (const r of removedRules) {
  const a = addedRules.find((x) => ruleKey(x.text) === ruleKey(r.text));
  if (!a) {
    if (!isException(r.text)) flag('rule-removed', r.file, r.text);
    continue;
  }
  const before = thresholds(r.text);
  const after = thresholds(a.text);
  let verdict = null;
  for (const dir of ['min', 'max', null]) {
    const was = before.filter((x) => x.dir === dir);
    const now = after.filter((x) => x.dir === dir);
    was.forEach((b, i) => {
      const n = now[i];
      if (verdict) return;
      if (!n) verdict = 'threshold-removed';
      else if (n.n === b.n) return;
      else if (dir === 'min' ? n.n < b.n : dir === 'max' ? n.n > b.n : true) {
        verdict = dir ? 'threshold-loosened' : 'threshold-changed';
      }
    });
  }
  if (verdict) flag(verdict, r.file, r.text + '  ->  ' + a.text);
}

if (findings.length === 0) {
  console.log('floor-guard: clean');
  process.exit(0);
}
console.error('floor-guard: ' + findings.length + ' floor violation(s):');
for (const f of findings) console.error(`  [${f.rule}] ${f.file}: ${f.text}`);
console.error(
  '\nEach is a move that lowers the bar. Fix the code, or route it through a tracked exception.',
);
process.exit(1);

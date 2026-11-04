// Answer-key verifier: proves an item's key by evaluating expr_a and expr_b with mathjs.
// A/B/C keys must hold at every edge value and at SAMPLES_PER_ITEM random values from the domain;
// D keys are proven by their witnesses, which must lie in the domain and really give different relations.
import { compile, type EvalFunction } from 'mathjs';
import type { QuestionItem } from './schema.ts';

export const SAMPLES_PER_ITEM = 500;
// Rejection sampling gives up after this many draws per wanted value (a very narrow domain).
const MAX_DRAWS_PER_SAMPLE = 200;

// Values where comparisons most often flip: negatives, zero, fractions between 0 and 1, and large numbers.
const REAL_EDGES = [-1, 0, 0.5, 1, 2, -0.5, -2, 1e6, -1e6];
const INTEGER_EDGES = [-1, 0, 1, 2, -2, 1e6, -1e6];

type Relation = 'A' | 'B' | 'C';
type Scope = Record<string, number>;

export interface VerifyResult {
  problems: string[];
  /** How many value assignments were evaluated. */
  checks: number;
}

interface Variable {
  name: string;
  kind: 'real' | 'integer';
}

interface Domain {
  variables: Variable[];
  rules: { text: string; fn: EvalFunction }[];
}

class VerifyError extends Error {}

/** Deterministic PRNG (mulberry32) so a failing item fails the same way on every run. */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function compileOrThrow(text: string, label: string): EvalFunction {
  try {
    return compile(text);
  } catch (e) {
    throw new VerifyError(`${label}: cannot read "${text}" (${(e as Error).message})`);
  }
}

/** Domain format: `"real"` or `"integer"`, then optional comma-separated mathjs rules, e.g. `"real, 0 < x < 1"`. */
function parseDomain(domain: Record<string, string> | undefined): Domain {
  const variables: Variable[] = [];
  const rules: Domain['rules'] = [];
  for (const [name, spec] of Object.entries(domain ?? {})) {
    const [kind = '', ...ruleTexts] = spec.split(',').map((part) => part.trim());
    if (kind !== 'real' && kind !== 'integer') {
      throw new VerifyError(`domain.${name}: must start with real or integer, not "${kind}"`);
    }
    variables.push({ name, kind });
    for (const text of ruleTexts) {
      rules.push({ text, fn: compileOrThrow(text, `domain.${name}`) });
    }
  }
  return { variables, rules };
}

function inDomain(domain: Domain, scope: Scope): boolean {
  const wholeNumbers = domain.variables.every(
    (v) => v.kind === 'real' || Number.isInteger(scope[v.name]),
  );
  return (
    wholeNumbers &&
    domain.rules.every(({ text, fn }) => {
      try {
        return fn.evaluate({ ...scope }) === true;
      } catch (e) {
        throw new VerifyError(`domain rule "${text}" failed (${(e as Error).message})`);
      }
    })
  );
}

function drawValue(kind: Variable['kind'], random: () => number): number {
  const sign = random() < 0.5 ? -1 : 1;
  const between = (lo: number, hi: number) => lo + random() * (hi - lo);
  // Buckets mix ordinary, fractional and large magnitudes so narrow domains still get hits.
  const bucket = Math.floor(random() * 5);
  if (kind === 'integer') {
    if (bucket <= 2) return Math.floor(between(-20, 21));
    if (bucket === 3) return sign * Math.floor(between(21, 1000));
    return sign * Math.floor(between(1000, 1e6));
  }
  if (bucket === 0) return between(-10, 10);
  if (bucket === 1) return sign * random();
  if (bucket === 2) return Math.floor(between(-20, 21));
  if (bucket === 3) return sign * between(10, 1000);
  return sign * between(1000, 1e6);
}

function edgePoints(variables: readonly Variable[]): Scope[] {
  let points: Scope[] = [{}];
  for (const v of variables) {
    const edges = v.kind === 'integer' ? INTEGER_EDGES : REAL_EDGES;
    points = points.flatMap((p) => edges.map((value) => ({ ...p, [v.name]: value })));
  }
  return points;
}

function randomPoints(domain: Domain, seed: number): Scope[] {
  if (domain.variables.length === 0) return [];
  const random = makeRandom(seed);
  const points: Scope[] = [];
  for (let draws = 0; draws < SAMPLES_PER_ITEM * MAX_DRAWS_PER_SAMPLE; draws++) {
    const scope: Scope = {};
    for (const v of domain.variables) scope[v.name] = drawValue(v.kind, random);
    if (inDomain(domain, scope)) points.push(scope);
    if (points.length === SAMPLES_PER_ITEM) return points;
  }
  if (points.length === 0) throw new VerifyError('domain: no values satisfy it');
  throw new VerifyError(
    `domain: found only ${points.length} of ${SAMPLES_PER_ITEM} values; widen it or have the item reviewed`,
  );
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toPrecision(6)));
}

function describe(scope: Scope): string {
  const parts = Object.entries(scope).map(([name, value]) => `${name} = ${formatNumber(value)}`);
  return parts.length === 0 ? 'the expressions' : parts.join(', ');
}

function evaluateReal(fn: EvalFunction, label: string, scope: Scope): number {
  let value: unknown;
  try {
    value = fn.evaluate({ ...scope });
  } catch (e) {
    throw new VerifyError(`${label}: ${(e as Error).message}`);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new VerifyError(`${label} is not a real number at ${describe(scope)}`);
  }
  return value;
}

/** Equal within a relative tolerance, so 0.1 + 0.2 counts as equal to 0.3. */
function relationOf(a: number, b: number): Relation {
  if (Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))) return 'C';
  return a > b ? 'A' : 'B';
}

function checkWitnesses(
  item: QuestionItem,
  domain: Domain,
  relationAt: (scope: Scope) => Relation,
): VerifyResult {
  const problems: string[] = [];
  const names = new Set(domain.variables.map((v) => v.name));
  (item.witnesses ?? []).forEach((witness, index) => {
    const label = `witness ${index + 1}`;
    const { relation: stated, ...values } = witness;
    const scope = values as Scope;
    const missing = [...names].filter((name) => !(name in scope));
    const extra = Object.keys(scope).filter((name) => !names.has(name));
    if (missing.length > 0) {
      problems.push(`${label} has no value for ${missing.join(', ')}`);
    } else if (extra.length > 0) {
      problems.push(`${label} sets ${extra.join(', ')}, which has no domain`);
    } else if (!inDomain(domain, scope)) {
      problems.push(`${label} (${describe(scope)}) is outside the domain`);
    } else {
      const actual = relationAt(scope);
      if (actual !== stated)
        problems.push(`${label} says ${stated} but ${describe(scope)} gives ${actual}`);
    }
  });
  return { problems, checks: item.witnesses?.length ?? 0 };
}

/** Proves `item.correct_answer` from its expressions, or explains why it can't. Pure and deterministic. */
export function verifyItem(item: QuestionItem): VerifyResult {
  if (item.expr_a === undefined || item.expr_b === undefined) {
    return item.reviewed_by === undefined
      ? { problems: ['has no expr_a/expr_b, so it needs reviewed_by from a human'], checks: 0 }
      : { problems: [], checks: 0 };
  }
  try {
    const fnA = compileOrThrow(item.expr_a, 'expr_a');
    const fnB = compileOrThrow(item.expr_b, 'expr_b');
    const domain = parseDomain(item.domain);
    const relationAt = (scope: Scope) =>
      relationOf(evaluateReal(fnA, 'expr_a', scope), evaluateReal(fnB, 'expr_b', scope));

    if (item.correct_answer === 'D') return checkWitnesses(item, domain, relationAt);

    const points = [
      ...edgePoints(domain.variables).filter((scope) => inDomain(domain, scope)),
      ...randomPoints(domain, hash(item.id)),
    ];
    for (const scope of points) {
      const actual = relationAt(scope);
      if (actual !== item.correct_answer) {
        return {
          problems: [`key is ${item.correct_answer} but ${describe(scope)} gives ${actual}`],
          checks: points.length,
        };
      }
    }
    return { problems: [], checks: points.length };
  } catch (e) {
    if (e instanceof VerifyError) return { problems: [e.message], checks: 0 };
    throw e;
  }
}

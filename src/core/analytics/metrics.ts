// The seven metrics of CLAUDE.md §4, as pure functions of AttemptEvent[]. A rate is null when it rests on fewer than
// `minAttempts` answers, so no screen can make a claim about a topic from one or two questions.
import { EXAM } from '../config/exam.ts';
import type { Tag, Trap } from '../questions/vocabulary.ts';
import type { AttemptEvent } from '../session/attempt.ts';

export const METRICS = {
  /** No claim about a tag, level or trap below this many answers. */
  minAttempts: 5,
  /** An answer slower than this is flagged in review. */
  slowSeconds: 35,
  /** The pace line: the official average per question (docs/EXAM_FACTS.md), from the exam constants. */
  paceSecondsPerQuestion: EXAM.secondsPerQuestion,
  paceMarkMs: 5 * 60_000,
  staminaWindowMs: 10 * 60_000,
  /** A first-to-last accuracy drop of at least this many percentage points earns a stamina tip. */
  staminaDropPoints: 15,
} as const;

/** "Attempted" means answered: skips and unanswered items are counted by `skips`, not as wrong answers. */
const answered = (events: readonly AttemptEvent[]) => events.filter((e) => e.status === 'answered');

function rate(part: number, whole: number, min: number): number | null {
  return whole < min ? null : part / whole;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

type GroupBy = 'tag' | 'level';

/** Groups events by each of their tags (an item counts under every tag it has) or by level. */
function groupBy(events: readonly AttemptEvent[], by: GroupBy): Map<string, AttemptEvent[]> {
  const groups = new Map<string, AttemptEvent[]>();
  for (const e of events) {
    for (const key of by === 'tag' ? e.tags : [String(e.level)]) {
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }
  }
  return groups;
}

// 1. Time per question

/** answeredAt − shownAt for an answered item; null otherwise. Skips are near-instant and would skew medians. */
export function timeMs(event: AttemptEvent): number | null {
  if (event.status !== 'answered' || event.shownAt === null || event.answeredAt === null)
    return null;
  return event.answeredAt - event.shownAt;
}

export function slowEvents(
  events: readonly AttemptEvent[],
  slowSeconds: number = METRICS.slowSeconds,
): AttemptEvent[] {
  return events.filter((e) => (timeMs(e) ?? 0) > slowSeconds * 1000);
}

/** Median time of the answered items; null below `minAttempts` timed answers. */
export function medianTime(
  events: readonly AttemptEvent[],
  minAttempts: number = METRICS.minAttempts,
): number | null {
  const times = events.map(timeMs).filter((t): t is number => t !== null);
  return times.length < minAttempts ? null : median(times);
}

export function medianTimeBy(
  events: readonly AttemptEvent[],
  by: GroupBy,
  minAttempts: number = METRICS.minAttempts,
): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  for (const [key, group] of groupBy(answered(events), by)) {
    result[key] = medianTime(group, minAttempts);
  }
  return result;
}

// 2. Pace

export interface PaceMark {
  /** Time since the session started. */
  atMs: number;
  answered: number;
  /** Answers the 30 s line expects by then. */
  expected: number;
  behind: boolean;
}

/** At every 5-minute mark up to the end of the session: answers so far against the 30 s-per-question line. */
export function paceMarks(
  events: readonly AttemptEvent[],
  session: { startedAt: number; endedAt: number },
): PaceMark[] {
  const times = answered(events)
    .map((e) => e.answeredAt)
    .filter((t): t is number => t !== null);
  const marks: PaceMark[] = [];
  for (
    let at = METRICS.paceMarkMs;
    session.startedAt + at <= session.endedAt;
    at += METRICS.paceMarkMs
  ) {
    const done = times.filter((t) => t <= session.startedAt + at).length;
    const expected = Math.floor(at / (METRICS.paceSecondsPerQuestion * 1000));
    marks.push({ atMs: at, answered: done, expected, behind: done < expected });
  }
  return marks;
}

// 3. Concept accuracy

export interface AccuracyGroup {
  attempted: number;
  correct: number;
  /** null below `minAttempts`. */
  accuracy: number | null;
}

export function accuracy(
  events: readonly AttemptEvent[],
  minAttempts: number = METRICS.minAttempts,
): number | null {
  const done = answered(events);
  return rate(done.filter((e) => e.correct).length, done.length, minAttempts);
}

export function accuracyBy(
  events: readonly AttemptEvent[],
  by: GroupBy,
  minAttempts: number = METRICS.minAttempts,
): Record<string, AccuracyGroup> {
  const result: Record<string, AccuracyGroup> = {};
  for (const [key, group] of groupBy(answered(events), by)) {
    const correct = group.filter((e) => e.correct).length;
    result[key] = {
      attempted: group.length,
      correct,
      accuracy: rate(correct, group.length, minAttempts),
    };
  }
  return result;
}

// 4. Trap susceptibility

/** Share of D-key items answered A/B/C. Null when there is too little data to say anything. */
export function trapSusceptibility(
  events: readonly AttemptEvent[],
  minAttempts: number = METRICS.minAttempts,
): number | null {
  const dItems = events.filter((e) => e.correctAnswer === 'D' && e.choice !== null);
  if (dItems.length < minAttempts) return null;
  return dItems.filter((e) => e.choice !== 'D').length / dItems.length;
}

export interface TrapGroup {
  attempted: number;
  wrong: number;
  rate: number | null;
}

/** For each trap: wrong ÷ answered among items carrying it. */
export function trapSusceptibilityByTrap(
  events: readonly AttemptEvent[],
  minAttempts: number = METRICS.minAttempts,
): Partial<Record<Trap, TrapGroup>> {
  const result: Partial<Record<Trap, TrapGroup>> = {};
  for (const e of answered(events)) {
    if (e.trap === null) continue;
    const group = result[e.trap] ?? { attempted: 0, wrong: 0, rate: null };
    result[e.trap] = {
      attempted: group.attempted + 1,
      wrong: group.wrong + (e.correct ? 0 : 1),
      rate: null,
    };
  }
  for (const group of Object.values(result)) {
    group.rate = rate(group.wrong, group.attempted, minAttempts);
  }
  return result;
}

// 5. False D rate

/** Share of A/B/C-key items answered D: the over-cautious mirror of trap susceptibility. */
export function falseDRate(
  events: readonly AttemptEvent[],
  minAttempts: number = METRICS.minAttempts,
): number | null {
  const fixed = answered(events).filter((e) => e.correctAnswer !== 'D');
  return rate(fixed.filter((e) => e.choice === 'D').length, fixed.length, minAttempts);
}

// 6. Stamina

export interface Stamina {
  first: number;
  last: number;
  /** first − last in percentage points; negative when the student got better. */
  dropPoints: number;
  tip: boolean;
}

/**
 * Accuracy of answers given in the first 10 minutes against the last 10 minutes of a full mock. Null when the
 * session is too short for two separate windows or either window has fewer than `minAttempts` answers.
 */
export function stamina(
  events: readonly AttemptEvent[],
  session: { startedAt: number; durationMs: number },
  minAttempts: number = METRICS.minAttempts,
): Stamina | null {
  const window = METRICS.staminaWindowMs;
  if (session.durationMs < 2 * window) return null;
  const done = answered(events);
  const inWindow = (from: number, to: number) =>
    done.filter((e) => e.answeredAt !== null && e.answeredAt >= from && e.answeredAt < to);
  const end = session.startedAt + session.durationMs;
  const first = inWindow(session.startedAt, session.startedAt + window);
  // The last window includes the final instant, so an answer given right at time-up still counts.
  const last = inWindow(end - window, end + 1);
  const firstRate = rate(first.filter((e) => e.correct).length, first.length, minAttempts);
  const lastRate = rate(last.filter((e) => e.correct).length, last.length, minAttempts);
  if (firstRate === null || lastRate === null) return null;
  // Rounded to 1/10 000 of a point: 0.95 − 0.8 is 0.1499… in floating point and must still reach the 15-point tip.
  const dropPoints = Math.round((firstRate - lastRate) * 1e6) / 1e4;
  return {
    first: firstRate,
    last: lastRate,
    dropPoints,
    tip: dropPoints >= METRICS.staminaDropPoints,
  };
}

// 7. Skips

export interface SkipSummary {
  skipped: number;
  /** Items without any answer when the session ended (e.g. at time-out). */
  unanswered: number;
  /** How often each tag appears among skipped and unanswered items. */
  tags: Partial<Record<Tag, number>>;
}

export function skips(events: readonly AttemptEvent[]): SkipSummary {
  const left = events.filter((e) => e.status !== 'answered');
  const tags: Partial<Record<Tag, number>> = {};
  for (const e of left) for (const tag of e.tags) tags[tag] = (tags[tag] ?? 0) + 1;
  return {
    skipped: left.filter((e) => e.status === 'skipped').length,
    unanswered: left.filter((e) => e.status === 'unanswered').length,
    tags,
  };
}

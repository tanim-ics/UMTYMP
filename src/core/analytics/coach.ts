// Professor Hoot's feedback (CLAUDE.md §4): one strength with its number, the biggest bottleneck with its number,
// one habit and a 10-question drill. Pure: the same history always gives the same feedback.
import type { DrillFocus } from '../questions/build.ts';
import {
  TAGS,
  TRAP_NAMES,
  TRAPS,
  type Level,
  type Tag,
  type Trap,
} from '../questions/vocabulary.ts';
import type { AttemptEvent, SessionMode } from '../session/attempt.ts';
import type { EndReason } from '../session/trial.ts';
import {
  METRICS,
  accuracyBy,
  falseDRate,
  skips,
  stamina,
  trapSusceptibility,
  trapSusceptibilityByTrap,
} from './metrics.ts';

export interface SessionRecord {
  sessionId: string;
  mode: SessionMode;
  startedAt: number;
  durationMs: number | null;
  endReason: EndReason | null;
  events: readonly AttemptEvent[];
}

/**
 * The best topic, or, when no topic has a single right answer yet, the effort itself: Hoot never calls
 * "0 of 8 right" a strength.
 */
export type Strength =
  | { kind: 'topic'; tag: Tag; correct: number; attempted: number }
  | { kind: 'effort'; answered: number; total: number };

/** `lost` is the number of questions the bottleneck cost; the biggest one is chosen. */
export type Bottleneck =
  | { kind: 'trap'; trap: Trap; lost: number; attempted: number }
  | { kind: 'd_key'; lost: number; attempted: number }
  | { kind: 'false_d'; lost: number; attempted: number }
  | { kind: 'time'; lost: number }
  | { kind: 'stamina'; lost: number; first: number; last: number }
  | { kind: 'tag'; tag: Tag; lost: number; correct: number; attempted: number }
  | { kind: 'challenge'; lost: 0; correct: number; attempted: number };

export type CoachFeedback =
  | {
      kind: 'feedback';
      strength: Strength;
      bottleneck: Bottleneck;
      drill: DrillFocus;
      strengthText: string;
      bottleneckText: string;
      habitText: string;
    }
  | { kind: 'not_enough_data'; answered: number; neededPerTopic: number };

/** Questions in a 10-minute window at the 30 s pace: turns a stamina drop into questions lost. */
const STAMINA_WINDOW_QUESTIONS = METRICS.staminaWindowMs / (METRICS.paceSecondsPerQuestion * 1000);

const TRAP_HABITS: Readonly<Record<Trap, string>> = {
  negative_numbers: 'Test a negative.',
  zero: 'Test 0.',
  fraction_0_1: 'Test ½: powers of a fraction shrink.',
  principal_root: '√ means the non-negative root.',
  even_power: 'An even power hides the sign.',
  absolute_value: '|x| is a distance, never negative.',
  not_to_scale: 'Figures are not to scale; use only what is given.',
  integer_assumption: 'Unless it says integer, test a fraction.',
  order_of_operations: 'Exponents before the minus sign.',
};

const label = (word: string) => word.replace(/_/g, ' ');
const title = (word: string) => label(word).replace(/^\w/, (c) => c.toUpperCase());
const pct = (part: number, whole: number) => Math.round((part / whole) * 100);

/** Most common value, ties broken by the given vocabulary order so the choice is deterministic. */
function mostCommon<T extends string>(values: readonly T[], order: readonly T[]): T | null {
  let best: T | null = null;
  let bestCount = 0;
  for (const v of order) {
    const count = values.filter((x) => x === v).length;
    if (count > bestCount) [best, bestCount] = [v, count];
  }
  return best;
}

/** The named session when the screen knows it; otherwise the finished mock that started last. */
function latestMock(
  history: readonly SessionRecord[],
  latestSessionId?: string,
): SessionRecord | null {
  const mocks = history.filter((s) => s.mode === 'mock' && s.endReason !== null);
  const named = mocks.find((s) => s.sessionId === latestSessionId);
  if (named !== undefined) return named;
  return mocks.reduce<SessionRecord | null>(
    (latest, s) => (latest === null || s.startedAt > latest.startedAt ? s : latest),
    null,
  );
}

type TopicStrength = Extract<Strength, { kind: 'topic' }>;

/** Best accuracy among topics with enough answers; compared as exact fractions, then by more answers. */
function bestTopic(events: readonly AttemptEvent[]): TopicStrength | null {
  let best: TopicStrength | null = null;
  for (const tag of TAGS) {
    const group = accuracyBy(events, 'tag')[tag];
    if (group === undefined || group.accuracy === null) continue;
    const candidate: TopicStrength = {
      kind: 'topic',
      tag,
      correct: group.correct,
      attempted: group.attempted,
    };
    if (
      best === null ||
      candidate.correct * best.attempted > best.correct * candidate.attempted ||
      (candidate.correct * best.attempted === best.correct * candidate.attempted &&
        candidate.attempted > best.attempted)
    ) {
      best = candidate;
    }
  }
  return best;
}

/** Candidates in priority order; see `pickBiggest`. */
function bottlenecks(
  events: readonly AttemptEvent[],
  latest: SessionRecord | null,
  strength: Strength,
): Bottleneck[] {
  const found: Bottleneck[] = [];
  for (const [trap, group] of Object.entries(trapSusceptibilityByTrap(events)) as [
    Trap,
    { attempted: number; wrong: number; rate: number | null },
  ][]) {
    if (group.rate !== null)
      found.push({ kind: 'trap', trap, lost: group.wrong, attempted: group.attempted });
  }
  const dItems = events.filter((e) => e.correctAnswer === 'D' && e.choice !== null);
  if (trapSusceptibility(events) !== null) {
    found.push({
      kind: 'd_key',
      lost: dItems.filter((e) => e.choice !== 'D').length,
      attempted: dItems.length,
    });
  }
  const fixed = events.filter((e) => e.status === 'answered' && e.correctAnswer !== 'D');
  if (falseDRate(events) !== null) {
    found.push({
      kind: 'false_d',
      lost: fixed.filter((e) => e.choice === 'D').length,
      attempted: fixed.length,
    });
  }
  if (latest?.endReason === 'time_up') {
    found.push({ kind: 'time', lost: skips(latest.events).unanswered });
  }
  if (latest !== null && latest.durationMs !== null) {
    const s = stamina(latest.events, {
      startedAt: latest.startedAt,
      durationMs: latest.durationMs,
    });
    if (s?.tip === true) {
      found.push({
        kind: 'stamina',
        lost: Math.round((s.dropPoints / 100) * STAMINA_WINDOW_QUESTIONS),
        first: s.first,
        last: s.last,
      });
    }
  }
  for (const [tag, group] of Object.entries(accuracyBy(events, 'tag')) as [
    Tag,
    { attempted: number; correct: number; accuracy: number | null },
  ][]) {
    if (group.accuracy === null || (strength.kind === 'topic' && tag === strength.tag)) continue;
    found.push({
      kind: 'tag',
      tag,
      lost: group.attempted - group.correct,
      correct: group.correct,
      attempted: group.attempted,
    });
  }
  return found.filter((b) => b.lost > 0);
}

/**
 * The candidate that cost the most questions. `bottlenecks` adds candidates from most to least specific habit
 * (trap, D questions, false D, time, stamina, topic) and the sort is stable, so on equal losses the more specific
 * habit wins.
 */
function pickBiggest(found: readonly Bottleneck[]): Bottleneck | null {
  return [...found].sort((a, b) => b.lost - a.lost)[0] ?? null;
}

function drillFor(
  bottleneck: Bottleneck,
  events: readonly AttemptEvent[],
  latest: SessionRecord | null,
): DrillFocus {
  const tagsOf = (list: readonly AttemptEvent[]) => list.flatMap((e) => e.tags);
  switch (bottleneck.kind) {
    case 'trap':
      return { kind: 'trap', trap: bottleneck.trap };
    case 'tag':
      return { kind: 'tag', tag: bottleneck.tag };
    case 'd_key': {
      const missed = events.filter(
        (e) => e.correctAnswer === 'D' && e.choice !== null && e.choice !== 'D',
      );
      const trap = mostCommon(
        missed.map((e) => e.trap).filter((t): t is Trap => t !== null),
        TRAPS,
      );
      return trap === null ? { kind: 'level', level: 3 } : { kind: 'trap', trap };
    }
    case 'false_d': {
      const wrongD = events.filter((e) => e.correctAnswer !== 'D' && e.choice === 'D');
      return { kind: 'tag', tag: mostCommon(tagsOf(wrongD), TAGS) ?? 'arithmetic' };
    }
    case 'time': {
      const left = (latest?.events ?? []).filter((e) => e.status === 'unanswered');
      return { kind: 'tag', tag: mostCommon(tagsOf(left), TAGS) ?? 'arithmetic' };
    }
    case 'stamina': {
      const wrong = (latest?.events ?? []).filter((e) => e.status === 'answered' && !e.correct);
      return { kind: 'tag', tag: mostCommon(tagsOf(wrong), TAGS) ?? 'arithmetic' };
    }
    case 'challenge': {
      const top = Math.max(...events.map((e) => e.level));
      return { kind: 'level', level: Math.min(5, top + 1) as Level };
    }
  }
}

function describe(b: Bottleneck): { text: string; habit: string } {
  switch (b.kind) {
    case 'trap':
      return {
        text: `Biggest leak: the ${TRAP_NAMES[b.trap]} trap caught you ${b.lost} times in ${b.attempted} (${pct(b.lost, b.attempted)}%).`,
        habit: TRAP_HABITS[b.trap],
      };
    case 'd_key':
      return {
        text: `Biggest leak: on "not enough information" questions you picked a fixed answer ${b.lost} of ${b.attempted} times.`,
        habit: 'Test 2, 0, −1 and ½ before you choose. Two different results mean D.',
      };
    case 'false_d':
      return {
        text: `Biggest leak: you chose D on ${b.lost} of ${b.attempted} questions that had a fixed answer.`,
        habit:
          'Pick D only when two test values disagree. If every test gives the same answer, trust it.',
      };
    case 'time':
      return {
        text: `Biggest leak: ${b.lost} questions were left when time ran out.`,
        habit: 'Give each question about 30 seconds. If you are stuck, skip it and come back.',
      };
    case 'stamina':
      return {
        text: `Biggest leak: your accuracy fell from ${Math.round(b.first * 100)}% in the first 10 minutes to ${Math.round(b.last * 100)}% in the last 10.`,
        habit:
          'Keep checking with test values in the last 10 minutes; that is where points slip away.',
      };
    case 'tag':
      return {
        text: `Biggest leak: ${title(b.tag)}, ${b.correct} of ${b.attempted} right (${pct(b.correct, b.attempted)}%).`,
        habit: `Look for the shortcut before you calculate: every ${label(b.tag)} question has one that takes under 30 seconds.`,
      };
    case 'challenge':
      return {
        text:
          b.correct === b.attempted
            ? `Nothing slipped: ${b.correct} of ${b.attempted} right.`
            : `No single leak stands out yet: ${b.correct} of ${b.attempted} right overall.`,
        habit: 'Keep your habits and try harder questions: the next level is waiting.',
      };
  }
}

function strengthText(strength: Strength): string {
  return strength.kind === 'topic'
    ? `Strongest spell: ${title(strength.tag)}, ${strength.correct} of ${strength.attempted} right (${pct(strength.correct, strength.attempted)}%).`
    : `Strongest spell: you answered ${strength.answered} of ${strength.total} questions.`;
}

/**
 * History in any order and any mix of modes. Time and stamina come from the latest finished mock: the one named by
 * `latestSessionId` (the results screen passes the mock it shows), else the one that started last.
 */
export function coach(
  history: readonly SessionRecord[],
  options: { latestSessionId?: string } = {},
): CoachFeedback {
  const events = history.flatMap((s) => s.events);
  const topic = bestTopic(events);
  if (topic === null) {
    return {
      kind: 'not_enough_data',
      answered: events.filter((e) => e.status === 'answered').length,
      neededPerTopic: METRICS.minAttempts,
    };
  }
  const answered = events.filter((e) => e.status === 'answered');
  const strength: Strength =
    topic.correct > 0 ? topic : { kind: 'effort', answered: answered.length, total: events.length };
  const latest = latestMock(history, options.latestSessionId);
  const bottleneck: Bottleneck = pickBiggest(bottlenecks(events, latest, strength)) ?? {
    kind: 'challenge',
    lost: 0,
    correct: answered.filter((e) => e.correct).length,
    attempted: answered.length,
  };
  const { text, habit } = describe(bottleneck);
  return {
    kind: 'feedback',
    strength,
    bottleneck,
    drill: drillFor(bottleneck, events, latest),
    strengthText: strengthText(strength),
    bottleneckText: text,
    habitText: habit,
  };
}

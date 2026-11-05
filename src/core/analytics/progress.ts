// The castle map's numbers (docs/SPEC.md S6): a trend per finished mock, accuracy and time per topic and level, and
// towers that open from habits and progress. Nothing here looks at dates, so a break of any length never locks a
// tower or breaks a "streak".
import { LEVELS, TAGS, type Level, type Tag } from '../questions/vocabulary.ts';
import type { AttemptEvent } from '../session/attempt.ts';
import type { EndReason } from '../session/trial.ts';
import { earnedBadges, type BadgeId } from './badges.ts';
import type { SessionRecord } from './coach.ts';
import { METRICS, accuracyBy, falseDRate, medianTime, medianTimeBy, stamina } from './metrics.ts';

export interface MockPoint {
  sessionId: string;
  startedAt: number;
  endReason: EndReason;
  correct: number;
  total: number;
  /** Median time of answered questions; null below the minimum number of answers. */
  medianMs: number | null;
  /** Wrong share of answered questions that carry a trap or have a D key. */
  trapRate: number | null;
  falseDRate: number | null;
  /** First 10 minutes minus last 10 minutes, in percentage points. */
  staminaDropPoints: number | null;
}

const isFinished = (s: SessionRecord): s is SessionRecord & { endReason: EndReason } =>
  s.endReason !== null;

const finishedMocks = (history: readonly SessionRecord[]) =>
  history
    .filter(isFinished)
    .filter((s) => s.mode === 'mock')
    .sort((a, b) => a.startedAt - b.startedAt);

function trapRate(events: readonly AttemptEvent[]): number | null {
  const traps = events.filter(
    (e) => e.status === 'answered' && (e.trap !== null || e.correctAnswer === 'D'),
  );
  if (traps.length < METRICS.minAttempts) return null;
  return traps.filter((e) => !e.correct).length / traps.length;
}

/** Finished mocks, oldest first. */
export function mockTrend(history: readonly SessionRecord[]): MockPoint[] {
  return finishedMocks(history).map((s) => ({
    sessionId: s.sessionId,
    startedAt: s.startedAt,
    endReason: s.endReason,
    correct: s.events.filter((e) => e.correct).length,
    total: s.events.length,
    medianMs: medianTime(s.events),
    trapRate: trapRate(s.events),
    falseDRate: falseDRate(s.events),
    staminaDropPoints:
      s.durationMs === null
        ? null
        : (stamina(s.events, { startedAt: s.startedAt, durationMs: s.durationMs })?.dropPoints ??
          null),
  }));
}

export interface ProgressRow<K> {
  key: K;
  attempted: number;
  correct: number;
  accuracy: number | null;
  medianMs: number | null;
}

/** Per topic and per level, over every finished session (mocks, drills and practice). */
export function progressTable(history: readonly SessionRecord[]): {
  tags: ProgressRow<Tag>[];
  levels: ProgressRow<Level>[];
} {
  const events = history.filter(isFinished).flatMap((s) => s.events);
  const rows = <K extends string | number>(keys: readonly K[], by: 'tag' | 'level') => {
    const acc = accuracyBy(events, by);
    const time = medianTimeBy(events, by);
    return keys.flatMap((key): ProgressRow<K>[] => {
      const group = acc[String(key)];
      if (group === undefined) return [];
      return [{ key, ...group, medianMs: time[String(key)] ?? null }];
    });
  };
  return { tags: rows(TAGS, 'tag'), levels: rows(LEVELS, 'level') };
}

export type TowerId = BadgeId | 'rising';

export interface Tower {
  id: TowerId;
  name: string;
  unlocked: boolean;
  /** What opened it, in the student's own numbers; null while locked. */
  evidence: string | null;
  /** What opens it, shown while it is locked. */
  howTo: string;
}

const TOWER_PLAN: readonly { id: TowerId; name: string; howTo: string }[] = [
  { id: 'first_trial', name: 'Gate Tower', howTo: 'Finish your first Grand Trial.' },
  {
    id: 'finished_in_time',
    name: 'Clock Tower',
    howTo: 'Reach every question of a Grand Trial before time runs out.',
  },
  {
    id: 'steady_pace',
    name: 'Hourglass Tower',
    howTo: 'Stay on the 30-second line at every 5-minute mark of a Grand Trial.',
  },
  {
    id: 'negative_tester',
    name: 'Shadow Tower',
    howTo: 'Beat 5 negative-number traps by testing a negative value.',
  },
  {
    id: 'd_detector',
    name: 'Mist Tower',
    howTo: 'Spot at least 8 in 10 "not enough information" questions (over 10 or more).',
  },
  {
    id: 'rising',
    name: 'Rising Tower',
    howTo: 'Score a higher share than in your first Grand Trial.',
  },
];

const percent = (part: number, whole: number) => `${Math.round((part / whole) * 100)}%`;

/** A later mock with a higher share right than the first one; compared as whole numbers, so no rounding decides. */
function rising(history: readonly SessionRecord[]): string | null {
  const [first, ...later] = mockTrend(history).filter((p) => p.total > 0);
  if (first === undefined) return null;
  const better = later.filter((p) => p.correct * first.total > first.correct * p.total);
  const best = better.reduce<MockPoint | null>(
    (top, p) => (top === null || p.correct * top.total > top.correct * p.total ? p : top),
    null,
  );
  if (best === null) return null;
  return `From ${percent(first.correct, first.total)} to ${percent(best.correct, best.total)} right since your first Grand Trial`;
}

export function towers(history: readonly SessionRecord[]): Tower[] {
  const badges = new Map(earnedBadges(history).map((b) => [b.id as TowerId, b.evidence]));
  const risingEvidence = rising(history);
  if (risingEvidence !== null) badges.set('rising', risingEvidence);
  return TOWER_PLAN.map((t) => {
    const evidence = badges.get(t.id) ?? null;
    return { ...t, unlocked: evidence !== null, evidence };
  });
}

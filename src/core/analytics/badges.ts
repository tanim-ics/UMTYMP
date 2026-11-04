// Habit badges. They reward habits and progress, never beating other students (CLAUDE.md §7).
import type { SessionRecord } from './coach.ts';
import { paceMarks } from './metrics.ts';

export type BadgeId =
  'first_trial' | 'finished_in_time' | 'steady_pace' | 'negative_tester' | 'd_detector';

export interface Badge {
  id: BadgeId;
  title: string;
  /** What earned it, in the student's own numbers. */
  evidence: string;
}

const NEGATIVE_TESTER_WINS = 5;
const D_DETECTOR_MIN = 10;

function endOf(s: SessionRecord): number {
  if (s.endReason === 'time_up' && s.durationMs !== null) return s.startedAt + s.durationMs;
  const times = s.events.map((e) => e.answeredAt ?? s.startedAt);
  return Math.max(s.startedAt, ...times);
}

export function earnedBadges(history: readonly SessionRecord[]): Badge[] {
  const mocks = history.filter((s) => s.mode === 'mock' && s.endReason !== null);
  const events = history.filter((s) => s.endReason !== null).flatMap((s) => s.events);
  const badges: Badge[] = [];

  if (mocks.length > 0) {
    badges.push({
      id: 'first_trial',
      title: 'First Grand Trial',
      evidence: `${mocks.length} Grand Trial${mocks.length === 1 ? '' : 's'} finished`,
    });
  }
  const inTime = mocks.filter((s) => s.events.every((e) => e.status !== 'unanswered'));
  if (inTime.length > 0) {
    badges.push({
      id: 'finished_in_time',
      title: 'Beat the clock',
      evidence: `${inTime.length} Grand Trial${inTime.length === 1 ? '' : 's'} with every question reached`,
    });
  }
  const steady = mocks.filter((s) => {
    const marks = paceMarks(s.events, { startedAt: s.startedAt, endedAt: endOf(s) });
    return marks.length > 0 && marks.every((m) => !m.behind);
  });
  if (steady.length > 0) {
    badges.push({
      id: 'steady_pace',
      title: 'Steady pace',
      evidence: 'On the 30-second line at every 5-minute mark',
    });
  }
  const negativeWins = events.filter(
    (e) => e.status === 'answered' && e.correct && e.trap === 'negative_numbers',
  ).length;
  if (negativeWins >= NEGATIVE_TESTER_WINS) {
    badges.push({
      id: 'negative_tester',
      title: 'Negative tester',
      evidence: `${negativeWins} negative-number traps beaten`,
    });
  }
  const dItems = events.filter((e) => e.correctAnswer === 'D' && e.choice !== null);
  const dRight = dItems.filter((e) => e.choice === 'D').length;
  // 80 % compared as whole numbers (right × 5 ≥ answered × 4), so no rounding can move the line.
  if (dItems.length >= D_DETECTOR_MIN && dRight * 5 >= dItems.length * 4) {
    badges.push({
      id: 'd_detector',
      title: 'D detector',
      evidence: `${dRight} of ${dItems.length} "not enough information" questions spotted`,
    });
  }
  return badges;
}

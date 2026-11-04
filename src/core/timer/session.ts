// Session timer as immutable state plus pure functions of `now` (a Clock reading).
// Time is always derived from the clock when it is read, never accumulated per tick, so frame jitter and a
// throttled hidden tab cannot make it drift. The screen calls `checkTimeUp` on each tick and on returning to the tab.

export type TimerMode = 'mock' | 'drill';
export type TimerStatus = 'running' | 'paused' | 'time_up';

export interface TimerState {
  readonly mode: TimerMode;
  /** Countdown length, or null for untimed practice (counts up, never runs out). */
  readonly durationMs: number | null;
  readonly startedAt: number;
  readonly pausedAt: number | null;
  /** Total length of finished pauses. */
  readonly pausedMs: number;
  readonly hiddenAt: number | null;
  /** Total length of finished hidden spells. */
  readonly hiddenMs: number;
  readonly hiddenCount: number;
  readonly timeUpFired: boolean;
}

export function startTimer(
  options: { mode: TimerMode; durationMs: number | null },
  now: number,
): TimerState {
  const { mode, durationMs } = options;
  if (durationMs !== null && !(durationMs > 0)) {
    throw new Error(`duration must be a positive number of ms, not ${durationMs}`);
  }
  return {
    mode,
    durationMs,
    startedAt: now,
    pausedAt: null,
    pausedMs: 0,
    hiddenAt: null,
    hiddenMs: 0,
    hiddenCount: 0,
    timeUpFired: false,
  };
}

/** Time spent in the session, excluding pauses, and never more than the duration. */
export function elapsedMs(state: TimerState, now: number): number {
  const raw = (state.pausedAt ?? now) - state.startedAt - state.pausedMs;
  return state.durationMs === null ? raw : Math.min(raw, state.durationMs);
}

/** Time left on the countdown (never negative), or null when untimed. */
export function remainingMs(state: TimerState, now: number): number | null {
  return state.durationMs === null ? null : state.durationMs - elapsedMs(state, now);
}

export function timerStatus(state: TimerState, now: number): TimerStatus {
  if (remainingMs(state, now) === 0) return 'time_up';
  return state.pausedAt === null ? 'running' : 'paused';
}

/** Mock exams never pause (docs/SPEC.md S1). Pausing a paused or finished drill changes nothing. */
export function pauseTimer(state: TimerState, now: number): TimerState {
  if (state.mode === 'mock') throw new Error('a mock exam cannot be paused');
  if (timerStatus(state, now) !== 'running') return state;
  return { ...state, pausedAt: now };
}

export function resumeTimer(state: TimerState, now: number): TimerState {
  if (state.pausedAt === null) return state;
  return { ...state, pausedAt: null, pausedMs: state.pausedMs + (now - state.pausedAt) };
}

/** The tab was hidden. The clock keeps running; the hidden time is only recorded. */
export function markHidden(state: TimerState, now: number): TimerState {
  if (state.hiddenAt !== null) return state;
  return { ...state, hiddenAt: now, hiddenCount: state.hiddenCount + 1 };
}

export function markVisible(state: TimerState, now: number): TimerState {
  if (state.hiddenAt === null) return state;
  return { ...state, hiddenAt: null, hiddenMs: state.hiddenMs + (now - state.hiddenAt) };
}

/** Total hidden time, including a hidden spell still going on. */
export function hiddenMs(state: TimerState, now: number): number {
  return state.hiddenMs + (state.hiddenAt === null ? 0 : now - state.hiddenAt);
}

/** Reports the time-up event exactly once: `fired` is true only on the first check at or after time-up. */
export function checkTimeUp(state: TimerState, now: number): { state: TimerState; fired: boolean } {
  if (state.timeUpFired || timerStatus(state, now) !== 'time_up') return { state, fired: false };
  return { state: { ...state, timeUpFired: true }, fired: true };
}

/** How long until time-up, so the screen can schedule a single wake-up; null when untimed or paused. */
export function msUntilTimeUp(state: TimerState, now: number): number | null {
  if (state.pausedAt !== null) return null;
  return remainingMs(state, now);
}

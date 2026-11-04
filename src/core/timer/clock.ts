/** A monotonic millisecond clock. Never `Date.now()`: wall-clock time jumps when the device clock is changed. */
export interface Clock {
  now(): number;
}

/**
 * The real clock. `performance.now()` is monotonic and exists in browsers and Node alike, so this keeps
 * `src/core` runnable in tests without a DOM.
 */
export const systemClock: Clock = { now: () => performance.now() };

export interface FakeClock extends Clock {
  advance(ms: number): void;
}

/** A clock that moves only when told to, for tests and the dev-only `window.__umtymp.clock` hook. */
export function createFakeClock(start = 0): FakeClock {
  let current = start;
  return {
    now: () => current,
    advance(ms: number) {
      if (!(ms >= 0)) throw new Error(`a clock cannot go backwards (advance ${ms})`);
      current += ms;
    },
  };
}

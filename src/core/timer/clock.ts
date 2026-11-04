/** A monotonic millisecond clock. Never `Date.now()`: wall-clock time jumps when the device clock is changed. */
export interface Clock {
  now(): number;
}

/**
 * The real clock: `performance.timeOrigin + performance.now()`. Within a page it is the monotonic high-resolution
 * clock; adding the page's time origin puts readings on the epoch scale, so a mock saved before a reload can be
 * resumed with its clock still running. Both exist in browsers and Node, so `src/core` stays testable without a DOM.
 */
export const systemClock: Clock = { now: () => performance.timeOrigin + performance.now() };

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

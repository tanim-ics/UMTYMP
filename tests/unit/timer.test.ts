import { describe, expect, it } from 'vitest';
import { createFakeClock, systemClock } from '../../src/core/timer/clock.ts';
import {
  checkTimeUp,
  elapsedMs,
  hiddenMs,
  markHidden,
  markVisible,
  msUntilTimeUp,
  pauseTimer,
  remainingMs,
  resumeTimer,
  startTimer,
  timerStatus,
} from '../../src/core/timer/session.ts';

const MINUTE = 60_000;
const MOCK_MS = 25 * MINUTE;

describe('clocks', () => {
  it('the fake clock only moves when advanced', () => {
    const clock = createFakeClock(1000);
    expect(clock.now()).toBe(1000);
    clock.advance(250);
    expect(clock.now()).toBe(1250);
  });

  it('the fake clock refuses to go backwards', () => {
    expect(() => createFakeClock().advance(-1)).toThrow(/backwards/);
  });

  it('the system clock is monotonic', () => {
    const first = systemClock.now();
    expect(systemClock.now()).toBeGreaterThanOrEqual(first);
  });
});

describe('countdown', () => {
  it('starts with the full time remaining', () => {
    const timer = startTimer({ mode: 'mock', durationMs: MOCK_MS }, 500);
    expect(elapsedMs(timer, 500)).toBe(0);
    expect(remainingMs(timer, 500)).toBe(MOCK_MS);
    expect(timerStatus(timer, 500)).toBe('running');
  });

  it('counts down as the clock moves', () => {
    const clock = createFakeClock();
    const timer = startTimer({ mode: 'mock', durationMs: MOCK_MS }, clock.now());
    clock.advance(90_000);
    expect(remainingMs(timer, clock.now())).toBe(MOCK_MS - 90_000);
  });

  it('never shows negative time and stops elapsed at the duration', () => {
    const timer = startTimer({ mode: 'mock', durationMs: MOCK_MS }, 0);
    expect(remainingMs(timer, MOCK_MS + 5000)).toBe(0);
    expect(elapsedMs(timer, MOCK_MS + 5000)).toBe(MOCK_MS);
    expect(timerStatus(timer, MOCK_MS + 5000)).toBe('time_up');
  });

  it('is time up exactly at the duration, not one frame later', () => {
    const timer = startTimer({ mode: 'mock', durationMs: MOCK_MS }, 0);
    expect(timerStatus(timer, MOCK_MS - 1)).toBe('running');
    expect(timerStatus(timer, MOCK_MS)).toBe('time_up');
  });

  it('drifts less than 100 ms over 25 minutes of irregular frames', () => {
    const clock = createFakeClock();
    const timer = startTimer({ mode: 'mock', durationMs: MOCK_MS }, clock.now());
    // Frames of 16–17 ms with jitter, as a busy browser delivers them.
    let shown: number | null = MOCK_MS;
    const steps = [16, 17, 16.7, 33.4, 15.9, 250];
    for (let i = 0; clock.now() < MOCK_MS - 300; i++) {
      clock.advance(steps[i % steps.length] ?? 16);
      shown = remainingMs(timer, clock.now());
    }
    const truth = MOCK_MS - clock.now();
    expect(shown).not.toBeNull();
    expect(Math.abs((shown ?? 0) - truth)).toBeLessThan(100);
  });

  it('untimed practice counts up and never runs out', () => {
    const timer = startTimer({ mode: 'drill', durationMs: null }, 0);
    expect(elapsedMs(timer, 3 * MOCK_MS)).toBe(3 * MOCK_MS);
    expect(remainingMs(timer, 3 * MOCK_MS)).toBeNull();
    expect(timerStatus(timer, 3 * MOCK_MS)).toBe('running');
    expect(msUntilTimeUp(timer, 0)).toBeNull();
  });

  it('rejects a duration that is not a positive number', () => {
    expect(() => startTimer({ mode: 'mock', durationMs: 0 }, 0)).toThrow(/duration/);
    expect(() => startTimer({ mode: 'mock', durationMs: Number.NaN }, 0)).toThrow(/duration/);
  });
});

describe('time-up event', () => {
  it('fires once when time runs out, however often it is checked', () => {
    let timer = startTimer({ mode: 'mock', durationMs: MOCK_MS }, 0);
    const before = checkTimeUp(timer, MOCK_MS - 1);
    expect(before.fired).toBe(false);
    timer = before.state;

    const at = checkTimeUp(timer, MOCK_MS + 40);
    expect(at.fired).toBe(true);
    timer = at.state;

    expect(checkTimeUp(timer, MOCK_MS + 80).fired).toBe(false);
  });

  it('never fires for untimed practice', () => {
    const timer = startTimer({ mode: 'drill', durationMs: null }, 0);
    expect(checkTimeUp(timer, 10 * MOCK_MS).fired).toBe(false);
  });

  it('says how long until time-up so the screen can schedule one wake-up', () => {
    const timer = startTimer({ mode: 'mock', durationMs: MOCK_MS }, 0);
    expect(msUntilTimeUp(timer, MINUTE)).toBe(MOCK_MS - MINUTE);
    expect(msUntilTimeUp(timer, MOCK_MS + 1)).toBe(0);
  });
});

describe('pause rules', () => {
  it('a mock exam cannot pause', () => {
    const timer = startTimer({ mode: 'mock', durationMs: MOCK_MS }, 0);
    expect(() => pauseTimer(timer, 1000)).toThrow(/mock/i);
  });

  it('a drill pauses: time stands still until it resumes', () => {
    let timer = startTimer({ mode: 'drill', durationMs: 5 * MINUTE }, 0);
    timer = pauseTimer(timer, MINUTE);
    expect(timerStatus(timer, 3 * MINUTE)).toBe('paused');
    expect(elapsedMs(timer, 3 * MINUTE)).toBe(MINUTE);

    timer = resumeTimer(timer, 3 * MINUTE);
    expect(elapsedMs(timer, 4 * MINUTE)).toBe(2 * MINUTE);
    expect(remainingMs(timer, 4 * MINUTE)).toBe(3 * MINUTE);
  });

  it('a paused drill does not reach time-up', () => {
    const timer = pauseTimer(startTimer({ mode: 'drill', durationMs: MINUTE }, 0), 30_000);
    expect(checkTimeUp(timer, 10 * MINUTE).fired).toBe(false);
    expect(msUntilTimeUp(timer, 10 * MINUTE)).toBeNull();
  });

  it('adds up several pauses', () => {
    let timer = startTimer({ mode: 'drill', durationMs: 10 * MINUTE }, 0);
    timer = resumeTimer(pauseTimer(timer, 1000), 3000);
    timer = resumeTimer(pauseTimer(timer, 5000), 9000);
    expect(elapsedMs(timer, 10_000)).toBe(4000);
  });

  it('pausing twice or resuming while running changes nothing', () => {
    const running = startTimer({ mode: 'drill', durationMs: MINUTE }, 0);
    expect(resumeTimer(running, 1000)).toBe(running);
    const paused = pauseTimer(running, 1000);
    expect(pauseTimer(paused, 2000)).toBe(paused);
  });

  it('a drill cannot pause after its time is up', () => {
    const timer = startTimer({ mode: 'drill', durationMs: MINUTE }, 0);
    expect(pauseTimer(timer, 2 * MINUTE)).toBe(timer);
    expect(timerStatus(timer, 2 * MINUTE)).toBe('time_up');
  });

  it('does not change the state it was given (immutable)', () => {
    const timer = startTimer({ mode: 'drill', durationMs: MINUTE }, 0);
    const copy = { ...timer };
    pauseTimer(timer, 1000);
    expect(timer).toEqual(copy);
  });
});

describe('hidden tab', () => {
  it('a mock keeps running while the tab is hidden, and the hidden time is recorded', () => {
    const clock = createFakeClock();
    let timer = startTimer({ mode: 'mock', durationMs: MOCK_MS }, clock.now());
    clock.advance(MINUTE);
    timer = markHidden(timer, clock.now());
    // A hidden tab gets no frames: nothing reads the clock for 3 minutes.
    clock.advance(3 * MINUTE);
    timer = markVisible(timer, clock.now());

    expect(remainingMs(timer, clock.now())).toBe(MOCK_MS - 4 * MINUTE);
    expect(hiddenMs(timer, clock.now())).toBe(3 * MINUTE);
    expect(timer.hiddenCount).toBe(1);
  });

  it('time-up still fires on return when the time ran out while hidden', () => {
    let timer = startTimer({ mode: 'mock', durationMs: MOCK_MS }, 0);
    timer = markHidden(timer, MOCK_MS - MINUTE);
    timer = markVisible(timer, MOCK_MS + 5 * MINUTE);
    const check = checkTimeUp(timer, MOCK_MS + 5 * MINUTE);
    expect(check.fired).toBe(true);
    expect(elapsedMs(check.state, MOCK_MS + 5 * MINUTE)).toBe(MOCK_MS);
  });

  it('counts time still hidden right now', () => {
    const timer = markHidden(startTimer({ mode: 'mock', durationMs: MOCK_MS }, 0), 1000);
    expect(hiddenMs(timer, 4000)).toBe(3000);
  });

  it('adds up several hidden spells and ignores repeated events', () => {
    let timer = startTimer({ mode: 'mock', durationMs: MOCK_MS }, 0);
    timer = markHidden(timer, 1000);
    timer = markHidden(timer, 1500);
    timer = markVisible(timer, 2000);
    timer = markVisible(timer, 2500);
    timer = markVisible(markHidden(timer, 3000), 3500);
    expect(hiddenMs(timer, 9000)).toBe(1500);
    expect(timer.hiddenCount).toBe(2);
  });
});

// Animation durations for script-driven motion (celebrations on the results screen). The same numbers are the
// --motion-* tokens in tokens.css. Never used on a timed test screen, which stays still (CLAUDE.md §7).

/** Every duration stays under 400 ms (docs/SPEC.md, Look and feel). */
export const MOTION_MS = { fast: 150, base: 250 } as const;

export type MotionSpeed = keyof typeof MOTION_MS;

/** True when the device asks for reduced motion, or when the browser can't say: no motion is the safe default. */
export function prefersReducedMotion(): boolean {
  if (typeof globalThis.matchMedia !== 'function') return true;
  return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** How long an animation of this speed runs right now; 0 means don't animate. */
export function motionMs(speed: MotionSpeed): number {
  return prefersReducedMotion() ? 0 : MOTION_MS[speed];
}

import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOTION_MS, motionMs, prefersReducedMotion } from '../../src/ui/theme/motion.ts';

const css = readFileSync(new URL('../../src/ui/theme/tokens.css', import.meta.url), 'utf8');

afterEach(() => {
  vi.unstubAllGlobals();
});

const stubReduced = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query === '(prefers-reduced-motion: reduce)',
  }));

describe('motion settings', () => {
  it('every animation is shorter than 400 ms (docs/SPEC.md, Look and feel)', () => {
    for (const ms of Object.values(MOTION_MS)) {
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThan(400);
    }
  });

  it('tokens.css uses the same durations, so CSS and script animations agree', () => {
    const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    for (const [speed, ms] of Object.entries(MOTION_MS)) {
      expect(root).toContain(`--motion-${speed}: ${ms}ms;`);
    }
  });

  it('tokens.css sets every duration to 0 and stops all CSS motion for reduced motion', () => {
    const reduced = /prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    for (const speed of Object.keys(MOTION_MS)) {
      expect(reduced).toContain(`--motion-${speed}: 0ms;`);
    }
    expect(reduced).toMatch(/animation-duration:\s*0s\s*!important/);
    expect(reduced).toMatch(/transition-duration:\s*0s\s*!important/);
  });

  it('motionMs gives the duration, or 0 when the device asks for reduced motion', () => {
    stubReduced(false);
    expect(prefersReducedMotion()).toBe(false);
    expect(motionMs('base')).toBe(MOTION_MS.base);
    stubReduced(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(motionMs('fast')).toBe(0);
  });

  it('counts as reduced motion when the browser cannot say (no matchMedia)', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(true);
    expect(motionMs('base')).toBe(0);
  });
});

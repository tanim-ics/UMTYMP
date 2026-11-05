// WCAG AA contrast for every text/background pair of both themes, read straight from tokens.css so the check can't
// drift from what ships. Formula: WCAG 2.1 relative luminance and contrast ratio.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/ui/theme/tokens.css', import.meta.url), 'utf8');

function colours(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/--(color-[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]),
  );
}

const light = colours(/:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '');
const dark = colours(
  /prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '',
);

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Text drawn on a background: needs 4.5 : 1 (WCAG 1.4.3). */
const TEXT_PAIRS: readonly [string, string][] = [
  ['color-text', 'color-bg'],
  ['color-text', 'color-surface'],
  ['color-muted', 'color-bg'],
  ['color-muted', 'color-surface'],
  ['color-accent', 'color-bg'],
  ['color-accent', 'color-surface'],
  ['color-on-accent', 'color-accent'],
  ['color-right', 'color-surface'],
  ['color-right', 'color-bg'],
  ['color-wrong', 'color-surface'],
  ['color-wrong', 'color-bg'],
];

/** Focus rings, chosen borders and control outlines: need 3 : 1 (WCAG 1.4.11). */
const UI_PAIRS: readonly [string, string][] = [
  ['color-accent', 'color-bg'],
  ['color-accent', 'color-surface'],
  ['color-ink', 'color-bg'],
  ['color-ink', 'color-surface'],
];

/** Every SVG in public/art/ is outlined in this colour (docs/ASSETS.md). */
const ART_OUTLINE = '#2b2238';

describe('theme contrast', () => {
  it('reads both palettes from tokens.css', () => {
    expect(Object.keys(light).length).toBeGreaterThanOrEqual(10);
    // Dark mode redefines every colour, so no parchment value leaks into the night sky.
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  for (const [name, palette] of [
    ['parchment (light)', light],
    ['night sky (dark)', dark],
  ] as const) {
    it.each(TEXT_PAIRS)(`${name}: %s on %s is at least 4.5 : 1`, (fg, bg) => {
      expect(palette[fg], fg).toBeDefined();
      expect(palette[bg], bg).toBeDefined();
      expect(ratio(palette[fg] as string, palette[bg] as string)).toBeGreaterThanOrEqual(4.5);
    });

    it.each(UI_PAIRS)(`${name}: %s against %s is at least 3 : 1`, (fg, bg) => {
      expect(ratio(palette[fg] as string, palette[bg] as string)).toBeGreaterThanOrEqual(3);
    });

    // Task 21: pictures sit on a light disc in both palettes, because their dark outlines vanish on the night sky.
    it(`${name}: the art's outline (${ART_OUTLINE}) on color-art-bg is at least 3 : 1`, () => {
      expect(palette['color-art-bg'], 'color-art-bg').toBeDefined();
      expect(ratio(ART_OUTLINE, palette['color-art-bg'] as string)).toBeGreaterThanOrEqual(3);
    });
  }

  it('the ratio formula matches known values', () => {
    expect(ratio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(ratio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});

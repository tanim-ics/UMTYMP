// Task 20: the shipped art is our own, safe to show to children, and logged. Each SVG is self-contained (no script,
// no links out, no embedded images or fonts), names itself for screen readers, stays small, and has a row in
// docs/ASSETS.md.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = new URL('../../public/art/', import.meta.url);
const assets = readFileSync(new URL('../../docs/ASSETS.md', import.meta.url), 'utf8');

const EXPECTED = [
  'hoot.svg',
  'crest-owlcrest.svg',
  'crest-emberwing.svg',
  'crest-foxglen.svg',
  'crest-starhorn.svg',
  'castle-map.svg',
  'potion.svg',
  'spellbook.svg',
];

const files = readdirSync(dir).filter((f) => f.endsWith('.svg'));
const read = (f: string) => readFileSync(new URL(f, dir), 'utf8');

describe('original art', () => {
  it('has every planned picture', () => {
    expect(files.sort()).toEqual([...EXPECTED].sort());
  });

  it.each(EXPECTED)('%s is a self-contained SVG that names itself', (f) => {
    const svg = read(f);
    expect(svg).toMatch(/^<svg\s[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/);
    expect(svg).toMatch(/role="img"/);
    expect(svg).toMatch(/<title[^>]*>[^<]{8,}<\/title>/);
    // Nothing that runs, fetches, or brings in someone else's picture or lettering.
    expect(svg).not.toMatch(/<script|<image|<foreignObject|<text|@import|@font-face/i);
    expect(svg).not.toMatch(/\son\w+\s*=/i);
    expect(svg).not.toMatch(/href\s*=\s*"(?!#)/i);
    expect(Buffer.byteLength(svg)).toBeLessThan(12_000);
  });

  it.each(EXPECTED)('%s has its row in docs/ASSETS.md', (f) => {
    expect(assets).toContain(`\`public/art/${f}\``);
  });
});

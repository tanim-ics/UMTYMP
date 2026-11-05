// Shortcuts and explanations are written for a 10–13-year-old (owner, 2026-11-05; docs/CONTENT.md "Writing for a
// student"). A machine can't judge kindness or clarity, but it can catch the usual slips: long sentences, grown-up
// maths words, and an explanation that never says the answer in the app's own words. Every batch is also re-read
// by hand.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseBank } from '../../src/core/questions/load.ts';
import { ANSWER_WORDS } from '../../src/ui/answers.ts';

const DIR = 'content/questions';
const MAX_WORDS = 25;
/** Words a grade 5–8 student may not know, or that sound like a textbook. Say it in plain words instead. */
const GROWN_UP = [
  'relation',
  'domain',
  'allowed',
  'holds',
  'hence',
  'thus',
  'therefore',
  'algebraically',
  'consecutive',
  'factor',
  'factors',
  'witness',
  'key',
  'whenever',
  'respectively',
  'principal',
];

const { items } = parseBank(
  readdirSync(DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({ name, data: JSON.parse(readFileSync(join(DIR, name), 'utf8')) as unknown })),
);

/** Sentences end at . ! ? before a space or the end, so "0.75" and "½." count right. */
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter((s) => s.trim() !== '');
const words = (sentence: string) => sentence.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));

describe('explanations a 10–13-year-old can follow', () => {
  it('the bank has items to check', () => {
    expect(items.length).toBeGreaterThan(0);
  });

  it(`every sentence has at most ${MAX_WORDS} words`, () => {
    const long = items.flatMap((i) =>
      [i.shortcut_explanation, i.full_explanation].flatMap((text) =>
        sentences(text)
          .filter((s) => words(s).length > MAX_WORDS)
          .map((s) => `${i.id}: ${words(s).length} words: ${s}`),
      ),
    );
    expect(long).toEqual([]);
  });

  it('uses no grown-up maths words', () => {
    const found = items.flatMap((i) => {
      const text = `${i.shortcut_explanation} ${i.full_explanation}`.toLowerCase();
      return GROWN_UP.filter((w) => new RegExp(`\\b${w}\\b`).test(text)).map(
        (w) => `${i.id}: "${w}"`,
      );
    });
    expect(found).toEqual([]);
  });

  it('each explanation ends by saying the answer in the words the app uses', () => {
    const wrong = items
      .filter((i) => {
        const expected = `so the answer is ${i.correct_answer}: ${ANSWER_WORDS[i.correct_answer]}.`;
        return !i.full_explanation.toLowerCase().endsWith(expected.toLowerCase());
      })
      .map((i) => i.id);
    expect(wrong).toEqual([]);
  });
});

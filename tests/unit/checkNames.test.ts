// Task 25: no Harry Potter names in what ships (CLAUDE.md §7, SPEC success criterion 10). The checker matches each
// listed name as a word, through camelCase, kebab-case, snake_case and plurals, and never trips on our own theme.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findNames, readNameList, scanFiles, SCANNED } from '../../tools/check-names.ts';

const LIST = readNameList('tools/franchise-names.txt');

describe('findNames', () => {
  it.each([
    ['Welcome to Hogwarts!', 'hogwarts'],
    ['const gryffindorHouse = 1;', 'gryffindor'],
    ['<g id="slytherin-crest">', 'slytherin'],
    ['house_RAVENCLAW', 'ravenclaw'],
    ['Learn to play quidditch', 'quidditch'],
    ['two Muggles', 'muggle'],
    ['Harry Potter and the maths test', 'harry potter'],
    ['harry-potter.svg', 'harry potter'],
    ['the sorting hat chooses', 'sorting hat'],
  ])('finds the name in %s', (text, name) => {
    expect(findNames(text, LIST).map((f) => f.name)).toContain(name);
  });

  it.each([
    'Owlcrest, Emberwing, Foxglen and Starhorn',
    'Professor Hoot brews a potion in the spellbook tower',
    'the castle map, the Grand Trial, the Potion Drill',
    'a potter makes pots; harry the dog; a hat sorting game',
    'hogwash is not a name',
  ])('leaves our own words alone: %s', (text) => {
    expect(findNames(text, LIST)).toEqual([]);
  });

  it('reports the line of each hit', () => {
    expect(findNames('fine\nalso fine\nDumbledore says', LIST)).toEqual([
      { name: 'dumbledore', line: 3 },
    ]);
  });
});

describe('scanFiles', () => {
  function tree(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'names-'));
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    return root;
  }

  it('finds a planted name in code, in a question and in art', () => {
    const root = tree({
      'src/ui/x.tsx': 'export const house = "Hufflepuff";',
      'content/questions/q.json': '[{"full_explanation": "like a horcrux"}]',
      'public/art/a.svg': '<svg><title>Hedwig</title></svg>',
      'src/ok.ts': 'export const ok = "Owlcrest";',
    });
    const hits = scanFiles(root, LIST).map((h) => `${h.file}:${h.line} ${h.name}`);
    expect(hits).toEqual([
      'content/questions/q.json:1 horcrux',
      'public/art/a.svg:1 hedwig',
      'src/ui/x.tsx:1 hufflepuff',
    ]);
  });

  it('skips binary files', () => {
    const root = tree({ 'public/icons/i.png': 'Gryffindor' });
    expect(scanFiles(root, LIST)).toEqual([]);
  });

  it('covers what ships: code, content, art, the HTML shell and the build config', () => {
    expect(SCANNED).toEqual(['src', 'content', 'public', 'index.html', 'vite.config.ts']);
  });

  it('the real project is clean', () => {
    expect(scanFiles('.', LIST)).toEqual([]);
  });
});

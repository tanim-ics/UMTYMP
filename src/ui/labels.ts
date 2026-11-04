import type { DrillFocus } from '../core/questions/build.ts';
import {
  LEVEL_NAMES,
  TRAP_NAMES,
  type Level,
  type Tag,
  type Trap,
} from '../core/questions/vocabulary.ts';

const words = (s: string) => s.replace(/_/g, ' ');
const capital = (s: string) => s.replace(/^\w/, (c) => c.toUpperCase());

/** "absolute_value" → "Absolute value". */
export const tagLabel = (tag: Tag): string => capital(words(tag));
/** "fraction_0_1" → "Fractions between 0 and 1" (readable names live in the vocabulary). */
export const trapLabel = (trap: Trap): string => capital(TRAP_NAMES[trap]);
/** 3 → "Level 3: Adept". */
export const levelLabel = (level: Level): string => `Level ${level}: ${LEVEL_NAMES[level]}`;

/** What a potion drill button says it will brew. */
export function drillLabel(focus: DrillFocus): string {
  if (focus.kind === 'tag') return tagLabel(focus.tag);
  if (focus.kind === 'trap') return `the ${TRAP_NAMES[focus.trap]} trap`;
  return `level ${focus.level} questions`;
}

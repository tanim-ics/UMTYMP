// Controlled vocabulary for the question bank. docs/CONTENT.md explains each entry; adding one
// is a content decision (propose it, don't add it silently).

export const ANSWERS = ['A', 'B', 'C', 'D'] as const;
export type Answer = (typeof ANSWERS)[number];

export const TAGS = [
  'arithmetic',
  'fractions',
  'decimals',
  'percents',
  'ratios',
  'exponents',
  'roots',
  'inequalities',
  'absolute_value',
  'number_theory',
  'averages',
  'expressions',
  'geometry',
  'triangle_inequality',
] as const;
export type Tag = (typeof TAGS)[number];

export const TRAPS = [
  'negative_numbers',
  'zero',
  'fraction_0_1',
  'principal_root',
  'even_power',
  'absolute_value',
  'not_to_scale',
  'integer_assumption',
  'order_of_operations',
] as const;
export type Trap = (typeof TRAPS)[number];

export const LEVELS = [1, 2, 3, 4, 5] as const;
export type Level = (typeof LEVELS)[number];

/** Longest `target_seconds` allowed per level (docs/SPEC.md → Difficulty levels). */
export const LEVEL_TIME_LIMITS: Readonly<Record<Level, number>> = {
  1: 10,
  2: 15,
  3: 20,
  4: 25,
  5: 30,
};

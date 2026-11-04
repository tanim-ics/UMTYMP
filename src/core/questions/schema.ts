import { z } from 'zod';
import { ANSWERS, LEVEL_TIME_LIMITS, LEVELS, TAGS, TRAPS, type Level } from './vocabulary.ts';

const nonBlank = z.string().trim().min(1, 'must not be empty');

// A witness gives each variable a value and says which relation those values produce.
const witnessSchema = z.object({ relation: z.enum(['A', 'B', 'C']) }).catchall(z.number().finite());

/** Sentence ends are . ! ? followed by a space or the end, so "0.75" is not a sentence end. */
function countSentences(text: string): number {
  return (text.trim().match(/[.!?](?=\s|$)/g) ?? []).length;
}

const MAX_SHORTCUT_SENTENCES = 3;

export const questionItemSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z]+(-[a-z]+)*-\d{4}$/, 'must look like "topic-0001"'),
    quantity_a: nonBlank,
    quantity_b: nonBlank,
    condition: nonBlank.nullable(),
    expr_a: nonBlank.optional(),
    expr_b: nonBlank.optional(),
    domain: z.record(z.string(), nonBlank).optional(),
    correct_answer: z.enum(ANSWERS),
    tags: z
      .array(z.enum(TAGS))
      .min(1, 'needs at least one tag')
      .refine((tags) => new Set(tags).size === tags.length, 'lists a tag twice'),
    trap: z.enum(TRAPS).nullable().optional(),
    difficulty: z
      .number()
      .int()
      .refine((n): n is Level => (LEVELS as readonly number[]).includes(n), 'must be 1–5'),
    target_seconds: z.number().int().positive(),
    witnesses: z.array(witnessSchema).optional(),
    shortcut_explanation: nonBlank,
    full_explanation: nonBlank,
    reviewed_by: nonBlank.optional(),
  })
  .superRefine((item, ctx) => {
    if ((item.expr_a === undefined) !== (item.expr_b === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['expr_a'], message: 'expr_a and expr_b go together' });
    }

    const limit = LEVEL_TIME_LIMITS[item.difficulty];
    if (item.target_seconds > limit) {
      ctx.addIssue({
        code: 'custom',
        path: ['target_seconds'],
        message: `target_seconds ${item.target_seconds} is above the level ${item.difficulty} limit of ${limit}`,
      });
    }

    if (countSentences(item.shortcut_explanation) > MAX_SHORTCUT_SENTENCES) {
      ctx.addIssue({
        code: 'custom',
        path: ['shortcut_explanation'],
        message: `must be at most ${MAX_SHORTCUT_SENTENCES} sentences`,
      });
    }

    if (item.correct_answer !== 'D') {
      if (item.witnesses !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['witnesses'],
          message: 'witnesses are only for D items',
        });
      }
      return;
    }
    const witnesses = item.witnesses ?? [];
    if (witnesses.length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['witnesses'],
        message: 'D items need at least 2 witnesses',
      });
    } else if (new Set(witnesses.map((w) => w.relation)).size < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['witnesses'],
        message: 'D witnesses must give different relations',
      });
    }
  });

export type QuestionItem = z.infer<typeof questionItemSchema>;

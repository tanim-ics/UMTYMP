import { questionItemSchema, type QuestionItem } from './schema.ts';

/** One bank file after JSON parsing; reading it from disk or a bundle is the caller's job. */
export interface BankFile {
  name: string;
  data: unknown;
}

export interface BankError {
  file: string;
  /** The item's id when it has a readable one, otherwise null. */
  id: string | null;
  message: string;
}

export interface Bank {
  items: QuestionItem[];
  errors: BankError[];
}

function readableId(item: unknown): string | null {
  if (typeof item !== 'object' || item === null) return null;
  const id = (item as { id?: unknown }).id;
  return typeof id === 'string' ? id : null;
}

/**
 * Validates every item in every file and reports all problems, not just the first, so an author
 * can fix a whole batch in one pass. Valid items are kept even when others in the file fail.
 */
export function parseBank(files: readonly BankFile[]): Bank {
  const items: QuestionItem[] = [];
  const errors: BankError[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    if (!Array.isArray(file.data)) {
      errors.push({
        file: file.name,
        id: null,
        message: 'file must contain a JSON array of items',
      });
      continue;
    }
    for (const raw of file.data) {
      const result = questionItemSchema.safeParse(raw);
      if (!result.success) {
        const id = readableId(raw);
        for (const issue of result.error.issues) {
          const where = issue.path.length > 0 ? issue.path.join('.') + ': ' : '';
          errors.push({ file: file.name, id, message: where + issue.message });
        }
        continue;
      }
      if (seen.has(result.data.id)) {
        errors.push({ file: file.name, id: result.data.id, message: 'duplicate id' });
        continue;
      }
      seen.add(result.data.id);
      items.push(result.data);
    }
  }
  return { items, errors };
}

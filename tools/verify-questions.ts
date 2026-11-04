// Question-bank verifier: `npm run verify`. Exit 0 when every item is valid, 1 when any is not,
// 2 when it could not run. Checks the schema, then proves every answer key (src/core/questions/evaluate.ts).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verifyItem } from '../src/core/questions/evaluate.ts';
import { parseBank, type BankFile } from '../src/core/questions/load.ts';

const BANK_DIR = 'content/questions';

function readBankFiles(): { files: BankFile[]; problems: string[] } {
  const files: BankFile[] = [];
  const problems: string[] = [];
  if (!existsSync(BANK_DIR)) return { files, problems };
  for (const name of readdirSync(BANK_DIR)
    .filter((n) => n.endsWith('.json'))
    .sort()) {
    const text = readFileSync(join(BANK_DIR, name), 'utf8');
    try {
      files.push({ name, data: JSON.parse(text) });
    } catch (e) {
      problems.push(`${name}: not valid JSON (${(e as Error).message})`);
    }
  }
  return { files, problems };
}

let files: BankFile[];
let problems: string[];
try {
  ({ files, problems } = readBankFiles());
} catch (e) {
  console.error(`verify-questions: could not read ${BANK_DIR} (${(e as Error).message})`);
  process.exit(2);
}

const { items, errors } = parseBank(files);
for (const e of errors) problems.push(`${e.file} [${e.id ?? 'no id'}] ${e.message}`);
let checks = 0;
for (const item of items) {
  const result = verifyItem(item);
  checks += result.checks;
  for (const p of result.problems) problems.push(`[${item.id}] ${p}`);
}

if (problems.length > 0) {
  console.error(`verify-questions: ${problems.length} problem(s) in ${BANK_DIR}:`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(
  `verify-questions: ${items.length} item(s) in ${files.length} file(s), all valid, ${checks} value checks`,
);

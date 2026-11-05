// Export one student to a JSON file, import it on any device, and reset all local data (docs/SPEC.md P2).
// The file holds the same things the database does and nothing more: the three profile fields, sessions and
// answers. Import checks every field with zod (unknown fields are refused) and always creates a new student with
// new ids, so an import can never overwrite or mix with anyone's progress.
import { z } from 'zod';
import { ANSWERS, LEVELS, TAGS, TRAPS } from '../core/questions/vocabulary.ts';
import type { AttemptRow, ProfileRow, SessionRow, UmtympDb } from './db.ts';
import { newId } from './ids.ts';
import { HOUSES, MASCOT_COLORS, validateName } from './profiles.ts';

export const EXPORT_APP = 'comparia-academy';
export const EXPORT_FORMAT = 1;
/** A year of daily mocks is well under 1 MB; anything near this is not one of our files. */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

const ms = z.number().finite();
const count = z.number().int().nonnegative();

const profileSchema = z.strictObject({
  displayName: z.string().refine((name) => {
    const checked = validateName(name);
    return checked.ok && checked.value === name;
  }, 'display name must be 1–20 characters on one line'),
  // null only for profiles from before houses were required; kept as it is rather than invented.
  house: z.enum(HOUSES.map((h) => h.id) as [string, ...string[]]).nullable(),
  mascotColor: z.enum(MASCOT_COLORS.map((c) => c.id) as [string, ...string[]]),
});

const timerSchema = z.strictObject({
  mode: z.enum(['mock', 'drill']),
  durationMs: ms.positive().nullable(),
  startedAt: ms,
  pausedAt: ms.nullable(),
  pausedMs: ms.nonnegative(),
  hiddenAt: ms.nullable(),
  hiddenMs: ms.nonnegative(),
  hiddenCount: count,
  timeUpFired: z.boolean(),
});

const sessionSchema = z.strictObject({
  id: z.string().min(1),
  mode: z.enum(['mock', 'drill', 'practice']),
  itemIds: z.array(z.string().min(1)).min(1),
  index: count,
  shownAt: ms,
  lastShownAt: z.array(ms.nullable()),
  flags: z.array(z.boolean()),
  timer: timerSchema,
  endReason: z.enum(['completed', 'time_up']).nullable(),
  startedAt: ms,
});

const attemptSchema = z.strictObject({
  sessionId: z.string().min(1),
  mode: z.enum(['mock', 'drill', 'practice']),
  itemId: z.string().min(1),
  position: count,
  level: z.union(
    LEVELS.map((l) => z.literal(l)) as [z.ZodLiteral<1>, ...z.ZodLiteral<1 | 2 | 3 | 4 | 5>[]],
  ),
  tags: z.array(z.enum(TAGS)).min(1),
  trap: z.enum(TRAPS).nullable(),
  correctAnswer: z.enum(ANSWERS),
  choice: z.enum(ANSWERS).nullable(),
  status: z.enum(['answered', 'skipped', 'unanswered']),
  correct: z.boolean(),
  shownAt: ms.nullable(),
  answeredAt: ms.nullable(),
  answerChanges: count,
  flagged: z.boolean(),
});

const fileSchema = z.strictObject({
  app: z.literal(EXPORT_APP),
  format: z.literal(EXPORT_FORMAT),
  exportedAt: z.string(),
  profile: profileSchema,
  sessions: z.array(sessionSchema).max(10_000),
  attempts: z.array(attemptSchema).max(500_000),
});

export type ExportFile = z.infer<typeof fileSchema>;
type ExportedSession = Omit<SessionRow, 'profileId'>;

export async function exportProfile(
  db: UmtympDb,
  profileId: string,
  now: Date = new Date(),
): Promise<ExportFile> {
  const profile = await db.profiles.get(profileId);
  if (profile === undefined) throw new Error('profile not found');
  const rows = await db.sessions.where('profileId').equals(profileId).sortBy('startedAt');
  // An allowlist, not "the row minus its owner": a field added to the database later can't leak into files.
  const sessions: ExportedSession[] = rows.map((r) => ({
    id: r.id,
    mode: r.mode,
    itemIds: r.itemIds,
    index: r.index,
    shownAt: r.shownAt,
    lastShownAt: r.lastShownAt,
    flags: r.flags,
    timer: r.timer,
    endReason: r.endReason,
    startedAt: r.startedAt,
  }));
  const attempts = await db.attempts
    .where('sessionId')
    .anyOf(sessions.map((s) => s.id))
    .toArray();
  return {
    app: EXPORT_APP,
    format: EXPORT_FORMAT,
    exportedAt: now.toISOString(),
    profile: {
      displayName: profile.displayName,
      house: profile.house,
      mascotColor: profile.mascotColor,
    },
    sessions,
    attempts,
  } as ExportFile;
}

export function serializeExport(file: ExportFile): string {
  return JSON.stringify(file, null, 2);
}

/** Checks a file a parent chose. The error is written for a parent; it never echoes the file's contents. */
export function parseExport(
  text: string,
): { ok: true; value: ExportFile } | { ok: false; error: string } {
  if (text.length > MAX_IMPORT_BYTES)
    return { ok: false, error: 'This file is too big to be a saved student.' };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This is not a Comparia Academy file.' };
  }
  if (typeof data !== 'object' || data === null || (data as { app?: unknown }).app !== EXPORT_APP) {
    return { ok: false, error: 'This is not a Comparia Academy file.' };
  }
  const format = (data as { format?: unknown }).format;
  if (typeof format === 'number' && format > EXPORT_FORMAT) {
    return {
      ok: false,
      error: 'This file comes from a newer version of the app. Update the app, then try again.',
    };
  }
  const parsed = fileSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue === undefined ? '' : ` (${issue.path.join('.')}: ${issue.message})`;
    return {
      ok: false,
      error: `This file is damaged or was changed, so it can't be imported${where}.`,
    };
  }
  const file = parsed.data;
  const sessions = new Map(file.sessions.map((s) => [s.id, s]));
  for (const s of file.sessions) {
    const n = s.itemIds.length;
    if (s.index >= n || s.flags.length !== n || s.lastShownAt.length !== n) {
      return {
        ok: false,
        error: `Session ${s.id} doesn't fit its questions, so the file can't be imported.`,
      };
    }
  }
  for (const a of file.attempts) {
    const session = sessions.get(a.sessionId);
    if (session === undefined) {
      return {
        ok: false,
        error: "An answer in this file belongs to no session, so it can't be imported.",
      };
    }
    if (session.itemIds[a.position] !== a.itemId) {
      return {
        ok: false,
        error: "An answer in this file doesn't match its question, so it can't be imported.",
      };
    }
  }
  return { ok: true, value: file };
}

/** Adds the file's student as a new profile, with new session ids, in one transaction. */
export async function importProfile(db: UmtympDb, file: ExportFile): Promise<ProfileRow> {
  const profile: ProfileRow = {
    id: newId(),
    displayName: file.profile.displayName,
    house: file.profile.house as ProfileRow['house'],
    mascotColor: file.profile.mascotColor,
  };
  const sessionIds = new Map(file.sessions.map((s) => [s.id, newId()]));
  const sessions: SessionRow[] = file.sessions.map((s) => ({
    ...s,
    id: sessionIds.get(s.id) as string,
    profileId: profile.id,
  }));
  const attempts: AttemptRow[] = file.attempts.map((a) => ({
    ...a,
    sessionId: sessionIds.get(a.sessionId) as string,
  }));
  await db.transaction('rw', db.profiles, db.sessions, db.attempts, async () => {
    await db.profiles.add(profile);
    await db.sessions.bulkAdd(sessions);
    await db.attempts.bulkAdd(attempts);
  });
  return profile;
}

/** Deletes every profile, session and answer on this device. */
export async function resetAll(db: UmtympDb): Promise<void> {
  await db.transaction('rw', db.profiles, db.sessions, db.attempts, async () => {
    await Promise.all([db.profiles.clear(), db.sessions.clear(), db.attempts.clear()]);
  });
}

/** What the Settings screen needs, without knowing about Dexie. */
export function createTransfer(db: UmtympDb) {
  return {
    exportText: async (profileId: string) => serializeExport(await exportProfile(db, profileId)),
    async importText(
      text: string,
    ): Promise<{ ok: true; profile: ProfileRow } | { ok: false; error: string }> {
      const parsed = parseExport(text);
      if (!parsed.ok) return parsed;
      return { ok: true, profile: await importProfile(db, parsed.value) };
    },
    resetAll: () => resetAll(db),
  };
}

export type Transfer = ReturnType<typeof createTransfer>;

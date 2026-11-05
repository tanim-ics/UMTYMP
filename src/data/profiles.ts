// Student profiles. Privacy (CLAUDE.md §1, docs/SPEC.md S7): a display name, a house and a mascot colour, nothing
// else. No passwords in Release 1: a parent manages profiles on the device.
import type { House, ProfileRow, UmtympDb } from './db.ts';
import { newId } from './ids.ts';

export const HOUSES: readonly { id: House; name: string; mascot: string }[] = [
  { id: 'owlcrest', name: 'Owlcrest', mascot: 'owl' },
  { id: 'emberwing', name: 'Emberwing', mascot: 'dragon' },
  { id: 'foxglen', name: 'Foxglen', mascot: 'fox' },
  { id: 'starhorn', name: 'Starhorn', mascot: 'unicorn' },
];

/** Named so the colour is never the only cue (CLAUDE.md: no colour-only meaning). */
export const MASCOT_COLORS: readonly { id: string; name: string; hex: string }[] = [
  { id: 'purple', name: 'Purple', hex: '#7c5cd6' },
  { id: 'teal', name: 'Teal', hex: '#1f9e95' },
  { id: 'gold', name: 'Gold', hex: '#d9a21b' },
  { id: 'rose', name: 'Rose', hex: '#d6567a' },
  { id: 'sky', name: 'Sky', hex: '#3b8fd9' },
  { id: 'green', name: 'Green', hex: '#4aa63f' },
];

export const MAX_NAME_LENGTH = 20;

/** A checked profile: always a real house (the row type also allows null for older data). */
export type ProfileInput = { displayName: string; house: House; mascotColor: string };

export function validateName(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const name = raw.trim();
  if (name.length === 0) return { ok: false, error: 'Type a name to show on the screen.' };
  if (/[\r\n]/.test(name)) return { ok: false, error: 'Keep the name on one line.' };
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Use at most ${MAX_NAME_LENGTH} letters.` };
  }
  return { ok: true, value: name };
}

/** Checks everything a profile may hold; unknown houses or colours are refused. */
export function validateProfile(input: {
  displayName: string;
  house: string;
  mascotColor: string;
}): { ok: true; value: ProfileInput } | { ok: false; error: string } {
  const name = validateName(input.displayName);
  if (!name.ok) return name;
  const house = HOUSES.find((h) => h.id === input.house);
  if (house === undefined) return { ok: false, error: 'Choose one of the four houses.' };
  if (!MASCOT_COLORS.some((c) => c.id === input.mascotColor)) {
    return { ok: false, error: 'Choose a mascot colour.' };
  }
  return {
    ok: true,
    value: { displayName: name.value, house: house.id, mascotColor: input.mascotColor },
  };
}

export function createProfileRepo(db: UmtympDb) {
  return {
    /** Profiles sorted by name, ignoring case. */
    async list(): Promise<ProfileRow[]> {
      const rows = await db.profiles.toArray();
      return rows.sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
      );
    },

    /** The first profile also adopts sessions saved before profiles existed, so no progress is lost. */
    async create(input: {
      displayName: string;
      house: string;
      mascotColor: string;
    }): Promise<ProfileRow> {
      const checked = validateProfile(input);
      if (!checked.ok) throw new Error(checked.error);
      const row: ProfileRow = { id: newId(), ...checked.value };
      await db.transaction('rw', db.profiles, db.sessions, async () => {
        const first = (await db.profiles.count()) === 0;
        await db.profiles.add(row);
        if (first)
          await db.sessions.filter((s) => s.profileId === null).modify({ profileId: row.id });
      });
      return row;
    },

    async rename(id: string, displayName: string): Promise<void> {
      const name = validateName(displayName);
      if (!name.ok) throw new Error(name.error);
      await db.profiles.update(id, { displayName: name.value });
    },

    /** Removes the profile and every session and answer that belongs to it. */
    async remove(id: string): Promise<void> {
      await db.transaction('rw', db.profiles, db.sessions, db.attempts, async () => {
        const sessionIds = await db.sessions.where('profileId').equals(id).primaryKeys();
        await db.attempts.where('sessionId').anyOf(sessionIds).delete();
        await db.sessions.bulkDelete(sessionIds);
        await db.profiles.delete(id);
      });
    },
  };
}

export type ProfileRepo = ReturnType<typeof createProfileRepo>;

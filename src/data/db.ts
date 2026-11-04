// Local storage (IndexedDB via Dexie). Release 1 has no backend: everything stays in this browser.
// Privacy (CLAUDE.md §1): a profile holds only a display name, a house and a mascot colour.
import Dexie, { type DexieOptions, type Table } from 'dexie';
import type { AttemptEvent, SessionMode } from '../core/session/attempt.ts';
import type { EndReason } from '../core/session/trial.ts';
import type { TimerState } from '../core/timer/session.ts';

export type House = 'owlcrest' | 'emberwing' | 'foxglen' | 'starhorn';

export interface ProfileRow {
  id: string;
  displayName: string;
  house: House | null;
  mascotColor: string;
}

/** Everything needed to rebuild a session except its items, which come back from the bundled bank by id. */
export interface SessionRow {
  id: string;
  profileId: string | null;
  mode: SessionMode;
  itemIds: string[];
  index: number;
  shownAt: number;
  lastShownAt: (number | null)[];
  flags: boolean[];
  timer: TimerState;
  endReason: EndReason | null;
  /** `timer.startedAt`, copied out so sessions can be ordered by an index. */
  startedAt: number;
}

export type AttemptRow = AttemptEvent;

export class UmtympDb extends Dexie {
  profiles!: Table<ProfileRow, string>;
  sessions!: Table<SessionRow, string>;
  attempts!: Table<AttemptRow, [string, number]>;

  constructor(name: string, options?: DexieOptions) {
    super(name, options);
    // Schema v1. A change to any table adds `this.version(2).stores(...).upgrade(...)`; never edit v1.
    this.version(1).stores({
      profiles: 'id',
      sessions: 'id, startedAt, profileId',
      attempts: '[sessionId+position], sessionId, itemId',
    });
  }
}

/** `options` lets tests pass an in-memory IndexedDB. */
export function openDb(name = 'umtymp', options?: DexieOptions): UmtympDb {
  return new UmtympDb(name, options);
}

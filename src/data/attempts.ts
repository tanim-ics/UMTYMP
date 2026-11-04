// Saves sessions and their AttemptEvents as they happen, and loads them back for resume and history.
import type { SessionRecord } from '../core/analytics/coach.ts';
import type { QuestionItem } from '../core/questions/schema.ts';
import type { EndReason, TrialState } from '../core/session/trial.ts';
import type { SessionStoreApi } from '../store/session.ts';
import type { SessionRow, UmtympDb } from './db.ts';

export interface FinishedSession {
  sessionId: string;
  startedAt: number;
  total: number;
  correct: number;
  endReason: EndReason;
  itemIds: string[];
}

function toRow(trial: TrialState, profileId: string | null): SessionRow {
  return {
    id: trial.sessionId,
    profileId,
    mode: trial.mode,
    itemIds: trial.items.map((i) => i.id),
    index: trial.index,
    shownAt: trial.shownAt,
    lastShownAt: [...trial.lastShownAt],
    flags: [...trial.flags],
    timer: trial.timer,
    endReason: trial.endReason,
    startedAt: trial.timer.startedAt,
  };
}

export function createAttemptRepo(db: UmtympDb) {
  /** A profile's sessions, oldest first. */
  const ofProfile = (profileId: string) =>
    db.sessions.where('profileId').equals(profileId).sortBy('startedAt');
  return {
    /** Writes the session snapshot and all of its events in one transaction, owned by `profileId`. */
    async saveTrial(trial: TrialState, profileId: string | null): Promise<void> {
      await db.transaction('rw', db.sessions, db.attempts, async () => {
        await db.sessions.put(toRow(trial, profileId));
        await db.attempts.bulkPut([...trial.events]);
      });
    },

    /** The profile's newest unfinished session, rebuilt; null if none, or if the bank no longer has one of its items. */
    async loadActive(bank: readonly QuestionItem[], profileId: string): Promise<TrialState | null> {
      const rows = await ofProfile(profileId);
      const row = rows.filter((s) => s.endReason === null).at(-1);
      if (row === undefined) return null;
      const byId = new Map(bank.map((i) => [i.id, i]));
      const items = row.itemIds.map((id) => byId.get(id));
      if (items.some((i) => i === undefined)) return null;
      const events = await db.attempts.where('sessionId').equals(row.id).sortBy('position');
      return {
        sessionId: row.id,
        mode: row.mode,
        items: items as QuestionItem[],
        index: row.index,
        shownAt: row.shownAt,
        lastShownAt: row.lastShownAt,
        flags: row.flags,
        events,
        timer: row.timer,
        endReason: row.endReason,
      };
    },

    /** Every finished session (all modes), oldest first, with its events: the coach's input. */
    async listHistory(profileId: string): Promise<SessionRecord[]> {
      const rows = (await ofProfile(profileId)).filter((s) => s.endReason !== null);
      return Promise.all(
        rows.map(async (row) => ({
          sessionId: row.id,
          mode: row.mode,
          startedAt: row.startedAt,
          durationMs: row.timer.durationMs,
          endReason: row.endReason,
          events: await db.attempts.where('sessionId').equals(row.id).sortBy('position'),
        })),
      );
    },

    /** Finished mocks, newest first, with their score. */
    async listFinished(profileId: string): Promise<FinishedSession[]> {
      const rows = (await ofProfile(profileId))
        .filter((s) => s.mode === 'mock' && s.endReason !== null)
        .reverse();
      return Promise.all(
        rows.map(async (row) => ({
          sessionId: row.id,
          startedAt: row.startedAt,
          total: row.itemIds.length,
          correct: await db.attempts
            .where('sessionId')
            .equals(row.id)
            .filter((a) => a.correct)
            .count(),
          endReason: row.endReason as EndReason,
          itemIds: row.itemIds,
        })),
      );
    },
  };
}

export type AttemptRepo = ReturnType<typeof createAttemptRepo>;

/** One student's history, with the profile already bound: what the home screen and the coach card read. */
export interface ProfileHistory {
  listFinished(): Promise<FinishedSession[]>;
  listHistory(): Promise<SessionRecord[]>;
}

/**
 * Saves the trial whenever it changes (an answer, skip, flag, move, hidden tab, or the end), never on ticks that
 * change nothing. Writes run one after another so the last state always wins. A failed write is reported and the
 * trial carries on: a child should never lose the mock they are in because storage is full or blocked.
 */
export function connectPersistence(
  store: SessionStoreApi,
  repo: Pick<AttemptRepo, 'saveTrial'>,
  onError: (error: unknown) => void,
) {
  let queue: Promise<void> = Promise.resolve();
  const disconnect = store.subscribe((state, previous) => {
    const trial = state.trial;
    if (trial === null || trial === previous.trial) return;
    const { profileId } = state;
    queue = queue.then(() => repo.saveTrial(trial, profileId)).catch(onError);
  });
  return { flush: () => queue, disconnect };
}

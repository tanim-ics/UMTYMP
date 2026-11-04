// Saves sessions and their AttemptEvents as they happen, and loads them back for resume and history.
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

function toRow(trial: TrialState): SessionRow {
  return {
    id: trial.sessionId,
    profileId: null, // profiles arrive with the Profiles screen
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
  return {
    /** Writes the session snapshot and all of its events in one transaction. */
    async saveTrial(trial: TrialState): Promise<void> {
      await db.transaction('rw', db.sessions, db.attempts, async () => {
        await db.sessions.put(toRow(trial));
        await db.attempts.bulkPut([...trial.events]);
      });
    },

    /** The newest unfinished session, rebuilt; null if none, or if the bank no longer has one of its items. */
    async loadActive(bank: readonly QuestionItem[]): Promise<TrialState | null> {
      const row = await db.sessions
        .orderBy('startedAt')
        .reverse()
        .filter((s) => s.endReason === null)
        .first();
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

    /** Finished mocks, newest first, with their score. */
    async listFinished(): Promise<FinishedSession[]> {
      const rows = await db.sessions
        .orderBy('startedAt')
        .reverse()
        .filter((s) => s.mode === 'mock' && s.endReason !== null)
        .toArray();
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
    queue = queue.then(() => repo.saveTrial(trial)).catch(onError);
  });
  return { flush: () => queue, disconnect };
}

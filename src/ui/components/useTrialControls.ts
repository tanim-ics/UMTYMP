import { useEffect, type RefObject } from 'react';
import type { Answer } from '../../core/questions/vocabulary.ts';
import type { SessionStoreApi } from '../../store/session.ts';

const KEY_TO_ANSWER: Readonly<Record<string, Answer>> = {
  '1': 'A',
  '2': 'B',
  '3': 'C',
  '4': 'D',
  a: 'A',
  b: 'B',
  c: 'C',
  d: 'D',
};
// The clock is read on each tick; 250 ms keeps the seconds display within a quarter second of the truth.
const TICK_MS = 250;

/**
 * Ticks the clock, records a hidden tab and handles the keys of a running session (docs/CONTRACTS.md → keys).
 * `canPause` adds P to pause and resume (drills only; a mock never pauses).
 */
export function useTrialControls(
  store: SessionStoreApi,
  finishRef: RefObject<HTMLButtonElement>,
  options: { canPause: boolean },
): void {
  const { canPause } = options;
  useEffect(() => {
    const { tick, setHidden } = store.getState();
    const interval = setInterval(tick, TICK_MS);
    const onVisibility = () => setHidden(document.visibilityState === 'hidden');
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const s = store.getState();
      const t = s.trial;
      if (t === null || t.endReason !== null) return;
      const key = e.key.toLowerCase();
      if (canPause && key === 'p') {
        if (t.timer.pausedAt === null) s.pause();
        else s.unpause();
        return;
      }
      const target = e.target instanceof HTMLElement ? e.target : null;
      // A focused control button (Back, Finish…) handles its own Enter; answer buttons don't, so Enter moves on.
      const onControl = target?.tagName === 'BUTTON' && target.dataset.answer === undefined;
      if (e.key === 'Enter' || e.key === 'ArrowRight') {
        if (e.key === 'Enter' && onControl) return;
        e.preventDefault();
        // Finishing ends the session for good, so the last Enter only moves focus to Finish.
        if (t.index === t.items.length - 1) finishRef.current?.focus();
        else s.next();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        s.back();
        return;
      }
      const letter = KEY_TO_ANSWER[key];
      if (letter !== undefined) s.answer(letter);
      else if (key === 's') s.skip();
      else if (key === 'f') s.flag();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [store, finishRef, canPause]);
}

/** mm:ss. A countdown rounds up (0:01 until time is really up); a count-up rounds down. */
export function formatTime(ms: number, round: 'up' | 'down'): string {
  const total = round === 'up' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

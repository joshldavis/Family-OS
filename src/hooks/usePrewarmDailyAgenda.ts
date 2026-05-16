/**
 * usePrewarmDailyAgenda
 *
 * Runs once per session, shortly after the user logs in, to fill any missing
 * entries in today's Daily Agenda cache. The intent: by the time anyone visits
 * /agenda or hits "Print all" in the morning, today's joke + fun fact for each
 * kid is already generated.
 *
 * In a pure browser app we can't truly schedule "5am every night" — service
 * workers go dormant and there's no cron. This is the practical equivalent:
 * "generate the moment anyone opens the app each day."
 *
 * The hook is intentionally silent — it returns a status object that the UI
 * can optionally surface, but does not show its own toasts/errors.
 */

import React, { useEffect, useRef, useState } from 'react';
import { User, Student } from '../types';
import {
  AgendaCache,
  prewarmAgendaCache,
  todayISO,
  lastPrewarmDate,
} from '../services/dailyAgenda';

export interface PrewarmStatus {
  /** Has the prewarm pass completed for today? */
  ranToday: boolean;
  /** Currently generating in the background. */
  running: boolean;
  /** Number of kids whose extras were generated in this pass. */
  generated: number;
  /** Number of kids whose extras were already cached. */
  skipped: number;
  /** Number of kids whose extras were pulled from Supabase (cron-generated). */
  fromCron: number;
  /** Number of per-kid failures during this pass. */
  errors: number;
  /** Date (YYYY-MM-DD) of the most recent cache entry, or null. */
  lastDate: string | null;
}

interface Options {
  /** Skip prewarm entirely (e.g. when the Daily Agenda module is disabled). */
  enabled?: boolean;
  /** Only run after the user is logged in. */
  loggedIn?: boolean;
  /** Family ID for Supabase fetch + push. Omit to disable server sync. */
  familyId?: string;
}

export function usePrewarmDailyAgenda(
  users: User[],
  students: Student[],
  cache: AgendaCache,
  setCache: React.Dispatch<React.SetStateAction<AgendaCache>>,
  opts: Options = {},
): PrewarmStatus {
  const { enabled = true, loggedIn = true, familyId } = opts;
  const [status, setStatus] = useState<PrewarmStatus>({
    ranToday: false,
    running: false,
    generated: 0,
    skipped: 0,
    fromCron: 0,
    errors: 0,
    lastDate: lastPrewarmDate(cache),
  });

  // Guard so we only run once per session even across remounts.
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !loggedIn) return;
    if (firedRef.current) return;
    if (users.length === 0) return;
    firedRef.current = true;

    let cancelled = false;
    const today = todayISO();

    setStatus(s => ({ ...s, running: true }));

    (async () => {
      try {
        const result = await prewarmAgendaCache(
          users,
          students,
          cache,
          next => {
            if (cancelled) return;
            setCache(next);
          },
          familyId,
        );
        if (cancelled) return;
        setStatus({
          ranToday: true,
          running: false,
          generated: result.generated,
          skipped: result.skipped,
          fromCron: result.fromCron,
          errors: result.errors,
          lastDate: today,
        });
      } catch (err) {
        if (cancelled) return;
        console.warn('[usePrewarmDailyAgenda] failed:', err);
        setStatus(s => ({ ...s, running: false, errors: s.errors + 1 }));
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loggedIn, users.length]);

  return status;
}

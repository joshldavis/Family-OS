/**
 * Daily Agenda service — generation logic + cache helpers shared between
 * the DailyAgenda page (lazy generation on first visit) and the
 * usePrewarmDailyAgenda hook (eager generation on app load).
 */

import { User, Role, Student } from '../types';
import { structured, modelFor, AIConfigError, Type } from './ai';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface DailyExtras {
  joke: string;
  fact: string;
  /** Where this entry came from — surfaces the 'Generated overnight' badge. */
  source?: 'cron' | 'client';
}

export interface AgendaCache {
  /** Keyed as `${kidId}|${dateISO}` (YYYY-MM-DD, local tz). */
  [key: string]: DailyExtras;
}

export const AGENDA_CACHE_KEY = 'family_os_daily_agenda';

export function todayISO(): string {
  return new Date().toLocaleDateString('en-CA');
}

export function cacheKey(kidId: string, date: string): string {
  return `${kidId}|${date}`;
}

/** Match a Student record to a User by case-insensitive name. */
export function studentForUser(user: User, students: Student[]): Student | undefined {
  return students.find(s => s.name.toLowerCase() === user.name.toLowerCase());
}

/** Loose check whether the user has opted in to AI features (i.e. has any key configured). */
export function hasAnyAIKey(): boolean {
  try {
    const raw = localStorage.getItem('family_os_ai_keys');
    const keys = raw ? JSON.parse(raw) as { gemini?: string; claude?: string } : {};
    if (keys.gemini || keys.claude) return true;
  } catch { /* ignore */ }
  return !!import.meta.env.VITE_API_KEY || !!import.meta.env.VITE_ANTHROPIC_API_KEY;
}

/**
 * Generate today's joke + fun fact for a single kid.
 * Throws AIConfigError if no key is configured. Caller handles caching.
 */
export async function generateDailyExtras(
  kid: User,
  students: Student[],
): Promise<DailyExtras> {
  const student = studentForUser(kid, students);
  const ageHint = student?.grade ?? 'school age';

  const systemInstruction =
    `You write daily one-pager content for children. Audience: a kid in ${ageHint}. ` +
    `Output one short kid-friendly joke and one short "Fun Fact" that's age-appropriate, ` +
    `surprising, and PG. Keep each under 30 words. Avoid repeating yesterday's pattern. ` +
    `Be light, warm, and curious.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      joke: { type: Type.STRING },
      fact: { type: Type.STRING },
    },
    required: ['joke', 'fact'],
  };

  const parsed = await structured<{ joke?: string; fact?: string }>({
    model: modelFor('briefing'),
    systemInstruction,
    responseSchema,
    text: `Generate today's joke and fun fact for ${kid.name}.`,
  });

  return {
    joke: parsed.joke ?? 'No joke today!',
    fact: parsed.fact ?? '',
    source: 'client',
  };
}

/**
 * Fetch overnight-generated agendas from Supabase for a given family and date.
 * Returns a partial cache map keyed `${kidId}|${date}`. No-op (empty map) when
 * Supabase isn't configured.
 */
export async function fetchAgendasFromSupabase(
  familyId: string,
  date: string,
): Promise<AgendaCache> {
  if (!isSupabaseConfigured) return {};

  const { data, error } = await supabase
    .from('daily_agendas')
    .select('kid_id, joke, fact, generated_by')
    .eq('family_id', familyId)
    .eq('agenda_date', date);

  if (error) {
    console.warn('[dailyAgenda] supabase fetch failed:', error.message);
    return {};
  }

  const out: AgendaCache = {};
  for (const row of data ?? []) {
    out[cacheKey(row.kid_id as string, date)] = {
      joke: (row.joke as string) ?? '',
      fact: (row.fact as string) ?? '',
      source: ((row.generated_by as string) === 'cron' ? 'cron' : 'client'),
    };
  }
  return out;
}

/**
 * Upsert a client-generated agenda back to Supabase so all family members'
 * devices see it. Silently no-ops if Supabase isn't configured.
 */
export async function pushAgendaToSupabase(
  familyId: string,
  kidId: string,
  date: string,
  extras: DailyExtras,
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from('daily_agendas')
    .upsert(
      {
        family_id: familyId,
        kid_id: kidId,
        agenda_date: date,
        joke: extras.joke,
        fact: extras.fact,
        generated_at: new Date().toISOString(),
        generated_by: extras.source ?? 'client',
      },
      { onConflict: 'family_id,kid_id,agenda_date' },
    );
  if (error) {
    console.warn('[dailyAgenda] supabase upsert failed:', error.message);
  }
}

/**
 * Iterate every child user, generating today's extras for any kid whose cache
 * entry is missing. Mutates and returns the updated cache.
 *
 * Designed to be idempotent and silent — runs in the background on app load.
 * If no AI key is configured, this is a no-op (returns the cache unchanged).
 *
 * @param users   All users in the family workspace.
 * @param students All Student records.
 * @param current  The current cache from localStorage.
 * @param onUpdate Called each time a kid's extras are added — lets the caller
 *                 persist incrementally so a refresh mid-flight keeps progress.
 */
export async function prewarmAgendaCache(
  users: User[],
  students: Student[],
  current: AgendaCache,
  onUpdate: (next: AgendaCache) => void,
  familyId?: string,
): Promise<{ generated: number; skipped: number; errors: number; fromCron: number }> {
  const date = todayISO();
  const kids = users.filter(u => u.role === Role.CHILD);
  let generated = 0;
  let skipped = 0;
  let errors = 0;
  let fromCron = 0;
  let working = current;

  // ── Step 1: pull any overnight-generated rows from Supabase ────────────
  // This is the fast path — no AI calls, no key needed locally.
  if (familyId && isSupabaseConfigured) {
    try {
      const serverCache = await fetchAgendasFromSupabase(familyId, date);
      const serverKeys = Object.keys(serverCache);
      if (serverKeys.length > 0) {
        working = { ...working, ...serverCache };
        onUpdate(working);
        fromCron = serverKeys.filter(k => serverCache[k].source === 'cron').length;
      }
    } catch (err) {
      console.warn('[DailyAgenda] supabase prewarm fetch failed:', err);
    }
  }

  // ── Step 2: client-side fallback for any kid still missing today ───────
  if (!hasAnyAIKey()) {
    // Nothing more we can do locally — return what we got from the server.
    const missing = kids.filter(k => !working[cacheKey(k.id, date)]).length;
    return { generated, skipped: kids.length - missing, errors, fromCron };
  }

  for (const kid of kids) {
    const key = cacheKey(kid.id, date);
    if (working[key]) { skipped++; continue; }

    try {
      const extras = await generateDailyExtras(kid, students);
      working = { ...working, [key]: extras };
      onUpdate(working);
      generated++;
      // Best-effort: push to Supabase so other devices in the family see it.
      if (familyId) {
        pushAgendaToSupabase(familyId, kid.id, date, extras).catch(() => undefined);
      }
    } catch (err) {
      if (err instanceof AIConfigError) {
        return { generated, skipped, errors: errors + (kids.length - generated - skipped), fromCron };
      }
      console.warn(`[DailyAgenda] prewarm failed for ${kid.name}:`, err);
      errors++;
    }
  }

  return { generated, skipped, errors, fromCron };
}

/** Returns the date (YYYY-MM-DD) of the most recent cache entry for any kid, or null. */
export function lastPrewarmDate(cache: AgendaCache): string | null {
  const dates = Object.keys(cache).map(k => k.split('|')[1]).filter(Boolean);
  if (dates.length === 0) return null;
  return dates.sort().pop() ?? null;
}

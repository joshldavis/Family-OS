/**
 * Daily Agenda service — generation logic + cache helpers shared between
 * the DailyAgenda page (lazy generation on first visit) and the
 * usePrewarmDailyAgenda hook (eager generation on app load).
 */

import { User, Role, Student } from '../types';
import { structured, modelFor, AIConfigError, Type } from './ai';

export interface DailyExtras {
  joke: string;
  fact: string;
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
  };
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
): Promise<{ generated: number; skipped: number; errors: number }> {
  const date = todayISO();
  const kids = users.filter(u => u.role === Role.CHILD);
  let generated = 0;
  let skipped = 0;
  let errors = 0;
  let working = current;

  if (!hasAnyAIKey()) {
    return { generated, skipped: kids.length, errors };
  }

  for (const kid of kids) {
    const key = cacheKey(kid.id, date);
    if (working[key]) { skipped++; continue; }

    try {
      const extras = await generateDailyExtras(kid, students);
      working = { ...working, [key]: extras };
      onUpdate(working);
      generated++;
    } catch (err) {
      // Swallow per-kid errors so one bad call doesn't block the others.
      // AIConfigError is a no-key situation we already filtered above, but
      // could happen mid-run if a key gets cleared.
      if (err instanceof AIConfigError) return { generated, skipped, errors: errors + (kids.length - generated - skipped) };
      console.warn(`[DailyAgenda] prewarm failed for ${kid.name}:`, err);
      errors++;
    }
  }

  return { generated, skipped, errors };
}

/** Returns the date (YYYY-MM-DD) of the most recent cache entry for any kid, or null. */
export function lastPrewarmDate(cache: AgendaCache): string | null {
  const dates = Object.keys(cache).map(k => k.split('|')[1]).filter(Boolean);
  if (dates.length === 0) return null;
  return dates.sort().pop() ?? null;
}

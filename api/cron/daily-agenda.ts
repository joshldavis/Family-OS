/**
 * Daily Agenda overnight cron — runs at 5am ET (9am UTC) via Vercel Cron.
 *
 * For every family in Supabase, for every child profile, generates today's
 * joke + fact using the shared Gemini API key and upserts the result into
 * the `daily_agendas` table. By the time families wake up, today's agendas
 * are ready and printable in ~1 second.
 *
 * Required env vars (set in Vercel → Project Settings → Environment Variables):
 *   - CRON_SECRET                 random string; Vercel sends it as Authorization
 *   - GEMINI_API_KEY              server-side Gemini key (no VITE_ prefix)
 *   - SUPABASE_URL                same as VITE_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY   service role, NOT the anon key — bypasses RLS
 *
 * Manual trigger for testing:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/daily-agenda
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from '@google/genai';

// Vercel Functions config — give the cron up to 60s to chew through families.
export const config = {
  maxDuration: 60,
};

interface KidRow {
  id: string;
  family_id: string;
  name: string;
}

interface StudentRow {
  family_id: string;
  name: string;
  grade: string | null;
}

interface AgendaInsert {
  family_id: string;
  kid_id: string;
  agenda_date: string;
  joke: string;
  fact: string;
  generated_at: string;
  generated_by: 'cron' | 'client';
}

function todayUTC(): string {
  // The cron fires at 9am UTC = 5am ET; we use UTC date for consistency.
  // Families in different time zones get the right date for "their morning."
  return new Date().toISOString().slice(0, 10);
}

async function generateExtrasForKid(
  ai: GoogleGenAI,
  kidName: string,
  grade: string | null,
): Promise<{ joke: string; fact: string }> {
  const ageHint = grade ?? 'school age';
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      joke: { type: Type.STRING },
      fact: { type: Type.STRING },
    },
    required: ['joke', 'fact'],
  };

  const result = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ parts: [{ text: `Generate today's joke and fun fact for ${kidName}.` }] }],
    config: {
      responseMimeType: 'application/json',
      responseSchema,
      systemInstruction:
        `You write daily one-pager content for children. Audience: a kid in ${ageHint}. ` +
        `Output one short kid-friendly joke and one short "Fun Fact" that's age-appropriate, ` +
        `surprising, and PG. Keep each under 30 words. Be light, warm, and curious.`,
    },
  });

  const parsed = JSON.parse(result.text ?? '{}') as { joke?: string; fact?: string };
  return {
    joke: parsed.joke ?? 'No joke today!',
    fact: parsed.fact ?? '',
  };
}

export default async function handler(req: Request): Promise<Response> {
  // ── Auth ────────────────────────────────────────────────────────────────
  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }

  // ── Env ─────────────────────────────────────────────────────────────────
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Missing required env vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or GEMINI_API_KEY).' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const date = todayUTC();

  // ── Fetch every child profile + matching student grade ─────────────────
  // Profile.role === 'Child' is the source of truth for who needs an agenda.
  const { data: kids, error: kidsErr } = await supabase
    .from('profiles')
    .select('id, family_id, name')
    .eq('role', 'Child');

  if (kidsErr) {
    console.error('[cron/daily-agenda] failed to fetch profiles:', kidsErr);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch profiles', detail: kidsErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!kids || kids.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, message: 'No child profiles found.', date, generated: 0 }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Fetch student grade rows in one shot so we can match by name within family.
  const { data: students } = await supabase
    .from('students')
    .select('family_id, name, grade');

  const gradeFor = (kid: KidRow): string | null => {
    const match = (students as StudentRow[] | null)?.find(s =>
      s.family_id === kid.family_id &&
      s.name.toLowerCase() === kid.name.toLowerCase(),
    );
    return match?.grade ?? null;
  };

  // ── Skip kids who already have today's row (idempotent) ────────────────
  const { data: existing } = await supabase
    .from('daily_agendas')
    .select('family_id, kid_id')
    .eq('agenda_date', date);

  const existingKeys = new Set(
    (existing ?? []).map(r => `${r.family_id}|${r.kid_id}`),
  );

  const todo = (kids as KidRow[]).filter(k => !existingKeys.has(`${k.family_id}|${k.id}`));

  // ── Generate + upsert ───────────────────────────────────────────────────
  let generated = 0;
  let failed = 0;
  const errors: Array<{ kid: string; error: string }> = [];

  for (const kid of todo) {
    try {
      const grade = gradeFor(kid);
      const extras = await generateExtrasForKid(ai, kid.name, grade);
      const row: AgendaInsert = {
        family_id: kid.family_id,
        kid_id: kid.id,
        agenda_date: date,
        joke: extras.joke,
        fact: extras.fact,
        generated_at: new Date().toISOString(),
        generated_by: 'cron',
      };
      const { error: upsertErr } = await supabase
        .from('daily_agendas')
        .upsert(row, { onConflict: 'family_id,kid_id,agenda_date' });
      if (upsertErr) throw upsertErr;
      generated++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ kid: `${kid.name} (${kid.id})`, error: message });
      console.warn(`[cron/daily-agenda] kid ${kid.name} failed:`, message);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      date,
      kidsTotal: kids.length,
      skipped: kids.length - todo.length,
      generated,
      failed,
      errors: errors.slice(0, 20),
    }, null, 2),
    { headers: { 'Content-Type': 'application/json' } },
  );
}

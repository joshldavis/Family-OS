# Daily Agenda Overnight Cron — Setup

This guide gets the overnight Daily Agenda generation working in production.
The cron runs at **5am ET (9am UTC) every day** and pre-generates today's joke +
fun fact for every kid in every family. By the time families wake up, their
agendas are sitting in Supabase ready to print.

## What you need

- A Supabase project (already configured for the rest of the app).
- A Vercel project (already configured — `family-os`).
- A Google Gemini API key reserved for server-side use. **Do not reuse the
  browser-side key** — the cron's key sits in Vercel env vars, while the
  browser keys are user-supplied via the BYOK Settings page.

## Step 1 — Run the SQL migration

Open the Supabase Dashboard → SQL Editor and run the full contents of
`src/lib/schema.sql`. If your schema is already deployed, you only need the
new section near the bottom:

```sql
-- Daily Agendas — server-generated joke + fact per kid per day
create table if not exists daily_agendas ( ... );
-- (plus indexes, RLS policies, and the publications statement)
```

Verify the table exists by running:

```sql
select * from daily_agendas limit 1;
```

You should see an empty result set (no error).

## Step 2 — Set Vercel env vars

In **Vercel → Project Settings → Environment Variables**, add the following
to **Production** (and optionally Preview):

| Name                        | Value                                         |
| --------------------------- | --------------------------------------------- |
| `CRON_SECRET`               | A long random string (e.g. `openssl rand -hex 32`) |
| `GEMINI_API_KEY`            | Your server-side Gemini key (`AIza...`)       |
| `SUPABASE_URL`              | Same value as `VITE_SUPABASE_URL`             |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key |

**Critical:** the service role key bypasses Row-Level Security. Keep it
server-only. Do NOT prefix it with `VITE_` (that would expose it to the
browser bundle).

## Step 3 — Deploy

Push to `main`. Vercel reads `vercel.json` on deploy and automatically
registers the cron at `0 9 * * *` (9am UTC = 5am ET).

You can verify by visiting **Vercel → Project → Crons** in the dashboard.

## Step 4 — Manual test

Before waiting for 5am to roll around, hit the endpoint manually with your
`CRON_SECRET`:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://family-os-brown-five.vercel.app/api/cron/daily-agenda
```

Expected response (JSON):

```json
{
  "ok": true,
  "date": "2026-05-15",
  "kidsTotal": 2,
  "skipped": 0,
  "generated": 2,
  "failed": 0,
  "errors": []
}
```

Now query Supabase to confirm rows landed:

```sql
select kid_id, agenda_date, joke, fact, generated_by, generated_at
from daily_agendas
where agenda_date = current_date;
```

If you visit `/agenda` on the deployed app you'll see the
"Generated overnight — N agendas ready to print" badge in the header,
and each card's joke + fact comes from those rows.

## Cost notes

At ~$0.001 per family per day on Gemini Flash, even 1000 active families
runs you about **$30/month**. The cron skips kids that already have a row
for today, so manual client-side generation earlier in the day doesn't
cause duplicate spend.

If you ever switch the shared model to Sonnet or Opus, expect a 5–10×
cost increase — keep Flash for the cron unless quality complaints come in.

## Failure handling

The endpoint catches per-kid errors so one bad call doesn't kill the whole
run. Failed kids appear in the response's `errors` array and Vercel's
function logs. The next morning's run will retry them automatically (the
idempotent skip only kicks in once a row exists).

If the entire cron fails (API outage, env var missing, etc.), the client
falls back to lazy generation on `/agenda` visit using the user's own BYOK
key. No agenda will be silently broken.

## Disabling the cron

Remove the `crons` array from `vercel.json` and redeploy. The client-side
prewarm + lazy generation continues to work without any code changes.

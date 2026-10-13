# Family OS — Persistence & authorization inventory (source inspection)

Audit source: `main` @ `8125407e` (2026-10-13). This records what the checked-in code says, **not live database state**. No identifiable Family OS project was found in the two Supabase accounts visible for this review; environment and live schema remain unverified.

## Storage map

| Domain | App owner | Browser/localStorage | Supabase DDL/sync | Migration priority |
| --- | --- | --- | --- | --- |
| Family login / profile | `src/App.tsx`, `src/pages/Auth.tsx` | `family_os_profile`, `family_os_v2` | families/profiles; mixed onboarding and auth | **P0: identity + membership** |
| Students | `FamilyContext.tsx` | `family_os_v2` | students | P0: distinguish student from profile person |
| School assignments | `FamilyContext.tsx` | `family_os_v2` | assignments, real-time sync | P1: provenance, owner, event history |
| Chores | `FamilyContext.tsx` | `family_os_v2` | chores, real-time sync | P1: history of individual routine runs |
| Calendar | `FamilyContext.tsx` | `family_os_v2` | events, real-time sync | P1: source + verified date/time |
| Finance | `FamilyContext.tsx` | `family_os_v2` | transactions, budgets, savings_goals | P2: schema mismatch + privacy |
| Recipe/meal plans | `src/App.tsx` | `family_os_recipes`, `family_os_meal_plan` | none in checked-in DDL | P2: preferences and rating links |
| Shopping | `src/App.tsx` | `family_os_shopping` | none in checked-in DDL | P2 |
| Document Vault | `src/App.tsx` | `family_os_documents` | none in checked-in DDL | **P1: source/provenance & consent** |
| Email classification/actions | `src/App.tsx` | `family_os_action_items`, `family_os_behavior_updates`, `family_os_announcements`, `family_os_classified_emails`, `family_os_email_config`, `family_os_last_scan` | none in checked-in DDL | **P1: safe candidate review / dedup** |
| Health/wellness | `src/App.tsx`, module pages | `family_os_medications`, `family_os_appointments`, `family_os_vitals`, `family_os_habits`, `family_os_habit_checkins`, `family_os_health_log` | none in checked-in DDL | P0 privacy controls before any server ingestion |
| Goals/rewards | `src/App.tsx`, module pages | `family_os_active_goals`, `family_os_rewards`, `family_os_reward_txns` | none in checked-in DDL | P3 |
| Family notes | `src/App.tsx` | `family_os_notes` | none in checked-in DDL | P3 |
| AI settings/coach chat | `src/services/ai.ts`, `src/pages/FamilyCoach.tsx` | `family_os_ai_keys`, `family_os_ai_prefs`, `family_os_coach_chat` | none in checked-in DDL | **P0: secret handling/consent** |
| Daily agenda | `src/App.tsx`, `api/cron/daily-agenda.ts` | `family_os_daily_agenda` | daily_agendas | P2 |
| Module toggles | `src/modules/ModuleContext.tsx` | `family_os_module_preferences` | none | P1: operating mode compatibility |

## Security and correctness findings (needs a tested remediation)

1. **Profile creation by untrusted client:** `src/lib/schema.sql` sets `profiles` INSERT policy `WITH CHECK (true)`. The helper `get_my_family_id()` derives household authority from the profile record, so untrusted enrollment can compromise the entire household boundary. Never just add more policies on top: drop/replace the permissive insert and define an authenticated, server-verified invite acceptance flow before enabling new server features.
2. **Family creation by untrusted client:** `families` INSERT policy is `WITH CHECK (true)`; revise alongside secure bootstrap onboarding, not as an isolated RLS edit.
3. **Sign-up path mixes session creation, code lookup and profile assignment:** `Auth.tsx` looks up family by invite code before account creation, signs up, then upserts a parent profile without verifying insert errors. Joining as Parent is currently client-supplied. Move trust to the server; invite must not automatically imply household admin.
4. **Onboarding DB sync lacks verified auth identity:** `src/App.tsx` generates data locally then calls `pushFamilyData` opportunistically. `src/services/supabaseSync.ts` writes profiles without `auth_id`, while other tables require `get_my_family_id()`; error handling does not validate every response.
5. **Hard-coded demo family fallback:** multiple feature pages and `EmailIntelligence.tsx` fall back to `fam-1`. Restrict that to explicit demo/offline mode; never use it as authenticated tenancy fallback.
6. **Invalid date defaults and child identity guesses:** `src/services/emailRouter.ts` substitutes today for missing assignment due date, fabricated 09:00/10:00 event times and selects first student when matching is missing. The new `captureCandidates.ts` is a separate **shadow-only** safe adapter, not yet connected to the legacy route.
7. **DDL/state drift:** checked-in `transactions` lacks the mapper's `source`; `students` lacks the type's `notes`; assignment/chore completion actor/timestamps don't round-trip to DB. Compare with *deployed* schema before any corrective SQL.
8. **AI keys in localStorage and browser calls:** unsuitable for a public multi-household app. Use authenticated server proxy/tool gateway; keep current demo features intact until a compatible migration exists.

## Must-have tests before activating new data paths

- A family A client cannot create `profiles` for family B, or update their own `family_id`.
- Anonymous clients cannot read another family's invite codes or membership lists.
- New family creation and invitation acceptance must use verified auth, with one household membership per identity unless explicitly supported otherwise.
- Child and caregiver permissions must not inherit blanket family-wide access to restricted records.
- Data written in offline/demo mode never becomes a real tenant's data without explicit confirmation and mapping.
- Captured source identifiers are tenant-scoped and idempotent; replay cannot create duplicate effects.
- Events and observations preserve source links; model confidence never authorizes an action.
- Sensitive content and model-provider secrets cannot be leaked through generic logs, browser storage migration, or public API responses.

## Release gate

No new Supabase RLS migration should be applied to an unidentified database. First verify target project, backup, active schema/policies, auth/users, data ownership, integration env vars and current deployment. Then test a coherent bootstrap + invite + RLS transition on an isolated branch/project, and prove that existing households can still sign in before production rollout.

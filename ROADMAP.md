# Family OS — Remaining Build Checklist

## 🧩 New Modules

- [ ] **Wellness Module** — health tracker, daily habits, and family goals
  - Module definition + page scaffold
  - Habit tracking (daily check-ins, streaks)
  - Family goals board (shared targets with progress bars)
  - Health log (exercise, sleep, water — lightweight)

- [ ] **Family Goal Marketplace** — shared family challenges and milestone rewards
  - Goal templates (e.g. "Read 10 books", "Save $500 together")
  - Progress tracking visible to all family members
  - Tie-in to Allowance points on completion

---

## 🔗 Integrations

- [ ] **Gmail Auto-Sync (MCP)** — automated email scanning without pasting
  - Connect Gmail via OAuth / MCP connector
  - Background polling at configurable intervals
  - Auto-populate Calendar, Schoolwork, and Email Intel

- [ ] **Canvas LMS Import** — pull assignments directly from Canvas
  - API key input in Settings
  - Sync assignments to Schoolwork module
  - Due date and course mapping

- [ ] **Google Classroom Direct Sync** — live connection vs. email-paste workaround
  - OAuth flow in Settings
  - Pull assignments, announcements, and grades
  - Map students to Classroom accounts

- [ ] **Real Google Calendar API Sync** — replace current simulation
  - Complete OAuth flow (currently just a toggle)
  - Bidirectional event push/pull
  - Resolve `// Simulate API call` in `Calendar.tsx`

---

## 🔐 Infrastructure

- [ ] **Real Authentication (Supabase)** — replace mock login
  - Set up Supabase project + auth tables
  - Replace `// TODO: replace with real auth` in `Auth.tsx`
  - Per-user data isolation and invite-code family linking

---

## 🐛 Minor Polish

- [ ] Unify AI provider — `FamilyBriefing` uses `VITE_ANTHROPIC_API_KEY` (Claude) while all other AI features use `VITE_API_KEY` (Gemini); pick one or make both configurable in Settings
- [ ] `ai-scan` module is in the registry but has no Settings toggle UI (modal-only is fine, just verify it's intentional)

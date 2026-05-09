# Family OS — Deploy to Vercel

Follow these steps to get a shareable demo link in about 10 minutes.

---

## Step 1 — Get your API keys

You need three keys. All have free tiers.

### 🔑 Gemini API Key (Google AI Studio)
Powers: AI Chat panel, AI Scan (receipts/documents), Insights page, Chore suggestions
1. Go to **https://aistudio.google.com/app/apikey**
2. Click **Create API key**
3. Copy the key → this is your `VITE_API_KEY`

> **Tip:** In AI Studio → API Keys → Edit → Add an HTTP referrer restriction to your Vercel domain (e.g. `your-app.vercel.app/*`) to prevent misuse.

---

### 🔑 Anthropic API Key
Powers: AI Family Briefing on the Dashboard
1. Go to **https://console.anthropic.com/settings/keys**
2. Click **Create Key**
3. Copy the key → this is your `VITE_ANTHROPIC_API_KEY`

> **Tip:** Set a monthly spending limit in Billing → Usage Limits. $5/month is plenty for a family demo.

---

### 🔑 OpenWeatherMap API Key
Powers: Weather widget on the Dashboard
1. Go to **https://home.openweathermap.org/users/sign_up** (free account)
2. After signing up, go to **API Keys** tab
3. Copy the default key → this is your `VITE_OPENWEATHER_KEY`

> **Note:** New keys take up to 2 hours to activate after sign-up.

---

## Step 2 — Deploy to Vercel

### Option A: Via Vercel Dashboard (easiest)
1. Go to **https://vercel.com/new**
2. Click **Import Git Repository** → select `joshldavis/Family-OS`
3. Before clicking Deploy, click **Environment Variables** and add:

| Name | Value |
|------|-------|
| `VITE_API_KEY` | your Gemini key |
| `VITE_ANTHROPIC_API_KEY` | your Anthropic key |
| `VITE_OPENWEATHER_KEY` | your OpenWeatherMap key |

4. Click **Deploy** — done in ~2 minutes.

### Option B: Via Vercel CLI
```bash
cd "/Users/joshdavis/Desktop/Codex - App Development/family-os"

# Set env vars
vercel env add VITE_API_KEY
vercel env add VITE_ANTHROPIC_API_KEY
vercel env add VITE_OPENWEATHER_KEY

# Deploy
vercel --prod
```

---

## Step 3 — Set up a demo account

When your friends/family visit the app, they'll go through **Onboarding** first (takes ~2 min).

For a polished demo, complete onboarding yourself first and walk them through it:
- Add 1–2 children with names and grades
- Enable the modules you want to show
- The app auto-generates realistic seed data for everything

After onboarding, login via **Quick Login** buttons (no password needed in demo/localStorage mode).

---

## What works without Supabase

Everything works in localStorage mode — data is stored in the browser:
- ✅ All 13 modules (Dashboard, Schoolwork, Chores, Calendar, Finance, etc.)
- ✅ All 3 Wellness modules (Wellness, Goal Templates, Family Health) 
- ✅ All AI features (Chat, Scan, Briefing, Insights)
- ✅ Email Intelligence (paste school emails to extract events/assignments)
- ✅ Onboarding and module toggles
- ⚠️ Data doesn't sync between devices (each browser is independent)
- ⚠️ No real user accounts — Quick Login picks the user

Add Supabase later (see `ROADMAP.md`) for real multi-device sync.

---

## Security note

Because this is a client-side React app, API keys are embedded in the JavaScript bundle and visible to anyone who opens browser DevTools. This is fine for a personal family demo but you should:
- Set a **monthly spending cap** on your Anthropic account
- Add **HTTP referrer restrictions** to your Gemini key
- Never use production/work API keys — create dedicated demo keys

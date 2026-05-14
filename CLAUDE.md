# Family OS — Claude Code Instructions

## Auto Git Workflow
After completing any feature, fix, or verified change:
1. Run `npm run build` to confirm clean build
2. Commit all changed files with a descriptive conventional commit message
3. Push to `origin main`

Do this automatically — no need to ask for confirmation before committing and pushing.

## Project
- Stack: React 19 + TypeScript + Vite + Tailwind CSS + HashRouter
- Working branch: `main`
- Remote: `git@github.com:joshldavis/Family-OS.git`

## Strategic Docs
The canonical product and architecture vision lives at `docs/Family-OS-Architecture.pdf` (source: `docs/Family-OS-Architecture.docx`). Read it before proposing significant architectural changes, new modules, or shifts in the AI agent / voice / data model surface area. Update both files when an architectural decision lands that contradicts or extends what's there.

## Conventions
- New modules: add definition in `src/modules/definitions/`, register in `src/modules/registry.ts`, add icon to `src/modules/iconMap.ts`, create page in `src/pages/`, wire into `src/App.tsx`
- localStorage keys: add new keys to the reset list in `handleResetData` in `App.tsx`
- Types: add to `src/types.ts`
- Always verify with preview tools after code changes before committing

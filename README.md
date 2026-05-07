# Dilution Model

Interactive equity dilution modeling tool for founders and early-stage financing scenarios.

## Current features

- Model multiple priced equity rounds from pre-money valuation + investment amount.
- Configure founder share counts and edit founder ownership percentages directly.
- Model employee reserve behavior in two modes:
  - reserve issued upfront and shown on the cap table before grants;
  - reserve as a grant budget where granted shares are issued over time.
- Add per-round employee grants by share count or percent of reserve.
- View ownership by chart, cap table, and founder-value waterfall.
- Save scenarios locally; optional Clerk + Supabase scenario persistence.
- Export assumptions and computed cap-table data to `.xlsx`.

## Tech stack

- React 18
- Vite 5
- Recharts
- Clerk + Supabase, optional
- ExcelJS, lazy-loaded only when exporting
- Vitest + React Testing Library test setup

## Local development

```bash
npm install
npm run dev
```

## Verification commands

```bash
npm test -- --run
npm run build
npm audit --omit=dev
```

## Environment variables

All variables are optional for anonymous/local-only use.

Copy `.env.example` to `.env.local` and fill only the integrations you need.

```bash
cp .env.example .env.local
```

- `VITE_CLERK_PUBLISHABLE_KEY`: enables Clerk auth UI.
- `VITE_SUPABASE_URL`: Supabase project URL for saved scenarios.
- `VITE_SUPABASE_ANON_KEY`: Supabase anon key for saved scenarios.

## Data model notes

The current core model supports priced rounds, employee reserve/grants, and SAFE/convertible instruments. SAFEs convert in the first priced round by default, or in a user-selected priced round when `conversionRoundId` is set.

Core financial logic lives in `src/model/dilutionEngine.js`. UI code should consume this module rather than duplicating formulas in React components.

## Deployment

### Vercel PR previews

This repo includes `vercel.json` for Vercel's GitHub integration. After importing the repo in Vercel and setting `main` as the Production Branch, each pull request gets its own Preview Deployment URL before merge. Merging to `main` creates the production deployment.

See `docs/vercel-pr-previews.md` for the one-time dashboard setup and branch protection recommendations.

### Vercel CLI

```bash
npm install
npm run build
vercel
```

### GitHub + Vercel Dashboard

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Set Production Branch to `main`.
4. Configure optional env vars for Clerk/Supabase.
5. Use PR Preview Deployment URLs for review before merge.
6. Merge to `main` to deploy production.

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

The current core model supports priced rounds and employee reserve/grants. SAFE/convertible instrument support is planned but not yet implemented.

Core financial logic lives in `src/model/dilutionEngine.js`. UI code should consume this module rather than duplicating formulas in React components.

## Deployment

### Vercel CLI

```bash
npm install
npm run build
vercel
```

### GitHub + Vercel Dashboard

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Configure optional env vars for Clerk/Supabase.
4. Deploy.

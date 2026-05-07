# Dilution Model

Interactive equity dilution modeling tool for multiple funding rounds.

## Features

- Model unlimited funding rounds (Seed, Series A/B/C, etc.)
- Add multiple founders with custom share counts
- Auto-compute price per share and new investor equity from pre-money valuation + investment
- Option pool modeling per round
- Three views: stacked area chart, detailed ownership table with delta tracking, and waterfall with implied founder value
- Live re-computation on every input change

## Deploy to Vercel

### PR previews

This repo includes `vercel.json` for Vercel's GitHub integration. After importing the repo in Vercel and setting `main` as the Production Branch, each pull request gets its own Preview Deployment URL before merge. Merging to `main` creates the production deployment.

See `docs/vercel-pr-previews.md` for the one-time dashboard setup and branch protection recommendations.

### Option 1: Vercel CLI
```bash
npm i -g vercel
npm install
npm run build
vercel
```

### Option 2: GitHub + Vercel Dashboard
1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import your repo — Vercel uses `vercel.json` for Vite build settings
4. Set Production Branch to `main`
5. Configure optional env vars for Clerk/Supabase
6. Use PR Preview Deployment URLs for review before merge
7. Merge to `main` to deploy production

## Local Dev
```bash
npm install
npm run dev
```

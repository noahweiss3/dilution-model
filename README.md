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

### Option 1: Vercel CLI
```bash
npm i -g vercel
npm install
vercel
```

### Option 2: GitHub + Vercel Dashboard
1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import your repo — Vercel auto-detects Vite
4. Click Deploy

## Local Dev
```bash
npm install
npm run dev
```

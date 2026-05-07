# AGENTS.md

Guidance for AI coding agents working in this repo.

## Project map

- `src/App.jsx` — React app composition and UI state. Avoid adding more domain math here.
- `src/model/dilutionEngine.js` — pure cap-table/dilution formulas. Add model features here first.
- `src/lib/exportWorkbook.js` — lazy-loaded Excel export code.
- `src/lib/scenarios.js` and `src/lib/supabase.js` — optional Supabase scenario persistence.
- `docs/architecture.md` — architecture overview.
- `docs/model-formulas.md` — formulas and assumptions.

## Required checks

Run these before reporting completion:

```bash
npm test -- --run
npm run build
npm audit --omit=dev
```

If a check fails, either fix it or report exactly why it is blocked.

## Development rules

1. Keep financial formulas in pure modules under `src/model/`.
2. Add or update tests before changing dilution behavior.
3. Do not hardcode API keys, tokens, or secrets.
4. Do not expose shared OpenRouter/provider secrets in `VITE_` variables.
5. Preserve anonymous/local-only mode when changing auth or persistence.
6. Keep Excel/export dependencies lazy-loaded; do not reintroduce heavy top-level imports into `App.jsx`.
7. For SAFE/convertible features, update model tests, UI, export, and docs together.

## SAFE implementation notes

SAFE work should be implemented as a domain-model extension, not as ad hoc UI math.

Recommended sequence:

1. Define a versioned scenario shape that includes `instruments` or `safes`.
2. Add pure conversion helpers and tests for capped, discounted, uncapped, and multiple SAFE cases.
3. Integrate converted SAFE holders into `computeRounds` output.
4. Add UI input components.
5. Update XLSX export and docs.

## AI chatbot notes

Future AI chat should emit validated state actions only. Do not let LLM text mutate React state directly.

Example safe actions:

- `addFounder`
- `updateFounder`
- `addRound`
- `updateRound`
- `addSafe`
- `setEmployeeReserve`

All AI-proposed actions should be previewed and confirmed by the user before application.

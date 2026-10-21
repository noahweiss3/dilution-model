# Architecture

This is a Vite/React client app with optional Clerk authentication and Supabase JSON scenario persistence. Anonymous modeling remains fully local. No database schema or production account data changes are required for the foundation release.

- `src/model/dilutionEngine.js`: pure pricing, conversions, grants, ownership, valuation bridges, chart snapshots, and one validation-aware result.
- `src/model/postMoneySafe.js`: pure simultaneous post-money reference cohort pricing, fractional derived shares, and numeric guards.
- `src/model/safeConventions.js`: supported forms, labels, convention versions, and reference-term constraints.
- `src/model/identities.js`: persistent entity/holder identities, reserved employee identities, and label metadata.
- `src/model/validation.js`: domain and shape validation used by calculations, autosave, cloud save callbacks, and export.
- `src/model/scenarioSchema.js`: scenario/calculation versioning, legacy identity assignment, and input-preserving migration.
- `src/model/founderAllocation.js`: exact whole-share allocation for split, scale, and equalization.
- `src/model/examples.js`: explicitly illustrative starting values/templates.
- `src/App.jsx`: composition, edits, local status, optional saved-scenario controls, validation feedback, keyboard ordering, and export trigger.
- `src/components/ModelFields.jsx`: labeled text/number controls, editable precision, errors, and pressed-state mode controls.
- `src/components/ModelResults.jsx`: founder outcomes, discrete stacked ownership columns, numeric cap table, financing values, and inspectable bridges. Financial calculations stay in the engine.
- `src/lib/localDraft.js`: recoverable local migration, valid-only autosave, and JSON recovery download.
- `src/model/comparisonWorkspace.js`: case identities, duplicate/pin/reset/remove actions, engine-derived comparison outcomes, and stable-identity assumption diffs. It adds no dilution formulas.
- `src/components/ScenarioComparison.jsx`: anonymous case controls, baseline/alternative outcome tables, input differences, and explicit model-version explanations.
- `src/lib/comparisonStorage.js`: versioned, valid-only comparison persistence in `dilution-model:comparison`. The whole workspace is one authoritative local-storage value; `dilution-model:current` remains a best-effort active-case mirror for the single-draft release.
- `src/lib/exportWorkbook.js`: validation-aware snapshot export; ExcelJS stays lazy-loaded behind the export action.
- `src/lib/scenarios.js`, `src/lib/supabase.js`, `AuthBar`, `ScenariosMenu`: optional existing authenticated storage. The new schema remains JSON data; no new account permissions are needed.

See [model-formulas.md](model-formulas.md) for the precise supported convention and exclusions, and [foundation-acceptance.md](foundation-acceptance.md) for the release walkthrough.

Comparison workspace version 1 now wraps scenario schema v3 with a per-case convention and calculation version. Legacy cases retain `pre-conversion-v2`; explicitly adopted post-money reference cases use `yc-post-money-v1`. An existing single draft seeds the first baseline. Future, malformed, or migrated workspace data is retained as exact original JSON under a recovery key before replacement. Recovery failure prevents replacement. Invalid inputs and editor-only invalid founder-percent drafts block workspace autosave and export; the last valid workspace remains available on reload. Case switching is blocked until those edits are corrected, explicitly discarded, or reset. Reset/removal/pinning/cloud load can be undone until another edit; undo is intentionally in-memory and is not restored after reload.

Each local case remounts the existing cloud-save menu so a copied alternative cannot silently retain the baseline's cloud record ID. Cloud saves still contain a single active scenario; comparison sets are not synced. A delayed cloud load is ignored after switching away; a load into the active case has an undo checkpoint. Real signed-in behavior still requires an allowed test session. See [comparison-acceptance.md](comparison-acceptance.md).

## Checks

```sh
npm ci
npm test -- --run
npm run build
npm audit --omit=dev
```

CI runs the regression suite, production build, and production dependency audit. Browser checks are required before claiming mobile, chart rendering, download, or keyboard flows verified. Actual authenticated save/load and protected preview access receive separate smoke tests; anonymous tests are not evidence of backend correctness.

## Dependency fixes

Compatible transitive patches update `ws`, `tmp`, and both `brace-expansion` versions. Scoped overrides select patched `js-cookie` for Clerk shared and `uuid` 11 for ExcelJS. ExcelJS only uses the compatible `v4` API; its Node workbook round-trip and browser XLSX download are regression checked. These overrides avoid the audit's proposed ExcelJS downgrade. No shared credentials are embedded or changed.

SAFE convention architecture and reference fixtures: [safe-conventions-design.md](safe-conventions-design.md). Option-pool top-ups are intentionally a separate subsequent feature.

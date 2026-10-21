# Architecture

This is a Vite/React client app with optional Clerk authentication and Supabase JSON scenario persistence. Anonymous modeling remains fully local. No database schema or production account data changes are required for the foundation release.

- `src/model/dilutionEngine.js`: pure pricing, conversions, grants, ownership, valuation bridges, chart snapshots, and one validation-aware result.
- `src/model/identities.js`: persistent entity/holder identities, reserved employee identities, and label metadata.
- `src/model/validation.js`: domain and shape validation used by calculations, autosave, cloud save callbacks, and export.
- `src/model/scenarioSchema.js`: scenario/calculation versioning, legacy identity assignment, and input-preserving migration.
- `src/model/founderAllocation.js`: exact whole-share allocation for split, scale, and equalization.
- `src/model/examples.js`: explicitly illustrative starting values/templates.
- `src/App.jsx`: composition, edits, local status, optional saved-scenario controls, validation feedback, keyboard ordering, and export trigger.
- `src/components/ModelFields.jsx`: labeled text/number controls, editable precision, errors, and pressed-state mode controls.
- `src/components/ModelResults.jsx`: founder outcomes, discrete stacked ownership columns, numeric cap table, financing values, and inspectable bridges. Financial calculations stay in the engine.
- `src/lib/localDraft.js`: recoverable local migration, valid-only autosave, and JSON recovery download.
- `src/lib/exportWorkbook.js`: validation-aware snapshot export; ExcelJS stays lazy-loaded behind the export action.
- `src/lib/scenarios.js`, `src/lib/supabase.js`, `AuthBar`, `ScenariosMenu`: optional existing authenticated storage. The new schema remains JSON data; no new account permissions are needed.

See [model-formulas.md](model-formulas.md) for the precise supported convention and exclusions, and [foundation-acceptance.md](foundation-acceptance.md) for the release walkthrough.

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

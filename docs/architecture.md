# Architecture

## High-level structure

```text
src/
  App.jsx                    # UI composition, app state, derived chart/table data
  main.jsx                   # Clerk provider bootstrap and app mount
  index.css                  # global tokens/styles
  components/
    AuthBar.jsx              # auth display/sign-out controls
    Modal.jsx                # reusable modal primitives
    ScenariosMenu.jsx        # saved scenario UI backed by Supabase when configured
  lib/
    scenarios.js             # Supabase CRUD for scenarios
    supabase.js              # Supabase client factory with Clerk token injection
    exportWorkbook.js        # lazy-loaded ExcelJS workbook export
  model/
    dilutionEngine.js        # pure dilution/cap-table math
    dilutionEngine.test.js   # model regression tests + golden snapshots
```

## Runtime modes

The app works without backend env vars:

- no Clerk/Supabase configured: anonymous mode with localStorage autosave only;
- Clerk + Supabase configured: authenticated users can save/load named scenarios.

`main.jsx` checks `VITE_CLERK_PUBLISHABLE_KEY`. `ScenariosMenu` also checks Supabase configuration before rendering persistence controls.

## State flow

`App.jsx` owns the scenario state:

- `founders`
- `employeeReserve`
- `employeesOnCapTablePreGrant`
- `rounds`
- `instruments` (SAFE/convertible inputs)
- UI-only state such as active tab and chart mode

Derived cap-table states are computed with:

```js
computeRounds(founders, rounds, employeeReserve, employeesOnCapTablePreGrant, instruments)
```

The scenario state is autosaved to localStorage under `dilution-model:current`. Saved scenarios store the same serializable shape in Supabase `scenarios.data`.

## Domain boundary

Financial formulas belong in `src/model/dilutionEngine.js`, not inside React components. This keeps the model testable and prepares the app for SAFE/convertible instruments and AI-generated state actions.

When adding new model features:

1. Add/extend pure domain functions first.
2. Add tests for formulas and edge cases.
3. Update UI components to call the model.
4. Update exports/docs last.

## Export architecture

Spreadsheet export is intentionally dynamic:

```js
const { exportWorkbook } = await import('./lib/exportWorkbook.js')
```

This keeps ExcelJS out of the initial app bundle. `exportWorkbook.js` builds four sheets:

1. Assumptions
2. Cap Table
3. Chart Data
4. Waterfall

## Known architecture pressure points

- `App.jsx` still contains too much UI and should be split into panels/components.
- Scenario state is versioned and schema-validated; future migrations should extend `src/model/scenarioSchema.js`.
- Supabase schema/RLS migrations are not yet in repo.
- SAFE/convertible MVP currently converts all SAFEs in the first priced round; later instrument variants need richer conversion timing/mechanics.

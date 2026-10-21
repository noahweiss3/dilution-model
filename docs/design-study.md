# Dilution Model visual design study

This is an isolated prototype branch from production commit `bd1c7c86c8030277fa9a4b4b993e3c10af039d69`. It opens a comparison directory at `/`, with the original model isolated at `/model`. It is intended for a Vercel Preview, not a production merge. Production calculation, auth, persistence, and export modules are unchanged.

## Explore

- `/?concept=review`: Financial Review — white financial statement, upright Source Serif 4 + Source Sans 3, burgundy ownership emphasis, thin rules, sentence-led results and paired allocation bars.
- `/?concept=workbench`: Analyst Workbench — persistent assumption rail, compact IBM Plex Sans + Mono, green-gray workspace, dense aligned cap table, switchable financing-path view.
- `/?concept=studio`: Scenario Studio — fixed baseline beside an editable proposal, Manrope + selective mono, copper action color, changed-cell highlighting and signed percentage-point deltas.
- `/?concept=terminal`: Capital Terminal — charcoal instrument panel, amber figures, Plex Sans + Mono, full-width ownership trajectory and switchable capitalization/value-waterfall panels.
- `/?compare=review,terminal`: two live, independent responsive previews. Any two valid direction IDs work.

Each direction includes a working System & components view: type and color specimens, controls, disabled/hover/focus states, status and warning notices, a validation specimen, live inputs, tables, and charts. Favorite selection remains in this browser tab using sessionStorage; there is no backend or account requirement. All buttons, tabs, and badges have 0–4px corners. No gradients or italic type are used.

## Example fixture and boundaries

All four directions use the same independent, explicitly illustrative example in `src/model/prototypeExample.js`, with tests:

- Maya Chen: 5.4M original shares; Alex Rivera: 3.6M; employee reserve: 1M issued upfront.
- $1M post-money SAFE assumed to convert to 10% immediately before the Seed. This deliberately simplified fixture does not reproduce the production SAFE engine.
- Base Seed: $4M at $16M pre-money. Capital-efficient preset: $3M at $18M pre-money.
- Optional Series A: $10M at $40M pre-money, diluting all prior holders by 20%.
- Base founder ownership: 64.80% after Seed / 51.84% after Series A. Illustrative founder paper value: $12.96M / $25.92M.
- Ownership always reconciles to 100%; paper value is ownership × post-money valuation. The waterfall bridges paper-value changes, including the simplified SAFE step.
- No interest, discount, reserve top-up, liquidation preferences, or exit proceeds are modeled. Charts label illustrative results directly and provide mobile HTML values.

Inputs require a raise >0 and ≤$100M and valuation >0 and ≤$500M. Results update only when applied. Invalid input retains the last applied results. Switching between app and specimens retains the draft; scenario selection and Reset load known fixtures. Tables are semantic and keyboard-scrollable, with a visible mobile scroll cue.

## Research and original adaptations

Research was completed before authoring, including the user's requested [Impeccable](https://impeccable.style/) and its [slop catalog](https://impeccable.style/slop/). The study uses task-led hierarchy, visible labels, restrained geometry, direct chart labels, and intentionally different information structures.

- [Carbon data-table guidance](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines): aligned numeric columns, consistent row density, contextual controls and progressive disclosure. Adapted for Workbench and Terminal.
- [USWDS typography](https://designsystem.digital.gov/components/typography/) and [GOV.UK Design System](https://design-system.service.gov.uk/): readable information, explicit field labels, meaningful units and validation. Adapted for Financial Review.
- [Primer progressive disclosure](https://primer.style/product/ui-patterns/progressive-disclosure/): keep context visible while revealing detail. Adapted for Studio's baseline/proposal composition.
- [Adobe Spectrum](https://spectrum.adobe.com/): connected foundations and interactive component specimens; adapted for the dark instrument system.
- [Atlassian typography](https://atlassian.design/foundations/typography): legibility, hierarchy, and coordinated space/type decisions; applied throughout.

These are original visual explorations informed by those principles, not official themes, endorsements, or installed design-system libraries. No brand artwork or proprietary typefaces were copied.

## Font licenses

Five unmodified font files are self-hosted under `public/fonts`, obtained from the Google Fonts open-source repository. SIL Open Font License 1.1 notices are bundled alongside each file. `public/fonts/provenance.json` records source URLs and SHA-256 checksums. No paid assets, font API requests, or third-party services are required by the prototypes. The original `/model` retains its original Google Fonts stylesheet.

## Verification

Required: `npm test -- --run`, `npm run build`, `npm audit --omit=dev`.

Scoped JavaScript type check (the original repo has no TypeScript configuration):

```sh
npm exec --package typescript -- tsc --allowJs --checkJs --noEmit --jsx react-jsx --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --strict false --noUncheckedSideEffectImports false src/prototypes/PrototypeApp.jsx src/model/prototypeExample.js
```

Browser verification scripts use Python Playwright with Chromium. `scripts/verify-prototypes.py` checks editable example flow, preset and stage switching, validation, reset, explanations, favorite navigation, component feedback, keyboard focus, independent comparison frames, overflow at 320/390/768/1024/1440px, and axe WCAG A/AA checks at 390/1440px. `scripts/capture-prototypes.py` captures full-page desktop/mobile screenshots of every app and specimen page, the directory and comparison interface. Install axe-core in `/tmp/dilution-qa-tools` to run the verification script. `PROTOTYPE_URL` and optional `PROTOTYPE_ACCESS_URL` allow protected preview verification without changing deployment protection. Access links must never be committed.

An independent visual reviewer assessed all four directions at 320/560/800/1024/1440px and exercised inputs, scenario/stage changes, validation, reset, favorites, specimens, and focus. Its mobile chart feedback was addressed in the shared chart component. No remaining visual blocker was found.

The required production-dependency audit reports seven inherited issues (2 moderate, 5 high) in the unchanged base lockfile: brace-expansion, js-cookie/@clerk/shared, tmp, uuid/exceljs, and ws. Dependency changes belong to the separate functional/security work; this design branch introduces no dependencies and does not alter the lockfile.

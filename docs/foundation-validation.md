# Foundation validation — 21 October 2026

Base: `bd1c7c86c8030277fa9a4b4b993e3c10af039d69`. Scope: the first functional foundation release. Scenario comparison, contractual SAFE variants, negotiated pool targets, exit payouts, and broad visual redesign remain later work.

- Existing baseline: 36 tests and production build passed before changes.
- Final unit/React suite: **62 tests across 8 files passed**. Includes independent priced-round fixtures, mixed financial invariants, duplicate display names and IDs, invalid/nonfinite/overflow inputs, zero-cash SAFE timing, orphaned conversion references, exact whole-share allocation, grant resolution, canonical workbook output, recovery failures, field display synchronization, keyboard controls, and dialog focus.
- Chromium: **6 Playwright tests passed** against the built app, including edit/reload, chart/table parity, SAFE reassignment, overgrant disclosure, workbook download, keyboard movement, and 320/390/768/1440px layouts.
- Targeted axe-core 4.10.3 scan: no detected WCAG A/AA violations in the checked anonymous default views at those four widths. This is not full accessibility certification or authenticated-modal verification.
- Production build: passed. ExcelJS remains lazy-loaded; the build still notes the existing large export chunk and tooling deprecation warnings.
- Production dependency audit: **0 advisories** after compatible transitive patches and scoped overrides documented in architecture.md.
- The first remote PR run exposed missing Vitest/Vite development-peer esbuild lock entries under npm 10.8.2. Reproduced and repaired the lockfile, with no existing dependency versions changed; CI now uses Node 24 to match local/Vercel. Fresh npm-10 clean installation, 62 tests, build, six Chromium checks, and production audit passed after the repair. Independent review confirmed the additions are optional development peers only.
- Independent reviewer: confirmed the core financial fixture, workbook parity, invalid export rejection, and all four widths. Caught invalid-draft display synchronization and cloud-migration recovery gaps; both corrected. Round stage namespace and mode/unit validation were also corrected. No unresolved core financial issue was identified in that review.

The supported SAFE convention remains explicitly simplified pre-conversion pricing. Capitalization at round price is distinguished from quoted pre-money plus cash; neither is presented as an exit payout. Migration preserves raw original data before replacement and discloses recalculation. Authenticated save/load and actual deployed-preview behavior require their own smoke checks; anonymous local validation is not evidence of backend correctness.

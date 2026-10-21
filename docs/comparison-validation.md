# Comparison validation — 21 October 2026

This feature is stacked on the foundation PR. Workspace version 1 wraps unchanged scenario schema v2 / calculation `pre-conversion-v2`. No financial engine formulas or contract assumptions were changed.

- **80 unit/React tests passed** across 12 files. New regressions cover independent duplication, exact approved raise example, zero differences, stable-ID assumption matching, pin/reset/remove, invalid-case deltas, naming/capacity, last-valid persistence, malformed/future data recovery, backup/storage failures, undo of invalid founder-percentage drafts, and delayed mocked cloud-load isolation.
- **12 Chromium regressions passed** against the production build: six foundation checks and six comparison checks. Includes $2M versus $3M cash, reload, case switching, reset/removal/baseline undo, invalid-edit restoration, four cases with long names, keyboard selection, and 320/390/768/1440px layouts.
- Additional axe scans of the anonymous two-case comparison at all four widths: **zero detected violations**, no browser errors, and document width equal to viewport width. Independent reviewer also checked the four-case 320px view with no detected violations. These checks are not full accessibility certification.
- Production build passed, Excel remains lazy-loaded, and production dependency audit reports **zero advisories**. Existing large-bundle/tooling warnings remain.
- Independent review found an invalid-percent undo display mismatch. Corrected by retaining the editor-only draft text with its error and restoring both together. Reviewer then verified reset/removal undo, focus, discard, all 80 tests, and approved with no remaining blocker.

Local comparison is not cloud workspace synchronization. Cloud Save and XLSX use one active case. Authenticated CRUD remains untested without an allowed test session; a mocked lifecycle test is not evidence of backend correctness. Direct protected-preview browser access in this container has failed with `ERR_TUNNEL_CONNECTION_FAILED`; authenticated Vercel HTTP fetch and deployment READY status are reported separately from browser validation.

The foundation PR's first remote CI run exposed an npm-10 lockfile compatibility gap. The prerequisite repair adds missing dev-peer esbuild lock entries and aligns CI with Node 24, matching the local/Vercel environment. npm-10 clean installation passed on the prerequisite. After carrying that fix into this branch, a fresh npm-11 clean install, all 80 tests, build, 12 Chromium checks, and production audit passed again.

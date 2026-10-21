# Foundation release acceptance walkthrough

Use hypothetical inputs in a fresh anonymous browser context. Do not replace real saved scenarios while running these checks.

1. **Simple priced rounds:** set founder split to 60/40; no grants or SAFEs; round 1 $8M pre/$2M cash, round 2 $16M pre/$4M cash. Cap table shows founders 48/32 after round 1, then 38.4/25.6; investors 16/20 at the last stage; totals 100%.
2. **Identity:** rename both founders and both rounds to the same label. Both founders and both investor holdings remain distinct; share counts and ownership totals remain unchanged. Reload preserves their separate IDs.
3. **Invalid inputs:** try negative founder shares, zero valuation with positive cash, a discount of 100%, or an empty required name. Field-linked errors appear; normal results, local/cloud saves, and export are blocked. Fixing input restores results. Invalid edits do not replace the last valid anonymous draft.
4. **External correction:** enter invalid founder shares, blur, then Equalize shares. Displayed values, saved inputs, and enabled export agree. Repeat with an invalid founder percentage followed by a valid split.
5. **SAFE reference:** add a SAFE, assign it to round 2, then remove round 2. The selector explicitly says the round is missing and results/export are blocked. Choose the first positive-investment round; conversion returns. Reordering/renaming rounds preserves references by ID.
6. **Disclosed SAFE denominator:** one founder with 10M shares, no pool/grants, $20M pricing pre-money/$5M new cash, $1M SAFE capped at $10M. Price $2, SAFE 1M shares, investor 2.5M shares, ending 13.5M. Quoted pre+cash $25M; capitalization at round price $27M. The bridge explains the $2M SAFE marked value. This is not a YC post-money SAFE.
7. **Grant/export parity:** reserve budget 2.5M, request 3M shares. The interface and workbook state 3M requested, 2.5M applied, 0.5M unfulfilled. With a later request, only the remaining reserve can be applied. Test upfront reserve mode separately; grants transfer without issuing new shares.
8. **Precision:** enter 8.55 in $M pre-money and 2.125 in $M investment; blur, toggle dollar units, reload, and export. The raw values stay $8,550,000 and $2,125,000 and remain inspectable.
9. **Charts/labels:** default final column visibly contains the 25% Series A holder; every percent column totals 100%. Compare with the numeric table, including zero ownership before issuance. Financing values has dollar labels and explicitly excludes an exit waterfall.
10. **Mobile/keyboard:** complete edit → add funding → inspect results → export at 320, 390, 768, and 1440px. Use visible mobile links to jump between inputs/results. The body does not scroll horizontally; wide tables scroll within their labeled region. Use Tab/Enter for all controls and named move-up/down buttons. Escape closes Scale and restores focus. Mode controls expose selected state; every input has a distinct label and errors are associated.
11. **Recovery:** load a legacy local draft, check the migration notice and original JSON download, and verify a `dilution-model:recovery:` copy exists before the new draft is written. A storage failure must preserve the previous draft. Cloud payload migration must retain a source recovery copy too; use a dedicated hypothetical test account for cloud writes.
12. **Production parity:** verify the exact draft-PR commit's protected Vercel preview. Test anonymous behavior there; verify authenticated save/load separately before claiming it. Keep deployment protection enabled and do not promote to production.

Expected automated checks cover independently calculated priced-round fixtures, deterministic mixed cases, duplicate names/IDs, nonfinite/overflow input, zero-cash conversion timing, orphaned references, exact allocations, grant budget resolution, workbook parity, migration failure recovery, and React user flows.

## Automated browser checks

After `npm ci`, install Chromium once with `npx playwright install chromium`, then run:

```sh
npm test -- --run
npm run build
npm run test:ui
npm audit --omit=dev
```

`test:ui` serves the built `dist` directory on a loopback preview server. In a container with system Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. `DILUTION_BASE_URL` can select an already-running test deployment; protected previews require the official authenticated access path. Browser tests use fresh anonymous contexts and hypothetical inputs. They do not exercise authenticated storage.

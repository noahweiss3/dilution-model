# Supported calculation convention

The foundation release uses `pre-conversion-v2`, a deliberately simplified educational model. It does **not** implement a contractual pre-money SAFE, YC post-money SAFE, convertible note, liquidation preference, MFN, pro-rata right, negotiated pool top-up, or exit payout. Instrument-depth features require separate fixtures and review.

## Identity and inputs

Scenario schema v2 gives founders, rounds, and SAFEs persistent IDs. Editable names are labels, including duplicate names. Ownership and whole shares are keyed by namespaced IDs (`founder:…`, `round:…`, `safe:…`, `employee:reserve`, `employee:granted`), never display names. Stage IDs also namespace rounds separately from the initial `pre-funding` stage.

Inputs must be finite and within JavaScript's safe numeric range. Shares and reserve counts must be nonnegative safe integers; founder capitalization must be positive. Round pre-money valuation must be positive. Cash investment may be zero: this represents a no-new-cash event, and does not trigger SAFE conversion. Negative amounts, invalid discounts, broken references, duplicate IDs, unsupported types, and unrepresentable computed quantities block calculation, saving, and export.

A selected SAFE conversion round must exist and have positive new investment. Deleting its round retains an explicitly unresolved reference until the user selects a replacement; the UI never presents a false fallback selection. An unspecified SAFE waits for the first positive-investment round. An unconverted SAFE is not counted as equity and is disclosed in model notices.

## Reserve and grant timing

With reserve included before financing, initial total shares are founders plus the full unallocated reserve. Grants transfer shares from reserve to granted employees and do not create new shares.

With reserve excluded, the reserve is only a grant budget. Grants create new shares **after financing shares have been priced**, diluting existing holders and that round's investor. A grant percentage is a percentage of the original reserve, not company equity or remaining reserve. This is not a negotiated pre-money pool top-up.

For each round:

```text
requestedGrantShares = round(grantValue)                  # shares mode
requestedGrantShares = round(grantValue / 100 × reserve)  # percent mode
available = reserve - grantedInEarlierRounds
applied = min(requestedGrantShares, available)
unfulfilled = requestedGrantShares - applied
```

An overgrant remains visible as requested versus applied, with a notice. Every workbook field uses this same resolved result. Reserve percentages outside 0–100 are rejected.

## Simplified SAFE and round pricing

The chosen denominator is the total shares outstanding before the current round's conversions and newly issued grants. It includes prior converted instruments and any upfront reserve.

```text
pricingShares = previousStage.totalShares
roundPrice = pricingPreMoney / pricingShares
capPrice = valuationCap / pricingShares       # positive cap only
 discountedPrice = roundPrice × (1 - discountPct / 100)
conversionPrice = minimum applicable price
SAFE shares = round(SAFE investment / conversionPrice)
new investor shares = round(new financing cash / roundPrice)
```

This convention excludes current conversions/new grants from the pricing denominator. SAFEs in the same round use that same pre-conversion denominator. It must not be interpreted as a YC post-money SAFE calculation. Conversion output records all candidate prices and the selected rule. Previously converted shares persist by identity through later rounds.

## Reconciled share and valuation bridges

```text
endingShares = pricingShares + SAFE shares + new investor shares + newly issued grant shares
ownership = holder's actual whole shares / endingShares
quotedPostMoney = pricingPreMoney + new financing cash
conversionMarkedValue = SAFE shares × roundPrice
newGrantMarkedValue = newly issued grant shares × roundPrice
roundingAdjustment = new investor shares × roundPrice - new financing cash
capitalizationAtRoundPrice = roundPrice × endingShares
```

The internal `postMoney` result now means **capitalization at the round price**, and the UI/export use that exact label. `quotedPostMoney` remains the separate quoted pre-money-plus-cash figure. The capitalization bridge is quoted post-money + conversion marked value + new grant marked value + investor share-rounding adjustment. Conversion and grant marked values are **not additional cash raised**. Paper values exclude preferences, taxes, voting rights, and exit distribution rules.

Share counts are rounded once at issuance to the nearest whole share. Their monetary adjustment can be at most half a round-price share per new investor issuance. Ownership sums and whole-share totals reconcile at every stage. Founder split/scale/equalize controls use largest-remainder allocation to preserve exact whole-share totals without negative residual shares.

## Migration and persistence

Legacy and unversioned scenarios gain stable IDs without merging equal names or changing monetary inputs. Ambiguous duplicate IDs remain validation errors rather than being redirected silently. Current validation errors are retained for correction, not filtered into a different apparently valid scenario.

Before migrated/malformed/future-version source data is overwritten by anonymous autosave, its exact original JSON is saved under `dilution-model:recovery:<id>`. The migration notice offers a download. The same recovery path is used when a legacy/malformed cloud payload is loaded; the backend scenario is only replaced by the user's explicit Save action. If backup storage fails, migration autosave is blocked. Invalid edits leave the last valid local draft intact and show that they are not saved. Schema and calculation version accompany saves and exports.

The workbook is a snapshot, not an editable formula workbook. It recomputes and validates the exact inputs using the same engine, ignoring stale caller-supplied outputs. Sheets: Assumptions, Cap Table, Chart Data, Financing Values, and Round Bridge. Chart Data includes explicit zeros for holder histories, and both holder/stage identities are exported.

# Supported calculation convention

Each scenario explicitly chooses a calculation convention. **Legacy simplified pre-conversion** retains `pre-conversion-v2` and the foundation’s exact economics. **Post-money SAFE reference (YC guide)** uses `yc-post-money-v1` for the narrow equity-financing subset described below. Missing conventions retain legacy pricing. No convention implements notes, liquidation preferences, MFN, pro-rata participation, negotiated pool top-ups, or exit payouts.

## Identity and inputs

Scenario schema v3 preserves the persistent founder, round, and SAFE IDs introduced in v2 and adds explicit convention and form metadata. Editable names are labels, including duplicate names. Ownership and share balances are keyed by namespaced IDs (`founder:…`, `round:…`, `safe:…`, `employee:reserve`, `employee:granted`), never display names. Stage IDs also namespace rounds separately from the initial `pre-funding` stage.

Inputs must be finite and within JavaScript's safe numeric range. Shares and reserve counts must be nonnegative safe integers; founder capitalization must be positive. Round pre-money valuation must be positive. Cash investment may be zero: this represents a no-new-cash event, and does not trigger SAFE conversion. Negative amounts, invalid discounts, broken references, duplicate IDs, unsupported types, and unrepresentable computed quantities block calculation, saving, and export.

A selected SAFE conversion round must exist and have positive new investment. Deleting its round retains an explicitly unresolved reference until the user selects a replacement; the UI never presents a false fallback selection. An unspecified SAFE waits for the first positive-investment round. In post-money reference mode, all listed SAFEs are assumed outstanding before that first financing; an explicit later target is unsupported and blocks results. An unconverted SAFE is not counted as equity and is disclosed in model notices.

## Reserve and grant timing

With reserve included before financing, initial total shares are founders plus the full unallocated reserve. Grants transfer shares from reserve to granted employees and do not create new shares.

In legacy mode with reserve excluded, the reserve is only a grant budget. Grants create new shares **after financing shares have been priced**, diluting existing holders and that round's investor. A grant percentage is a percentage of the original reserve, not company equity or remaining reserve. This is not a negotiated pre-money pool top-up.

Post-money reference mode requires a nonzero existing reserve to be included before financing; grants transfer that reserve. No financing pool increase is supported. For each round:

```text
requestedGrantShares = round(grantValue)                  # shares mode
requestedGrantShares = round(grantValue / 100 × reserve)  # percent mode
available = reserve - grantedInEarlierRounds
applied = min(requestedGrantShares, available)
unfulfilled = requestedGrantShares - applied
```

An overgrant remains visible as requested versus applied, with a notice. Every workbook field uses this same resolved result. Reserve percentages outside 0–100 are rejected.

## Legacy simplified SAFE and round pricing

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

## Legacy share and valuation bridges

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

In legacy mode, share counts are rounded once at issuance to the nearest whole share. Their monetary adjustment can be at most half a round-price share per new investor issuance. Ownership sums and whole-share totals reconcile at every stage. Founder split/scale/equalize controls use largest-remainder allocation to preserve exact whole-share totals without negative residual shares.

## Post-money SAFE reference pricing

This is an equity-financing reference model based on the [official YC SAFE page](https://www.ycombinator.com/safe) and its [User Guide](https://bookface-static.ycombinator.com/assets/ycdc/SAFE%20User%20Guide-a47c6588327d73aa2799e61ed7c2cae9f1a0ee9acfa9c43b62039dc06e715832.pdf). Cap-only and discount-only are separate US reference forms. A combined cap + discount form is explicitly **custom/historical**, not a current YC standard form. It models ownership at financing, not the complete contract.

Let B be existing fully diluted shares, V financing pre-money **including all SAFE conversions**, A each purchase amount, C its post-money cap, and d its discount off the financing price. Cap-only weight is A/min(C,V); discount-only weight is A/((1-d)V); custom combined weight is A/min(C,(1-d)V). Let W be the sum of those weights. W must be below 1. Company capitalization D=B/(1-W); financing price P=V/D; SAFE reference shares=wD; new investor reference shares=new cash/P. This joint solution is independent of instrument order. It uses each investor’s most favorable applicable price, including round-price fallback; the custom cap/discount crossover is V=C/(1-d).

D includes the existing pool and all current conversions, and excludes new cash. All listed SAFEs convert at the first positive-cash financing. Later issuance timing, mixed legacy/pre-money instruments, modified capitalization definitions, separate promised-option adjustments, and financing pool increases are unsupported and block normal results. Legacy target-round behavior remains available only under its explicit legacy convention.

Calculated SAFE and new-investor shares retain theoretical fractions throughout later rounds. UI and workbook share formats display up to six decimals; underlying calculations retain precision. Actual issuance rounding is unsupported. Whole founder/reserve/grant inputs remain required. Grants transfer existing reserve without issuing new shares. The share bridge starts with B, while the pricing denominator is D; these must not be confused. Conversion marked value is already included in V. With no pool increase, capitalization at the financing price equals V+new cash within floating-point precision; it does not add conversion value a second time.

Independent source-backed reference fixtures, scope decisions, and the exact-form retrieval limitation are documented in [safe-conventions-design.md](safe-conventions-design.md).

## Migration and persistence

Legacy and unversioned scenarios gain stable IDs without merging equal names or changing monetary inputs. Ambiguous duplicate IDs remain validation errors rather than being redirected silently. Current validation errors are retained for correction, not filtered into a different apparently valid scenario.

Before migrated/malformed/future-version source data is overwritten by anonymous autosave, its exact original JSON is saved under `dilution-model:recovery:<id>`. The migration notice offers a download. The same recovery path is used when a legacy/malformed cloud payload is loaded; the backend scenario is only replaced by the user's explicit Save action. If backup storage fails, migration autosave is blocked. Invalid edits leave the last valid local draft intact and show that they are not saved. Schema, explicit convention/form, and the actual calculation version accompany saves and exports. Known schema-v2 legacy inputs keep every economic result unchanged during migration. Unknown convention, form, or calculation-version tags remain unsupported; they are not silently coerced to legacy.

The workbook is a snapshot, not an editable formula workbook. It recomputes and validates the exact inputs using the same engine, ignoring stale caller-supplied outputs. Sheets: Assumptions, Cap Table, Chart Data, Financing Values, and Round Bridge. Chart Data includes explicit zeros for holder histories, and both holder/stage identities are exported.

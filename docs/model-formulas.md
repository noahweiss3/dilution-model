# Model formulas

This document describes the current priced-round dilution model. It is not legal, tax, or investment advice.

## Inputs

### Founders

Each founder has:

- `name`
- `shares`

Total founder shares:

```text
founderTotal = sum(founder.shares)
```

### Employee reserve

`employeeReserve` is a share-denominated budget/cap.

The model supports two reserve modes.

#### Reserve issued upfront

When `employeesOnCapTablePreGrant = true`:

```text
preFundTotal = founderTotal + employeeReserve
```

The full unallocated reserve is on the cap table before financing. Later grants transfer shares from `Employee Reserve (Unallocated)` to `Employees (Granted)` and do not create new shares.

#### Grants issued over time

When `employeesOnCapTablePreGrant = false`:

```text
preFundTotal = founderTotal
```

The reserve is only a budget cap. Grants issue new shares in the round where they occur and dilute existing holders at grant time.

## Priced round calculation

For each priced round:

```text
postMoney = preMoney + investment
pricePerShare = preMoney / previousTotalShares
newInvestorShares = round(investment / pricePerShare)
```

Then total shares are updated.

### Reserve issued upfront mode

```text
newTotalShares = previousTotalShares + newInvestorShares
```

Grant shares are transferred from unallocated to granted.

### Grant-issued mode

```text
newTotalShares = previousTotalShares + newInvestorShares + grantShares
```

Grant shares create new shares and dilute existing holders.

## Grant calculation

Per-round grants can be specified by absolute shares or percent of the reserve.

```text
if grantMode = pct:
  requestedGrantShares = round((grantValue / 100) * employeeReserve)
else:
  requestedGrantShares = round(grantValue)
```

Grants are capped by remaining reserve budget:

```text
grantBudgetRemaining = max(0, employeeReserve - alreadyGranted)
grantShares = clamp(requestedGrantShares, 0, grantBudgetRemaining)
```

## Ownership calculation

Existing stakeholders keep their absolute share counts and are diluted by the new total share count.

```text
ownershipPct = stakeholderShares / newTotalShares
```

The current implementation reconstructs prior stakeholder share counts from the previous state, using `Math.round` to keep share counts integral.

## Rounding assumptions

- Investor shares are rounded to the nearest whole share.
- Grant shares are rounded to the nearest whole share.
- Prior stakeholder share counts are rounded when carried forward.
- Tests allow tiny ownership-sum tolerance around 100% due to rounding.

## SAFE / convertible instrument MVP

The v1 scenario schema supports SAFE instruments with:

- `holderName`
- `investment`
- `valuationCap` (optional; `null`/0 means uncapped)
- `discountPct` (optional; 0 means no discount)
- `mfn` and `proRata` metadata (stored/exported, not modeled economically yet)

All SAFEs currently convert in the first priced round. The priced round price is computed from the pre-SAFE previous total share count:

```text
pricedRoundPrice = preMoney / previousTotalShares
```

For each SAFE, the conversion price is the investor-favorable minimum of applicable prices:

```text
candidatePrices = [pricedRoundPrice]
if valuationCap > 0:
  candidatePrices += valuationCap / previousTotalShares
if discountPct > 0:
  candidatePrices += pricedRoundPrice * (1 - discountPct / 100)

conversionPrice = min(candidatePrices)
safeShares = round(investment / conversionPrice)
```

SAFE conversion shares are added to the first priced-round total share count alongside the priced investor shares and any grant-issued employee shares:

```text
newTotalShares = previousTotalShares + safeConversionShares + newInvestorShares [+ grantShares]
```

Converted SAFE holders then keep fixed absolute share counts and dilute through later priced rounds like other existing stakeholders.

Current limitations:

- Conversion happens only in the first priced round.
- MFN/pro-rata fields are informational only.
- Pre-money vs post-money SAFE variants, option-pool shuffles, interest, maturity dates, and note-specific mechanics are not modeled.

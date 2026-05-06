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

## Planned SAFE support

SAFE/convertible support should be added before priced round conversion. At minimum, a SAFE instrument should include:

- investor name
- investment amount
- valuation cap, optional
- discount, optional
- MFN/pro-rata metadata, initially informational if unsupported
- conversion round

At the first priced round, SAFE conversion should compare applicable conversion prices and issue shares using the investor-favorable price, then include converted SAFE holders in all downstream states, views, and exports.

// Pure dilution math. No React, no I/O.
// Inputs come in as plain values; output is an array of per-state snapshots
// (Pre-Funding + one entry per round).

export const RESERVE_KEY = 'Employee Reserve (Unallocated)'
export const GRANTED_KEY = 'Employees (Granted)'

// Compute cap-table state across a sequence of priced rounds.
//
// Two reserve modes:
//   preGrant=true  → entire reserve is issued upfront and dilutes everyone now;
//                    grants transfer from "Unallocated" to "Granted"
//                    (no new shares issued at grant time).
//   preGrant=false → reserve is just a budget cap; granting issues NEW shares
//                    each round (dilutes everyone at grant time). No
//                    "Unallocated" bucket on the cap table.
//
// Grants per round are capped by the remaining grant budget
// (reserve - shares already granted in earlier rounds).
export function computeRounds(founders, rounds, employeeReserve = 0, employeesOnCapTablePreGrant = true) {
  const founderTotal = founders.reduce((s, f) => s + (f.shares || 0), 0)
  const reserveCap = Math.max(0, Math.round(employeeReserve || 0))

  const reserveIssuedUpfront = employeesOnCapTablePreGrant ? reserveCap : 0
  const preFundTotal = founderTotal + reserveIssuedUpfront

  let states = []
  let prevTotal = preFundTotal
  let unallocatedReserve = reserveIssuedUpfront
  let granted = 0

  const preFund = {
    label: 'Pre-Funding',
    totalShares: preFundTotal,
    ownership: {},
    postMoney: null,
    preMoney: null,
    newInvestors: 0,
    roundIdx: -1,
  }
  founders.forEach(f => {
    preFund.ownership[f.name] = preFundTotal > 0 ? f.shares / preFundTotal : 0
  })
  if (employeesOnCapTablePreGrant && reserveIssuedUpfront > 0) {
    preFund.ownership[RESERVE_KEY] = reserveIssuedUpfront / preFundTotal
  }
  states.push(preFund)

  rounds.forEach((round, idx) => {
    const preVal = round.preMoneyVal || 0
    const invest = round.investment || 0
    const postVal = preVal + invest

    const pricePerShare = prevTotal > 0 ? preVal / prevTotal : 0
    const newInvestorShares = pricePerShare > 0 ? Math.round(invest / pricePerShare) : 0

    let grantShares = 0
    if (round.grantMode === 'pct') {
      const pct = (round.grantValue || 0) / 100
      grantShares = Math.round(pct * reserveCap)
    } else {
      grantShares = Math.round(round.grantValue || 0)
    }
    const grantBudgetRemaining = Math.max(0, reserveCap - granted)
    grantShares = Math.max(0, Math.min(grantShares, grantBudgetRemaining))

    let newTotal
    if (employeesOnCapTablePreGrant) {
      newTotal = prevTotal + newInvestorShares
      unallocatedReserve -= grantShares
      granted += grantShares
    } else {
      newTotal = prevTotal + newInvestorShares + grantShares
      granted += grantShares
    }

    const state = {
      label: round.name,
      totalShares: newTotal,
      preMoney: preVal,
      postMoney: postVal,
      pricePerShare,
      investment: invest,
      newInvestorShares,
      grantShares,
      roundIdx: idx,
      ownership: {},
    }

    founders.forEach(f => {
      const prevState = states[states.length - 1]
      const founderShareCount = Math.round((prevState.ownership[f.name] || 0) * prevState.totalShares)
      state.ownership[f.name] = founderShareCount / newTotal
    })

    states.forEach((s, si) => {
      if (si === 0) return
      const key = s.label
      const prevInvShares = Math.round((states[states.length - 1].ownership[key] || 0) * prevTotal)
      state.ownership[key] = prevInvShares / newTotal
    })

    state.ownership[round.name] = newInvestorShares / newTotal

    if (employeesOnCapTablePreGrant) {
      if (unallocatedReserve > 0) state.ownership[RESERVE_KEY] = unallocatedReserve / newTotal
      if (granted > 0) state.ownership[GRANTED_KEY] = granted / newTotal
    } else {
      if (granted > 0) state.ownership[GRANTED_KEY] = granted / newTotal
    }

    prevTotal = newTotal
    states.push(state)
  })

  return states
}

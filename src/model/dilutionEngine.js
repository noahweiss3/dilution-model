// Pure dilution math. No React, no I/O.
// Inputs come in as plain values; output is an array of per-state snapshots
// (Pre-Funding + one entry per round).

export const RESERVE_KEY = 'Employee Reserve (Unallocated)'
export const GRANTED_KEY = 'Employees (Granted)'

const toShares = (value) => Math.max(0, Math.round(value || 0))

function safeConversionForInstrument(instrument, pricedRoundPrice, prevTotalShares) {
  if (!instrument || (instrument.type || 'safe') !== 'safe') return null
  const investment = Math.max(0, instrument.investment || 0)
  if (!investment || pricedRoundPrice <= 0) return null

  const candidatePrices = [pricedRoundPrice]
  if (instrument.valuationCap > 0 && prevTotalShares > 0) {
    candidatePrices.push(instrument.valuationCap / prevTotalShares)
  }
  if (instrument.discountPct > 0 && instrument.discountPct < 100) {
    candidatePrices.push(pricedRoundPrice * (1 - instrument.discountPct / 100))
  }

  const conversionPrice = Math.min(...candidatePrices.filter(price => price > 0))
  if (!conversionPrice || !Number.isFinite(conversionPrice)) return null

  const shares = toShares(investment / conversionPrice)
  if (!shares) return null

  return {
    id: instrument.id,
    holderName: instrument.holderName || 'SAFE Holder',
    investment,
    valuationCap: instrument.valuationCap ?? null,
    discountPct: instrument.discountPct || 0,
    conversionPrice,
    shares,
    conversionRoundId: instrument.conversionRoundId ?? null,
  }
}

const hasSelectedConversionRound = (instrument) => (
  instrument?.conversionRoundId !== undefined &&
  instrument?.conversionRoundId !== null &&
  instrument?.conversionRoundId !== ''
)

function shouldConvertInstrumentInRound(instrument, round) {
  if (!hasSelectedConversionRound(instrument)) return true
  return String(instrument.conversionRoundId) === String(round.id)
}

function ownershipFromShares(holderShares, totalShares) {
  const ownership = {}
  Object.entries(holderShares).forEach(([holder, shares]) => {
    if (shares > 0 && totalShares > 0) ownership[holder] = shares / totalShares
  })
  return ownership
}

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
//
// SAFE/convertible MVP: by default, SAFE instruments convert in the first priced round
// where a valid conversion price exists. A SAFE can opt into a specific priced
// round via `conversionRoundId`; converted SAFE holder share counts then persist
// through later rounds like any other existing holder.
export function computeRounds(
  founders,
  rounds,
  employeeReserve = 0,
  employeesOnCapTablePreGrant = true,
  instruments = [],
) {
  const founderTotal = founders.reduce((s, f) => s + (f.shares || 0), 0)
  const reserveCap = toShares(employeeReserve)

  const reserveIssuedUpfront = employeesOnCapTablePreGrant ? reserveCap : 0
  const preFundTotal = founderTotal + reserveIssuedUpfront

  const holderShares = {}
  founders.forEach(f => {
    const shares = toShares(f.shares)
    if (shares > 0) holderShares[f.name] = shares
  })
  if (employeesOnCapTablePreGrant && reserveIssuedUpfront > 0) {
    holderShares[RESERVE_KEY] = reserveIssuedUpfront
  }

  const states = []
  let prevTotal = preFundTotal
  let unallocatedReserve = reserveIssuedUpfront
  let granted = 0
  const convertedSafeIds = new Set()

  states.push({
    label: 'Pre-Funding',
    totalShares: preFundTotal,
    ownership: ownershipFromShares(holderShares, preFundTotal),
    postMoney: null,
    preMoney: null,
    newInvestors: 0,
    roundIdx: -1,
  })

  rounds.forEach((round, idx) => {
    const preVal = round.preMoneyVal || 0
    const invest = round.investment || 0
    const postVal = preVal + invest

    const pricePerShare = prevTotal > 0 ? preVal / prevTotal : 0
    const newInvestorShares = pricePerShare > 0 ? toShares(invest / pricePerShare) : 0

    const safeConversions = instruments
      .filter(instrument => !convertedSafeIds.has(instrument.id))
      .filter(instrument => shouldConvertInstrumentInRound(instrument, round))
      .map(instrument => safeConversionForInstrument(instrument, pricePerShare, prevTotal))
      .filter(Boolean)
    safeConversions.forEach(conversion => convertedSafeIds.add(conversion.id))
    const safeConversionShares = safeConversions.reduce((sum, conversion) => sum + conversion.shares, 0)
    safeConversions.forEach(conversion => {
      holderShares[conversion.holderName] = (holderShares[conversion.holderName] || 0) + conversion.shares
    })

    let grantShares = 0
    if (round.grantMode === 'pct') {
      const pct = (round.grantValue || 0) / 100
      grantShares = toShares(pct * reserveCap)
    } else {
      grantShares = toShares(round.grantValue)
    }
    const grantBudgetRemaining = Math.max(0, reserveCap - granted)
    grantShares = Math.max(0, Math.min(grantShares, grantBudgetRemaining))

    let newTotal
    if (employeesOnCapTablePreGrant) {
      newTotal = prevTotal + safeConversionShares + newInvestorShares
      unallocatedReserve -= grantShares
      granted += grantShares
      if (unallocatedReserve > 0) holderShares[RESERVE_KEY] = unallocatedReserve
      else delete holderShares[RESERVE_KEY]
      if (granted > 0) holderShares[GRANTED_KEY] = granted
    } else {
      newTotal = prevTotal + safeConversionShares + newInvestorShares + grantShares
      granted += grantShares
      if (granted > 0) holderShares[GRANTED_KEY] = granted
    }

    if (newInvestorShares > 0) holderShares[round.name] = (holderShares[round.name] || 0) + newInvestorShares

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
      ownership: ownershipFromShares(holderShares, newTotal),
    }
    if (instruments.length > 0) {
      state.safeConversionShares = safeConversionShares
      state.safeConversions = safeConversions
    }

    prevTotal = newTotal
    states.push(state)
  })

  return states
}

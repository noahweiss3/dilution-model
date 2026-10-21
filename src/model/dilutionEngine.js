// Pure educational dilution model. No React or persistence.
import {
  founderKey,
  roundKey,
  safeKey,
  RESERVE_KEY,
  GRANTED_KEY,
  scenarioHolders,
  entityId,
} from "./identities.js";
import { validateScenario } from "./validation.js";
import {
  calculationVersionFor,
  conventionOf,
  POST_MONEY_CONVENTION,
} from "./safeConventions.js";
import { pricePostMoneyCohort } from "./postMoneySafe.js";
export {
  founderKey,
  roundKey,
  safeKey,
  RESERVE_KEY,
  GRANTED_KEY,
  scenarioHolders,
  validateScenario,
};

const toShares = (value) => {
  const rounded = Math.round(value);
  if (!Number.isSafeInteger(rounded) || rounded < 0)
    throw new Error(
      "Calculated shares exceed the safe whole-share range. Reduce the amounts or increase the valuation.",
    );
  return rounded;
};
const finiteValue = (value) => {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
    throw new Error(
      "Calculated values exceed the safe numeric range. Reduce the scenario amounts.",
    );
  return value;
};

function conversion(instrument, index, price, pricingShares) {
  const candidates = [{ rule: "Round price", price }];
  if (instrument.valuationCap > 0)
    candidates.push({
      rule: "Valuation cap / pre-conversion shares",
      price: instrument.valuationCap / pricingShares,
    });
  if (instrument.discountPct > 0)
    candidates.push({
      rule: "Discounted round price",
      price: price * (1 - instrument.discountPct / 100),
    });
  const best = candidates.reduce((a, b) => (a.price <= b.price ? a : b));
  const shares = toShares(instrument.investment / best.price);
  if (!shares)
    throw new Error(
      "A SAFE investment is too small to issue a whole share. Increase the amount or scale the founder share count.",
    );
  return {
    id: entityId(instrument, "safe", index),
    key: safeKey(instrument, index),
    holderName: instrument.holderName,
    investment: instrument.investment,
    valuationCap: instrument.valuationCap ?? null,
    discountPct: instrument.discountPct || 0,
    conversionRoundId: instrument.conversionRoundId ?? null,
    conversionPrice: best.price,
    rule: best.rule,
    candidates,
    shares,
  };
}

export function computeRounds(
  founders,
  rounds,
  employeeReserve = 0,
  employeesOnCapTablePreGrant = true,
  instruments = [],
  options = {},
) {
  const errors = validateScenario({
    founders,
    rounds,
    employeeReserve,
    employeesOnCapTablePreGrant,
    instruments,
    safeConvention: options.safeConvention,
  });
  if (errors.length) throw new Error(errors.map((e) => e.message).join(" "));
  const postMoneyReference = conventionOf(options) === POST_MONEY_CONVENTION;
  const holderShares = Object.create(null);
  founders.forEach((f, i) => {
    holderShares[founderKey(f, i)] = f.shares;
  });
  if (employeesOnCapTablePreGrant && employeeReserve)
    holderShares[RESERVE_KEY] = employeeReserve;
  const snapshot = () => {
    const shares = { ...holderShares };
    const sum = postMoneyReference
      ? Object.keys(shares)
          .sort()
          .reduce((total, key) => total + shares[key], 0)
      : Object.values(shares).reduce((a, b) => a + b, 0);
    const totalShares = postMoneyReference ? finiteValue(sum) : toShares(sum);
    const ownership = Object.fromEntries(
      Object.entries(shares)
        .filter(([, n]) => n > 0)
        .map(([key, n]) => [key, n / totalShares]),
    );
    return { holderShares: shares, totalShares, ownership };
  };
  const states = [
    {
      label: "Pre-Funding",
      stageId: "pre-funding",
      ...snapshot(),
      postMoney: null,
      preMoney: null,
      roundIdx: -1,
    },
  ];
  const converted = new Set();
  let granted = 0;
  rounds.forEach((round, idx) => {
    const starting = states.at(-1);
    let pricingShares = starting.totalShares;
    let pricePerShare = finiteValue(round.preMoneyVal / pricingShares);
    let newInvestorShares = postMoneyReference
      ? finiteValue(round.investment / pricePerShare)
      : toShares(round.investment / pricePerShare);
    if (round.investment > 0 && !newInvestorShares)
      throw new Error(
        "A round investment is too small to issue a whole share. Increase the amount or scale the founder share count.",
      );
    let safeConversions;
    if (postMoneyReference) {
      const pending =
        round.investment > 0
          ? instruments
              .map((s, si) => ({ ...s, id: entityId(s, "safe", si) }))
              .filter((s) => !converted.has(safeKey(s)))
          : [];
      const priced = pricePostMoneyCohort({
        existingShares: starting.totalShares,
        preMoney: round.preMoneyVal,
        investment: round.investment,
        instruments: pending,
      });
      pricingShares = priced.companyCapitalization;
      pricePerShare = priced.pricePerShare;
      newInvestorShares = priced.newInvestorShares;
      safeConversions = priced.conversions;
      safeConversions.forEach((c) => converted.add(c.key));
    } else
      safeConversions =
        round.investment > 0
          ? instruments.flatMap((s, si) => {
              const key = safeKey(s, si);
              const target = s.conversionRoundId;
              if (
                converted.has(key) ||
                !s.investment ||
                (target != null &&
                  target !== "" &&
                  String(target) !== entityId(round, "round", idx))
              )
                return [];
              converted.add(key);
              return [conversion(s, si, pricePerShare, pricingShares)];
            })
          : [];
    safeConversions.forEach((c) => {
      holderShares[c.key] = c.shares;
    });
    const conversionSum = (
      postMoneyReference
        ? [...safeConversions].sort((a, b) => a.key.localeCompare(b.key))
        : safeConversions
    ).reduce((sum, c) => sum + c.shares, 0);
    const safeConversionShares = postMoneyReference
      ? finiteValue(conversionSum)
      : toShares(conversionSum);
    const requestedGrantShares = toShares(
      round.grantMode === "pct"
        ? ((round.grantValue || 0) / 100) * employeeReserve
        : round.grantValue || 0,
    );
    const grantBudgetRemaining = employeeReserve - granted;
    const grantShares = Math.min(requestedGrantShares, grantBudgetRemaining);
    granted += grantShares;
    if (employeesOnCapTablePreGrant)
      holderShares[RESERVE_KEY] = employeeReserve - granted;
    if (granted) holderShares[GRANTED_KEY] = granted;
    if (newInvestorShares)
      holderShares[roundKey(round, idx)] = newInvestorShares;
    const ending = snapshot();
    const conversionValue = finiteValue(safeConversionShares * pricePerShare);
    const grantValueAtRoundPrice = employeesOnCapTablePreGrant
      ? 0
      : finiteValue(grantShares * pricePerShare);
    const roundingAdjustment = postMoneyReference
      ? 0
      : finiteValue(newInvestorShares * pricePerShare - round.investment);
    states.push({
      label: round.name,
      stageId: roundKey(round, idx),
      roundId: entityId(round, "round", idx),
      roundIdx: idx,
      ...ending,
      preMoney: round.preMoneyVal,
      investment: round.investment,
      quotedPostMoney: finiteValue(round.preMoneyVal + round.investment),
      postMoney: finiteValue(pricePerShare * ending.totalShares),
      pricePerShare,
      pricingShares,
      ...(postMoneyReference
        ? {
            preConversionShares: starting.totalShares,
            safeCompanyCapitalization: pricingShares,
            conversionIncludedInPreMoney: true,
          }
        : {}),
      newInvestorShares,
      safeConversionShares,
      safeConversions,
      requestedGrantShares,
      grantBudgetRemaining,
      grantShares,
      unfulfilledGrantShares: requestedGrantShares - grantShares,
      conversionValue,
      grantValueAtRoundPrice,
      roundingAdjustment,
    });
  });
  return states;
}

export function calculateScenario(input) {
  const calculationVersion =
    input?.calculationVersion ?? calculationVersionFor(input || {});
  const errors = validateScenario(input);
  if (errors.length)
    return {
      states: [],
      holders: [],
      errors,
      warnings: [],
      calculationVersion,
    };
  try {
    const states = computeRounds(
      input.founders,
      input.rounds,
      input.employeeReserve,
      input.employeesOnCapTablePreGrant,
      input.instruments || [],
      { safeConvention: input.safeConvention },
    );
    const warnings = states
      .slice(1)
      .filter((s) => s.unfulfilledGrantShares > 0)
      .map(
        (s) =>
          `${s.label}: ${s.unfulfilledGrantShares.toLocaleString("en-US")} requested shares were not granted because the reserve is exhausted.`,
      );
    const holders = scenarioHolders(
      input.founders,
      input.rounds,
      input.instruments,
    ).filter((h) => states.some((s) => (s.holderShares[h.key] || 0) > 0));
    if (conventionOf(input) === POST_MONEY_CONVENTION)
      warnings.unshift(
        "Post-money reference ownership model: calculated shares may be fractional. Actual issuance rounding is not modeled. All listed SAFEs are outstanding before the first priced round; no financing pool top-up or later SAFE issuance is modeled.",
      );
    const converted = new Set(
      states.flatMap((s) => (s.safeConversions || []).map((c) => c.key)),
    );
    (input.instruments || []).forEach((s, i) => {
      if (s.investment > 0 && !converted.has(safeKey(s, i)))
        warnings.push(
          `${s.holderName}: SAFE is unconverted and not included in equity yet. Add a positive-investment conversion round.`,
        );
      if (s.mfn || s.proRata)
        warnings.push(
          `${s.holderName}: MFN and pro-rata metadata are not modeled economically.`,
        );
    });
    return {
      states,
      holders,
      errors: [],
      warnings,
      calculationVersion,
    };
  } catch (error) {
    return {
      states: [],
      holders: [],
      errors: [{ path: "scenario", message: error.message }],
      warnings: [],
      calculationVersion,
    };
  }
}

export function chartSnapshots(result, mode = "pct") {
  return result.states.map((s) => ({
    stageId: s.stageId,
    label: s.label,
    ...Object.fromEntries(
      result.holders.map((h) => [
        h.key,
        mode === "shares"
          ? s.holderShares[h.key] || 0
          : (s.ownership[h.key] || 0) * 100,
      ]),
    ),
  }));
}

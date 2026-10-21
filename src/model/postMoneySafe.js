// Closed-form reference model from the YC guide, no financing pool increase.
// See docs/safe-conventions-design.md. Fractions are deliberately not rounded.
import { entityId, safeKey } from "./identities.js";
import { postMoneyTermErrors } from "./safeConventions.js";

const bounded = (value) =>
  Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
function quantity(value) {
  if (!bounded(value) || value < 0)
    throw Error("Calculated SAFE quantities exceed the safe numeric range.");
  return value;
}

export function pricePostMoneyCohort({
  existingShares,
  preMoney,
  investment,
  instruments,
}) {
  if (
    !bounded(existingShares) ||
    existingShares <= 0 ||
    !bounded(preMoney) ||
    preMoney <= 0 ||
    !bounded(investment) ||
    investment < 0
  )
    throw Error(
      "Post-money pricing needs positive finite capitalization and pre-money, and nonnegative finite cash.",
    );
  const terms = instruments.map((s, i) => {
    if (
      !bounded(s.investment) ||
      s.investment < 0 ||
      !bounded(s.valuationCap ?? 0)
    )
      throw Error(
        "SAFE amounts must be finite and within the safe numeric range.",
      );
    const errors = postMoneyTermErrors(s);
    if (errors.length) throw Error(errors.map((e) => e.message).join(" "));
    const candidates = [{ rule: "Round price", valuation: preMoney }];
    if (s.variant !== "post-money-discount")
      candidates.push({
        rule: "Valuation cap / post-money capitalization",
        valuation: s.valuationCap,
      });
    if (s.variant !== "post-money-cap")
      candidates.push({
        rule: "Discounted round price",
        valuation: preMoney * (1 - (s.discountPct ?? 0) / 100),
      });
    const best = candidates.reduce((a, b) =>
      a.valuation <= b.valuation ? a : b,
    );
    return {
      instrument: s,
      index: i,
      candidates,
      best,
      weight: quantity(s.investment / best.valuation),
    };
  });
  // Deterministic, compensated summation keeps economic output independent of
  // editable display order, even for cohorts with very different weights.
  let weight = 0,
    correction = 0;
  for (const term of [...terms].sort((a, b) =>
    entityId(a.instrument, "safe", a.index).localeCompare(
      entityId(b.instrument, "safe", b.index),
    ),
  )) {
    const adjusted = term.weight - correction;
    const next = weight + adjusted;
    correction = next - weight - adjusted;
    weight = next;
  }
  if (weight >= 1)
    throw Error(
      "SAFE conversion claims reach 100% of pre-new-money ownership. Reduce the SAFE amounts or revise the financing terms.",
    );
  const companyCapitalization = quantity(existingShares / (1 - weight));
  const pricePerShare = quantity(preMoney / companyCapitalization);
  if (!(pricePerShare > 0))
    throw Error("The calculated share price is too small to represent.");
  const conversions = terms
    .filter((t) => t.instrument.investment > 0)
    .map(({ instrument: s, index, candidates, best, weight }) => {
      const conversionPrice = quantity(best.valuation / companyCapitalization);
      const shares = quantity(weight * companyCapitalization);
      if (!(conversionPrice > 0) || !(shares > 0))
        throw Error(
          "Positive SAFE quantities are too small to represent safely.",
        );
      return {
        id: entityId(s, "safe", index),
        key: safeKey(s, index),
        holderName: s.holderName,
        investment: s.investment,
        valuationCap: s.valuationCap ?? null,
        discountPct: s.discountPct ?? 0,
        conversionRoundId: s.conversionRoundId ?? null,
        variant: s.variant,
        conversionPrice,
        rule: best.rule,
        shares,
        candidates: candidates.map(({ rule, valuation }) => ({
          rule,
          price: quantity(valuation / companyCapitalization),
        })),
      };
    });
  const newInvestorShares = quantity(investment / pricePerShare);
  if (investment > 0 && !(newInvestorShares > 0))
    throw Error("New-money shares are too small to represent safely.");
  return {
    companyCapitalization,
    pricePerShare,
    newInvestorShares,
    conversions,
  };
}

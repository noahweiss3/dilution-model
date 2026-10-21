import { entityId } from "./identities.js";
const bounded = (n) =>
  typeof n === "number" &&
  Number.isFinite(n) &&
  Math.abs(n) <= Number.MAX_SAFE_INTEGER;
const shares = (n) => Number.isSafeInteger(n) && n >= 0;
const named = (n) => typeof n === "string" && n.trim().length > 0;

export function validateScenario(input = {}) {
  if (!input || typeof input !== "object")
    return [{ path: "scenario", message: "Scenario data must be an object." }];
  const {
    founders = [],
    rounds = [],
    employeeReserve = 0,
    instruments = [],
  } = input;
  for (const [path, list] of Object.entries({
    founders,
    rounds,
    instruments,
  })) {
    if (
      !Array.isArray(list) ||
      !list.every(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    ) {
      return [{ path, message: `${path} must be a list of valid entries.` }];
    }
  }
  const errors = [];
  const add = (path, message) => errors.push({ path, message });
  if (
    input.employeesOnCapTablePreGrant !== undefined &&
    typeof input.employeesOnCapTablePreGrant !== "boolean"
  )
    add(
      "employeesOnCapTablePreGrant",
      "Choose whether the reserve is included before financing.",
    );
  for (const [kind, list] of [
    ["founder", founders],
    ["round", rounds],
    ["safe", instruments],
  ]) {
    const seen = new Set();
    list.forEach((item, i) => {
      const path = `${kind === "safe" ? "instruments" : `${kind}s`}.${i}`;
      const id = entityId(item, kind, i);
      if (!id.trim() || seen.has(id))
        add(
          `${path}.id`,
          `Duplicate or empty ${kind} ID. Remove the duplicate entry and add it again.`,
        );
      seen.add(id);
    });
  }
  founders.forEach((f, i) => {
    if (!named(f.name))
      add(
        `founders.${i}.name`,
        "Enter a founder name. Duplicate display names are allowed.",
      );
    if (!shares(f.shares))
      add(
        `founders.${i}.shares`,
        "Shares must be a nonnegative whole number within the safe numeric range.",
      );
  });
  const founderTotal = founders.reduce((sum, f) => sum + f.shares, 0);
  if (!Number.isSafeInteger(founderTotal) || founderTotal <= 0)
    add(
      "founders",
      "Enter at least one founder and a positive, safe total share count.",
    );
  if (!shares(employeeReserve))
    add(
      "employeeReserve",
      "The reserve must be a nonnegative whole number of shares.",
    );
  if (!Number.isSafeInteger(founderTotal + employeeReserve))
    add(
      "employeeReserve",
      "Founder shares plus the reserve exceed the safe numeric range.",
    );
  rounds.forEach((r, i) => {
    const path = `rounds.${i}`;
    if (!named(r.name)) add(`${path}.name`, "Enter a round name.");
    if (r.unit != null && !["K", "M"].includes(r.unit))
      add(`${path}.unit`, "Choose thousands or millions as the display unit.");
    if (!bounded(r.preMoneyVal) || r.preMoneyVal <= 0)
      add(
        `${path}.preMoneyVal`,
        "Pre-money valuation must be greater than zero and finite.",
      );
    if (!bounded(r.investment) || r.investment < 0)
      add(
        `${path}.investment`,
        "Investment must be nonnegative and finite. Zero means no new cash.",
      );
    if (r.grantMode != null && !["shares", "pct"].includes(r.grantMode))
      add(`${path}.grantMode`, "Choose shares or percent of reserve.");
    const grant = r.grantValue ?? 0;
    if (
      !bounded(grant) ||
      grant < 0 ||
      ((r.grantMode || "shares") === "shares" && !shares(grant))
    )
      add(
        `${path}.grantValue`,
        "Enter a nonnegative grant; share grants must be whole numbers.",
      );
    else if (r.grantMode === "pct" && grant > 100)
      add(
        `${path}.grantValue`,
        "Percent of reserve must be between 0 and 100.",
      );
  });
  instruments.forEach((s, i) => {
    const path = `instruments.${i}`;
    if ((s.type || "safe") !== "safe")
      add(`${path}.type`, "Only simplified SAFEs are supported in this model.");
    if (!named(s.holderName))
      add(`${path}.holderName`, "Enter a SAFE holder name.");
    if (!bounded(s.investment) || s.investment < 0)
      add(
        `${path}.investment`,
        "SAFE investment must be nonnegative and finite.",
      );
    if (
      s.valuationCap != null &&
      (!bounded(s.valuationCap) || s.valuationCap < 0)
    )
      add(
        `${path}.valuationCap`,
        "Enter a positive cap, or zero for uncapped.",
      );
    if (
      s.discountPct != null &&
      (!bounded(s.discountPct) || s.discountPct < 0 || s.discountPct >= 100)
    )
      add(
        `${path}.discountPct`,
        "Discount must be at least 0 and less than 100%.",
      );
    if (s.conversionRoundId != null && s.conversionRoundId !== "") {
      const round = rounds.find(
        (r, ri) => entityId(r, "round", ri) === String(s.conversionRoundId),
      );
      if (!round)
        add(
          `${path}.conversionRoundId`,
          "The selected conversion round was removed. Choose an existing round or the first priced round.",
        );
      else if (!(round.investment > 0))
        add(
          `${path}.conversionRoundId`,
          "SAFE conversion requires a round with positive new investment.",
        );
    }
  });
  return errors;
}

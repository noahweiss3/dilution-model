import { entityId } from "./identities.js";
import {
  conventionOf,
  calculationVersionFor,
  LEGACY_CONVENTION,
  POST_MONEY_CONVENTION,
  postMoneyTermErrors,
} from "./safeConventions.js";
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
  const convention = conventionOf(input);
  const postMoney = convention === POST_MONEY_CONVENTION;
  const unsupportedPool = (value) =>
    value != null && value !== 0 && value !== false;
  if (postMoney && input.promisedOptions != null && input.promisedOptions !== 0)
    add(
      "employeeReserve",
      "Separate promised-option adjustments are unsupported. This reference requires promised options already included in existing fully diluted capitalization.",
    );
  if (postMoney && unsupportedPool(input.poolTopUp))
    add(
      "employeeReserve",
      "Financing pool top-ups are unsupported in this reference release.",
    );
  if (![LEGACY_CONVENTION, POST_MONEY_CONVENTION].includes(convention))
    add(
      "safeConvention",
      "Unsupported SAFE convention. Choose a supported convention explicitly; the model will not guess.",
    );
  if (
    input.calculationVersion != null &&
    input.calculationVersion !== calculationVersionFor(input)
  )
    add(
      "calculationVersion",
      `Unsupported calculation version ${input.calculationVersion}. Explicitly adopt a supported convention to recalculate.`,
    );
  if (postMoney && employeeReserve > 0 && !input.employeesOnCapTablePreGrant)
    add(
      "employeeReserve",
      "The post-money reference requires the existing reserve in fully diluted capitalization. Include it before financing or set the reserve to zero.",
    );
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
    if (postMoney && unsupportedPool(r.poolTopUp))
      add(
        `${path}.grantValue`,
        "Financing pool top-ups are unsupported; a grant from the existing reserve is a different action.",
      );
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
    if (
      postMoney &&
      s.issuanceAfterRoundId != null &&
      s.issuanceAfterRoundId !== ""
    )
      add(
        `${path}.variant`,
        "Later SAFE issuance timing is unsupported. All listed SAFEs must be outstanding before the first priced round.",
      );
    if ((s.type || "safe") !== "safe")
      add(
        `${path}.type`,
        "Only the supported SAFE reference forms are modeled; notes and other instruments are unsupported.",
      );
    if (postMoney)
      postMoneyTermErrors(s).forEach((e) =>
        add(`${path}.${e.field}`, e.message),
      );
    else if (s.variant != null && s.variant !== "legacy-generic")
      add(
        `${path}.variant`,
        "A post-money or unknown SAFE form cannot use legacy pricing. Choose the corresponding convention explicitly.",
      );
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
      else if (postMoney && round !== rounds.find((r) => r.investment > 0))
        add(
          `${path}.conversionRoundId`,
          "All listed post-money SAFEs are assumed outstanding before the first priced round and must convert there. Later issuance timing is unsupported.",
        );
    }
  });
  return errors;
}

import { entityId } from "./identities.js";
import {
  LEGACY_CONVENTION,
  LEGACY_CALCULATION_VERSION,
  calculationVersionFor,
} from "./safeConventions.js";
export const CURRENT_SCENARIO_VERSION = 3;
// Compatibility alias: old callers/tests still identify the unchanged legacy math.
export const CALCULATION_VERSION = LEGACY_CALCULATION_VERSION;
const EMPTY = {
  founders: [],
  rounds: [],
  instruments: [],
  employeeReserve: 0,
  employeesOnCapTablePreGrant: false,
};
const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function withIds(items, kind, copy) {
  const occupied = new Set(
    items.filter((x) => x.id != null).map((x) => String(x.id)),
  );
  return items.map((item, i) => {
    let id = entityId(item, kind, i);
    if (item.id == null) {
      while (occupied.has(id)) id += "-migrated";
      occupied.add(id);
    }
    return { id, ...copy(item) };
  });
}

// Never silently filter economic errors out of a saved scenario. Callers validate
// before saving/exporting. Loaded drafts retain fixable errors and stable IDs.
export function createScenarioState(input = EMPTY) {
  return {
    schemaVersion: CURRENT_SCENARIO_VERSION,
    calculationVersion:
      input.calculationVersion ?? calculationVersionFor(input),
    safeConvention: input.safeConvention ?? LEGACY_CONVENTION,
    ...(input.promisedOptions != null
      ? { promisedOptions: input.promisedOptions }
      : {}),
    ...(input.poolTopUp != null ? { poolTopUp: input.poolTopUp } : {}),
    founders: withIds(input.founders || [], "founder", (f) => ({
      name: f.name,
      shares: f.shares,
    })),
    employeeReserve: input.employeeReserve ?? 0,
    employeesOnCapTablePreGrant: Boolean(input.employeesOnCapTablePreGrant),
    rounds: withIds(input.rounds || [], "round", (r) => ({
      name: r.name,
      investment: r.investment,
      preMoneyVal: r.preMoneyVal,
      unit: r.unit || "M",
      grantMode: r.grantMode || "shares",
      grantValue: r.grantValue ?? 0,
      ...(r.poolTopUp != null ? { poolTopUp: r.poolTopUp } : {}),
    })),
    instruments: withIds(input.instruments || [], "safe", (s) => ({
      type: s.type || "safe",
      variant: s.variant ?? "legacy-generic",
      ...(s.issuanceAfterRoundId != null
        ? { issuanceAfterRoundId: s.issuanceAfterRoundId }
        : {}),
      holderName: s.holderName,
      investment: s.investment,
      valuationCap: s.valuationCap ?? null,
      discountPct: s.discountPct ?? 0,
      ...(s.conversionRoundId == null || s.conversionRoundId === ""
        ? {}
        : { conversionRoundId: String(s.conversionRoundId) }),
      mfn: Boolean(s.mfn),
      proRata: Boolean(s.proRata),
    })),
  };
}

export function normalizeScenarioState(input, defaults = EMPTY) {
  const fallback = createScenarioState(defaults);
  const warnings = [];
  if (!isObject(input))
    return {
      scenario: fallback,
      warnings: ["Scenario data was malformed; restored defaults."],
      needsBackup: true,
    };
  if (input.schemaVersion > CURRENT_SCENARIO_VERSION)
    return {
      scenario: fallback,
      warnings: [
        `Scenario uses a newer schema v${input.schemaVersion}; original data was preserved for recovery.`,
      ],
      needsBackup: true,
    };
  if (
    input.schemaVersion !== CURRENT_SCENARIO_VERSION ||
    input.calculationVersion !== calculationVersionFor(input)
  ) {
    warnings.push(
      "Loaded schema v3 with explicit SAFE conventions and stable identities. Missing conventions retain legacy pre-conversion economics; original inputs are preserved for recovery. Unsupported convention/version tags require an explicit choice before calculation.",
    );
  }
  const source = { ...input };
  for (const key of ["founders", "rounds", "instruments"]) {
    if (key === "instruments" && source[key] == null) source[key] = [];
    if (!Array.isArray(source[key]) || !source[key].every(isObject)) {
      source[key] = fallback[key];
      warnings.push(
        `Malformed ${key}; restored defaults for that section. Original data was preserved for recovery.`,
      );
    }
  }
  if (typeof source.employeeReserve !== "number") {
    source.employeeReserve = fallback.employeeReserve;
    warnings.push("Malformed employee reserve; restored the default reserve.");
  }
  if (typeof source.employeesOnCapTablePreGrant !== "boolean") {
    source.employeesOnCapTablePreGrant = fallback.employeesOnCapTablePreGrant;
    warnings.push("Malformed reserve mode; restored the default mode.");
  }
  return {
    scenario: createScenarioState(source),
    warnings,
    needsBackup: warnings.length > 0,
  };
}

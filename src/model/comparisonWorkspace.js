import { createId, founderKey } from "./identities.js";
import { calculateScenario } from "./dilutionEngine.js";
import { createScenarioState } from "./scenarioSchema.js";

export const WORKSPACE_VERSION = 1;
export const MAX_CASES = 4;
export const activeCase = (workspace) =>
  workspace.cases.find((item) => item.id === workspace.activeId);
export const baselineCase = (workspace) =>
  workspace.cases.find((item) => item.id === workspace.baselineId);

export function createWorkspace(scenario, id = createId()) {
  return {
    workspaceVersion: WORKSPACE_VERSION,
    activeId: id,
    baselineId: id,
    cases: [{ id, name: "Baseline", scenario: createScenarioState(scenario) }],
  };
}

export function validateWorkspace(workspace) {
  if (workspace?.workspaceVersion !== WORKSPACE_VERSION)
    throw Error("Unsupported comparison workspace version.");
  if (
    !Array.isArray(workspace.cases) ||
    !workspace.cases.length ||
    workspace.cases.length > MAX_CASES
  )
    throw Error("A comparison needs one to four cases.");
  const ids = new Set();
  const names = new Set();
  for (const item of workspace.cases) {
    if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id))
      throw Error("Each case needs a unique identity.");
    ids.add(item.id);
    const name = item.name?.trim();
    if (!name || name.length > 80 || names.has(name.toLocaleLowerCase("en-US")))
      throw Error("Use a distinct case name of 1–80 characters.");
    names.add(name.toLocaleLowerCase("en-US"));
    if (!item.scenario || typeof item.scenario !== "object")
      throw Error("Case inputs are missing.");
  }
  if (!ids.has(workspace.activeId) || !ids.has(workspace.baselineId))
    throw Error("The active case and baseline must exist.");
  return workspace;
}

function requireValid(item) {
  if (calculateScenario(item.scenario).errors.length)
    throw Error("Fix the case inputs first.");
}

// Case identities differ; economic identities deliberately survive duplication.
export function changeWorkspace(workspace, action) {
  validateWorkspace(workspace);
  const current = activeCase(workspace);
  let next;
  switch (action.type) {
    case "switch":
      if (!workspace.cases.some((c) => c.id === action.id))
        throw Error("Case not found.");
      next = { ...workspace, activeId: action.id };
      break;
    case "rename":
      next = {
        ...workspace,
        cases: workspace.cases.map((c) =>
          c.id === current.id ? { ...c, name: action.name.trim() } : c,
        ),
      };
      break;
    case "duplicate": {
      requireValid(current);
      if (workspace.cases.length >= MAX_CASES)
        throw Error("Keep up to four cases in this workspace.");
      const names = new Set(
        workspace.cases.map((c) => c.name.toLocaleLowerCase("en-US")),
      );
      let ordinal = 1;
      while (names.has(`alternative ${ordinal}`)) ordinal++;
      const copy = {
        id: action.id || createId(),
        name: `Alternative ${ordinal}`,
        scenario: createScenarioState(current.scenario),
      };
      next = {
        ...workspace,
        activeId: copy.id,
        cases: [...workspace.cases, copy],
      };
      break;
    }
    case "pin":
      requireValid(current);
      next = { ...workspace, baselineId: current.id };
      break;
    case "reset":
      if (current.id === workspace.baselineId)
        throw Error("The baseline cannot reset to itself.");
      requireValid(baselineCase(workspace));
      next = {
        ...workspace,
        cases: workspace.cases.map((c) =>
          c.id === current.id
            ? {
                ...c,
                scenario: createScenarioState(baselineCase(workspace).scenario),
              }
            : c,
        ),
      };
      break;
    case "remove":
      if (current.id === workspace.baselineId)
        throw Error("Pin another case before removing the baseline.");
      next = {
        ...workspace,
        activeId: workspace.baselineId,
        cases: workspace.cases.filter((c) => c.id !== current.id),
      };
      break;
    default:
      throw Error("Unknown comparison action.");
  }
  return validateWorkspace(next);
}

export function replaceCaseInputs(workspace, id, scenario) {
  return {
    ...workspace,
    cases: workspace.cases.map((c) => (c.id === id ? { ...c, scenario } : c)),
  };
}

// Outcomes always come from the same engine used by the editor and workbook.
export function compareCases(workspace, blockedIds = []) {
  const ordered = [
    baselineCase(workspace),
    ...workspace.cases.filter((c) => c.id !== workspace.baselineId),
  ];
  const cases = ordered.map((item) => {
    const result = calculateScenario(item.scenario);
    if (result.errors.length || blockedIds.includes(item.id))
      return { ...item, valid: false };
    const last = result.states.at(-1);
    return {
      ...item,
      valid: true,
      finalStage: last.label,
      founderOwnership: item.scenario.founders.reduce(
        (sum, f, i) => sum + (last.ownership[founderKey(f, i)] || 0),
        0,
      ),
      founderHoldings: Object.fromEntries(
        item.scenario.founders.map((f, i) => [
          f.id,
          last.ownership[founderKey(f, i)] || 0,
        ]),
      ),
      financingCash: item.scenario.rounds.reduce(
        (sum, r) => sum + r.investment,
        0,
      ),
      safeCash: item.scenario.instruments.reduce(
        (sum, s) => sum + s.investment,
        0,
      ),
    };
  });
  const base = cases[0];
  return cases.map((item) => ({
    ...item,
    ownershipDeltaPp:
      item.valid && base.valid
        ? (item.founderOwnership - base.founderOwnership) * 100
        : null,
    financingDelta:
      item.valid && base.valid ? item.financingCash - base.financingCash : null,
  }));
}

// Stable identities align changed assumptions even after rename or reorder.
// Display-only units are included, so a zero outcome delta is explainable too.
export function changedAssumptions(cases) {
  const registry = {
    founders: new Map(),
    rounds: new Map(),
    instruments: new Map(),
  };
  for (const item of cases)
    for (const kind of Object.keys(registry))
      for (const entity of item.scenario[kind])
        if (!registry[kind].has(entity.id))
          registry[kind].set(
            entity.id,
            `${entity.name || entity.holderName} (${kind === "founders" ? "founder" : kind === "rounds" ? "round" : "SAFE"} ${registry[kind].size + 1})`,
          );
  function flatten(scenario) {
    const rows = new Map();
    const put = (key, label, value, format = "text") =>
      rows.set(key, { key, label, value, format });
    put(
      "reserve",
      "Employee reserve shares",
      scenario.employeeReserve,
      "number",
    );
    put(
      "reserve-mode",
      "Reserve before financing",
      scenario.employeesOnCapTablePreGrant ? "Included" : "Excluded",
    );
    put(
      "round-order",
      "Funding round order",
      scenario.rounds.map((r) => registry.rounds.get(r.id)).join(" → ") ||
        "No rounds",
    );
    for (const kind of Object.keys(registry))
      for (const entity of scenario[kind]) {
        const label = registry[kind].get(entity.id);
        const prefix = `${kind}:${entity.id}:`;
        put(`${prefix}present`, `${label} · included`, "Yes");
        const fields =
          kind === "founders"
            ? [
                ["name", "Name"],
                ["shares", "Shares", "number"],
              ]
            : kind === "rounds"
              ? [
                  ["name", "Name"],
                  ["investment", "New cash", "money"],
                  ["preMoneyVal", "Pre-money", "money"],
                  ["unit", "Input display units"],
                  ["grantMode", "Grant unit"],
                  [
                    "grantValue",
                    "Requested grant",
                    entity.grantMode === "pct" ? "reserve-percent" : "number",
                  ],
                ]
              : [
                  ["holderName", "Name"],
                  ["investment", "SAFE cash", "money"],
                  ["valuationCap", "Cap (zero means uncapped)", "money"],
                  ["discountPct", "Discount", "percent"],
                  ["conversionRoundId", "Conversion round"],
                  ["mfn", "MFN (unsupported)"],
                  ["proRata", "Pro rata (unsupported)"],
                ];
        for (const [field, title, format] of fields) {
          let value = entity[field];
          if (field === "conversionRoundId")
            value = value
              ? registry.rounds.get(value) || "Missing round"
              : "First positive-investment round";
          if (field === "valuationCap" || field === "discountPct") value ??= 0;
          if (typeof value === "boolean") value = value ? "Yes" : "No";
          put(`${prefix}${field}`, `${label} · ${title}`, value, format);
        }
      }
    return rows;
  }
  const maps = cases.map((c) => flatten(c.scenario));
  const rows = new Map();
  maps.forEach((map) =>
    map.forEach((row, key) => rows.set(key, rows.get(key) || row)),
  );
  return [...rows.values()]
    .filter((row) =>
      maps.some((map) => {
        const base = maps[0].get(row.key);
        const value = map.get(row.key);
        return (
          !base ||
          !value ||
          base.value !== value.value ||
          base.format !== value.format
        );
      }),
    )
    .map((row) => ({
      ...row,
      cells: maps.map((map) => map.get(row.key) || null),
    }));
}

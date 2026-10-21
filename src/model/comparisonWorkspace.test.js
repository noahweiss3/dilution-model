import { describe, expect, it } from "vitest";
import { createScenarioState, CALCULATION_VERSION } from "./scenarioSchema.js";
import {
  createWorkspace,
  changeWorkspace,
  activeCase,
  baselineCase,
  compareCases,
  changedAssumptions,
  replaceCaseInputs,
  validateWorkspace,
} from "./comparisonWorkspace.js";

const fixture = () =>
  createScenarioState({
    founders: [
      { id: "a", name: "Alex", shares: 6_000_000 },
      { id: "b", name: "Alex", shares: 4_000_000 },
    ],
    employeeReserve: 0,
    employeesOnCapTablePreGrant: false,
    instruments: [],
    rounds: [
      {
        id: "seed",
        name: "Seed",
        investment: 2_000_000,
        preMoneyVal: 8_000_000,
        unit: "M",
        grantMode: "shares",
        grantValue: 0,
      },
    ],
  });
const duplicate = (w, id = "alt") =>
  changeWorkspace(w, { type: "duplicate", id });

describe("comparison workspace", () => {
  it("duplicates isolated inputs with shared economic identities and explicit versions", () => {
    const original = createWorkspace(fixture(), "base");
    const workspace = duplicate(original);
    expect(activeCase(workspace).id).toBe("alt");
    expect(activeCase(workspace).scenario).toEqual(
      baselineCase(workspace).scenario,
    );
    expect(activeCase(workspace).scenario.calculationVersion).toBe(
      CALCULATION_VERSION,
    );
    activeCase(workspace).scenario.founders[0].shares = 1;
    expect(baselineCase(workspace).scenario.founders[0].shares).toBe(6_000_000);
    expect(original.cases).toHaveLength(1);
  });
  it("uses engine results for the approved $2M vs $3M example and identical cases", () => {
    let w = duplicate(createWorkspace(fixture(), "base"));
    expect(compareCases(w).map((c) => c.ownershipDeltaPp)).toEqual([0, 0]);
    const scenario = createScenarioState(activeCase(w).scenario);
    scenario.rounds[0].investment = 3_000_000;
    w = replaceCaseInputs(w, "alt", scenario);
    const [base, alt] = compareCases(w);
    expect(base.founderOwnership).toBeCloseTo(0.8, 12);
    expect(alt.founderOwnership).toBeCloseTo(8 / 11, 12);
    expect(alt.ownershipDeltaPp).toBeCloseTo(-7.2727272727, 8);
    expect(alt.financingDelta).toBe(1_000_000);
    expect(alt.founderHoldings.a).toBeCloseTo((0.6 * 8) / 11, 12);
    expect(changedAssumptions(compareCases(w)).map((r) => r.key)).toEqual([
      "rounds:seed:investment",
    ]);
  });
  it("pins, resets without aliasing or renaming, and protects the baseline", () => {
    let w = duplicate(createWorkspace(fixture(), "base"));
    w = changeWorkspace(w, { type: "rename", name: "Raise more" });
    w = changeWorkspace(w, { type: "pin" });
    expect(() => changeWorkspace(w, { type: "remove" })).toThrow(/baseline/);
    w = changeWorkspace(w, { type: "switch", id: "base" });
    w = changeWorkspace(w, { type: "reset" });
    expect(activeCase(w).name).toBe("Baseline");
    expect(activeCase(w).scenario).toEqual(baselineCase(w).scenario);
    w = changeWorkspace(w, { type: "remove" });
    expect(w.activeId).toBe("alt");
    expect(w.cases).toHaveLength(1);
  });
  it("matches by IDs across renamed and reordered rounds and duplicate founders", () => {
    let w = duplicate(createWorkspace(fixture(), "base"));
    const scenario = createScenarioState(activeCase(w).scenario);
    scenario.founders[0].name = "Jordan";
    scenario.rounds[0].name = "Renamed";
    scenario.rounds.push({ ...scenario.rounds[0], id: "a2" });
    scenario.rounds.reverse();
    w = replaceCaseInputs(w, "alt", scenario);
    const rows = changedAssumptions(compareCases(w));
    expect(
      rows.find((r) => r.key === "founders:a:name").cells.map((c) => c.value),
    ).toEqual(["Alex", "Jordan"]);
    expect(rows.some((r) => r.key === "founders:b:name")).toBe(false);
    expect(rows.find((r) => r.key === "round-order").cells[1].value).toContain(
      "round 2",
    );
    expect(rows.find((r) => r.key === "rounds:a2:present").cells[0]).toBeNull();
  });
  it("withholds invalid-case deltas, including editor-only draft errors", () => {
    const w = duplicate(createWorkspace(fixture(), "base"));
    expect(compareCases(w, ["alt"])[1].ownershipDeltaPp).toBeNull();
    baselineCase(w).scenario.rounds[0].preMoneyVal = 0;
    const [base, alt] = compareCases(w);
    expect(base.valid).toBe(false);
    expect(alt.valid).toBe(true);
    expect(alt.ownershipDeltaPp).toBeNull();
  });
  it("bounds alternatives and rejects ambiguous names, identities and missing references", () => {
    let w = duplicate(createWorkspace(fixture(), "base"));
    expect(() =>
      changeWorkspace(w, { type: "rename", name: " BASELINE " }),
    ).toThrow(/distinct/);
    expect(() => changeWorkspace(w, { type: "switch", id: "missing" })).toThrow(
      /not found/,
    );
    w = duplicate(w, "alt2");
    w = duplicate(w, "alt3");
    expect(() => duplicate(w, "alt4")).toThrow(/four/);
    expect(() => validateWorkspace({ ...w, activeId: "missing" })).toThrow(
      /exist/,
    );
    expect(() =>
      validateWorkspace({ ...w, cases: [w.cases[0], w.cases[0]] }),
    ).toThrow(/identity/);
  });
});

import { describe, it, expect } from "vitest";
import {
  CURRENT_SCENARIO_VERSION,
  CALCULATION_VERSION,
  createScenarioState,
  normalizeScenarioState,
} from "./scenarioSchema.js";
import { calculateScenario } from "./dilutionEngine.js";
const defaults = {
  founders: [{ name: "Default Founder", shares: 1_000_000 }],
  employeeReserve: 500_000,
  employeesOnCapTablePreGrant: false,
  rounds: [
    {
      id: 1,
      name: "Seed",
      investment: 1_000_000,
      preMoneyVal: 9_000_000,
      unit: "M",
      grantMode: "shares",
      grantValue: 0,
    },
  ],
  instruments: [],
};

describe("scenario schema v2", () => {
  it("assigns persistent IDs, strips computed fields, and serializes without changing inputs", () => {
    const scenario = createScenarioState({
      ...defaults,
      founders: [{ name: "A", shares: 2_000_000, uiOnly: true }],
      instruments: [
        {
          id: "safe-1",
          type: "safe",
          holderName: "Angel",
          investment: 100_000,
          valuationCap: 5_000_000,
          discountPct: 20,
          conversionRoundId: 1,
          unknown: true,
        },
      ],
      states: [],
    });
    expect(scenario.schemaVersion).toBe(CURRENT_SCENARIO_VERSION);
    expect(scenario.calculationVersion).toBe(CALCULATION_VERSION);
    expect(scenario.founders).toEqual([
      { id: "founder-1", name: "A", shares: 2_000_000 },
    ]);
    expect(scenario.rounds[0].id).toBe("1");
    expect(scenario.instruments[0].conversionRoundId).toBe("1");
    expect(scenario.instruments[0].unknown).toBeUndefined();
    expect(scenario.states).toBeUndefined();
    expect(createScenarioState(scenario)).toEqual(scenario);
  });
  it("preserves economic errors for correction instead of dropping an entity", () => {
    const data = { ...defaults, founders: [{ name: "", shares: -10 }] };
    const { scenario } = normalizeScenarioState(data, defaults);
    expect(scenario.founders[0]).toMatchObject({ name: "", shares: -10 });
    expect(calculateScenario(scenario).errors.length).toBeGreaterThan(0);
  });
  it("restores malformed sections with a recovery notice", () => {
    const { scenario, needsBackup, warnings } = normalizeScenarioState(
      { ...defaults, founders: [null], rounds: "bad" },
      defaults,
    );
    expect(scenario.founders).toEqual(createScenarioState(defaults).founders);
    expect(scenario.rounds).toEqual(createScenarioState(defaults).rounds);
    expect(needsBackup).toBe(true);
    expect(warnings.join(" ")).toMatch(/Original data.*recovery/);
  });
  it("does not silently redirect duplicate round IDs", () => {
    const data = {
      ...defaults,
      rounds: [defaults.rounds[0], { ...defaults.rounds[0], name: "Other" }],
    };
    const { scenario } = normalizeScenarioState(data, defaults);
    expect(
      calculateScenario(scenario).errors.some((e) => e.path === "rounds.1.id"),
    ).toBe(true);
  });
  it("avoids collisions between legacy generated and existing IDs", () => {
    const scenario = createScenarioState({
      ...defaults,
      founders: [
        { name: "A", shares: 1 },
        { id: "founder-1", name: "B", shares: 1 },
      ],
    });
    expect(new Set(scenario.founders.map((f) => f.id)).size).toBe(2);
  });
  it("safely rejects unknown newer versions", () => {
    const { scenario, warnings, needsBackup } = normalizeScenarioState(
      { ...defaults, schemaVersion: CURRENT_SCENARIO_VERSION + 1 },
      defaults,
    );
    expect(scenario).toEqual(createScenarioState(defaults));
    expect(warnings.join(" ")).toMatch(/newer schema/i);
    expect(needsBackup).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { calculateScenario } from "./dilutionEngine.js";
import {
  createScenarioState,
  normalizeScenarioState,
} from "./scenarioSchema.js";
import {
  POST_MONEY_CONVENTION,
  POST_MONEY_CALCULATION_VERSION,
} from "./safeConventions.js";
import {
  createWorkspace,
  changeWorkspace,
  replaceCaseInputs,
  compareCases,
  changedAssumptions,
} from "./comparisonWorkspace.js";
const fixture = () =>
  createScenarioState({
    founders: [{ id: "f", name: "Founder", shares: 10e6 }],
    employeeReserve: 0,
    employeesOnCapTablePreGrant: false,
    rounds: [
      {
        id: "seed",
        name: "Seed",
        investment: 5e6,
        preMoneyVal: 20e6,
        grantMode: "shares",
        grantValue: 0,
      },
    ],
    instruments: [
      {
        id: "s",
        holderName: "SAFE",
        investment: 1e6,
        valuationCap: 10e6,
        discountPct: 0,
      },
    ],
  });
const adopt = (input) => ({
  ...input,
  safeConvention: POST_MONEY_CONVENTION,
  calculationVersion: POST_MONEY_CALCULATION_VERSION,
  instruments: input.instruments.map((s) => ({
    ...s,
    variant: "post-money-cap",
  })),
});
describe("explicit SAFE convention integration", () => {
  it("migrates schema2 without changing one legacy economic result, and requires explicit post-money adoption", () => {
    const old = fixture();
    delete old.safeConvention;
    old.schemaVersion = 2;
    old.instruments.forEach((s) => delete s.variant);
    const before = calculateScenario(old);
    const loaded = normalizeScenarioState(old);
    const legacy = calculateScenario(loaded.scenario);
    expect(legacy.states).toEqual(before.states);
    expect(legacy.states[1]).toMatchObject({
      pricePerShare: 2,
      safeConversionShares: 1e6,
      newInvestorShares: 2.5e6,
      totalShares: 13.5e6,
      quotedPostMoney: 25e6,
      postMoney: 27e6,
    });
    expect(legacy.calculationVersion).toBe("pre-conversion-v2");
    expect(loaded.needsBackup).toBe(true);
    const current = calculateScenario(adopt(loaded.scenario));
    expect(current.errors).toEqual([]);
    expect(current.calculationVersion).toBe(POST_MONEY_CALCULATION_VERSION);
    expect(current.states[1].pricePerShare).toBeCloseTo(1.8, 12);
    expect(current.states[1].ownership["founder:f"]).toBeCloseTo(0.72, 12);
    expect(current.states[1].ownership["safe:s"]).toBeCloseTo(0.08, 12);
    expect(current.states[1].ownership["round:seed"]).toBeCloseTo(0.2, 12);
    expect(current.states[1].postMoney).toBeCloseTo(25e6, 6);
  });
  it("retains fractions through later rounds and transfers grants from an included reserve", () => {
    const input = adopt(fixture());
    input.employeeReserve = 1e6;
    input.employeesOnCapTablePreGrant = true;
    input.rounds[0].grantValue = 600000;
    input.rounds.push({
      ...input.rounds[0],
      id: "a",
      name: "A",
      preMoneyVal: 40e6,
      investment: 10e6,
      grantValue: 500000,
    });
    const result = calculateScenario(input);
    expect(result.errors).toEqual([]);
    expect(Number.isInteger(result.states[1].safeConversionShares)).toBe(false);
    for (const s of result.states)
      expect(Object.values(s.ownership).reduce((a, b) => a + b, 0)).toBeCloseTo(
        1,
        12,
      );
    expect(result.states[2].safeConversions).toEqual([]);
    expect(result.states[2].holderShares["employee:granted"]).toBe(1e6);
    expect(result.states[2].unfulfilledGrantShares).toBe(100000);
    expect(result.states[2].postMoney).toBeCloseTo(50e6, 6);
  });
  it("rejects unsupported mixed forms, pool treatment, rights, unknown model tags and delayed conversion", () => {
    const input = adopt(fixture());
    const paths = (s) => calculateScenario(s).errors.map((e) => e.path);
    expect(paths({ ...input, safeConvention: "unknown" })).toContain(
      "safeConvention",
    );
    expect(paths({ ...input, calculationVersion: "future" })).toContain(
      "calculationVersion",
    );
    expect(paths({ ...input, employeeReserve: 1e6 })).toContain(
      "employeeReserve",
    );
    expect(
      paths({
        ...input,
        instruments: [{ ...input.instruments[0], variant: "legacy-generic" }],
      }),
    ).toContain("instruments.0.variant");
    expect(
      paths({
        ...input,
        instruments: [{ ...input.instruments[0], mfn: true }],
      }),
    ).toContain("instruments.0.variant");
    input.rounds.push({ ...input.rounds[0], id: "later" });
    input.instruments[0].conversionRoundId = "later";
    expect(paths(input)).toContain("instruments.0.conversionRoundId");
    input.rounds.shift();
    expect(calculateScenario(input).errors).toEqual([]);
    input.rounds = [];
    expect(paths(input)).toContain("instruments.0.conversionRoundId");
  });
  it("handles zero-cash events without conversion, then converts the whole cohort in the first financing", () => {
    const input = adopt(fixture());
    input.rounds.unshift({
      ...input.rounds[0],
      id: "zero",
      name: "No cash",
      investment: 0,
    });
    const result = calculateScenario(input);
    expect(result.errors).toEqual([]);
    expect(result.states[1].safeConversions).toEqual([]);
    expect(result.states[2].safeConversions).toHaveLength(1);
    expect(result.states[2].ownership["safe:s"]).toBeCloseTo(0.08, 12);
  });
  it("shows convention differences even when every monetary input is equal", () => {
    let w = changeWorkspace(createWorkspace(fixture(), "base"), {
      type: "duplicate",
      id: "alt",
    });
    w = replaceCaseInputs(w, "alt", adopt(w.cases[1].scenario));
    const cases = compareCases(w);
    expect(cases[1].ownershipDeltaPp).not.toBe(0);
    expect(
      changedAssumptions(cases).some((r) => r.key === "safe-convention"),
    ).toBe(true);
    expect(
      changedAssumptions(cases).some((r) => r.key === "instruments:s:variant"),
    ).toBe(true);
  });
  it("retains unsupported timing/pool fields through serialization and blocks a plausible result", () => {
    for (const change of [
      (s) => {
        s.promisedOptions = 1000;
      },
      (s) => {
        s.poolTopUp = { targetPct: 10 };
      },
      (s) => {
        s.rounds[0].poolTopUp = { targetPct: 10 };
      },
      (s) => {
        s.instruments[0].issuanceAfterRoundId = "seed";
      },
    ]) {
      const input = adopt(fixture());
      change(input);
      const saved = createScenarioState(input);
      expect(calculateScenario(saved).errors.length).toBeGreaterThan(0);
      expect(calculateScenario(saved).states).toEqual([]);
    }
  });
  it("reconciles mixed cohorts and later round ownership independent of instrument order across deterministic cases", () => {
    for (let i = 1; i <= 40; i++) {
      const input = adopt(fixture());
      input.rounds[0].preMoneyVal = (5 + (i % 16)) * 1e6;
      input.rounds[0].investment = input.rounds[0].preMoneyVal / 4;
      input.instruments = [
        {
          id: "a",
          holderName: "Same",
          variant: "post-money-cap",
          investment: 200000,
          valuationCap: 5e6,
          discountPct: 0,
        },
        {
          id: "b",
          holderName: "Same",
          variant: "post-money-discount",
          investment: 100000,
          valuationCap: 0,
          discountPct: 20,
        },
        {
          id: "c",
          holderName: "Same",
          variant: "custom-post-money-cap-discount",
          investment: 150000,
          valuationCap: 8e6,
          discountPct: 15,
        },
      ];
      input.employeeReserve = i % 2 ? 1e6 : 0;
      input.employeesOnCapTablePreGrant = true;
      input.rounds[0].grantValue = 100000;
      input.rounds.push({
        ...input.rounds[0],
        id: "later",
        name: "Later",
        preMoneyVal: 40e6,
        investment: 10e6,
      });
      const original = calculateScenario(input);
      const reversed = calculateScenario({
        ...input,
        instruments: [...input.instruments].reverse(),
      });
      expect(original.errors).toEqual([]);
      expect(reversed.errors).toEqual([]);
      original.states.forEach((state, index) => {
        expect(
          Object.values(state.ownership).reduce((a, b) => a + b, 0),
        ).toBeCloseTo(1, 12);
        expect(reversed.states[index].holderShares).toEqual(state.holderShares);
        expect(reversed.states[index].totalShares).toBe(state.totalShares);
        if (index)
          expect(state.postMoney).toBeCloseTo(state.quotedPostMoney, 5);
      });
    }
  });
});

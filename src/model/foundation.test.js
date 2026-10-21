import { describe, expect, it } from "vitest";
import {
  calculateScenario,
  chartSnapshots,
  computeRounds,
  founderKey,
  roundKey,
  safeKey,
} from "./dilutionEngine.js";
import {
  createScenarioState,
  normalizeScenarioState,
} from "./scenarioSchema.js";

const fixture = () =>
  createScenarioState({
    founders: [
      { id: "a", name: "Alex", shares: 6_000_000 },
      { id: "b", name: "Alex", shares: 4_000_000 },
    ],
    employeeReserve: 0,
    employeesOnCapTablePreGrant: false,
    rounds: [
      {
        id: "seed",
        name: "Alex",
        preMoneyVal: 8_000_000,
        investment: 2_000_000,
        grantMode: "shares",
        grantValue: 0,
      },
      {
        id: "a-round",
        name: "Alex",
        preMoneyVal: 16_000_000,
        investment: 4_000_000,
        grantMode: "shares",
        grantValue: 0,
      },
    ],
    instruments: [],
  });

describe("foundation financial regressions", () => {
  it("namespaces stage IDs separately from editable imported round IDs", () => {
    const input = fixture();
    input.rounds[0].id = "pre-funding";
    const result = calculateScenario(input);
    expect(new Set(result.states.map((s) => s.stageId)).size).toBe(
      result.states.length,
    );
    expect(result.states[1].roundId).toBe("pre-funding");
  });
  it("keeps duplicate display names and cross-kind collisions economically separate", () => {
    const input = fixture();
    const { states, errors } = calculateScenario(input);
    expect(errors).toEqual([]);
    expect(states[1].ownership[founderKey(input.founders[0], 0)]).toBeCloseTo(
      0.48,
    );
    expect(states[2].ownership[founderKey(input.founders[1], 1)]).toBeCloseTo(
      0.256,
    );
    expect(states[2].ownership[roundKey(input.rounds[0], 0)]).toBeCloseTo(0.16);
    for (const state of states) {
      expect(
        Object.values(state.ownership).reduce((a, b) => a + b, 0),
      ).toBeCloseTo(1, 12);
      expect(Object.values(state.holderShares).reduce((a, b) => a + b, 0)).toBe(
        state.totalShares,
      );
    }
    input.founders[0].name = "Employees (Granted)";
    expect(calculateScenario(input).states.map((s) => s.ownership)).toEqual(
      states.map((s) => s.ownership),
    );
  });

  it.each([-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "blocks invalid founder shares %s",
    (bad) => {
      const input = fixture();
      input.founders[0].shares = bad;
      const result = calculateScenario(input);
      expect(result.errors.some((e) => e.path === "founders.0.shares")).toBe(
        true,
      );
      expect(result.states).toEqual([]);
    },
  );

  it("blocks zero capitalization, nonpositive valuations, and orphaned conversion rounds", () => {
    for (const mutate of [
      (s) =>
        s.founders.forEach((f) => {
          f.shares = 0;
        }),
      (s) => {
        s.rounds[0].preMoneyVal = 0;
      },
      (s) => {
        s.rounds[0].investment = -1;
      },
      (s) => {
        s.instruments = [
          {
            id: "s",
            type: "safe",
            holderName: "S",
            investment: 1,
            conversionRoundId: "deleted",
          },
        ];
      },
    ]) {
      const input = fixture();
      mutate(input);
      expect(calculateScenario(input).errors.length).toBeGreaterThan(0);
      expect(calculateScenario(input).states).toEqual([]);
      expect(() =>
        computeRounds(
          input.founders,
          input.rounds,
          input.employeeReserve,
          false,
          input.instruments,
        ),
      ).toThrow();
    }
  });

  it("reconciles the explicit pre-conversion SAFE pricing base and valuation bridge", () => {
    const input = fixture();
    input.rounds = [input.rounds[0]];
    input.instruments = [
      {
        id: "s",
        type: "safe",
        holderName: "Alex",
        investment: 500_000,
        valuationCap: 5_000_000,
        discountPct: 0,
      },
    ];
    const result = calculateScenario(input);
    const state = result.states[1];
    expect(result.errors).toEqual([]);
    expect(state.pricingShares).toBe(10_000_000);
    expect(state.pricePerShare).toBe(0.8);
    expect(state.safeConversions[0].conversionPrice).toBe(0.5);
    expect(state.ownership[safeKey(input.instruments[0], 0)]).toBeCloseTo(
      1_000_000 / 13_500_000,
    );
    expect(state.quotedPostMoney).toBe(10_000_000);
    expect(state.postMoney).toBe(10_800_000);
    expect(state.postMoney).toBe(state.pricePerShare * state.totalShares);
    expect(state.postMoney).toBe(
      state.preMoney +
        state.investment +
        state.conversionValue +
        state.grantValueAtRoundPrice +
        state.roundingAdjustment,
    );
  });

  it("reports overgrants as requested, available, applied, and unfulfilled", () => {
    const input = fixture();
    input.employeeReserve = 2_500_000;
    input.rounds[0].grantValue = 3_000_000;
    const result = calculateScenario(input);
    const state = result.states[1];
    expect(result.errors).toEqual([]);
    expect(state).toMatchObject({
      requestedGrantShares: 3_000_000,
      grantBudgetRemaining: 2_500_000,
      grantShares: 2_500_000,
      unfulfilledGrantShares: 500_000,
    });
    expect(result.warnings.join(" ")).toMatch(/500,000.*not granted/);
  });

  it("migrates old scenarios without merging duplicates or changing monetary inputs", () => {
    const old = fixture();
    delete old.schemaVersion;
    delete old.calculationVersion;
    old.founders.forEach((f) => {
      delete f.id;
    });
    old.rounds[0].preMoneyVal = 8_550_000;
    const migrated = normalizeScenarioState(old);
    expect(migrated.scenario.founders).toHaveLength(2);
    expect(new Set(migrated.scenario.founders.map((f) => f.id)).size).toBe(2);
    expect(migrated.scenario.rounds[0].preMoneyVal).toBe(8_550_000);
    expect(migrated.warnings.join(" ")).toMatch(/recalculat/i);
    expect(normalizeScenarioState(migrated.scenario).scenario).toEqual(
      migrated.scenario,
    );
  });

  it("keeps identities and selected SAFE references when labels and round order change", () => {
    const input = fixture();
    input.instruments = [
      {
        id: "s",
        type: "safe",
        holderName: "Alex",
        investment: 500_000,
        conversionRoundId: "seed",
      },
    ];
    const renamed = structuredClone(input);
    renamed.rounds[0].name = "Renamed";
    renamed.founders[0].name = "Renamed";
    expect(calculateScenario(renamed).states.map((s) => s.ownership)).toEqual(
      calculateScenario(input).states.map((s) => s.ownership),
    );
    input.rounds.reverse();
    const states = calculateScenario(input).states;
    expect(states[1].safeConversions).toEqual([]);
    expect(states[2].safeConversions[0].conversionRoundId).toBe("seed");
  });

  it("does not convert SAFEs in a zero-cash event and gives every chart stage explicit zero history", () => {
    const input = fixture();
    input.rounds[0].investment = 0;
    input.instruments = [{ id: "s", holderName: "Alex", investment: 500_000 }];
    const result = calculateScenario(input);
    expect(result.states[1].safeConversions).toEqual([]);
    expect(result.states[2].safeConversions).toHaveLength(1);
    const chart = chartSnapshots(result);
    expect(chart[0][safeKey(input.instruments[0], 0)]).toBe(0);
    expect(chart.at(-1)[roundKey(input.rounds[1], 1)]).toBeGreaterThan(0);
    for (const point of chart)
      expect(
        result.holders.reduce((sum, h) => sum + point[h.key], 0),
      ).toBeCloseTo(100, 10);
  });

  it("blocks computed overflow and positive investments too small for one share", () => {
    const input = fixture();
    input.rounds[0].preMoneyVal = 1e-100;
    expect(calculateScenario(input).states).toEqual([]);
    input.rounds[0].preMoneyVal = 1e12;
    input.rounds[0].investment = 1;
    expect(calculateScenario(input).errors[0].message).toMatch(/too small/);
    expect(
      calculateScenario({ founders: [null] }).errors.length,
    ).toBeGreaterThan(0);
  });

  it("preserves share and valuation invariants across deterministic mixed financing cases", () => {
    let seed = 71;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let n = 0; n < 80; n++) {
      const input = fixture();
      input.employeesOnCapTablePreGrant = n % 2 === 0;
      input.employeeReserve = 1_000_000;
      input.founders.forEach((f) => {
        f.shares += Math.floor(random() * 1_000_000);
      });
      input.rounds.forEach((r) => {
        r.preMoneyVal = 5_000_000 + Math.floor(random() * 30_000_000);
        r.investment = 500_000 + Math.floor(random() * 5_000_000);
        r.grantValue = Math.floor(random() * 1_000_000);
      });
      input.instruments = [
        {
          id: "s",
          holderName: "Alex",
          investment: 500_000,
          valuationCap: 5_000_000,
          discountPct: n % 30,
        },
      ];
      const result = calculateScenario(input);
      expect(result.errors).toEqual([]);
      for (const state of result.states) {
        expect(
          Object.values(state.holderShares).reduce((a, b) => a + b, 0),
        ).toBe(state.totalShares);
        expect(
          Object.values(state.ownership).reduce((a, b) => a + b, 0),
        ).toBeCloseTo(1, 12);
        input.founders.forEach((f, i) =>
          expect(state.holderShares[founderKey(f, i)]).toBe(f.shares),
        );
        if (state.roundIdx >= 0) {
          expect(state.postMoney).toBe(state.pricePerShare * state.totalShares);
          expect(
            Math.abs(
              state.newInvestorShares * state.pricePerShare - state.investment,
            ),
          ).toBeLessThanOrEqual(state.pricePerShare / 2 + 1e-8);
          expect(
            state.pricingShares +
              state.safeConversionShares +
              state.newInvestorShares +
              (input.employeesOnCapTablePreGrant ? 0 : state.grantShares),
          ).toBe(state.totalShares);
        }
      }
    }
  });
});

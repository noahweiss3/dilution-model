import { describe, expect, it } from "vitest";
import { pricePostMoneyCohort } from "./postMoneySafe.js";

const cap = (id, investment, valuationCap) => ({
  id,
  holderName: id,
  investment,
  valuationCap,
  discountPct: 0,
  variant: "post-money-cap",
});
const discount = (id, investment, discountPct) => ({
  id,
  holderName: id,
  investment,
  valuationCap: 0,
  discountPct,
  variant: "post-money-discount",
});
const combined = (id, investment, valuationCap, discountPct) => ({
  ...cap(id, investment, valuationCap),
  discountPct,
  variant: "custom-post-money-cap-discount",
});

describe("post-money SAFE reference cohort (independent rational fixtures)", () => {
  it.each([
    [9e6, 20e6, 5e6, [cap("a", 1e6, 10e6)], 10e6, 2, [1e6], 2.5e6],
    [
      8.5e6,
      20e6,
      5e6,
      [cap("a", 0.2e6, 4e6), cap("b", 0.8e6, 8e6)],
      10e6,
      2,
      [0.5e6, 1e6],
      2.5e6,
    ],
    [9e6, 20e6, 5e6, [discount("a", 1.6e6, 20)], 10e6, 2, [1e6], 2.5e6],
    [
      7e6,
      20e6,
      5e6,
      [cap("a", 1e6, 10e6), cap("b", 1.6e6, 16e6), discount("c", 1.6e6, 20)],
      10e6,
      2,
      [1e6, 1e6, 1e6],
      2.5e6,
    ],
    [7e6, 8e6, 2e6, [cap("a", 1e6, 10e6)], 8e6, 1, [1e6], 2e6],
    [
      4.3e6,
      6e6,
      1.5e6,
      [combined("a", 0.5e6, 5e6, 20)],
      4.8e6,
      1.25,
      [0.5e6],
      1.2e6,
    ],
    [
      4.5e6,
      6.25e6,
      1.5625e6,
      [combined("a", 0.5e6, 5e6, 20)],
      5e6,
      1.25,
      [0.5e6],
      1.25e6,
    ],
    [
      4.5e6,
      8e6,
      2e6,
      [combined("a", 0.5e6, 5e6, 20)],
      5e6,
      1.6,
      [0.5e6],
      1.25e6,
    ],
  ])(
    "B=%s V=%s M=%s reconciles the joint conversion",
    (
      existingShares,
      preMoney,
      investment,
      instruments,
      denominator,
      price,
      shares,
      newShares,
    ) => {
      const result = pricePostMoneyCohort({
        existingShares,
        preMoney,
        investment,
        instruments,
      });
      expect(result.companyCapitalization).toBeCloseTo(denominator, 6);
      expect(result.pricePerShare).toBeCloseTo(price, 12);
      expect(result.newInvestorShares).toBeCloseTo(newShares, 6);
      result.conversions.forEach((c, i) =>
        expect(c.shares).toBeCloseTo(shares[i], 6),
      );
      expect(
        existingShares + result.conversions.reduce((s, c) => s + c.shares, 0),
      ).toBeCloseTo(result.companyCapitalization, 6);
      expect(
        result.pricePerShare *
          (result.companyCapitalization + result.newInvestorShares),
      ).toBeCloseTo(preMoney + investment, 6);
    },
  );
  it("matches the YC guide's 5% + 10% cohort before its separate pool increase", () => {
    const result = pricePostMoneyCohort({
      existingShares: 10e6,
      preMoney: 15e6,
      investment: 5e6,
      instruments: [cap("a", 0.2e6, 4e6), cap("b", 0.8e6, 8e6)],
    });
    expect(result.companyCapitalization).toBeCloseTo(10e6 / 0.85, 6);
    expect(
      result.conversions[0].shares / result.companyCapitalization,
    ).toBeCloseTo(0.05, 12);
    expect(
      result.conversions[1].shares / result.companyCapitalization,
    ).toBeCloseTo(0.1, 12);
    expect(Number.isInteger(result.conversions[0].shares)).toBe(false);
  });
  it("records round/cap/discount candidates and deterministic ties", () => {
    const solve = (preMoney, existingShares = 4.5e6) =>
      pricePostMoneyCohort({
        existingShares,
        preMoney,
        investment: preMoney / 4,
        instruments: [combined("a", 0.5e6, 5e6, 20)],
      }).conversions[0];
    expect(solve(6e6, 4.3e6).rule).toBe("Discounted round price");
    expect(solve(6.25e6).rule).toBe(
      "Valuation cap / post-money capitalization",
    );
    expect(solve(8e6).rule).toBe("Valuation cap / post-money capitalization");
    expect(solve(6.25e6).candidates).toHaveLength(3);
    const fallback = pricePostMoneyCohort({
      existingShares: 7e6,
      preMoney: 8e6,
      investment: 2e6,
      instruments: [cap("a", 1e6, 10e6)],
    }).conversions[0];
    expect(fallback.rule).toBe("Round price");
  });
  it("is invariant by instrument identity under every cohort permutation", () => {
    const items = [
      cap("a", 1e6, 10e6),
      cap("b", 1.6e6, 16e6),
      discount("c", 1.6e6, 20),
    ];
    const permutations = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ];
    for (const order of permutations) {
      const result = pricePostMoneyCohort({
        existingShares: 7e6,
        preMoney: 20e6,
        investment: 5e6,
        instruments: order.map((i) => items[i]),
      });
      expect(result.companyCapitalization).toBeCloseTo(10e6, 6);
      result.conversions.forEach((c) => expect(c.shares).toBeCloseTo(1e6, 6));
    }
  });
  it("rejects impossible ownership, overflow, unsupported variants, and malformed terms", () => {
    const solve = (instruments, overrides = {}) =>
      pricePostMoneyCohort({
        existingShares: 10e6,
        preMoney: 20e6,
        investment: 5e6,
        instruments,
        ...overrides,
      });
    expect(() => solve([cap("a", 10e6, 10e6)])).toThrow(/100%/);
    expect(() => solve([cap("a", 11e6, 10e6)])).toThrow(/100%/);
    expect(() =>
      solve([cap("a", 1e6, 10e6)], { existingShares: Number.MAX_SAFE_INTEGER }),
    ).toThrow(/range/);
    expect(() => solve([{ ...cap("a", 1e6, 10e6), variant: "mfn" }])).toThrow(
      /supported/,
    );
    expect(() => solve([discount("a", 1e6, 100)])).toThrow(/discount/i);
    expect(() => solve([cap("a", 1e6, 0)])).toThrow(/cap/);
    expect(() => solve([cap("a", NaN, 10e6)])).toThrow(/finite/);
    expect(() => solve([cap("a", Number.MIN_VALUE, 1e-320)])).toThrow(
      /too small/,
    );
  });
});

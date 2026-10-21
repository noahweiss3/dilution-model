import { describe, expect, it } from "vitest";
import {
  allocateShares,
  equalizeFounderShares,
  redistributeFounderPercent,
  scaleFounderShares,
} from "./founderAllocation.js";
describe("founder share allocation", () => {
  it("preserves exact totals without negative residuals when scaling a small cap table", () => {
    expect(allocateShares(3, [1, 1, 1, 1, 1])).toEqual([1, 1, 1, 0, 0]);
    expect(
      allocateShares(Number.MAX_SAFE_INTEGER, [1, 2, 3]).reduce(
        (a, b) => a + b,
        0,
      ),
    ).toBe(Number.MAX_SAFE_INTEGER);
  });
  it("preserves identities and total shares through scaling, equalizing, and split changes", () => {
    const founders = [
      { id: "a", shares: 5 },
      { id: "b", shares: 4 },
      { id: "c", shares: 2 },
    ];
    expect(scaleFounderShares(founders, 3).map((f) => f.shares)).toEqual([
      1, 1, 1,
    ]);
    expect(equalizeFounderShares(founders).map((f) => f.shares)).toEqual([
      4, 4, 3,
    ]);
    for (const pct of [0, 1, 50, 99, 100]) {
      const changed = redistributeFounderPercent(founders, 0, pct);
      expect(changed.map((f) => f.id)).toEqual(["a", "b", "c"]);
      expect(changed.reduce((sum, f) => sum + f.shares, 0)).toBe(11);
      expect(changed.every((f) => f.shares >= 0)).toBe(true);
    }
    expect(() => redistributeFounderPercent(founders, 0, 101)).toThrow(
      /between 0 and 100/,
    );
  });
});

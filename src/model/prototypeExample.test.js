import { describe, expect, it } from "vitest";
import { calculateExample } from "./prototypeExample";

describe("illustrative prototype example", () => {
  it("keeps all allocation rows reconciled for both stages and input extremes", () => {
    for (const [raise, valuation] of [
      [4, 16],
      [3, 18],
      [0.1, 500],
      [100, 0.1],
    ]) {
      for (const stage of ["seed", "a"]) {
        const example = calculateExample(raise, valuation, stage);
        expect(
          example.holders.reduce((sum, row) => sum + row.after, 0),
        ).toBeCloseTo(100, 10);
        expect(example.founderValue).toBeCloseTo(
          (example.postMoney * example.founders) / 100,
        );
      }
    }
  });
  it("uses a consistent hypothetical cap table across directions", () => {
    expect(calculateExample().founders).toBeCloseTo(64.8);
    expect(calculateExample().founderValue).toBeCloseTo(12.96);
    expect(calculateExample(4, 16, "a").founders).toBeCloseTo(51.84);
    expect(calculateExample(4, 16, "a").founderValue).toBeCloseTo(25.92);
  });
  it("rejects invalid or unsupported inputs", () => {
    for (const value of [0, -1, NaN, Infinity, 101])
      expect(() => calculateExample(value, 16)).toThrow(RangeError);
    expect(() => calculateExample(4, 501)).toThrow(RangeError);
  });
});

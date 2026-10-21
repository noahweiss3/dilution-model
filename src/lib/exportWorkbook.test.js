import { describe, expect, it } from "vitest";
import { buildWorkbook } from "./exportWorkbook.js";
import { calculateScenario, founderKey } from "../model/dilutionEngine.js";
import { createScenarioState } from "../model/scenarioSchema.js";
const fixture = () =>
  createScenarioState({
    founders: [
      { name: "Alex", shares: 6_000_000 },
      { name: "Alex", shares: 4_000_000 },
    ],
    employeeReserve: 2_500_000,
    employeesOnCapTablePreGrant: false,
    rounds: [
      {
        id: "seed",
        name: "Seed",
        preMoneyVal: 8_550_000,
        investment: 2_125_000,
        unit: "M",
        grantMode: "shares",
        grantValue: 3_000_000,
      },
    ],
    instruments: [
      {
        id: "safe",
        holderName: "Alex",
        investment: 500_000,
        valuationCap: 5_000_000,
        discountPct: 0,
      },
    ],
  });
const rows = (ws) => {
  const result = [];
  ws.eachRow((row) => result.push(row.values.slice(1)));
  return result;
};

describe("canonical workbook", () => {
  it("exports the actual post-money version, fractions, and bridge without adding converted value twice", async () => {
    const input = fixture();
    input.safeConvention = "yc-post-money";
    input.calculationVersion = "yc-post-money-v1";
    input.employeeReserve = 0;
    input.rounds[0].preMoneyVal = 20e6;
    input.rounds[0].investment = 5e6;
    input.rounds[0].grantValue = 0;
    input.instruments[0] = {
      ...input.instruments[0],
      variant: "post-money-cap",
      investment: 1e6,
      valuationCap: 10e6,
    };
    const result = calculateScenario(input);
    const wb = await buildWorkbook(input);
    expect(
      rows(wb.getWorksheet("Assumptions")).find(
        (r) => r[0] === "Calculation convention",
      )[1],
    ).toBe("yc-post-money-v1");
    expect(wb.getWorksheet("Cap Table").getRow(2).getCell(3).numFmt).toBe(
      "#,##0.000000",
    );
    expect(wb.getWorksheet("Chart Data").getRow(2).getCell(4).numFmt).toBe(
      "#,##0.000000",
    );
    const bridge = wb.getWorksheet("Round Bridge").getRow(2).values.slice(1);
    expect(bridge[1]).toBe(10e6);
    expect(bridge[1] + bridge[2] + bridge[3] + bridge[4]).toBeCloseTo(
      bridge[5],
      6,
    );
    expect(bridge[8]).toBe(0);
    expect(bridge[7] + bridge[8] + bridge[9] + bridge[10]).toBeCloseTo(
      bridge[11],
      6,
    );
    expect(bridge[11]).toBeCloseTo(25e6, 6);
    expect(bridge[12]).toBeCloseTo(result.states[1].pricingShares, 6);
    expect(bridge[14]).toBeCloseTo(result.states[1].conversionValue, 6);
    expect(bridge[15]).toBe("yc-post-money-v1");
    const bytes = await wb.xlsx.writeBuffer();
    expect(new Uint8Array(bytes)[0]).toBe(0x50);
  });
  it("exports assumptions, cap table, zero-filled chart data, honestly named values, and bridges", async () => {
    const input = fixture();
    const result = calculateScenario(input);
    const wb = await buildWorkbook(input);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Assumptions",
      "Cap Table",
      "Chart Data",
      "Financing Values",
      "Round Bridge",
    ]);
    const grant = rows(wb.getWorksheet("Assumptions")).find((r) => r[0] === 1);
    expect(grant.slice(2, 4)).toEqual([8_550_000, 2_125_000]);
    expect(grant.slice(7, 11)).toEqual([
      2_500_000, 3_000_000, 2_500_000, 500_000,
    ]);
    const cap = rows(wb.getWorksheet("Cap Table"));
    const founders = cap.filter(
      (r) => typeof r.at(-1) === "string" && r.at(-1).startsWith("founder:"),
    );
    expect(founders).toHaveLength(2);
    expect(founders.map((r) => r[2])).toEqual([6_000_000, 4_000_000]);
    expect(founders.map((r) => r[5])).toEqual([6_000_000, 4_000_000]);
    expect(founders[0][6]).toBe(
      result.states[1].holderShares[founderKey(input.founders[0], 0)] *
        result.states[1].pricePerShare,
    );
    expect(
      rows(wb.getWorksheet("Chart Data")).some(
        (r) => r[0] === "Pre-Funding" && r[1] === "Seed" && r[2] === 0,
      ),
    ).toBe(true);
    const bridge = wb.getWorksheet("Round Bridge").getRow(2).values.slice(1);
    expect(bridge[11]).toBe(result.states[1].postMoney);
    expect(bridge[1] + bridge[2] + bridge[3] + bridge[4]).toBe(bridge[5]);
    expect(wb.getWorksheet("Cap Table").getRow(2).getCell(2).numFmt).toBe(
      "0.00%",
    );
    expect(wb.getWorksheet("Chart Data").getRow(2).getCell(4).numFmt).toBe(
      "#,##0",
    );
    const buf = await wb.xlsx.writeBuffer();
    expect([...new Uint8Array(buf.slice(0, 2))]).toEqual([0x50, 0x4b]);
  });
  it("refuses invalid input even if a caller supplies stale valid results", async () => {
    const input = fixture();
    const valid = calculateScenario(input);
    input.rounds[0].preMoneyVal = 0;
    await expect(
      buildWorkbook({
        ...input,
        states: valid.states,
        allKeys: valid.holders.map((h) => h.key),
      }),
    ).rejects.toThrow(/invalid scenario/);
  });
  it("uses calculated grant budget across multiple rounds", async () => {
    const input = fixture();
    input.rounds[0].grantValue = 2_000_000;
    input.rounds.push({
      ...input.rounds[0],
      id: "a",
      name: "A",
      grantValue: 1_000_000,
    });
    const wb = await buildWorkbook(input);
    expect(
      rows(wb.getWorksheet("Assumptions"))
        .find((r) => r[0] === 2)
        .slice(7, 11),
    ).toEqual([500_000, 1_000_000, 500_000, 500_000]);
  });
});

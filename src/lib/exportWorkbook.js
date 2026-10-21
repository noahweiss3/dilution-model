// Lazy-loaded by the app; ExcelJS stays out of the initial bundle.
import ExcelJS from "exceljs";
import { calculateScenario, founderKey } from "../model/dilutionEngine.js";
import { CURRENT_SCENARIO_VERSION } from "../model/scenarioSchema.js";
import {
  conventionOf,
  conventionLabel,
  POST_MONEY_CONVENTION,
  variantLabel,
} from "../model/safeConventions.js";

export async function buildWorkbook(input) {
  const result = calculateScenario(input);
  if (result.errors.length)
    throw new Error(
      `Cannot export an invalid scenario: ${result.errors.map((e) => e.message).join(" ")}`,
    );
  const {
    founders,
    rounds,
    instruments = [],
    employeeReserve,
    employeesOnCapTablePreGrant,
  } = input;
  const { states, holders } = result;
  const postMoneyReference = conventionOf(input) === POST_MONEY_CONVENTION;
  const shareFormat = postMoneyReference ? "#,##0.000000" : "#,##0";
  const wb = new ExcelJS.Workbook();
  const assumptions = wb.addWorksheet("Assumptions");
  const founderTotal = founders.reduce((sum, f) => sum + f.shares, 0);
  assumptions.addRows([
    ["DILUTION MODEL — ASSUMPTIONS"],
    [`Exported: ${new Date().toISOString()}`],
    ["Scenario schema", CURRENT_SCENARIO_VERSION],
    ["Calculation convention", result.calculationVersion],
    [
      postMoneyReference
        ? "Post-money reference: financing pre-money INCLUDES all SAFE conversions; existing fully diluted pool included, no financing pool increase. All SAFEs outstanding before the first priced round."
        : "Legacy simplified SAFE: cap and round prices use shares BEFORE conversions and new grants. Not a contractual pre-money or YC post-money SAFE.",
    ],
    [
      "Capitalization at round price = price × ending shares. Conversion/grant marked value is not new cash.",
    ],
    [
      postMoneyReference
        ? "Calculated shares retain theoretical fractions. Actual issuance rounding is not modeled. Conversion marked value is already included in pre-money, not added to the capitalization bridge."
        : "Whole-share issuance is rounded to nearest share; the bridge discloses its monetary adjustment.",
    ],
    ["INITIAL CAP TABLE"],
    ["Founder", "Shares", "% of Founders", "Holder ID"],
    ...founders.map((f, i) => [
      f.name,
      f.shares,
      f.shares / founderTotal,
      founderKey(f, i),
    ]),
    ["TOTAL FOUNDER SHARES", founderTotal, 1],
    [],
    ["EMPLOYEE RESERVE"],
    ["Reserved Shares", employeeReserve],
    [
      "Reserve on cap table before grants?",
      employeesOnCapTablePreGrant ? "Yes" : "No",
    ],
    [],
    ["FUNDING ROUNDS"],
    [
      "#",
      "Round Name",
      "Pre-Money Val ($)",
      "New Cash ($)",
      "Display Unit",
      "Grant Mode",
      "Grant Value",
      "Grant Shares Resolved",
      "Grant Shares Requested",
      "Available Shares",
      "Unfulfilled Shares",
      "Round ID",
    ],
    ...rounds.map((r, i) => {
      const s = states[i + 1];
      return [
        i + 1,
        r.name,
        r.preMoneyVal,
        r.investment,
        r.unit || "M",
        r.grantMode || "shares",
        r.grantValue || 0,
        s.grantShares,
        s.requestedGrantShares,
        s.grantBudgetRemaining,
        s.unfulfilledGrantShares,
        s.roundId,
      ];
    }),
    [],
    ["SAFE REFERENCES", conventionLabel(input)],
    [
      "Holder",
      "Investment ($)",
      "Valuation Cap ($)",
      "Discount %",
      "Conversion Round",
      "MFN (not modeled)",
      "Pro Rata (not modeled)",
      "Instrument ID",
      "SAFE Form",
    ],
    ...(instruments.length
      ? instruments.map((s) => [
          s.holderName,
          s.investment,
          s.valuationCap || "",
          s.discountPct || 0,
          s.conversionRoundId == null || s.conversionRoundId === ""
            ? "First positive-investment round"
            : rounds.find((r) => String(r.id) === String(s.conversionRoundId))
                ?.name,
          s.mfn ? "Yes" : "No",
          s.proRata ? "Yes" : "No",
          String(s.id),
          variantLabel(s.variant),
        ])
      : [["None"]]),
    [],
    ["MODEL NOTICES"],
    ...result.warnings.map((w) => [w]),
    ["SAFE model source", "https://www.ycombinator.com/safe"],
  ]);
  assumptions.columns.forEach((c) => {
    c.width = 24;
  });
  assumptions.getColumn(1).width = 44;

  const table = wb.addWorksheet("Cap Table");
  table.addRow([
    "Stakeholder",
    ...states.flatMap((s) => [
      `${s.label} — %`,
      `${s.label} — Shares`,
      `${s.label} — Value at round price ($)`,
    ]),
    "Holder ID",
  ]);
  holders.forEach((h) =>
    table.addRow([
      h.displayName,
      ...states.flatMap((s) => [
        s.ownership[h.key] || 0,
        s.holderShares[h.key] || 0,
        s.pricePerShare == null
          ? ""
          : (s.holderShares[h.key] || 0) * s.pricePerShare,
      ]),
      h.key,
    ]),
  );
  table.addRow([
    "TOTAL",
    ...states.flatMap((s) => [
      Object.values(s.ownership).reduce((a, b) => a + b, 0),
      s.totalShares,
      s.postMoney ?? "",
    ]),
  ]);
  for (let r = 2; r <= table.rowCount; r++) {
    for (let c = 2; c <= 1 + states.length * 3; c++)
      table.getRow(r).getCell(c).numFmt = ["0.00%", shareFormat, '"$"#,##0.00'][
        (c - 2) % 3
      ];
  }
  table.columns.forEach((c) => {
    c.width = 22;
  });
  table.getColumn(1).width = 32;

  const chart = wb.addWorksheet("Chart Data");
  chart.addRow([
    "Round",
    "Stakeholder",
    "% Ownership",
    "Shares",
    "Holder ID",
    "Stage ID",
  ]);
  states.forEach((s) =>
    holders.forEach((h) =>
      chart.addRow([
        s.label,
        h.displayName,
        s.ownership[h.key] || 0,
        s.holderShares[h.key] || 0,
        h.key,
        s.stageId,
      ]),
    ),
  );
  for (let r = 2; r <= chart.rowCount; r++) {
    chart.getRow(r).getCell(3).numFmt = "0.00%";
    chart.getRow(r).getCell(4).numFmt = shareFormat;
  }
  chart.columns.forEach((c) => {
    c.width = 26;
  });

  const financing = wb.addWorksheet("Financing Values");
  financing.addRow([
    "Round",
    "Pricing Pre-Money ($)",
    "New Cash ($)",
    "Capitalization at Round Price ($)",
    ...founders.map((f) => `${f.name} value at round price ($)`),
  ]);
  states
    .slice(1)
    .forEach((s) =>
      financing.addRow([
        s.label,
        s.preMoney,
        s.investment,
        s.postMoney,
        ...founders.map(
          (f, i) => (s.holderShares[founderKey(f, i)] || 0) * s.pricePerShare,
        ),
      ]),
    );
  for (let r = 2; r <= financing.rowCount; r++)
    financing.getRow(r).eachCell((c, i) => {
      if (i > 1) c.numFmt = '"$"#,##0.00';
    });
  financing.columns.forEach((c) => {
    c.width = 26;
  });

  const bridge = wb.addWorksheet("Round Bridge");
  bridge.addRow([
    "Round",
    "Starting Shares Before Conversions",
    "SAFE Shares",
    "New Grant Shares",
    "New Investor Shares",
    "Ending Shares",
    "Price / Share ($)",
    "Quoted Pre + Cash ($)",
    "SAFE Value Added to Bridge ($)",
    "Grant Marked Value ($)",
    "Rounding Adjustment ($)",
    "Capitalization at Round Price ($)",
    "Pricing Denominator Shares",
    "SAFE Company Capitalization",
    "SAFE Marked Value ($)",
    "Calculation Version",
  ]);
  states
    .slice(1)
    .forEach((s) =>
      bridge.addRow([
        s.label,
        s.preConversionShares ?? s.pricingShares,
        s.safeConversionShares,
        employeesOnCapTablePreGrant ? 0 : s.grantShares,
        s.newInvestorShares,
        s.totalShares,
        s.pricePerShare,
        s.quotedPostMoney,
        postMoneyReference ? 0 : s.conversionValue,
        s.grantValueAtRoundPrice,
        s.roundingAdjustment,
        s.postMoney,
        s.pricingShares,
        s.safeCompanyCapitalization ?? "",
        s.conversionValue,
        result.calculationVersion,
      ]),
    );
  bridge.addRow([]);
  for (let r = 2; r <= states.length; r++)
    for (const c of [2, 3, 4, 5, 6, 13, 14])
      bridge.getRow(r).getCell(c).numFmt = shareFormat;
  bridge.addRow([
    "Conversion Round",
    "Holder",
    "Instrument ID",
    "Winning Rule",
    "Conversion Price ($)",
    "Shares",
    "Round Price ($)",
    "Cap Price ($)",
    "Discount Price ($)",
    "SAFE Form",
  ]);
  states.forEach((s) =>
    (s.safeConversions || []).forEach((c) =>
      bridge.addRow([
        s.label,
        c.holderName,
        c.id,
        c.rule,
        c.conversionPrice,
        c.shares,
        c.candidates[0].price,
        c.candidates.find((p) => p.rule.startsWith("Valuation"))?.price ?? "",
        c.candidates.find((p) => p.rule.startsWith("Discount"))?.price ?? "",
        variantLabel(c.variant),
      ]),
    ),
  );
  bridge.columns.forEach((c) => {
    c.width = 28;
  });
  for (const ws of wb.worksheets) {
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.getRow(1).font = { bold: true };
  }
  return wb;
}

export async function exportWorkbook(args, filename) {
  const wb = await buildWorkbook(args);
  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

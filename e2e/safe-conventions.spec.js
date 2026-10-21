const { test, expect } = require("@playwright/test");
const legacy = () => ({
  schemaVersion: 2,
  calculationVersion: "pre-conversion-v2",
  founders: [{ id: "f", name: "Founder", shares: 10_000_000 }],
  employeeReserve: 0,
  employeesOnCapTablePreGrant: false,
  rounds: [
    {
      id: "seed",
      name: "Seed",
      investment: 5_000_000,
      preMoneyVal: 20_000_000,
      unit: "M",
      grantMode: "shares",
      grantValue: 0,
    },
  ],
  instruments: [
    {
      id: "safe",
      type: "safe",
      holderName: "Early investor",
      investment: 1_000_000,
      valuationCap: 10_000_000,
      discountPct: 0,
    },
  ],
});
const button = (p, name) => p.getByRole("button", { name, exact: true });
async function start(page, input = legacy()) {
  await page.addInitScript((data) => {
    if (!localStorage.getItem("dilution-model:current"))
      localStorage.setItem("dilution-model:current", JSON.stringify(data));
  }, input);
  await page.goto("/");
}
async function edit(page, label, value) {
  const field = page.getByLabel(label, { exact: true });
  await field.focus();
  await field.fill(String(value));
  await field.blur();
}
async function adopt(page) {
  await page
    .getByLabel("SAFE calculation convention", { exact: true })
    .selectOption("yc-post-money");
  await page
    .getByLabel("SAFE 1 form", { exact: true })
    .selectOption("post-money-cap");
}

test("preserves legacy economics, compares explicit post-money adoption, reloads and exports", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await start(page);
  await button(page, "Duplicate active case").click();
  await adopt(page);
  const comparison = page.getByRole("region", {
    name: "Comparison outcomes",
    exact: true,
  });
  await expect(
    comparison.getByRole("row", {
      name: /All founders · final ownership 74.074% 72.000%/,
    }),
  ).toBeVisible();
  await expect(
    comparison.getByRole("row", {
      name: /Founder ownership vs baseline 0.000 pp -2.074 pp/,
    }),
  ).toBeVisible();
  await expect(
    comparison.getByRole("row", { name: /SAFE convention \/ version/ }),
  ).toContainText("pre-conversion-v2");
  await expect(
    comparison.getByRole("row", { name: /SAFE convention \/ version/ }),
  ).toContainText("yc-post-money-v1");
  await expect(
    page
      .getByRole("region", { name: "Changed assumptions", exact: true })
      .getByRole("row", { name: /SAFE calculation convention/ }),
  ).toBeVisible();
  await expect(page.getByText(/Inputs are identical/)).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByLabel("SAFE calculation convention", { exact: true }),
  ).toHaveValue("yc-post-money");
  await expect(page.getByLabel("SAFE 1 form", { exact: true })).toHaveValue(
    "post-money-cap",
  );
  await button(page, "Cap table").click();
  const results = page.getByRole("region", { name: "Results", exact: true });
  await expect(
    results.getByRole("row", { name: /Early investor 0.00% 8.00%/ }),
  ).toBeVisible();
  await page
    .getByText("Calculation convention and round bridges", { exact: true })
    .click();
  await expect(
    page.getByText(/conversion marked value is already within pre-money/),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await button(page, "Export .xlsx").click();
  const file = await download;
  expect(await file.failure()).toBeNull();
  expect(file.suggestedFilename()).toContain("Alternative-1");
  await button(page, "Baseline · Baseline").click();
  await expect(
    page.getByLabel("SAFE calculation convention", { exact: true }),
  ).toHaveValue("legacy-pre-conversion");
  const raw = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dilution-model:comparison")),
  );
  expect(raw.cases[0].scenario.calculationVersion).toBe("pre-conversion-v2");
});

test("requires pool inclusion and explicit supported form terms, with historical custom labeling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  const input = legacy();
  input.employeeReserve = 1_000_000;
  await start(page, input);
  await adopt(page);
  await expect(button(page, "Export .xlsx")).toBeDisabled();
  await expect(
    page
      .getByText(/post-money reference requires the existing reserve/)
      .first(),
  ).toBeVisible();
  await page
    .getByLabel("Include unallocated reserve before financing", { exact: true })
    .check();
  await expect(button(page, "Export .xlsx")).toBeEnabled();
  await page
    .getByLabel("SAFE 1 form", { exact: true })
    .selectOption("post-money-discount");
  await expect(button(page, "Export .xlsx")).toBeDisabled();
  await edit(page, "SAFE 1 valuation cap ($)", 0);
  await edit(page, "SAFE 1 discount (%)", 20);
  await expect(button(page, "Export .xlsx")).toBeEnabled();
  await edit(page, "SAFE 1 discount (%)", 100);
  await expect(button(page, "Export .xlsx")).toBeDisabled();
  await edit(page, "SAFE 1 discount (%)", 20);
  await page
    .getByLabel("SAFE 1 form", { exact: true })
    .selectOption("custom-post-money-cap-discount");
  await edit(page, "SAFE 1 valuation cap ($)", 5_000_000);
  await expect(button(page, "Export .xlsx")).toBeEnabled();
  await page
    .getByText("Supported post-money reference assumptions", { exact: true })
    .click();
  await expect(page.getByText(/not a current YC standard form/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});

test("rejects later conversion and preserves a removed target until explicitly reassigned", async ({
  page,
}) => {
  const input = legacy();
  input.rounds.push({ ...input.rounds[0], id: "a", name: "A" });
  input.instruments[0].conversionRoundId = "a";
  await start(page, input);
  await adopt(page);
  await expect(button(page, "Export .xlsx")).toBeDisabled();
  await expect(
    page.getByText(/Later issuance timing is unsupported/).first(),
  ).toBeVisible();
  await page
    .getByLabel("SAFE 1 conversion round", { exact: true })
    .selectOption("seed");
  await expect(button(page, "Export .xlsx")).toBeEnabled();
  await button(page, "Remove round 1").click();
  await expect(button(page, "Export .xlsx")).toBeDisabled();
  await expect(
    page.getByRole("option", { name: "Missing round — choose a replacement" }),
  ).toHaveJSProperty("selected", true);
  await page
    .getByLabel("SAFE 1 conversion round", { exact: true })
    .selectOption("");
  await expect(button(page, "Export .xlsx")).toBeEnabled();
});

for (const width of [320, 390, 768, 1440])
  test(`post-money reference controls and fractional results fit at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await start(page);
    await adopt(page);
    await button(page, "Cap table").click();
    await button(page, "# shares").click();
    await expect(page.getByRole("table").getByRole("caption")).toContainText(
      "reference shares (may be fractional)",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    expect(
      await page.locator("input,button,select").evaluateAll(
        (items) =>
          items.filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
          }).length,
      ),
    ).toBe(0);
    expect(errors).toEqual([]);
  });

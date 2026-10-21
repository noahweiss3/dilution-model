const { test, expect } = require("@playwright/test");
async function edit(page, label, value) {
  const field = page.getByLabel(label, { exact: true });
  await field.focus();
  await field.fill(String(value));
  await field.blur();
}

test("priced rounds, duplicate identities, validation recovery, and exact input reload", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await edit(page, "Founder 1 share of founder equity (%)", 60);
  await edit(page, "Round 1 pre-money ($M)", 8);
  await edit(page, "Round 1 investment ($M)", 2);
  await edit(page, "Round 2 pre-money ($M)", 16);
  await edit(page, "Round 2 investment ($M)", 4);
  await page.getByRole("button", { name: "Cap table", exact: true }).click();
  const table = page.getByRole("table");
  await expect(
    table.getByRole("row", { name: /Founder 1 60.00% 48.00%/ }),
  ).toContainText("38.40%");
  await expect(
    table.getByRole("row", { name: /Founder 2 40.00% 32.00%/ }),
  ).toContainText("25.60%");
  await edit(page, "Founder 2 name", "Founder 1");
  await expect(
    table.getByRole("rowheader", {
      name: "Founder 1 (founder 1)",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    table.getByRole("rowheader", {
      name: "Founder 1 (founder 2)",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    table.getByRole("row", { name: "Total 100.00% 100.00% 100.00%" }),
  ).toBeVisible();
  const previous = await page.evaluate(() =>
    localStorage.getItem("dilution-model:current"),
  );
  await edit(page, "Round 1 pre-money ($M)", 0);
  await expect(
    page.getByRole("button", { name: "Export .xlsx", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Results need valid inputs" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("dilution-model:current")),
  ).toBe(previous);
  await edit(page, "Round 1 pre-money ($M)", 8.55);
  await edit(page, "Round 1 investment ($M)", 2.125);
  await page.reload();
  await expect(
    page.getByLabel("Round 1 pre-money ($M)", { exact: true }),
  ).toHaveValue("8.55");
  await expect(
    page.getByLabel("Round 1 investment ($M)", { exact: true }),
  ).toHaveValue("2.125");
  await edit(page, "Founder 1 shares", -5);
  await page
    .getByRole("button", { name: "Equalize shares", exact: true })
    .click();
  await expect(
    page.getByLabel("Founder 1 shares", { exact: true }),
  ).toHaveValue("1,000,000");
  expect(errors).toEqual([]);
});

test("SAFE target integrity, overgrant warning, workbook download, and keyboard movement", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add SAFE", exact: true }).click();
  await page
    .getByLabel("SAFE 1 conversion round", { exact: true })
    .selectOption("series-a");
  await page
    .getByRole("button", { name: "Remove round 2", exact: true })
    .click();
  await expect(
    page.getByRole("option", { name: "Missing round — choose a replacement" }),
  ).toHaveJSProperty("selected", true);
  await expect(
    page.getByRole("button", { name: "Export .xlsx", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("SAFE 1 conversion round", { exact: true })
    .selectOption("");
  await edit(page, "Round 1 grant (shares)", 3000000);
  await expect(
    page.getByText(
      "500,000 requested shares were not granted. Increase the reserve or reduce the grant.",
    ),
  ).toBeVisible();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export .xlsx", exact: true }).click();
  const file = await event;
  expect(await file.failure()).toBeNull();
  expect(file.suggestedFilename()).toMatch(/\.xlsx$/);
  await page.getByRole("button", { name: "Scale shares", exact: true }).click();
  await page.getByLabel("Target total founder shares", { exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Scale shares", exact: true }),
  ).toBeFocused();
  await page
    .getByLabel("Illustrative round template", { exact: true })
    .selectOption("Series A");
  await page.getByRole("button", { name: "Add round", exact: true }).click();
  await page
    .getByRole("button", { name: "Move round 2 up", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Round 1 name", { exact: true })).toHaveValue(
    "Series A",
  );
});

for (const width of [320, 390, 768, 1440]) {
  test(`ownership chart, numeric results, and all controls fit at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(12);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    expect(
      await page.locator("input,button,select").evaluateAll(
        (es) =>
          es.filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
          }).length,
      ),
    ).toBe(0);
    if (width <= 900)
      await page
        .getByRole("link", { name: "View results", exact: true })
        .click();
    await page.getByRole("button", { name: "Cap table", exact: true }).click();
    await expect(
      page.getByRole("row", { name: "Total 100.00% 100.00% 100.00%" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await page
      .getByRole("button", { name: "Financing values", exact: true })
      .click();
    await expect(
      page.getByText(/not exit proceeds or a liquidation waterfall/),
    ).toBeVisible();
  });
}

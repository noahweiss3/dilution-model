const { test, expect } = require("@playwright/test");
async function edit(page, label, value) {
  const input = page.getByLabel(label, { exact: true });
  await input.fill(String(value));
  await input.blur();
}
const button = (page, name) => page.getByRole("button", { name, exact: true });
async function start(page) {
  await page.goto("/");
  await button(page, "Remove round 2").click();
  await edit(page, "Employee reserve shares", 0);
  await edit(page, "Round 1 pre-money ($M)", 8);
  await edit(page, "Round 1 investment ($M)", 2);
  await button(page, "Duplicate active case").click();
}
test("compares the approved raise example, reloads independent cases, resets, undoes and pins", async ({
  page,
}) => {
  await start(page);
  await expect(
    page.getByText("Inputs are identical. Every outcome difference is zero."),
  ).toBeVisible();
  await edit(page, "Active case name", "Raise more");
  await button(page, "Rename case").click();
  await edit(page, "Round 1 investment ($M)", 3);
  const outcomes = page.getByRole("region", {
    name: "Comparison outcomes",
    exact: true,
  });
  await expect(
    outcomes.getByRole("row", {
      name: /All founders · final ownership 80.000% 72.727%/,
    }),
  ).toBeVisible();
  await expect(
    outcomes.getByRole("row", {
      name: /Founder ownership vs baseline 0.000 pp -7.273 pp/,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Changed assumptions", exact: true })
      .getByRole("row", {
        name: /Seed \(round 1\) · New cash \$2,000,000.00 \$3,000,000.00/,
      }),
  ).toBeVisible();
  await page.reload();
  await expect(button(page, "Raise more")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByLabel("Round 1 investment ($M)", { exact: true }),
  ).toHaveValue("3");
  await button(page, "Baseline · Baseline").click();
  await expect(
    page.getByLabel("Round 1 investment ($M)", { exact: true }),
  ).toHaveValue("2");
  await button(page, "Raise more").click();
  await button(page, "Reset to baseline").click();
  await expect(
    page.getByLabel("Round 1 investment ($M)", { exact: true }),
  ).toHaveValue("2");
  await button(page, "Undo reset").click();
  await expect(
    page.getByLabel("Round 1 investment ($M)", { exact: true }),
  ).toHaveValue("3");
  await button(page, "Pin as baseline").click();
  await expect(button(page, "Raise more · Baseline")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await button(page, "Undo baseline change").click();
  await button(page, "Remove active case").click();
  await button(page, "Undo removal").click();
  await expect(button(page, "Raise more")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
test("invalid alternatives cannot overwrite saved cases and can be explicitly restored", async ({
  page,
}) => {
  await start(page);
  const previous = await page.evaluate(() =>
    localStorage.getItem("dilution-model:comparison"),
  );
  await edit(page, "Founder 1 share of founder equity (%)", 101);
  await expect(button(page, "Baseline · Baseline")).toBeDisabled();
  await expect(button(page, "Export .xlsx")).toBeDisabled();
  await expect(
    page
      .getByRole("region", { name: "Comparison outcomes", exact: true })
      .getByRole("row", { name: /Founder ownership vs baseline 0.000 pp —/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("dilution-model:comparison"),
    ),
  ).toBe(previous);
  await button(page, "Reset to baseline").click();
  await button(page, "Undo reset").click();
  await expect(
    page.getByLabel("Founder 1 share of founder equity (%)", { exact: true }),
  ).toHaveValue("101");
  await page
    .getByLabel("Founder 1 share of founder equity (%)", { exact: true })
    .focus();
  await expect(
    page.getByLabel("Founder 1 share of founder equity (%)", { exact: true }),
  ).toHaveValue("101");
  await page
    .getByLabel("Founder 1 share of founder equity (%)", { exact: true })
    .blur();
  await button(page, "Remove active case").click();
  await button(page, "Undo removal").click();
  await expect(
    page.getByLabel("Founder 1 share of founder equity (%)", { exact: true }),
  ).toHaveValue("101");
  await button(page, "Discard invalid edits").click();
  await expect(
    page.getByLabel("Founder 1 share of founder equity (%)", { exact: true }),
  ).toHaveValue("50");
  await expect(button(page, "Export .xlsx")).toBeEnabled();
  await edit(page, "Round 1 pre-money ($M)", 0);
  await page.reload();
  await expect(
    page.getByLabel("Round 1 pre-money ($M)", { exact: true }),
  ).toHaveValue("8");
});
for (const width of [320, 390, 768, 1440])
  test(`four named cases, keyboard selection and comparison tables fit at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await start(page);
    await edit(page, "Round 1 investment ($M)", 3);
    await button(page, "Duplicate active case").click();
    await button(page, "Duplicate active case").click();
    await edit(
      page,
      "Active case name",
      "A long alternative name that should wrap within the phone width",
    );
    await button(page, "Rename case").click();
    await expect(button(page, "Duplicate active case")).toBeDisabled();
    await button(page, "Baseline · Baseline").focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByLabel("Round 1 investment ($M)", { exact: true }),
    ).toHaveValue("2");
    await page
      .getByRole("region", { name: "Comparison outcomes", exact: true })
      .focus();
    await page.keyboard.press("ArrowRight");
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
    await page.getByRole("button", { name: "Cap table", exact: true }).click();
    await expect(
      page.getByRole("row", { name: "Total 100.00% 100.00%" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

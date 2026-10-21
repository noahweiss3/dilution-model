import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  within,
  cleanup,
} from "@testing-library/react";
import App from "./App.jsx";
import { DRAFT_KEY, RECOVERY_PREFIX } from "./lib/localDraft.js";
import { DEFAULT_SCENARIO } from "./model/examples.js";

// Geometry and actual SVG rendering are exercised separately in Chromium.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));
function edit(label, value) {
  const el = screen.getByLabelText(label);
  fireEvent.focus(el);
  fireEvent.change(el, { target: { value } });
  fireEvent.blur(el);
}
const table = () => {
  fireEvent.click(
    screen.getByRole("button", { name: "Cap table", exact: true }),
  );
  return screen.getByRole("table");
};

describe("founder foundation flow", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
  });
  it("keeps distinct duplicate founders through edits, cap-table display, and local reload", () => {
    const view = render(<App />);
    edit("Founder 2 name", "Founder 1");
    const rows = within(table())
      .getAllByRole("row")
      .filter((r) =>
        within(r).queryByRole("rowheader", {
          name: /Founder 1 \(founder [12]\)/,
        }),
      );
    expect(rows).toHaveLength(2);
    expect(
      within(
        screen.getByRole("row", { name: /Total 100.00% 100.00% 100.00%/ }),
      ).getAllByRole("cell"),
    ).toHaveLength(3);
    const input = JSON.parse(localStorage.getItem(DRAFT_KEY));
    expect(input.founders[0].id).not.toBe(input.founders[1].id);
    view.unmount();
    render(<App />);
    expect(screen.getByLabelText("Founder 2 name")).toHaveValue("Founder 1");
  });
  it("blocks invalid results, export, and autosave while retaining the last valid draft", () => {
    render(<App />);
    const previous = localStorage.getItem(DRAFT_KEY);
    edit("Round 1 pre-money ($M)", "0");
    expect(screen.getByLabelText("Round 1 pre-money ($M)")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      screen.getByRole("heading", { name: "Results need valid inputs" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Export .xlsx" })).toBeDisabled();
    expect(localStorage.getItem(DRAFT_KEY)).toBe(previous);
    edit("Round 1 pre-money ($M)", "8.55");
    expect(screen.getByLabelText("Round 1 pre-money ($M)")).toHaveValue("8.55");
    expect(screen.getByRole("button", { name: "Export .xlsx" })).toBeEnabled();
  });

  it("displays corrected shares after equalizing an invalid draft", () => {
    render(<App />);
    edit("Founder 1 shares", "-5");
    expect(screen.getByRole("button", { name: "Export .xlsx" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Equalize shares" }));
    expect(screen.getByLabelText("Founder 1 shares")).toHaveValue("1,000,000");
    expect(screen.getByLabelText("Founder 2 shares")).toHaveValue("1,000,000");
    expect(screen.getByRole("button", { name: "Export .xlsx" })).toBeEnabled();
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)).founders[0].shares).toBe(
      1_000_000,
    );
  });

  it("blocks an invalid founder percentage draft until corrected", () => {
    render(<App />);
    edit("Founder 1 share of founder equity (%)", "101");
    expect(
      screen.getByLabelText("Founder 1 share of founder equity (%)"),
    ).toHaveValue("101");
    expect(screen.getByRole("button", { name: "Export .xlsx" })).toBeDisabled();
    edit("Founder 1 share of founder equity (%)", "60");
    expect(screen.getByRole("button", { name: "Export .xlsx" })).toBeEnabled();
    expect(
      JSON.parse(localStorage.getItem(DRAFT_KEY)).founders.map((f) => f.shares),
    ).toEqual([6_000_000, 4_000_000]);
  });
  it("makes a removed SAFE target explicit and recovers after reassignment", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Add SAFE" }));
    fireEvent.change(screen.getByLabelText("SAFE 1 conversion round"), {
      target: { value: "series-a" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove round 2" }));
    expect(
      screen.getByRole("option", {
        name: "Missing round — choose a replacement",
      }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Export .xlsx" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("SAFE 1 conversion round"), {
      target: { value: "" },
    });
    expect(screen.getByRole("button", { name: "Export .xlsx" })).toBeEnabled();
    expect(
      within(table()).getByRole("rowheader", { name: "SAFE holder 1" }),
    ).toBeVisible();
  });
  it("preserves exact dollar inputs and announces grant truncation", () => {
    render(<App />);
    edit("Round 1 pre-money ($M)", "8.55");
    edit("Round 1 investment ($M)", "2.125");
    edit("Round 1 grant (shares)", "3000000");
    expect(screen.getByLabelText("Round 1 investment ($M)")).toHaveValue(
      "2.125",
    );
    expect(
      screen.getAllByText(/500,000 requested shares were not granted/).length,
    ).toBeGreaterThan(0);
    fireEvent.click(
      within(
        screen.getByRole("group", { name: "Round 1 dollar units" }),
      ).getByRole("button", { name: "$ thousands", exact: true }),
    );
    expect(screen.getByLabelText("Round 1 pre-money ($K)")).toHaveValue(
      "8,550",
    );
  });
  it("supports round reordering with named keyboard controls and selected result modes", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Move round 2 up" }));
    expect(screen.getByLabelText("Round 1 name")).toHaveValue("Series A");
    fireEvent.click(
      screen.getByRole("button", { name: "Financing values", exact: true }),
    );
    expect(
      screen.getByRole("button", { name: "Financing values", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText(/not exit proceeds or a liquidation waterfall/),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Scale shares" }));
    fireEvent.keyDown(screen.getByLabelText("Target total founder shares"), {
      key: "Escape",
    });
    expect(
      screen.queryByLabelText("Target total founder shares"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scale shares" })).toHaveFocus();
  });
  it("backs up a migrated scenario before autosave and offers the original inputs", () => {
    const old = JSON.stringify({ ...DEFAULT_SCENARIO, schemaVersion: 1 });
    localStorage.setItem(DRAFT_KEY, old);
    render(<App />);
    expect(
      screen.getByRole("button", { name: "Download original inputs" }),
    ).toBeVisible();
    const key = Object.keys(localStorage).find((k) =>
      k.startsWith(RECOVERY_PREFIX),
    );
    expect(localStorage.getItem(key)).toBe(old);
  });
});

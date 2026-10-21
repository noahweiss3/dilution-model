import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  within,
  cleanup,
} from "@testing-library/react";
import App from "./App.jsx";
import { WORKSPACE_KEY } from "./lib/comparisonStorage.js";
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));
const click = (name) =>
  fireEvent.click(screen.getByRole("button", { name, exact: true }));
function edit(label, value) {
  const input = screen.getByLabelText(label);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}
function setup() {
  click("Remove round 2");
  edit("Employee reserve shares", "0");
  edit("Round 1 pre-money ($M)", "8");
  edit("Round 1 investment ($M)", "2");
  click("Duplicate active case");
}
const outcomes = () =>
  within(screen.getByRole("region", { name: "Comparison outcomes" }));
describe("local scenario comparison", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
  });
  it("compares named independent alternatives with zero and approved financial deltas, then restores reload", () => {
    const view = render(<App />);
    setup();
    expect(
      outcomes().getByRole("row", {
        name: /Founder ownership vs baseline 0.000 pp 0.000 pp/,
      }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Inputs are identical. Every outcome difference is zero.",
      ),
    ).toBeVisible();
    edit("Active case name", "Raise more");
    click("Rename case");
    edit("Round 1 investment ($M)", "3");
    expect(
      outcomes().getByRole("row", {
        name: /All founders · final ownership 80.000% 72.727%/,
      }),
    ).toBeVisible();
    expect(
      outcomes().getByRole("row", {
        name: /Founder ownership vs baseline 0.000 pp -7.273 pp/,
      }),
    ).toBeVisible();
    expect(
      within(
        screen.getByRole("region", { name: "Changed assumptions" }),
      ).getByRole("row", {
        name: /Seed \(round 1\) · New cash \$2,000,000.00 \$3,000,000.00/,
      }),
    ).toBeVisible();
    click("Baseline · Baseline");
    expect(screen.getByLabelText("Round 1 investment ($M)")).toHaveValue("2");
    click("Raise more");
    view.unmount();
    render(<App />);
    expect(
      screen.getByRole("button", { name: "Raise more", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Round 1 investment ($M)")).toHaveValue("3");
    expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY)).cases).toHaveLength(
      2,
    );
  });
  it("resets and removes with undo, pins a new baseline, and clears undo on later edits", () => {
    render(<App />);
    setup();
    edit("Round 1 investment ($M)", "3");
    click("Reset to baseline");
    expect(screen.getByLabelText("Round 1 investment ($M)")).toHaveValue("2");
    click("Undo reset");
    expect(screen.getByLabelText("Round 1 investment ($M)")).toHaveValue("3");
    click("Remove active case");
    expect(
      screen.queryByRole("region", { name: "Comparison outcomes" }),
    ).not.toBeInTheDocument();
    click("Undo removal");
    expect(screen.getByLabelText("Round 1 investment ($M)")).toHaveValue("3");
    click("Pin as baseline");
    expect(
      screen.getByRole("button", {
        name: "Alternative 1 · Baseline",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Remove active case", exact: true }),
    ).toBeDisabled();
    click("Undo baseline change");
    click("Reset to baseline");
    edit("Founder 1 share of founder equity (%)", "101");
    expect(
      screen.queryByRole("button", { name: "Undo reset", exact: true }),
    ).not.toBeInTheDocument();
  });
  it("retains last valid workspace, blocks switching/exports, and explicitly discards invalid edits", () => {
    render(<App />);
    setup();
    const previous = localStorage.getItem(WORKSPACE_KEY);
    edit("Round 1 pre-money ($M)", "0");
    expect(
      screen.getByRole("button", { name: "Baseline · Baseline", exact: true }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Duplicate active case",
        exact: true,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Export .xlsx", exact: true }),
    ).toBeDisabled();
    expect(
      outcomes().getByRole("row", {
        name: /Founder ownership vs baseline 0.000 pp —/,
      }),
    ).toBeVisible();
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(previous);
    click("Discard invalid edits");
    expect(screen.getByLabelText("Round 1 pre-money ($M)")).toHaveValue("8");
    expect(
      screen.getByRole("button", { name: "Baseline · Baseline", exact: true }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Export .xlsx", exact: true }),
    ).toBeEnabled();
  });
  it("restores invalid percentage text with its error when undoing a reset or removal", () => {
    render(<App />);
    setup();
    edit("Founder 1 share of founder equity (%)", "101");
    click("Reset to baseline");
    click("Undo reset");
    expect(
      screen.getByLabelText("Founder 1 share of founder equity (%)"),
    ).toHaveValue("101");
    fireEvent.focus(
      screen.getByLabelText("Founder 1 share of founder equity (%)"),
    );
    expect(
      screen.getByLabelText("Founder 1 share of founder equity (%)"),
    ).toHaveValue("101");
    fireEvent.blur(
      screen.getByLabelText("Founder 1 share of founder equity (%)"),
    );
    expect(
      screen.getByRole("button", { name: "Export .xlsx", exact: true }),
    ).toBeDisabled();
    click("Remove active case");
    click("Undo removal");
    expect(
      screen.getByLabelText("Founder 1 share of founder equity (%)"),
    ).toHaveValue("101");
    click("Discard invalid edits");
    expect(
      screen.getByLabelText("Founder 1 share of founder equity (%)"),
    ).toHaveValue("50");
    expect(
      screen.getByRole("button", { name: "Export .xlsx", exact: true }),
    ).toBeEnabled();
  });
  it("validates names without mutating stored cases and limits the workspace to four", () => {
    render(<App />);
    setup();
    edit("Active case name", "baseline");
    click("Rename case");
    expect(screen.getByRole("alert")).toHaveTextContent("distinct case name");
    expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY)).cases[1].name).toBe(
      "Alternative 1",
    );
    click("Duplicate active case");
    click("Duplicate active case");
    expect(
      screen.getByRole("button", {
        name: "Duplicate active case",
        exact: true,
      }),
    ).toBeDisabled();
    expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY)).cases).toHaveLength(
      4,
    );
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import {
  createWorkspace,
  changeWorkspace,
  activeCase,
} from "../model/comparisonWorkspace.js";
import { DEFAULT_SCENARIO } from "../model/examples.js";
import {
  WORKSPACE_KEY,
  loadWorkspace,
  saveWorkspace,
} from "./comparisonStorage.js";
import { DRAFT_KEY, RECOVERY_PREFIX } from "./localDraft.js";

describe("anonymous comparison persistence", () => {
  beforeEach(() => localStorage.clear());
  it("starts from the existing draft and restores cases, baseline, active case and versions", () => {
    const seed = structuredClone(DEFAULT_SCENARIO);
    seed.rounds[0].investment = 2_125_000;
    let { workspace } = loadWorkspace(seed);
    workspace = changeWorkspace(workspace, { type: "duplicate", id: "alt" });
    workspace = changeWorkspace(workspace, { type: "pin" });
    saveWorkspace(workspace);
    expect(loadWorkspace(DEFAULT_SCENARIO).workspace).toEqual(workspace);
    expect(
      JSON.parse(localStorage.getItem(DRAFT_KEY)).rounds[0].investment,
    ).toBe(2_125_000);
  });
  it("retains the entire last valid workspace when one case becomes invalid", () => {
    const w = changeWorkspace(createWorkspace(DEFAULT_SCENARIO), {
      type: "duplicate",
    });
    saveWorkspace(w);
    const previous = localStorage.getItem(WORKSPACE_KEY);
    activeCase(w).scenario.rounds[0].preMoneyVal = NaN;
    expect(() => saveWorkspace(w)).toThrow(/errors/);
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(previous);
  });
  it("backs up exact malformed or future workspace bytes before replacement", () => {
    for (const original of ["{bad", JSON.stringify({ workspaceVersion: 99 })]) {
      localStorage.clear();
      localStorage.setItem(WORKSPACE_KEY, original);
      const loaded = loadWorkspace(DEFAULT_SCENARIO);
      const key = `${RECOVERY_PREFIX}workspace`;
      saveWorkspace(loaded.workspace, [{ key, original: loaded.original }]);
      expect(localStorage.getItem(key)).toBe(original);
      expect(loaded.warnings.join(" ")).toMatch(/recovery/);
    }
  });
  it("preserves originals before model-version migration and before legacy draft mirroring", () => {
    const w = createWorkspace(DEFAULT_SCENARIO);
    w.cases[0].scenario.calculationVersion = "previous";
    const original = JSON.stringify(w);
    localStorage.setItem(WORKSPACE_KEY, original);
    const loaded = loadWorkspace(DEFAULT_SCENARIO);
    saveWorkspace(loaded.workspace, [
      { key: `${RECOVERY_PREFIX}workspace`, original: loaded.original },
      { key: `${RECOVERY_PREFIX}draft`, original: "legacy" },
    ]);
    expect(localStorage.getItem(`${RECOVERY_PREFIX}workspace`)).toBe(original);
    expect(localStorage.getItem(`${RECOVERY_PREFIX}draft`)).toBe("legacy");
    expect(loaded.warnings).toHaveLength(1);
  });
  it("does not replace either saved value if a required backup fails", () => {
    const values = new Map([
      [WORKSPACE_KEY, "old-workspace"],
      [DRAFT_KEY, "old-draft"],
    ]);
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        if (key.startsWith(RECOVERY_PREFIX)) throw Error("quota");
        values.set(key, value);
      },
    };
    expect(() =>
      saveWorkspace(
        createWorkspace(DEFAULT_SCENARIO),
        [{ key: `${RECOVERY_PREFIX}backup`, original: "original" }],
        storage,
      ),
    ).toThrow("quota");
    expect(values.get(WORKSPACE_KEY)).toBe("old-workspace");
    expect(values.get(DRAFT_KEY)).toBe("old-draft");
  });
  it("keeps the primary workspace if the backward-compatible draft mirror fails", () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        if (key === DRAFT_KEY) throw Error("quota");
        values.set(key, value);
      },
    };
    const w = createWorkspace(DEFAULT_SCENARIO);
    saveWorkspace(w, [], storage);
    expect(loadWorkspace(DEFAULT_SCENARIO, storage).workspace).toEqual(w);
  });
});

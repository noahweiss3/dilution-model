import { beforeEach, describe, expect, it } from "vitest";
import {
  DRAFT_KEY,
  RECOVERY_PREFIX,
  loadLocalDraft,
  saveLocalDraft,
} from "./localDraft.js";
import { DEFAULT_SCENARIO } from "../model/examples.js";
import { createScenarioState } from "../model/scenarioSchema.js";

describe("local draft recovery", () => {
  beforeEach(() => localStorage.clear());
  it("archives exact original bytes before a legacy migration is saved", () => {
    const original = JSON.stringify({ ...DEFAULT_SCENARIO, schemaVersion: 1 });
    localStorage.setItem(DRAFT_KEY, original);
    const loaded = loadLocalDraft(DEFAULT_SCENARIO);
    saveLocalDraft(loaded.scenario, {
      key: `${RECOVERY_PREFIX}test`,
      original: loaded.original,
    });
    expect(localStorage.getItem(`${RECOVERY_PREFIX}test`)).toBe(original);
    expect(loadLocalDraft(DEFAULT_SCENARIO).scenario).toEqual(loaded.scenario);
  });
  it("keeps the current draft intact if recovery storage fails", () => {
    const original = "{bad json";
    const store = {
      getItem: (key) => (key === DRAFT_KEY ? original : null),
      setItem: () => {
        throw Error("quota");
      },
    };
    const loaded = loadLocalDraft(DEFAULT_SCENARIO, store);
    expect(() =>
      saveLocalDraft(
        loaded.scenario,
        { key: `${RECOVERY_PREFIX}test`, original },
        store,
      ),
    ).toThrow("quota");
    expect(store.getItem(DRAFT_KEY)).toBe(original);
  });
  it("does not overwrite the last valid draft with invalid input", () => {
    const input = createScenarioState(DEFAULT_SCENARIO);
    saveLocalDraft(input);
    const original = localStorage.getItem(DRAFT_KEY);
    input.founders[0].shares = -1;
    expect(() => saveLocalDraft(input)).toThrow(/errors/);
    expect(localStorage.getItem(DRAFT_KEY)).toBe(original);
  });
});

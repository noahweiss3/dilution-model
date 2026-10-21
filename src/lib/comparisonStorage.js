import {
  activeCase,
  createWorkspace,
  validateWorkspace,
} from "../model/comparisonWorkspace.js";
import { calculateScenario } from "../model/dilutionEngine.js";
import {
  createScenarioState,
  normalizeScenarioState,
} from "../model/scenarioSchema.js";
import { preserveOriginal, saveLocalDraft } from "./localDraft.js";

export const WORKSPACE_KEY = "dilution-model:comparison";

export function loadWorkspace(seed, storage = localStorage) {
  let raw;
  try {
    raw = storage.getItem(WORKSPACE_KEY);
    if (!raw) return { workspace: createWorkspace(seed), warnings: [] };
    const data = validateWorkspace(JSON.parse(raw));
    const warnings = [];
    const cases = data.cases.map((item) => {
      const loaded = normalizeScenarioState(item.scenario, seed);
      warnings.push(
        ...loaded.warnings.map((message) => `${item.name}: ${message}`),
      );
      return { id: item.id, name: item.name.trim(), scenario: loaded.scenario };
    });
    return {
      workspace: {
        workspaceVersion: data.workspaceVersion,
        activeId: data.activeId,
        baselineId: data.baselineId,
        cases,
      },
      warnings,
      original: warnings.length ? raw : null,
    };
  } catch {
    return {
      workspace: createWorkspace(seed),
      original: raw || null,
      warnings: [
        "Comparison workspace could not be read. The current draft is shown; the original workspace will be retained for recovery before saving.",
      ],
    };
  }
}

export function saveWorkspace(
  workspace,
  recoveries = [],
  storage = localStorage,
) {
  validateWorkspace(workspace);
  if (
    workspace.cases.some(
      (item) => calculateScenario(item.scenario).errors.length,
    )
  )
    throw Error("Fix case errors before saving the workspace.");
  recoveries.forEach((recovery) => preserveOriginal(recovery, storage));
  const canonical = {
    ...workspace,
    cases: workspace.cases.map((item) => ({
      ...item,
      scenario: createScenarioState(item.scenario),
    })),
  };
  // This single value is authoritative and atomically replaces the last valid
  // workspace only after all required recovery copies have succeeded.
  storage.setItem(WORKSPACE_KEY, JSON.stringify(canonical));
  // Backwards compatibility with the single-draft release is best effort.
  try {
    saveLocalDraft(activeCase(canonical).scenario, null, storage);
  } catch {
    /* workspace is safely saved */
  }
}

import {
  createScenarioState,
  normalizeScenarioState,
} from "../model/scenarioSchema.js";
import { calculateScenario } from "../model/dilutionEngine.js";
export const DRAFT_KEY = "dilution-model:current";
export const RECOVERY_PREFIX = "dilution-model:recovery:";

export function loadLocalDraft(defaults, storage = localStorage) {
  let raw;
  try {
    raw = storage.getItem(DRAFT_KEY);
    if (!raw) return { scenario: createScenarioState(defaults), warnings: [] };
    const result = normalizeScenarioState(JSON.parse(raw), defaults);
    return { ...result, original: result.needsBackup ? raw : null };
  } catch {
    return {
      scenario: createScenarioState(defaults),
      original: raw || null,
      warnings: [
        "Saved scenario could not be read; defaults are shown. Original data will be retained for recovery before saving.",
      ],
    };
  }
}

export function preserveOriginal(recovery, storage = localStorage) {
  if (recovery?.original) {
    const existing = storage.getItem(recovery.key);
    if (existing != null && existing !== recovery.original)
      throw new Error(
        "Recovery key conflict; original draft was not overwritten.",
      );
    if (existing == null) storage.setItem(recovery.key, recovery.original);
  }
}

export function saveLocalDraft(input, recovery, storage = localStorage) {
  const result = calculateScenario(input);
  if (result.errors.length)
    throw new Error("Fix scenario errors before saving.");
  preserveOriginal(recovery, storage);
  storage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      ...createScenarioState(input),
      savedAt: new Date().toISOString(),
    }),
  );
}

export function downloadText(contents, filename) {
  const url = URL.createObjectURL(
    new Blob([contents], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

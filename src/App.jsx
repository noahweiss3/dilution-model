import { useEffect, useMemo, useRef, useState } from "react";
import AuthBar from "./components/AuthBar.jsx";
import ScenariosMenu from "./components/ScenariosMenu.jsx";
import ModelResults from "./components/ModelResults.jsx";
import ScenarioComparison from "./components/ScenarioComparison.jsx";
import {
  LEGACY_CONVENTION,
  POST_MONEY_CONVENTION,
  conventionOf,
  calculationVersionFor,
  SAFE_VARIANTS,
} from "./model/safeConventions.js";
import {
  activeCase,
  replaceCaseInputs,
  changeWorkspace,
} from "./model/comparisonWorkspace.js";
import { loadWorkspace, saveWorkspace } from "./lib/comparisonStorage.js";
import {
  Field,
  NumberField,
  TextField,
  ViewButtons,
  fieldId,
  number,
  money,
  percent,
} from "./components/ModelFields.jsx";
import { calculateScenario, GRANTED_KEY } from "./model/dilutionEngine.js";
import { createId } from "./model/identities.js";
import {
  createScenarioState,
  normalizeScenarioState,
} from "./model/scenarioSchema.js";
import { DEFAULT_SCENARIO, ROUND_TEMPLATES } from "./model/examples.js";
import {
  equalizeFounderShares,
  redistributeFounderPercent,
  scaleFounderShares,
} from "./model/founderAllocation.js";
import {
  loadLocalDraft,
  downloadText,
  RECOVERY_PREFIX,
} from "./lib/localDraft.js";

function ScaleFounders({ founders, onScale }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(10_000_000);
  const trigger = useRef(null);
  const total = founders.reduce((sum, f) => sum + f.shares, 0);
  const valid =
    founders.every((f) => Number.isSafeInteger(f.shares) && f.shares >= 0) &&
    Number.isSafeInteger(target) &&
    target > 0 &&
    Number.isSafeInteger(total) &&
    total > 0;
  return (
    <div
      className="scale-control"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        type="button"
        ref={trigger}
        aria-expanded={open}
        onClick={() => {
          setTarget(total || 10_000_000);
          setOpen((v) => !v);
        }}
      >
        Scale shares
      </button>
      {open && (
        <div className="scale-panel">
          <NumberField
            path="scaleTarget"
            label="Target total founder shares"
            value={target}
            onChange={setTarget}
            hint="Preserves the split within founder equity. The employee reserve is unchanged."
          />
          <button
            type="button"
            disabled={!valid}
            onClick={() => {
              onScale(target);
              setOpen(false);
              trigger.current?.focus();
            }}
          >
            Apply scale
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
          >
            Cancel scale
          </button>
        </div>
      )}
    </div>
  );
}

export default function App({ clerkConfigured = false }) {
  const [initial] = useState(() => {
    const draft = loadLocalDraft(DEFAULT_SCENARIO);
    const comparison = loadWorkspace(draft.scenario);
    return {
      ...draft,
      workspace: comparison.workspace,
      workspaceOriginal: comparison.original,
      warnings: [...draft.warnings, ...comparison.warnings],
    };
  });
  const [workspace, setWorkspace] = useState(initial.workspace);
  const latestWorkspace = useRef(workspace);
  latestWorkspace.current = workspace;
  const currentCase = activeCase(workspace);
  const scenario = currentCase.scenario;
  const postMoneyReference = conventionOf(scenario) === POST_MONEY_CONVENTION;
  const firstPricedRound = scenario.rounds.find((r) => r.investment > 0);
  const [undo, setUndo] = useState(null);
  const [comparisonStatus, setComparisonStatus] = useState("");
  const [inputRevision, setInputRevision] = useState(0);
  const lastValid = useRef(
    new Map(
      initial.workspace.cases
        .filter((c) => !calculateScenario(c.scenario).errors.length)
        .map((c) => [c.id, c.scenario]),
    ),
  );
  const setScenario = (updater) => {
    setUndo(null);
    setComparisonStatus("");
    setWorkspace((w) =>
      replaceCaseInputs(
        w,
        w.activeId,
        typeof updater === "function"
          ? updater(activeCase(w).scenario)
          : updater,
      ),
    );
  };
  const [notice, setNotice] = useState(initial.warnings.join(" "));
  const [recovery, setRecovery] = useState(() => ({
    key: `${RECOVERY_PREFIX}${createId()}`,
    original: initial.original,
  }));
  const [workspaceRecovery] = useState(() => ({
    key: `${RECOVERY_PREFIX}${createId()}`,
    original: initial.workspaceOriginal,
  }));
  const [storageStatus, setStorageStatus] = useState("Saving local draft…");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [template, setTemplate] = useState("Seed");
  const [draftErrors, setDraftErrors] = useState({});
  const latestDraftErrors = useRef(draftErrors);
  latestDraftErrors.current = draftErrors;
  const calculation = useMemo(() => calculateScenario(scenario), [scenario]);
  const result = {
    ...calculation,
    errors: [
      ...calculation.errors,
      ...Object.entries(draftErrors).map(([path, details]) => ({
        path,
        message: details.message,
      })),
    ],
  };
  const valid = result.errors.length === 0;
  const workspaceValid =
    valid &&
    workspace.cases.every(
      (c) =>
        c.id === currentCase.id || !calculateScenario(c.scenario).errors.length,
    );
  const error = (path) => result.errors.find((e) => e.path === path)?.message;
  const foundersTotal = scenario.founders.reduce((sum, f) => sum + f.shares, 0);
  const granted = result.states.at(-1)?.holderShares[GRANTED_KEY] || 0;

  useEffect(() => {
    if (valid) lastValid.current.set(currentCase.id, scenario);
    if (!workspaceValid) {
      setStorageStatus(
        "Changes with errors are not saved. Your last valid comparison workspace is retained.",
      );
      return;
    }
    try {
      saveWorkspace(workspace, [recovery, workspaceRecovery]);
      setStorageStatus("Comparison workspace saved in this browser.");
    } catch {
      setStorageStatus(
        "Local saving is unavailable. Keep this tab open and export valid cases individually to retain your work. The prior workspace was not intentionally replaced.",
      );
    }
  }, [
    workspace,
    workspaceValid,
    valid,
    scenario,
    currentCase.id,
    recovery,
    workspaceRecovery,
  ]);

  const actOnWorkspace = (action) => {
    if (
      ["switch", "duplicate", "pin", "rename"].includes(action.type) &&
      !valid
    )
      throw Error("Fix or discard invalid edits before changing cases.");
    const next = changeWorkspace(workspace, action);
    const labels = {
      reset: "reset",
      remove: "removal",
      pin: "baseline change",
    };
    setUndo(
      labels[action.type]
        ? { workspace, draftErrors, label: labels[action.type] }
        : null,
    );
    setWorkspace(next);
    if (action.type !== "rename") setDraftErrors({});
    setExportError("");
    setInputRevision((v) => v + 1);
    setComparisonStatus(
      {
        reset: "Active case reset to the baseline inputs.",
        remove: "Case removed from this browser workspace.",
        pin: `${activeCase(next).name} is now the baseline.`,
        duplicate: "Independent copy created. Edit its inputs below.",
        rename: "Case renamed.",
        switch: `Editing ${activeCase(next).name}.`,
      }[action.type],
    );
  };
  const undoWorkspace = () => {
    setWorkspace(undo.workspace);
    setDraftErrors(undo.draftErrors);
    setInputRevision((v) => v + 1);
    setComparisonStatus(`Undid ${undo.label}.`);
    setUndo(null);
  };

  const update = (key, value) => setScenario((s) => ({ ...s, [key]: value }));
  const adoptConvention = (safeConvention) =>
    setScenario((s) => ({
      ...s,
      safeConvention,
      calculationVersion: calculationVersionFor({ safeConvention }),
      instruments: s.instruments.map((item) => ({
        ...item,
        variant:
          safeConvention === LEGACY_CONVENTION
            ? "legacy-generic"
            : item.variant === "legacy-generic" || item.variant == null
              ? ""
              : item.variant,
      })),
    }));
  const patch = (key, index, changes) =>
    setScenario((s) => ({
      ...s,
      [key]: s[key].map((item, i) =>
        i === index ? { ...item, ...changes } : item,
      ),
    }));
  const remove = (key, index) => {
    setDraftErrors({});
    setScenario((s) => ({ ...s, [key]: s[key].filter((_, i) => i !== index) }));
  };
  const add = (key, value) =>
    setScenario((s) => ({ ...s, [key]: [...s[key], value] }));
  const moveRound = (index, delta) =>
    setScenario((s) => {
      const rounds = [...s.rounds];
      const target = index + delta;
      if (target < 0 || target >= rounds.length) return s;
      [rounds[index], rounds[target]] = [rounds[target], rounds[index]];
      return { ...s, rounds };
    });
  const getScenarioState = () => {
    if (!valid) throw new Error("Fix the scenario errors before saving.");
    return createScenarioState(scenario);
  };
  const applyScenario = (data) => {
    const latest = latestWorkspace.current;
    if (latest.activeId !== currentCase.id) return;
    const loaded = normalizeScenarioState(data, DEFAULT_SCENARIO);
    if (loaded.needsBackup)
      setRecovery({
        key: `${RECOVERY_PREFIX}${createId()}`,
        original: JSON.stringify(data),
      });
    setUndo({
      workspace: latest,
      draftErrors: latestDraftErrors.current,
      label: "cloud load",
    });
    setWorkspace(replaceCaseInputs(latest, currentCase.id, loaded.scenario));
    setInputRevision((v) => v + 1);
    setComparisonStatus("Cloud scenario loaded into the active local case.");
    setDraftErrors({});
    setNotice(loaded.warnings.join(" "));
  };
  const setFounderPct = (index, value, raw) => {
    setUndo(null);
    setComparisonStatus("");
    const path = `founders.${index}.split`;
    try {
      const founders = redistributeFounderPercent(
        scenario.founders,
        index,
        value,
      );
      setDraftErrors((errors) => {
        const next = { ...errors };
        delete next[path];
        return next;
      });
      update("founders", founders);
    } catch (e) {
      setDraftErrors((errors) => ({
        ...errors,
        [path]: { message: e.message, draft: raw ?? String(value) },
      }));
    }
  };
  const scaleFounders = (target) => {
    setDraftErrors({});
    update("founders", scaleFounderShares(scenario.founders, target));
  };
  const equalize = () => {
    setDraftErrors({});
    update("founders", equalizeFounderShares(scenario.founders));
  };
  const addRound = () => {
    const t = ROUND_TEMPLATES.find((t) => t.name === template);
    const round = { ...t, id: createId(), grantMode: "shares", grantValue: 0 };
    const sort = (name) => {
      const i = ROUND_TEMPLATES.findIndex((t) => t.name === name);
      return i < 0 ? ROUND_TEMPLATES.length : i;
    };
    setScenario((s) => {
      const rounds = [...s.rounds];
      let at = rounds.length;
      for (let i = rounds.length - 1; i >= 0; i--) {
        if (sort(rounds[i].name) <= sort(round.name)) break;
        at = i;
      }
      rounds.splice(at, 0, round);
      return { ...s, rounds };
    });
  };
  const doExport = async () => {
    setExporting(true);
    setExportError("");
    try {
      const snapshot = getScenarioState();
      const caseName =
        currentCase.name
          .normalize("NFKD")
          .replace(/[^a-zA-Z0-9_-]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 64) || "case";
      const { exportWorkbook } = await import("./lib/exportWorkbook.js");
      await exportWorkbook(
        snapshot,
        `dilution-model-${caseName}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
    } catch (e) {
      setExportError(e.message || "Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <a className="skip-link" href="#results">
        Skip to results
      </a>
      <header className="app-header">
        <div>
          <h1>Dilution Model</h1>
          <p>Explore your financing choices</p>
        </div>
        <div className="header-actions">
          <ScenariosMenu
            key={currentCase.id}
            clerkConfigured={clerkConfigured}
            getScenarioState={getScenarioState}
            applyScenarioState={applyScenario}
          />
          <button
            type="button"
            className="primary"
            disabled={!valid || exporting}
            title={`Export ${currentCase.name} only`}
            onClick={doExport}
          >
            {exporting ? "Exporting…" : "Export .xlsx"}
          </button>
          <AuthBar clerkConfigured={clerkConfigured} />
        </div>
      </header>
      <nav className="mobile-nav" aria-label="Model sections">
        <a href="#comparison">Compare cases</a>
        <a href="#model-inputs">Edit inputs</a>
        <a href="#results">View results</a>
      </nav>
      <p className="save-status" role="status">
        {storageStatus}
      </p>
      {notice && (
        <div className="notice" role="region" aria-label="Scenario recovery notice">
          <p>{notice}</p>
          {recovery.original && (
            <button
              type="button"
              onClick={() =>
                downloadText(recovery.original, "dilution-original-inputs.json")
              }
            >
              Download original inputs
            </button>
          )}
          {workspaceRecovery.original && (
            <button
              type="button"
              onClick={() =>
                downloadText(
                  workspaceRecovery.original,
                  "dilution-original-comparison.json",
                )
              }
            >
              Download original comparison
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss scenario notice"
            onClick={() => setNotice("")}
          >
            Dismiss
          </button>
        </div>
      )}
      {exportError && (
        <p className="error-summary" role="alert">
          {exportError}
        </p>
      )}
      {!valid && (
        <div className="error-summary" role="alert">
          <h2>Check these inputs</h2>
          <ul>
            {result.errors.map((e, i) => (
              <li key={`${e.path}-${i}`}>
                <a href={`#${fieldId(e.path)}`}>{e.message}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ScenarioComparison
        workspace={workspace}
        valid={valid}
        canDiscard={lastValid.current.has(currentCase.id)}
        onAction={actOnWorkspace}
        onDiscard={() => {
          setScenario(
            createScenarioState(lastValid.current.get(currentCase.id)),
          );
          setDraftErrors({});
          setInputRevision((v) => v + 1);
          setComparisonStatus(
            "Invalid edits discarded; last valid inputs restored.",
          );
        }}
        undo={undo}
        onUndo={undoWorkspace}
        status={comparisonStatus}
      />
      <main className="app-layout">
        <aside
          key={`${currentCase.id}-${inputRevision}`}
          id="model-inputs"
          className="inputs"
          aria-label="Model inputs"
        >
          <p className="explanation">
            Starting values and round templates are illustrative examples, not
            market benchmarks. Edit them to explore your own scenario.
          </p>
          <section id={fieldId("founders")}>
            <div className="section-heading">
              <h2>Initial cap table</h2>
              <button
                type="button"
                onClick={() =>
                  add("founders", {
                    id: createId(),
                    name: `Founder ${scenario.founders.length + 1}`,
                    shares: 1_000_000,
                  })
                }
              >
                Add founder
              </button>
            </div>
            <div className="input-actions">
              <button
                type="button"
                disabled={scenario.founders.length < 2}
                onClick={equalize}
              >
                Equalize shares
              </button>
              <ScaleFounders
                founders={scenario.founders}
                onScale={scaleFounders}
              />
            </div>
            {scenario.founders.map((f, i) => (
              <div className="input-card" key={f.id}>
                <div className="section-heading">
                  <h3>Founder {i + 1}</h3>
                  <button
                    type="button"
                    aria-label={`Remove founder ${i + 1}`}
                    onClick={() => remove("founders", i)}
                  >
                    Remove
                  </button>
                </div>
                <TextField
                  path={`founders.${i}.name`}
                  label={`Founder ${i + 1} name`}
                  value={f.name}
                  onChange={(name) => patch("founders", i, { name })}
                  error={error(`founders.${i}.name`)}
                />
                <NumberField
                  path={`founders.${i}.shares`}
                  label={`Founder ${i + 1} shares`}
                  value={f.shares}
                  onChange={(shares) => patch("founders", i, { shares })}
                  error={error(`founders.${i}.shares`)}
                />
                {scenario.founders.length > 1 &&
                  Number.isSafeInteger(foundersTotal) &&
                  foundersTotal > 0 && (
                    <NumberField
                      path={`founders.${i}.split`}
                      label={`Founder ${i + 1} share of founder equity (%)`}
                      value={(f.shares / foundersTotal) * 100}
                      draftOverride={draftErrors[`founders.${i}.split`]?.draft}
                      onChange={(v, raw) => setFounderPct(i, v, raw)}
                      error={error(`founders.${i}.split`)}
                      hint="Redistributes the same total shares among founders. This is not fully diluted company ownership."
                    />
                  )}
              </div>
            ))}
          </section>
          <section>
            <h2>Employee reserve</h2>
            <div className="input-card">
              <NumberField
                path="employeeReserve"
                label="Employee reserve shares"
                value={scenario.employeeReserve}
                onChange={(v) => update("employeeReserve", v)}
                error={error("employeeReserve")}
              />
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={scenario.employeesOnCapTablePreGrant}
                  onChange={(e) =>
                    update("employeesOnCapTablePreGrant", e.target.checked)
                  }
                />
                Include unallocated reserve before financing
              </label>
              <p className="explanation">
                {scenario.employeesOnCapTablePreGrant
                  ? "The full reserve dilutes initial ownership. Grants transfer reserved shares without creating new shares."
                  : "The reserve is a grant budget. Grants create new shares after the financing shares are priced and dilute all holders, including that round’s investor."}
              </p>
              <p>
                Granted: {number(granted)} · Remaining:{" "}
                {number(Math.max(0, scenario.employeeReserve - granted))}
              </p>
            </div>
          </section>
          <section>
            <div className="section-heading">
              <h2>SAFE assumptions</h2>
              <button
                type="button"
                onClick={() =>
                  add("instruments", {
                    id: createId(),
                    type: "safe",
                    variant: postMoneyReference ? "" : "legacy-generic",
                    holderName: `SAFE holder ${scenario.instruments.length + 1}`,
                    investment: 250_000,
                    valuationCap: null,
                    discountPct: 0,
                  })
                }
              >
                Add SAFE
              </button>
            </div>
            <Field
              path="safeConvention"
              label="SAFE calculation convention"
              error={error("safeConvention")}
            >
              {(attrs) => (
                <select
                  {...attrs}
                  value={conventionOf(scenario)}
                  onChange={(e) => adoptConvention(e.target.value)}
                >
                  {![LEGACY_CONVENTION, POST_MONEY_CONVENTION].includes(
                    conventionOf(scenario),
                  ) && (
                    <option value={conventionOf(scenario)}>
                      Unsupported convention — choose a reference
                    </option>
                  )}
                  <option value={LEGACY_CONVENTION}>
                    Legacy simplified pre-conversion
                  </option>
                  <option value={POST_MONEY_CONVENTION}>
                    Post-money SAFE reference (YC guide)
                  </option>
                </select>
              )}
            </Field>
            {error("calculationVersion") && (
              <p className="field-error" id={fieldId("calculationVersion")}>
                {error("calculationVersion")}{" "}
                {[LEGACY_CONVENTION, POST_MONEY_CONVENTION].includes(
                  conventionOf(scenario),
                ) && (
                  <button
                    type="button"
                    onClick={() => adoptConvention(conventionOf(scenario))}
                  >
                    Adopt displayed convention
                  </button>
                )}
              </p>
            )}
            {postMoneyReference ? (
              <>
                <p className="explanation">
                  Financing pre-money includes SAFE conversions. Calculated
                  shares may be fractional; actual issuance rounding is not
                  modeled. All listed SAFEs convert in the first positive-cash
                  priced round ({firstPricedRound?.name || "none yet"}).
                </p>
                <details>
                  <summary>Supported post-money reference assumptions</summary>
                  <p>
                    Existing grants and unallocated pool must be included before
                    financing. Promised options must already be counted in that
                    existing capitalization. Financing pool increases, later
                    SAFE issuance, legacy/pre-money mixtures, notes, MFN,
                    pro-rata participation, preferences, and exit payouts are
                    unsupported.
                  </p>
                  <p>
                    Cap-only and discount-only follow the US forms described by
                    the{" "}
                    <a href="https://www.ycombinator.com/safe">YC SAFE guide</a>
                    . Combined cap + discount is a custom/historical reference,
                    not a current YC standard form. Choosing a convention
                    changes this case only; duplicate it first to preserve a
                    comparison.
                  </p>
                </details>
              </>
            ) : (
              <p className="explanation">
                Prices use the pre-conversion share count. This is not a
                contractual pre-money or YC post-money SAFE model. Notes,
                interest, MFN, and pro-rata rights are not modeled.
              </p>
            )}
            {scenario.instruments.map((s, i) => {
              const path = `instruments.${i}`;
              const target = s.conversionRoundId ?? "";
              const missing =
                target !== "" &&
                !scenario.rounds.some((r) => String(r.id) === String(target));
              return (
                <div className="input-card" key={s.id}>
                  <div className="section-heading">
                    <h3>SAFE {i + 1}</h3>
                    <button
                      type="button"
                      aria-label={`Remove SAFE ${i + 1}`}
                      onClick={() => remove("instruments", i)}
                    >
                      Remove
                    </button>
                  </div>
                  <TextField
                    path={`${path}.holderName`}
                    label={`SAFE ${i + 1} holder name`}
                    value={s.holderName}
                    onChange={(holderName) =>
                      patch("instruments", i, { holderName })
                    }
                    error={error(`${path}.holderName`)}
                  />
                  <NumberField
                    path={`${path}.investment`}
                    label={`SAFE ${i + 1} investment ($)`}
                    value={s.investment}
                    onChange={(investment) =>
                      patch("instruments", i, { investment })
                    }
                    error={error(`${path}.investment`)}
                  />
                  {postMoneyReference && (
                    <Field
                      path={`${path}.variant`}
                      label={`SAFE ${i + 1} form`}
                      error={error(`${path}.variant`)}
                    >
                      {(attrs) => (
                        <select
                          {...attrs}
                          value={s.variant ?? "legacy-generic"}
                          onChange={(e) =>
                            patch("instruments", i, { variant: e.target.value })
                          }
                        >
                          {!SAFE_VARIANTS.some(
                            (v) => v.value === s.variant,
                          ) && (
                            <option value={s.variant ?? "legacy-generic"}>
                              Choose a supported post-money form
                            </option>
                          )}
                          {SAFE_VARIANTS.map((v) => (
                            <option key={v.value} value={v.value}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </Field>
                  )}
                  {!postMoneyReference && error(`${path}.variant`) && (
                    <p id={fieldId(`${path}.variant`)} className="field-error">
                      {error(`${path}.variant`)}{" "}
                      <button
                        type="button"
                        onClick={() =>
                          patch("instruments", i, { variant: "legacy-generic" })
                        }
                      >
                        Use legacy generic terms
                      </button>
                    </p>
                  )}
                  <NumberField
                    path={`${path}.valuationCap`}
                    label={`SAFE ${i + 1} valuation cap ($)`}
                    value={s.valuationCap ?? 0}
                    onChange={(valuationCap) =>
                      patch("instruments", i, { valuationCap })
                    }
                    hint={
                      postMoneyReference
                        ? "Cap-only and custom combined forms require a positive post-money cap. Discount-only requires zero."
                        : "Zero means uncapped."
                    }
                    error={error(`${path}.valuationCap`)}
                  />
                  <NumberField
                    path={`${path}.discountPct`}
                    label={`SAFE ${i + 1} discount (%)`}
                    value={s.discountPct ?? 0}
                    onChange={(discountPct) =>
                      patch("instruments", i, { discountPct })
                    }
                    error={error(`${path}.discountPct`)}
                    hint={
                      postMoneyReference
                        ? "20% off means the contract Discount Rate is 80%. Cap-only requires zero; discount-only requires a zero cap."
                        : undefined
                    }
                  />
                  <Field
                    path={`${path}.conversionRoundId`}
                    label={`SAFE ${i + 1} conversion round`}
                    error={error(`${path}.conversionRoundId`)}
                    hint={
                      postMoneyReference
                        ? "All listed SAFEs are outstanding before the first priced round. Conversion cannot skip it; later issuance timing is unsupported."
                        : undefined
                    }
                  >
                    {(attrs) => (
                      <select
                        {...attrs}
                        value={target}
                        onChange={(e) =>
                          patch("instruments", i, {
                            conversionRoundId: e.target.value || null,
                          })
                        }
                      >
                        <option value="">
                          First positive-investment round
                        </option>
                        {missing && (
                          <option value={target}>
                            Missing round — choose a replacement
                          </option>
                        )}
                        {scenario.rounds.map((r, ri) => (
                          <option
                            key={r.id}
                            value={r.id}
                            disabled={
                              postMoneyReference &&
                              r.id !== firstPricedRound?.id
                            }
                          >
                            {r.name} (round {ri + 1})
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                </div>
              );
            })}
          </section>
          <section>
            <h2>Funding rounds</h2>
            <div className="add-round">
              <div className="round-template">
                <label htmlFor="round-template">
                  Illustrative round template
                </label>
                <select
                  id="round-template"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                >
                  {ROUND_TEMPLATES.map((t) => (
                    <option key={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={addRound}>
                Add round
              </button>
            </div>
            {scenario.rounds.map((r, i) => {
              const path = `rounds.${i}`;
              const state = result.states[i + 1];
              const previous = result.states[i];
              const unit = r.unit || "M";
              const scale = unit === "M" ? 1_000_000 : 1000;
              return (
                <div className="input-card round-card" key={r.id}>
                  <div className="section-heading">
                    <h3>Round {i + 1}</h3>
                    <div className="round-actions">
                      <button
                        type="button"
                        aria-label={`Move round ${i + 1} up`}
                        disabled={i === 0}
                        onClick={() => moveRound(i, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move round ${i + 1} down`}
                        disabled={i === scenario.rounds.length - 1}
                        onClick={() => moveRound(i, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove round ${i + 1}`}
                        onClick={() => remove("rounds", i)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <TextField
                    path={`${path}.name`}
                    label={`Round ${i + 1} name`}
                    value={r.name}
                    onChange={(name) => patch("rounds", i, { name })}
                    error={error(`${path}.name`)}
                  />
                  <ViewButtons
                    label={`Round ${i + 1} dollar units`}
                    value={unit}
                    onChange={(unit) => patch("rounds", i, { unit })}
                    options={[
                      { value: "K", label: "$ thousands" },
                      { value: "M", label: "$ millions" },
                    ]}
                  />
                  <NumberField
                    path={`${path}.preMoneyVal`}
                    label={`Round ${i + 1} pre-money ($${unit})`}
                    value={r.preMoneyVal}
                    scale={scale}
                    onChange={(preMoneyVal) =>
                      patch("rounds", i, { preMoneyVal })
                    }
                    error={error(`${path}.preMoneyVal`)}
                    hint={
                      postMoneyReference
                        ? "Includes all SAFE conversions in the fully diluted pricing denominator. Existing pool is included; no financing pool increase."
                        : "Prices the shares outstanding before this round’s conversion and new grants."
                    }
                  />
                  <NumberField
                    path={`${path}.investment`}
                    label={`Round ${i + 1} investment ($${unit})`}
                    value={r.investment}
                    scale={scale}
                    onChange={(investment) =>
                      patch("rounds", i, { investment })
                    }
                    error={error(`${path}.investment`)}
                    hint="Zero new cash is allowed, but does not trigger SAFE conversion."
                  />
                  <ViewButtons
                    label={`Round ${i + 1} grant units`}
                    value={r.grantMode}
                    onChange={(grantMode) =>
                      patch("rounds", i, { grantMode, grantValue: 0 })
                    }
                    options={[
                      { value: "shares", label: "Grant shares" },
                      { value: "pct", label: "% of reserve" },
                    ]}
                  />
                  <NumberField
                    path={`${path}.grantValue`}
                    label={`Round ${i + 1} grant (${r.grantMode === "pct" ? "% of total reserve" : "shares"})`}
                    value={r.grantValue}
                    onChange={(grantValue) =>
                      patch("rounds", i, { grantValue })
                    }
                    error={error(`${path}.grantValue`)}
                  />
                  {state && (
                    <div className="round-summary">
                      <p>
                        Capitalization at round price:{" "}
                        <strong>{money(state.postMoney)}</strong>
                      </p>
                      <p>
                        Existing-holder dilution:{" "}
                        {percent(1 - previous.totalShares / state.totalShares)}
                      </p>
                      <p>
                        Grant requested: {number(state.requestedGrantShares)} ·
                        Applied: {number(state.grantShares)} · Unfulfilled:{" "}
                        {number(state.unfulfilledGrantShares)}
                      </p>
                    </div>
                  )}
                  {state?.unfulfilledGrantShares > 0 && (
                    <p className="notice">
                      {number(state.unfulfilledGrantShares)} requested shares
                      were not granted. Increase the reserve or reduce the
                      grant.
                    </p>
                  )}
                </div>
              );
            })}
          </section>
        </aside>
        <div className="results-column">
          {result.warnings.length > 0 && (
            <div className="notice" role="status">
              {result.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          )}
          <ModelResults
            key={currentCase.id}
            result={result}
            scenario={scenario}
          />
        </div>
      </main>
    </>
  );
}

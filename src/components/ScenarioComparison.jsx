import { useEffect, useMemo, useRef, useState } from "react";
import {
  activeCase,
  baselineCase,
  MAX_CASES,
  compareCases,
  changedAssumptions,
} from "../model/comparisonWorkspace.js";
import { CURRENT_SCENARIO_VERSION } from "../model/scenarioSchema.js";
import {
  conventionLabel,
  calculationVersionFor,
} from "../model/safeConventions.js";
import { money, number } from "./ModelFields.jsx";

const ownership = (value) => `${(value * 100).toFixed(3)}%`;
const points = (value) =>
  value == null
    ? "—"
    : `${value > 0.0005 ? "+" : ""}${(Math.abs(value) < 0.0005 ? 0 : value).toFixed(3)} pp`;
function assumptionValue(cell) {
  if (!cell) return "Not included";
  if (cell.format === "money") return money(cell.value);
  if (cell.format === "number") return number(cell.value);
  if (cell.format === "percent") return `${number(cell.value)}%`;
  if (cell.format === "reserve-percent")
    return `${number(cell.value)}% of reserve`;
  return String(cell.value ?? "—");
}

export default function ScenarioComparison({
  workspace,
  valid,
  canDiscard,
  onAction,
  onDiscard,
  undo,
  onUndo,
  status,
}) {
  const current = activeCase(workspace);
  const base = baselineCase(workspace);
  const selectedButton = useRef(null);
  const previousSelection = useRef({
    activeId: current.id,
    baselineId: base.id,
  });
  useEffect(() => {
    if (
      previousSelection.current.activeId !== current.id ||
      previousSelection.current.baselineId !== base.id
    )
      selectedButton.current?.focus();
    previousSelection.current = { activeId: current.id, baselineId: base.id };
  }, [current.id, base.id]);
  const [name, setName] = useState(current.name);
  const [actionError, setActionError] = useState("");
  useEffect(() => {
    setName(current.name);
    setActionError("");
  }, [current.id, current.name]);
  const cases = useMemo(
    () => compareCases(workspace, valid ? [] : [current.id]),
    [workspace, valid, current.id],
  );
  const allValid = cases.every((c) => c.valid);
  const changes = useMemo(
    () => (allValid ? changedAssumptions(cases) : []),
    [cases, allValid],
  );
  const founders = new Map();
  cases.forEach((c) =>
    c.scenario.founders.forEach((f) => {
      if (!founders.has(f.id))
        founders.set(f.id, `${f.name} (founder ${founders.size + 1})`);
    }),
  );
  const act = (action) => {
    try {
      onAction(action);
      setActionError("");
    } catch (error) {
      setActionError(error.message);
    }
  };
  const cell = (c, value) => (c.valid ? value : "Fix inputs");
  return (
    <section
      id="comparison"
      className="comparison"
      aria-labelledby="comparison-title"
    >
      <div className="section-heading">
        <h2 id="comparison-title">Compare financing choices</h2>
        <span>
          {workspace.cases.length} of {MAX_CASES} cases · this browser
        </span>
      </div>
      <p className="explanation">
        Keep a baseline, duplicate it, then edit an alternative. Each case has
        its own inputs. Cloud saves and Excel export use the active case; this
        comparison stays in this browser.
      </p>
      <div
        className="case-picker"
        role="group"
        aria-label="Choose case to edit"
      >
        {workspace.cases.map((item) => (
          <button
            type="button"
            key={item.id}
            ref={item.id === current.id ? selectedButton : undefined}
            aria-pressed={item.id === current.id}
            disabled={!valid && item.id !== current.id}
            onClick={() => act({ type: "switch", id: item.id })}
          >
            {item.name}
            {item.id === base.id ? " · Baseline" : ""}
          </button>
        ))}
      </div>
      <p className="editing-case">
        Editing: <strong>{current.name}</strong>
        {current.id === base.id
          ? " · changes here update the baseline"
          : ` · compared with ${base.name}`}
      </p>
      <div className="case-controls">
        <form
          className="case-name"
          onSubmit={(e) => {
            e.preventDefault();
            act({ type: "rename", name });
          }}
        >
          <label htmlFor="case-name">Active case name</label>
          <div>
            <input
              id="case-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="submit"
              disabled={!valid || name.trim() === current.name}
            >
              Rename case
            </button>
          </div>
        </form>
        <div className="input-actions">
          <button
            type="button"
            disabled={!valid || workspace.cases.length >= MAX_CASES}
            onClick={() => act({ type: "duplicate" })}
          >
            Duplicate active case
          </button>
          <button
            type="button"
            disabled={!valid || current.id === base.id}
            onClick={() => act({ type: "pin" })}
          >
            Pin as baseline
          </button>
          <button
            type="button"
            disabled={current.id === base.id || !cases[0].valid}
            onClick={() => act({ type: "reset" })}
          >
            Reset to baseline
          </button>
          <button
            type="button"
            disabled={current.id === base.id}
            onClick={() => act({ type: "remove" })}
          >
            Remove active case
          </button>
        </div>
      </div>
      {!valid && (
        <p className="notice">
          Fix the active case errors before switching or duplicating.{" "}
          {canDiscard && (
            <button type="button" onClick={onDiscard}>
              Discard invalid edits
            </button>
          )}
        </p>
      )}
      {actionError && (
        <p className="field-error" role="alert">
          {actionError}
        </p>
      )}
      {(status || undo) && (
        <div className="comparison-status" role="status">
          <span>{status}</span>
          {undo && (
            <button type="button" onClick={onUndo}>
              Undo {undo.label}
            </button>
          )}
        </div>
      )}
      {cases.length < 2 ? (
        <p>
          Try “Duplicate active case” to explore raising more, changing a
          valuation, or adjusting grants.
        </p>
      ) : (
        <>
          <p className="explanation">
            Final ownership uses each case’s last modeled stage. “pp” means
            percentage points. New financing cash excludes earlier SAFE
            commitments.
          </p>
          <div
            className="table-scroll"
            role="region"
            aria-label="Comparison outcomes"
            tabIndex={0}
          >
            <table className="comparison-table">
              <caption>Final outcomes compared with {base.name}</caption>
              <thead>
                <tr>
                  <th scope="col">Outcome</th>
                  {cases.map((c, i) => (
                    <th scope="col" key={c.id}>
                      {c.name}
                      {i === 0 && <small>Baseline</small>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Final modeled stage</th>
                  {cases.map((c) => (
                    <td key={c.id}>{cell(c, c.finalStage)}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">New financing cash</th>
                  {cases.map((c) => (
                    <td key={c.id}>{cell(c, money(c.financingCash))}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Cash difference vs baseline</th>
                  {cases.map((c) => (
                    <td key={c.id}>
                      {c.financingDelta == null
                        ? "—"
                        : `${c.financingDelta > 0 ? "+" : ""}${money(c.financingDelta)}`}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">SAFE convention / version</th>
                  {cases.map((c) => (
                    <td key={c.id}>
                      {conventionLabel(c.scenario)}
                      <small>
                        {c.scenario.calculationVersion ??
                          calculationVersionFor(c.scenario)}
                      </small>
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">SAFE cash committed</th>
                  {cases.map((c) => (
                    <td key={c.id}>{cell(c, money(c.safeCash))}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">All founders · final ownership</th>
                  {cases.map((c) => (
                    <td key={c.id}>
                      {cell(c, c.valid && ownership(c.founderOwnership))}
                    </td>
                  ))}
                </tr>
                <tr className="comparison-delta">
                  <th scope="row">Founder ownership vs baseline</th>
                  {cases.map((c) => (
                    <td key={c.id}>{points(c.ownershipDeltaPp)}</td>
                  ))}
                </tr>
                {[...founders].map(([id, label]) => (
                  <tr key={id}>
                    <th scope="row">{label} · final ownership</th>
                    {cases.map((c) => (
                      <td key={c.id}>
                        {cell(
                          c,
                          c.founderHoldings?.[id] == null
                            ? "Not in case"
                            : ownership(c.founderHoldings[id]),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!allValid ? (
            <p className="notice">
              Fix case errors to compare changed assumptions and calculate
              differences from the baseline.
            </p>
          ) : (
            <details className="comparison-assumptions" open>
              <summary>Changed assumptions ({changes.length})</summary>
              {changes.length === 0 ? (
                <p>Inputs are identical. Every outcome difference is zero.</p>
              ) : (
                <div
                  className="table-scroll"
                  role="region"
                  aria-label="Changed assumptions"
                  tabIndex={0}
                >
                  <table className="comparison-table">
                    <caption>Input differences from {base.name}</caption>
                    <thead>
                      <tr>
                        <th scope="col">Assumption</th>
                        {cases.map((c) => (
                          <th scope="col" key={c.id}>
                            {c.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {changes.map((row) => (
                        <tr key={row.key}>
                          <th scope="row">{row.label}</th>
                          {row.cells.map((value, i) => (
                            <td key={cases[i].id}>{assumptionValue(value)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
          )}
        </>
      )}
      <details>
        <summary>Comparison assumptions and model version</summary>
        <p>
          Schema v{CURRENT_SCENARIO_VERSION}. Each case shows its own convention
          and calculation version. Outcomes are recalculated by the same model
          used for individual results and export. Legacy and post-money cases
          can intentionally produce different ownership from equal cash inputs;
          review convention changes alongside the other assumptions.
        </p>
        <p>
          Duplicated cases preserve holder and round identities. Renaming does
          not match unrelated holders; loading an unrelated cloud scenario can
          introduce separate identities. A founder absent from a case is marked
          “Not in case”.
        </p>
        <p>
          Reset copies the current baseline inputs into the active alternative
          and keeps its name. Pinning changes which case is the reference. Undo
          is available for the most recent reset, removal, baseline change, or
          cloud load until another edit.
        </p>
      </details>
    </section>
  );
}

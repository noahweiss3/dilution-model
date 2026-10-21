import { useState } from "react";
import {
  calculateExample,
  PRESETS,
  percent,
  money,
} from "../model/prototypeExample";
import "./prototypes.css";

export const CONCEPTS = [
  {
    id: "review",
    number: "01",
    name: "Financial Review",
    short: "Clarity through restraint.",
    description:
      "A financial statement, made interactive. Upright serif headlines, fine rules, and a sentence-led view of ownership.",
    type: "Source Serif 4 / Source Sans 3",
    structure: "Report · spacious · ownership first",
    palette: ["#252521", "#7f2434", "#e6e6e1", "#ffffff"],
    source: "GOV.UK + USWDS principles",
    best: "Board conversations and deliberate decisions",
  },
  {
    id: "workbench",
    number: "02",
    name: "Analyst Workbench",
    short: "Everything within reach.",
    description:
      "A precise modeling workspace. Persistent assumptions, compact tables, and a direct view of every allocation.",
    type: "IBM Plex Sans / IBM Plex Mono",
    structure: "Split workspace · compact · table first",
    palette: ["#172622", "#006b5e", "#dce7e3", "#f4f6f5"],
    source: "Carbon principles",
    best: "Frequent modeling and detailed inspection",
  },
  {
    id: "studio",
    number: "03",
    name: "Scenario Studio",
    short: "See the tradeoff.",
    description:
      "A comparison canvas. A stable baseline sits beside your proposal, with explicit changes in ownership and value.",
    type: "Manrope / IBM Plex Mono",
    structure: "Comparison canvas · open · change first",
    palette: ["#24292f", "#94500b", "#fff1d6", "#f6f8fa"],
    source: "Primer principles",
    best: "Exploring alternative financing terms",
  },
  {
    id: "terminal",
    number: "04",
    name: "Capital Terminal",
    short: "Signal, without noise.",
    description:
      "A focused dark instrument panel. Strong numerical hierarchy, amber annotations, and a full-width ownership trajectory.",
    type: "IBM Plex Sans / IBM Plex Mono",
    structure: "Instrument panel · dense · chart first",
    palette: ["#191d1c", "#f0bc67", "#8ed2bb", "#414b47"],
    source: "Carbon + Spectrum principles",
    best: "Long sessions and chart-led analysis",
  },
];
const C = Object.fromEntries(CONCEPTS.map((c) => [c.id, c]));
const stageLabels = ["Formation", "SAFE", "Seed", "Series A"];
function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
function Brand() {
  return (
    <span className="brand">
      <Mark />
      Dilution Model
    </span>
  );
}
function Arrow() {
  return <span aria-hidden="true">↗</span>;
}
function MiniBars() {
  return (
    <div className="mini-bars">
      <i />
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

function MiniScreen({ concept }) {
  return (
    <div className={`mini-screen theme-${concept.id}`} aria-hidden="true">
      <div className="mini-top">
        <Mark />
        <span>NORTHSTAR / FINANCING</span>
        <span>USD</span>
      </div>
      {concept.id === "review" ? (
        <div className="mini-report">
          <span>OWNERSHIP REVIEW</span>
          <h3>
            A clear view of
            <br />
            what you retain.
          </h3>
          <div className="mini-result">
            64.80<span>%</span>
          </div>
          <p>Combined founder ownership after Seed</p>
          <MiniBars />
          <div className="mini-rule" />
          <div className="mini-table">
            <span>Maya Chen</span>
            <b>38.88%</b>
            <span>Alex Rivera</span>
            <b>25.92%</b>
          </div>
        </div>
      ) : null}
      {concept.id === "workbench" ? (
        <div className="mini-workbench">
          <div className="mini-rail">
            01
            <br />
            <br />
            02
            <br />
            <br />
            03
          </div>
          <div className="mini-assumptions">
            <b>Seed round</b>
            <span>PRE-MONEY</span>
            <div>$16,000,000</div>
            <span>INVESTMENT</span>
            <div>$4,000,000</div>
            <span className="mini-action">Update model</span>
          </div>
          <div className="mini-data">
            <b>Capitalization</b>
            <div className="mini-table">
              <span>Founders</span>
              <b>64.80%</b>
              <span>Reserve</span>
              <b>7.20%</b>
              <span>SAFE</span>
              <b>8.00%</b>
              <span>Seed</span>
              <b>20.00%</b>
            </div>
            <MiniBars />
          </div>
        </div>
      ) : null}
      {concept.id === "studio" ? (
        <div className="mini-studio">
          <span>COMPARE SCENARIOS</span>
          <h3>
            Better terms.
            <br />
            More ownership.
          </h3>
          <div className="mini-pair">
            <div>
              <small>BASE CASE</small>
              <b>64.80%</b>
              <MiniBars />
            </div>
            <div>
              <small>YOUR PROPOSAL</small>
              <b>69.43%</b>
              <MiniBars />
            </div>
          </div>
          <div className="mini-change">+4.63 pp retained by founders</div>
        </div>
      ) : null}
      {concept.id === "terminal" ? (
        <div className="mini-terminal">
          <div className="mini-terminal-kpi">
            <span>FOUNDER POSITION</span>
            <strong>
              64.80<span>%</span>
            </strong>
            <small>POST-SEED / FULLY DILUTED</small>
          </div>
          <svg viewBox="0 0 420 110">
            <path
              className="mini-grid"
              d="M0 25H420M0 60H420M0 95H420M80 0V110M210 0V110M340 0V110"
            />
            <path className="mini-line" d="M10 10L130 26L265 60L410 90" />
            <circle cx="265" cy="60" r="5" />
          </svg>
          <div className="mini-terminal-labels">
            <span>FORMATION</span>
            <span>SAFE</span>
            <span>SEED</span>
            <span>SERIES A</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Gallery({ favorite, onFavorite }) {
  const [selected, setSelected] = useState(["review", "workbench"]);
  const toggle = (id) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length < 2
          ? [...current, id]
          : [current[1], id],
    );
  return (
    <div className="gallery">
      <header className="gallery-header">
        <a href="/" aria-label="Design study home">
          <Brand />
        </a>
        <span className="study-label">DESIGN STUDY / OCTOBER 2026</span>
        <a className="text-link" href="/model">
          Existing model <Arrow />
        </a>
      </header>
      <main id="main" className="gallery-main">
        <div className="gallery-intro">
          <div>
            <span className="eyebrow">FOUR DIRECTIONS. ONE MODEL.</span>
            <h1>
              Choose how you
              <br />
              see your equity.
            </h1>
          </div>
          <div className="intro-note">
            <p>
              Explore four complete visual systems for the same financing
              example. Try the controls, inspect the components, then mark your
              favorite.
            </p>
            <p className="muted">
              A design prototype with illustrative data. Your saved scenarios
              stay in the existing model.
            </p>
          </div>
        </div>
        {favorite ? (
          <div className="favorite-banner" role="status">
            <span>
              Your current favorite: <strong>{C[favorite].name}</strong>
            </span>
            <a href={`?concept=${favorite}`}>Revisit direction →</a>
            <button onClick={() => onFavorite(null)}>Clear selection</button>
          </div>
        ) : null}
        <div className="concept-grid">
          {CONCEPTS.map((concept) => (
            <article className="concept-card" key={concept.id}>
              <a
                className="preview-link"
                href={`?concept=${concept.id}`}
                aria-label={`Explore ${concept.name}`}
              >
                <MiniScreen concept={concept} />
                <span className="preview-open">
                  Explore direction <Arrow />
                </span>
              </a>
              <div className="concept-card-heading">
                <span className="concept-number">{concept.number}</span>
                <div>
                  <h2>
                    <a href={`?concept=${concept.id}`}>{concept.name}</a>
                  </h2>
                  <p>{concept.short}</p>
                </div>
                <div className="palette" aria-hidden="true">
                  {concept.palette.map((color) => (
                    <span style={{ background: color }} key={color} />
                  ))}
                </div>
              </div>
              <p className="concept-description">{concept.description}</p>
              <div className="card-meta">
                <span>{concept.type}</span>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(concept.id)}
                    onChange={() => toggle(concept.id)}
                  />{" "}
                  Compare
                </label>
              </div>
            </article>
          ))}
        </div>
        <div className="compare-launch">
          <div>
            <h2>Put two directions side by side.</h2>
            <p>Choose two above. Both use the same assumptions and numbers.</p>
          </div>
          <a
            className={`gallery-button ${selected.length !== 2 ? "disabled-link" : ""}`}
            aria-disabled={selected.length !== 2}
            href={
              selected.length === 2
                ? `?compare=${selected.join(",")}`
                : undefined
            }
          >
            Compare {selected.length}/2 <span aria-hidden="true">→</span>
          </a>
        </div>
        <section className="study-notes">
          <span className="eyebrow">WHAT TO LOOK FOR</span>
          <div>
            <h2>More than a color choice.</h2>
            <p>
              Each direction changes the hierarchy, density, typography, editing
              pattern, table treatment, and chart language. Open “System &
              components” inside any direction for its working specimens.
            </p>
          </div>
          <div>
            <h3>One consistent example</h3>
            <p>
              Northstar Labs · two founders · a 10% employee reserve · a $1M
              SAFE · a $4M Seed at $16M pre-money · optional $10M Series A.
            </p>
          </div>
        </section>
        <Research />
      </main>
      <footer className="gallery-footer">
        <Brand />
        <span>
          Made for a visual decision. Selection stays in this tab. No account
          needed.
        </span>
        <span>01 — 04</span>
      </footer>
    </div>
  );
}

function Research() {
  return (
    <details className="research">
      <summary>Research & design rationale</summary>
      <div>
        <p>
          These are original adaptations of established principles, rather than
          official themes or installed component libraries.
        </p>
        <ul>
          <li>
            <a
              href="https://impeccable.style/slop/"
              target="_blank"
              rel="noreferrer"
            >
              Impeccable
            </a>
            : task-led hierarchy, readable labels, and restraint with
            decoration. Applied throughout.
          </li>
          <li>
            <a
              href="https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines"
              target="_blank"
              rel="noreferrer"
            >
              IBM Carbon
            </a>
            : aligned data, consistent row density, and progressive disclosure.
            Applied to Workbench and Terminal.
          </li>
          <li>
            <a
              href="https://designsystem.digital.gov/components/typography/"
              target="_blank"
              rel="noreferrer"
            >
              USWDS
            </a>{" "}
            and{" "}
            <a
              href="https://design-system.service.gov.uk/"
              target="_blank"
              rel="noreferrer"
            >
              GOV.UK
            </a>
            : legibility, persistent field labels, and explicit errors. Applied
            to Review.
          </li>
          <li>
            <a
              href="https://primer.style/product/ui-patterns/progressive-disclosure/"
              target="_blank"
              rel="noreferrer"
            >
              GitHub Primer
            </a>
            : contextual changes and progressive disclosure. Applied to Studio.
          </li>
          <li>
            <a
              href="https://spectrum.adobe.com/"
              target="_blank"
              rel="noreferrer"
            >
              Adobe Spectrum
            </a>{" "}
            and{" "}
            <a
              href="https://atlassian.design/foundations/typography"
              target="_blank"
              rel="noreferrer"
            >
              Atlassian
            </a>
            : consistent tokens, typography hierarchy, and components shown in
            context.
          </li>
        </ul>
        <p>
          All five font families are self-hosted under the SIL Open Font
          License. Licenses are included with the preview source. No paid
          assets.
        </p>
      </div>
    </details>
  );
}

function StudyToolbar({
  concept,
  favorite,
  onFavorite,
  view,
  setView,
  embedded,
}) {
  if (embedded) return null;
  return (
    <div className="study-toolbar">
      <a href="/">← All directions</a>
      <label className="direction-select">
        <span className="sr-only">Design direction</span>
        <select
          value={concept.id}
          onChange={(e) => {
            window.location.search = `?concept=${e.target.value}`;
          }}
        >
          {CONCEPTS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.number} / {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="study-view" aria-label="Preview section">
        {[
          ["app", "App preview"],
          ["system", "System & components"],
        ].map(([id, name]) => (
          <button
            key={id}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {name}
          </button>
        ))}
      </div>
      <button
        className={`favorite-button ${favorite === concept.id ? "is-favorite" : ""}`}
        onClick={() => onFavorite(favorite === concept.id ? null : concept.id)}
        aria-pressed={favorite === concept.id}
      >
        {favorite === concept.id
          ? "✓ Favorite selected"
          : "Choose this direction"}
      </button>
    </div>
  );
}

function Explanation() {
  return (
    <details className="explanation">
      <summary>
        How this example works <span aria-hidden="true">+</span>
      </summary>
      <div>
        <p>
          Maya holds 5.4M shares, Alex 3.6M, and the issued employee reserve 1M.
          The $1M post-money SAFE is assumed to convert into 10% before the
          priced Seed; no discount, interest, or pool top-up is modeled.
        </p>
        <p>
          The Seed investor receives investment ÷ (pre-money + investment).
          Existing holders retain the remainder. Series A adds $10M at $40M
          pre-money, diluting every prior holder by 20%. Founder value is
          ownership × post-money valuation, an illustrative paper value.
        </p>
        <p>
          This simplified design fixture is independent of the production
          calculation engine. It omits real-world conversion terms and
          liquidation preferences.
        </p>
      </div>
    </details>
  );
}
function RoundSwitch({ stage, setStage }) {
  return (
    <div className="round-switch" aria-label="Financing stage">
      <button aria-pressed={stage === "seed"} onClick={() => setStage("seed")}>
        After Seed
      </button>
      <button aria-pressed={stage === "a"} onClick={() => setStage("a")}>
        After Series A
      </button>
    </div>
  );
}

function Assumptions({
  values,
  setValues,
  apply,
  error,
  dirty,
  reset,
  compact = false,
}) {
  return (
    <form
      className={`assumptions ${compact ? "compact-form" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      noValidate
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">ASSUMPTIONS</span>
          <h2>Shape the Seed round</h2>
        </div>
        <span className="section-index">01</span>
      </div>
      <p className="form-intro">Edit the terms to explore founder ownership.</p>
      <label className="field">
        <span>
          Pre-money valuation <small>USD, millions</small>
        </span>
        <div className="input-wrap">
          <span>$</span>
          <input
            aria-label="Pre-money valuation, USD millions"
            aria-describedby={error ? "input-error" : "valuation-hint"}
            aria-invalid={Boolean(error)}
            inputMode="decimal"
            type="number"
            min="0.01"
            max="500"
            step="0.1"
            value={values.valuation}
            onChange={(e) =>
              setValues((v) => ({ ...v, valuation: e.target.value }))
            }
          />
          <span>M</span>
        </div>
        <small id="valuation-hint">Company value before new investment</small>
      </label>
      <label className="field">
        <span>
          New investment <small>USD, millions</small>
        </span>
        <div className="input-wrap">
          <span>$</span>
          <input
            aria-label="New investment, USD millions"
            aria-describedby={error ? "input-error" : "investment-hint"}
            aria-invalid={Boolean(error)}
            inputMode="decimal"
            type="number"
            min="0.01"
            max="100"
            step="0.1"
            value={values.investment}
            onChange={(e) =>
              setValues((v) => ({ ...v, investment: e.target.value }))
            }
          />
          <span>M</span>
        </div>
        <small id="investment-hint">Capital raised in the priced Seed</small>
      </label>
      <div className="fixed-assumptions">
        <span>
          Founders <b>2 / 9.0M shares</b>
        </span>
        <span>
          Employee reserve <b>10% upfront</b>
        </span>
        <span>
          Post-money SAFE <b>$1M / $10M cap</b>
        </span>
      </div>
      {error ? (
        <p className="input-error" id="input-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="form-actions">
        <button className="primary" type="submit" disabled={!dirty}>
          Update example <span aria-hidden="true">→</span>
        </button>
        <button type="button" className="secondary" onClick={reset}>
          Reset
        </button>
      </div>
      <p className="form-status" aria-live="polite">
        {error
          ? "Check the values above."
          : dirty
            ? "Unapplied changes"
            : "Example is up to date"}
      </p>
    </form>
  );
}

function Allocation({ example, paired = false }) {
  return (
    <div className={`allocation ${paired ? "paired-allocation" : ""}`}>
      <div className="section-heading">
        <h2>Who owns what</h2>
        <span className="quiet">Fully diluted</span>
      </div>
      <div
        className="allocation-stack"
        role="img"
        aria-label={`Founder ownership ${percent(example.founders)}. Full breakdown below.`}
      >
        {example.holders.map((row) => (
          <span
            key={row.name}
            className={`color-${row.color}`}
            style={{ width: `${row.after}%` }}
          />
        ))}
      </div>
      <div className="allocation-list">
        {example.holders.map((row) => (
          <div key={row.name}>
            <span>
              <i className={`color-${row.color}`} />
              {row.name}
            </span>
            {paired ? (
              <div className="allocation-track">
                <span
                  className={`color-${row.color}`}
                  style={{ width: `${row.after}%` }}
                />
              </div>
            ) : null}
            <b>{percent(row.after)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function CapTable({ example }) {
  return (
    <div className="cap-table">
      <div className="section-heading">
        <h2>Capitalization table</h2>
        <span className="quiet">% of fully diluted equity</span>
      </div>
      <p className="table-scroll-hint">Scroll table to see all columns →</p>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Capitalization table, scroll horizontally if needed"
      >
        <table>
          <caption className="sr-only">
            Northstar Labs illustrative ownership, before financing and after
            the selected round
          </caption>
          <thead>
            <tr>
              <th scope="col">Stakeholder</th>
              <th scope="col">Formation</th>
              <th scope="col">Selected round</th>
              <th scope="col">Change, pp</th>
            </tr>
          </thead>
          <tbody>
            {example.holders.map((row) => (
              <tr key={row.name}>
                <th scope="row">
                  <span>
                    <i className={`color-${row.color}`} />
                    {row.name}
                  </span>
                  <small>{row.type}</small>
                </th>
                <td>{percent(row.before)}</td>
                <td>{percent(row.after)}</td>
                <td>
                  {row.after >= row.before ? "+" : "−"}
                  {Math.abs(row.after - row.before).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td>100.00%</td>
              <td>100.00%</td>
              <td>0.00</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Trajectory({ example, stage, kind = "line" }) {
  const [active, setActive] = useState(2);
  const values = example.history;
  const x = [50, 225, 400, 575];
  const y = values.map((v) => 210 - v * 1.8);
  return (
    <div className={`trajectory trajectory-kind-${kind}`}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE FINANCING PATH</span>
          <h2>Founder ownership over time</h2>
        </div>
        <span className="quiet">Combined / %</span>
      </div>
      {kind === "bars" ? (
        <div className="trajectory-bars">
          {values.map((v, i) => (
            <button
              key={stageLabels[i]}
              className={active === i ? "active" : ""}
              onClick={() => setActive(i)}
              aria-label={`${stageLabels[i]}, ${percent(v)} founder ownership`}
              aria-pressed={active === i}
            >
              <b>{percent(v)}</b>
              <span className="bar-well">
                <i style={{ height: `${v}%` }} />
              </span>
              <small>{stageLabels[i]}</small>
            </button>
          ))}
        </div>
      ) : (
        <svg
          viewBox="0 0 630 260"
          role="img"
          aria-label={`Founder ownership: Formation 90%, SAFE 81%, Seed ${percent(values[2])}, Series A ${percent(values[3])}.`}
        >
          <g className="chart-grid">
            {[20, 40, 60, 80, 100].map((v) => (
              <g key={v}>
                <line x1="40" y1={210 - v * 1.8} x2="610" y2={210 - v * 1.8} />
                <text x="4" y={214 - v * 1.8}>
                  {v}
                </text>
              </g>
            ))}
          </g>
          <path
            className="chart-area"
            d={`M${x[0]} 210 ${x.map((v, i) => `L${v} ${y[i]}`).join(" ")} L575 210Z`}
          />
          <path
            className="chart-line"
            d={`M${x.map((v, i) => `${v} ${y[i]}`).join(" L")}`}
          />
          {x.map((v, i) => (
            <g
              key={v}
              className={
                (stage === "seed" ? i === 2 : i === 3) ? "selected-point" : ""
              }
            >
              <circle cx={v} cy={y[i]} r="4" />
              <text
                className="point-value"
                x={v}
                y={y[i] - 14}
                textAnchor="middle"
              >
                {percent(values[i])}
              </text>
              <text className="point-label" x={v} y="240" textAnchor="middle">
                {stageLabels[i]}
              </text>
            </g>
          ))}
        </svg>
      )}
      {kind === "line" ? (
        <div className="chart-mobile-values">
          {values.map((value, i) => (
            <div key={stageLabels[i]}>
              <span>{stageLabels[i]}</span>
              <b>{percent(value)}</b>
            </div>
          ))}
        </div>
      ) : null}
      <p className="chart-caption">
        {kind === "bars"
          ? `${stageLabels[active]}: founders retain ${percent(values[active])}. `
          : ""}
        Series A is a $10M raise at $40M pre-money. All stages are illustrative.
      </p>
    </div>
  );
}

function Waterfall({ example, stage }) {
  const max = Math.max(...example.valueHistory) * 1.12;
  return (
    <div className="value-waterfall">
      <div className="section-heading">
        <h2>Founder value waterfall</h2>
        <span className="quiet">Paper value / USD</span>
      </div>
      <div className="waterfall-chart">
        {example.valueHistory.map((value, i) => {
          const previous = i ? example.valueHistory[i - 1] : 0;
          const delta = value - previous;
          return (
            <div
              key={i}
              className={`waterfall-column ${(stage === "seed" ? i === 2 : i === 3) ? "current" : ""}`}
            >
              <b>{money(value)}</b>
              <div className="waterfall-plot">
                <span
                  className="waterfall-connector"
                  style={{ bottom: `${(value / max) * 100}%` }}
                />
                <i
                  className={delta < 0 ? "decrease" : ""}
                  style={{
                    bottom: `${(Math.min(value, previous) / max) * 100}%`,
                    height: `${(Math.abs(delta) / max) * 100}%`,
                  }}
                />
              </div>
              <span>{stageLabels[i]}</span>
              <small>
                {i === 0
                  ? "Starting value"
                  : `${delta >= 0 ? "+" : "−"}${money(Math.abs(delta))}`}
              </small>
            </div>
          );
        })}
      </div>
      <p className="chart-caption">
        Bars bridge the change in founder paper value at each stage. Ownership ×
        post-money valuation; no liquidation preferences.
      </p>
    </div>
  );
}

function ScreenHeader({ scenario, setScenario }) {
  return (
    <header className="app-header">
      <Brand />
      <span className="workspace-label">
        NORTHSTAR LABS <span>/</span> FINANCING PLAN
      </span>
      <label>
        <span className="sr-only">Scenario</span>
        <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
          <option value="base">Base case</option>
          <option value="efficient">Capital efficient</option>
        </select>
      </label>
      <span className="prototype-tag">PROTOTYPE DATA</span>
    </header>
  );
}

function ReviewScreen({ model }) {
  const { example, stage, setStage } = model;
  return (
    <div className="review-content">
      <div className="review-masthead">
        <span className="eyebrow">NORTHSTAR LABS / OWNERSHIP REVIEW</span>
        <span>ILLUSTRATIVE FINANCING MEMO · 001</span>
      </div>
      <div className="review-title">
        <h1>
          Ownership,
          <br />
          after financing.
        </h1>
        <div>
          <RoundSwitch stage={stage} setStage={setStage} />
          <p>
            Two founders. One financing plan.
            <br />
            Every percentage accounted for.
          </p>
        </div>
      </div>
      <div className="review-result">
        <div>
          <span className="eyebrow">COMBINED FOUNDER OWNERSHIP</span>
          <strong>
            {example.founders.toFixed(2)}
            <span>%</span>
          </strong>
        </div>
        <p>
          After the {stage === "seed" ? "Seed round" : "Series A"}, founders
          retain <b>{percent(example.founders)}</b> of Northstar, representing{" "}
          <b>{money(example.founderValue)}</b> in illustrative paper value.
        </p>
        <div className="review-value">
          <span>POST-MONEY VALUATION</span>
          <b>{money(example.postMoney)}</b>
          <small>Selected financing stage</small>
        </div>
      </div>
      <div className="review-body">
        <div>
          <Allocation example={example} paired />
          <CapTable example={example} />
        </div>
        <aside>
          <Assumptions {...model.form} />
          <Explanation />
        </aside>
      </div>
      <div className="review-bottom">
        <Trajectory example={example} stage={stage} kind="bars" />
        <Waterfall example={example} stage={stage} />
      </div>
    </div>
  );
}

function WorkbenchScreen({ model }) {
  const { example, stage, setStage } = model;
  const [tab, setTab] = useState("cap");
  return (
    <div className="workbench-content">
      <aside className="workbench-sidebar">
        <div className="sidebar-title">
          <span className="eyebrow">MODEL INPUTS</span>
          <strong>Northstar Labs</strong>
          <small>Illustrative scenario / USD</small>
        </div>
        <Assumptions {...model.form} compact />
        <Explanation />
      </aside>
      <section className="workbench-main">
        <div className="workbench-title">
          <div>
            <span className="eyebrow">WORKSPACE / FINANCING</span>
            <h1>Capitalization</h1>
          </div>
          <RoundSwitch stage={stage} setStage={setStage} />
        </div>
        <div className="workbench-metrics">
          <div>
            <span>Founder ownership</span>
            <strong>{percent(example.founders)}</strong>
            <small>Combined, fully diluted</small>
          </div>
          <div>
            <span>Post-money value</span>
            <strong>{money(example.postMoney)}</strong>
            <small>Selected financing stage</small>
          </div>
          <div>
            <span>Capital raised</span>
            <strong>{money(example.totalRaised)}</strong>
            <small>Includes $1M SAFE</small>
          </div>
          <div>
            <span>New investor stake</span>
            <strong>{percent(example.newInvestor)}</strong>
            <small>Current priced round</small>
          </div>
        </div>
        <div className="workspace-tabs" aria-label="Model view">
          <button aria-pressed={tab === "cap"} onClick={() => setTab("cap")}>
            01 Capitalization
          </button>
          <button aria-pressed={tab === "path"} onClick={() => setTab("path")}>
            02 Financing path
          </button>
        </div>
        {tab === "cap" ? (
          <>
            <CapTable example={example} />
            <div className="workbench-bottom">
              <Allocation example={example} />
              <Waterfall example={example} stage={stage} />
            </div>
          </>
        ) : (
          <>
            <Trajectory example={example} stage={stage} />
            <Waterfall example={example} stage={stage} />
          </>
        )}
        <div className="model-note">
          <span aria-hidden="true">↳</span>
          <p>
            Issued employee reserve is included from formation. SAFE conversion
            is simplified to 10% before Seed. <b>Illustrative results only.</b>
          </p>
        </div>
      </section>
    </div>
  );
}

function StudioScreen({ model }) {
  const { example, stage, setStage } = model;
  const baseline = calculateExample(4, 16, stage);
  const delta = example.founders - baseline.founders;
  return (
    <div className="studio-content">
      <div className="studio-title">
        <div>
          <span className="eyebrow">SCENARIO EXPLORER</span>
          <h1>Every term has a tradeoff.</h1>
          <p>Compare a financing proposal against the original base case.</p>
        </div>
        <RoundSwitch stage={stage} setStage={setStage} />
      </div>
      <div className="studio-canvas">
        <div className="studio-baseline">
          <div className="scenario-caption">
            <span>01 / BASELINE</span>
            <span>Fixed reference</span>
          </div>
          <h2>Base case</h2>
          <p>$4M Seed · $16M pre-money</p>
          <div className="studio-big-number">
            <span>Founder ownership</span>
            <strong>{percent(baseline.founders)}</strong>
            <small>
              {money(baseline.founderValue)} illustrative paper value
            </small>
          </div>
          <Allocation example={baseline} />
        </div>
        <div className="studio-proposal">
          <div className="scenario-caption">
            <span>02 / YOUR PROPOSAL</span>
            <span>Editable terms</span>
          </div>
          <h2>
            {model.scenario === "efficient"
              ? "Capital efficient"
              : "Working proposal"}
          </h2>
          <p>Change the assumptions below to see the difference.</p>
          <div className="studio-big-number">
            <span>Founder ownership</span>
            <strong>{percent(example.founders)}</strong>
            <small className="delta">
              {delta >= 0 ? "+" : "−"}
              {Math.abs(delta).toFixed(2)} percentage points vs baseline
            </small>
          </div>
          <Assumptions {...model.form} compact />
        </div>
      </div>
      <div className="studio-comparison">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE DIFFERENCE</span>
            <h2>A side-by-side ownership check</h2>
          </div>
          <span className="quiet">Changes in percentage points</span>
        </div>
        <p className="table-scroll-hint">Scroll table to see all columns →</p>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Scenario comparison, scroll horizontally to see all columns"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Stakeholder</th>
                <th scope="col">Base case</th>
                <th scope="col">Your proposal</th>
                <th scope="col">Change, pp</th>
              </tr>
            </thead>
            <tbody>
              {example.holders.map((row, i) => {
                const change = row.after - baseline.holders[i].after;
                return (
                  <tr key={row.name}>
                    <th scope="row">{row.name}</th>
                    <td>{percent(baseline.holders[i].after)}</td>
                    <td
                      className={Math.abs(change) > 0.001 ? "changed-cell" : ""}
                    >
                      {percent(row.after)}
                    </td>
                    <td>
                      {change >= 0 ? "+" : "−"}
                      {Math.abs(change).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="studio-bottom">
        <Trajectory example={example} stage={stage} kind="bars" />
        <div>
          <Waterfall example={example} stage={stage} />
          <Explanation />
        </div>
      </div>
    </div>
  );
}

function TerminalScreen({ model }) {
  const { example, stage, setStage } = model;
  const [tab, setTab] = useState("allocation");
  return (
    <div className="terminal-content">
      <div className="terminal-title">
        <div>
          <span className="eyebrow">NORTHSTAR LABS / EQUITY INSTRUMENTS</span>
          <h1>Founder position</h1>
        </div>
        <RoundSwitch stage={stage} setStage={setStage} />
      </div>
      <div className="terminal-top">
        <div className="terminal-position">
          <span className="eyebrow">COMBINED OWNERSHIP</span>
          <strong>
            {example.founders.toFixed(2)}
            <span>%</span>
          </strong>
          <div>
            <span>FULLY DILUTED</span>
            <b>{stage === "seed" ? "POST-SEED" : "POST-SERIES A"}</b>
          </div>
        </div>
        <div className="terminal-readout">
          <span>POST-MONEY</span>
          <strong>{money(example.postMoney)}</strong>
          <span>FOUNDER PAPER VALUE</span>
          <strong>{money(example.founderValue)}</strong>
        </div>
        <div className="terminal-assumption">
          <span className="eyebrow">CURRENT SEED TERMS</span>
          <p>
            <b>{money(Number(model.applied.investment))}</b> investment
            <br />
            at <b>{money(Number(model.applied.valuation))}</b> pre-money
          </p>
          <span className="quiet">$1M SAFE / 10% reserve</span>
        </div>
      </div>
      <Trajectory example={example} stage={stage} />
      <div className="terminal-lower">
        <div>
          <div className="workspace-tabs" aria-label="Terminal view">
            <button
              aria-pressed={tab === "allocation"}
              onClick={() => setTab("allocation")}
            >
              01 / Cap table
            </button>
            <button
              aria-pressed={tab === "value"}
              onClick={() => setTab("value")}
            >
              02 / Value waterfall
            </button>
          </div>
          {tab === "allocation" ? (
            <CapTable example={example} />
          ) : (
            <Waterfall example={example} stage={stage} />
          )}
          <Explanation />
        </div>
        <aside>
          <Assumptions {...model.form} compact />
        </aside>
      </div>
    </div>
  );
}

function SystemSpecimens({ concept, model }) {
  const [notice, setNotice] = useState(false);
  return (
    <div className="system-specimens">
      <div className="system-intro">
        <span className="eyebrow">{concept.number} / SYSTEM & COMPONENTS</span>
        <h1>{concept.name}</h1>
        <p>{concept.description}</p>
        <span className="system-reference">
          Informed by {concept.source}. An original adaptation.
        </span>
      </div>
      <div className="specimen-grid">
        <section className="type-specimen">
          <span className="eyebrow">01 / TYPOGRAPHY</span>
          <h2>Numbers need a clear voice.</h2>
          <div className="type-display">
            64.80<span>%</span>
          </div>
          <p>{concept.type}</p>
          <p className="type-sample">
            ABCDEFGHIJKLMNOPQRSTUVWXYZ
            <br />
            abcdefghijklmnopqrstuvwxyz
            <br />
            0123456789 $ € % + −
          </p>
          <small>
            Upright type. Tabular numerals. Self-hosted, SIL Open Font License.
          </small>
        </section>
        <section className="color-specimen">
          <span className="eyebrow">02 / PALETTE & GEOMETRY</span>
          <div className="system-swatches">
            {concept.palette.map((color) => (
              <div key={color}>
                <span style={{ background: color }} />
                <code>{color.toUpperCase()}</code>
              </div>
            ))}
          </div>
          <dl>
            <div>
              <dt>Controls</dt>
              <dd>
                {concept.id === "studio"
                  ? "4px corners"
                  : concept.id === "review"
                    ? "2px corners"
                    : "Square corners"}
              </dd>
            </div>
            <div>
              <dt>Spacing</dt>
              <dd>4 / 8 / 12 / 16 / 24 / 32</dd>
            </div>
            <div>
              <dt>Interaction</dt>
              <dd>Visible focus · labeled inputs</dd>
            </div>
          </dl>
        </section>
        <section className="button-specimen">
          <span className="eyebrow">03 / ACTIONS & FEEDBACK</span>
          <h2>A clear next action.</h2>
          <div className="specimen-buttons">
            <button className="primary" onClick={() => setNotice(true)}>
              Apply changes →
            </button>
            <button className="secondary" onClick={() => setNotice(false)}>
              Reset notice
            </button>
            <button className="primary" disabled>
              Unavailable
            </button>
          </div>
          <p className="notice" role="status">
            {notice
              ? "✓ Example updated. Your changes are reflected below."
              : "Information: this is a design prototype with sample data."}
          </p>
          <p className="notice notice-warning">
            Review assumption: this example uses a simplified SAFE conversion.
          </p>
          <label className="field specimen-error">
            <span>
              Investment amount <small>Error specimen</small>
            </span>
            <input
              value=""
              readOnly
              aria-invalid="true"
              aria-describedby="specimen-error"
            />
            <small id="specimen-error">
              Enter an investment greater than zero.
            </small>
          </label>
        </section>
        <section className="input-specimen">
          <Assumptions {...model.form} />
        </section>
        <section className="table-specimen">
          <span className="eyebrow">04 / TABULAR DATA</span>
          <CapTable example={model.example} />
        </section>
        <section className="chart-specimen">
          <span className="eyebrow">05 / DATA VISUALIZATION</span>
          <Trajectory
            example={model.example}
            stage={model.stage}
            kind={["review", "studio"].includes(concept.id) ? "bars" : "line"}
          />
        </section>
      </div>
      <Explanation />
    </div>
  );
}

function Concept({ concept, favorite, onFavorite, embedded = false }) {
  const [view, setView] = useState("app");
  const [scenario, setScenarioState] = useState("base");
  const [values, setValues] = useState({ investment: "4", valuation: "16" });
  const [applied, setApplied] = useState(values);
  const [stage, setStage] = useState("seed");
  const [error, setError] = useState("");
  const dirty =
    values.investment !== applied.investment ||
    values.valuation !== applied.valuation;
  function apply() {
    try {
      calculateExample(Number(values.investment), Number(values.valuation));
      setApplied(values);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  function setScenario(id) {
    const next = {
      investment: String(PRESETS[id].investment),
      valuation: String(PRESETS[id].valuation),
    };
    setScenarioState(id);
    setValues(next);
    setApplied(next);
    setError("");
  }
  function reset() {
    setScenario("base");
  }
  const example = calculateExample(
    Number(applied.investment),
    Number(applied.valuation),
    stage,
  );
  const model = {
    example,
    stage,
    setStage,
    scenario,
    applied,
    form: { values, setValues, apply, dirty, error, reset },
  };
  const Screen = {
    review: ReviewScreen,
    workbench: WorkbenchScreen,
    studio: StudioScreen,
    terminal: TerminalScreen,
  }[concept.id];
  return (
    <div
      className={`concept theme-${concept.id} ${embedded ? "is-embedded" : ""}`}
    >
      <StudyToolbar
        {...{ concept, favorite, onFavorite, view, setView, embedded }}
      />
      <main className="prototype-app" id="main">
        {view === "system" ? (
          <SystemSpecimens concept={concept} model={model} />
        ) : (
          <>
            <ScreenHeader scenario={scenario} setScenario={setScenario} />
            <Screen model={model} />
            <footer className="app-footer">
              <span>ILLUSTRATIVE DATA / NOT MODEL ADVICE</span>
              <span>
                {concept.number} / {concept.name}
              </span>
              <button
                onClick={() => {
                  setView("system");
                  window.scrollTo(0, 0);
                }}
              >
                Inspect system & components →
              </button>
            </footer>
          </>
        )}
      </main>
      {favorite === concept.id && !embedded ? (
        <div className="selection-note" role="status">
          {concept.name} is your selected direction.{" "}
          <a href="/">Compare with the others →</a>
        </div>
      ) : null}
    </div>
  );
}

function Compare({ ids, favorite, onFavorite }) {
  return (
    <div className="compare-page">
      <header className="compare-header">
        <a href="/">← All directions</a>
        <Brand />
        <span>Side-by-side comparison</span>
      </header>
      <main id="main">
        <div className="compare-intro">
          <h1>Same model. Different perspective.</h1>
          <p>
            Explore both previews independently. At narrow widths they stack in
            reading order.
          </p>
        </div>
        <div className="compare-columns">
          {ids.map((id) => (
            <section key={id}>
              <div className="compare-column-heading">
                <div>
                  <span>
                    {C[id].number} / {C[id].structure}
                  </span>
                  <h2>{C[id].name}</h2>
                </div>
                <button
                  aria-pressed={favorite === id}
                  onClick={() => onFavorite(favorite === id ? null : id)}
                >
                  {favorite === id ? "✓ Selected" : "Choose this"}
                </button>
              </div>
              <iframe
                title={`${C[id].name} interactive preview`}
                src={`?concept=${id}&embedded=1`}
              />
              <a className="text-link" href={`?concept=${id}`}>
                Open full preview & component system <Arrow />
              </a>
            </section>
          ))}
        </div>
        <div className="compare-details">
          {ids.map((id) => (
            <div key={id}>
              <h2>{C[id].name}</h2>
              <p>{C[id].description}</p>
              <p>
                <b>Typography:</b> {C[id].type}
              </p>
              <p>
                <b>Best for:</b> {C[id].best}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function PrototypeApp() {
  const params = new URLSearchParams(window.location.search);
  const [favorite, setFavoriteState] = useState(() => {
    try {
      const saved =
        params.get("favorite") ||
        sessionStorage.getItem("dilution-design-favorite");
      return C[saved] ? saved : null;
    } catch {
      return null;
    }
  });
  function setFavorite(id) {
    setFavoriteState(id);
    try {
      if (id) sessionStorage.setItem("dilution-design-favorite", id);
      else sessionStorage.removeItem("dilution-design-favorite");
    } catch {
      /* Selection still works without storage. */
    }
  }
  const concept = C[params.get("concept")];
  const compare = [
    ...new Set((params.get("compare") || "").split(",").filter((id) => C[id])),
  ].slice(0, 2);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {concept ? (
        <Concept
          concept={concept}
          favorite={favorite}
          onFavorite={setFavorite}
          embedded={params.get("embedded") === "1"}
        />
      ) : compare.length === 2 ? (
        <Compare ids={compare} favorite={favorite} onFavorite={setFavorite} />
      ) : (
        <Gallery favorite={favorite} onFavorite={setFavorite} />
      )}
    </>
  );
}

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { chartSnapshots, founderKey } from "../model/dilutionEngine.js";
import {
  compactMoney,
  money,
  number,
  percent,
  ViewButtons,
} from "./ModelFields.jsx";
const COLORS = [
  "#9b8cff",
  "#ff8fac",
  "#76eab3",
  "#ffc181",
  "#8dc8ff",
  "#f6a0f7",
];

export default function ModelResults({ result, scenario }) {
  const [view, setView] = useState("chart");
  const [mode, setMode] = useState("pct");
  const [selected, setSelected] = useState("");
  const { states, holders } = result;
  if (result.errors.length)
    return (
      <section id="results" className="results" aria-label="Results">
        <h2>Results need valid inputs</h2>
        <p>
          Fix the listed errors to calculate ownership. Invalid results are not
          saved or exported.
        </p>
      </section>
    );
  const last = states.at(-1);
  const founder =
    scenario.founders.find((f) => f.id === selected) || scenario.founders[0];
  const fi = scenario.founders.indexOf(founder);
  const key = founderKey(founder, fi);
  const start = states[0].ownership[key] || 0;
  const end = last.ownership[key] || 0;
  const data = chartSnapshots(result, mode);
  return (
    <section id="results" className="results" aria-label="Results">
      <div className="section-heading">
        <h2>Your ownership outcome</h2>
        <div className="inline-label">
          <label htmlFor="selected-founder">Founder</label>
          <select
            id="selected-founder"
            value={founder.id}
            onChange={(e) => setSelected(e.target.value)}
          >
            {scenario.founders.map((f, i) => (
              <option key={f.id} value={f.id}>
                {f.name} (founder {i + 1})
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="metrics">
        <div>
          <span>Starting ownership</span>
          <strong>{percent(start)}</strong>
        </div>
        <div>
          <span>Final ownership</span>
          <strong>{percent(end)}</strong>
        </div>
        <div>
          <span>Ownership change</span>
          <strong>{((end - start) * 100).toFixed(2)} pp</strong>
        </div>
        <div>
          <span>New financing cash</span>
          <strong
            title={money(scenario.rounds.reduce((s, r) => s + r.investment, 0))}
            aria-label={money(
              scenario.rounds.reduce((s, r) => s + r.investment, 0),
            )}
          >
            {compactMoney(
              scenario.rounds.reduce((s, r) => s + r.investment, 0),
            )}
          </strong>
        </div>
      </div>
      <p className="explanation">
        Company ownership includes issued shares and the unallocated reserve
        when you include it on the cap table. Unconverted SAFEs are excluded.
        Changes marked “pp” are percentage points.
      </p>
      <div className="results-toolbar">
        <ViewButtons
          label="Result view"
          value={view}
          onChange={setView}
          options={[
            { value: "chart", label: "Ownership chart" },
            { value: "table", label: "Cap table" },
            { value: "financing", label: "Financing values" },
          ]}
        />
        {view !== "financing" && (
          <ViewButtons
            label="Ownership units"
            value={mode}
            onChange={setMode}
            options={[
              { value: "pct", label: "% equity" },
              { value: "shares", label: "# shares" },
            ]}
          />
        )}
      </div>
      {view === "chart" && (
        <>
          <h3>
            {mode === "pct"
              ? "Ownership at each stage"
              : "Shares at each stage"}
          </h3>
          <p className="explanation">
            Each column is a discrete cap-table snapshot. Use the cap table for
            exact values.
          </p>
          <div
            className="ownership-chart"
            role="img"
            aria-label="Stacked ownership by funding stage. Exact values are available in the Cap table view."
          >
            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                data={data}
                margin={{ top: 12, left: 0, right: 8, bottom: 8 }}
                accessibilityLayer
              >
                <CartesianGrid stroke="#343446" vertical={false} />
                <XAxis
                  dataKey="stageId"
                  tickFormatter={(id) =>
                    states.find((s) => s.stageId === id)?.label
                  }
                  tick={{ fill: "#c4c4d4", fontSize: 12 }}
                />
                <YAxis
                  domain={mode === "pct" ? [0, 100] : [0, "auto"]}
                  tickFormatter={(v) => (mode === "pct" ? `${v}%` : number(v))}
                  width={mode === "pct" ? 45 : 75}
                  tick={{ fill: "#c4c4d4", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#171724",
                    border: "1px solid #626278",
                    color: "#f2f2f8",
                  }}
                  labelFormatter={(id) =>
                    states.find((s) => s.stageId === id)?.label
                  }
                  formatter={(v, name) => [
                    mode === "pct" ? `${Number(v).toFixed(2)}%` : number(v),
                    name,
                  ]}
                />
                {holders.map((h, i) => (
                  <Bar
                    key={h.key}
                    dataKey={h.key}
                    name={h.displayName}
                    stackId="ownership"
                    fill={COLORS[i % COLORS.length]}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            {holders.map((h, i) => (
              <span key={h.key}>
                <i style={{ background: COLORS[i % COLORS.length] }} />
                {h.displayName}
              </span>
            ))}
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => setView("table")}
          >
            View exact cap-table values
          </button>
        </>
      )}
      {view === "table" && (
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Cap table, scroll horizontally for all rounds"
        >
          <table>
            <caption>
              Ownership by stakeholder and stage
              {mode === "shares" ? " — whole shares" : " — company equity"}
            </caption>
            <thead>
              <tr>
                <th scope="col">Stakeholder</th>
                {states.map((s) => (
                  <th scope="col" key={s.stageId}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holders.map((h) => (
                <tr key={h.key}>
                  <th scope="row">{h.displayName}</th>
                  {states.map((s, i) => {
                    const v = s.ownership[h.key] || 0;
                    const prev = i ? states[i - 1].ownership[h.key] || 0 : null;
                    return (
                      <td key={s.stageId}>
                        {mode === "shares"
                          ? number(s.holderShares[h.key] || 0)
                          : percent(v)}
                        {mode === "pct" &&
                          prev != null &&
                          prev > 0 &&
                          Math.abs(v - prev) > 0.000001 && (
                            <small>{((v - prev) * 100).toFixed(2)} pp</small>
                          )}
                        {s.pricePerShare != null && (
                          <small>
                            {money(
                              (s.holderShares[h.key] || 0) * s.pricePerShare,
                            )}{" "}
                            at round price
                          </small>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="total-row">
                <th scope="row">Total</th>
                {states.map((s) => (
                  <td key={s.stageId}>
                    {mode === "shares"
                      ? number(s.totalShares)
                      : percent(
                          Object.values(s.ownership).reduce((a, b) => a + b, 0),
                        )}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Capitalization at round price</th>
                {states.map((s) => (
                  <td key={s.stageId}>{money(s.postMoney)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Price per share</th>
                {states.map((s) => (
                  <td key={s.stageId}>
                    {s.pricePerShare == null
                      ? "—"
                      : `$${number(s.pricePerShare)}`}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {view === "financing" && (
        <>
          <h3>Financing values</h3>
          <p className="explanation">
            Pricing pre-money, new financing cash, and capitalization at the
            round price. These values are not exit proceeds or a liquidation
            waterfall.
          </p>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Financing values"
          >
            <table>
              <caption>Round-price values</caption>
              <thead>
                <tr>
                  <th scope="col">Round</th>
                  <th scope="col">Pricing pre-money</th>
                  <th scope="col">New cash</th>
                  <th scope="col">Capitalization at round price</th>
                  <th scope="col">Selected founder value</th>
                </tr>
              </thead>
              <tbody>
                {states.slice(1).map((s) => (
                  <tr key={s.stageId}>
                    <th scope="row">{s.label}</th>
                    <td>{money(s.preMoney)}</td>
                    <td>{money(s.investment)}</td>
                    <td>{money(s.postMoney)}</td>
                    <td>
                      {money((s.holderShares[key] || 0) * s.pricePerShare)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="explanation">
        Values at the round price are paper values. They do not model
        liquidation preferences, taxes, voting rights, or cash proceeds from a
        sale.
      </p>
      <details className="model-details">
        <summary>Calculation convention and round bridges</summary>
        <p>
          Simplified pre-conversion pricing ({result.calculationVersion}): each
          round prices the shares outstanding before that round’s SAFE
          conversion and newly issued grants. Cap price uses the same
          denominator. This is not a contractual pre-money or YC post-money SAFE
          model.
        </p>
        <p>
          Capitalization at round price includes the marked value of conversion
          and newly issued grant shares. Those amounts are not additional cash
          raised. Investors receive the nearest whole share; the bridge includes
          the resulting monetary adjustment.
        </p>
        {states.slice(1).map((s) => (
          <div className="bridge" key={s.stageId}>
            <h3>{s.label}</h3>
            <p>
              {number(s.pricingShares)} starting shares +{" "}
              {number(s.safeConversionShares)} SAFE shares +{" "}
              {number(scenario.employeesOnCapTablePreGrant ? 0 : s.grantShares)}{" "}
              new grant shares + {number(s.newInvestorShares)} financing shares
              = {number(s.totalShares)} ending shares.
            </p>
            <p>
              Price: {money(s.preMoney)} ÷ {number(s.pricingShares)} = $
              {number(s.pricePerShare)} per share.
            </p>
            <p>
              {money(s.quotedPostMoney)} quoted pre-money + new cash; +{" "}
              {money(s.conversionValue)} conversion marked value; +{" "}
              {money(s.grantValueAtRoundPrice)} new grant marked value; +{" "}
              {money(s.roundingAdjustment)} share-rounding adjustment ={" "}
              {money(s.postMoney)} capitalization at round price.
            </p>
            <p>
              Grant requested: {number(s.requestedGrantShares)}; available:{" "}
              {number(s.grantBudgetRemaining)}; applied: {number(s.grantShares)}
              ; unfulfilled: {number(s.unfulfilledGrantShares)}.
            </p>
            {s.safeConversions.map((c) => (
              <p key={c.key}>
                {c.holderName}:{" "}
                {c.candidates
                  .map((p) => `${p.rule}: $${number(p.price)}`)
                  .join("; ")}
                . Uses {c.rule.toLowerCase()} at ${number(c.conversionPrice)};{" "}
                {number(c.shares)} shares issued.
              </p>
            ))}
          </div>
        ))}
      </details>
    </section>
  );
}

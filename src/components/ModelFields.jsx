import { useEffect, useState } from "react";
export const fieldId = (path) => `field-${path.replaceAll(".", "-")}`;
export const number = (value) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value)
    : "";
export const money = (value) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(value)
    : "—";
export const compactMoney = (value) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 2,
      }).format(value)
    : "—";
export const percent = (value) =>
  Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "—";

export function Field({ path, label, error, hint, children }) {
  const id = fieldId(path);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby":
          [hint && `${id}-hint`, error && `${id}-error`]
            .filter(Boolean)
            .join(" ") || undefined,
      })}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function NumberField({
  value,
  onChange,
  scale = 1,
  draftOverride,
  ...props
}) {
  const [draft, setDraft] = useState(draftOverride ?? null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    // An external correction (equalize, scale, or scenario load) must replace
    // an invalid display draft once the user is no longer editing this field.
    if (!focused && !props.error) setDraft(null);
  }, [value, scale, focused, props.error]);
  return (
    <Field {...props}>
      {(attrs) => (
        <input
          {...attrs}
          type="text"
          inputMode="decimal"
          value={draft == null ? number(value / scale) : draft}
          onFocus={() => {
            setFocused(true);
            setDraft((current) =>
              props.error && current != null
                ? current
                : Number.isFinite(value)
                  ? String(value / scale)
                  : "",
            );
          }}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const cleaned = raw.replace(/[,\s]/g, "");
            const parsed = /^-?(?:\d+\.?\d*|\.\d+)$/.test(cleaned)
              ? Number(cleaned)
              : NaN;
            onChange(scale === 1 ? parsed : Math.round(parsed * scale), raw);
          }}
          onBlur={() => setFocused(false)}
        />
      )}
    </Field>
  );
}

export function TextField({ value, onChange, ...props }) {
  return (
    <Field {...props}>
      {(attrs) => (
        <input
          {...attrs}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

export function ViewButtons({ label, value, onChange, options }) {
  return (
    <div className="view-buttons" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

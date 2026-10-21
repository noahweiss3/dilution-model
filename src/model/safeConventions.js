export const LEGACY_CONVENTION = "legacy-pre-conversion";
export const POST_MONEY_CONVENTION = "yc-post-money";
export const LEGACY_CALCULATION_VERSION = "pre-conversion-v2";
export const POST_MONEY_CALCULATION_VERSION = "yc-post-money-v1";
export const conventionOf = (input) =>
  input.safeConvention ?? LEGACY_CONVENTION;
export const calculationVersionFor = (input) =>
  conventionOf(input) === POST_MONEY_CONVENTION
    ? POST_MONEY_CALCULATION_VERSION
    : LEGACY_CALCULATION_VERSION;
export const conventionLabel = (input) =>
  conventionOf(input) === POST_MONEY_CONVENTION
    ? "Post-money SAFE reference (YC guide)"
    : conventionOf(input) === LEGACY_CONVENTION
      ? "Legacy simplified pre-conversion"
      : `Unsupported: ${conventionOf(input)}`;
export const SAFE_VARIANTS = [
  { value: "post-money-cap", label: "Post-money cap only — YC US reference" },
  { value: "post-money-discount", label: "Discount only — YC US reference" },
  {
    value: "custom-post-money-cap-discount",
    label: "Custom/historical post-money cap + discount",
  },
];
export const variantLabel = (value) =>
  value == null || value === "legacy-generic"
    ? "Legacy generic cap/discount"
    : SAFE_VARIANTS.find((v) => v.value === value)?.label ||
      `Unsupported: ${value || "choose a form"}`;

export function postMoneyTermErrors(s) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  if (!SAFE_VARIANTS.some((v) => v.value === s.variant)) {
    add(
      "variant",
      "Choose a supported post-money SAFE form. Legacy, notes, and MFN are unsupported in this convention.",
    );
    return errors;
  }
  const cap = s.valuationCap ?? 0;
  const discount = s.discountPct ?? 0;
  if (s.variant !== "post-money-discount" && !(cap > 0))
    add("valuationCap", "This form requires a positive post-money cap.");
  if (s.variant === "post-money-discount" && cap !== 0)
    add(
      "valuationCap",
      "The discount-only form has no valuation cap. Enter zero or choose a different form.",
    );
  if (s.variant === "post-money-cap" && discount !== 0)
    add(
      "discountPct",
      "The cap-only form has no discount. Enter zero or choose a different form.",
    );
  if (s.variant === "custom-post-money-cap-discount" && !(discount > 0))
    add(
      "discountPct",
      "The custom combined reference requires a positive discount off the round price.",
    );
  if (!Number.isFinite(discount) || discount < 0 || discount >= 100)
    add("discountPct", "Discount must be at least 0 and less than 100%.");
  if (s.mfn || s.proRata)
    add(
      "variant",
      "MFN and pro-rata participation are unsupported in the post-money reference model. Use a scenario without those rights or retain the legacy reference.",
    );
  return errors;
}

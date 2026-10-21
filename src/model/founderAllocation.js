// Largest-remainder whole-share allocation. BigInt keeps totals exact even at
// the safe-integer boundary and prevents a negative final holder after scaling.
export function allocateShares(total, weights) {
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !weights.length ||
    !weights.every((w) => Number.isSafeInteger(w) && w >= 0)
  )
    throw new Error(
      "Use nonnegative whole shares within the safe numeric range.",
    );
  const values = weights.some((w) => w > 0) ? weights : weights.map(() => 1);
  const sum = values.reduce((a, b) => a + BigInt(b), 0n);
  const quotas = values.map((w, index) => {
    const numerator = BigInt(total) * BigInt(w);
    return { index, shares: numerator / sum, remainder: numerator % sum };
  });
  let remaining = BigInt(total) - quotas.reduce((a, q) => a + q.shares, 0n);
  const order = [...quotas].sort((a, b) =>
    a.remainder === b.remainder
      ? a.index - b.index
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (const item of order) {
    if (remaining === 0n) break;
    item.shares++;
    remaining--;
  }
  return quotas.map((q) => Number(q.shares));
}
export function scaleFounderShares(founders, total) {
  const shares = allocateShares(
    total,
    founders.map((f) => f.shares),
  );
  return founders.map((f, i) => ({ ...f, shares: shares[i] }));
}
export function equalizeFounderShares(founders) {
  const total = founders.reduce((sum, f) => sum + f.shares, 0);
  const target =
    founders.every((f) => Number.isSafeInteger(f.shares) && f.shares >= 0) &&
    Number.isSafeInteger(total) &&
    total > 0
      ? total
      : founders.length * 1_000_000;
  const shares = allocateShares(
    target,
    founders.map(() => 1),
  );
  return founders.map((f, i) => ({ ...f, shares: shares[i] }));
}
export function redistributeFounderPercent(founders, index, value) {
  const total = founders.reduce((sum, f) => sum + f.shares, 0);
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100 ||
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    founders.length < 2
  )
    throw new Error(
      "Enter a founder split between 0 and 100% with a valid total share count.",
    );
  const own = Math.round(total * (value / 100));
  const others = founders.filter((_, i) => i !== index);
  const shares = allocateShares(
    total - own,
    others.map((f) => f.shares),
  );
  let otherIndex = 0;
  return founders.map((f, i) => ({
    ...f,
    shares: i === index ? own : shares[otherIndex++],
  }));
}

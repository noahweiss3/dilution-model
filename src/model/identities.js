export const entityId = (item, kind, index) =>
  String(item.id ?? `${kind}-${index + 1}`);
export const founderKey = (item, index) =>
  `founder:${entityId(item, "founder", index)}`;
export const roundKey = (item, index) =>
  `round:${entityId(item, "round", index)}`;
export const safeKey = (item, index) => `safe:${entityId(item, "safe", index)}`;
export const RESERVE_KEY = "employee:reserve";
export const GRANTED_KEY = "employee:granted";
export const createId = () => crypto.randomUUID();

export function scenarioHolders(founders, rounds, instruments = []) {
  const holders = [
    ...founders.map((f, i) => ({
      key: founderKey(f, i),
      name: f.name,
      kind: "founder",
      ordinal: i + 1,
    })),
    {
      key: RESERVE_KEY,
      name: "Employee Reserve (Unallocated)",
      kind: "reserve",
    },
    { key: GRANTED_KEY, name: "Employees (Granted)", kind: "employees" },
    ...instruments.map((s, i) => ({
      key: safeKey(s, i),
      name: s.holderName,
      kind: "safe",
      ordinal: i + 1,
    })),
    ...rounds.map((r, i) => ({
      key: roundKey(r, i),
      name: r.name,
      kind: "investor",
      ordinal: i + 1,
    })),
  ];
  const counts = new Map();
  holders.forEach((h) => counts.set(h.name, (counts.get(h.name) || 0) + 1));
  return holders.map((h) => ({
    ...h,
    displayName:
      counts.get(h.name) > 1
        ? `${h.name} (${h.kind}${h.ordinal ? ` ${h.ordinal}` : ""})`
        : h.name,
  }));
}

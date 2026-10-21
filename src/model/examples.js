export const ROUND_TEMPLATES = [
  { name: "Angel", investment: 100_000, preMoneyVal: 1_500_000, unit: "K" },
  {
    name: "Accelerator",
    investment: 125_000,
    preMoneyVal: 1_500_000,
    unit: "K",
  },
  { name: "Pre-Seed", investment: 500_000, preMoneyVal: 4_000_000, unit: "K" },
  { name: "Seed", investment: 3_100_000, preMoneyVal: 16_000_000, unit: "M" },
  {
    name: "Series A",
    investment: 10_000_000,
    preMoneyVal: 30_000_000,
    unit: "M",
  },
  {
    name: "Series B",
    investment: 30_000_000,
    preMoneyVal: 120_000_000,
    unit: "M",
  },
  {
    name: "Series C",
    investment: 50_000_000,
    preMoneyVal: 200_000_000,
    unit: "M",
  },
  {
    name: "Series D",
    investment: 100_000_000,
    preMoneyVal: 500_000_000,
    unit: "M",
  },
  { name: "Custom", investment: 1_000_000, preMoneyVal: 8_000_000, unit: "M" },
];
export const DEFAULT_SCENARIO = {
  founders: [
    { id: "founder-1", name: "Founder 1", shares: 5_000_000 },
    { id: "founder-2", name: "Founder 2", shares: 5_000_000 },
  ],
  employeeReserve: 2_500_000,
  employeesOnCapTablePreGrant: false,
  rounds: [
    { id: "seed", ...ROUND_TEMPLATES[3], grantMode: "shares", grantValue: 0 },
    {
      id: "series-a",
      ...ROUND_TEMPLATES[4],
      grantMode: "shares",
      grantValue: 0,
    },
  ],
  instruments: [],
};

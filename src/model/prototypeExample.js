// A deliberately simplified, independent example for visual design exploration.
// Dollars are expressed in millions. This does not call or replace the live model.
export const PRESETS = {
  base: { name: "Base case", investment: 4, valuation: 16 },
  efficient: { name: "Capital efficient", investment: 3, valuation: 18 },
};

export function calculateExample(
  investment = 4,
  valuation = 16,
  stage = "seed",
) {
  if (
    !Number.isFinite(investment) ||
    !Number.isFinite(valuation) ||
    investment <= 0 ||
    valuation <= 0 ||
    investment > 100 ||
    valuation > 500
  ) {
    throw new RangeError(
      "Enter a raise above 0 and up to $100M, and a valuation above 0 and up to $500M.",
    );
  }
  const newSeed = investment / (valuation + investment);
  const seedRetention = 1 - newSeed;
  const seriesARetention = stage === "a" ? 0.8 : 1;
  const retained = seedRetention * seriesARetention;
  const holders = [
    {
      name: "Maya Chen",
      type: "Founder · 5.4M original shares",
      before: 54,
      after: 48.6 * retained,
      color: 0,
    },
    {
      name: "Alex Rivera",
      type: "Founder · 3.6M original shares",
      before: 36,
      after: 32.4 * retained,
      color: 1,
    },
    {
      name: "Employee reserve",
      type: "1.0M shares · issued upfront",
      before: 10,
      after: 9 * retained,
      color: 2,
    },
    {
      name: "SAFE holders",
      type: "$1.0M · $10.0M post-money cap",
      before: 0,
      after: 10 * retained,
      color: 3,
    },
    {
      name: "Seed investors",
      type: `$${investment.toFixed(1)}M priced equity`,
      before: 0,
      after: newSeed * 100 * seriesARetention,
      color: 4,
    },
    ...(stage === "a"
      ? [
          {
            name: "Series A investors",
            type: "$10.0M at $40.0M pre-money",
            before: 0,
            after: 20,
            color: 5,
          },
        ]
      : []),
  ];
  const founders = holders[0].after + holders[1].after;
  const postMoney = stage === "a" ? 50 : valuation + investment;
  return {
    holders,
    founders,
    postMoney,
    founderValue: (postMoney * founders) / 100,
    newInvestor: stage === "a" ? 20 : newSeed * 100,
    totalRaised: investment + 1 + (stage === "a" ? 10 : 0),
    history: [90, 81, 81 * seedRetention, 81 * seedRetention * 0.8],
    valueHistory: [
      9,
      8.1,
      (valuation + investment) * 0.81 * seedRetention,
      50 * 0.81 * seedRetention * 0.8,
    ],
  };
}

export const percent = (value) => `${value.toFixed(2)}%`;
export const money = (value) => `$${value.toFixed(2)}M`;

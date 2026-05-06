import { describe, it, expect } from 'vitest'
import { computeRounds, RESERVE_KEY, GRANTED_KEY } from './dilutionEngine.js'

const oneFounder = (shares = 10_000_000) => [{ name: 'F', shares }]

describe('computeRounds — basic shape', () => {
  it('returns Pre-Funding + one entry per round, with founder ownership = 1 pre-fund and no reserve', () => {
    const states = computeRounds(oneFounder(), [
      { name: 'A', preMoneyVal: 9_000_000, investment: 1_000_000, grantMode: 'shares', grantValue: 0 },
    ], 0, true)

    expect(states).toHaveLength(2)
    expect(states[0]).toMatchObject({
      label: 'Pre-Funding',
      totalShares: 10_000_000,
      preMoney: null,
      postMoney: null,
      roundIdx: -1,
    })
    expect(states[0].ownership.F).toBe(1)
    expect(states[0].ownership[RESERVE_KEY]).toBeUndefined()
  })
})

describe('founder dilution and investor share issuance', () => {
  it('issues round(invest / pricePerShare) shares to new investor and dilutes founder', () => {
    const [, a] = computeRounds(oneFounder(), [
      { name: 'A', preMoneyVal: 9_000_000, investment: 1_000_000, grantMode: 'shares', grantValue: 0 },
    ], 0, false)

    expect(a.pricePerShare).toBeCloseTo(0.9, 12)
    expect(a.newInvestorShares).toBe(1_111_111) // round(1_000_000 / 0.9)
    expect(a.totalShares).toBe(11_111_111)
    expect(a.preMoney).toBe(9_000_000)
    expect(a.postMoney).toBe(10_000_000)

    // Founder share count is preserved (10M); only % shrinks.
    expect(a.ownership.F).toBeCloseTo(10_000_000 / 11_111_111, 12)
    expect(a.ownership.A).toBeCloseTo(1_111_111 / 11_111_111, 12)
  })

  it('preserves prior-round investors as fixed share counts and dilutes them by new total', () => {
    const states = computeRounds(oneFounder(), [
      { name: 'A', preMoneyVal: 9_000_000, investment: 1_000_000, grantMode: 'shares', grantValue: 0 },
      { name: 'B', preMoneyVal: 22_222_222, investment: 11_111_111, grantMode: 'shares', grantValue: 0 },
    ], 0, false)

    const a = states[1]
    const b = states[2]

    // Round B: prevTotal = 11_111_111. pricePerShare = 22_222_222 / 11_111_111 = 2.0.
    expect(b.pricePerShare).toBeCloseTo(2, 12)
    expect(b.newInvestorShares).toBe(5_555_556) // round(11_111_111 / 2)
    expect(b.totalShares).toBe(11_111_111 + 5_555_556)

    // Founder absolute share count remains 10M, just diluted further.
    const founderSharesB = Math.round(b.ownership.F * b.totalShares)
    expect(founderSharesB).toBe(10_000_000)

    // Investor A's absolute share count remains 1,111,111.
    const investorASharesB = Math.round(b.ownership.A * b.totalShares)
    expect(investorASharesB).toBe(1_111_111)

    // % drops from round A to round B.
    expect(b.ownership.F).toBeLessThan(a.ownership.F)
    expect(b.ownership.A).toBeLessThan(a.ownership.A)
  })

  it('two founders dilute proportionally to each other (split is preserved)', () => {
    const states = computeRounds(
      [{ name: 'F1', shares: 6_000_000 }, { name: 'F2', shares: 4_000_000 }],
      [{ name: 'A', preMoneyVal: 9_000_000, investment: 1_000_000, grantMode: 'shares', grantValue: 0 }],
      0,
      false,
    )
    const post = states[1]
    // Founder split (F1:F2 = 60:40) is preserved post-dilution.
    expect(post.ownership.F1 / post.ownership.F2).toBeCloseTo(6 / 4, 10)
  })
})

describe('employee reserve — pre-issued (preGrant=true) mode', () => {
  it('issues full reserve upfront and shows it on the cap table at Pre-Funding', () => {
    const [pre, a] = computeRounds(
      oneFounder(),
      [{ name: 'A', preMoneyVal: 9_000_000, investment: 1_000_000, grantMode: 'shares', grantValue: 500_000 }],
      2_000_000,
      true,
    )

    expect(pre.totalShares).toBe(12_000_000) // 10M founder + 2M reserve
    expect(pre.ownership.F).toBeCloseTo(10_000_000 / 12_000_000, 12)
    expect(pre.ownership[RESERVE_KEY]).toBeCloseTo(2_000_000 / 12_000_000, 12)
    expect(pre.ownership[GRANTED_KEY]).toBeUndefined()

    // pricePerShare uses the prior total (12M, not 10M).
    expect(a.pricePerShare).toBeCloseTo(9_000_000 / 12_000_000, 12) // 0.75
    expect(a.newInvestorShares).toBe(1_333_333) // round(1M / 0.75)

    // Grants TRANSFER from unallocated → granted; total only grows by investor shares.
    expect(a.totalShares).toBe(12_000_000 + 1_333_333)
    expect(a.grantShares).toBe(500_000)

    expect(a.ownership[RESERVE_KEY]).toBeCloseTo(1_500_000 / a.totalShares, 12)
    expect(a.ownership[GRANTED_KEY]).toBeCloseTo(500_000 / a.totalShares, 12)
  })

  it('drops the unallocated bucket once the entire reserve has been granted', () => {
    const [, a] = computeRounds(
      oneFounder(),
      [{ name: 'A', preMoneyVal: 9_000_000, investment: 1_000_000, grantMode: 'shares', grantValue: 1_000_000 }],
      1_000_000,
      true,
    )
    expect(a.ownership[RESERVE_KEY]).toBeUndefined()
    expect(a.ownership[GRANTED_KEY]).toBeCloseTo(1_000_000 / a.totalShares, 12)
  })
})

describe('employee reserve — grant-issued (preGrant=false) mode', () => {
  it('keeps reserve off the pre-fund cap table; grants issue NEW shares each round', () => {
    const [pre, a] = computeRounds(
      oneFounder(),
      [{ name: 'A', preMoneyVal: 9_000_000, investment: 1_000_000, grantMode: 'shares', grantValue: 500_000 }],
      2_000_000,
      false,
    )

    expect(pre.totalShares).toBe(10_000_000)
    expect(pre.ownership[RESERVE_KEY]).toBeUndefined()
    expect(pre.ownership[GRANTED_KEY]).toBeUndefined()
    expect(pre.ownership.F).toBe(1)

    // pricePerShare uses founder-only total (10M).
    expect(a.pricePerShare).toBeCloseTo(0.9, 12)
    expect(a.newInvestorShares).toBe(1_111_111)
    expect(a.grantShares).toBe(500_000)

    // Both investor shares AND grant shares dilute the founder.
    expect(a.totalShares).toBe(10_000_000 + 1_111_111 + 500_000)

    expect(a.ownership[RESERVE_KEY]).toBeUndefined()
    expect(a.ownership[GRANTED_KEY]).toBeCloseTo(500_000 / a.totalShares, 12)
  })
})

describe('grant cap', () => {
  it('clamps a single-round grant to the reserve cap', () => {
    const [, a] = computeRounds(
      oneFounder(),
      [{ name: 'A', preMoneyVal: 9_000_000, investment: 1_000_000, grantMode: 'shares', grantValue: 5_000_000 }],
      1_000_000,
      false,
    )
    expect(a.grantShares).toBe(1_000_000)
  })

  it('clamps subsequent-round grants by remaining budget', () => {
    const states = computeRounds(
      oneFounder(),
      [
        { name: 'A', preMoneyVal: 9_000_000, investment: 1_000_000, grantMode: 'shares', grantValue: 600_000 },
        { name: 'B', preMoneyVal: 18_000_000, investment: 2_000_000, grantMode: 'shares', grantValue: 600_000 },
      ],
      1_000_000,
      false,
    )
    expect(states[1].grantShares).toBe(600_000)
    expect(states[2].grantShares).toBe(400_000) // budget = 1M - 600K
  })

  it('resolves pct-mode grants against the reserve cap', () => {
    const [, a] = computeRounds(
      oneFounder(),
      [{ name: 'A', preMoneyVal: 9_000_000, investment: 1_000_000, grantMode: 'pct', grantValue: 50 }],
      2_000_000,
      false,
    )
    // 50% of 2M reserve = 1M shares.
    expect(a.grantShares).toBe(1_000_000)
  })

  it('clamps pct-mode grants the same way (>100% pct → reserve cap)', () => {
    const [, a] = computeRounds(
      oneFounder(),
      [{ name: 'A', preMoneyVal: 9_000_000, investment: 1_000_000, grantMode: 'pct', grantValue: 250 }],
      1_000_000,
      false,
    )
    expect(a.grantShares).toBe(1_000_000)
  })
})

describe('round invariants', () => {
  const scenarios = [
    {
      name: 'default-like (preGrant=false)',
      founders: [{ name: 'F1', shares: 5_000_000 }, { name: 'F2', shares: 5_000_000 }],
      rounds: [
        { name: 'Seed', preMoneyVal: 16_000_000, investment: 3_100_000, grantMode: 'shares', grantValue: 0 },
        { name: 'Series A', preMoneyVal: 30_000_000, investment: 10_000_000, grantMode: 'shares', grantValue: 0 },
      ],
      reserve: 2_500_000,
      preGrant: false,
    },
    {
      name: 'reserve preGrant=true with grants each round',
      founders: [{ name: 'F1', shares: 5_000_000 }, { name: 'F2', shares: 5_000_000 }],
      rounds: [
        { name: 'Seed', preMoneyVal: 16_000_000, investment: 3_100_000, grantMode: 'shares', grantValue: 250_000 },
        { name: 'Series A', preMoneyVal: 30_000_000, investment: 10_000_000, grantMode: 'pct', grantValue: 20 },
      ],
      reserve: 2_500_000,
      preGrant: true,
    },
  ]

  for (const sc of scenarios) {
    it(`post-money = pre-money + investment for every round (${sc.name})`, () => {
      const states = computeRounds(sc.founders, sc.rounds, sc.reserve, sc.preGrant)
      states.slice(1).forEach(s => {
        expect(s.postMoney).toBe(s.preMoney + s.investment)
      })
    })

    it(`ownership shares sum to ~1 in every state (${sc.name})`, () => {
      const states = computeRounds(sc.founders, sc.rounds, sc.reserve, sc.preGrant)
      states.forEach(s => {
        const sum = Object.values(s.ownership).reduce((a, b) => a + b, 0)
        // Tiny rounding tolerance from Math.round on share counts.
        expect(sum).toBeGreaterThan(0.9999)
        expect(sum).toBeLessThan(1.0001)
      })
    })

    it(`founder share count never increases (${sc.name})`, () => {
      const states = computeRounds(sc.founders, sc.rounds, sc.reserve, sc.preGrant)
      sc.founders.forEach(f => {
        let last = Infinity
        states.forEach(s => {
          const count = Math.round((s.ownership[f.name] || 0) * s.totalShares)
          expect(count).toBeLessThanOrEqual(last + 1) // allow 1-share rounding wiggle
          last = count
        })
      })
    })
  }
})

describe('golden snapshot — default scenario', () => {
  it('matches the recorded cap table for DEFAULT_FOUNDERS + DEFAULT_ROUNDS + DEFAULT_RESERVE (preGrant=false)', () => {
    const states = computeRounds(
      [{ name: 'Founder 1', shares: 5_000_000 }, { name: 'Founder 2', shares: 5_000_000 }],
      [
        { name: 'Seed', preMoneyVal: 16_000_000, investment: 3_100_000, grantMode: 'shares', grantValue: 0 },
        { name: 'Series A', preMoneyVal: 30_000_000, investment: 10_000_000, grantMode: 'shares', grantValue: 0 },
      ],
      2_500_000,
      false,
    )
    expect(states).toMatchSnapshot()
  })

  it('matches the recorded cap table for the same inputs in preGrant=true mode', () => {
    const states = computeRounds(
      [{ name: 'Founder 1', shares: 5_000_000 }, { name: 'Founder 2', shares: 5_000_000 }],
      [
        { name: 'Seed', preMoneyVal: 16_000_000, investment: 3_100_000, grantMode: 'shares', grantValue: 250_000 },
        { name: 'Series A', preMoneyVal: 30_000_000, investment: 10_000_000, grantMode: 'pct', grantValue: 20 },
      ],
      2_500_000,
      true,
    )
    expect(states).toMatchSnapshot()
  })
})

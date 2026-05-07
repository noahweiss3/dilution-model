import { describe, it, expect } from 'vitest'
import {
  CURRENT_SCENARIO_VERSION,
  createScenarioState,
  normalizeScenarioState,
} from './scenarioSchema.js'

const defaults = {
  founders: [{ name: 'Default Founder', shares: 1_000_000 }],
  employeeReserve: 500_000,
  employeesOnCapTablePreGrant: false,
  rounds: [{ id: 1, name: 'Seed', investment: 1_000_000, preMoneyVal: 9_000_000, unit: 'M', grantMode: 'shares', grantValue: 0 }],
  instruments: [],
}

describe('scenario schema', () => {
  it('creates canonical v1 scenario state and strips computed/transient fields', () => {
    const scenario = createScenarioState({
      founders: [{ name: 'A', shares: 2_000_000, uiOnly: true }],
      employeeReserve: 250_000,
      employeesOnCapTablePreGrant: true,
      rounds: [{ id: 9, name: 'A', investment: 100, preMoneyVal: 900, unit: 'K', grantMode: 'pct', grantValue: 25, extra: 'ignore' }],
      instruments: [{ id: 'safe-1', type: 'safe', holderName: 'Angel', investment: 100_000, valuationCap: 5_000_000, discountPct: 20, conversionRoundId: 9, unknown: true }],
      states: [{ computed: true }],
      allKeys: ['computed'],
    })

    expect(scenario).toEqual({
      schemaVersion: CURRENT_SCENARIO_VERSION,
      founders: [{ name: 'A', shares: 2_000_000 }],
      employeeReserve: 250_000,
      employeesOnCapTablePreGrant: true,
      rounds: [{ id: 9, name: 'A', investment: 100, preMoneyVal: 900, unit: 'K', grantMode: 'pct', grantValue: 25 }],
      instruments: [{ id: 'safe-1', type: 'safe', holderName: 'Angel', investment: 100_000, valuationCap: 5_000_000, discountPct: 20, conversionRoundId: 9, mfn: false, proRata: false }],
    })
  })

  it('migrates current unversioned saved state to v1', () => {
    const { scenario, warnings } = normalizeScenarioState({
      founders: [{ name: 'Founder', shares: 3_000_000 }],
      employeeReserve: 0,
      employeesOnCapTablePreGrant: true,
      rounds: [{ id: 2, name: 'Series A', investment: 2_000_000, preMoneyVal: 8_000_000 }],
    }, defaults)

    expect(warnings).toContain('Migrated unversioned scenario to schema v1.')
    expect(scenario.schemaVersion).toBe(1)
    expect(scenario.rounds[0]).toMatchObject({ unit: 'M', grantMode: 'shares', grantValue: 0 })
  })

  it('falls back to defaults and warns for malformed payloads', () => {
    const { scenario, warnings } = normalizeScenarioState({
      schemaVersion: 1,
      founders: [{ name: '', shares: -10 }],
      employeeReserve: -1,
      employeesOnCapTablePreGrant: 'yes',
      rounds: [{ id: 1, name: '', investment: -100, preMoneyVal: -200, unit: 'B', grantMode: 'bad', grantValue: -1 }],
    }, defaults)

    expect(warnings.length).toBeGreaterThan(0)
    expect(scenario.founders).toEqual(defaults.founders)
    expect(scenario.employeeReserve).toBe(defaults.employeeReserve)
    expect(scenario.employeesOnCapTablePreGrant).toBe(defaults.employeesOnCapTablePreGrant)
    expect(scenario.rounds).toEqual(defaults.rounds)
  })

  it('ignores unknown fields and rejects future schema versions safely', () => {
    const { scenario, warnings } = normalizeScenarioState({
      schemaVersion: CURRENT_SCENARIO_VERSION + 1,
      founders: [{ name: 'Future Founder', shares: 9_000_000 }],
      rounds: [],
      newFutureField: 'not understood',
    }, defaults)

    expect(scenario).toEqual(createScenarioState(defaults))
    expect(warnings.join(' ')).toMatch(/newer schema/i)
  })
})

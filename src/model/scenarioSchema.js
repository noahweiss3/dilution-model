export const CURRENT_SCENARIO_VERSION = 1

const DEFAULT_ROUND = {
  id: 1,
  name: 'Seed',
  investment: 0,
  preMoneyVal: 0,
  unit: 'M',
  grantMode: 'shares',
  grantValue: 0,
}

const DEFAULT_SCENARIO = {
  founders: [],
  employeeReserve: 0,
  employeesOnCapTablePreGrant: false,
  rounds: [],
  instruments: [],
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const finiteNumber = (value) => typeof value === 'number' && Number.isFinite(value)
const nonNegativeInt = (value) => Math.max(0, Math.round(finiteNumber(value) ? value : 0))
const validName = (value) => typeof value === 'string' && value.trim().length > 0

function normalizeFounder(founder) {
  if (!isObject(founder) || !validName(founder.name) || !finiteNumber(founder.shares) || founder.shares < 0) return null
  return { name: founder.name.trim(), shares: nonNegativeInt(founder.shares) }
}

function normalizeRound(round) {
  if (!isObject(round) || !validName(round.name)) return null
  if (!finiteNumber(round.investment) || round.investment < 0) return null
  if (!finiteNumber(round.preMoneyVal) || round.preMoneyVal < 0) return null
  if (round.unit != null && !['K', 'M'].includes(round.unit)) return null
  if (round.grantMode != null && !['shares', 'pct'].includes(round.grantMode)) return null
  if (round.grantValue != null && (!finiteNumber(round.grantValue) || round.grantValue < 0)) return null

  return {
    id: round.id ?? cryptoSafeId(),
    name: round.name.trim(),
    investment: nonNegativeInt(round.investment),
    preMoneyVal: nonNegativeInt(round.preMoneyVal),
    unit: round.unit || DEFAULT_ROUND.unit,
    grantMode: round.grantMode || DEFAULT_ROUND.grantMode,
    grantValue: finiteNumber(round.grantValue) ? Math.max(0, round.grantValue) : DEFAULT_ROUND.grantValue,
  }
}

function normalizeInstrument(instrument) {
  if (!isObject(instrument)) return null
  if ((instrument.type || 'safe') !== 'safe') return null
  if (!validName(instrument.holderName)) return null
  if (!finiteNumber(instrument.investment) || instrument.investment < 0) return null
  const hasCap = instrument.valuationCap == null || (finiteNumber(instrument.valuationCap) && instrument.valuationCap >= 0)
  const hasDiscount = instrument.discountPct == null || (finiteNumber(instrument.discountPct) && instrument.discountPct >= 0 && instrument.discountPct < 100)
  const hasConversionRound = instrument.conversionRoundId == null || ['string', 'number'].includes(typeof instrument.conversionRoundId)
  if (!hasCap || !hasDiscount || !hasConversionRound) return null

  return {
    id: instrument.id ?? cryptoSafeId(),
    type: 'safe',
    holderName: instrument.holderName.trim(),
    investment: nonNegativeInt(instrument.investment),
    valuationCap: instrument.valuationCap == null ? null : nonNegativeInt(instrument.valuationCap),
    discountPct: instrument.discountPct == null ? 0 : Math.max(0, instrument.discountPct),
    ...(instrument.conversionRoundId == null || instrument.conversionRoundId === '' ? {} : { conversionRoundId: instrument.conversionRoundId }),
    mfn: Boolean(instrument.mfn),
    proRata: Boolean(instrument.proRata),
  }
}

function cryptoSafeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function sanitizeArray(value, normalizer) {
  if (!Array.isArray(value)) return null
  const sanitized = value.map(normalizer).filter(Boolean)
  return sanitized.length === value.length ? sanitized : null
}

export function createScenarioState(input = {}) {
  const source = isObject(input) ? input : DEFAULT_SCENARIO
  return {
    schemaVersion: CURRENT_SCENARIO_VERSION,
    founders: (Array.isArray(source.founders) ? source.founders.map(normalizeFounder).filter(Boolean) : []),
    employeeReserve: nonNegativeInt(source.employeeReserve),
    employeesOnCapTablePreGrant: Boolean(source.employeesOnCapTablePreGrant),
    rounds: (Array.isArray(source.rounds) ? source.rounds.map(normalizeRound).filter(Boolean) : []),
    instruments: (Array.isArray(source.instruments) ? source.instruments.map(normalizeInstrument).filter(Boolean) : []),
  }
}

export function normalizeScenarioState(input, defaults = DEFAULT_SCENARIO) {
  const fallback = createScenarioState(defaults)
  const warnings = []

  if (!isObject(input)) {
    return { scenario: fallback, warnings: ['Scenario data was malformed; restored defaults.'] }
  }

  const version = input.schemaVersion
  if (version == null) warnings.push('Migrated unversioned scenario to schema v1.')
  if (version != null && version !== CURRENT_SCENARIO_VERSION) {
    if (version > CURRENT_SCENARIO_VERSION) {
      return { scenario: fallback, warnings: [`Scenario uses a newer schema v${version}; restored defaults.`] }
    }
    warnings.push(`Migrated scenario schema v${version} to v${CURRENT_SCENARIO_VERSION}.`)
  }

  const founders = sanitizeArray(input.founders, normalizeFounder)
  const rounds = sanitizeArray(input.rounds, normalizeRound)
  const instruments = input.instruments == null ? [] : sanitizeArray(input.instruments, normalizeInstrument)

  if (!founders || founders.length === 0) warnings.push('Invalid founders were ignored; restored default founders.')
  if (!rounds) warnings.push('Invalid rounds were ignored; restored default rounds.')
  if (input.instruments != null && !instruments) warnings.push('Invalid instruments were ignored.')
  if (!finiteNumber(input.employeeReserve) || input.employeeReserve < 0) warnings.push('Invalid employee reserve was ignored.')
  if (typeof input.employeesOnCapTablePreGrant !== 'boolean') warnings.push('Invalid reserve mode was ignored.')

  return {
    scenario: {
      schemaVersion: CURRENT_SCENARIO_VERSION,
      founders: founders && founders.length > 0 ? founders : fallback.founders,
      employeeReserve: finiteNumber(input.employeeReserve) && input.employeeReserve >= 0 ? nonNegativeInt(input.employeeReserve) : fallback.employeeReserve,
      employeesOnCapTablePreGrant: typeof input.employeesOnCapTablePreGrant === 'boolean'
        ? input.employeesOnCapTablePreGrant
        : fallback.employeesOnCapTablePreGrant,
      rounds: rounds || fallback.rounds,
      instruments: instruments || fallback.instruments,
    },
    warnings,
  }
}

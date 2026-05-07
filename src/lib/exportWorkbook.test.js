import { describe, it, expect } from 'vitest'
import { buildWorkbook } from './exportWorkbook.js'
import { computeRounds } from '../model/dilutionEngine.js'

const founders = [
  { name: 'Founder 1', shares: 5_000_000 },
  { name: 'Founder 2', shares: 5_000_000 },
]
const rounds = [
  { name: 'Seed', preMoneyVal: 16_000_000, investment: 3_100_000, unit: 'M', grantMode: 'shares', grantValue: 0 },
  { name: 'Series A', preMoneyVal: 30_000_000, investment: 10_000_000, unit: 'M', grantMode: 'shares', grantValue: 250_000 },
]
const employeeReserve = 2_500_000
const safeInstruments = [
  { id: 'safe-1', type: 'safe', holderName: 'Angel SAFE', investment: 500_000, valuationCap: 8_000_000, discountPct: 20, mfn: false, proRata: false },
]

function fixtureWorkbook(preGrant = false, instruments = []) {
  const states = computeRounds(founders, rounds, employeeReserve, preGrant, instruments)
  const keys = new Set()
  states.forEach(s => Object.keys(s.ownership).forEach(k => keys.add(k)))
  const allKeys = Array.from(keys)
  return buildWorkbook({
    founders, employeeReserve, employeesOnCapTablePreGrant: preGrant, rounds, instruments, states, allKeys,
  })
}

describe('buildWorkbook', () => {
  it('creates the four expected sheets in order', async () => {
    const wb = await fixtureWorkbook()
    expect(wb.worksheets.map(w => w.name)).toEqual(
      ['Assumptions', 'Cap Table', 'Chart Data', 'Waterfall'],
    )
  })

  it('writes founder/reserve/round inputs to the Assumptions sheet', async () => {
    const wb = await fixtureWorkbook(true)
    const ws = wb.getWorksheet('Assumptions')
    // First row is the title; the founders block starts after the "Founder, Shares, …" header.
    const flat = []
    ws.eachRow({ includeEmpty: true }, row => {
      flat.push(row.values.slice(1)) // exceljs values are 1-indexed; drop the leading hole
    })
    // Founder rows
    expect(flat).toContainEqual(['Founder 1', 5_000_000, 0.5])
    expect(flat).toContainEqual(['Founder 2', 5_000_000, 0.5])
    expect(flat).toContainEqual(['Reserved Shares', 2_500_000])
    expect(flat).toContainEqual(['Reserve on cap table before grants?', 'Yes'])
    // Round rows: idx, name, preMoneyVal, investment, unit, grantMode, grantValue, resolved
    expect(flat).toContainEqual([1, 'Seed', 16_000_000, 3_100_000, 'M', 'shares', 0, 0])
    expect(flat).toContainEqual([2, 'Series A', 30_000_000, 10_000_000, 'M', 'shares', 250_000, 250_000])
  })

  it('writes SAFE assumptions and conversion outputs', async () => {
    const wb = await fixtureWorkbook(false, safeInstruments)
    const assumptions = []
    wb.getWorksheet('Assumptions').eachRow({ includeEmpty: true }, row => assumptions.push(row.values.slice(1)))
    expect(assumptions).toContainEqual(['Angel SAFE', 500_000, 8_000_000, 20, 'First priced round', 'No', 'No'])

    const capTable = []
    wb.getWorksheet('Cap Table').eachRow({ includeEmpty: true }, row => capTable.push(row.values.slice(1)))
    expect(capTable.some(row => row[0] === 'Angel SAFE')).toBe(true)
    expect(capTable.some(row => row[0] === 'Seed SAFE' && row[1] === 'Angel SAFE')).toBe(true)
  })

  it('applies %, integer, and $-currency number formats to the Cap Table triplet columns', async () => {
    const wb = await fixtureWorkbook()
    const ws = wb.getWorksheet('Cap Table')
    // Row 2 = first stakeholder. Columns: 1=label, then per-state triplets (%, shares, $).
    // The Pre-Funding state has postMoney=null so its $-cell is blank — check the Seed triplet (cols 5–7).
    const row = ws.getRow(2)
    expect(row.getCell(2).numFmt).toBe('0.00%')
    expect(row.getCell(3).numFmt).toBe('#,##0')
    expect(row.getCell(5).numFmt).toBe('0.00%')
    expect(row.getCell(6).numFmt).toBe('#,##0')
    expect(row.getCell(7).numFmt).toBe('"$"#,##0')
  })

  it('formats Chart Data percentage and shares columns', async () => {
    const wb = await fixtureWorkbook()
    const ws = wb.getWorksheet('Chart Data')
    const row = ws.getRow(2)
    expect(row.getCell(3).numFmt).toBe('0.00%')
    expect(row.getCell(4).numFmt).toBe('#,##0')
  })

  it('formats Waterfall numeric cells as currency', async () => {
    const wb = await fixtureWorkbook()
    const ws = wb.getWorksheet('Waterfall')
    const row = ws.getRow(2) // first data row
    // Pre/Investment/Post + per-founder values
    expect(row.getCell(2).numFmt).toBe('"$"#,##0')
    expect(row.getCell(3).numFmt).toBe('"$"#,##0')
    expect(row.getCell(4).numFmt).toBe('"$"#,##0')
    expect(row.getCell(5).numFmt).toBe('"$"#,##0')
  })

  it('produces a writable .xlsx buffer', async () => {
    const wb = await fixtureWorkbook()
    const buf = await wb.xlsx.writeBuffer()
    // .xlsx files are ZIP archives — they start with "PK".
    const head = new Uint8Array(buf.slice(0, 2))
    expect(head[0]).toBe(0x50) // 'P'
    expect(head[1]).toBe(0x4b) // 'K'
  })
})

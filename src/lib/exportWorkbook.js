// Build & download the dilution-model workbook.
// Imported dynamically from App.jsx so ExcelJS (~700KB) only loads on user click.
import ExcelJS from 'exceljs'

export async function buildWorkbook({
  founders, employeeReserve, employeesOnCapTablePreGrant, rounds, states, allKeys,
}) {
  const wb = new ExcelJS.Workbook()

  // ─── Assumptions ──────────────────────────────────────────────────────
  const wsA = wb.addWorksheet('Assumptions')
  wsA.addRow(['DILUTION MODEL — ASSUMPTIONS'])
  wsA.addRow([`Exported: ${new Date().toISOString()}`])
  wsA.addRow([])
  wsA.addRow(['INITIAL CAP TABLE'])
  wsA.addRow(['Founder', 'Shares', '% of Founders'])
  const founderTotal = founders.reduce((s, f) => s + (f.shares || 0), 0) || 1
  founders.forEach(f => {
    wsA.addRow([f.name, f.shares || 0, (f.shares || 0) / founderTotal])
  })
  wsA.addRow(['TOTAL FOUNDER SHARES', founderTotal, 1])
  wsA.addRow([])
  wsA.addRow(['EMPLOYEE RESERVE'])
  wsA.addRow(['Reserved Shares', employeeReserve])
  wsA.addRow(['Reserve on cap table before grants?', employeesOnCapTablePreGrant ? 'Yes' : 'No'])
  wsA.addRow([])
  wsA.addRow(['FUNDING ROUNDS'])
  wsA.addRow(['#', 'Round Name', 'Pre-Money Val ($)', 'Investment ($)', 'Display Unit', 'Grant Mode', 'Grant Value', 'Grant Shares Resolved'])
  rounds.forEach((r, i) => {
    const grantShares = r.grantMode === 'pct'
      ? Math.round(((r.grantValue || 0) / 100) * (employeeReserve || 0))
      : (r.grantValue || 0)
    wsA.addRow([
      i + 1, r.name, r.preMoneyVal || 0, r.investment || 0, r.unit || 'K',
      r.grantMode || 'shares', r.grantValue || 0, grantShares,
    ])
  })
  ;[32, 22, 20, 20, 14, 14, 14, 22].forEach((w, i) => { wsA.getColumn(i + 1).width = w })

  // ─── Cap Table ────────────────────────────────────────────────────────
  const wsT = wb.addWorksheet('Cap Table')
  const tableHeader = ['Stakeholder', ...states.flatMap(s => [`${s.label} — %`, `${s.label} — Shares`, `${s.label} — Value ($)`])]
  wsT.addRow(tableHeader)
  allKeys.forEach(key => {
    const row = [key]
    states.forEach(s => {
      const pct = s.ownership[key]
      if (pct === undefined) { row.push('', '', ''); return }
      const shares = Math.round(pct * s.totalShares)
      const value = s.postMoney ? pct * s.postMoney : ''
      row.push(pct, shares, value)
    })
    wsT.addRow(row)
  })
  const totalsRow = ['TOTAL']
  states.forEach(s => {
    const totalPct = Object.values(s.ownership).reduce((sum, v) => sum + (v || 0), 0)
    totalsRow.push(totalPct, s.totalShares, s.postMoney || '')
  })
  wsT.addRow(totalsRow)
  wsT.addRow([])
  wsT.addRow(['Round', 'Pre-Money', 'Investment', 'Post-Money', 'Price/Share', 'Total Shares', 'New Investor Shares', 'Grant Shares'])
  states.slice(1).forEach(s => {
    wsT.addRow([s.label, s.preMoney || 0, s.investment || 0, s.postMoney || 0, s.pricePerShare || 0, s.totalShares, s.newInvestorShares || 0, s.grantShares || 0])
  })
  // Triplet format on stakeholder + totals rows: %, shares, $-value.
  const stakeholderEndRow = 1 + allKeys.length + 1
  for (let r = 2; r <= stakeholderEndRow; r++) {
    wsT.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => {
      if (col === 1 || typeof cell.value !== 'number') return
      const tripletPos = (col - 2) % 3
      if (tripletPos === 0) cell.numFmt = '0.00%'
      else if (tripletPos === 1) cell.numFmt = '#,##0'
      else cell.numFmt = '"$"#,##0'
    })
  }
  // Round-metadata block: $ on $-cols, integer on share counts.
  const metaHeaderRow = stakeholderEndRow + 2
  for (let r = metaHeaderRow + 1; r <= wsT.rowCount; r++) {
    wsT.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => {
      if (typeof cell.value !== 'number') return
      cell.numFmt = (col >= 2 && col <= 5) ? '"$"#,##0' : '#,##0'
    })
  }
  wsT.getColumn(1).width = 28
  for (let c = 2; c <= tableHeader.length; c++) wsT.getColumn(c).width = 14

  // ─── Chart Data ───────────────────────────────────────────────────────
  const wsC = wb.addWorksheet('Chart Data')
  wsC.addRow(['Round', 'Stakeholder', '% Ownership', 'Shares'])
  states.forEach(s => {
    allKeys.forEach(key => {
      const pct = s.ownership[key]
      if (pct === undefined) return
      wsC.addRow([s.label, key, pct, Math.round(pct * s.totalShares)])
    })
  })
  for (let r = 2; r <= wsC.rowCount; r++) {
    const c3 = wsC.getRow(r).getCell(3)
    if (typeof c3.value === 'number') c3.numFmt = '0.00%'
    const c4 = wsC.getRow(r).getCell(4)
    if (typeof c4.value === 'number') c4.numFmt = '#,##0'
  }
  ;[18, 28, 14, 14].forEach((w, i) => { wsC.getColumn(i + 1).width = w })

  // ─── Waterfall ────────────────────────────────────────────────────────
  const wsW = wb.addWorksheet('Waterfall')
  wsW.addRow(['Round', 'Pre-Money ($)', 'Investment ($)', 'Post-Money ($)', ...founders.map(f => `${f.name} value ($)`)])
  states.slice(1).forEach(s => {
    const row = [s.label, s.preMoney || 0, s.investment || 0, s.postMoney || 0]
    founders.forEach(f => {
      const ownPct = s.ownership[f.name] || 0
      row.push(s.postMoney ? ownPct * s.postMoney : '')
    })
    wsW.addRow(row)
  })
  for (let r = 2; r <= wsW.rowCount; r++) {
    wsW.getRow(r).eachCell({ includeEmpty: false }, cell => {
      if (typeof cell.value === 'number') cell.numFmt = '"$"#,##0'
    })
  }
  wsW.getColumn(1).width = 16
  for (let c = 2; c <= 4 + founders.length; c++) wsW.getColumn(c).width = 18

  return wb
}

export async function exportWorkbook(args, filename) {
  const wb = await buildWorkbook(args)
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

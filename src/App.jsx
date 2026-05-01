import { useState, useMemo, useRef, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend
} from 'recharts'

const ROUND_COLORS = ['#7c6cfc', '#fc6c8f', '#6cfcb8', '#fcb86c', '#6cb8fc', '#fc6cfc']

const DEFAULT_FOUNDERS = [
  { name: 'Founder 1', shares: 5000000 },
  { name: 'Founder 2', shares: 5000000 },
]

const DEFAULT_RESERVE = 1000000

const DEFAULT_ROUNDS = [
  {
    id: 1, name: 'Seed',
    investment: 1500000, preMoneyVal: 8500000, unit: 'K',
    grantMode: 'shares', grantValue: 200000,
  },
  {
    id: 2, name: 'Series A',
    investment: 10000000, preMoneyVal: 30000000, unit: 'M',
    grantMode: 'shares', grantValue: 400000,
  },
]

// Round templates ordered by typical timeline (earliest -> latest).
// Investment / preMoneyVal stored in raw dollars; UI shows them in the round's chosen `unit` ($K or $M).
const ROUND_TEMPLATES = [
  { name: 'Pre-Seed',    investment:    250000, preMoneyVal:   2000000, unit: 'K', grantMode: 'shares', grantValue: 100000 },
  { name: 'Angel',       investment:    500000, preMoneyVal:   4000000, unit: 'K', grantMode: 'shares', grantValue: 100000 },
  { name: 'Accelerator', investment:    125000, preMoneyVal:   1500000, unit: 'K', grantMode: 'shares', grantValue:  50000 },
  { name: 'Seed',        investment:   1500000, preMoneyVal:   8500000, unit: 'K', grantMode: 'shares', grantValue: 200000 },
  { name: 'Series A',    investment:  10000000, preMoneyVal:  30000000, unit: 'M', grantMode: 'shares', grantValue: 400000 },
  { name: 'Series B',    investment:  25000000, preMoneyVal:  90000000, unit: 'M', grantMode: 'shares', grantValue: 600000 },
  { name: 'Series C',    investment:  50000000, preMoneyVal: 200000000, unit: 'M', grantMode: 'shares', grantValue: 800000 },
]

const UNIT_DIVISOR = { K: 1000, M: 1000000 }

function fmt(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function pct(n) {
  return `${(n * 100).toFixed(2)}%`
}

const RESERVE_KEY = 'Employee Reserve (Unallocated)'
const GRANTED_KEY = 'Employees (Granted)'

function computeRounds(founders, rounds, employeeReserve = 0) {
  const founderTotal = founders.reduce((s, f) => s + (f.shares || 0), 0)
  const reserveShares = Math.max(0, Math.round(employeeReserve || 0))
  const preFundTotal = founderTotal + reserveShares
  let states = []
  let prevTotal = preFundTotal
  let unallocatedReserve = reserveShares
  let granted = 0

  // Pre-funding state — founders + employee reserve already issued
  const preFund = {
    label: 'Pre-Funding',
    totalShares: preFundTotal,
    ownership: {},
    postMoney: null,
    preMoney: null,
    newInvestors: 0,
    roundIdx: -1,
  }
  founders.forEach(f => {
    preFund.ownership[f.name] = preFundTotal > 0 ? f.shares / preFundTotal : 0
  })
  if (reserveShares > 0) {
    preFund.ownership[RESERVE_KEY] = reserveShares / preFundTotal
  }
  states.push(preFund)

  rounds.forEach((round, idx) => {
    const preVal = round.preMoneyVal || 0
    const invest = round.investment || 0
    const postVal = preVal + invest

    const pricePerShare = prevTotal > 0 ? preVal / prevTotal : 0
    const newInvestorShares = pricePerShare > 0 ? Math.round(invest / pricePerShare) : 0
    const newTotal = prevTotal + newInvestorShares

    // Resolve grant for this round (transfer from reserve -> granted, no new shares).
    let grantShares = 0
    if (round.grantMode === 'pct') {
      // Grant X% of post-round total shares.
      const pct = (round.grantValue || 0) / 100
      grantShares = Math.round(pct * newTotal)
    } else {
      grantShares = Math.round(round.grantValue || 0)
    }
    grantShares = Math.max(0, Math.min(grantShares, unallocatedReserve))
    unallocatedReserve -= grantShares
    granted += grantShares

    const state = {
      label: round.name,
      totalShares: newTotal,
      preMoney: preVal,
      postMoney: postVal,
      pricePerShare,
      investment: invest,
      newInvestorShares,
      grantShares,
      roundIdx: idx,
      ownership: {},
    }

    // Founders dilute proportionally to total share growth.
    founders.forEach(f => {
      const prevState = states[states.length - 1]
      const founderShareCount = Math.round((prevState.ownership[f.name] || 0) * prevState.totalShares)
      state.ownership[f.name] = founderShareCount / newTotal
    })

    // Investors from previous rounds — keep their absolute shares, dilute by new total.
    states.forEach((s, si) => {
      if (si === 0) return
      const key = s.label
      const prevInvShares = Math.round((states[states.length - 1].ownership[key] || 0) * prevTotal)
      state.ownership[key] = prevInvShares / newTotal
    })

    // New investors this round.
    state.ownership[round.name] = newInvestorShares / newTotal

    // Reserve & granted are absolute share counts that diluted with new issuance.
    if (reserveShares > 0) {
      if (unallocatedReserve > 0) state.ownership[RESERVE_KEY] = unallocatedReserve / newTotal
      if (granted > 0) state.ownership[GRANTED_KEY] = granted / newTotal
    }

    prevTotal = newTotal
    states.push(state)
  })

  return states
}

function RoundRow({ round, onUpdate, onRemove, index, dragHandlers, isDragging, isDragOver }) {
  const update = (field, val) => onUpdate(index, field, val)
  return (
    <div
      onDragOver={dragHandlers.onDragOver}
      onDrop={dragHandlers.onDrop}
      onDragEnter={dragHandlers.onDragEnter}
      onDragLeave={dragHandlers.onDragLeave}
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '16px 20px', marginBottom: 12,
        borderLeft: `3px solid ${ROUND_COLORS[index % ROUND_COLORS.length]}`,
        opacity: isDragging ? 0.4 : 1,
        outline: isDragOver ? '2px dashed var(--accent)' : 'none',
        outlineOffset: isDragOver ? -2 : 0,
        transition: 'opacity 0.15s, outline 0.1s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            draggable
            onDragStart={dragHandlers.onDragStart}
            onDragEnd={dragHandlers.onDragEnd}
            title="Drag to reorder"
            style={{
              cursor: 'grab', color: 'var(--text-dim)', fontSize: 14, lineHeight: 1,
              userSelect: 'none', padding: '0 2px',
            }}
          >⋮⋮</span>
          <span style={{ color: ROUND_COLORS[index % ROUND_COLORS.length], fontFamily: 'Syne', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Round {index + 1}
          </span>
          <input
            type="text"
            value={round.name}
            onChange={e => update('name', e.target.value)}
            style={{ width: 120, fontFamily: 'Syne', fontWeight: 600, fontSize: 14, background: 'transparent', border: 'none', color: 'var(--text)', padding: '2px 0', borderBottom: '1px solid var(--border-accent)' }}
          />
        </div>
        <button
          onClick={() => onRemove(index)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
        >×</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          {['K', 'M'].map(u => (
            <button
              key={u}
              onClick={() => update('unit', u)}
              title={`Display \$ inputs in ${u === 'K' ? 'thousands' : 'millions'}`}
              style={{
                background: (round.unit || 'K') === u ? 'var(--accent-dim)' : 'transparent',
                color: (round.unit || 'K') === u ? 'var(--accent)' : 'var(--text-muted)',
                border: 'none', fontFamily: 'DM Mono', fontSize: 10,
                padding: '2px 9px', cursor: 'pointer', letterSpacing: '0.05em',
              }}
            >${u}</button>
          ))}
        </div>
      </div>
      {(() => {
        const unit = round.unit || 'K'
        const div = UNIT_DIVISOR[unit]
        const fromInput = (v) => (+v) * div
        const toDisplay = (raw) => {
          const d = (raw || 0) / div
          // Trim trailing zeros for M so '8.5' shows instead of '8.500000'.
          return unit === 'M' ? +d.toFixed(6) : d
        }
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 10 }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pre-Money Val (${unit})</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>$</span>
                <input type="number" step={unit === 'M' ? 0.1 : 1} value={toDisplay(round.preMoneyVal)} onChange={e => update('preMoneyVal', fromInput(e.target.value))} style={{ paddingLeft: 22 }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Investment (${unit})</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>$</span>
                <input type="number" step={unit === 'M' ? 0.1 : 1} value={toDisplay(round.investment)} onChange={e => update('investment', fromInput(e.target.value))} style={{ paddingLeft: 22 }} />
              </div>
            </div>
          </div>
        )
      })()}
      <div>
        <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Employee Grant (this round)
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            {['shares', 'pct'].map(m => (
              <button
                key={m}
                onClick={() => update('grantMode', m)}
                style={{
                  background: round.grantMode === m ? 'var(--accent-dim)' : 'transparent',
                  color: round.grantMode === m ? 'var(--accent)' : 'var(--text-muted)',
                  border: 'none', fontFamily: 'DM Mono', fontSize: 10,
                  padding: '0 10px', cursor: 'pointer', letterSpacing: '0.05em',
                }}
              >{m === 'shares' ? '#' : '%'}</button>
            ))}
          </div>
          <input
            type="number"
            value={round.grantValue ?? 0}
            onChange={e => update('grantValue', +e.target.value)}
            style={{ flex: 1 }}
            placeholder={round.grantMode === 'pct' ? '% of total' : 'shares'}
          />
        </div>
      </div>
    </div>
  )
}

function AddRoundDropdown({ onAdd }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const items = [...ROUND_TEMPLATES, { name: 'Custom', custom: true }]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'var(--accent-dim)', border: '1px solid var(--accent)',
          color: 'var(--accent)', fontSize: 11, borderRadius: 4,
          padding: '3px 10px', letterSpacing: '0.05em',
          fontFamily: 'DM Mono', cursor: 'pointer',
        }}
      >+ ROUND ▾</button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50,
          background: '#14141f', border: '1px solid var(--border-accent)',
          borderRadius: 6, padding: 4, minWidth: 160,
          boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
        }}>
          {items.map((it) => (
            <button
              key={it.name}
              onClick={() => { onAdd(it.custom ? null : it); setOpen(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'none', border: 'none', color: 'var(--text)',
                fontSize: 12, fontFamily: 'DM Mono', padding: '7px 10px',
                borderRadius: 4, cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,108,252,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >{it.name}</button>
          ))}
        </div>
      )}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null
  return (
    <div style={{
      background: '#14141f', border: '1px solid var(--border-accent)',
      borderRadius: 6, padding: '10px 14px', fontSize: 12
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'Syne', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>{label}</div>
      {payload.slice().reverse().map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, color: p.color }}>
          <span style={{ color: 'var(--text-muted)' }}>{p.name}</span>
          <span style={{ fontWeight: 500 }}>{pct(p.value / 100)}</span>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [founders, setFounders] = useState(DEFAULT_FOUNDERS)
  const [employeeReserve, setEmployeeReserve] = useState(DEFAULT_RESERVE)
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS)
  const [activeTab, setActiveTab] = useState('chart')

  const states = useMemo(() => computeRounds(founders, rounds, employeeReserve), [founders, rounds, employeeReserve])

  const chartData = states.map(state => {
    const row = { name: state.label }
    Object.entries(state.ownership).forEach(([k, v]) => {
      row[k] = +(v * 100).toFixed(3)
    })
    return row
  })

  const allKeys = useMemo(() => {
    const keys = new Set()
    chartData.forEach(d => Object.keys(d).filter(k => k !== 'name').forEach(k => keys.add(k)))
    return Array.from(keys)
  }, [chartData])

  const addRound = (template) => {
    const t = template ?? {
      name: 'Custom',
      investment: 20000000,
      preMoneyVal: ((rounds[rounds.length - 1]?.preMoneyVal) || 10000000) * 3,
      unit: rounds[rounds.length - 1]?.unit || 'M',
      grantMode: 'shares',
      grantValue: 0,
    }
    setRounds([...rounds, {
      id: Date.now(),
      name: t.name,
      investment: t.investment,
      preMoneyVal: t.preMoneyVal,
      unit: t.unit || 'K',
      grantMode: t.grantMode || 'shares',
      grantValue: t.grantValue ?? 0,
    }])
  }

  const updateRound = (idx, field, val) => {
    setRounds(rounds.map((r, i) => i === idx ? { ...r, [field]: val } : r))
  }

  const removeRound = (idx) => setRounds(rounds.filter((_, i) => i !== idx))

  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)

  const reorderRounds = (from, to) => {
    if (from === to || from == null || to == null) return
    const next = rounds.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setRounds(next)
  }

  const makeDragHandlers = (idx) => ({
    onDragStart: (e) => {
      setDragIdx(idx)
      e.dataTransfer.effectAllowed = 'move'
      try { e.dataTransfer.setData('text/plain', String(idx)) } catch {}
    },
    onDragEnd: () => { setDragIdx(null); setDragOverIdx(null) },
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' },
    onDragEnter: () => { if (dragIdx !== null && dragIdx !== idx) setDragOverIdx(idx) },
    onDragLeave: (e) => {
      // only clear if leaving the row (not entering a child)
      if (e.currentTarget.contains(e.relatedTarget)) return
      setDragOverIdx(curr => curr === idx ? null : curr)
    },
    onDrop: (e) => {
      e.preventDefault()
      if (dragIdx !== null) reorderRounds(dragIdx, idx)
      setDragIdx(null); setDragOverIdx(null)
    },
  })

  const addFounder = () => setFounders([...founders, { name: `Founder ${founders.length + 1}`, shares: 1000000 }])
  const updateFounder = (idx, field, val) => setFounders(founders.map((f, i) => i === idx ? { ...f, [field]: val } : f))
  const removeFounder = (idx) => setFounders(founders.filter((_, i) => i !== idx))

  const lastState = states[states.length - 1]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        padding: '20px 32px',
        display: 'flex',
        alignItems: 'baseline',
        gap: 16,
        background: 'rgba(124,108,252,0.03)',
      }}>
        <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: 'var(--text)' }}>
          DILUTION MODEL
        </h1>
        <span style={{ color: 'var(--text-dim)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          equity modeling tool
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', minHeight: 'calc(100vh - 69px)' }}>
        {/* Left Panel */}
        <div style={{ borderRight: '1px solid var(--border)', padding: '24px 20px', overflowY: 'auto', maxHeight: 'calc(100vh - 69px)' }}>

          {/* Founders */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Founders & Cap Table
              </span>
              <button
                onClick={addFounder}
                style={{
                  background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                  color: 'var(--accent)', fontSize: 11, borderRadius: 4,
                  padding: '3px 10px', letterSpacing: '0.05em',
                  fontFamily: 'DM Mono',
                }}
              >+ ADD</button>
            </div>
            {founders.map((f, idx) => (
              <div key={idx} style={{
                display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 12px',
              }}>
                <input
                  type="text" value={f.name}
                  onChange={e => updateFounder(idx, 'name', e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-accent)', borderRadius: 0, padding: '2px 0', fontFamily: 'Syne', fontWeight: 600 }}
                />
                <input
                  type="number" value={f.shares}
                  onChange={e => updateFounder(idx, 'shares', +e.target.value)}
                  style={{ width: 110, textAlign: 'right', fontSize: 12 }}
                  placeholder="Shares"
                />
                <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 44, textAlign: 'right' }}>
                  {pct(f.shares / founders.reduce((s, x) => s + x.shares, 0))}
                </span>
                <button onClick={() => removeFounder(idx)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>

          {/* Employee Reserve */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Employee Reserve
              </span>
            </div>
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '10px 12px',
            }}>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Reserved Shares (pre-funding)
              </label>
              <input
                type="number"
                value={employeeReserve}
                onChange={e => setEmployeeReserve(Math.max(0, +e.target.value))}
                placeholder="0"
              />
              {(() => {
                const lastWithGrants = states[states.length - 1]
                const grantedAbs = lastWithGrants && lastWithGrants.ownership[GRANTED_KEY]
                  ? Math.round(lastWithGrants.ownership[GRANTED_KEY] * lastWithGrants.totalShares)
                  : 0
                const remaining = Math.max(0, employeeReserve - grantedAbs)
                return employeeReserve > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>
                    <span>Granted: <span style={{ color: 'var(--text)' }}>{grantedAbs.toLocaleString()}</span></span>
                    <span>Remaining: <span style={{ color: 'var(--text)' }}>{remaining.toLocaleString()}</span></span>
                  </div>
                ) : null
              })()}
            </div>
          </div>

          {/* Rounds */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Funding Rounds
              </span>
              <AddRoundDropdown onAdd={addRound} />
            </div>
            {rounds.map((r, idx) => (
              <RoundRow
                key={r.id}
                round={r}
                index={idx}
                onUpdate={updateRound}
                onRemove={removeRound}
                dragHandlers={makeDragHandlers(idx)}
                isDragging={dragIdx === idx}
                isDragOver={dragOverIdx === idx && dragIdx !== idx}
              />
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ padding: '24px 28px', overflowY: 'auto', maxHeight: 'calc(100vh - 69px)' }}>

          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
            {[
              { label: 'Post-Money Val', value: lastState?.postMoney ? fmt(lastState.postMoney) : '—' },
              { label: 'Price / Share', value: lastState?.pricePerShare ? `$${lastState.pricePerShare.toFixed(4)}` : '—' },
              { label: 'Total Shares', value: lastState?.totalShares ? (lastState.totalShares / 1e6).toFixed(2) + 'M' : '—' },
              { label: 'Rounds', value: rounds.length },
            ].map((s, i) => (
              <div key={i} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '14px 16px',
              }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontFamily: 'Syne' }}>{s.label}</div>
                <div style={{ fontSize: 20, fontFamily: 'Syne', fontWeight: 700, color: 'var(--accent)' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
            {['chart', 'table', 'waterfall'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'}`,
                  color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
                  fontFamily: 'Syne', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em',
                  textTransform: 'uppercase', padding: '8px 18px', cursor: 'pointer',
                  marginBottom: -1,
                }}
              >{tab}</button>
            ))}
          </div>

          {/* Chart */}
          {activeTab === 'chart' && (
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 16, letterSpacing: '0.04em' }}>
                Ownership % by stakeholder across funding rounds
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                  <YAxis tickFormatter={v => `${v}%`} tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  {allKeys.map((key, i) => (
                    <Area
                      key={key} type="monotone" dataKey={key}
                      stackId="1"
                      stroke={ROUND_COLORS[i % ROUND_COLORS.length]}
                      fill={ROUND_COLORS[i % ROUND_COLORS.length]}
                      fillOpacity={0.75}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 16 }}>
                {allKeys.map((key, i) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: ROUND_COLORS[i % ROUND_COLORS.length] }} />
                    {key}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table */}
          {activeTab === 'table' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontFamily: 'Syne', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Stakeholder</th>
                    {states.map((s, i) => (
                      <th key={i} style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontFamily: 'Syne', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allKeys.map((key, ki) => (
                    <tr key={key} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: ROUND_COLORS[ki % ROUND_COLORS.length], flexShrink: 0 }} />
                        <span style={{ color: 'var(--text)' }}>{key}</span>
                      </td>
                      {states.map((s, si) => {
                        const val = s.ownership[key]
                        const prev = si > 0 ? states[si - 1].ownership[key] : null
                        const delta = prev !== undefined && prev !== null && val !== undefined ? val - prev : null
                        return (
                          <td key={si} style={{ textAlign: 'right', padding: '9px 12px', fontFamily: 'DM Mono' }}>
                            {val !== undefined ? (
                              <div>
                                <span style={{ color: 'var(--text)' }}>{pct(val)}</span>
                                {delta !== null && delta !== 0 && (
                                  <span style={{ fontSize: 10, color: delta < 0 ? 'var(--red)' : 'var(--green)', marginLeft: 6 }}>
                                    {delta > 0 ? '+' : ''}{pct(delta)}
                                  </span>
                                )}
                              </div>
                            ) : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {/* Valuation row */}
                  <tr style={{ borderTop: '2px solid var(--border-accent)' }}>
                    <td style={{ padding: '9px 12px', color: 'var(--text-muted)', fontFamily: 'Syne', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Post-Money</td>
                    {states.map((s, si) => (
                      <td key={si} style={{ textAlign: 'right', padding: '9px 12px', color: 'var(--accent)', fontFamily: 'DM Mono' }}>
                        {s.postMoney ? fmt(s.postMoney) : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td style={{ padding: '9px 12px', color: 'var(--text-muted)', fontFamily: 'Syne', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>$/Share</td>
                    {states.map((s, si) => (
                      <td key={si} style={{ textAlign: 'right', padding: '9px 12px', color: 'var(--text-muted)', fontFamily: 'DM Mono', fontSize: 11 }}>
                        {s.pricePerShare ? `$${s.pricePerShare.toFixed(4)}` : '—'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Waterfall */}
          {activeTab === 'waterfall' && (
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 16 }}>
                Founder ownership dilution across rounds
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={states.slice(1)} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `$${(v / 1e6).toFixed(0)}M`} tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: '#14141f', border: '1px solid var(--border-accent)', borderRadius: 6, fontFamily: 'DM Mono', fontSize: 12 }} />
                  <Bar dataKey="preMoney" name="Pre-Money" radius={[3, 3, 0, 0]}>
                    {states.slice(1).map((_, i) => (
                      <Cell key={i} fill={ROUND_COLORS[i % ROUND_COLORS.length]} fillOpacity={0.7} />
                    ))}
                  </Bar>
                  <Bar dataKey="investment" name="Investment" radius={[3, 3, 0, 0]}>
                    {states.slice(1).map((_, i) => (
                      <Cell key={i} fill={ROUND_COLORS[i % ROUND_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Founder value table */}
              <div style={{ marginTop: 24 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Syne', fontWeight: 700, marginBottom: 12 }}>
                  Implied Founder Value (at post-money)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(founders.length, 4)}, 1fr)`, gap: 10 }}>
                  {founders.map((f, fi) => (
                    <div key={fi} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 6, fontFamily: 'Syne', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.name}</div>
                      {states.slice(1).map((s, si) => (
                        <div key={si} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{s.label}</span>
                          <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 500 }}>
                            {s.postMoney ? fmt((s.ownership[f.name] || 0) * s.postMoney) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

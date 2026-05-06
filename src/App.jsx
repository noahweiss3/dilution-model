import { useState, useMemo, useRef, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend
} from 'recharts'
import AuthBar from './components/AuthBar.jsx'
import ScenariosMenu from './components/ScenariosMenu.jsx'
import { computeRounds, RESERVE_KEY, GRANTED_KEY } from './model/dilutionEngine.js'
import { createScenarioState, normalizeScenarioState } from './model/scenarioSchema.js'

const ROUND_COLORS = ['#7c6cfc', '#fc6c8f', '#6cfcb8', '#fcb86c', '#6cb8fc', '#fc6cfc']

const DEFAULT_FOUNDERS = [
  { name: 'Founder 1', shares: 5000000 },
  { name: 'Founder 2', shares: 5000000 },
]

const DEFAULT_RESERVE = 2500000

const DEFAULT_ROUNDS = [
  {
    id: 1, name: 'Seed',
    investment: 3100000, preMoneyVal: 16000000, unit: 'M',
    grantMode: 'shares', grantValue: 0,
  },
  {
    id: 2, name: 'Series A',
    investment: 10000000, preMoneyVal: 30000000, unit: 'M',
    grantMode: 'shares', grantValue: 0,
  },
]

// Round templates ordered by typical timeline (earliest -> latest).
// Investment / preMoneyVal stored in raw dollars; UI shows them in the round's chosen `unit` ($K or $M).
const ROUND_TEMPLATES = [
  { name: 'Angel',       investment:    100000, preMoneyVal:   1500000, unit: 'K', grantMode: 'shares', grantValue: 0 },
  { name: 'Accelerator', investment:    125000, preMoneyVal:   1500000, unit: 'K', grantMode: 'shares', grantValue: 0 },
  { name: 'Pre-Seed',    investment:    500000, preMoneyVal:   4000000, unit: 'K', grantMode: 'shares', grantValue: 0 },
  { name: 'Seed',        investment:   3100000, preMoneyVal:  16000000, unit: 'M', grantMode: 'shares', grantValue: 0 },
  { name: 'Series A',    investment:  10000000, preMoneyVal:  30000000, unit: 'M', grantMode: 'shares', grantValue: 0 },
  { name: 'Series B',    investment:  30000000, preMoneyVal: 120000000, unit: 'M', grantMode: 'shares', grantValue: 0 },
  { name: 'Series C',    investment:  50000000, preMoneyVal: 200000000, unit: 'M', grantMode: 'shares', grantValue: 0 },
  { name: 'Series D',    investment: 100000000, preMoneyVal: 500000000, unit: 'M', grantMode: 'shares', grantValue: 0 },
]

// Sort key: position in ROUND_TEMPLATES (earlier index = earlier round). Custom and unknowns go last (preserved relative order).
const ROUND_ORDER = Object.fromEntries(ROUND_TEMPLATES.map((t, i) => [t.name, i]))
const sortKeyFor = (name) => ROUND_ORDER[name] ?? Number.MAX_SAFE_INTEGER

const UNIT_DIVISOR = { K: 1000, M: 1000000 }

function formatWithCommas(n, decimals = 0) {
  if (n == null || n === '' || isNaN(n)) return ''
  const num = +n
  if (decimals > 0) {
    // Preserve up to `decimals` decimals; trim trailing zeros only if integer.
    const fixed = num.toFixed(decimals)
    const [intPart, decPart] = fixed.split('.')
    return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (decPart ? '.' + decPart : '')
  }
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Comma-formatted number input. Shows formatted value when blurred,
// raw editable value when focused. `decimals` lets $M inputs keep 1 decimal.
function NumberInput({ value, onChange, decimals = 0, allowDecimal = false, style, ...rest }) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const display = focused
    ? draft
    : (value == null || value === '' ? '' : formatWithCommas(value, decimals))
  return (
    <input
      type="text"
      inputMode={allowDecimal || decimals > 0 ? 'decimal' : 'numeric'}
      value={display}
      onFocus={(e) => {
        setFocused(true)
        // Show plain numeric value (no commas) for easy editing.
        setDraft(value == null || value === '' ? '' : String(value))
        // Move cursor to end so user can immediately keep typing.
        requestAnimationFrame(() => {
          try { e.target.setSelectionRange(e.target.value.length, e.target.value.length) } catch {}
        })
      }}
      onChange={(e) => {
        const raw = e.target.value
        // Strip commas/spaces; keep digits, optional minus, single decimal point.
        const cleaned = raw.replace(/[, ]/g, '')
        if (cleaned === '' || cleaned === '-') {
          setDraft(cleaned)
          onChange(0)
          return
        }
        const allowDec = allowDecimal || decimals > 0
        const re = allowDec ? /^-?\d*\.?\d*$/ : /^-?\d*$/
        if (!re.test(cleaned)) return
        setDraft(cleaned)
        const parsed = allowDec ? parseFloat(cleaned) : parseInt(cleaned, 10)
        if (!isNaN(parsed)) onChange(parsed)
      }}
      onBlur={() => { setFocused(false); setDraft('') }}
      style={style}
      {...rest}
    />
  )
}

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

function RoundRow({ round, onUpdate, onPatch, onRemove, index, dragHandlers, isDragging, isDragOver, roundState, prevState, reserveCap }) {
  // When grant mode toggles, reset value to a sensible default so a "200000 shares"
  // value isn't silently reinterpreted as "200000%". Both fields must land in one
  // state update so the second change doesn't get overwritten by a stale snapshot.
  const update = (field, val) => {
    if (field === 'grantMode' && val !== round.grantMode) {
      onPatch(index, { grantMode: val, grantValue: 0 })
      return
    }
    onUpdate(index, field, val)
  }

  // Derived: dilution to existing holders this round.
  // dilutionPct = 1 - prevTotal / newTotal (any holder's pct shrinks by this factor)
  const dilutionPct = (roundState && prevState && roundState.totalShares > 0)
    ? 1 - (prevState.totalShares / roundState.totalShares)
    : 0

  // Live-converted grant share count when in % mode.
  const grantSharesPreview = round.grantMode === 'pct'
    ? Math.round(((round.grantValue || 0) / 100) * (reserveCap || 0))
    : null
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
        const decimals = unit === 'M' ? 1 : 0
        const fromInput = (v) => Math.round((+v) * div)
        // For $M, snap to 1 decimal so 30 → 30.0, 8.5 → 8.5.
        const toDisplay = (raw) => +((raw || 0) / div).toFixed(unit === 'M' ? 6 : 0)
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 10 }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pre-Money Val (${unit})</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>$</span>
                <NumberInput value={toDisplay(round.preMoneyVal)} onChange={(v) => update('preMoneyVal', fromInput(v))} decimals={decimals} allowDecimal={unit === 'M'} style={{ paddingLeft: 22 }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Investment (${unit})</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>$</span>
                <NumberInput value={toDisplay(round.investment)} onChange={(v) => update('investment', fromInput(v))} decimals={decimals} allowDecimal={unit === 'M'} style={{ paddingLeft: 22 }} />
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
          <NumberInput
            value={round.grantValue ?? 0}
            onChange={(v) => update('grantValue', v)}
            decimals={round.grantMode === 'pct' ? 1 : 0}
            allowDecimal={round.grantMode === 'pct'}
            style={{ flex: 1 }}
            placeholder={round.grantMode === 'pct' ? '% of reserve' : 'shares'}
          />
        </div>
        {grantSharesPreview !== null && (
          <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-dim)', fontFamily: 'DM Mono', textAlign: 'right' }}>
            = {grantSharesPreview.toLocaleString()} shares
          </div>
        )}
      </div>

      {/* Derived stats */}
      {roundState && (
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', gap: 12,
          fontSize: 11, fontFamily: 'DM Mono', color: 'var(--text-muted)',
        }}>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Post-Money: </span>
            <span style={{ color: 'var(--accent)' }}>{fmt(roundState.postMoney)}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Dilution: </span>
            <span style={{ color: 'var(--text)' }}>{(dilutionPct * 100).toFixed(2)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}

function ScaleButton({ currentTotal, onScale, disabled }) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState(currentTotal || 10000000)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  // When opening, prefill with current total so user sees what they're starting from.
  useEffect(() => {
    if (open) setTarget(currentTotal || 10000000)
  }, [open, currentTotal])

  const apply = () => {
    if (target > 0) onScale(target)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        title="Scale total founder shares to a target, preserving the current % split"
        style={{
          background: 'transparent', border: '1px solid var(--border-accent)',
          color: 'var(--text-muted)', fontSize: 11, borderRadius: 4,
          padding: '3px 10px', letterSpacing: '0.05em',
          fontFamily: 'DM Mono', cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
        }}
      >SCALE ▾</button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50,
          background: '#14141f', border: '1px solid var(--border-accent)',
          borderRadius: 6, padding: 12, minWidth: 220,
          boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
        }}>
          <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 10, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Syne', fontWeight: 700 }}>
            Target total founder shares
          </label>
          <NumberInput
            value={target}
            onChange={(v) => setTarget(v)}
            style={{ width: '100%', marginBottom: 8 }}
            placeholder="e.g. 10,000,000"
            autoFocus
          />
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.4 }}>
            Distributes shares according to current founder % split.
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, padding: '4px 10px', borderRadius: 4, fontFamily: 'DM Mono', cursor: 'pointer' }}
            >CANCEL</button>
            <button
              onClick={apply}
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: 11, padding: '4px 10px', borderRadius: 4, fontFamily: 'DM Mono', cursor: 'pointer' }}
            >APPLY</button>
          </div>
        </div>
      )}
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

const CustomTooltip = ({ active, payload, label, mode }) => {
  if (!active || !payload || !payload.length) return null
  const fmtVal = (v) => {
    if (mode === 'shares') {
      if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
      if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`
      return Math.round(v).toLocaleString()
    }
    return `${v.toFixed(2)}%`
  }
  return (
    <div style={{
      background: '#14141f', border: '1px solid var(--border-accent)',
      borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#e8e8f0',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'Syne', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>{label}</div>
      {payload.slice().reverse().map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
          <span style={{ color: 'var(--text-muted)' }}>{p.name}</span>
          <span style={{ fontWeight: 500, color: '#e8e8f0' }}>{fmtVal(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

const DEFAULT_SCENARIO_STATE = {
  founders: DEFAULT_FOUNDERS,
  employeeReserve: DEFAULT_RESERVE,
  employeesOnCapTablePreGrant: false,
  rounds: DEFAULT_ROUNDS,
  instruments: [],
}

// localStorage key for the auto-saved anonymous scenario.
const LOCAL_SCENARIO_KEY = 'dilution-model:current'

// Hydrate from localStorage on first render. Falls back to defaults if missing or malformed.
function loadInitialScenario() {
  if (typeof window === 'undefined') return { scenario: createScenarioState(DEFAULT_SCENARIO_STATE), warnings: [] }
  try {
    const raw = localStorage.getItem(LOCAL_SCENARIO_KEY)
    if (!raw) return { scenario: createScenarioState(DEFAULT_SCENARIO_STATE), warnings: [] }
    return normalizeScenarioState(JSON.parse(raw), DEFAULT_SCENARIO_STATE)
  } catch {
    return {
      scenario: createScenarioState(DEFAULT_SCENARIO_STATE),
      warnings: ['Saved scenario JSON was malformed; restored defaults.'],
    }
  }
}

export default function App({ clerkConfigured = false }) {
  const initial = useMemo(() => loadInitialScenario(), [])
  const [founders, setFounders] = useState(initial.scenario.founders)
  const [employeeReserve, setEmployeeReserve] = useState(initial.scenario.employeeReserve)
  const [employeesOnCapTablePreGrant, setEmployeesOnCapTablePreGrant] = useState(initial.scenario.employeesOnCapTablePreGrant)
  const [rounds, setRounds] = useState(initial.scenario.rounds)
  const [instruments, setInstruments] = useState(initial.scenario.instruments)
  const [scenarioWarning, setScenarioWarning] = useState(initial.warnings.join(' '))
  const [activeTab, setActiveTab] = useState('chart')
  const [valueMode, setValueMode] = useState('pct') // 'pct' | 'shares'

  // Auto-save scenario to localStorage on any change.
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_SCENARIO_KEY, JSON.stringify({
        ...createScenarioState({ founders, employeeReserve, employeesOnCapTablePreGrant, rounds, instruments }),
        savedAt: new Date().toISOString(),
      }))
    } catch { /* quota exceeded or private mode — fail silently */ }
  }, [founders, employeeReserve, employeesOnCapTablePreGrant, rounds, instruments])

  const states = useMemo(
    () => computeRounds(founders, rounds, employeeReserve, employeesOnCapTablePreGrant),
    [founders, rounds, employeeReserve, employeesOnCapTablePreGrant]
  )

  const chartData = states.map(state => {
    const row = { name: state.label }
    Object.entries(state.ownership).forEach(([k, v]) => {
      if (valueMode === 'shares') {
        row[k] = Math.round(v * state.totalShares)
      } else {
        row[k] = +(v * 100).toFixed(3)
      }
    })
    return row
  })

  const fmtShares = (n) => {
    if (n == null || isNaN(n)) return '—'
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
    return n.toLocaleString()
  }

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
    const newRound = {
      id: Date.now(),
      name: t.name,
      investment: t.investment,
      preMoneyVal: t.preMoneyVal,
      unit: t.unit || 'K',
      grantMode: t.grantMode || 'shares',
      grantValue: t.grantValue ?? 0,
    }
    // Insert in correct sorted position based on ROUND_TEMPLATES order.
    // Place AFTER the last round whose sort key is <= new round's sort key.
    const newKey = sortKeyFor(newRound.name)
    let insertAt = rounds.length
    for (let i = rounds.length - 1; i >= 0; i--) {
      if (sortKeyFor(rounds[i].name) <= newKey) { insertAt = i + 1; break }
      insertAt = i
    }
    const next = rounds.slice()
    next.splice(insertAt, 0, newRound)
    setRounds(next)
  }

  const updateRound = (idx, field, val) => {
    setRounds(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r))
  }
  const patchRound = (idx, patch) => {
    setRounds(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
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

  const equalizeFounders = () => {
    if (founders.length === 0) return
    const total = founders.reduce((s, f) => s + (f.shares || 0), 0)
    const each = Math.round((total || founders.length * 1000000) / founders.length)
    setFounders(founders.map(f => ({ ...f, shares: each })))
  }

  // Scale founder shares so total founder shares = `targetTotal`,
  // preserving the current ownership split (% within founders).
  const scaleFounders = (targetTotal) => {
    if (founders.length === 0 || !targetTotal || targetTotal <= 0) return
    const currentTotal = founders.reduce((s, f) => s + (f.shares || 0), 0)
    if (currentTotal === 0) {
      // No existing split — split target equally.
      const each = Math.round(targetTotal / founders.length)
      setFounders(founders.map(f => ({ ...f, shares: each })))
      return
    }
    const factor = targetTotal / currentTotal
    setFounders(founders.map(f => ({ ...f, shares: Math.round((f.shares || 0) * factor) })))
  }

  // Edit a founder's % directly. Holds total founder shares constant; redistributes
  // the difference proportionally across the OTHER founders so percentages sum to 100%.
  const updateFounderPct = (idx, newPct) => {
    if (founders.length < 2) return
    const total = founders.reduce((s, f) => s + (f.shares || 0), 0)
    if (!total) return
    const clamped = Math.max(0, Math.min(99.99, newPct))
    const targetShares = Math.round((clamped / 100) * total)
    const otherTotal = total - (founders[idx].shares || 0)
    const remainingForOthers = total - targetShares
    setFounders(founders.map((f, i) => {
      if (i === idx) return { ...f, shares: targetShares }
      if (otherTotal === 0) {
        // edge case: everyone else has 0 — distribute equally among others
        return { ...f, shares: Math.round(remainingForOthers / (founders.length - 1)) }
      }
      const ratio = (f.shares || 0) / otherTotal
      return { ...f, shares: Math.round(ratio * remainingForOthers) }
    }))
  }

  const lastState = states[states.length - 1]

  const [leftWidth, setLeftWidth] = useState(380)
  const splitterDragging = useRef(false)
  useEffect(() => {
    const onMove = (e) => {
      if (!splitterDragging.current) return
      const w = Math.max(280, Math.min(720, e.clientX))
      setLeftWidth(w)
    }
    const onUp = () => {
      if (splitterDragging.current) {
        splitterDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScenariosMenu
            clerkConfigured={clerkConfigured}
            getScenarioState={() => createScenarioState({
              founders, employeeReserve, employeesOnCapTablePreGrant, rounds, instruments,
            })}
            applyScenarioState={(data) => {
              const { scenario, warnings } = normalizeScenarioState(data, DEFAULT_SCENARIO_STATE)
              setFounders(scenario.founders)
              setEmployeeReserve(scenario.employeeReserve)
              setEmployeesOnCapTablePreGrant(scenario.employeesOnCapTablePreGrant)
              setRounds(scenario.rounds)
              setInstruments(scenario.instruments)
              setScenarioWarning(warnings.join(' '))
            }}
          />
          <button
            onClick={async () => {
              const { exportWorkbook } = await import('./lib/exportWorkbook.js')
              const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
              await exportWorkbook(
                { founders, employeeReserve, employeesOnCapTablePreGrant, rounds, instruments, states, allKeys },
                `dilution-model-${ts}.xlsx`,
              )
            }}
            title="Download a snapshot of all inputs and computed cap-table data as .xlsx"
            style={{
              background: 'var(--accent-dim)', border: '1px solid var(--accent)',
              color: 'var(--accent)', fontSize: 11, borderRadius: 4,
              padding: '6px 14px', letterSpacing: '0.06em',
              fontFamily: 'DM Mono', cursor: 'pointer',
            }}
          >EXPORT .XLSX</button>
          <AuthBar clerkConfigured={clerkConfigured} />
        </div>
      </div>

      {scenarioWarning && (
        <div style={{
          background: 'rgba(252,184,108,0.10)', borderBottom: '1px solid rgba(252,184,108,0.35)',
          color: '#fcb86c', padding: '8px 32px', fontSize: 12, fontFamily: 'DM Mono',
          display: 'flex', justifyContent: 'space-between', gap: 16,
        }}>
          <span>{scenarioWarning}</span>
          <button
            onClick={() => setScenarioWarning('')}
            style={{ background: 'none', border: 'none', color: '#fcb86c', cursor: 'pointer', fontSize: 13 }}
            title="Dismiss scenario warning"
          >×</button>
        </div>
      )}

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 69px)' }}>
        {/* Left Panel */}
        <div style={{ width: leftWidth, flexShrink: 0, padding: '24px 20px', overflowY: 'auto', maxHeight: 'calc(100vh - 69px)' }}>

          {/* Founders */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8 }}>
              <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Initial Cap Table
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={equalizeFounders}
                  disabled={founders.length < 2}
                  title="Distribute total founder shares evenly"
                  style={{
                    background: 'transparent', border: '1px solid var(--border-accent)',
                    color: 'var(--text-muted)', fontSize: 11, borderRadius: 4,
                    padding: '3px 10px', letterSpacing: '0.05em',
                    fontFamily: 'DM Mono', cursor: founders.length < 2 ? 'not-allowed' : 'pointer',
                    opacity: founders.length < 2 ? 0.4 : 1,
                  }}
                >EQUALIZE</button>
                <ScaleButton
                  currentTotal={founders.reduce((s, f) => s + (f.shares || 0), 0)}
                  onScale={scaleFounders}
                  disabled={founders.length === 0}
                />
                <button
                  onClick={addFounder}
                  style={{
                    background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                    color: 'var(--accent)', fontSize: 11, borderRadius: 4,
                    padding: '3px 10px', letterSpacing: '0.05em',
                    fontFamily: 'DM Mono', cursor: 'pointer',
                  }}
                >+ ADD</button>
              </div>
            </div>
            {founders.map((f, idx) => {
              const totalFounderShares = founders.reduce((s, x) => s + (x.shares || 0), 0) || 1
              const founderPct = ((f.shares || 0) / totalFounderShares) * 100
              return (
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
                  <NumberInput
                    value={f.shares}
                    onChange={(v) => updateFounder(idx, 'shares', v)}
                    style={{ width: 110, textAlign: 'right', fontSize: 12 }}
                    placeholder="Shares"
                  />
                  <div style={{ position: 'relative', width: 80 }}>
                    <NumberInput
                      value={+founderPct.toFixed(2)}
                      onChange={(v) => updateFounderPct(idx, v)}
                      decimals={2}
                      allowDecimal
                      disabled={founders.length < 2}
                      title={founders.length < 2 ? 'Add another founder to edit %' : 'Edit % — redistributes among other founders'}
                      style={{ width: '100%', textAlign: 'right', fontSize: 12, paddingRight: 16 }}
                    />
                    <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 11, pointerEvents: 'none' }}>%</span>
                  </div>
                  <button onClick={() => removeFounder(idx)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 16, cursor: 'pointer' }}>×</button>
                </div>
              )
            })}
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
              <NumberInput
                value={employeeReserve}
                onChange={(v) => setEmployeeReserve(Math.max(0, v))}
                placeholder="0"
              />
              <label
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10,
                  fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1.4,
                }}
                title="When ON, the full reserve sits on the cap table from day 1 (pre-issued). When OFF, only granted shares appear on the cap table — granting issues new shares."
              >
                <input
                  type="checkbox"
                  checked={employeesOnCapTablePreGrant}
                  onChange={e => setEmployeesOnCapTablePreGrant(e.target.checked)}
                  style={{ marginTop: 2, accentColor: 'var(--accent)' }}
                />
                <span>
                  Reserve on cap table before grants
                  <span style={{ display: 'block', color: 'var(--text-dim)', fontSize: 10, marginTop: 2 }}>
                    {employeesOnCapTablePreGrant
                      ? 'Full reserve pre-issued; grants transfer shares.'
                      : 'Only granted shares on cap table; grants issue new shares.'}
                  </span>
                </span>
              </label>
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
                onPatch={patchRound}
                onRemove={removeRound}
                dragHandlers={makeDragHandlers(idx)}
                isDragging={dragIdx === idx}
                isDragOver={dragOverIdx === idx && dragIdx !== idx}
                roundState={states[idx + 1]}
                prevState={states[idx]}
                reserveCap={employeeReserve}
              />
            ))}
          </div>
        </div>

        {/* Splitter */}
        <div
          onMouseDown={() => {
            splitterDragging.current = true
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
          }}
          onDoubleClick={() => setLeftWidth(380)}
          title="Drag to resize • Double-click to reset"
          style={{
            width: 6, flexShrink: 0, cursor: 'col-resize',
            background: 'var(--border)', position: 'relative',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--border)'}
        />

        {/* Right Panel */}
        <div style={{ flex: 1, minWidth: 0, padding: '24px 28px', overflowY: 'auto', maxHeight: 'calc(100vh - 69px)' }}>

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
          <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)', alignItems: 'flex-end' }}>
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
            {activeTab !== 'waterfall' && (
              <div style={{ marginLeft: 'auto', marginBottom: 4 }}>
                <div style={{ display: 'inline-flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  {[
                    { id: 'pct', label: '% EQUITY' },
                    { id: 'shares', label: '# SHARES' },
                  ].map(o => (
                    <button
                      key={o.id}
                      onClick={() => setValueMode(o.id)}
                      style={{
                        background: valueMode === o.id ? 'var(--accent-dim)' : 'transparent',
                        color: valueMode === o.id ? 'var(--accent)' : 'var(--text-muted)',
                        border: 'none', fontFamily: 'DM Mono', fontSize: 10,
                        padding: '4px 10px', cursor: 'pointer', letterSpacing: '0.05em',
                      }}
                    >{o.label}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chart */}
          {activeTab === 'chart' && (
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 16, letterSpacing: '0.04em' }}>
                {valueMode === 'shares' ? 'Shares held' : 'Ownership %'} by stakeholder across funding rounds
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                  <YAxis tickFormatter={v => valueMode === 'shares' ? fmtShares(v) : `${v}%`} tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} width={valueMode === 'shares' ? 60 : 40} />
                  <Tooltip content={<CustomTooltip mode={valueMode} />} />
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
                        const showShares = valueMode === 'shares'
                        const sharesAbs = val !== undefined ? Math.round(val * s.totalShares) : null
                        const prevSharesAbs = prev !== undefined && prev !== null ? Math.round(prev * states[si - 1].totalShares) : null
                        const sharesDelta = sharesAbs !== null && prevSharesAbs !== null ? sharesAbs - prevSharesAbs : null
                        const stakeValue = val !== undefined && s.postMoney ? val * s.postMoney : null
                        return (
                          <td key={si} style={{ textAlign: 'right', padding: '9px 12px', fontFamily: 'DM Mono' }}>
                            {val !== undefined ? (
                              <div>
                                <div>
                                  <span style={{ color: 'var(--text)' }}>
                                    {showShares ? fmtShares(sharesAbs) : pct(val)}
                                  </span>
                                  {showShares
                                    ? (sharesDelta !== null && sharesDelta !== 0 && (
                                        <span style={{ fontSize: 10, color: sharesDelta < 0 ? 'var(--red)' : 'var(--green)', marginLeft: 6 }}>
                                          {sharesDelta > 0 ? '+' : ''}{fmtShares(Math.abs(sharesDelta)).replace(/^/, sharesDelta < 0 ? '-' : '')}
                                        </span>
                                      ))
                                    : (delta !== null && delta !== 0 && (
                                        <span style={{ fontSize: 10, color: delta < 0 ? 'var(--red)' : 'var(--green)', marginLeft: 6 }}>
                                          {delta > 0 ? '+' : ''}{pct(delta)}
                                        </span>
                                      ))
                                  }
                                </div>
                                {stakeValue !== null && (
                                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                                    {fmt(stakeValue)}
                                  </div>
                                )}
                              </div>
                            ) : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr style={{ borderTop: '2px solid var(--border-accent)' }}>
                    <td style={{ padding: '9px 12px', color: 'var(--text-muted)', fontFamily: 'Syne', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</td>
                    {states.map((s, si) => {
                      const showShares = valueMode === 'shares'
                      const totalPct = Object.values(s.ownership).reduce((sum, v) => sum + (v || 0), 0)
                      return (
                        <td key={si} style={{ textAlign: 'right', padding: '9px 12px', color: 'var(--text)', fontFamily: 'DM Mono' }}>
                          {showShares ? fmtShares(s.totalShares) : `${(totalPct * 100).toFixed(1)}%`}
                        </td>
                      )
                    })}
                  </tr>
                  {/* Post-Money row */}
                  <tr>
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
                  <Tooltip
                    cursor={{ fill: 'rgba(124,108,252,0.08)' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null
                      const datum = payload[0].payload
                      return (
                        <div style={{
                          background: '#14141f', border: '1px solid var(--border-accent)',
                          borderRadius: 6, padding: '10px 14px', fontSize: 12,
                          color: '#e8e8f0', fontFamily: 'DM Mono',
                        }}>
                          <div style={{ color: '#a4a4b8', marginBottom: 6, fontFamily: 'Syne', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>{label}</div>
                          {payload.map((p, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                              <span style={{ color: '#a4a4b8' }}>{p.name}</span>
                              <span style={{ color: '#e8e8f0' }}>{fmt(p.value)}</span>
                            </div>
                          ))}
                          <div style={{ borderTop: '1px solid var(--border-accent)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                            <span style={{ color: '#a4a4b8' }}>Post-Money</span>
                            <span style={{ color: 'var(--accent)' }}>{fmt(datum.postMoney)}</span>
                          </div>
                        </div>
                      )
                    }}
                  />
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

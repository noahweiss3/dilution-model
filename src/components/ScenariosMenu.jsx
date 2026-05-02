import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth, SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react'
import { makeSupabaseClient, supabaseConfigured } from '../lib/supabase'
import {
  listScenarios, loadScenario, createScenario, updateScenario, deleteScenario,
} from '../lib/scenarios'

// Top-of-app scenarios menu. Wraps three states:
//   - signed out → button that prompts sign-in
//   - signed in, no scenarios → "Save current as..." prompt
//   - signed in, has scenarios → dropdown listing each scenario
//
// Communicates with parent via:
//   - getScenarioState(): () => current serializable state
//   - applyScenarioState(data): (data) => void; replaces app state
//
// Loaded scenario id + name surface as a small status next to the button.
export default function ScenariosMenu({ getScenarioState, applyScenarioState, clerkConfigured }) {
  const auth = clerkConfigured ? useAuth() : { isSignedIn: false, getToken: () => null }
  const { isSignedIn, getToken } = auth

  // Memoize the supabase client so we don't rebuild on every render — but
  // re-create when sign-in state changes (so the new JWT is used).
  const supabase = useMemo(() => {
    if (!isSignedIn || !supabaseConfigured) return null
    return makeSupabaseClient(() => getToken({ template: 'supabase' }))
  }, [isSignedIn, getToken])

  const [scenarios, setScenarios] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)
  const [currentId, setCurrentId] = useState(null)
  const [currentName, setCurrentName] = useState(null)
  const ref = useRef(null)

  // Refresh scenarios list whenever user signs in or menu opens.
  useEffect(() => {
    if (!supabase) { setScenarios([]); return }
    setLoading(true)
    listScenarios(supabase)
      .then(rows => { setScenarios(rows); setError(null) })
      .catch(err => setError(err.message || String(err)))
      .finally(() => setLoading(false))
  }, [supabase, open])

  // Click-outside to close dropdown.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const refresh = async () => {
    if (!supabase) return
    try { setScenarios(await listScenarios(supabase)) } catch (e) { setError(e.message) }
  }

  const handleSaveAs = async () => {
    const name = window.prompt('Name this scenario:')
    if (!name || !name.trim()) return
    try {
      const row = await createScenario(supabase, name.trim(), getScenarioState())
      setCurrentId(row.id)
      setCurrentName(row.name)
      await refresh()
    } catch (e) { setError(e.message); window.alert('Save failed: ' + e.message) }
  }

  const handleSave = async () => {
    if (!currentId) return handleSaveAs()
    try {
      await updateScenario(supabase, currentId, { data: getScenarioState() })
      await refresh()
    } catch (e) { setError(e.message); window.alert('Save failed: ' + e.message) }
  }

  const handleLoad = async (id) => {
    try {
      const row = await loadScenario(supabase, id)
      applyScenarioState(row.data)
      setCurrentId(row.id)
      setCurrentName(row.name)
      setOpen(false)
    } catch (e) { setError(e.message); window.alert('Load failed: ' + e.message) }
  }

  const handleRename = async (s) => {
    const name = window.prompt('Rename scenario:', s.name)
    if (!name || !name.trim() || name === s.name) return
    try {
      await updateScenario(supabase, s.id, { name: name.trim() })
      if (s.id === currentId) setCurrentName(name.trim())
      await refresh()
    } catch (e) { setError(e.message); window.alert('Rename failed: ' + e.message) }
  }

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete "${s.name}"? This can't be undone.`)) return
    try {
      await deleteScenario(supabase, s.id)
      if (s.id === currentId) { setCurrentId(null); setCurrentName(null) }
      await refresh()
    } catch (e) { setError(e.message); window.alert('Delete failed: ' + e.message) }
  }

  if (!clerkConfigured || !supabaseConfigured) {
    // No backend configured — auth/scenarios disabled. Don't render anything.
    return null
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
      <SignedOut>
        <SignInButton mode="modal">
          <button
            title="Sign in to save and load scenarios"
            style={{
              background: 'var(--accent-dim)', border: '1px solid var(--accent)',
              color: 'var(--accent)', fontSize: 11, borderRadius: 4,
              padding: '6px 14px', letterSpacing: '0.06em',
              fontFamily: 'DM Mono', cursor: 'pointer',
            }}
          >SIGN IN TO SAVE</button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        {currentName && (
          <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }}>
            <span style={{ color: 'var(--text-dim)' }}>scenario:</span> {currentName}
          </span>
        )}
        <button
          onClick={handleSave}
          title={currentId ? `Save changes to "${currentName}"` : 'Save current as new scenario'}
          style={{
            background: 'transparent', border: '1px solid var(--border-accent)',
            color: 'var(--text-muted)', fontSize: 11, borderRadius: 4,
            padding: '6px 12px', letterSpacing: '0.06em',
            fontFamily: 'DM Mono', cursor: 'pointer',
          }}
        >SAVE</button>
        <button
          onClick={() => setOpen(o => !o)}
          title="View saved scenarios"
          style={{
            background: 'transparent', border: '1px solid var(--border-accent)',
            color: 'var(--text-muted)', fontSize: 11, borderRadius: 4,
            padding: '6px 12px', letterSpacing: '0.06em',
            fontFamily: 'DM Mono', cursor: 'pointer',
          }}
        >SCENARIOS ▾</button>
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100,
            background: '#14141f', border: '1px solid var(--border-accent)',
            borderRadius: 6, padding: 6, minWidth: 280, maxHeight: 400, overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            <button
              onClick={handleSaveAs}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                color: 'var(--accent)', fontSize: 11, padding: '7px 10px',
                borderRadius: 4, cursor: 'pointer', fontFamily: 'DM Mono',
                marginBottom: 6, letterSpacing: '0.05em',
              }}
            >+ SAVE CURRENT AS NEW</button>
            {loading && <div style={{ padding: 10, color: 'var(--text-muted)', fontSize: 11 }}>Loading…</div>}
            {error && <div style={{ padding: 10, color: 'var(--red)', fontSize: 11 }}>Error: {error}</div>}
            {!loading && !error && scenarios.length === 0 && (
              <div style={{ padding: 10, color: 'var(--text-dim)', fontSize: 11, fontStyle: 'italic' }}>
                No saved scenarios yet.
              </div>
            )}
            {scenarios.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px',
                borderRadius: 4,
                background: s.id === currentId ? 'rgba(124,108,252,0.08)' : 'transparent',
              }}>
                <button
                  onClick={() => handleLoad(s.id)}
                  style={{
                    flex: 1, textAlign: 'left', background: 'none', border: 'none',
                    color: 'var(--text)', fontSize: 12, fontFamily: 'DM Mono',
                    padding: '4px 6px', cursor: 'pointer', borderRadius: 3,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,108,252,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div>{s.name}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 9, marginTop: 1 }}>
                    {new Date(s.updated_at).toLocaleDateString()}
                  </div>
                </button>
                <button
                  onClick={() => handleRename(s)}
                  title="Rename"
                  style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11, padding: '4px 6px' }}
                >✎</button>
                <button
                  onClick={() => handleDelete(s)}
                  title="Delete"
                  style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14, padding: '4px 6px' }}
                >×</button>
              </div>
            ))}
          </div>
        )}
      </SignedIn>
    </div>
  )
}

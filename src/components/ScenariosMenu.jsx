import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth, SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react'
import { makeSupabaseClient, supabaseConfigured } from '../lib/supabase'
import {
  listScenarios, loadScenario, createScenario, updateScenario, deleteScenario,
} from '../lib/scenarios'
import Modal, { ModalActions, ModalButton } from './Modal.jsx'

// Top-of-app scenarios menu. Wraps three states:
//   - signed out → button that prompts sign-in
//   - signed in, no scenarios → "Save current as..." prompt
//   - signed in, has scenarios → dropdown listing each scenario
//
// Communicates with parent via:
//   - getScenarioState(): () => current serializable state
//   - applyScenarioState(data): (data) => void; replaces app state
export default function ScenariosMenu({ getScenarioState, applyScenarioState, clerkConfigured }) {
  const auth = clerkConfigured ? useAuth() : { isSignedIn: false, getToken: () => null }
  const { isSignedIn, getToken } = auth

  const supabase = useMemo(() => {
    if (!isSignedIn || !supabaseConfigured) return null
    // Native Supabase↔Clerk integration: use the default Clerk session token
    // (no JWT template), which Supabase verifies via JWKS from the Clerk domain.
    return makeSupabaseClient(() => getToken())
  }, [isSignedIn, getToken])

  const [scenarios, setScenarios] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)
  const [currentId, setCurrentId] = useState(null)
  const [currentName, setCurrentName] = useState(null)
  const ref = useRef(null)

  // Modal state — one of: null, { type: 'saveAs' }, { type: 'rename', scenario },
  // { type: 'delete', scenario }, { type: 'message', text }.
  const [modal, setModal] = useState(null)
  // Toast text for transient success messages (auto-clears after a couple seconds).
  const [toast, setToast] = useState(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  // Refresh scenarios list whenever user signs in or menu opens.
  useEffect(() => {
    if (!supabase) { setScenarios([]); return }
    setLoading(true)
    listScenarios(supabase)
      .then(rows => { setScenarios(rows); setError(null) })
      .catch(err => setError(err.message || String(err)))
      .finally(() => setLoading(false))
  }, [supabase, open])

  // Click-outside to close dropdown (but not when a modal is open over it).
  useEffect(() => {
    if (!open || modal) return
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open, modal])

  const refresh = async () => {
    if (!supabase) return
    try { setScenarios(await listScenarios(supabase)) } catch (e) { setError(e.message) }
  }

  const showError = (text) => setModal({ type: 'message', text, kind: 'error' })

  const doSaveAs = async (name) => {
    try {
      const row = await createScenario(supabase, name, getScenarioState())
      setCurrentId(row.id)
      setCurrentName(row.name)
      await refresh()
      setToast(`Saved "${row.name}"`)
      setModal(null)
    } catch (e) { showError('Save failed: ' + e.message) }
  }

  const handleSave = async () => {
    if (!currentId) { setModal({ type: 'saveAs' }); return }
    try {
      await updateScenario(supabase, currentId, { data: getScenarioState() })
      await refresh()
      setToast(`Updated "${currentName}"`)
    } catch (e) { showError('Save failed: ' + e.message) }
  }

  const handleLoad = async (id) => {
    try {
      const row = await loadScenario(supabase, id)
      applyScenarioState(row.data)
      setCurrentId(row.id)
      setCurrentName(row.name)
      setOpen(false)
      setToast(`Loaded "${row.name}"`)
    } catch (e) { showError('Load failed: ' + e.message) }
  }

  const doRename = async (s, name) => {
    try {
      await updateScenario(supabase, s.id, { name })
      if (s.id === currentId) setCurrentName(name)
      await refresh()
      setModal(null)
      setToast('Renamed')
    } catch (e) { showError('Rename failed: ' + e.message) }
  }

  const doDelete = async (s) => {
    try {
      await deleteScenario(supabase, s.id)
      if (s.id === currentId) { setCurrentId(null); setCurrentName(null) }
      await refresh()
      setModal(null)
      setToast(`Deleted "${s.name}"`)
    } catch (e) { showError('Delete failed: ' + e.message) }
  }

  if (!clerkConfigured || !supabaseConfigured) {
    // No backend configured — auth/scenarios disabled.
    return null
  }

  return (
    <>
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
                onClick={() => setModal({ type: 'saveAs' })}
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
                    onClick={() => setModal({ type: 'rename', scenario: s })}
                    title="Rename"
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11, padding: '4px 6px' }}
                  >✎</button>
                  <button
                    onClick={() => setModal({ type: 'delete', scenario: s })}
                    title="Delete"
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14, padding: '4px 6px' }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </SignedIn>
      </div>

      {/* Modals */}
      {modal?.type === 'saveAs' && (
        <NameModal
          title="Save scenario as"
          submitLabel="SAVE"
          initial=""
          placeholder="e.g. Conservative case"
          onCancel={() => setModal(null)}
          onSubmit={doSaveAs}
        />
      )}
      {modal?.type === 'rename' && (
        <NameModal
          title="Rename scenario"
          submitLabel="RENAME"
          initial={modal.scenario.name}
          placeholder="New name"
          onCancel={() => setModal(null)}
          onSubmit={(name) => doRename(modal.scenario, name)}
        />
      )}
      {modal?.type === 'delete' && (
        <Modal open onClose={() => setModal(null)} title="Delete scenario?">
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
            Permanently delete <strong style={{ color: 'var(--accent)' }}>“{modal.scenario.name}”</strong>?
            This can't be undone.
          </div>
          <ModalActions>
            <ModalButton onClick={() => setModal(null)}>CANCEL</ModalButton>
            <ModalButton variant="danger" onClick={() => doDelete(modal.scenario)}>DELETE</ModalButton>
          </ModalActions>
        </Modal>
      )}
      {modal?.type === 'message' && (
        <Modal open onClose={() => setModal(null)} title={modal.kind === 'error' ? 'Error' : 'Notice'}>
          <div style={{ fontSize: 13, color: modal.kind === 'error' ? 'var(--red)' : 'var(--text)', lineHeight: 1.4, wordBreak: 'break-word' }}>
            {modal.text}
          </div>
          <ModalActions>
            <ModalButton variant="primary" onClick={() => setModal(null)}>OK</ModalButton>
          </ModalActions>
        </Modal>
      )}

      {/* Toast (in-app, non-blocking) */}
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 1100,
            background: '#14141f', border: '1px solid var(--accent)',
            borderRadius: 6, padding: '10px 16px',
            color: 'var(--accent)', fontFamily: 'DM Mono', fontSize: 12,
            letterSpacing: '0.05em', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >{toast}</div>
      )}
    </>
  )
}

// Small helper modal for name-input flows. Local state for the field, focus on
// open, Enter submits, Escape cancels (handled by the parent Modal).
function NameModal({ title, initial, submitLabel, placeholder, onCancel, onSubmit }) {
  const [value, setValue] = useState(initial || '')
  const inputRef = useRef(null)
  useEffect(() => {
    // Focus and select on open so existing names can be quickly overwritten.
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [])
  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }
  return (
    <Modal open onClose={onCancel} title={title}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); submit() }
          if (e.key === 'Escape') { e.preventDefault(); onCancel() }
        }}
        placeholder={placeholder}
        style={{
          width: '100%', background: 'var(--bg)', border: '1px solid var(--border-accent)',
          borderRadius: 4, padding: '10px 12px', color: 'var(--text)',
          fontSize: 14, fontFamily: 'Syne', fontWeight: 600,
        }}
      />
      <ModalActions>
        <ModalButton onClick={onCancel}>CANCEL</ModalButton>
        <ModalButton variant="primary" onClick={submit} disabled={!value.trim()}>{submitLabel}</ModalButton>
      </ModalActions>
    </Modal>
  )
}

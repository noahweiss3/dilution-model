import { useEffect, useRef } from 'react'

// Centered dark modal matching the app's aesthetic. Closes on ESC and
// click-outside. Renders nothing when `open` is false.
export default function Modal({ open, onClose, title, children, width = 380 }) {
  const cardRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    // Lock background scroll while modal is open.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onMouseDown={(e) => { if (cardRef.current && !cardRef.current.contains(e.target)) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(8,8,16,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        ref={cardRef}
        style={{
          background: '#14141f', border: '1px solid var(--border-accent)',
          borderRadius: 8, padding: '20px 24px', width, maxWidth: '90vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)', color: 'var(--text)',
        }}
      >
        {title && (
          <div style={{
            fontFamily: 'Syne', fontWeight: 700, fontSize: 11,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--text-muted)', marginBottom: 14,
          }}>{title}</div>
        )}
        {children}
      </div>
    </div>
  )
}

// Standard footer button row, right-aligned.
export function ModalActions({ children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
      {children}
    </div>
  )
}

export function ModalButton({ variant = 'default', children, ...rest }) {
  const styles = variant === 'primary' ? {
    background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent)',
  } : variant === 'danger' ? {
    background: 'rgba(252,108,143,0.12)', border: '1px solid var(--red)', color: 'var(--red)',
  } : {
    background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
  }
  return (
    <button
      {...rest}
      style={{
        fontSize: 11, padding: '6px 14px', borderRadius: 4,
        fontFamily: 'DM Mono', cursor: 'pointer', letterSpacing: '0.05em',
        ...styles,
      }}
    >{children}</button>
  )
}

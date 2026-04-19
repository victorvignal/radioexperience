import { useRef } from 'react'
import { C, IconTrash, IconEdit, IconPlus } from './Icons'

// ─── Session item ─────────────────────────────────────────────────────────────

function SessionItem({ session, isActive, onSelect, onRename, onDelete }) {
  return (
    <div
      onClick={() => onSelect(session.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
        background: isActive ? C.accentSoft : 'transparent',
        border: `1px solid ${isActive ? 'rgba(221,255,85,0.2)' : 'transparent'}`,
        transition: 'background 0.12s, border-color 0.12s',
      }}
    >
      {/* icon */}
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <path
          d="M2 3h12v9H2zM2 3h12v9H2z"
          stroke={isActive ? C.accent : C.textDim}
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={isActive ? C.accent : 'none'}
          fillOpacity={isActive ? 0.2 : 0}
        />
        <path d="M5 6h6M5 9h4" stroke={isActive ? C.accent : C.textDim} strokeWidth="1.3" strokeLinecap="round" />
      </svg>

      {/* title */}
      <span style={{
        flex: 1, fontSize: 12, fontWeight: isActive ? 600 : 400,
        color: isActive ? C.accent : C.textSoft,
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
      }}>
        {session.title || 'Nova conversa'}
      </span>

      {/* actions */}
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onRename(session) }}
          title="Renomear"
          style={{
            width: 22, height: 22, borderRadius: 5, border: 'none',
            background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: C.textDim, transition: 'color 0.12s',
          }}
        >
          <IconEdit size={12} color={C.textDim} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(session) }}
          title="Apagar"
          style={{
            width: 22, height: 22, borderRadius: 5, border: 'none',
            background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: C.textDim, transition: 'color 0.12s',
          }}
        >
          <IconTrash size={12} color={C.textDim} />
        </button>
      </div>
    </div>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function Sidebar({ sessions, activeId, onSelect, onRename, onDelete, onNewSession, mobile, onClose }) {
  return (
    <div style={{
      width: 240, flexShrink: 0,
      borderRight: `1px solid ${C.border}`,
      background: 'rgba(0,22,36,0.85)',
      backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* header */}
      <div style={{
        padding: '14px 14px 10px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {mobile && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: `1px solid ${C.glassBorder}`,
                borderRadius: 6, width: 24, height: 24, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.textMuted, fontSize: 12,
              }}
            >✕</button>
          )}
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: C.textDim,
          }}>
            Conversas
          </span>
        </div>
        <button
          onClick={onNewSession}
          style={{
            background: C.accent, border: 'none', borderRadius: 6,
            width: 24, height: 24, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Nova conversa"
        >
          <IconPlus size={12} color={C.bgDeep} />
        </button>
      </div>

      {/* session list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
        {sessions.length === 0 ? (
          <div style={{ padding: '20px 10px', textAlign: 'center', color: C.textDim, fontSize: 12 }}>
            Nenhuma conversa ainda
          </div>
        ) : (
          sessions.map(session => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={session.id === activeId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Rename modal ─────────────────────────────────────────────────────────────

export function RenameModal({ value, onChange, onSubmit, onClose }) {
  const ref = useRef(null)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,10,20,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: C.bgDeep, border: `1px solid ${C.glassBorder}`,
        borderRadius: 14, padding: '24px 20px', width: '90%', maxWidth: 360,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>
          Renomear conversa
        </div>
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit() }}
          autoFocus
          style={{
            width: '100%', background: 'rgba(192,214,234,0.06)',
            border: `1px solid ${C.glassBorder}`, borderRadius: 8,
            color: C.text, fontSize: 13, padding: '9px 12px',
            outline: 'none', fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px', borderRadius: 8, border: `1px solid ${C.glassBorder}`,
              background: 'transparent', color: C.textMuted, fontSize: 12, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >Cancelar</button>
          <button
            onClick={onSubmit}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: C.accent, color: C.bgDeep, fontSize: 12,
              fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Salvar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete confirm dialog ─────────────────────────────────────────────────────

export function DeleteConfirmDialog({ session, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,10,20,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: C.bgDeep, border: `1px solid rgba(255,100,100,0.3)`,
        borderRadius: 14, padding: '24px 20px', width: '90%', maxWidth: 320,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#ff6b6b', marginBottom: 8 }}>
          Apagar conversa?
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 20 }}>
          "{session?.title}" será apagada permanentemente.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '7px 16px', borderRadius: 8, border: `1px solid ${C.glassBorder}`,
            background: 'transparent', color: C.textMuted, fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>Cancelar</button>
          <button onClick={onConfirm} style={{
            padding: '7px 16px', borderRadius: 8, border: 'none',
            background: '#ff6b6b', color: '#fff', fontSize: 12,
            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>Apagar</button>
        </div>
      </div>
    </div>
  )
}
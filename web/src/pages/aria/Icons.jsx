import { memo } from 'react'

// ─── Colors (exported for use by other modules) ───────────────────────────────
export const C = {
  bg: '#001a2b',
  bgDeep: '#002233',
  glass: 'rgba(192,214,234,0.07)',
  glassBorder: 'rgba(192,214,234,0.15)',
  border: 'rgba(192,214,234,0.1)',
  text: '#F6F2E8',
  textSoft: '#C0D6EA',
  textMuted: '#8ba8c4',
  textDim: '#5a7d9a',
  accent: '#DDFF55',
  accentGlow: 'rgba(221,255,85,0.15)',
  accentSoft: 'rgba(221,255,85,0.08)',
}

// ─── Icons ───────────────────────────────────────────────────────────────────

export const EX = memo(function EX({ color = C.accent, size = 14 }) {
  return (
    <span style={{ color, fontWeight: 800, fontStyle: 'italic' }}>
      <span style={{ fontSize: size * 0.85 }}>e</span>
      <span style={{ fontSize: size * 1.12, fontWeight: 900 }}>X</span>
    </span>
  )
})

export const AriaIcon = memo(function AriaIcon({ size = 20, color = C.accent }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1.5" strokeOpacity="0.4" />
      <path d="M10 22 Q16 10 22 22" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="16" r="3" fill={color} fillOpacity="0.9" />
      <circle cx="10" cy="22" r="1.5" fill={color} fillOpacity="0.6" />
      <circle cx="22" cy="22" r="1.5" fill={color} fillOpacity="0.6" />
    </svg>
  )
})

export const IconPlus = memo(function IconPlus({ size = 16, color = C.bgDeep }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
})

export const IconTrash = memo(function IconTrash({ size = 14, color = C.textDim }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 4h10M6 4V3h4v1M5 4l1 9h4l1-9" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
})

export const IconEdit = memo(function IconEdit({ size = 14, color = C.textDim }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M10.9 2.6a1.5 1.5 0 1 1 2.1 2.1L6 11.7l-2.8.7.7-2.8 7-7Z" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.8 3.7l2.5 2.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
})
// ─── API Configuration ─────────────────────────────────────────────────────────

export const DEFAULT_API = 'https://aria-backend-production-176b.up.railway.app/chat'

export function getApiUrl() {
  if (typeof window === 'undefined') return DEFAULT_API
  const qs = new URLSearchParams(window.location.search)
  return qs.get('api') || window.ARIA_API_URL || import.meta.env.VITE_ARIA_API || DEFAULT_API
}

// ─── Session Storage Keys ─────────────────────────────────────────────────────

export const SESSIONS_CACHE_KEY = 'aria_sessions_cache_v1'
export const ACTIVE_ID_CACHE_KEY = 'aria_active_id_cache_v1'

// ─── Chat Meta ────────────────────────────────────────────────────────────────

export const CHAT_META_ROLE = '__aria_meta__'
export const DEFAULT_CHAT_TITLE = 'Nova conversa'

/**
 * Extract visible (non-meta) messages from a messages array.
 */
export function getVisibleMessages(messages = []) {
  return (messages || []).filter(m => m?.role !== CHAT_META_ROLE)
}

/**
 * Find the chat meta message (stores title, etc).
 */
export function getStoredChatMeta(messages = []) {
  return (messages || []).find(m => m?.role === CHAT_META_ROLE && typeof m?.title === 'string') || null
}

/**
 * Update or insert chat meta into a messages array.
 * Returns new array WITHOUT the meta (just the visible messages).
 */
export function upsertChatMeta(messages = [], patch = {}) {
  const existingMeta = getStoredChatMeta(messages)
  const nextMeta = {
    role: CHAT_META_ROLE,
    ...(existingMeta || {}),
    ...patch,
  }
  if (!nextMeta.title?.trim()) return getVisibleMessages(messages)
  return [...getVisibleMessages(messages), nextMeta]
}

/**
 * Build a title from the first user message text.
 */
export function buildAutoTitle(text, fallback = DEFAULT_CHAT_TITLE) {
  const normalized = (text || '').trim()
  if (!normalized) return fallback
  return normalized.length > 36 ? normalized.slice(0, 36) + '…' : normalized
}

/**
 * Get session title from data (title field or meta or first message).
 */
export function getSessionTitleFromData({ title, messages, fallback = DEFAULT_CHAT_TITLE }) {
  const trimmedTitle = title?.trim()
  if (trimmedTitle) return trimmedTitle
  const metaTitle = getStoredChatMeta(messages)?.title?.trim()
  if (metaTitle) return metaTitle
  const firstUserMsg = getVisibleMessages(messages).find(m => m.role === 'user' && m.text)
  if (firstUserMsg?.text) return buildAutoTitle(firstUserMsg.text, fallback)
  return fallback
}

/**
 * Count visible messages in a session.
 */
export function getSessionMessageCount(messages = []) {
  return getVisibleMessages(messages).length
}

/**
 * Count visible user messages in a session.
 */
export function getSessionUserMessageCount(messages = []) {
  return getVisibleMessages(messages).filter(m => m.role === 'user').length
}

// ─── Suggestion Prompts ──────────────────────────────────────────────────────

export const SUGGESTIONS = [
  'O que é BI-RADS?',
  'Anatomia da mama',
  'Técnica radiológica do tórax',
  'Categorias do BI-RADS',
]
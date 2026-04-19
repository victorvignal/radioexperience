// ─── Session Cache Utilities ───────────────────────────────────────────────────

import { SESSIONS_CACHE_KEY, ACTIVE_ID_CACHE_KEY } from './constants'

/**
 * Save sessions to sessionStorage.
 */
export function saveSessionsToCache(sessions, activeId) {
  try {
    const serialized = JSON.stringify(sessions.map(s => ({
      ...s,
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    })))
    sessionStorage.setItem(SESSIONS_CACHE_KEY, serialized)
    if (activeId != null) sessionStorage.setItem(ACTIVE_ID_CACHE_KEY, String(activeId))
  } catch {}
}

/**
 * Load sessions from sessionStorage.
 */
export function loadSessionsFromCache() {
  try {
    const raw = sessionStorage.getItem(SESSIONS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return parsed.map(s => ({
      ...s,
      createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
    }))
  } catch { return null }
}

/**
 * Load active session ID from sessionStorage.
 */
export function loadActiveIdFromCache() {
  try {
    const raw = sessionStorage.getItem(ACTIVE_ID_CACHE_KEY)
    if (!raw) return null
    const num = Number(raw)
    return isNaN(num) ? raw : num
  } catch { return null }
}

/**
 * Clear all session cache.
 */
export function clearSessionsCache() {
  try {
    sessionStorage.removeItem(SESSIONS_CACHE_KEY)
    sessionStorage.removeItem(ACTIVE_ID_CACHE_KEY)
  } catch {}
}

// ─── Session Factory ──────────────────────────────────────────────────────────

import { DEFAULT_CHAT_TITLE } from './constants'

let _sessionCounter = 1

export function newSession(dbId = null, title = null, messages = []) {
  return {
    id: dbId ?? Date.now(),
    dbId,
    title: title ?? `${DEFAULT_CHAT_TITLE} ${_sessionCounter++}`,
    messages,
    createdAt: new Date(),
  }
}
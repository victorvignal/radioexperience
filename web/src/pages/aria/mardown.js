import { marked } from 'marked'

// Configure marked once
marked.setOptions({
  breaks: true,
  gfm: true,
})

/**
 * Render markdown text for ARIA chat bubbles.
 * Strips [Fonte: ...] references entirely.
 */
export function renderMarkdown(text) {
  if (!text) return ''
  // Strip [Fonte: ...] references entirely
  let cleaned = text.replace(/\[Fonte:[^\]]*\]/gi, '')
  // Collapse extra blank lines left behind
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
  return marked.parse(cleaned)
}

/**
 * Clean a source title extracted from RAG context.
 * Removes specialty prefixes, duplicate markers, underscores.
 */
export function cleanTitle(raw) {
  return raw
    .replace(/^(Mama|Neurorradiologia|Abdome|Torax|Pediatria|Geral|Ms|intervencao|Vascular|radioprotecao|Cabeca_Pescoco|Obstetricia|Urgencia)_Livro_/i, '')
    .replace(/^(Mama|Neurorradiologia|Abdome|Torax|Pediatria|Geral|Ms|intervencao|Vascular|radioprotecao|Cabeca_Pescoco|Obstetricia|Urgencia)_Artigo_/i, '')
    .replace(/_Semautor_SemAno.*$/i, '')
    .replace(/_DUP\d+$/i, '')
    .replace(/_Revisar/gi, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Format a source with page info for display.
 */
export function formatSource(s) {
  const title = cleanTitle(s.title || '')
  if (!title) return null
  const pg = s.page_start
    ? ` (p. ${s.page_start}${s.page_end && s.page_end !== s.page_start ? `-${s.page_end}` : ''})`
    : ''
  return { title: title + pg, score: s.score }
}
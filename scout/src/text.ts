const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
}

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match
  })
}

/** HTML (possibly entity-escaped, as in RSS descriptions) to collapsed plain text. */
export function htmlToText(input: string | null | undefined): string {
  if (!input) return ''
  const once = decodeEntities(input)
  const withoutTags = once
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // HN separates paragraphs with bare <p>, so opening tags count as breaks too.
    .replace(/<br\s*\/?>|<p(\s[^>]*)?>|<\/p>|<\/li>|<\/h\d>/gi, '\n')
    // Inline formatting disappears without a gap ("a <i>tool</i>?"); any other tag separates words.
    .replace(/<\/?(a|abbr|b|code|em|i|kbd|mark|q|s|small|span|strong|sub|sup|u)(\s[^>]*)?>/gi, '')
    .replace(/<[^>]+>/g, ' ')
  return decodeEntities(withoutTags)
    .replace(/[ \t\f\v\u00a0]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

export function truncate(input: string, max: number): string {
  if (input.length <= max) return input
  return `${input.slice(0, max - 1).trimEnd()}…`
}

const TRACKING_PARAMS = /^(utm_[a-z]+|ref|ref_src|fbclid|gclid|mc_cid|mc_eid|igshid|si)$/i

/**
 * Canonical form of a URL for de-duplication: https, lowercase host without "www.", no hash,
 * no tracking params, sorted query, no trailing slash. Returns the input unchanged if unparsable.
 */
export function canonicalUrl(input: string): string {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return input.trim()
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return input.trim()
  url.protocol = 'https:'
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  url.hash = ''
  const params = [...url.searchParams.entries()].filter(([key]) => !TRACKING_PARAMS.test(key))
  params.sort(([a], [b]) => a.localeCompare(b))
  url.search = new URLSearchParams(params).toString()
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1)
  const out = url.toString()
  return url.pathname === '/' && !url.search ? out.replace(/\/$/, '') : out
}

/** Parse anything date-like; falls back to `fallback` for missing or invalid input. */
export function toIso(value: string | number | null | undefined, fallback: Date): string {
  if (value === null || value === undefined || value === '') return fallback.toISOString()
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value)
  return Number.isNaN(date.getTime()) ? fallback.toISOString() : date.toISOString()
}

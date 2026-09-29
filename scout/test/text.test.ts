import { describe, expect, it } from 'vitest'
import { canonicalUrl, decodeEntities, htmlToText, toIso, truncate } from '../src/text.ts'

describe('htmlToText', () => {
  it('decodes entities, strips tags and keeps paragraph breaks', () => {
    expect(htmlToText('<p>I&#x27;m tired &amp; done.<p>Is there a <i>tool</i>?')).toBe("I'm tired & done.\nIs there a tool?")
  })

  it('handles entity-escaped HTML as found in RSS descriptions', () => {
    expect(htmlToText('&lt;p&gt;Hello &lt;b&gt;world&lt;/b&gt;&lt;/p&gt;')).toBe('Hello world')
  })

  it('drops script and style blocks', () => {
    expect(htmlToText('<style>p{}</style>ok<script>alert(1)</script>')).toBe('ok')
  })

  it('returns an empty string for null/undefined', () => {
    expect(htmlToText(null)).toBe('')
    expect(htmlToText(undefined)).toBe('')
  })
})

describe('decodeEntities', () => {
  it('leaves unknown or invalid entities alone', () => {
    expect(decodeEntities('&bogus; &#0; &#x1F600;')).toBe('&bogus; &#0; 😀')
  })
})

describe('canonicalUrl', () => {
  it.each([
    ['https://www.Example.com/a/?utm_source=x&b=2&a=1#frag', 'https://example.com/a?a=1&b=2'],
    ['http://example.com/', 'https://example.com'],
    ['https://example.com/path/', 'https://example.com/path'],
    ['https://example.com/?ref=hn', 'https://example.com'],
    ['https://example.com/?fbclid=1&q=keep', 'https://example.com/?q=keep'],
  ])('%s -> %s', (input, expected) => {
    expect(canonicalUrl(input)).toBe(expected)
  })

  it('returns unparsable or non-http input unchanged', () => {
    expect(canonicalUrl('not a url')).toBe('not a url')
    expect(canonicalUrl('mailto:a@b.c')).toBe('mailto:a@b.c')
  })
})

describe('truncate', () => {
  it('keeps short text and cuts long text with an ellipsis', () => {
    expect(truncate('short', 10)).toBe('short')
    expect(truncate('a long sentence here', 8)).toBe('a long…')
  })
})

describe('toIso', () => {
  const fallback = new Date('2026-01-01T00:00:00Z')
  it('accepts ISO strings, RFC 822 dates and epoch seconds', () => {
    expect(toIso('2026-09-29T08:15:00Z', fallback)).toBe('2026-09-29T08:15:00.000Z')
    expect(toIso('Tue, 29 Sep 2026 07:12:00 -0000', fallback)).toBe('2026-09-29T07:12:00.000Z')
    expect(toIso(1790640000, fallback)).toBe('2026-09-29T00:00:00.000Z')
  })

  it('falls back for missing or invalid values', () => {
    expect(toIso(null, fallback)).toBe(fallback.toISOString())
    expect(toIso('yesterday-ish', fallback)).toBe(fallback.toISOString())
  })
})

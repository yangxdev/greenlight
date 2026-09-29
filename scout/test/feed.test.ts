import { describe, expect, it } from 'vitest'
import { parseFeed } from '../src/feed.ts'
import { fixture } from './helpers.ts'

describe('parseFeed', () => {
  it('parses RSS 2.0 with CDATA, guid attributes and slash:comments', () => {
    const [first, second] = parseFeed(fixture('rss-lobsters.xml'))
    expect(first).toEqual({
      id: 'https://lobste.rs/s/abc123',
      title: 'How do you manage dotfiles across work &amp; personal machines?',
      link: 'https://lobste.rs/s/abc123/how_do_you_manage_dotfiles',
      body: '<p>I keep a git repo but <b>syncing secrets</b> is a pain in the neck.</p>',
      published: 'Tue, 29 Sep 2026 07:12:00 -0000',
      comments: 14,
      commentsUrl: 'https://lobste.rs/s/abc123/how_do_you_manage_dotfiles',
    })
    expect(second?.comments).toBe(0)
  })

  it('parses Atom and picks the alternate link', () => {
    const [entry] = parseFeed(fixture('producthunt-feed.xml'))
    expect(entry?.id).toBe('tag:www.producthunt.com,2005:Post/700001')
    expect(entry?.link).toBe('https://www.producthunt.com/products/shiftswap')
    expect(entry?.published).toBe('2026-09-29T00:01:00-07:00')
    expect(entry?.body).toContain('Let hourly staff swap shifts')
  })

  it('parses RSS 1.0 (RDF) and single-item feeds', () => {
    const items = parseFeed(`<?xml version="1.0"?>
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <item rdf:about="https://example.com/1"><title>One</title><link>https://example.com/1</link><dc:date>2026-09-29T01:00:00Z</dc:date></item>
      </rdf:RDF>`)
    expect(items).toEqual([
      {
        id: 'https://example.com/1',
        title: 'One',
        link: 'https://example.com/1',
        body: '',
        published: '2026-09-29T01:00:00Z',
        comments: 0,
        commentsUrl: null,
      },
    ])
  })

  it('does not expand DOCTYPE entities', () => {
    const items = parseFeed(`<?xml version="1.0"?>
      <!DOCTYPE rss [<!ENTITY boom "BOOMBOOMBOOMBOOM">]>
      <rss version="2.0"><channel><item><title>&boom;</title><link>https://example.com</link></item></channel></rss>`)
    expect(items[0]?.title).toBe('&boom;')
  })

  it('rejects documents that are not feeds', () => {
    expect(() => parseFeed('<html><body>Just a moment...</body></html>')).toThrow('not an RSS or Atom document')
  })
})

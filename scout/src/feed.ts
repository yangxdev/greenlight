import { XMLParser } from 'fast-xml-parser'

export interface FeedItem {
  id: string
  title: string
  link: string
  /** Raw HTML/text body (description, content or summary). */
  body: string
  published: string | null
  comments: number
  commentsUrl: string | null
}

type Node = unknown

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Entities are decoded later by htmlToText. Leaving them alone here avoids entity-expansion tricks in hostile feeds.
  processEntities: false,
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => ['item', 'entry', 'link'].includes(name),
})

function text(node: Node): string {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (typeof node === 'object' && '#text' in node) return text((node as Record<string, Node>)['#text'])
  return ''
}

function record(node: Node): Record<string, Node> {
  return typeof node === 'object' && node !== null ? (node as Record<string, Node>) : {}
}

function list(node: Node): Node[] {
  return Array.isArray(node) ? node : node === undefined ? [] : [node]
}

function atomLink(links: Node): string {
  const candidates = list(links).map(record)
  const alternate = candidates.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? candidates[0]
  return alternate ? text(alternate['@_href']) : ''
}

/** Parse RSS 2.0, RSS 1.0 (RDF) or Atom into flat items. Throws if the document is neither. */
export function parseFeed(xml: string): FeedItem[] {
  const doc = record(parser.parse(xml))

  if (doc.rss !== undefined || doc['rdf:RDF'] !== undefined) {
    const items = doc.rss !== undefined ? list(record(record(doc.rss).channel).item) : list(record(doc['rdf:RDF']).item)
    return items.map((raw) => {
      const item = record(raw)
      const link = text(list(item.link)[0])
      return {
        id: text(item.guid) || link || text(item.title),
        title: text(item.title),
        link,
        body: text(item['content:encoded']) || text(item.description),
        published: text(item.pubDate) || text(item['dc:date']) || null,
        comments: Number.parseInt(text(item['slash:comments']), 10) || 0,
        commentsUrl: text(item.comments) || null,
      }
    })
  }

  if (doc.feed !== undefined) {
    return list(record(doc.feed).entry).map((raw) => {
      const entry = record(raw)
      const link = atomLink(entry.link)
      return {
        id: text(entry.id) || link,
        title: text(entry.title),
        link,
        body: text(entry.content) || text(entry.summary),
        published: text(entry.published) || text(entry.updated) || null,
        comments: 0,
        commentsUrl: null,
      }
    })
  }

  throw new Error('not an RSS or Atom document')
}

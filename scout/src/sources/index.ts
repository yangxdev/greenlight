import type { Source, SourceName } from '../types.ts'
import { github } from './github.ts'
import { hn } from './hn.ts'
import { producthunt } from './producthunt.ts'
import { reddit } from './reddit.ts'
import { rss } from './rss.ts'

export const SOURCES: Record<SourceName, Source> = { hn, reddit, github, producthunt, rss }

import type { Source, SourceName } from '../types.ts'
import { discourse } from './discourse.ts'
import { github } from './github.ts'
import { bluesky } from './bluesky.ts'
import { hn } from './hn.ts'
import { issues } from './issues.ts'
import { lemmy } from './lemmy.ts'
import { producthunt } from './producthunt.ts'
import { reddit } from './reddit.ts'
import { rss } from './rss.ts'
import { stackexchange } from './stackexchange.ts'

export const SOURCES: Record<SourceName, Source> = { hn, reddit, github, issues, producthunt, stackexchange, discourse, lemmy, bluesky, rss }

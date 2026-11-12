# Watchlist

Ideas that scored just below the filing threshold: real enough to keep, too thin to file. The Analyst checks each week's signals against
them, so evidence adds up across weeks instead of being forgotten. The Critic keeps this file (rules in
`.claude/agents/critic.md`); delete an entry by hand to stop watching it.

Evidence listed here was verified against that week's signals by the Critic, so later Critics accept it without the
signal being in the current export.

## skill-shelf

- **Best score:** 13/20 on 2026-09-30 (pain 3, competition 3, MVP 4, reach 3), size S. Re-scored 11/20 on 2026-11-12 (pain 2, competition 2, build 4, reach 3)
- **Last new evidence:** 2026-11-12
- **Problem:** People who use coding agents pile up skill files (SKILL.md and similar) and have no good way to keep
  them organised or know whether they work.
- **Needs:** a third independent thread, or replies showing others share the "does my skill work" pain; the September
  thread is now too old to count as recent. A check of existing SKILL.md validators (Skillbox only overlaps on
  organising and syncing).
- **Verified evidence:**
  - https://news.ycombinator.com/item?id=50426070 (hn ask_hn, 2026-11-09, 23 / 6): "Do you systematically evaluate agent skills, either before or while using them?"
  - https://news.ycombinator.com/item?id=49589914 (hn ask_hn, 2026-09-06, 320 points / 299 comments): "How do you
    find skills, keep them organised, and make sure they actually work?" (older than 60 days on 2026-11-12)
  - https://news.ycombinator.com/item?id=49743049 (hn, 2026-09-17, 68 / 62): "you cannot simply switch between
    agents without starting over" (adjacent)
  - https://news.ycombinator.com/item?id=49740105 (hn show_hn, 2026-09-17, 251 / 140): "Which agents did they use?
    What skills and tools had stuck or been thrown out the window?" (adjacent)

## diff-triage

- **Best score:** 13/20 on 2026-10-05 (pain 3, competition 2, MVP 4, reach 4)
- **Last new evidence:** 2026-10-05
- **Problem:** Reviewers get AI-generated pull requests far larger than they can read and no longer understand what
  changed.
- **Needs:** someone asking for a way to triage or order a large diff, or saying existing review tools fail at it;
  a check of established tools (GitHub PR view, AI review bots, diff viewers). The competition file only covers
  recent launches, and its one match is Reviu, a full review workspace.
- **Verified evidence:**
  - https://lobste.rs/s/7tpc5q/surviving_code_reviews_era_ai (rss, Lobsters Ask, 2026-09-04): "every PR that comes
    my way for review is on average ~6k lines of diff"
  - https://news.ycombinator.com/item?id=49622554 (hn ask_hn, 2026-09-09, 62 / 53): "I have no clue how the new code
    works or what it changes or breaks"
  - https://news.ycombinator.com/item?id=49934037 (hn ask_hn, 2026-10-02, 25 / 32): "It takes 5x longer to review
    Claude merge requests and I barely understand what I approve."
  - https://news.ycombinator.com/item?id=49921591 (hn ask_hn, 2026-10-01, 18 / 15): "I've turned into a full time
    reviewer instead." (adjacent)

## fstab-reader

- **Best score:** 12/20 on 2026-11-09 (pain 2, competition 3, build 4, reach 3), size S
- **Last new evidence:** 2026-11-09
- **Problem:** Newer Ubuntu users and people who inherit machines can't read their own `/etc/fstab` or partition
  layout, so they don't know whether it is right until a disk fills up or the system won't boot.
- **Needs:** more people asking what their fstab or mount layout means, in a second place (r/linuxquestions,
  r/linux4noobs, Unix & Linux SE), ideally with answers or upvotes. A check of existing fstab explainers, validators
  and generators, and whether the communities allow link posts.
- **Verified evidence:**
  - https://askubuntu.com/questions/1570823/trying-to-understand-the-coding-of-these-three-fstabs (stackexchange
    askubuntu, 2026-11-09, 0 / 0 answers): "I have three machines running Ubuntu on my desk (while I tinker with
    them)."
  - https://askubuntu.com/questions/1570809/does-my-ubuntu-system-bog-down-because-i-have-inadvertently-parked-my-home-unde
    (stackexchange askubuntu, 2026-11-07, 0 / 0): "I have never really understood partitioning and mount points."

## agent-context-pack

- **Best score:** 11/20 on 2026-11-12 (pain 2, competition 2, build 4, reach 3), size M
- **Last new evidence:** 2026-11-12
- **Problem:** People running coding agents across several clients or projects keep re-explaining the same context and
  rules, because each tool keeps its own memory.
- **Needs:** a second independent thread, or replies where people describe this pain in their own words. A check of
  Make0 Brain OSS, Agent Clan and axel.md for setup cost and per-client separation.
- **Verified evidence:**
  - https://news.ycombinator.com/item?id=50403153 (hn ask_hn, 2026-11-07, 98 / 60): "The major time cost for me is to re-explaining context and past decisions, client rules, that we already do."
  - https://news.ycombinator.com/item?id=50444380 (hn ask_hn, 2026-11-10, 36 / 36): "no central notion of behaviour definitions, which causes every bug-fixing session to feel like a game of whack-a-mole" (adjacent)

## patch-check

- **Best score:** 11/20 on 2026-10-26 (pain 2, competition 3, build 3, reach 3), size M
- **Last new evidence:** 2026-10-26
- **Problem:** Self-hosters and people who inherit servers can't tell from their package or container output whether
  a named CVE is fixed on their system, because versions, backports and distro suffixes don't match the advisory.
- **Needs:** more independent people asking "am I affected / is this fixed" for a specific package, outside the
  one PHP/Brotli news wave and ideally unprompted by a headline CVE. A check of OSV.dev's web UI, Debian and Ubuntu
  trackers and Trivy for a paste-and-answer flow, and whether OSV covers Ubuntu/Debian versions accurately. Whether
  r/selfhosted and the forums allow link posts.
- **Verified evidence:**
  - https://askubuntu.com/questions/1570502/ubuntu-20-04-php-upgrading-assistance (stackexchange askubuntu,
    2026-10-21, score 1 / 0 answers): "Inherited a bunch of Ubuntu 20.04 legacy servers… Anyone got a good
    step-by-step on how to patch in this case?"
  - https://community.bitwarden.com/t/vulnerable-nginx-version-in-bitwarden-self-hosted/103157 (discourse
    bitwarden, 2026-10-23, 0 / 3): "I checked the NGINX version running in my Bitwarden container and found the
    following: nginx version: nginx/1.31.6"
  - https://help.nextcloud.com/t/is-nextcloud-33-0-10-docker-affected-by-cve-2026-111497-brotli/251517 (discourse
    nextcloud, 2026-10-25, 0 / 2): "I would like to confirm whether the official Nextcloud Docker image is affected
    by CVE-2026-111497 related to Google Brotli."
  - https://github.com/mailcow/mailcow-dockerized/issues/7533 (issues, 2026-10-21, 53 / 70): "a timely patch for
    this vulnerability is required to safely operate it further." (adjacent)

## cold-catalog

- **Best score:** 11/20 on 2026-11-02 (pain 2, competition 2, build 4, reach 3), size M
- **Last new evidence:** 2026-11-02
- **Problem:** People who keep media and backups on offline or external drives can't see what a drive holds without
  plugging it in. A browser tool could snapshot each drive's file list and search across all of them.
- **Needs:** more people asking for this in their own words in a second place (r/DataHoarder, r/selfhosted), ideally
  saying existing catalogers failed them. A check of free disk catalogers (Cathy, gWhere, DiskCatalogMaker,
  WinCatalog) for price, platform and upkeep. Whether the communities allow link posts.
- **Verified evidence:**
  - https://feddit.org/post/37319624 (lemmy selfhosted@lemmy.world, 2026-10-28, 36 points / 18 comments): "are there
    any tools out there that allow me to browse which files are in cold storage, without the actual drives being
    attached / mounted?"
  - https://forums.plex.tv/t/need-help-finding-my-list-of-movies/945300 (discourse plex, 2026-10-29, 0 / 2): "The hard
    drive that contained the movies crashed, but I have the metadata stored on a different drive." (adjacent)

## frame-step

- **Best score:** 11/20 on 2026-11-09 (pain 2, competition 2, build 4, reach 3), size S
- **Last new evidence:** 2026-11-09
- **Problem:** Animators gathering motion reference lack a light tool to step through a clip one frame at a time;
  ordinary media players handle that part badly.
- **Needs:** a second and third person asking for frame-by-frame reference scrubbing in their own words (r/animation,
  animator forums), ideally saying VLC or mpv failed them. A check of free browser frame steppers and of what the
  replies to the Bluesky post recommended. Whether the communities allow link posts.
- **Verified evidence:**
  - https://bsky.app/profile/did:plc:iqkryxces53twi3vnge6eqw3/post/3mzirk6w3jk2g (bluesky search, 2026-11-04, 19
    likes / 5 replies): "I find most media players aren't great for that second part"

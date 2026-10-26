# Watchlist

Ideas that scored 11–13/20: real enough to keep, too thin to file. The Analyst checks each week's signals against
them, so evidence adds up across weeks instead of being forgotten. The Critic keeps this file (rules in
`.claude/agents/critic.md`); delete an entry by hand to stop watching it.

Evidence listed here was verified against that week's signals by the Critic, so later Critics accept it without the
signal being in the current export.

## skill-shelf

- **Best score:** 13/20 on 2026-09-30 (pain 3, competition 3, MVP 4, reach 3)
- **Last new evidence:** 2026-09-30
- **Problem:** People who use coding agents pile up skill files (SKILL.md and similar) and have no good way to keep
  them organised or know whether they work.
- **Needs:** more people asking the question itself, in their own words, in a second place; the other threads were
  adjacent (moving sessions between agents, sharing setups). A check of existing SKILL.md validators and lists.
- **Verified evidence:**
  - https://news.ycombinator.com/item?id=49589914 (hn ask_hn, 2026-09-06, 320 points / 299 comments): "How do you
    find skills, keep them organised, and make sure they actually work?"
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

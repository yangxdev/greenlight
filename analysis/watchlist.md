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

## agent-spend-cap

- **Best score:** 13/20 on 2026-10-02 (pain 3, competition 3, MVP 4, reach 3); also scored 13 on 2026-09-30 as
  agent-guardrails
- **Last new evidence:** 2026-10-02
- **Problem:** People who run coding agents unattended get runaway fan-out and surprise bills, and have no simple way
  to size a worst case or cap a run before they start.
- **Needs:** a second independent thread (not replies to the $78k one) describing runaway agent cost or actions; a
  check of vendor spend limits and existing cost calculators.
- **Verified evidence:**
  - https://news.ycombinator.com/item?id=49861047 (hn ask_hn, 2026-09-26, 82 / 36): "launch 826 parallel agents /
    threads without any authorization on my side ... consuming a total of roughly USD 78,000"
  - https://news.ycombinator.com/item?id=49875938 (hn ask_hn_comment, 2026-09-28, reply to the thread above): "437
    claude code subagents running adversarial reviews on a tiny thing (in yolo mode). Nothing to stop it"
  - https://news.ycombinator.com/item?id=49798257 (hn ask_hn, 2026-09-22, 50 / 98): "Found a saved signature PNG on
    my computer, placed it at the right spot within the contract and prepared to send it" (actions, not cost)
  - https://news.ycombinator.com/item?id=49919026 (hn ask_hn, 2026-10-01, 11 / 5): "your included usage in ChatGPT
    Work and Codex will decrease from 20 times to 10 times" (adjacent)

## diff-triage

- **Best score:** 13/20 on 2026-10-01 (pain 3, competition 2, MVP 4, reach 4)
- **Last new evidence:** 2026-10-01
- **Problem:** Reviewers get AI-generated pull requests far larger than they can read and no longer understand what
  changed.
- **Needs:** someone asking for a way to triage or order a large diff, or saying the existing review tools fail at
  it; competition is the weak point (PR views and AI review bots).
- **Verified evidence:**
  - https://lobste.rs/s/7tpc5q/surviving_code_reviews_era_ai (rss, Lobsters Ask, 2026-09-04): "every PR that comes
    my way for review is on average ~6k lines of diff"
  - https://news.ycombinator.com/item?id=49622554 (hn ask_hn, 2026-09-09, 62 / 53): "I have no clue how the new code
    works or what it changes or breaks"

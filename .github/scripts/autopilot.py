#!/usr/bin/env python3
"""Autopilot: moves ideas through the two human gates by itself, after a veto window, and sends phone notifications
through ntfy. Runs from .github/workflows/autopilot.yml. No AI.

Each run does three things:

1. Notifies about the state labels added since the previous successful run: a new `idea`, a `blueprint-ready`
   blueprint, `building`, `live`, `stuck`, a `shipped` change. The window is (previous run's start, this run's start],
   so a run that fails is covered by the next one.
2. Advances at most one issue. A `blueprint-ready` blueprint gets `blueprint-ok` once its veto window has passed and
   nothing else is building. Otherwise the oldest `idea` gets `approved` once its window has passed, nothing else is in
   flight and fewer than AUTOPILOT_MAX_APPROVALS ideas were approved in the last 30 days. Labels go on with
   GREENLIGHT_TOKEN, so the Architect and Factory dispatch see the owner as the actor, as they require.
3. After an Ideas or Observer run, sends the weekly summary.

Never advanced: an issue labelled `hold`, a change (`[change]`), an issue opened by anyone but the owner or the
workflow bot (the Idea form is public and labels its issues `idea`), and a blueprint whose review failed. Without an
NTFY_TOPIC nothing runs at all: the owner wanted no build they weren't told about.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

# Highest first, as in board-sync.yml: an issue's state is the first of these it carries.
STATES = ["archived", "stuck", "live", "building", "blueprint-ok", "blueprint-ready", "approved", "idea"]
IN_FLIGHT = {"approved", "blueprint-ready", "blueprint-ok", "building"}
NOTIFY_LABELS = ["idea", "blueprint-ready", "building", "live", "stuck", "shipped"]
BOT = "github-actions[bot]"
HOLD = "hold"


@dataclass
class Config:
    repo: str
    owner: str
    mode: str = "on"  # on: notify and advance; notify: notify only
    idea_hours: float = 48
    blueprint_hours: float = 24
    needs_owner_hours: float = 72
    max_approvals: int = 2  # per 30 days

    @property
    def advancing(self) -> bool:
        return self.mode == "on"


@dataclass
class Issue:
    number: int
    title: str
    labels: set[str]
    author: str
    body: str
    url: str
    events: list[dict] = field(default_factory=list)  # GitHub issue events: event, label.name, created_at
    comments: list[dict] = field(default_factory=list)  # user.login, author_association, body, created_at


@dataclass
class Notice:
    title: str
    message: str
    click: str
    priority: int = 3
    tags: list[str] = field(default_factory=list)


@dataclass
class Plan:
    notices: list[Notice] = field(default_factory=list)
    comments: list[tuple[int, str]] = field(default_factory=list)
    labels: list[tuple[int, str]] = field(default_factory=list)  # added with GREENLIGHT_TOKEN
    log: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------------------------------- reading issues


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def fmt(when: datetime) -> str:
    return when.astimezone(timezone.utc).strftime("%a %d %b, %H:%M UTC")


def state(issue: Issue) -> str | None:
    return next((s for s in STATES if s in issue.labels), None)


def is_change(issue: Issue) -> bool:
    return issue.title.lower().startswith("[change]") or "change" in issue.labels


def trusted(issue: Issue, cfg: Config) -> bool:
    return issue.author in (cfg.owner, BOT)


def name(issue: Issue) -> str:
    return re.sub(r"^\[(idea|change)\]\s*", "", issue.title, flags=re.I).strip()


def defuse(text: str) -> str:
    """Internet-sourced names must not ping strangers when they go into a comment."""
    return text.replace("@", "@​")


def labeled_at(issue: Issue, label: str) -> datetime | None:
    times = [
        parse_time(e["created_at"])
        for e in issue.events
        if e.get("event") == "labeled" and (e.get("label") or {}).get("name") == label
    ]
    return max(times) if times else None


def score(issue: Issue) -> str | None:
    m = re.search(r"Score \*\*(\d+)/20\*\*", issue.body or "")
    return m.group(1) if m else None


def section(body: str, heading: str, limit: int = 220) -> str:
    m = re.search(rf"^###\s+{re.escape(heading)}\s*$(.*?)(?=^###\s|^---\s*$|\Z)", body or "", flags=re.M | re.S)
    if not m:
        return ""
    text = re.sub(r"<!--.*?-->", "", m.group(1), flags=re.S)
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def by_pipeline(comment: dict) -> bool:
    """Only the workflow bot or the owner's token write pipeline comments; anyone can comment on a public issue."""
    return (comment.get("user") or {}).get("login") == BOT or comment.get("author_association") == "OWNER"


def architect_comment(issue: Issue, since: datetime | None) -> str:
    """The Architect's hand-off comment for the current blueprint. It is posted just before the label."""
    floor = since - timedelta(minutes=30) if since else None
    for c in reversed(issue.comments):
        if not by_pipeline(c) or "📐 **Architect:**" not in (c.get("body") or ""):
            continue
        if floor and parse_time(c["created_at"]) < floor:
            break
        return c["body"]
    return ""


def verdict(comment: str) -> str:
    if "**Reviewer:** ready for your decision" in comment:
        return "ready"
    if "**Reviewer:** needs your input" in comment:
        return "needs-owner"
    return "unreviewed"


def concerns(comment: str, limit: int = 3) -> list[str]:
    m = re.search(r"\*\*For you to decide:\*\*\n((?:- .*\n?)+)", comment)
    if not m:
        return []
    items = [line[2:].strip() for line in m.group(1).splitlines() if line.startswith("- ")]
    return [i if len(i) <= 160 else i[:159].rstrip() + "…" for i in items[:limit]]


def live_url(issue: Issue) -> str:
    for c in reversed(issue.comments):
        if by_pipeline(c):
            m = re.search(r"greenlight:url=(https://\S+?)\s*-->", c.get("body") or "")
            if m:
                return m.group(1)
    return ""


def last_report(issue: Issue) -> str:
    """First line of the newest pipeline comment, for a stuck issue."""
    for c in reversed(issue.comments):
        if by_pipeline(c) and c.get("body"):
            line = c["body"].strip().splitlines()[0]
            return re.sub(r"[*`]", "", line)[:200]
    return ""


# -------------------------------------------------------------------------------------------------------- planning


def eligible(issue: Issue, cfg: Config) -> bool:
    return cfg.advancing and trusted(issue, cfg) and not is_change(issue) and HOLD not in issue.labels


def idea_due(issue: Issue, cfg: Config) -> datetime | None:
    at = labeled_at(issue, "idea")
    return at + timedelta(hours=cfg.idea_hours) if at else None


def blueprint_due(issue: Issue, cfg: Config) -> tuple[datetime | None, str, str]:
    at = labeled_at(issue, "blueprint-ready")
    comment = architect_comment(issue, at)
    v = verdict(comment)
    if at is None or v == "unreviewed":
        return None, v, comment
    hours = cfg.blueprint_hours if v == "ready" else cfg.needs_owner_hours
    return at + timedelta(hours=hours), v, comment


def notice_for(issue: Issue, label: str, cfg: Config, plan: Plan) -> None:
    n = name(issue)
    if label == "idea":
        s = score(issue)
        problem = section(issue.body, "Problem")
        due = idea_due(issue, cfg)
        if eligible(issue, cfg) and due:
            action = f"Autopilot approves it {fmt(due)} unless you add `hold` or close the issue."
            plan.comments.append((issue.number, (
                f"🤖 **Autopilot:** approves this idea on {fmt(due)} unless you add `{HOLD}` or close the issue. "
                "Builds run one at a time, so it may wait for a free slot."
            )))
        else:
            action = "Add `approved` to build it."
        title = f"New idea: {n}" + (f" ({s}/20)" if s else "")
        plan.notices.append(Notice(title, f"{problem}\n\n{action}".strip(), issue.url, 3, ["bulb"]))
    elif label == "blueprint-ready":
        due, v, comment = blueprint_due(issue, cfg)
        lines = {"ready": "Reviewer: ready.", "needs-owner": "Reviewer wants your input:",
                 "unreviewed": "The review failed, so this is an unreviewed draft."}[v]
        for c in concerns(comment):
            lines += f"\n- {c}"
        if eligible(issue, cfg) and due:
            action = f"Autopilot starts the build {fmt(due)} unless you add `hold`."
            plan.comments.append((issue.number, (
                f"🤖 **Autopilot:** starts the build on {fmt(due)} unless you add `{HOLD}`. "
                "You can still edit the blueprint before then."
            )))
        elif eligible(issue, cfg):
            action = "Autopilot won't build an unreviewed draft: add `blueprint-ok` yourself, or re-apply `approved`."
        else:
            action = "Add `blueprint-ok` to build it."
        plan.notices.append(Notice(f"Blueprint ready: {n}", f"{lines}\n\n{action}", issue.url,
                                   4 if v != "ready" else 3, ["memo"]))
    elif label == "building":
        plan.notices.append(Notice(f"Building: {n}", "The Factory started. It usually takes 10–20 minutes.",
                                   issue.url, 2, ["hammer"]))
    elif label == "live":
        url = live_url(issue)
        plan.notices.append(Notice(f"Live: {n}", url or "Deployed and smoke-tested.", url or issue.url, 3, ["rocket"]))
    elif label == "shipped":
        plan.notices.append(Notice(f"Change shipped: {n}", "Built, merged and deployed.", issue.url, 2,
                                   ["white_check_mark"]))
    elif label == "stuck":
        plan.notices.append(Notice(f"Stuck: {n}", last_report(issue) or "The automation gave up.", issue.url, 4,
                                   ["warning"]))


def plan_run(issues: list[Issue], now: datetime, window: tuple[datetime, datetime], cfg: Config,
             approvals_30d: int) -> Plan:
    plan = Plan()
    start, end = window

    # 1. Notices for the state labels added in the window that the issue still carries.
    for issue in sorted(issues, key=lambda i: i.number):
        for label in NOTIFY_LABELS:
            at = labeled_at(issue, label)
            if label in issue.labels and at and start < at <= end:
                notice_for(issue, label, cfg, plan)

    if not cfg.advancing:
        return plan

    # 2. Advance at most one issue, finishing a build before starting a new idea.
    building = [i.number for i in issues if "building" in i.labels]
    for issue in sorted(issues, key=lambda i: i.number):
        if state(issue) != "blueprint-ready" or not eligible(issue, cfg):
            continue
        due, v, _ = blueprint_due(issue, cfg)
        if not due or due > now:
            continue
        if building:
            plan.log.append(f"#{issue.number}: blueprint due, waiting for #{building[0]} to finish building")
            return plan
        plan.labels.append((issue.number, "blueprint-ok"))
        plan.log.append(f"#{issue.number}: blueprint-ok (review: {v})")
        return plan

    in_flight = [i.number for i in issues if state(i) in IN_FLIGHT]
    for issue in sorted(issues, key=lambda i: i.number):
        if state(issue) != "idea" or not eligible(issue, cfg):
            continue
        due = idea_due(issue, cfg)
        if not due or due > now:
            continue
        if in_flight:
            plan.log.append(f"#{issue.number}: idea due, waiting for #{in_flight[0]} to finish")
            return plan
        if approvals_30d >= cfg.max_approvals:
            plan.log.append(f"#{issue.number}: idea due, but {approvals_30d} ideas were approved in the last 30 days "
                            f"(AUTOPILOT_MAX_APPROVALS={cfg.max_approvals})")
            return plan
        plan.labels.append((issue.number, "approved"))
        plan.notices.append(Notice(f"Approved: {name(issue)}", "Nobody vetoed it, so the Architect is writing its "
                                   "blueprint now.", issue.url, 2, ["robot"]))
        plan.log.append(f"#{issue.number}: approved")
        return plan
    return plan


def count_approvals(repo_events: list[dict], now: datetime) -> int:
    """`approved` labels added to ideas (not changes) in the last 30 days, by anyone."""
    cutoff = now - timedelta(days=30)
    count = 0
    for e in repo_events:
        if e.get("event") != "labeled" or (e.get("label") or {}).get("name") != "approved":
            continue
        if parse_time(e["created_at"]) <= cutoff:
            continue
        issue = e.get("issue") or {}
        labels = {lab.get("name") for lab in issue.get("labels") or []}
        if (issue.get("title") or "").lower().startswith("[change]") or "change" in labels:
            continue
        count += 1
    return count


# ---------------------------------------------------------------------------------------------------- weekly notes


def first_paragraph(markdown: str, limit: int = 400) -> str:
    """The first prose paragraph: no headings, tables or HTML comments."""
    text = re.sub(r"<!--.*?-->", "", markdown, flags=re.S)
    for para in re.split(r"\n\s*\n", text):
        para = para.strip()
        if not para or para.startswith(("#", "|", "-", "*", ">", "```")):
            continue
        para = " ".join(para.split())
        return para if len(para) <= limit else para[: limit - 1].rstrip() + "…"
    return ""


def report_week(day: datetime) -> str:
    """The week a report run on `day` covers: the last complete ISO week (as in observer.yml)."""
    monday_before = day.date() - timedelta(days=day.isoweekday() + 6)
    year, week, _ = monday_before.isocalendar()
    return f"{year}-W{week:02d}"


def ideas_notice(critic_md: str | None, filed: int, conclusion: str, run_url: str, file_url: str) -> Notice | None:
    if conclusion == "failure":
        return Notice("Ideas run failed", "The weekly Analyst or Critic failed.", run_url, 4, ["warning"])
    if conclusion != "success" or critic_md is None:
        return None
    summary = first_paragraph(critic_md) or "No summary."
    title = "Weekly ideas: " + (f"{filed} filed" if filed else "nothing filed")
    return Notice(title, summary, file_url, 2, ["mag"])


def report_notice(report: dict | None, conclusion: str, run_url: str, file_url: str) -> Notice | None:
    if conclusion == "failure":
        return Notice("Weekly report failed", "The Observer run failed.", run_url, 4, ["warning"])
    if conclusion != "success" or not report:
        return None
    summary = report.get("summary") or ""
    summary = summary if len(summary) <= 400 else summary[:399].rstrip() + "…"
    verdicts = ", ".join(f"#{p.get('issue')} {p.get('verdict')}" for p in report.get("products") or [])
    message = summary + (f"\n\nVerdicts: {verdicts}" if verdicts else "")
    return Notice(f"Weekly report {report.get('week', '')}".strip(), message, file_url, 2, ["bar_chart"])


# -------------------------------------------------------------------------------------------------------------- I/O


class GitHub:
    def __init__(self, token: str, api: str = "https://api.github.com"):
        self.token, self.api = token, api

    def request(self, method: str, path: str, body: dict | None = None) -> tuple[object, dict]:
        url = path if path.startswith("http") else self.api + path
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method, headers={
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "greenlight-autopilot",
        })
        with urllib.request.urlopen(req, timeout=30) as res:
            raw = res.read()
            return (json.loads(raw) if raw else None), dict(res.headers)

    def get(self, path: str):
        return self.request("GET", path)[0]

    def paginate(self, path: str, max_pages: int = 10) -> list:
        items: list = []
        url: str | None = path + ("&" if "?" in path else "?") + "per_page=100"
        for _ in range(max_pages):
            if not url:
                break
            page, headers = self.request("GET", url)
            items.extend(page if isinstance(page, list) else [])
            m = re.search(r'<([^>]+)>;\s*rel="next"', headers.get("Link", "") or headers.get("link", ""))
            url = m.group(1) if m else None
        return items


def send(server: str, topic: str, token: str, notice: Notice) -> None:
    payload = {"topic": topic, "title": notice.title, "message": notice.message, "priority": notice.priority,
               "tags": notice.tags, "click": notice.click, "markdown": True}
    headers = {"Content-Type": "application/json", "User-Agent": "greenlight-autopilot"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(server.rstrip("/") + "/", data=json.dumps(payload).encode(), headers=headers,
                                 method="POST")
    with urllib.request.urlopen(req, timeout=30):
        pass


def env_float(name: str, default: float) -> float:
    value = os.environ.get(name, "").strip()
    return float(value) if value else default


def run_window(gh: GitHub, repo: str, run_id: str, now: datetime) -> tuple[datetime, datetime]:
    """(previous successful run's start, this run's start]."""
    end = now
    if run_id:
        end = parse_time(gh.get(f"/repos/{repo}/actions/runs/{run_id}")["run_started_at"])
    runs = gh.get(f"/repos/{repo}/actions/workflows/autopilot.yml/runs?status=success&per_page=20") or {}
    starts = [parse_time(r["run_started_at"]) for r in runs.get("workflow_runs", [])
              if str(r.get("id")) != str(run_id) and r.get("run_started_at")]
    starts = [s for s in starts if s < end]
    return (max(starts) if starts else end - timedelta(hours=2)), end


def contents(gh: GitHub, repo: str, path: str) -> str | None:
    try:
        import base64
        data = gh.get(f"/repos/{repo}/contents/{path}")
        return base64.b64decode(data["content"]).decode()
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise


def committed_since(gh: GitHub, repo: str, path: str, since: str) -> bool:
    """Whether `path` was committed after the workflow run started, so a run that skipped itself sends nothing."""
    if not since:
        return True
    commits = gh.get(f"/repos/{repo}/commits?path={path}&per_page=1") or []
    if not commits:
        return False
    return parse_time(commits[0]["commit"]["committer"]["date"]) >= parse_time(since)


def main() -> int:
    env = os.environ
    repo, owner = env["GITHUB_REPOSITORY"], env.get("OWNER") or env["GITHUB_REPOSITORY"].split("/")[0]
    mode = (env.get("AUTOPILOT") or "on").strip().lower()
    topic = env.get("NTFY_TOPIC", "").strip()
    dry = env.get("DRY_RUN", "").lower() == "true"
    if mode == "off":
        print("AUTOPILOT=off: nothing to do")
        return 0
    if mode not in ("on", "notify"):
        print(f"::error::AUTOPILOT must be on, notify or off, not {mode!r}")
        return 1
    if not topic and not dry:
        print("::notice::No NTFY_TOPIC secret, so the Autopilot neither notifies nor advances anything")
        return 0
    pat = env.get("GREENLIGHT_TOKEN", "")
    if mode == "on" and not pat:
        print("::warning::No GREENLIGHT_TOKEN secret, so the Autopilot only notifies")
        mode = "notify"

    cfg = Config(repo=repo, owner=owner, mode=mode,
                 idea_hours=env_float("AUTOPILOT_IDEA_HOURS", 48),
                 blueprint_hours=env_float("AUTOPILOT_BLUEPRINT_HOURS", 24),
                 needs_owner_hours=env_float("AUTOPILOT_NEEDS_OWNER_HOURS", 72),
                 max_approvals=int(env_float("AUTOPILOT_MAX_APPROVALS", 2)))
    gh = GitHub(env["GH_TOKEN"])
    now = datetime.now(timezone.utc)
    window = run_window(gh, repo, env.get("GITHUB_RUN_ID", ""), now)
    print(f"Mode {cfg.mode}; notifying label changes in ({window[0].isoformat()}, {window[1].isoformat()}]")

    # Only issues that can produce a notice or an advance need their events and comments.
    raw = [i for i in gh.paginate(f"/repos/{repo}/issues?state=open") if "pull_request" not in i]
    issues: list[Issue] = []
    for i in raw:
        labels = {lab["name"] for lab in i.get("labels", [])}
        st = next((s for s in STATES if s in labels), None)
        touched = parse_time(i["updated_at"]) > window[0]
        if not (st in ("idea", "blueprint-ready") or (touched and labels & set(NOTIFY_LABELS))):
            continue
        n = i["number"]
        issues.append(Issue(n, i["title"], labels, (i.get("user") or {}).get("login", ""), i.get("body") or "",
                            i["html_url"], gh.paginate(f"/repos/{repo}/issues/{n}/events"),
                            gh.paginate(f"/repos/{repo}/issues/{n}/comments")))
    approvals = count_approvals(gh.paginate(f"/repos/{repo}/issues/events", max_pages=3), now)
    plan = plan_run(issues, now, window, cfg, approvals)

    # Weekly summaries, once per finished Ideas or Observer run.
    workflow = env.get("WORKFLOW_RUN_NAME", "")
    conclusion = env.get("WORKFLOW_RUN_CONCLUSION", "")
    run_url = env.get("WORKFLOW_RUN_URL", "")
    run_created = env.get("WORKFLOW_RUN_CREATED_AT", "")
    blob = f"https://github.com/{repo}/blob/{env.get('DEFAULT_BRANCH', 'main')}"
    if workflow == "Ideas":
        today = now.strftime("%Y-%m-%d")
        path = f"analysis/{today}-critic.md"
        md = contents(gh, repo, path) if committed_since(gh, repo, path, run_created) else None
        filed = sum(1 for n in plan.notices if n.title.startswith("New idea:"))
        note = ideas_notice(md, filed, conclusion, run_url, f"{blob}/analysis/{today}-critic.md")
        if note:
            plan.notices.append(note)
    elif workflow == "Observer":
        week = report_week(now)
        path = f"reports/{week}.json"
        text = contents(gh, repo, path) if committed_since(gh, repo, path, run_created) else None
        note = report_notice(json.loads(text) if text else None, conclusion, run_url, f"{blob}/reports/{week}.md")
        if note:
            plan.notices.append(note)

    for line in plan.log:
        print(line)
    if dry:
        for n in plan.notices:
            print(f"[notice p{n.priority}] {n.title}: {n.message} -> {n.click}")
        for number, body in plan.comments:
            print(f"[comment #{number}] {body}")
        for number, label in plan.labels:
            print(f"[label #{number}] +{label}")
        return 0

    server = env.get("NTFY_SERVER") or "https://ntfy.sh"
    failed = 0
    for n in plan.notices:
        try:
            send(server, topic, env.get("NTFY_TOKEN", ""), n)
            print(f"Notified: {n.title}")
        except (urllib.error.URLError, TimeoutError) as error:
            failed += 1
            print(f"::warning::ntfy refused '{n.title}': {error}")
    if failed:
        # Nothing advances that the owner wasn't told about. The failed run leaves the window for the next one.
        print("::error::Some notifications failed, so nothing was advanced")
        return 1

    if plan.comments or plan.labels:
        try:
            gh.request("POST", f"/repos/{repo}/labels", {"name": HOLD, "color": "e4e669",
                                                         "description": "Autopilot: never advance this issue"})
        except urllib.error.HTTPError as error:
            if error.code != 422:  # 422: it exists already
                raise
    for number, body in plan.comments:
        gh.request("POST", f"/repos/{repo}/issues/{number}/comments", {"body": defuse(body)})
    owner_gh = GitHub(pat)
    for number, label in plan.labels:
        owner_gh.request("POST", f"/repos/{repo}/issues/{number}/labels", {"labels": [label]})
        print(f"Added {label} to #{number}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

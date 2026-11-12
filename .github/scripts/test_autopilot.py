"""Tests for autopilot.py's decisions. No network: only the pure functions are exercised."""

import unittest
from datetime import datetime, timedelta, timezone

import autopilot as ap

NOW = datetime(2026, 11, 12, 12, 0, tzinfo=timezone.utc)
CFG = ap.Config(repo="me/greenlight", owner="me")
WINDOW = (NOW - timedelta(hours=1), NOW)

IDEA_BODY = """### Problem

People can't read their fstab. "I have never really understood partitioning."

### Target users

Ubuntu newcomers.

---
_Filed by the Critic from [analysis](x). Score **12/20** (pain 2, competition 3, build 4, reach 3), size **S**._
"""

READY = """📐 **Architect:** blueprint ready at https://github.com/me/x/blob/main/blueprint.md (`abc`).

- Task 1: Parse

🔎 **Reviewer:** ready for your decision.

**Changed in the blueprint:**
- nothing

Add the `blueprint-ok` label to start the Factory.

<!-- greenlight:repo=me/x -->"""

NEEDS = READY.replace("ready for your decision.", "needs your input before `blueprint-ok`.").replace(
    "- nothing\n", "- nothing\n\n**For you to decide:**\n- Check the menu paths against the docs.\n- Confirm the 826 figure.\n"
)
UNREVIEWED = READY.replace("🔎 **Reviewer:** ready for your decision.", "⚠️ **Reviewer:** failed or broke the blueprint.")


def iso(when: datetime) -> str:
    return when.strftime("%Y-%m-%dT%H:%M:%SZ")


def labeled(label: str, when: datetime) -> dict:
    return {"event": "labeled", "label": {"name": label}, "created_at": iso(when)}


def bot_comment(body: str, when: datetime) -> dict:
    return {"user": {"login": ap.BOT}, "author_association": "CONTRIBUTOR", "body": body, "created_at": iso(when)}


def idea(number=10, labeled_ago=timedelta(minutes=30), author=ap.BOT, extra=(), title="[idea] fstab-reader"):
    return ap.Issue(number, title, {"idea", *extra}, author, IDEA_BODY, f"https://github.com/me/greenlight/issues/{number}",
                    [labeled("idea", NOW - labeled_ago)], [])


def blueprint(number=11, comment=READY, ago=timedelta(hours=25), extra=()):
    at = NOW - ago
    return ap.Issue(number, "[idea] fstab-reader", {"blueprint-ready", *extra}, ap.BOT, IDEA_BODY,
                    f"https://github.com/me/greenlight/issues/{number}",
                    [labeled("idea", at - timedelta(days=3)), labeled("blueprint-ready", at)],
                    [bot_comment(comment, at - timedelta(seconds=5))])


def in_state(label: str, number=20) -> ap.Issue:
    return ap.Issue(number, "[idea] other", {label}, ap.BOT, "", "u", [labeled(label, NOW - timedelta(days=5))], [])


class NewIdea(unittest.TestCase):
    def test_notifies_with_score_problem_and_veto_deadline(self):
        plan = ap.plan_run([idea()], NOW, WINDOW, CFG, 0)
        self.assertEqual(len(plan.notices), 1)
        n = plan.notices[0]
        self.assertEqual(n.title, "New idea: fstab-reader (12/20)")
        self.assertIn("People can't read their fstab", n.message)
        due = ap.fmt(NOW - timedelta(minutes=30) + timedelta(hours=48))
        self.assertIn(f"approves it {due}", n.message)
        self.assertEqual(plan.comments[0][0], 10)
        self.assertIn("`hold`", plan.comments[0][1])
        self.assertEqual(plan.labels, [])

    def test_labels_outside_the_window_are_not_notified_again(self):
        plan = ap.plan_run([idea(labeled_ago=timedelta(hours=3))], NOW, WINDOW, CFG, 0)
        self.assertEqual(plan.notices, [])
        self.assertEqual(plan.comments, [])

    def test_a_strangers_idea_is_notified_but_never_scheduled(self):
        plan = ap.plan_run([idea(author="someone")], NOW, WINDOW, CFG, 0)
        self.assertIn("Add `approved`", plan.notices[0].message)
        self.assertEqual(plan.comments, [])
        later = ap.plan_run([idea(author="someone", labeled_ago=timedelta(hours=49))], NOW, WINDOW, CFG, 0)
        self.assertEqual(later.labels, [])

    def test_notify_mode_never_comments_or_advances(self):
        cfg = ap.Config(repo="me/greenlight", owner="me", mode="notify")
        plan = ap.plan_run([idea()], NOW, WINDOW, cfg, 0)
        self.assertEqual(len(plan.notices), 1)
        self.assertEqual(plan.comments, [])
        plan = ap.plan_run([idea(labeled_ago=timedelta(hours=49))], NOW, WINDOW, cfg, 0)
        self.assertEqual(plan.labels, [])


class ApproveIdea(unittest.TestCase):
    def test_approves_once_the_window_has_passed(self):
        plan = ap.plan_run([idea(labeled_ago=timedelta(hours=49))], NOW, WINDOW, CFG, 0)
        self.assertEqual(plan.labels, [(10, "approved")])
        self.assertEqual(plan.notices[-1].title, "Approved: fstab-reader")

    def test_waits_inside_the_window(self):
        plan = ap.plan_run([idea(labeled_ago=timedelta(hours=47))], NOW, WINDOW, CFG, 0)
        self.assertEqual(plan.labels, [])

    def test_hold_owner_ideas_and_changes(self):
        held = idea(labeled_ago=timedelta(hours=49), extra=("hold",))
        self.assertEqual(ap.plan_run([held], NOW, WINDOW, CFG, 0).labels, [])
        change = idea(labeled_ago=timedelta(hours=49), title="[change] tweak", extra=("change",))
        self.assertEqual(ap.plan_run([change], NOW, WINDOW, CFG, 0).labels, [])
        mine = idea(labeled_ago=timedelta(hours=49), author="me")
        self.assertEqual(ap.plan_run([mine], NOW, WINDOW, CFG, 0).labels, [(10, "approved")])

    def test_one_at_a_time_and_oldest_first(self):
        old, new = idea(5, timedelta(hours=60)), idea(9, timedelta(hours=50))
        self.assertEqual(ap.plan_run([new, old], NOW, WINDOW, CFG, 0).labels, [(5, "approved")])
        busy = ap.plan_run([old, in_state("building")], NOW, WINDOW, CFG, 0)
        self.assertEqual(busy.labels, [])
        self.assertIn("waiting for #20", busy.log[0])

    def test_monthly_cap(self):
        plan = ap.plan_run([idea(labeled_ago=timedelta(hours=49))], NOW, WINDOW, CFG, 2)
        self.assertEqual(plan.labels, [])
        self.assertIn("AUTOPILOT_MAX_APPROVALS=2", plan.log[0])


class Blueprint(unittest.TestCase):
    def test_ready_blueprint_builds_after_a_day(self):
        self.assertEqual(ap.plan_run([blueprint()], NOW, WINDOW, CFG, 9).labels, [(11, "blueprint-ok")])
        self.assertEqual(ap.plan_run([blueprint(ago=timedelta(hours=23))], NOW, WINDOW, CFG, 0).labels, [])

    def test_blueprint_needing_input_waits_three_days(self):
        self.assertEqual(ap.plan_run([blueprint(comment=NEEDS)], NOW, WINDOW, CFG, 0).labels, [])
        late = blueprint(comment=NEEDS, ago=timedelta(hours=73))
        self.assertEqual(ap.plan_run([late], NOW, WINDOW, CFG, 0).labels, [(11, "blueprint-ok")])

    def test_unreviewed_draft_is_never_built(self):
        stale = blueprint(comment=UNREVIEWED, ago=timedelta(days=10))
        self.assertEqual(ap.plan_run([stale], NOW, WINDOW, CFG, 0).labels, [])

    def test_waits_for_a_running_build(self):
        plan = ap.plan_run([blueprint(), in_state("building")], NOW, WINDOW, CFG, 0)
        self.assertEqual(plan.labels, [])

    def test_notice_carries_the_reviewers_concerns(self):
        fresh = blueprint(comment=NEEDS, ago=timedelta(minutes=10))
        plan = ap.plan_run([fresh], NOW, WINDOW, CFG, 0)
        n = plan.notices[0]
        self.assertEqual(n.title, "Blueprint ready: fstab-reader")
        self.assertIn("- Check the menu paths against the docs.", n.message)
        self.assertIn("Autopilot starts the build", n.message)
        self.assertEqual(n.priority, 4)

    def test_a_strangers_architect_comment_does_not_count(self):
        fresh = blueprint(ago=timedelta(minutes=10))
        fresh.comments = [{"user": {"login": "rando"}, "author_association": "NONE", "body": READY,
                           "created_at": iso(NOW - timedelta(minutes=5))}]
        self.assertIn("unreviewed draft", ap.plan_run([fresh], NOW, WINDOW, CFG, 0).notices[0].message)


class OtherStates(unittest.TestCase):
    def test_live_links_the_site(self):
        issue = ap.Issue(3, "[idea] spend-cap", {"live"}, ap.BOT, "", "issue-url",
                         [labeled("live", NOW - timedelta(minutes=5))],
                         [bot_comment("🚀 live\n\n<!-- greenlight:url=https://x.me.workers.dev -->", NOW)])
        n = ap.plan_run([issue], NOW, WINDOW, CFG, 0).notices[0]
        self.assertEqual((n.title, n.click), ("Live: spend-cap", "https://x.me.workers.dev"))

    def test_stuck_is_urgent(self):
        issue = ap.Issue(4, "[idea] x", {"stuck"}, ap.BOT, "", "u", [labeled("stuck", NOW - timedelta(minutes=5))],
                         [bot_comment("🔍 **Inspector:** gave up after 3 rounds.\n\nmore", NOW)])
        n = ap.plan_run([issue], NOW, WINDOW, CFG, 0).notices[0]
        self.assertEqual(n.priority, 4)
        self.assertEqual(n.message, "🔍 Inspector: gave up after 3 rounds.")


class Helpers(unittest.TestCase):
    def test_count_approvals_skips_changes_and_old_ones(self):
        def ev(days, title="[idea] a", labels=()):
            return {"event": "labeled", "label": {"name": "approved"}, "created_at": iso(NOW - timedelta(days=days)),
                    "issue": {"title": title, "labels": [{"name": n} for n in labels]}}
        events = [ev(1), ev(10), ev(40), ev(2, "[change] b"), ev(3, "x", ["change"]),
                  {"event": "labeled", "label": {"name": "idea"}, "created_at": iso(NOW)}]
        self.assertEqual(ap.count_approvals(events, NOW), 2)

    def test_first_paragraph_skips_headings_and_tables(self):
        md = "# Critic\n\n| a | b |\n|---|---|\n\nNo card reached 12. Nothing filed.\n\n## x\n"
        self.assertEqual(ap.first_paragraph(md), "No card reached 12. Nothing filed.")

    def test_report_week_matches_the_observer(self):
        self.assertEqual(ap.report_week(datetime(2026, 11, 9, 14, tzinfo=timezone.utc)), "2026-W45")
        self.assertEqual(ap.report_week(datetime(2026, 11, 15, 14, tzinfo=timezone.utc)), "2026-W45")

    def test_weekly_notices(self):
        n = ap.ideas_notice("# C\n\nNothing reaches 12.\n", 0, "success", "run", "file")
        self.assertEqual((n.title, n.message, n.click), ("Weekly ideas: nothing filed", "Nothing reaches 12.", "file"))
        self.assertIsNone(ap.ideas_notice(None, 0, "success", "run", "file"))
        self.assertEqual(ap.ideas_notice(None, 0, "failure", "run", "file").click, "run")
        r = ap.report_notice({"week": "2026-W45", "summary": "All up.", "products": [{"issue": 1, "verdict": "archive"}]},
                             "success", "run", "file")
        self.assertEqual(r.title, "Weekly report 2026-W45")
        self.assertIn("#1 archive", r.message)

    def test_test_notice_says_what_mode_it_is_in(self):
        n = ap.test_notice("me/greenlight", "notify")
        self.assertEqual(n.title, "Greenlight test notification")
        self.assertIn("notify only", n.message)
        self.assertEqual(n.click, "https://github.com/me/greenlight/actions/workflows/autopilot.yml")
        self.assertIn("veto windows", ap.test_notice("me/greenlight", "on").message)

    def test_defuse_mentions(self):
        self.assertEqual(ap.defuse("@bob"), "@​bob")


if __name__ == "__main__":
    unittest.main()

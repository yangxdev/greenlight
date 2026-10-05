"""Tests for template_sync.py: python3 -m unittest discover -s .github/scripts"""

import json
import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import template_sync as ts  # noqa: E402

MANIFEST = "# owned\n.github/\nCLAUDE.md\nsrc/components/ui/\n.greenlight/owned\n"


def run(cwd, *args):
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def write(root, path, text):
    full = os.path.join(root, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(text)


def read(root, path):
    with open(os.path.join(root, path), encoding="utf-8") as f:
        return f.read()


class Fixture:
    """A greenlight repo whose template/ evolves commit by commit, and a product scaffolded from one of them."""

    def __init__(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = os.path.join(self.tmp.name, "greenlight")
        os.makedirs(self.repo)
        run(self.repo, "git", "init", "-q", "-b", "main")
        run(self.repo, "git", "config", "user.email", "t@t")
        run(self.repo, "git", "config", "user.name", "t")

    def commit(self, files: dict, remove=()):
        for path, text in files.items():
            write(self.repo, f"template/{path}", text)
        for path in remove:
            os.remove(os.path.join(self.repo, "template", path))
        run(self.repo, "git", "add", "-A")
        run(self.repo, "git", "commit", "-q", "-m", "c", "--allow-empty")
        return run(self.repo, "git", "rev-parse", "HEAD")

    def scaffold(self, sha, name="my-app", owner="me", stamp=True):
        product = os.path.join(self.tmp.name, f"product-{sha[:7]}")
        os.makedirs(product)
        listing = run(self.repo, "git", "ls-tree", "-r", "--name-only", sha, "--", "template/").splitlines()
        for path in listing:
            text = run(self.repo, "git", "show", f"{sha}:{path}")
            text = text.replace("greenlight-product", name).replace("greenlight-owner", owner)
            write(product, path[len("template/"):], text + "\n" if not text.endswith("\n") else text)
        if stamp:
            write(product, ".greenlight/template", sha + "\n")
        return product


def base_files(extra=None):
    files = {
        ".greenlight/owned": MANIFEST,
        ".github/workflows/deploy.yml": "deploy: v1\n",
        "CLAUDE.md": "rules v1\n",
        "src/components/ui/Button.tsx": "button v1\n",
        "src/components/ui/Old.tsx": "old\n",
        "src/App.tsx": "app for greenlight-product\n",
        "README.md": "# greenlight-product by greenlight-owner\n",
    }
    files.update(extra or {})
    return files


class ThreeWayTest(unittest.TestCase):
    def setUp(self):
        self.f = Fixture()
        self.v1 = self.f.commit(base_files())

    def tearDown(self):
        self.f.tmp.cleanup()

    def test_untouched_files_take_the_new_template_and_unowned_files_are_left_alone(self):
        product = self.f.scaffold(self.v1)
        write(product, "src/App.tsx", "the product's own app\n")
        v2 = self.f.commit(
            {"CLAUDE.md": "rules v2\n", "src/components/ui/Pane.tsx": "pane\n", "src/App.tsx": "new scaffold\n"},
            remove=["src/components/ui/Old.tsx"],
        )
        plan = ts.make_plan(self.f.repo, product, "my-app", "me", "HEAD")
        self.assertEqual(plan.base, self.v1)
        self.assertEqual(sorted(plan.write), ["CLAUDE.md", "src/components/ui/Pane.tsx"])
        self.assertEqual(plan.delete, ["src/components/ui/Old.tsx"])
        self.assertEqual(plan.conflicts, [])
        ts.apply(plan, product)
        self.assertEqual(read(product, "CLAUDE.md"), "rules v2\n")
        self.assertFalse(os.path.exists(os.path.join(product, "src/components/ui/Old.tsx")))
        self.assertEqual(read(product, "src/App.tsx"), "the product's own app\n")
        self.assertEqual(read(product, ".greenlight/template").strip(), v2)

    def test_a_file_the_product_changed_is_kept_or_reported(self):
        product = self.f.scaffold(self.v1)
        write(product, "CLAUDE.md", "rules v1, edited here\n")
        write(product, "src/components/ui/Button.tsx", "button, edited here\n")
        self.f.commit({"CLAUDE.md": "rules v2\n"})
        plan = ts.make_plan(self.f.repo, product, "my-app", "me", "HEAD")
        self.assertEqual(plan.conflicts, ["CLAUDE.md"])
        self.assertEqual(plan.kept, ["src/components/ui/Button.tsx"])
        self.assertFalse(plan.changes)

    def test_nothing_to_do_when_the_product_is_current(self):
        product = self.f.scaffold(self.v1)
        self.f.commit({"README.md": "unowned change\n"})
        plan = ts.make_plan(self.f.repo, product, "my-app", "me", "HEAD")
        self.assertFalse(plan.changes)
        self.assertEqual(plan.conflicts, [])

    def test_without_a_stamp_files_lagging_at_different_versions_all_catch_up(self):
        v2 = self.f.commit({"CLAUDE.md": "rules v2\n"})
        self.f.commit({"CLAUDE.md": "rules v3\n", "src/components/ui/Button.tsx": "button v3\n"})
        product = self.f.scaffold(v2, stamp=False)
        write(product, "CLAUDE.md", "rules v1\n")  # one file updated by hand at another time than the rest
        plan = ts.make_plan(self.f.repo, product, "my-app", "me", "HEAD")
        self.assertIsNone(plan.base)
        self.assertEqual(sorted(plan.write), ["CLAUDE.md", "src/components/ui/Button.tsx"])
        self.assertEqual(plan.conflicts, [])

    def test_a_file_missing_here_because_it_is_newer_than_the_product_is_added(self):
        product = self.f.scaffold(self.v1, stamp=False)
        self.f.commit({"src/components/ui/Pane.tsx": "pane\n"})
        plan = ts.make_plan(self.f.repo, product, "my-app", "me", "HEAD")
        self.assertIn("src/components/ui/Pane.tsx", plan.write)

    def test_the_products_own_file_in_a_template_folder_is_kept(self):
        product = self.f.scaffold(self.v1, stamp=False)
        write(product, "src/components/ui/Chart.tsx", "the product's own\n")
        plan = ts.make_plan(self.f.repo, product, "my-app", "me", "HEAD")
        self.assertEqual(plan.kept, ["src/components/ui/Chart.tsx"])
        self.assertEqual(plan.delete, [])

    def test_without_a_stamp_a_changed_file_is_reported(self):
        product = self.f.scaffold(self.v1, stamp=False)
        write(product, "CLAUDE.md", "rules, edited here\n")
        self.f.commit({"CLAUDE.md": "rules v2\n"})
        plan = ts.make_plan(self.f.repo, product, "my-app", "me", "HEAD")
        self.assertEqual(plan.conflicts, ["CLAUDE.md"])

    def test_a_stamp_that_is_not_a_greenlight_commit_is_ignored(self):
        product = self.f.scaffold(self.v1)
        write(product, ".greenlight/template", "deadbeef\n")
        self.f.commit({"CLAUDE.md": "rules v2\n"})
        plan = ts.make_plan(self.f.repo, product, "my-app", "me", "HEAD")
        self.assertIsNone(plan.base)
        self.assertEqual(list(plan.write), ["CLAUDE.md"])

    def test_scaffold_placeholders_are_rendered_before_comparing(self):
        v2 = self.f.commit({"CLAUDE.md": "rules for greenlight-product\n"})
        product = self.f.scaffold(v2)
        self.f.commit({"CLAUDE.md": "rules v3 for greenlight-product by greenlight-owner\n"})
        plan = ts.make_plan(self.f.repo, product, "my-app", "me", "HEAD")
        self.assertEqual(plan.write["CLAUDE.md"], b"rules v3 for my-app by me\n")

    def test_the_cli_prints_a_summary_and_writes_a_report(self):
        product = self.f.scaffold(self.v1)
        self.f.commit({"CLAUDE.md": "rules v2\n"})
        report = os.path.join(self.f.tmp.name, "report.md")
        out = run(
            os.path.dirname(__file__),
            sys.executable,
            "template_sync.py",
            "--greenlight", self.f.repo,
            "--product", product,
            "--name", "my-app",
            "--owner", "me",
            "--repo", "me/greenlight",
            "--apply",
            "--report", report,
        )
        summary = json.loads(out)
        self.assertEqual(summary["updated"], ["CLAUDE.md"])
        self.assertTrue(summary["changes"])
        with open(report, encoding="utf-8") as f:
            text = f.read()
        self.assertIn("`CLAUDE.md`", text)
        self.assertIn("greenlight:template-sync", text)


class ManifestTest(unittest.TestCase):
    def test_folders_and_exact_paths(self):
        patterns = ts.parse_manifest(MANIFEST)
        self.assertTrue(ts.is_owned(".github/workflows/x.yml", patterns))
        self.assertTrue(ts.is_owned("CLAUDE.md", patterns))
        self.assertFalse(ts.is_owned("CLAUDE.md.bak", patterns))
        self.assertFalse(ts.is_owned("src/App.tsx", patterns))

    def test_render_leaves_binary_files_alone(self):
        self.assertEqual(ts.render(b"\x89PNG\0greenlight-product", "x", "y"), b"\x89PNG\0greenlight-product")
        self.assertEqual(ts.render(b"greenlight-product", "x", "y"), b"x")


if __name__ == "__main__":
    unittest.main()

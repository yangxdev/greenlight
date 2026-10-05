#!/usr/bin/env python3
"""Template sync: bring one product's template-owned files up to date with greenlight's template/.

No AI and no product code runs here: it compares bytes and writes files.

For each path the template owns (template/.greenlight/owned), it compares the product's copy with the template now
(head) and with every earlier version of it:
  product == head                      nothing to do
  product == some template version     the product never changed it, it is just behind: take head
                                       (add, update or delete)
  no template version ever had it      the product's own file in a template folder: keep it
  base == head                         the product changed it and the template hasn't since the version in
                                       .greenlight/template: keep the product's copy
  otherwise                            changed on both sides: keep the product's copy and report it

Comparing with every version rather than one base matters for products built before stamps existed: their files can
lag at different template versions (one file updated by hand, another not). After a sync the stamp is head.

Template files go through the scaffold's substitutions (greenlight-product -> repo name, greenlight-owner -> owner)
before comparing, the same way the Architect renders them when it creates a product repo.

Usage:
  template_sync.py --greenlight . --product DIR --name NAME --owner OWNER --head SHA [--apply] [--report FILE]
Prints a JSON summary on stdout.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass, field

MANIFEST = ".greenlight/owned"
STAMP = ".greenlight/template"
MAX_CANDIDATES = 300


def git(repo: str, *args: str, input: bytes | None = None) -> bytes:
    return subprocess.run(["git", "-C", repo, *args], check=True, capture_output=True, input=input).stdout


def parse_manifest(text: str) -> list[str]:
    patterns = []
    for line in text.splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            patterns.append(line)
    return patterns


def is_owned(path: str, patterns: list[str]) -> bool:
    return any(path.startswith(p) if p.endswith("/") else path == p for p in patterns)


def render(content: bytes, name: str, owner: str) -> bytes:
    """The Architect's scaffold substitutions, applied to text files only (as `grep -I` does)."""
    if b"\0" in content:
        return content
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        return content
    return text.replace("greenlight-product", name).replace("greenlight-owner", owner).encode("utf-8")


class TemplateReader:
    """Reads template/ at any greenlight commit through one `git cat-file --batch`."""

    def __init__(self, repo: str):
        self.repo = repo
        self.proc = subprocess.Popen(
            ["git", "-C", repo, "cat-file", "--batch"], stdin=subprocess.PIPE, stdout=subprocess.PIPE
        )
        self.cache: dict[tuple[str, str], dict[str, bytes]] = {}

    def close(self) -> None:
        if self.proc.stdin:
            self.proc.stdin.close()
        self.proc.wait()

    def _blob(self, oid: str) -> bytes:
        assert self.proc.stdin and self.proc.stdout
        self.proc.stdin.write(f"{oid}\n".encode())
        self.proc.stdin.flush()
        header = self.proc.stdout.readline().split()
        size = int(header[2])
        data = self.proc.stdout.read(size)
        self.proc.stdout.read(1)  # trailing newline
        return data

    def files(self, sha: str, patterns: list[str], name: str, owner: str) -> dict[str, bytes]:
        key = (sha, "\n".join(patterns))
        if key not in self.cache:
            listing = git(self.repo, "ls-tree", "-r", "-z", sha, "--", "template/")
            out: dict[str, bytes] = {}
            for entry in listing.split(b"\0"):
                if not entry:
                    continue
                meta, path_bytes = entry.split(b"\t", 1)
                mode, kind, oid = meta.decode().split()
                path = path_bytes.decode()[len("template/"):]
                if kind == "blob" and is_owned(path, patterns):
                    out[path] = self._blob(oid)
            self.cache[key] = out
        return {p: render(c, name, owner) for p, c in self.cache[key].items()}

    def manifest(self, sha: str) -> list[str]:
        try:
            return parse_manifest(git(self.repo, "show", f"{sha}:template/{MANIFEST}").decode("utf-8"))
        except subprocess.CalledProcessError:
            return []


def product_files(product: str, patterns: list[str]) -> dict[str, bytes]:
    out: dict[str, bytes] = {}
    for root, dirs, names in os.walk(product):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules")]
        for n in names:
            full = os.path.join(root, n)
            path = os.path.relpath(full, product).replace(os.sep, "/")
            if is_owned(path, patterns) and not os.path.islink(full):
                with open(full, "rb") as f:
                    out[path] = f.read()
    return out


@dataclass
class Plan:
    base: str | None  # the template version in .greenlight/template, if the product has one
    head: str
    oldest: str  # the oldest template version compared with
    write: dict[str, bytes] = field(default_factory=dict)
    delete: list[str] = field(default_factory=list)
    kept: list[str] = field(default_factory=list)  # the product's own change, the template didn't touch it
    conflicts: list[str] = field(default_factory=list)  # both changed

    @property
    def changes(self) -> bool:
        return bool(self.write or self.delete)


def classify(
    head: dict[str, bytes],
    product: dict[str, bytes],
    history: dict[str, set[bytes | None]],
    base: dict[str, bytes] | None,
    plan: Plan,
) -> None:
    for path in sorted(set(head) | set(product)):
        h, p = head.get(path), product.get(path)
        if p == h:
            continue
        seen = history.get(path, {None})
        if p in seen:
            if h is None:
                plan.delete.append(path)
            else:
                plan.write[path] = h
        elif seen == {None}:
            plan.kept.append(path)
        elif base is not None and base.get(path) == h:
            plan.kept.append(path)
        else:
            plan.conflicts.append(path)


def candidates(repo: str, head: str) -> list[str]:
    """Template versions, newest first: every greenlight commit that touched template/, up to MAX_CANDIDATES."""
    out = git(repo, "log", "--format=%H", f"-n{MAX_CANDIDATES}", head, "--", "template/").decode().split()
    return out or [head]


def read_stamp(repo: str, product_dir: str) -> str | None:
    try:
        with open(os.path.join(product_dir, STAMP), encoding="utf-8") as f:
            sha = f.read().strip()
    except OSError:
        return None
    if not sha or any(c not in "0123456789abcdef" for c in sha):
        return None
    try:
        git(repo, "cat-file", "-e", f"{sha}^{{commit}}")
    except subprocess.CalledProcessError:
        return None
    return sha


def make_plan(repo: str, product_dir: str, name: str, owner: str, head: str) -> Plan:
    head = git(repo, "rev-parse", f"{head}^{{commit}}").decode().strip()
    reader = TemplateReader(repo)
    try:
        stamped = read_stamp(repo, product_dir)
        patterns = sorted(set(reader.manifest(head)) | (set(reader.manifest(stamped)) if stamped else set()))
        versions = candidates(repo, head)
        if stamped and stamped not in versions:
            versions.append(stamped)
        history: dict[str, set[bytes | None]] = {}
        snapshots = [reader.files(sha, patterns, name, owner) for sha in versions]
        paths = set().union(*snapshots)
        for files in snapshots:
            for path in paths:
                history.setdefault(path, set()).add(files.get(path))
        plan = Plan(base=stamped, head=head, oldest=versions[-1])
        classify(
            reader.files(head, patterns, name, owner),
            product_files(product_dir, patterns),
            history,
            reader.files(stamped, patterns, name, owner) if stamped else None,
            plan,
        )
        return plan
    finally:
        reader.close()


def apply(plan: Plan, product_dir: str) -> None:
    for path, content in plan.write.items():
        full = os.path.join(product_dir, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "wb") as f:
            f.write(content)
    for path in plan.delete:
        os.remove(os.path.join(product_dir, path))
    os.makedirs(os.path.join(product_dir, os.path.dirname(STAMP)), exist_ok=True)
    with open(os.path.join(product_dir, STAMP), "w", encoding="utf-8") as f:
        f.write(plan.head + "\n")


def report(plan: Plan, greenlight_repo: str) -> str:
    def compare(a: str, b: str) -> str:
        return f"https://github.com/{greenlight_repo}/compare/{a[:12]}...{b[:12]}" if greenlight_repo else ""

    lines = [
        "Brings this product's template-owned files up to date with greenlight's `template/`. No AI ran.",
        "",
        (
            f"- From template `{plan.base[:7]}` (recorded in `.greenlight/template`) to `{plan.head[:7]}`."
            f" [What changed in the template]({compare(plan.base, plan.head)})"
            if plan.base
            else f"- To template `{plan.head[:7]}`. This repo had no `.greenlight/template` yet, so each file was compared"
            f" with every template version since `{plan.oldest[:7]}`; this sync adds the stamp."
        ),
        "",
    ]
    if plan.write:
        lines += ["**Updated** (never changed here, just behind the template):", ""]
        lines += [f"- `{p}`" for p in sorted(plan.write)]
        lines.append("")
    if plan.delete:
        lines += ["**Removed** (the template dropped them, and they were unchanged here):", ""]
        lines += [f"- `{p}`" for p in sorted(plan.delete)]
        lines.append("")
    if plan.conflicts:
        lines += [
            "**Not updated, changed on both sides** (this repo's copy matches no template version, and the template",
            "has moved on; this repo's copy is kept). To bring one across, file a change on the product's idea issue:",
            "",
        ]
        lines += [f"- `{p}`" for p in sorted(plan.conflicts)]
        lines.append("")
    if plan.kept:
        lines += ["Changed only in this repo, so kept as is: " + ", ".join(f"`{p}`" for p in sorted(plan.kept)), ""]
    lines += [
        "The checks run as on any pull request. Merging deploys through the Publisher, like any push to `main`.",
        "<!-- greenlight:template-sync -->",
    ]
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--greenlight", required=True, help="greenlight checkout with full history")
    ap.add_argument("--product", required=True, help="product checkout")
    ap.add_argument("--name", required=True)
    ap.add_argument("--owner", required=True)
    ap.add_argument("--head", default="HEAD")
    ap.add_argument("--repo", default="", help="owner/greenlight, for links in the report")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--report")
    args = ap.parse_args(argv)

    plan = make_plan(args.greenlight, args.product, args.name, args.owner, args.head)
    if args.apply and plan.changes:
        apply(plan, args.product)
    if args.report:
        with open(args.report, "w", encoding="utf-8") as f:
            f.write(report(plan, args.repo))
    json.dump(
        {
            "base": plan.base,
            "head": plan.head,
            "updated": sorted(plan.write),
            "removed": sorted(plan.delete),
            "conflicts": sorted(plan.conflicts),
            "kept": sorted(plan.kept),
            "changes": plan.changes,
        },
        sys.stdout,
        indent=1,
    )
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

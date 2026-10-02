"""Draws the README diagrams as SVG, light and dark, from the DESIGN.md tokens.

Text is converted to outlines, so the files render the same everywhere (GitHub serves README images
through <img>, which cannot load web fonts).

    pip install fonttools
    python assets/diagrams/build.py            # fetches Geist with `npm pack geist`
    GEIST_DIR=/path/to/geist/dist/fonts python assets/diagrams/build.py

Edit the labels here, never in the generated .svg files.
"""

import os
import subprocess
import tarfile
import tempfile
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

OUT = Path(__file__).resolve().parent

THEMES = {
    "light": {
        "canvas": "#FFFFFF", "zone": "#F7F7F5", "line": "#E6E5E2", "line_strong": "#CFCDC8",
        "ink": "#14161A", "muted": "#6B7078", "brand": "#C63A00", "success": "#177C52",
    },
    "dark": {
        "canvas": "#0F100F", "zone": "#151614", "line": "#272825", "line_strong": "#3A3B37",
        "ink": "#F7F6F3", "muted": "#8E8D87", "brand": "#FF9B50", "success": "#47BE8B",
    },
}


# ---------------------------------------------------------------- fonts

def geist_dir():
    if os.environ.get("GEIST_DIR"):
        return Path(os.environ["GEIST_DIR"])
    tmp = Path(tempfile.mkdtemp())
    subprocess.run(["npm", "pack", "geist", "--silent"], cwd=tmp, check=True, capture_output=True)
    with tarfile.open(next(tmp.glob("geist-*.tgz"))) as tar:
        tar.extractall(tmp, filter="data")
    return tmp / "package" / "dist" / "fonts"


class Font:
    def __init__(self, path):
        self.font = TTFont(path)
        self.upm = self.font["head"].unitsPerEm
        self.cmap = self.font.getBestCmap()
        self.glyphs = self.font.getGlyphSet()
        self.hmtx = self.font["hmtx"]

    def width(self, text, size, tracking=0.0):
        units = sum(self.hmtx[self.cmap[ord(c)]][0] for c in text)
        return units * size / self.upm + tracking * size * len(text)

    def path(self, text, x, y, size, tracking=0.0):
        scale = size / self.upm
        pen = SVGPathPen(self.glyphs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
        for c in text:
            name = self.cmap[ord(c)]
            self.glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, y)))
            x += self.hmtx[name][0] * scale + tracking * size
        return pen.getCommands()


SANS = MEDIUM = MONO = None


# ---------------------------------------------------------------- drawing

class Svg:
    def __init__(self, w, h, title, desc, theme):
        self.w, self.h, self.t = w, h, THEMES[theme]
        self.parts = [f'<rect width="{w}" height="{h}" fill="{self.t["canvas"]}"/>']
        self.title, self.desc = title, desc

    def c(self, role):
        return self.t[role]

    def text(self, s, x, y, font, size, role="ink", tracking=0.0, anchor="start"):
        if anchor != "start":
            x -= font.width(s, size, tracking) / (2 if anchor == "middle" else 1)
        self.parts.append(f'<path fill="{self.c(role)}" d="{font.path(s, x, y, size, tracking)}"/>')

    def label(self, s, x, y, role="muted", size=11, anchor="start"):
        """Uppercase mono label, +0.12em, the most repeated element in DESIGN.md."""
        self.text(s.upper(), x, y, MONO, size, role, 0.12, anchor)

    def rect(self, x, y, w, h, stroke=None, fill="none"):
        stroke_attr = f' stroke="{self.c(stroke)}" stroke-width="1"' if stroke else ""
        fill = self.c(fill) if fill != "none" else "none"
        self.parts.append(
            f'<rect x="{x + 0.5}" y="{y + 0.5}" width="{w - 1}" height="{h - 1}" fill="{fill}"{stroke_attr}/>')

    def dot(self, x, y, role, r=4.5):
        self.parts.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{self.c(role)}"/>')

    def arrow(self, points, role="ink", head=True):
        """A plain hairline through `points`, with a small open arrowhead at the last one."""
        d = "M" + " L".join(f"{x} {y}" for x, y in points)
        out = [f'<path d="{d}" fill="none" stroke="{self.c(role)}" stroke-width="1.25"/>']
        if head:
            (x0, y0), (x1, y1) = points[-2], points[-1]
            dx, dy = (x1 > x0) - (x1 < x0), (y1 > y0) - (y1 < y0)
            px, py = -dy, dx  # perpendicular
            a = f"{x1 - 6 * dx + 4 * px} {y1 - 6 * dy + 4 * py}"
            b = f"{x1 - 6 * dx - 4 * px} {y1 - 6 * dy - 4 * py}"
            out.append(f'<path d="M{a} L{x1} {y1} L{b}" fill="none" stroke="{self.c(role)}" '
                       f'stroke-width="1.25" stroke-linejoin="miter"/>')
        self.parts += out

    def write(self, path):
        body = "\n".join(self.parts)
        path.write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
            f'viewBox="0 0 {self.w} {self.h}" role="img" aria-labelledby="title desc">\n'
            f'<title id="title">{self.title}</title>\n<desc id="desc">{self.desc}</desc>\n{body}\n</svg>\n')


# ---------------------------------------------------------------- 01 the pipeline

STAGES = [
    ("Scout", "scripts"), ("Analyst", "AI"), ("Critic", "AI"), ("Board", "issues"), ("Architect", "AI"),
    ("Reviewer", "AI"), ("Factory", "AI"), ("Inspector", "AI + checks"), ("Publisher", "no AI"), ("Observer", "AI"),
]
GATES = {3: "approved", 5: "blueprint-ok"}  # gate sits on the arrow leaving stage i


def pipeline(theme):
    W, M, CW, CH, GAP = 960, 24, 152, 104, 30
    ROW_Y = [80, 252]
    s = Svg(W, 440, "The greenlight pipeline",
            "Ten stages, read left to right: 01 Scout (scripts), 02 Analyst, 03 Critic, 04 Board (issues), "
            "05 Architect, 06 Reviewer, 07 Factory, 08 Inspector (AI plus checks), 09 Publisher (no AI), "
            "10 Observer. Two human gates: you add the label approved between Board and Architect, and "
            "blueprint-ok between Reviewer and Factory. The Observer's weekly-report.md feeds back into the Board.",
            theme)

    def cell_x(i):
        return M + (i % 5) * (CW + GAP)

    for i, (name, kind) in enumerate(STAGES):
        x, y = cell_x(i), ROW_Y[i // 5]
        s.rect(x, y, CW, CH, stroke="line_strong")
        s.label(f"{i + 1:02d}", x + 14, y + 24)
        s.text(name, x + 14, y + 58, MEDIUM, 19)
        s.label(kind, x + 14, y + 86)

        last_in_row = i % 5 == 4
        if i == len(STAGES) - 1:
            continue
        if not last_in_row:
            role = "brand" if i in GATES else "ink"
            mid = y + CH / 2
            s.arrow([(x + CW + 4, mid), (x + CW + GAP - 4, mid)], role)
        else:  # wrap to the next row
            cx, bottom = x + CW / 2, y + CH
            s.arrow([(cx, bottom + 4), (cx, bottom + 40), (cell_x(0) + CW / 2, bottom + 40),
                     (cell_x(0) + CW / 2, ROW_Y[1] - 4)])
        if i in GATES:
            gx, gy = x + CW + GAP / 2, y + CH + 22
            s.dot(gx, gy - 4, "brand")
            s.text(GATES[i], gx + 12, gy, MONO, 12, "brand")

    # The weekly report feeds back into the board, around the right-hand side.
    obs_x, obs_mid = cell_x(9) + CW, ROW_Y[1] + CH / 2
    board_cx = cell_x(3) + CW / 2
    s.arrow([(obs_x + 4, obs_mid), (936, obs_mid), (936, 48), (board_cx, 48), (board_cx, ROW_Y[0] - 4)], "muted")
    s.text("weekly-report.md", board_cx + 14, 38, MONO, 12, "muted")

    s.dot(M + 4.5, 414, "brand")
    s.text("human gate: you add the label", M + 18, 418, SANS, 14, "muted")
    s.write(OUT / f"pipeline-{theme}.svg")


# ---------------------------------------------------------------- 02 the label state machine

def states(theme):
    W, M, CW, CH, GAP = 960, 24, 160, 88, 28
    R1, R2, R3 = 24, 168, 312
    s = Svg(W, 460, "The greenlight label state machine",
            "Each idea issue carries one state label. idea, set by you or the Critic; approved, set by you; "
            "blueprint-ready, set by the Architect; blueprint-ok, set by you; building, set by dispatch. "
            "While building, the Factory opens a pull request, the Inspector reviews and runs the checks, and on "
            "a pass it merges and the Publisher deploys and smoke-tests, which sets live. On a fail the Factory "
            "pushes a fix, at most three rounds; when the rounds run out or any automated step fails, the issue "
            "is stuck. You can move any state to archived.",
            theme)

    def x(col):
        return M + col * (CW + GAP)

    def state(col, y, name, by, dot=None):
        s.rect(x(col), y, CW, CH, stroke="line_strong")
        s.text(name, x(col) + 14, y + 38, MONO, 14)
        s.label(f"by {by}", x(col) + 14, y + 66, "brand" if dot == "brand" else "muted")
        if dot:
            s.dot(x(col) + CW - 18, y + 18, dot)

    def step(col, y, name, what):
        s.rect(x(col), y, CW, CH, fill="zone")
        s.text(name, x(col) + 14, y + 38, MEDIUM, 17)
        s.text(what, x(col) + 14, y + 64, SANS, 13, "muted")

    def right(col, y, start=None):
        mid = y + CH / 2
        s.arrow([(start or x(col) + CW + 4, mid), (x(col + 1) - 4, mid)])

    # Row 1: the states up to building.
    for col, (name, by, dot) in enumerate([
        ("idea", "you · Critic", None), ("approved", "you", "brand"), ("blueprint-ready", "Architect", None),
        ("blueprint-ok", "you", "brand"), ("building", "dispatch", None),
    ]):
        state(col, R1, name, by, dot)
        if col < 4:
            right(col, R1)

    # Row 2: what happens while building.
    cx0, cx4 = x(0) + CW / 2, x(4) + CW / 2
    s.arrow([(cx4, R1 + CH + 4), (cx4, R1 + CH + 28), (cx0, R1 + CH + 28), (cx0, R2 - 4)])
    step(0, R2, "Factory", "opens a PR")
    right(0, R2)
    step(1, R2, "Inspector", "review + checks")
    right(1, R2)
    step(2, R2, "merge", "on pass, squash")
    right(2, R2)
    step(3, R2, "Publisher", "deploy + smoke test")
    right(3, R2)
    state(4, R2, "live", "Publisher", "success")

    # Row 3: the fix loop, stuck, archived.
    ix = x(1) + CW / 2
    s.arrow([(ix - 20, R2 + CH + 4), (ix - 20, R3 - 4)])
    s.text("fail", ix - 30, R2 + CH + 34, MONO, 10, "muted", anchor="end")
    s.arrow([(ix + 20, R3 - 4), (ix + 20, R2 + CH + 4)])
    s.text("fix push · max 3", ix + 30, R2 + CH + 34, MONO, 10, "muted")
    step(1, R3, "Factory fix", "pushes a fix")
    right(1, R3)
    state(2, R3, "stuck", "any workflow", "brand")
    s.text("any state", x(3) + 14, R3 + CH / 2 + 5, SANS, 15, "muted")
    right(3, R3, start=x(3) + 14 + SANS.width("any state", 15) + 12)
    state(4, R3, "archived", "you")

    s.dot(M + 4.5, 438, "brand")
    s.text("needs you", M + 18, 442, SANS, 14, "muted")
    s.dot(M + 112.5, 438, "success")
    s.text("live", M + 126, 442, SANS, 14, "muted")
    s.write(OUT / f"states-{theme}.svg")


if __name__ == "__main__":
    fonts = geist_dir()
    SANS = Font(fonts / "geist-sans" / "Geist-Regular.ttf")
    MEDIUM = Font(fonts / "geist-sans" / "Geist-Medium.ttf")
    MONO = Font(fonts / "geist-mono" / "GeistMono-Regular.ttf")
    for t in THEMES:
        pipeline(t)
        states(t)
    print("wrote", ", ".join(sorted(p.name for p in OUT.glob("*.svg"))))

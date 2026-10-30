"""
Proctavo brand mark: "rooms covered". A 3x3 grid of exam rooms with the
last one ticked. Ink background, paper rooms, amber covered room.

This script is the single source for every logo and icon file. Change a colour
or a proportion here, then run it from the repo root:

    python3 brand/generate_icons.py

It needs only Pillow. It rewrites the PNGs below plus frontend/public/favicon.svg.
The web <Logo> component (frontend/src/shared/components/Logo.tsx) inlines the
same SMALL geometry. Keep it in step. App icons only reach phones in a new
native build (EAS), not an OTA update.
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent

INK = "#1b1a22"     # background
PAPER = "#f3efe6"   # rooms
AMBER = "#f2b33d"   # the covered room
WHITE = "#ffffff"   # monochrome / notification silhouettes

# Grid geometry as fractions of the canvas. MAIN is the app-icon proportion;
# SMALL is chunkier for favicons and the inline web logo, where thin gaps blur.
MAIN = {"grid": 530 / 1024, "gap": 40 / 150}
SMALL = {"grid": 0.64, "gap": 0.30, "tick": 0.20}
# Android adaptive layers: keep the grid inside the 66dp safe circle of 108dp.
ADAPTIVE = {"grid": 400 / 1024, "gap": 40 / 150}

CELL_RADIUS = 38 / 150                                # corner radius, per cell side
TICK = [(40 / 150, 80 / 150), (65 / 150, 105 / 150), (111 / 150, 50 / 150)]
TICK_WIDTH = 21 / 150                                 # per cell side; a geometry may override ("tick")
SQUIRCLE = 0.225                                     # rounded-square corner, per side
SUPERSAMPLE = 4


def cells(size, geometry):
    """Yield (x, y, side, is_covered) for the 9 rooms on a size x size canvas."""
    grid = size * geometry["grid"]
    side = grid / (3 + 2 * geometry["gap"])
    gap = side * geometry["gap"]
    origin = (size - grid) / 2
    for row in range(3):
        for col in range(3):
            yield origin + col * (side + gap), origin + row * (side + gap), side, (row, col) == (2, 2)


def draw_tick(draw, x, y, side, fill, ratio=TICK_WIDTH):
    points = [(x + px * side, y + py * side) for px, py in TICK]
    width = max(1, round(ratio * side))
    draw.line(points, fill=fill, width=width, joint="curve")
    r = width / 2
    for px, py in (points[0], points[-1]):  # round caps
        draw.ellipse([px - r, py - r, px + r, py + r], fill=fill)


def render(size, geometry, background=None, rounded=False, room=PAPER, covered=AMBER, tick=INK):
    """Draw the mark at `size` px. background=None leaves it transparent.
    tick=None knocks the tick out of the covered room (silhouettes)."""
    big = size * SUPERSAMPLE
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if background:
        if rounded:
            draw.rounded_rectangle([0, 0, big - 1, big - 1], radius=big * SQUIRCLE, fill=background)
        else:
            draw.rectangle([0, 0, big, big], fill=background)
    for x, y, side, is_covered in cells(big, geometry):
        box = [x, y, x + side, y + side]
        draw.rounded_rectangle(box, radius=side * CELL_RADIUS, fill=covered if is_covered else room)
        if is_covered:
            draw_tick(draw, x, y, side, (0, 0, 0, 0) if tick is None else tick, geometry.get("tick", TICK_WIDTH))
    return img.resize((size, size), Image.LANCZOS)


def svg_mark(viewbox=64, geometry=SMALL):
    """The rounded-square mark as SVG (favicon.svg)."""
    def n(v):
        return f"{v:.2f}".rstrip("0").rstrip(".")
    parts = [f'<rect width="{viewbox}" height="{viewbox}" rx="{n(viewbox * SQUIRCLE)}" fill="{INK}"/>']
    for x, y, side, is_covered in cells(viewbox, geometry):
        parts.append(
            f'<rect x="{n(x)}" y="{n(y)}" width="{n(side)}" height="{n(side)}" rx="{n(side * CELL_RADIUS)}" '
            f'fill="{AMBER if is_covered else PAPER}"/>'
        )
        if is_covered:
            pts = " ".join(f"{n(x + px * side)},{n(y + py * side)}" for px, py in TICK)
            parts.append(
                f'<polyline points="{pts}" fill="none" stroke="{INK}" stroke-width="{n(geometry.get('tick', TICK_WIDTH) * side)}" '
                f'stroke-linecap="round" stroke-linejoin="round"/>'
            )
    body = "\n  ".join(parts)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {viewbox} {viewbox}" width="{viewbox}" '
            f'height="{viewbox}" role="img" aria-label="Proctavo">\n  {body}\n</svg>\n')


def outputs():
    """Every generated file: path -> image."""
    full = lambda s: render(s, MAIN, background=INK)                           # stores/launchers mask it
    rounded = lambda s, g=MAIN: render(s, g, background=INK, rounded=True)   # shown as-is
    silhouette = lambda s, g: render(s, g, room=WHITE, covered=WHITE, tick=None)
    mobile = ROOT / "mobile/assets/images"
    web = ROOT / "frontend/public"
    return {
        mobile / "icon.png": full(1024),
        mobile / "android-icon-background.png": Image.new("RGBA", (1024, 1024), INK),
        mobile / "android-icon-foreground.png": render(1024, ADAPTIVE),
        mobile / "android-icon-monochrome.png": silhouette(1024, ADAPTIVE),
        mobile / "notification-icon.png": silhouette(96, {"grid": 0.84, "gap": 0.30}),
        mobile / "splash-icon.png": rounded(512),
        mobile / "logo-mark.png": rounded(512),
        mobile / "favicon.png": rounded(48, SMALL),
        web / "favicon-48.png": rounded(48, SMALL),
        web / "apple-touch-icon.png": full(180),
        web / "icon-512.png": full(512),
        ROOT / "play-store/icon-512.png": full(512),
    }


def main():
    for path, image in outputs().items():
        path.parent.mkdir(parents=True, exist_ok=True)
        image.save(path, optimize=True)
        print(f"wrote {path.relative_to(ROOT)}  {image.size[0]}x{image.size[1]}")
    favicon = ROOT / "frontend/public/favicon.svg"
    favicon.write_text(svg_mark())
    print(f"wrote {favicon.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

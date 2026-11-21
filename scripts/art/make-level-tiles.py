#!/usr/bin/env python3
"""
Per-level platform tiles for Sugar Shuffle Infinity, drawn in code (no AI or
third-party art). One sheet per level in public/game/sprites/tiles/<id>.png:

  192x96, two 96px frames, shown at the game's 48px tile size
    frame 0 = surface tile (a cell with open air above: bright top lip)
    frame 1 = fill tile    (a cell under another tile: body only)

Every tile wraps left-right so long floors read as one strip. Each top lip
has a dark ink line under a bright edge so platforms stay readable in front
of the darker level backgrounds. Collision is unchanged (the game still
uses a 48x48 static body per cell).

  python3 scripts/art/make-level-tiles.py
"""
import math, os, random
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "game", "sprites", "tiles")
S = 4
T = 96 * S  # one frame, supersampled
INK = (34, 18, 14, 255)
TOP = 26 * S  # height of the surface lip


def rgba(c, a=255):
    return tuple(c[:3]) + (a,)


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def wrap(fn, x, *args, **kw):
    """draw something at x and its copies one tile left/right (seamless)"""
    for dx in (-T, 0, T):
        fn(x + dx, *args, **kw)


# ------------------------------------------------------------------ bodies
def body_bands(d, rnd, cols, **_):
    n = len(cols)
    h = T / n
    for i, c in enumerate(cols):
        d.rectangle([0, i * h, T, (i + 1) * h], fill=rgba(c))
        d.line([(0, (i + 1) * h), (T, (i + 1) * h)], fill=rgba(mix(c, (0, 0, 0), 0.35)), width=2 * S)


def body_bricks(d, rnd, cols, mortar, rows=3, per=2, **_):
    h = T / rows
    d.rectangle([0, 0, T, T], fill=rgba(mortar))
    for r in range(rows):
        off = (T / per / 2) * (r % 2)
        w = T / per
        for k in range(-1, per + 1):
            x0 = k * w + off
            c = cols[(r + k) % len(cols)]
            d.rounded_rectangle([x0 + 2 * S, r * h + 2 * S, x0 + w - 2 * S, (r + 1) * h - 2 * S], radius=4 * S, fill=rgba(c))
            d.line([(x0 + 5 * S, r * h + 5 * S), (x0 + w - 8 * S, r * h + 5 * S)], fill=rgba(mix(c, (255, 255, 255), 0.3)), width=2 * S)


def body_planks(d, rnd, cols, nails=True, rows=3, **_):
    h = T / rows
    for r in range(rows):
        c = cols[r % len(cols)]
        d.rectangle([0, r * h, T, (r + 1) * h], fill=rgba(c))
        d.line([(0, (r + 1) * h - S), (T, (r + 1) * h - S)], fill=INK, width=2 * S)
        for _ in range(3):  # grain
            y = r * h + rnd.uniform(6, h / S - 6) * S
            x0 = rnd.uniform(0, T * 0.5)
            d.line([(x0, y), (x0 + rnd.uniform(20, 50) * S, y + rnd.uniform(-2, 2) * S)], fill=rgba(mix(c, (0, 0, 0), 0.25)), width=S)
        seam = (r * 37 % 80 + 8) * S
        d.line([(seam, r * h), (seam, (r + 1) * h)], fill=INK, width=2 * S)
        if nails:
            for nx in (seam - 6 * S, seam + 6 * S):
                d.ellipse([nx - 2 * S, r * h + h / 2 - 2 * S, nx + 2 * S, r * h + h / 2 + 2 * S], fill=(60, 60, 64, 255))


def body_blobs(d, rnd, cols, base, r=(12, 20), n=10, **_):
    d.rectangle([0, 0, T, T], fill=rgba(base))
    for i in range(n):
        x, y = rnd.uniform(0, T), rnd.uniform(0, T)
        rr = rnd.uniform(*r) * S
        c = cols[i % len(cols)]

        def blob(xx):
            d.ellipse([xx - rr, y - rr * 0.8, xx + rr, y + rr * 0.8], fill=rgba(c), outline=rgba(mix(c, (0, 0, 0), 0.4)), width=2 * S)
            d.ellipse([xx - rr * 0.6, y - rr * 0.6, xx - rr * 0.1, y - rr * 0.25], fill=rgba(mix(c, (255, 255, 255), 0.45)))
        wrap(lambda xx: blob(xx), x)


def body_speckle(d, rnd, base, chips, n=26, size=(2, 5), **_):
    d.rectangle([0, 0, T, T], fill=rgba(base))
    for i in range(n):
        x, y = rnd.uniform(0, T), rnd.uniform(0, T)
        rr = rnd.uniform(*size) * S
        c = chips[i % len(chips)]
        wrap(lambda xx: d.ellipse([xx - rr, y - rr, xx + rr, y + rr], fill=rgba(c)), x)


def body_segments(d, rnd, base, per=2, rows=2, **_):
    w, h = T / per, T / rows
    d.rectangle([0, 0, T, T], fill=rgba(mix(base, (0, 0, 0), 0.35)))
    for r in range(rows):
        for k in range(per):
            x0, y0 = k * w, r * h
            d.rectangle([x0 + 3 * S, y0 + 3 * S, x0 + w - 3 * S, y0 + h - 3 * S], fill=rgba(base))
            d.polygon([(x0 + 3 * S, y0 + 3 * S), (x0 + w - 3 * S, y0 + 3 * S), (x0 + w - 9 * S, y0 + 9 * S), (x0 + 9 * S, y0 + 9 * S)], fill=rgba(mix(base, (255, 255, 255), 0.25)))
            d.polygon([(x0 + 3 * S, y0 + h - 3 * S), (x0 + w - 3 * S, y0 + h - 3 * S), (x0 + w - 9 * S, y0 + h - 9 * S), (x0 + 9 * S, y0 + h - 9 * S)], fill=rgba(mix(base, (0, 0, 0), 0.2)))


def body_plate(d, rnd, base, rivet=(200, 200, 210), per=2, **_):
    d.rectangle([0, 0, T, T], fill=rgba(base))
    w = T / per
    for k in range(per):
        x0 = k * w
        d.rectangle([x0 + 2 * S, 2 * S, x0 + w - 2 * S, T - 2 * S], outline=rgba(mix(base, (0, 0, 0), 0.45)), width=2 * S)
        d.line([(x0 + 6 * S, 8 * S), (x0 + w - 12 * S, 8 * S)], fill=rgba(mix(base, (255, 255, 255), 0.3)), width=2 * S)
        for (rx, ry) in [(8, 14), (w / S - 8, 14), (8, 88), (w / S - 8, 88)]:
            cx, cy = x0 + rx * S, ry * S
            d.ellipse([cx - 3 * S, cy - 3 * S, cx + 3 * S, cy + 3 * S], fill=rgba(rivet), outline=INK, width=S)


def body_grid(d, rnd, base, line, cell=24, **_):
    d.rectangle([0, 0, T, T], fill=rgba(base))
    for k in range(0, 97, cell):
        d.line([(k * S, 0), (k * S, T)], fill=rgba(line), width=2 * S)
        d.line([(0, k * S), (T, k * S)], fill=rgba(line), width=2 * S)


def body_ropes(d, rnd, cols, base, **_):
    d.rectangle([0, 0, T, T], fill=rgba(base))
    for i, y in enumerate(range(10, 100, 22)):
        c = cols[i % len(cols)]
        d.rounded_rectangle([-10 * S, (y - 8) * S, T + 10 * S, (y + 8) * S], radius=8 * S, fill=rgba(c), outline=INK, width=2 * S)
        for x in range(0, 97, 12):
            d.line([((x) * S, (y - 7) * S), ((x + 8) * S, (y + 7) * S)], fill=rgba(mix(c, (255, 255, 255), 0.25)), width=2 * S)


def body_ripples(d, rnd, base, line, n=5, **_):
    d.rectangle([0, 0, T, T], fill=rgba(base))
    for k in range(n):
        y0 = (k + 0.6) * T / n
        pts = [(x * S, y0 + math.sin(x / 96 * math.pi * 4 + k) * 4 * S) for x in range(0, 97, 2)]
        d.line(pts, fill=rgba(line), width=3 * S)


def body_keys(d, rnd, base, **_):
    d.rectangle([0, 0, T, T], fill=rgba(base))
    for k in range(4):  # brass panels
        d.rectangle([k * 24 * S + 2 * S, 8 * S, k * 24 * S + 22 * S, T - 6 * S], outline=rgba(mix(base, (0, 0, 0), 0.35)), width=2 * S)
        d.ellipse([k * 24 * S + 9 * S, 46 * S, k * 24 * S + 15 * S, 52 * S], fill=(255, 240, 180, 255))


def body_static(d, rnd, cols, base, **_):
    d.rectangle([0, 0, T, T], fill=rgba(base))
    px = 6 * S
    for y in range(0, T, px):
        for x in range(0, T, px):
            if rnd.random() < 0.55:
                d.rectangle([x, y, x + px, y + px], fill=rgba(rnd.choice(cols)))


BODIES = dict(bands=body_bands, bricks=body_bricks, planks=body_planks, blobs=body_blobs, speckle=body_speckle,
              segments=body_segments, plate=body_plate, grid=body_grid, ropes=body_ropes, ripples=body_ripples,
              keys=body_keys, static=body_static)


# ------------------------------------------------------------------ tops
def top_drip(d, rnd, col, drips=True, **_):
    d.rectangle([0, 0, T, TOP - 6 * S], fill=rgba(col))
    if drips:
        for x in range(4, 96, 16):
            L = (8 + (x * 7) % 10) * S
            d.rounded_rectangle([(x) * S, TOP - 10 * S, (x + 9) * S, TOP - 10 * S + L], radius=4 * S, fill=rgba(col))
    return col


def top_grass(d, rnd, col, **_):
    d.rectangle([0, 0, T, TOP - 8 * S], fill=rgba(col))
    for x in range(0, 97, 6):
        h = (6 + (x * 5) % 7) * S
        d.polygon([(x * S, TOP - 9 * S), ((x + 6) * S, TOP - 9 * S), ((x + 3) * S, TOP - 9 * S + h)], fill=rgba(col))
    return col


def top_lumps(d, rnd, col, **_):
    d.rectangle([0, 0, T, TOP - 10 * S], fill=rgba(col))
    for x in range(0, 97, 16):
        d.ellipse([(x - 10) * S, TOP - 18 * S, (x + 10) * S, TOP - 2 * S], fill=rgba(col))
    return col


def top_flat(d, rnd, col, stripe=None, **_):
    d.rectangle([0, 0, T, TOP - 6 * S], fill=rgba(col))
    if stripe:
        for x in range(-24, 120, 24):
            d.polygon([(x * S, 6 * S), ((x + 12) * S, 6 * S), ((x + 4) * S, (TOP / S - 8) * S), ((x - 8) * S, (TOP / S - 8) * S)], fill=rgba(stripe))
    return col


def top_keys(d, rnd, col, **_):
    d.rectangle([0, 0, T, TOP - 4 * S], fill=(250, 246, 236, 255))
    for x in range(0, 97, 12):
        d.line([(x * S, 0), (x * S, TOP - 4 * S)], fill=INK, width=2 * S)
    for x in (8, 20, 44, 56, 68, 92):
        d.rectangle([(x) * S, 0, (x + 7) * S, 13 * S], fill=(30, 22, 26, 255))
    return (250, 246, 236)


TOPS = dict(drip=top_drip, grass=top_grass, lumps=top_lumps, flat=top_flat, keys=top_keys)


# ------------------------------------------------------------------ decorations
def deco(d, rnd, kind, top_only):
    y_lo = TOP + 6 * S if top_only else 8 * S
    if kind == "swirl":
        for (x, y) in [(28, 60), (74, 80)]:
            cx, cy = x * S, y * S
            for k in range(3):
                d.ellipse([cx - (9 - 3 * k) * S, cy - (9 - 3 * k) * S, cx + (9 - 3 * k) * S, cy + (9 - 3 * k) * S],
                          fill=[(255, 90, 140, 255), (255, 250, 240, 255), (120, 200, 255, 255)][k], outline=INK, width=S)
    elif kind == "raisins":
        for (x, y) in [(20, 52), (60, 70), (84, 46), (40, 86)]:
            d.ellipse([(x - 5) * S, (y - 3) * S, (x + 5) * S, (y + 3) * S], fill=(70, 30, 70, 255), outline=INK, width=S)
    elif kind == "crystals":
        for (x, y) in [(18, 58), (52, 76), (80, 54)]:
            d.polygon([(x * S, (y - 6) * S), ((x + 4) * S, y * S), (x * S, (y + 6) * S), ((x - 4) * S, y * S)], fill=(255, 255, 255, 230))
    elif kind == "chips":
        for (x, y) in [(16, 50), (44, 64), (76, 48), (60, 86), (28, 84)]:
            d.polygon([(x * S, (y - 5) * S), ((x + 5) * S, (y + 4) * S), ((x - 5) * S, (y + 4) * S)], fill=(70, 38, 22, 255))
    elif kind == "pepperoni":
        for (x, y) in [(26, 58), (72, 74)]:
            d.ellipse([(x - 10) * S, (y - 10) * S, (x + 10) * S, (y + 10) * S], fill=(196, 40, 40, 255), outline=INK, width=2 * S)
            d.ellipse([(x - 4) * S, (y - 5) * S, (x - 1) * S, (y - 2) * S], fill=(120, 20, 20, 255))
    elif kind == "seeds":
        for (x, y) in [(20, 56), (48, 72), (76, 58), (34, 88), (66, 90)]:
            d.ellipse([(x - 3) * S, (y - 5) * S, (x + 3) * S, (y + 5) * S], fill=(250, 236, 190, 255), outline=INK, width=S)
    elif kind == "gear":
        cx, cy = 70 * S, 66 * S
        for k in range(8):
            a = k * math.pi / 4
            d.line([(cx, cy), (cx + math.cos(a) * 15 * S, cy + math.sin(a) * 15 * S)], fill=(150, 150, 160, 255), width=6 * S)
        d.ellipse([cx - 11 * S, cy - 11 * S, cx + 11 * S, cy + 11 * S], fill=(150, 150, 160, 255), outline=INK, width=2 * S)
        d.ellipse([cx - 4 * S, cy - 4 * S, cx + 4 * S, cy + 4 * S], fill=(60, 60, 70, 255))
    elif kind == "notes":
        for (x, y) in [(30, 66), (66, 80)]:
            d.ellipse([(x - 5) * S, (y - 3) * S, (x + 3) * S, (y + 4) * S], fill=INK)
            d.line([((x + 2) * S, y * S), ((x + 2) * S, (y - 16) * S)], fill=INK, width=2 * S)
            d.line([((x + 2) * S, (y - 16) * S), ((x + 9) * S, (y - 11) * S)], fill=INK, width=2 * S)
    elif kind == "bones":
        for (x, y, a) in [(30, 70, 0.4), (72, 56, -0.3)]:
            dx, dy = math.cos(a) * 10, math.sin(a) * 10
            d.line([((x - dx) * S, (y - dy) * S), ((x + dx) * S, (y + dy) * S)], fill=(236, 230, 214, 255), width=4 * S)
            for sx in (-1, 1):
                ex, ey = x + sx * dx, y + sx * dy
                d.ellipse([(ex - 4) * S, (ey - 4) * S, (ex + 4) * S, (ey + 4) * S], fill=(236, 230, 214, 255))
    elif kind == "glitch":
        for _ in range(5):
            y = rnd.uniform(30, 92) * S
            x = rnd.uniform(0, 70) * S
            d.rectangle([x, y, x + rnd.uniform(10, 30) * S, y + 3 * S], fill=rnd.choice([(255, 60, 220, 255), (60, 255, 230, 255)]))
    elif kind == "circuit":
        for (x0, y0, x1, y1) in [(10, 40, 40, 40), (40, 40, 40, 70), (40, 70, 86, 70), (60, 34, 60, 54), (60, 54, 90, 54)]:
            d.line([(x0 * S, y0 * S), (x1 * S, y1 * S)], fill=(255, 210, 90, 255), width=3 * S)
        for (x, y) in [(10, 40), (86, 70), (90, 54), (60, 34)]:
            d.ellipse([(x - 4) * S, (y - 4) * S, (x + 4) * S, (y + 4) * S], fill=(255, 230, 140, 255), outline=INK, width=S)
    elif kind == "lights":
        for i, x in enumerate(range(10, 96, 20)):
            c = [(255, 140, 40), (255, 60, 60)][i % 2]
            d.ellipse([(x - 4) * S, 56 * S, (x + 4) * S, 64 * S], fill=rgba(c), outline=INK, width=S)
    elif kind == "vines":
        pts = [(x * S, (62 + math.sin(x / 10) * 8) * S) for x in range(0, 97, 2)]
        d.line(pts, fill=(60, 140, 60, 255), width=4 * S)
        for x in range(8, 96, 22):
            y = 62 + math.sin(x / 10) * 8
            d.polygon([(x * S, y * S), ((x + 6) * S, (y - 6) * S), ((x + 3) * S, (y + 4) * S)], fill=(255, 160, 40, 255), outline=INK)
    elif kind == "rot":
        for (x, y, r) in [(24, 64, 9), (70, 82, 7), (82, 50, 5)]:
            d.ellipse([(x - r) * S, (y - r * 0.7) * S, (x + r) * S, (y + r * 0.7) * S], fill=(70, 80, 30, 255))
    elif kind == "rope":
        pts = [(x * S, (TOP / S + 8 + math.sin(x / 96 * math.pi * 2) * 5) * S) for x in range(0, 97, 2)]
        d.line(pts, fill=(160, 120, 60, 255), width=5 * S)
        d.line(pts, fill=(210, 170, 100, 255), width=2 * S)


# ------------------------------------------------------------------ themes
# (body, body kwargs, top, top kwargs, decorations)
THEMES = {
    "tiles-candy-corn": ("bands", dict(cols=[(255, 214, 70), (255, 150, 40), (255, 150, 40), (250, 246, 236)]), "drip", dict(col=(86, 44, 24)), []),
    "tiles-marshmallow": ("blobs", dict(cols=[(255, 214, 228), (255, 236, 244), (250, 196, 216)], base=(226, 168, 196)), "lumps", dict(col=(214, 150, 96)), []),
    "tiles-lollipop": ("speckle", dict(base=(120, 76, 50), chips=[(90, 54, 34), (150, 98, 64)]), "grass", dict(col=(110, 220, 130)), ["swirl"]),
    "tiles-mountain": ("bricks", dict(cols=[(214, 150, 70), (196, 130, 56), (226, 166, 86)], mortar=(120, 74, 34)), "lumps", dict(col=(250, 252, 255)), []),
    "tiles-choco": ("segments", dict(base=(176, 108, 60)), "drip", dict(col=(250, 236, 210)), []),
    "tiles-desert": ("ripples", dict(base=(206, 150, 86), line=(160, 106, 56)), "lumps", dict(col=(150, 92, 44)), ["crystals"]),
    "tiles-farm": ("speckle", dict(base=(150, 96, 50), chips=[(80, 44, 22)], n=18, size=(3, 6)), "grass", dict(col=(60, 140, 40)), []),
    "tiles-boardwalk": ("planks", dict(cols=[(170, 220, 70), (150, 200, 60)]), "flat", dict(col=(120, 74, 40)), []),
    "tiles-dune": ("ripples", dict(base=(186, 112, 40), line=(140, 80, 26), n=4), "drip", dict(col=(110, 60, 24), drips=False), []),
    "tiles-outlaw": ("blobs", dict(cols=[(250, 244, 230), (236, 226, 206)], base=(200, 170, 130), r=(14, 22), n=8), "flat", dict(col=(96, 54, 26)), ["rope"]),
    "tiles-ruins": ("bricks", dict(cols=[(190, 150, 210), (170, 130, 196), (204, 166, 220)], mortar=(90, 60, 104)), "grass", dict(col=(150, 220, 120)), ["raisins"]),
    "tiles-city": ("bricks", dict(cols=[(196, 202, 214), (176, 182, 196)], mortar=(90, 94, 104), rows=4, per=3), "flat", dict(col=(220, 226, 236), stripe=(170, 176, 190)), []),
    "tiles-saloon": ("planks", dict(cols=[(206, 150, 86), (190, 134, 74), (216, 160, 96)]), "flat", dict(col=(120, 70, 36)), []),
    "tiles-tv": ("static", dict(cols=[(90, 90, 110), (50, 50, 70), (30, 30, 44)], base=(16, 16, 24)), "flat", dict(col=(240, 60, 60), stripe=(60, 200, 255)), []),
    "tiles-fake-cubro": ("segments", dict(base=(96, 50, 120)), "drip", dict(col=(150, 70, 200)), ["glitch"]),
    "tiles-landfill": ("ropes", dict(cols=[(40, 36, 44), (60, 30, 40)], base=(30, 26, 30)), "lumps", dict(col=(120, 170, 120)), []),
    "tiles-factory": ("plate", dict(base=(120, 130, 146)), "flat", dict(col=(70, 74, 84), stripe=(96, 100, 112)), ["gear"]),
    "tiles-lab": ("grid", dict(base=(220, 240, 240), line=(150, 190, 196)), "drip", dict(col=(70, 210, 190)), []),
    "tiles-music-box": ("keys", dict(base=(100, 40, 50)), "keys", dict(col=(250, 246, 236)), ["notes"]),
    "tiles-fake-cuboe": ("segments", dict(base=(236, 222, 190), per=3, rows=3), "drip", dict(col=(120, 60, 170)), ["glitch"]),
    "tiles-pizza": ("speckle", dict(base=(255, 206, 90), chips=[(255, 230, 140), (240, 170, 60)], n=20, size=(3, 7)), "lumps", dict(col=(214, 150, 70)), ["pepperoni"]),
    "tiles-bomb": ("plate", dict(base=(150, 150, 160), rivet=(255, 140, 40)), "flat", dict(col=(230, 70, 50)), ["lights"]),
    "tiles-grave": ("blobs", dict(cols=[(130, 130, 136), (110, 110, 118), (150, 150, 154)], base=(70, 56, 50), r=(10, 16), n=12), "grass", dict(col=(120, 130, 80)), ["bones"]),
    "tiles-summit": ("bricks", dict(cols=[(150, 200, 230), (130, 180, 214), (226, 176, 90)], mortar=(70, 100, 130)), "lumps", dict(col=(255, 255, 255)), ["crystals"]),
    "tiles-warlock": ("bricks", dict(cols=[(70, 40, 90), (60, 32, 80)], mortar=(30, 16, 40)), "drip", dict(col=(255, 150, 40)), ["vines"]),
    "tiles-pumpkin": ("ripples", dict(base=(230, 110, 30), line=(180, 70, 20), n=3), "drip", dict(col=(120, 90, 40)), ["seeds", "rot"]),
    "tiles-admin": ("grid", dict(base=(50, 30, 80), line=(90, 60, 140), cell=32), "flat", dict(col=(255, 210, 90), stripe=(150, 100, 210)), ["circuit"]),
}


def draw_frame(name, spec, surface):
    body, bkw, top, tkw, decos = spec
    rnd = random.Random(name)
    img = Image.new("RGBA", (T, T), (0, 0, 0, 255))
    d = ImageDraw.Draw(img)
    BODIES[body](d, rnd, **bkw)
    for k in decos:
        if k != "rope" or surface:
            deco(d, random.Random(name + k), k, surface)
    if surface:
        col = TOPS[top](d, rnd, **tkw)
        # bright edge + ink line: keeps the walkable top readable on any background
        d.rectangle([0, 0, T, 3 * S], fill=rgba(mix(col, (255, 255, 255), 0.55)))
        d.line([(0, 0), (T, 0)], fill=INK, width=2 * S)
    # soft inner shadow at the bottom so stacked rows separate a little
    sh = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([0, T - 8 * S, T, T], fill=(0, 0, 0, 60))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(3 * S)))
    return img.resize((96, 96), Image.LANCZOS).convert("RGB")


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, spec in THEMES.items():
        sheet = Image.new("RGB", (192, 96))
        sheet.paste(draw_frame(name, spec, True), (0, 0))
        sheet.paste(draw_frame(name, spec, False), (96, 0))
        sheet.save(os.path.join(OUT, f"{name}.png"), optimize=True)
    print("wrote", len(THEMES), "tile sheets to public/game/sprites/tiles/")


if __name__ == "__main__":
    main()

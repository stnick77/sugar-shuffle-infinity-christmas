#!/usr/bin/env python3
"""
Floor 470539758 (the Backrooms), drawn entirely in code. No AI or third-party
art, and no copying of any fan art: everything here is an original take on the
idea of "endless yellow office rooms" in the game's chunky cartoon style.

Writes
  public/game/bg/br-*.jpg              hub, 4 levels and the Bacteria arena (1792x1008)
  public/game/sprites/doors/door-br-*  hub doors (92x144) + door-boss-bacteria (136x184)
  public/game/sprites/tiles/tiles-br-* platform tiles (192x96: surface + fill frame)
  public/game/sprites/br-*.png          enemy sheets, 2x2 x 128px frames (feet on y=118)

Backgrounds are composed in the display space the game shows them in. These
rooms use LevelDef.bgSpan, so the picture is stretched only across the part the
parallax camera can ever see (camera width + scroll factor * (world - camera)):
  levels (80 tiles, x0.22) ~1850x800, hub (58 tiles, x0.12) ~1470x720,
  arena (40 tiles, x0.22) ~1430x800
then squashed to the usual 1792x1008 jpg, so the game puts it back in proportion.

    python3 scripts/art/make-backrooms.py
"""
from __future__ import annotations

import importlib.util
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BG = ROOT / "public/game/bg"
SPR = ROOT / "public/game/sprites"
FONT = "/usr/share/fonts/truetype/sand-box/google/Lilita One/LilitaOne-Regular.ttf"


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, HERE / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


C = _load("candy", "make-candy-cube.py")
W = _load("warlords", "make-admin-warlords.py")
D = _load("leveldoors", "make-level-doors.py")
TL = _load("leveltiles", "make-level-tiles.py")

K = 2  # supersample for backgrounds
OUT_SIZE = (1792, 1008)
INK = (28, 20, 10)

YEL = (226, 206, 120)
YEL_LIT = (246, 232, 160)
YEL_DEEP = (176, 150, 70)
CARPET = (150, 128, 70)


def S(v):
    return int(round(v * K))


def font(size):
    return ImageFont.truetype(FONT, S(size))


def new_bg(w, h, rgb):
    return Image.new("RGBA", (S(w), S(h)), rgb + (255,))


def rect(d, box, fill, outline=None, width=0):
    x0, y0, x1, y1 = box
    d.rectangle((S(x0), S(y0), S(x1), S(y1)), fill=fill, outline=outline, width=S(width) if outline else 0)


def glow(img, x, y, rx, ry, rgb, a=140, blur=0.5):
    g = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse((S(x - rx), S(y - ry), S(x + rx), S(y + ry)), fill=rgb + (a,))
    img.alpha_composite(g.filter(ImageFilter.GaussianBlur(S(min(rx, ry) * blur))))


def vgrad(img, y0, y1, top, bot, a0=255, a1=255):
    d = ImageDraw.Draw(img)
    for y in range(S(y0), S(y1)):
        t = (y - S(y0)) / max(1, S(y1) - S(y0))
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        a = int(a0 + (a1 - a0) * t)
        d.line([(0, y), (img.width, y)], fill=c + (a,))


def overlay(img, fn):
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    fn(ImageDraw.Draw(lay), lay)
    img.alpha_composite(lay)


def wallpaper(img, w, y0, y1, base, line, step=26, motif="chevron", seed=1):
    """Mono-yellow wallpaper: base colour + faint repeating pattern."""
    d = ImageDraw.Draw(img)
    rect(d, (0, y0, w, y1), base + (255,))
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    if motif == "chevron":
        for x in range(0, int(w) + step, step):
            for y in range(int(y0), int(y1) + step, step):
                ld.line([(S(x), S(y)), (S(x + step / 2), S(y + step / 3)), (S(x + step), S(y))], fill=line + (70,), width=S(1.2))
    elif motif == "stripes":
        for x in range(0, int(w) + step, step):
            ld.rectangle((S(x), S(y0), S(x + step * 0.35), S(y1)), fill=line + (45,))
            for y in range(int(y0) + 8, int(y1), step):
                ld.ellipse((S(x + step * 0.6) - S(2), S(y) - S(2), S(x + step * 0.6) + S(2), S(y) + S(2)), fill=line + (70,))
    elif motif == "diamond":
        for x in range(0, int(w) + step, step):
            for y in range(int(y0), int(y1) + step, step):
                cx, cy = x + (step / 2 if (y // step) % 2 else 0), y
                ld.polygon([(S(cx), S(cy - 5)), (S(cx + 4), S(cy)), (S(cx), S(cy + 5)), (S(cx - 4), S(cy))], fill=line + (70,))
    img.alpha_composite(lay)
    # damp stains
    rnd = random.Random(seed)
    st = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(st)
    for _ in range(int(w / 140)):
        x, y = rnd.uniform(0, w), rnd.uniform(y0, y1)
        r = rnd.uniform(20, 70)
        sd.ellipse((S(x - r), S(y - r * 0.7), S(x + r), S(y + r * 1.2)), fill=(120, 96, 30, 40))
    img.alpha_composite(st.filter(ImageFilter.GaussianBlur(S(14))))


def ceiling(img, w, y1, tile=(214, 204, 160), light=(255, 252, 220), lights_every=220, off=(), seed=2, lit_y=None):
    """Drop-ceiling grid with fluorescent panels (some dead / flickery)."""
    d = ImageDraw.Draw(img)
    rect(d, (0, 0, w, y1), tile + (255,))
    for x in range(0, int(w) + 60, 60):
        d.line([(S(x), 0), (S(x), S(y1))], fill=(170, 160, 120, 255), width=S(1.5))
    for y in range(0, int(y1), 30):
        d.line([(0, S(y)), (S(w), S(y))], fill=(170, 160, 120, 255), width=S(1.5))
    i = 0
    for x in range(40, int(w), lights_every):
        dead = i in off
        cx = x + 50
        ly = (lit_y if lit_y is not None else y1 * 0.45)
        if not dead:
            glow(img, cx, ly + 30, 160, 110, (255, 250, 200), 90, 0.6)
        d = ImageDraw.Draw(img)
        rect(d, (x, ly - 9, x + 100, ly + 9), ((120, 116, 96) if dead else light) + (255,), (130, 120, 90, 255), 1.5)
        if not dead:
            rect(d, (x + 6, ly - 4, x + 94, ly + 4), (255, 255, 245, 255))
        i += 1
    d.line([(0, S(y1)), (S(w), S(y1))], fill=(140, 120, 60, 255), width=S(3))


def carpet(img, w, y0, y1, base=CARPET, seed=3):
    d = ImageDraw.Draw(img)
    rect(d, (0, y0, w, y1), base + (255,))
    rnd = random.Random(seed)
    for _ in range(int(w * (y1 - y0) / 60)):
        x, y = rnd.uniform(0, w), rnd.uniform(y0, y1)
        c = tuple(max(0, min(255, v + rnd.randint(-18, 14))) for v in base)
        d.point((S(x), S(y)), fill=c + (255,))
    st = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(st)
    for _ in range(int(w / 90)):
        x, y = rnd.uniform(0, w), rnd.uniform(y0, y1)
        sd.ellipse((S(x - 50), S(y - 10), S(x + 50), S(y + 12)), fill=(70, 60, 30, 70))
    img.alpha_composite(st.filter(ImageFilter.GaussianBlur(S(10))))
    d = ImageDraw.Draw(img)
    rect(d, (0, y0 - 6, w, y0), (120, 100, 50, 255))  # skirting board


def doorway(img, x, y_floor, wdt, hgt, depth=3, wall=YEL, dark=(60, 50, 20)):
    """An opening in the wall showing more yellow rooms behind it (endless)."""
    d = ImageDraw.Draw(img)
    cx, cy = x + wdt / 2, y_floor - hgt * 0.42  # the rooms recede toward this point
    for k in range(depth + 1):
        sc = 0.74 ** k
        x0, x1 = cx - wdt / 2 * sc, cx + wdt / 2 * sc
        y0, y1 = cy - (cy - (y_floor - hgt)) * sc, cy + (y_floor - cy) * sc
        if k == depth:
            rect(d, (x0, y0, x1, y1), dark + (255,))
        else:
            shade = tuple(int(wall[i] * (0.8 - 0.12 * k)) for i in range(3))
            rect(d, (x0, y0, x1, y1), shade + (255,), INK + (255,), 1.2)
            # a sliver of lit ceiling inside each room
            rect(d, (x0 + 4, y0 + 2, x1 - 4, y0 + 6 * sc + 2), (255, 248, 200, 200))


def finish(img, out, dark=0.78, sat=0.9, floor_from=0.82, floor_dark=110, vignette=True):
    rgb = img.convert("RGB")
    rgb = ImageEnhance.Color(rgb).enhance(sat)
    rgb = ImageEnhance.Brightness(rgb).enhance(dark)
    w, h = rgb.size
    shade = Image.new("L", rgb.size, 0)
    sd = ImageDraw.Draw(shade)
    y0 = int(h * floor_from)
    for y in range(y0, h):
        sd.line([(0, y), (w, y)], fill=int(floor_dark * (y - y0) / max(1, h - y0)))
    if vignette:
        for x in range(int(w * 0.06)):
            a = int(80 * (1 - x / (w * 0.06)))
            sd.line([(x, 0), (x, h)], fill=a)
    shade = shade.filter(ImageFilter.GaussianBlur(S(10)))
    rgb = Image.composite(Image.new("RGB", rgb.size, (14, 10, 4)), rgb, shade)
    rgb = rgb.resize(OUT_SIZE, Image.LANCZOS)
    rgb.save(BG / out, quality=90, optimize=True)
    print("wrote", (BG / out).relative_to(ROOT))
    return rgb


# ----------------------------------------------------------------- backgrounds
def bg_hub():
    w, h = 1470, 720
    img = new_bg(w, h, YEL)
    wallpaper(img, w, 120, 600, (222, 202, 112), (160, 136, 60), motif="stripes", step=30, seed=11)
    ceiling(img, w, 120, off=(3,), seed=12)
    for x, ww in ((60, 150), (420, 130), (760, 170), (1130, 140)):
        doorway(img, x, 600, ww, 300, depth=4)
    # exit sign over the far doorway, an old water cooler and a wall clock that never moves
    d = ImageDraw.Draw(img)
    rect(d, (1160, 262, 1250, 290), (40, 120, 60, 255), INK + (255,), 2)
    d.text((S(1205), S(276)), "EXIT?", font=font(18), fill=(200, 255, 200, 255), anchor="mm")
    rect(d, (330, 470, 370, 600), (220, 224, 230, 255), INK + (255,), 2)
    d.ellipse((S(326), S(410), S(374), S(474)), fill=(150, 200, 240, 200), outline=INK + (255,), width=S(2))
    d.ellipse((S(640), S(170), S(700), S(230)), fill=(250, 248, 236, 255), outline=INK + (255,), width=S(3))
    d.line([(S(670), S(200)), (S(670), S(178))], fill=INK + (255,), width=S(2.5))
    d.line([(S(670), S(200)), (S(688), S(204))], fill=INK + (255,), width=S(2))
    carpet(img, w, 600, h, seed=13)
    finish(img, "br-hub.jpg", dark=0.86, floor_from=0.8)


def bg_level0():
    """Level 0, the Lobby: the same yellow room repeating forever."""
    w, h = 1850, 800
    img = new_bg(w, h, YEL)
    wallpaper(img, w, 150, 650, (230, 210, 110), (170, 146, 60), motif="chevron", step=28, seed=21)
    ceiling(img, w, 150, off=(2, 6), lights_every=200, seed=22)
    # pillars and endless repeating doorways
    d = ImageDraw.Draw(img)
    for i, x in enumerate(range(80, w, 300)):
        doorway(img, x, 650, 150, 330, depth=5)
        px = x + 210
        d = ImageDraw.Draw(img)
        rect(d, (px, 150, px + 44, 650), (214, 192, 100, 255), INK + (255,), 2)
        rect(d, (px + 30, 150, px + 44, 650), (186, 164, 80, 255))
    carpet(img, w, 650, h, base=(160, 140, 76), seed=23)
    finish(img, "br-level0.jpg", dark=0.82)


def bg_motion():
    """Motion: the hallways slide. Skewed walls with ghosted, smeared copies."""
    w, h = 1850, 800
    base = new_bg(w, h, YEL)
    wallpaper(base, w, 140, 650, (228, 198, 100), (160, 120, 40), motif="diamond", step=34, seed=31)
    ceiling(base, w, 140, off=(4,), lights_every=240, seed=32)
    d = ImageDraw.Draw(base)
    # skewed hallway openings (the corridors lean as they move)
    for i, x in enumerate(range(60, w, 260)):
        sk = 40 if i % 2 else -40
        poly = [(S(x), S(650)), (S(x + 150), S(650)), (S(x + 150 + sk), S(330)), (S(x + sk), S(330))]
        d.polygon(poly, fill=(150, 120, 50, 255), outline=INK + (255,), width=S(2))
        inner = [(S(x + 30), S(650)), (S(x + 120), S(650)), (S(x + 120 + sk * 0.8), S(400)), (S(x + 30 + sk * 0.8), S(400))]
        d.polygon(inner, fill=(70, 56, 20, 255))
    carpet(base, w, 650, h, base=(146, 112, 60), seed=33)
    # motion smear: offset ghost copies + speed lines
    ghost = base.copy()
    img = base.copy()
    for k, (dx, a) in enumerate(((S(26), 70), (S(58), 40))):
        g = ImageChops.offset(ghost, dx, 0)
        g.putalpha(a)
        img.alpha_composite(g)
    d = ImageDraw.Draw(img)
    rnd = random.Random(34)
    for _ in range(60):
        y = rnd.uniform(170, 640)
        x = rnd.uniform(0, w)
        d.line([(S(x), S(y)), (S(x + rnd.uniform(60, 180)), S(y))], fill=(255, 250, 220, 90), width=S(1.5))
    # sliding arrows painted on the wall
    for x in range(140, w, 380):
        for k in range(3):
            xx = x + k * 26
            d.polygon([(S(xx), S(250)), (S(xx + 16), S(266)), (S(xx), S(282)), (S(xx + 6), S(266))], fill=(120, 80, 20, 200))
    finish(img, "br-motion.jpg", dark=0.8)


def bg_pool():
    """Pool Rooms: white tiles, pale water, bright soft light."""
    w, h = 1850, 800
    img = new_bg(w, h, (236, 242, 244))
    d = ImageDraw.Draw(img)
    # tiled walls
    for x in range(0, w, 24):
        d.line([(S(x), 0), (S(x), S(h))], fill=(196, 210, 214, 255), width=S(1))
    for y in range(0, h, 24):
        d.line([(0, S(y)), (S(w), S(y))], fill=(196, 210, 214, 255), width=S(1))
    # arches and pillars receding
    for i, x in enumerate(range(40, w, 280)):
        aw, ah = 190, 360
        top = 640 - ah
        d.rectangle((S(x), S(top + aw / 2), S(x + aw), S(640)), fill=(178, 214, 224, 255))
        d.ellipse((S(x), S(top), S(x + aw), S(top + aw)), fill=(178, 214, 224, 255))
        d.rectangle((S(x + 30), S(top + aw / 2 + 40), S(x + aw - 30), S(640)), fill=(150, 196, 214, 255))
        d.ellipse((S(x + 30), S(top + 40), S(x + aw - 30), S(top + aw - 20)), fill=(150, 196, 214, 255))
        d.arc((S(x), S(top), S(x + aw), S(top + aw)), 180, 360, fill=(120, 150, 160, 255), width=S(3))
        px = x + 225
        d.rectangle((S(px), S(120), S(px + 30), S(640)), fill=(250, 252, 252, 255), outline=(170, 190, 196, 255), width=S(2))
    # skylights
    for x in range(120, w, 340):
        glow(img, x + 60, 60, 200, 120, (255, 255, 255), 160, 0.5)
        d = ImageDraw.Draw(img)
        d.rectangle((S(x), S(10), S(x + 120), S(70)), fill=(255, 255, 250, 255), outline=(170, 190, 196, 255), width=S(2))
    # pool water band with ripples and reflections
    vgrad(img, 600, h, (120, 200, 226), (70, 150, 190))
    d = ImageDraw.Draw(img)
    rnd = random.Random(41)
    for _ in range(140):
        x, y = rnd.uniform(0, w), rnd.uniform(606, h)
        d.arc((S(x - 30), S(y - 4), S(x + 30), S(y + 4)), 200, 340, fill=(220, 246, 255, 160), width=S(1.4))
    finish(img, "br-pool.jpg", dark=0.86, sat=0.95, floor_dark=90)


def bg_cave():
    """Cave System: dark rocky caves, dim lamps, stalactites."""
    w, h = 1850, 800
    img = new_bg(w, h, (34, 30, 36))
    rnd = random.Random(51)
    # layered rock walls
    for layer, (col, amp, base) in enumerate((((48, 42, 50), 60, 280), ((60, 52, 58), 50, 380), ((72, 62, 64), 40, 470))):
        d = ImageDraw.Draw(img)
        pts = [(0, S(h))]
        for x in range(0, w + 40, 40):
            pts.append((S(x), S(base + math.sin(x / 90 + layer) * amp * 0.5 + rnd.uniform(-amp, amp) * 0.4)))
        pts.append((S(w), S(h)))
        d.polygon(pts, fill=col + (255,))
    # ceiling with stalactites
    d = ImageDraw.Draw(img)
    pts = [(0, 0)]
    for x in range(0, w + 30, 30):
        pts.append((S(x), S(70 + rnd.uniform(-15, 25))))
    pts.append((S(w), 0))
    d.polygon(pts, fill=(22, 18, 24, 255))
    for _ in range(46):
        x = rnd.uniform(0, w)
        L = rnd.uniform(40, 150)
        wd = rnd.uniform(10, 26)
        d.polygon([(S(x - wd), S(70)), (S(x + wd), S(70)), (S(x), S(70 + L))], fill=(58, 50, 60, 255), outline=(14, 10, 16, 255))
        d.line([(S(x - wd * 0.6), S(72)), (S(x), S(70 + L))], fill=(70, 62, 70, 255), width=S(1.4))
    # dim yellow work lamps strung along a cable (the backrooms leaking in)
    cable = [(S(x), S(150 + math.sin(x / 160) * 30)) for x in range(0, w + 10, 10)]
    d.line(cable, fill=(14, 12, 14, 255), width=S(2))
    for x in range(110, w, 300):
        y = 150 + math.sin(x / 160) * 30
        glow(img, x, y + 20, 130, 110, (255, 200, 90), 110, 0.55)
        d = ImageDraw.Draw(img)
        d.polygon([(S(x - 10), S(y + 4)), (S(x + 10), S(y + 4)), (S(x + 6), S(y + 22)), (S(x - 6), S(y + 22))], fill=(60, 54, 40, 255))
        d.ellipse((S(x - 6), S(y + 16), S(x + 6), S(y + 28)), fill=(255, 226, 140, 255))
    # crystals catching lamp light
    for _ in range(18):
        x, y = rnd.uniform(0, w), rnd.uniform(420, 640)
        s = rnd.uniform(6, 14)
        d.polygon([(S(x), S(y - s * 2)), (S(x + s), S(y)), (S(x), S(y + s * 0.6)), (S(x - s), S(y))], fill=(120, 180, 200, 180))
    finish(img, "br-cave.jpg", dark=0.9, sat=0.9, floor_from=0.75, floor_dark=130)


def bg_escape():
    """The escape chase after Bacteria: one endless hallway, lights gone red, an EXIT far ahead."""
    w, h = 1850, 800
    img = new_bg(w, h, (150, 40, 30))
    wallpaper(img, w, 150, 650, (196, 92, 70), (120, 34, 30), motif="stripes", step=24, seed=81)
    ceiling(img, w, 150, tile=(150, 90, 80), light=(255, 120, 100), lights_every=180, off=(1, 4, 7), seed=82)
    d = ImageDraw.Draw(img)
    # a long corridor vanishing to a point, repeated down the hall
    for x in range(40, w, 360):
        doorway(img, x, 650, 220, 380, depth=6, wall=(200, 96, 74), dark=(40, 6, 8))
    # the far-off EXIT sign glowing at the end of the hall
    glow(img, w - 170, 240, 120, 60, (255, 230, 160), a=120)
    rect(d, (w - 230, 220, w - 110, 262), (40, 140, 70, 255), INK + (255,), 3)
    d.text((S(w - 170), S(241)), "EXIT", font=font(26), fill=(220, 255, 220, 255), anchor="mm")
    carpet(img, w, 650, h, base=(120, 40, 34), seed=83)
    overlay(img, lambda od, _lay: od.rectangle((0, 0, S(w), S(h)), fill=(255, 30, 20, 40)))
    finish(img, "br-escape.jpg", dark=0.8)


def bg_heaven():
    """Past the escape door: a bright white-and-gold room of clouds, mist and light rays."""
    w, h = 1470, 800
    img = new_bg(w, h, (255, 250, 236))
    vgrad(img, 0, h, (255, 255, 250), (255, 226, 150))
    rnd = random.Random(91)
    # light rays fanning down from above
    def rays(od, _lay):
        for i in range(9):
            x = 120 + i * 160 + rnd.uniform(-30, 30)
            spread = rnd.uniform(70, 130)
            od.polygon([(S(x - 18), 0), (S(x + 18), 0), (S(x + spread), S(h)), (S(x - spread), S(h))], fill=(255, 244, 190, 46))
    lay = Image.new("RGBA", img.size, (255, 255, 255, 0))
    rays(ImageDraw.Draw(lay), lay)
    img.alpha_composite(lay.filter(ImageFilter.GaussianBlur(S(10))))
    # a big soft glow behind where the ESCAPE door stands
    glow(img, w / 2, 430, 360, 300, (255, 236, 170), 150, 0.5)
    # clouds: puffy clusters, a far layer and a near layer
    for layer, (y0, y1, a, sc) in enumerate(((180, 420, 150, 0.7), (560, 700, 235, 1.0))):
        cl = Image.new("RGBA", img.size, (255, 255, 255, 0))
        cd = ImageDraw.Draw(cl)
        for _ in range(16 if layer == 0 else 12):
            cx, cy = rnd.uniform(-40, w + 40), rnd.uniform(y0, y1)
            for _ in range(6):
                r = rnd.uniform(40, 90) * sc
                ox, oy = rnd.uniform(-90, 90) * sc, rnd.uniform(-24, 12) * sc
                cd.ellipse((S(cx + ox - r), S(cy + oy - r * 0.7), S(cx + ox + r), S(cy + oy + r * 0.7)), fill=(255, 255, 255, a))
        img.alpha_composite(cl.filter(ImageFilter.GaussianBlur(S(4 if layer else 8))))
    # glowing mist along the floor and a few sparkles
    glow(img, w / 2, 720, w * 0.7, 90, (255, 255, 255), 170, 0.6)
    d = ImageDraw.Draw(img)
    for _ in range(70):
        x, y, r = rnd.uniform(0, w), rnd.uniform(40, 600), rnd.uniform(1, 3)
        d.ellipse((S(x - r), S(y - r), S(x + r), S(y + r)), fill=(255, 240, 180, 220))
    finish(img, "br-heaven.jpg", dark=1.0, sat=1.0, floor_from=0.95, floor_dark=20, vignette=False)


def bg_bacteria():
    """Bacteria's room: a dying-light office, black mould crawling up the walls."""
    w, h = 1430, 800
    img = new_bg(w, h, YEL)
    wallpaper(img, w, 140, 650, (190, 168, 86), (120, 100, 40), motif="stripes", step=40, seed=61)
    ceiling(img, w, 140, off=(0, 2, 4, 5), lights_every=260, seed=62)
    # mould veins
    rnd = random.Random(63)
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    for _ in range(26):
        x, y = rnd.uniform(0, w), 650
        pts = [(S(x), S(y))]
        for _ in range(rnd.randint(8, 16)):
            x += rnd.uniform(-26, 26)
            y -= rnd.uniform(14, 34)
            pts.append((S(x), S(y)))
        ld.line(pts, fill=(16, 12, 10, 200), width=S(rnd.uniform(2, 5)), joint="curve")
        for (px, py) in pts[2::3]:
            r = rnd.uniform(3, 8)
            ld.ellipse((px - S(r), py - S(r), px + S(r), py + S(r)), fill=(16, 12, 10, 190))
    img.alpha_composite(lay)
    # one flickering panel lit, a big shadow on the wall
    glow(img, 715, 420, 300, 230, (20, 14, 10), 140, 0.6)
    carpet(img, w, 650, h, base=(110, 92, 50), seed=64)
    # vignette darker (dim room)
    v = Image.new("RGBA", img.size, (0, 0, 0, 0))
    vd = ImageDraw.Draw(v)
    vd.ellipse((S(-300), S(-200), S(w + 300), S(h + 300)), fill=(0, 0, 0, 0))
    finish(img, "br-bacteria.jpg", dark=0.62, sat=0.8, floor_from=0.78, floor_dark=140)


# ----------------------------------------------------------------- doors
DW_, DH_ = D.W, D.H


def door_frame(fr_top, fr_bot, panel_top, panel_bot):
    img = D.canvas(DW_, DH_)
    fr = D.rect_poly(8, 10, 84, 142)
    D.fillpoly(img, fr, fr_top, fr_bot)
    pn = D.rect_poly(18, 22, 74, 140)
    D.fillpoly(img, pn, panel_top, panel_bot, 3)
    return img, ImageDraw.Draw(img)


def door_br_exit():
    """Hub exit back to Floor 5: a plain office door with a green EXIT sign."""
    img, d = door_frame((214, 196, 120), (170, 150, 80), (196, 170, 96), (160, 136, 70))
    d.rectangle(D.P(24, 26, 68, 40), fill=(40, 140, 70, 255), outline=D.INK, width=2 * D.S)
    D.text(d, (46, 33), "EXIT", 10, (220, 255, 220, 255))
    d.rectangle(D.P(32, 56, 60, 82), fill=(150, 200, 230, 255), outline=D.INK, width=2 * D.S)
    D.knob(d, 64, 96)
    return img


def door_br_noclip():
    """Floor 5 shortcut back down: a glitchy yellow tear in reality."""
    img = D.canvas(DW_, DH_)
    d = ImageDraw.Draw(img)
    rnd = random.Random(470539758)
    pts = []
    for i in range(14):
        a = math.pi * 2 * i / 14
        r = (30 if i % 2 else 40) + rnd.uniform(-4, 4)
        pts.append(((46 + math.cos(a) * r * 0.85) * D.S, (80 + math.sin(a) * r * 1.5) * D.S))
    d.polygon(pts, fill=(230, 210, 110, 255), outline=D.INK, width=4 * D.S)
    inner = [(46 * D.S + (x - 46 * D.S) * 0.6, 80 * D.S + (y - 80 * D.S) * 0.6) for x, y in pts]
    d.polygon(inner, fill=(250, 240, 170, 255))
    for _ in range(9):
        y = rnd.uniform(30, 130)
        x = rnd.uniform(8, 60)
        d.rectangle(D.P(x, y, x + rnd.uniform(10, 26), y + 3), fill=rnd.choice([(255, 240, 120, 255), (120, 100, 40, 255), (255, 255, 255, 255)]))
    D.text(d, (46, 82), "???", 16, (120, 96, 30, 255), stroke=(255, 250, 220, 255))
    return img


def door_br_level0():
    img, d = door_frame((236, 216, 120), (200, 176, 90), (226, 204, 110), (190, 166, 80))
    for y in range(28, 138, 10):  # chevron wallpaper on the door
        for x in range(22, 72, 12):
            d.line(D.P(x, y, x + 6, y + 4, x + 12, y), fill=(170, 146, 60, 255), width=D.S)
    d.rectangle(D.P(28, 34, 64, 46), fill=(255, 252, 220, 255), outline=D.INK, width=2 * D.S)  # a light panel
    D.text(d, (46, 100), "0", 26, (255, 246, 200, 255))
    D.knob(d, 64, 96)
    return img


def door_br_motion():
    img, d = door_frame((210, 176, 90), (170, 130, 60), (196, 160, 80), (156, 120, 50))
    for k in range(3):  # sliding arrows
        x = 26 + k * 14
        d.polygon(D.P(x, 60, x + 12, 72, x, 84, x + 5, 72), fill=(110, 70, 20, 255))
    for y in (100, 112, 124):  # conveyor stripes
        d.line(D.P(20, y, 72, y), fill=(40, 30, 14, 255), width=3 * D.S)
        for x in range(22, 72, 10):
            d.line(D.P(x, y - 4, x + 5, y, x, y + 4), fill=(250, 210, 80, 255), width=D.S)
    D.knob(d, 64, 92)
    return img


def door_br_pool():
    img, d = door_frame((250, 252, 252), (210, 226, 230), (236, 246, 248), (200, 222, 228))
    for x in range(18, 76, 9):
        d.line(D.P(x, 22, x, 140), fill=(180, 200, 206, 255), width=D.S)
    for y in range(22, 140, 9):
        d.line(D.P(18, y, 74, y), fill=(180, 200, 206, 255), width=D.S)
    d.rectangle(D.P(18, 104, 74, 140), fill=(110, 190, 220, 255))  # water up the door
    for x in (28, 50):
        d.arc(D.P(x - 8, 100, x + 8, 108), 200, 340, fill=(230, 250, 255, 255), width=2 * D.S)
    d.ellipse(D.P(36, 46, 56, 66), fill=(255, 255, 250, 255), outline=D.INK, width=2 * D.S)  # porthole light
    return img


def door_br_cave():
    img = D.canvas(DW_, DH_)
    fr = D.arch(6, 14, 86, 142, 36)
    D.fillpoly(img, fr, (96, 86, 90), (60, 52, 58))
    pn = D.arch(20, 34, 72, 142, 24)
    D.fillpoly(img, pn, (24, 20, 26), (10, 8, 12), 3)
    d = ImageDraw.Draw(img)
    for x, L in ((26, 18), (38, 12), (52, 20), (64, 10)):
        d.polygon(D.P(x - 4, 40, x + 4, 40, x, 40 + L), fill=(110, 100, 104, 255), outline=D.INK)
    d.ellipse(D.P(40, 80, 52, 92), fill=(255, 210, 110, 255))  # a lamp glimmer deep inside
    return img


def door_br_escape():
    """The escape's exit: a red emergency door with a running-man sign."""
    img, d = door_frame((200, 70, 60), (140, 40, 36), (186, 60, 50), (130, 34, 30))
    d.rectangle(D.P(22, 26, 70, 44), fill=(40, 140, 70, 255), outline=D.INK, width=2 * D.S)
    D.text(d, (46, 35), "RUN", 11, (220, 255, 220, 255))
    d.rectangle(D.P(20, 92, 72, 100), fill=(230, 220, 210, 255), outline=D.INK, width=2 * D.S)
    D.knob(d, 64, 80)
    return img


def door_br_heaven():
    """The way out at last: a big white door with a gold frame, labelled ESCAPE."""
    img, d = door_frame((255, 222, 120), (214, 160, 50), (255, 255, 255), (232, 232, 238))
    d.rectangle(D.P(22, 28, 70, 44), fill=(255, 236, 160, 255), outline=(170, 120, 30, 255), width=2 * D.S)
    D.text(d, (46, 36), "ESCAPE", 9, (120, 80, 10, 255))
    d.rounded_rectangle(D.P(26, 54, 66, 92), 4 * D.S, outline=(210, 210, 220, 255), width=2 * D.S)
    d.rounded_rectangle(D.P(26, 100, 66, 134), 4 * D.S, outline=(210, 210, 220, 255), width=2 * D.S)
    D.knob(d, 64, 96)
    return img


def door_boss_bacteria():
    img = D.canvas(D.BW, D.BH)
    d = D.boss_frame(img, (70, 60, 40), (30, 24, 16), (60, 50, 30), (14, 10, 8))
    rnd = random.Random(9)
    for _ in range(10):  # mould veins over the door
        x, y = rnd.uniform(30, 106), 170
        pts = [(x * D.S, y * D.S)]
        for _ in range(8):
            x += rnd.uniform(-8, 8)
            y -= rnd.uniform(8, 16)
            pts.append((x * D.S, y * D.S))
        d.line(pts, fill=(10, 8, 6, 255), width=3 * D.S, joint="curve")
    # tall thin silhouette peeking, two small eyes
    d.rounded_rectangle(D.P(60, 56, 76, 150), 6 * D.S, fill=(8, 6, 6, 255))
    d.ellipse(D.P(56, 40, 80, 70), fill=(8, 6, 6, 255))
    d.ellipse(D.P(61, 52, 66, 57), fill=(255, 250, 220, 255))
    d.ellipse(D.P(70, 52, 75, 57), fill=(255, 250, 220, 255))
    d.line(D.P(60, 80, 40, 120, 36, 150), fill=(8, 6, 6, 255), width=4 * D.S)
    d.line(D.P(76, 80, 96, 120, 100, 150), fill=(8, 6, 6, 255), width=4 * D.S)
    return img


# ----------------------------------------------------------------- tiles
def tile_specs():
    return {
        "tiles-br-hub": ("speckle", dict(base=(150, 128, 70), chips=[(120, 100, 50), (170, 150, 90)], n=40, size=(1, 3)), "flat", dict(col=(196, 170, 96)), []),
        "tiles-br-level0": ("speckle", dict(base=(176, 154, 84), chips=[(140, 120, 60), (196, 176, 106)], n=44, size=(1, 3)), "flat", dict(col=(230, 212, 120)), []),
        "tiles-br-motion": ("plate", dict(base=(190, 160, 70), rivet=(80, 60, 20)), "flat", dict(col=(120, 96, 40)), []),
        "tiles-br-pool": ("grid", dict(base=(244, 248, 248), line=(176, 200, 206), cell=24), "flat", dict(col=(255, 255, 255)), []),
        "tiles-br-cave": ("blobs", dict(cols=[(70, 62, 68), (84, 74, 78), (60, 52, 58)], base=(40, 34, 40), r=(10, 18), n=12), "lumps", dict(col=(110, 100, 104)), ["crystals"]),
        "tiles-br-bacteria": ("speckle", dict(base=(96, 80, 44), chips=[(30, 24, 16), (60, 50, 30)], n=36, size=(2, 5)), "drip", dict(col=(24, 18, 12)), []),
        "tiles-br-heaven": ("blobs", dict(cols=[(255, 255, 255), (250, 246, 236), (255, 240, 200)], base=(244, 226, 170), r=(10, 18), n=12), "lumps", dict(col=(255, 255, 255)), []),
        "tiles-br-escape": ("speckle", dict(base=(120, 36, 30), chips=[(80, 20, 18), (160, 60, 50)], n=40, size=(1, 3)), "flat", dict(col=(200, 80, 64)), []),
    }


def make_tiles():
    out = SPR / "tiles"
    for name, spec in tile_specs().items():
        sheet = Image.new("RGB", (192, 96))
        sheet.paste(TL.draw_frame(name, spec, True), (0, 0))
        sheet.paste(TL.draw_frame(name, spec, False), (96, 0))
        sheet.save(out / f"{name}.png", optimize=True)
        print("wrote", (out / f"{name}.png").relative_to(ROOT))


# ----------------------------------------------------------------- enemies
Sx, px = C.S, C.px
part, inner, path_mask, poly_mask = W.part, W.inner, W.path_mask, W.poly_mask
ellipse_mask, capsule_mask, union, subtract = C.ellipse_mask, C.capsule_mask, C.union, C.subtract
rounded_rect_mask, blit_color, dilate = C.rounded_rect_mask, C.blit_color, C.dilate


def eyes(img, x, y, r, col=(255, 250, 220), pupil=(20, 14, 10), glowc=None, dx=0.0):
    for ex in (x - r * 1.5, x + r * 1.5):
        if glowc:
            W.glow(img, ex, y, r * 2.2, glowc, 0.5)
        blit_color(img, dilate(ellipse_mask((ex - r, y - r, ex + r, y + r)), 0.8), INK)
        blit_color(img, ellipse_mask((ex - r, y - r, ex + r, y + r)), col)
        blit_color(img, ellipse_mask((ex - r * 0.45 + dx, y - r * 0.4, ex + r * 0.45 + dx, y + r * 0.5)), pupil)


def mob_moth(f):
    """Hub: a harmless fluorescent moth that flutters round the lights."""
    img = C.canvas()
    flap = [1.0, 0.55, 0.15, 0.55][f]
    y = 70 + [0, -2, -3, -1][f]
    for side in (-1, 1):
        wing = ellipse_mask((64 - 2 + side * 2 - (side < 0) * 30 * 1, y - 26 * flap - 4, 64 + side * 2 + (side > 0) * 30, y + 6))
        wing = poly_mask([(64, y - 2), (64 + side * 34, y - 30 * flap - 6), (64 + side * 40, y - 8), (64 + side * 26, y + 12)])
        part(img, wing, (250, 244, 200), outline=1.8)
        inner(img, ellipse_mask((64 + side * 24 - 4, y - 14 * flap - 4, 64 + side * 24 + 4, y - 14 * flap + 4)), (230, 200, 90))
    part(img, rounded_rect_mask((58, y - 16, 70, y + 26), 6), (196, 176, 120), outline=1.8)
    for side in (-1, 1):
        W.limb(img, [(62 + side * 2, y - 16), (60 + side * 9, y - 30)], 0.9, INK[:3])
    eyes(img, 64, y - 8, 2.6)
    # it never lands: the sheet's feet line is the tip of its body
    blit_color(img, ellipse_mask((62, C.BOTTOM - 2, 66, C.BOTTOM)), (196, 176, 120))
    return img


def mob_smiler(f):
    """Level 0: a floating shadow blob with a big (friendly-ish) toothy grin."""
    img = C.canvas()
    bob = [0, -2, -3, -1][f]
    y = 76 + bob
    W.glow(img, 64, y, 40, (20, 16, 8), 0.7)
    blob = union(ellipse_mask((34, y - 30, 94, y + 26)), *(ellipse_mask((30 + i * 14 + f % 2 * 2, y + 14, 44 + i * 14, y + 36 - (i % 2) * 6)) for i in range(5)))
    part(img, blob, (30, 24, 20), outline=2.0)
    # big grin
    grin = poly_mask([(42, y + 2), (86, y + 2), (78, y + 14), (64, y + 18), (50, y + 14)])
    blit_color(img, grin, (250, 246, 220))
    d = ImageDraw.Draw(img)
    for k in range(1, 6):
        x = 42 + k * 44 / 6
        d.line([(px(x), px(y + 2)), (px(x), px(y + 16))], fill=INK, width=px(0.8))
    d.line([(px(42), px(y + 8)), (px(86), px(y + 8))], fill=INK, width=px(0.8))
    eyes(img, 64, y - 12, 4.2, col=(255, 250, 220), pupil=(255, 250, 220), glowc=(255, 240, 160))
    blit_color(img, ellipse_mask((60, C.BOTTOM - 3, 68, C.BOTTOM)), (30, 24, 20))
    return img


def mob_chair(f):
    """Motion: a runaway office chair with googly eyes that rolls back and forth."""
    img = C.canvas()
    spin = f * 0.4
    for k in range(5):  # wheels
        a = spin + k * math.pi * 2 / 5
        wx = 64 + math.cos(a) * 18
        part(img, ellipse_mask((wx - 4.5, C.BOTTOM - 9, wx + 4.5, C.BOTTOM)), (40, 40, 46), outline=1.4, sheen=False)
    W.limb(img, [(46, 104), (82, 104)], 2.2, (70, 70, 80))
    W.limb(img, [(64, 104), (64, 86)], 2.6, (90, 90, 100))
    part(img, rounded_rect_mask((40, 76, 88, 90), 5), (196, 150, 60), outline=2.0)  # seat
    part(img, rounded_rect_mask((44, 36, 84, 78), 9), (210, 170, 70), outline=2.0)  # backrest
    inner(img, rounded_rect_mask((50, 42, 78, 72), 6), (226, 190, 90))
    for side in (-1, 1):
        part(img, rounded_rect_mask((64 + side * 26 - 4, 66, 64 + side * 26 + 4, 82), 3), (70, 70, 80), outline=1.4, sheen=False)
    eyes(img, 64 + (f % 2), 54, 5.5, dx=1.5 if f < 2 else -1.5)
    return img


def mob_duck(f):
    """Pool Rooms: a lost pool floatie duck that hops along the tiles."""
    img = C.canvas()
    hop = [0, -5, -8, -3][f]
    y = hop
    part(img, ellipse_mask((36, 76 + y, 92, 112 + y)), (255, 214, 60), outline=2.0)  # body
    part(img, poly_mask([(36, 90 + y), (26, 78 + y), (40, 84 + y)]), (255, 214, 60), outline=1.6)  # tail
    part(img, ellipse_mask((60, 46 + y, 92, 80 + y)), (255, 222, 80), outline=2.0)  # head
    part(img, poly_mask([(88, 62 + y), (104, 64 + y), (88, 70 + y)]), (255, 140, 40), outline=1.6)  # beak
    inner(img, ellipse_mask((44, 84 + y, 70, 100 + y)), (240, 190, 40))  # wing
    blit_color(img, rounded_rect_mask((34, 98 + y, 94, 104 + y), 2), (80, 180, 220))  # swim ring stripe
    eyes(img, 76, 58 + y, 3.4, dx=1)
    # feet (planted)
    for fx in (54, 70):
        part(img, poly_mask([(fx - 5, C.BOTTOM), (fx + 7, C.BOTTOM), (fx + 1, C.BOTTOM - 8)]), (255, 140, 40), outline=1.2, sheen=False)
    return img


def mob_hound(f):
    """Cave System: a shaggy shadow hound, more spooky than scary."""
    img = C.canvas()
    step = [0, 1, 0, -1][f]
    for i, lx in enumerate((42, 52, 76, 86)):
        s = step if i % 2 else -step
        W.limb(img, [(lx, 92), (lx + s * 3, 112)], 3.0, (30, 26, 34))
    body = union(ellipse_mask((34, 70, 94, 100)), poly_mask([(36, 76), (30, 64), (42, 72)]))
    part(img, body, (40, 34, 46), outline=2.0)
    d = ImageDraw.Draw(img)
    for x in range(40, 92, 6):  # shaggy fur tufts
        d.line([(px(x), px(72)), (px(x + 3), px(64))], fill=(60, 52, 66, 255), width=px(1.2))
    head = ellipse_mask((78, 56, 106, 84))
    part(img, head, (40, 34, 46), outline=2.0)
    for ex in (88, 98):
        W.glow(img, ex, 68, 4.2, (255, 220, 120), 0.6)
        blit_color(img, ellipse_mask((ex - 2.4, 66, ex + 2.4, 70.5)), (255, 236, 170))
    part(img, poly_mask([(80, 58), (84, 46), (88, 58)]), (40, 34, 46), outline=1.4, sheen=False)  # ears
    part(img, poly_mask([(92, 58), (96, 46), (100, 58)]), (40, 34, 46), outline=1.4, sheen=False)
    return img


def mob_spore(f):
    """Bacteria's minions: small black spore puffs with a single sleepy eye."""
    img = C.canvas()
    squash = [0, 2, 3, 1][f]
    y = 0
    blob = ellipse_mask((40 - squash, 70 + squash, 88 + squash, C.BOTTOM))
    part(img, blob, (24, 22, 20), outline=2.0)
    d = ImageDraw.Draw(img)
    for k in range(9):
        a = math.pi + k * math.pi / 8
        x, yy = 64 + math.cos(a) * 26, 96 + math.sin(a) * 26
        d.line([(px(64 + math.cos(a) * 20), px(96 + math.sin(a) * 20)), (px(x), px(yy))], fill=(24, 22, 20, 255), width=px(2))
        d.ellipse((px(x - 2), px(yy - 2), px(x + 2), px(yy + 2)), fill=(60, 56, 50, 255))
    blit_color(img, ellipse_mask((56, 88, 72, 100)), (250, 246, 220))
    blit_color(img, ellipse_mask((61, 92 + squash * 0.3, 67, 98)), (20, 14, 10))
    blit_color(img, rounded_rect_mask((55, 86, 73, 91 + squash), 1), (24, 22, 20))  # sleepy lid
    return img


ENEMIES = {
    "br-moth": mob_moth,
    "br-smiler": mob_smiler,
    "br-chair": mob_chair,
    "br-duck": mob_duck,
    "br-hound": mob_hound,
    "br-spore": mob_spore,
}


def make_enemies():
    for name, fn in ENEMIES.items():
        W.make_sheet([fn(f) for f in range(4)], SPR / f"{name}.png")


DOORS = {
    "door-br-exit": door_br_exit, "door-br-noclip": door_br_noclip, "door-br-level0": door_br_level0,
    "door-br-motion": door_br_motion, "door-br-pool": door_br_pool, "door-br-cave": door_br_cave,
    "door-br-escape": door_br_escape,
    "door-br-heaven": door_br_heaven,
}


def make_doors():
    for name, fn in DOORS.items():
        D.save(fn(), DW_, DH_, name)
    D.save(door_boss_bacteria(), D.BW, D.BH, "door-boss-bacteria")
    print("wrote", len(DOORS) + 1, "Backrooms doors")


def main():
    import sys
    if sys.argv[1:] == ["heaven"]:
        D.save(door_br_heaven(), DW_, DH_, "door-br-heaven")
        spec = tile_specs()["tiles-br-heaven"]
        sheet = Image.new("RGB", (192, 96))
        sheet.paste(TL.draw_frame("tiles-br-heaven", spec, True), (0, 0))
        sheet.paste(TL.draw_frame("tiles-br-heaven", spec, False), (96, 0))
        sheet.save(SPR / "tiles" / "tiles-br-heaven.png", optimize=True)
        bg_heaven()
        return
    if sys.argv[1:] == ["escape"]:
        # just the escape chase assets (added later; leaves the others untouched)
        D.save(door_br_escape(), DW_, DH_, "door-br-escape")
        spec = tile_specs()["tiles-br-escape"]
        sheet = Image.new("RGB", (192, 96))
        sheet.paste(TL.draw_frame("tiles-br-escape", spec, True), (0, 0))
        sheet.paste(TL.draw_frame("tiles-br-escape", spec, False), (96, 0))
        sheet.save(SPR / "tiles" / "tiles-br-escape.png", optimize=True)
        bg_escape()
        return
    make_doors()
    make_tiles()
    make_enemies()
    bg_hub()
    bg_level0()
    bg_motion()
    bg_pool()
    bg_cave()
    bg_bacteria()
    bg_escape()
    bg_heaven()


if __name__ == "__main__":
    main()

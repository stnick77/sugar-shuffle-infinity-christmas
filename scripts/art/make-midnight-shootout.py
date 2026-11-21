#!/usr/bin/env python3
"""Midnight western shootout background for the Marshmallow Outlaw fight (f2-boss).

Hayden asked for "a western shoot out at midnight". This draws a western town
main street at midnight, looking down the road: a big full moon in a starry
deep-blue/purple sky, mesas and saguaro cacti on the horizon, wooden false-front
storefronts down both sides (saloon with swinging doors, bank, general store,
sheriff's office, hotel) with a few warm lit windows and lanterns, a clock tower
stuck at 12:00, a water tower, a hitching post, wanted posters (one of the new
Outlaw, cut from his in-game sprite), a tumbleweed and a moonlit dusty road.
Drawn entirely in code; no AI or third-party art.

Layout note: PlayScene stretches a level background to
  max(worldWidth, 1600) x (worldHeight + 80)  = 1920 x 800 for this arena
and scrolls it at 0.22 (x) / 0.08 (y). The camera is 1280x720 and can scroll
640px, so only display x 0..~1425, y 0..720 is ever on screen, and the floor
tiles cover y >= 672. The picture is composed in that 1920x800 display space
(supersampled) and squashed to the usual 1792x1008 jpg, so the game's stretch
puts it back in proportion.

Readability: the band behind the fighters (display y ~560-660) is a soft,
lighter moonlit dust haze so the black Outlaw and his red eyes stand out; the
picture is darkened/muted toward the floor, and there are no flat ledges, spikes
or glowing hazard shapes near character height.

Usage: python3 scripts/art/make-midnight-shootout.py
Writes: public/game/bg/midnight-shootout.jpg
"""
from __future__ import annotations

import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SPRITES = ROOT / "public/game/sprites"
OUT = ROOT / "public/game/bg/midnight-shootout.jpg"

DW, DH = 1920, 800       # display space the game stretches the image to
K = 2                    # supersample
OUT_SIZE = (1792, 1008)  # same size/format as the other level backgrounds
FLOOR_Y = 672            # top of the arena floor tiles in display space
INK = (14, 10, 26)
FONT = "/usr/share/fonts/truetype/sand-box/google/Lilita One/LilitaOne-Regular.ttf"

# one-point perspective down the street
VPX, VPY = 712, 470      # vanishing point (horizon)
GROUND = 330             # ground height in "f units": ground y = VPY + GROUND / d
XL, XR = -900, 900       # street-side facade planes

rnd = random.Random(1200)  # midnight


def S(v):
    return int(round(v * K))


def P(*xy):
    return [S(v) for v in xy]


def font(size):
    return ImageFont.truetype(FONT, S(size))


def proj(X, Y, d):
    return (VPX + X / d, VPY + Y / d)


def fac(Xs, d0, d1):
    """Local (u along depth 0..1, v height above ground) -> display xy on facade plane X=Xs."""
    def f(u, v):
        return proj(Xs, GROUND - v, d0 + u * (d1 - d0))
    return f


def poly(d, pts, fill, outline=None, width=1):
    d.polygon([(S(x), S(y)) for x, y in pts], fill=fill, outline=outline, width=S(width) if outline else 0)


def line(d, pts, fill, width):
    d.line([(S(x), S(y)) for x, y in pts], fill=fill, width=max(1, S(width)))


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def find_coeffs(dst, src):
    m = []
    for (x, y), (X, Y) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -X * x, -X * y])
        m.append([0, 0, 0, x, y, 1, -Y * x, -Y * y])
    A = np.array(m, dtype=np.float64)
    B = np.array([c for p in src for c in p], dtype=np.float64)
    return np.linalg.solve(A, B).tolist()


def warp(img, tex, quad):
    """Paste tex (RGBA) onto img so its corners land on quad (TL, TR, BR, BL) in display coords."""
    w, h = tex.size
    q = [(S(x), S(y)) for x, y in quad]
    co = find_coeffs(q, [(0, 0), (w, 0), (w, h), (0, h)])
    layer = tex.transform(img.size, Image.PERSPECTIVE, co, Image.BICUBIC)
    img.alpha_composite(layer)


def glow(img, x, y, r, rgb, a=150):
    g = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse(P(x - r, y - r, x + r, y + r), fill=rgb + (a,))
    img.alpha_composite(g.filter(ImageFilter.GaussianBlur(S(r * 0.5))))


# ------------------------------------------------------------------ sky
def sky(img):
    top, mid, low = (8, 10, 34), (26, 22, 70), (70, 44, 104)
    a = np.zeros((S(DH), S(DW), 3), dtype=np.float32)
    ys = np.arange(S(DH)) / K
    for i, y in enumerate(ys):
        t = min(1.0, y / VPY)
        c = np.array(top) * (1 - t) + np.array(mid) * t if t < 0.7 else \
            np.array(mid) * (1 - (t - 0.7) / 0.3) + np.array(low) * ((t - 0.7) / 0.3)
        a[i, :, :] = c
    img.paste(Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGB").convert("RGBA"))
    # faint milky band
    band = Image.new("RGBA", img.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    for k in range(60):
        t = k / 59
        x, y = -100 + t * 2100, 60 + t * 260 + math.sin(t * 6) * 30
        bd.ellipse(P(x - 120, y - 40, x + 120, y + 40), fill=(120, 110, 190, 10))
    img.alpha_composite(band.filter(ImageFilter.GaussianBlur(S(30))))
    d = ImageDraw.Draw(img)
    for _ in range(900):
        x, y = rnd.uniform(0, DW), rnd.uniform(0, VPY - 10) ** 1.0
        r = rnd.choice([0.6, 0.6, 0.8, 1.0, 1.3])
        c = rnd.choice([(255, 255, 255), (220, 230, 255), (255, 240, 210), (200, 190, 255)])
        al = int(rnd.uniform(110, 255) * (1 - 0.6 * y / VPY))
        d.ellipse(P(x - r, y - r, x + r, y + r), fill=c + (al,))
    for _ in range(22):  # twinkly cross stars
        x, y = rnd.uniform(0, DW), rnd.uniform(10, 330)
        s = rnd.uniform(4, 9)
        glow(img, x, y, s * 1.4, (190, 200, 255), 90)
        d = ImageDraw.Draw(img)
        line(d, [(x - s, y), (x + s, y)], (255, 255, 255, 220), 1.0)
        line(d, [(x, y - s), (x, y + s)], (255, 255, 255, 220), 1.0)


def moon(img, cx=560, cy=196, r=118):
    glow(img, cx, cy, r * 2.6, (120, 130, 220), 70)
    glow(img, cx, cy, r * 1.55, (230, 228, 255), 90)
    m = Image.new("RGBA", img.size, (0, 0, 0, 0))
    md = ImageDraw.Draw(m)
    md.ellipse(P(cx - r, cy - r, cx + r, cy + r), fill=(246, 240, 214, 255))
    # soft terminator shade on the lower right
    sh = Image.new("L", img.size, 0)
    ImageDraw.Draw(sh).ellipse(P(cx - r * 0.7, cy - r * 0.6, cx + r * 1.5, cy + r * 1.5), fill=60)
    sh = ImageChops.multiply(sh.filter(ImageFilter.GaussianBlur(S(30))), m.getchannel("A"))
    m.paste(Image.new("RGBA", img.size, (170, 160, 170, 255)), (0, 0), sh)
    cr = random.Random(7)
    for _ in range(14):
        a, rr = cr.uniform(0, 2 * math.pi), cr.uniform(0, r * 0.78)
        x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr
        s = cr.uniform(6, 20)
        md.ellipse(P(x - s, y - s * 0.85, x + s, y + s * 0.85), fill=(222, 214, 190, 255))
        md.arc(P(x - s, y - s * 0.85, x + s, y + s * 0.85), 200, 350, fill=(200, 190, 168, 255), width=S(1.6))
    img.alpha_composite(m)


def horizon(img):
    """Mesas and saguaros on the horizon, lit along their tops by the moon."""
    d = ImageDraw.Draw(img)
    far = (40, 30, 78)
    mesas = [(-50, 300, 410), (240, 520, 392), (820, 1180, 402), (1240, 1500, 386), (1560, 1980, 404)]
    for x0, x1, top in mesas:
        pts = [(x0, VPY + 6), (x0 + 50, top + 6), (x0 + 70, top), (x1 - 70, top), (x1 - 46, top + 8), (x1, VPY + 6)]
        poly(d, pts, far + (255,))
        line(d, [(x0 + 70, top), (x1 - 70, top)], (110, 100, 170, 255), 1.4)
    poly(d, [(-50, VPY - 10), (DW + 50, VPY - 10), (DW + 50, VPY + 30), (-50, VPY + 30)], (34, 26, 64, 255))
    for x, h in [(470, 30), (650, 22), (935, 36), (1060, 26), (1330, 32), (1700, 28), (150, 26)]:
        cactus(d, x, VPY + 2, h, (24, 18, 48, 255))


def cactus(d, x, base, h, col):
    w = h * 0.16
    poly(d, [(x - w, base), (x - w, base - h + w), (x, base - h), (x + w, base - h + w), (x + w, base)], col)
    for side, hy, ah in ((-1, 0.45, 0.32), (1, 0.6, 0.28)):
        ax = x + side * w
        y0 = base - h * hy
        line(d, [(ax, y0), (ax + side * h * 0.22, y0)], col, w * 1.6)
        line(d, [(ax + side * h * 0.22, y0 + w * 0.6), (ax + side * h * 0.22, y0 - h * ah)], col, w * 1.6)


# ------------------------------------------------------------------ street
def road(img):
    d = ImageDraw.Draw(img)
    near_l, near_r = proj(XL, GROUND, 0.9), proj(XR, GROUND, 0.9)
    poly(d, [(VPX - 30, VPY), (VPX + 30, VPY), (near_r[0] + 400, DH + 50), (near_l[0] - 400, DH + 50)], (56, 48, 74, 255))
    # moonlit dust: lighter in the middle distance (behind the fighters), darker near
    a = np.array(img).astype(np.float32)
    ys = np.arange(a.shape[0]) / K
    for i, y in enumerate(ys):
        if y < VPY:
            continue
        t = (y - VPY) / (DH - VPY)
        lift = 30 * math.exp(-((y - 598) / 66) ** 2)  # haze band around character height
        mul = 1.0 - 0.45 * max(0.0, (y - 640) / 160)
        row = a[i, :, :3]
        mask = a[i, :, 3] > 0
        row[:] = row * mul + lift * np.array([0.8, 0.85, 1.0])
    img.paste(Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGBA"))
    d = ImageDraw.Draw(img)
    # wheel ruts converging on the vanishing point
    for X in (-260, -160, 160, 260):
        a0 = proj(X, GROUND, 1.0)
        a1 = proj(X, GROUND, 12)
        line(d, [a1, a0], (52, 44, 72, 200), 2.2)
    # dust specks / pebbles
    for _ in range(260):
        dd = rnd.uniform(1.2, 10)
        X = rnd.uniform(-700, 700)
        x, y = proj(X, GROUND, dd)
        s = 2.2 / dd + 0.3
        d.ellipse(P(x - s * 2, y - s, x + s * 2, y + s), fill=(98, 88, 116, 160))


# ------------------------------------------------------------------ buildings
WOOD = [(70, 46, 52), (62, 44, 62), (78, 54, 50), (58, 42, 58), (74, 50, 60)]
LIT = (255, 196, 108)


def facade(img, side, d0, d1, h, color, name=None, sign_col=(230, 210, 160), kind="store", step=True, lit=(), poster=None):
    """A false-front storefront on the left (side=-1) or right (side=1) of the street."""
    Xs = XL if side < 0 else XR
    f = fac(Xs, d0, d1)
    d = ImageDraw.Draw(img)
    # moon is up-left/centre: left-side fronts (facing right) catch more light
    light = 1.12 if side < 0 else 0.86
    col = tuple(min(255, int(c * light)) for c in color)
    dark = tuple(int(c * 0.62) for c in col)
    # side wall seen at the far end (towards the vanishing point)
    back = [f(1, 0), f(1, h * 0.78), proj(Xs + (-side) * -260, GROUND - h * 0.7, d1 + 0.001)]
    # main front with stepped false top
    top = [f(0, h), f(0.18, h), f(0.18, h + 30), f(0.82, h + 30), f(0.82, h), f(1, h)] if step else [f(0, h), f(1, h)]
    front = [f(0, 0)] + top + [f(1, 0)]
    poly(d, front, col + (255,), INK + (255,), 2)
    # board lines (horizontal siding converges on the vanishing point)
    for v in range(20, int(h), 22):
        line(d, [f(0, v), f(1, v)], dark + (150,), 1.0)
    line(d, [f(0, h - 6), f(1, h - 6)], tuple(min(255, c + 40) for c in col) + (255,), 2.0)  # cornice
    # windows / door
    n = 3
    for i in range(n):
        u0, u1 = 0.1 + i * 0.28, 0.1 + i * 0.28 + 0.16
        if kind == "saloon" and i == 1:
            continue
        on = i in lit
        win = [f(u0, 150), f(u1, 150), f(u1, 70), f(u0, 70)]
        poly(d, win, (LIT if on else (30, 30, 58)) + (255,), INK + (255,), 1.6)
        if on:
            cx = sum(p[0] for p in win) / 4
            cy = sum(p[1] for p in win) / 4
            glow(img, cx, cy, 30 / ((d0 + d1) / 2), LIT, 120)
            d = ImageDraw.Draw(img)
        line(d, [f((u0 + u1) / 2, 150), f((u0 + u1) / 2, 70)], INK + (255,), 1.2)
        line(d, [f(u0, 110), f(u1, 110)], INK + (255,), 1.2)
        # upper storey windows
        win2 = [f(u0 + 0.02, h - 30), f(u1 - 0.02, h - 30), f(u1 - 0.02, h - 90), f(u0 + 0.02, h - 90)]
        on2 = (i + 1) in lit
        poly(d, win2, (LIT if on2 else (28, 28, 56)) + (255,), INK + (255,), 1.4)
        if on2:
            cx = sum(p[0] for p in win2) / 4
            cy = sum(p[1] for p in win2) / 4
            glow(img, cx, cy, 26 / ((d0 + d1) / 2), LIT, 110)
            d = ImageDraw.Draw(img)
    if kind == "saloon":
        # warm doorway with swinging batwing doors
        u0, u1 = 0.4, 0.6
        poly(d, [f(u0, 140), f(u1, 140), f(u1, 0), f(u0, 0)], (255, 180, 90, 255), INK + (255,), 1.6)
        cx = (f(u0, 70)[0] + f(u1, 70)[0]) / 2
        glow(img, cx, f(0.5, 70)[1], 90 / ((d0 + d1) / 2), (255, 170, 80), 130)
        d = ImageDraw.Draw(img)
        for a, b in ((u0, 0.5), (0.5, u1)):
            poly(d, [f(a, 108), f(b, 100), f(b, 36), f(a, 40)], (120, 74, 46, 255), INK + (255,), 1.4)
            for k in range(1, 4):
                uu = a + (b - a) * k / 4
                line(d, [f(uu, 96), f(uu, 44)], (80, 46, 30, 255), 1.0)
    else:
        u0, u1 = 0.42, 0.58
        poly(d, [f(u0, 130), f(u1, 130), f(u1, 0), f(u0, 0)], (34, 24, 40, 255), INK + (255,), 1.4)
    # porch roof + posts sticking out toward the street (slanted in perspective, not a ledge)
    Xp = Xs - side * 90
    pf = fac(Xp, d0, d1)
    poly(d, [f(0, 172), f(1, 172), pf(1, 160), pf(0, 160)], tuple(int(c * 0.8) for c in col) + (255,), INK + (255,), 1.6)
    for u in (0.02, 0.5, 0.98):
        line(d, [pf(u, 160), pf(u, 0)], INK + (255,), 4.0 / ((d0 + d1) / 2) + 1)
        line(d, [pf(u, 158), pf(u, 2)], tuple(int(c * 0.9) for c in col) + (255,), 2.6 / ((d0 + d1) / 2) + 0.4)
    # boardwalk
    poly(d, [f(0, 0), f(1, 0), pf(1, 0), pf(0, 0)], (46, 34, 44, 255))
    if name:
        sign(img, f, name, sign_col, h, side)
    if poster:
        u, v = poster
        wanted(img, [f(u, v + 46), f(u + 0.1, v + 46), f(u + 0.1, v), f(u, v)], outlaw=False)
    return f, pf


def sign(img, f, text, col, h, side=-1):
    fnt = font(40)
    tw = int(ImageDraw.Draw(Image.new("RGBA", (1, 1))).textlength(text, font=fnt)) + S(30)
    th = S(58)
    tex = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    td = ImageDraw.Draw(tex)
    td.rounded_rectangle((0, 0, tw - 1, th - 1), S(6), fill=(52, 30, 30, 255), outline=(20, 12, 16, 255), width=S(3))
    td.text((tw // 2, th // 2 + S(2)), text, font=fnt, fill=col + (255,), anchor="mm", stroke_width=S(2), stroke_fill=(20, 10, 14, 255))
    a, b = (0.12, 0.88) if side < 0 else (0.88, 0.12)  # keep the text readable on both sides
    warp(img, tex, [f(a, h + 22), f(b, h + 22), f(b, h - 40), f(a, h - 40)])


def outlaw_face():
    sheet = Image.open(SPRITES / "outlaw.png").convert("RGBA")
    fr = sheet.crop((0, 0, 128, 128))
    return fr.crop((34, 6, 92, 64))  # hat, red eyes, bandana


def wanted(img, quad, outlaw=True, label="WANTED"):
    w, h = S(150), S(200)
    tex = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    td = ImageDraw.Draw(tex)
    td.rectangle((0, 0, w - 1, h - 1), fill=(222, 200, 150, 255), outline=(60, 36, 24, 255), width=S(3))
    td.text((w // 2, S(24)), label, font=font(30), fill=(140, 34, 26, 255), anchor="mm")
    if outlaw:
        face = outlaw_face().resize((S(120), S(120)), Image.LANCZOS)
        tex.alpha_composite(face, (S(15), S(42)))
        td.text((w // 2, h - S(18)), "$1000", font=font(24), fill=(60, 36, 24, 255), anchor="mm")
    else:
        td.ellipse((S(45), S(60), S(105), S(130)), fill=(150, 120, 90, 255))
        td.text((w // 2, h - S(30)), "REWARD", font=font(22), fill=(60, 36, 24, 255), anchor="mm")
    # night-shade the paper a little
    shade = Image.new("RGBA", tex.size, (30, 30, 80, 70))
    tex = Image.composite(Image.alpha_composite(tex, shade), tex, tex.getchannel("A"))
    warp(img, tex, quad)


def lantern(img, x, y, s):
    glow(img, x, y, 40 * s, (255, 170, 80), 140)
    glow(img, x, y, 14 * s, (255, 220, 150), 200)
    d = ImageDraw.Draw(img)
    line(d, [(x, y - 14 * s), (x, y - 8 * s)], INK + (255,), 1.2 * s)
    d.rounded_rectangle(P(x - 4 * s, y - 8 * s, x + 4 * s, y + 6 * s), S(1.5 * s), fill=(255, 214, 120, 255), outline=INK + (255,), width=max(1, S(1.2 * s)))


def clock_tower(img, X0=1000, X1=1330, dd=3.3, base_h=420, tower_h=1240):
    """Town hall clock tower behind the right-hand fronts, stopped at 12:00."""
    d = ImageDraw.Draw(img)
    c = (54, 40, 66)
    p = lambda X, v: proj(X, GROUND - v, dd)
    poly(d, [p(X0, 0), p(X0, base_h), p(X1, base_h), p(X1, 0)], c + (255,), INK + (255,), 2)
    tX0, tX1 = X0 + 60, X1 - 60
    poly(d, [p(tX0, base_h), p(tX0, tower_h), p(tX1, tower_h), p(tX1, base_h)], (60, 44, 74, 255), INK + (255,), 2)
    roof = [p(tX0 - 30, tower_h), p((tX0 + tX1) / 2, tower_h + 230), p(tX1 + 30, tower_h)]
    poly(d, roof, (40, 28, 52, 255), INK + (255,), 2)
    line(d, [roof[0], roof[1]], (120, 110, 180, 255), 1.4)  # moonlit edge
    # belfry opening
    poly(d, [p(tX0 + 40, tower_h - 40), p(tX0 + 40, tower_h - 150), p(tX1 - 40, tower_h - 150), p(tX1 - 40, tower_h - 40)], (22, 16, 34, 255), INK + (255,), 1.4)
    cx, cy = p((tX0 + tX1) / 2, tower_h - 330)
    r = 118 / dd
    glow(img, cx, cy, r * 1.8, (255, 230, 160), 90)
    d = ImageDraw.Draw(img)
    d.ellipse(P(cx - r - 3, cy - r - 3, cx + r + 3, cy + r + 3), fill=(30, 22, 30, 255))
    d.ellipse(P(cx - r, cy - r, cx + r, cy + r), fill=(250, 236, 196, 255))
    for k in range(12):
        a = k * math.pi / 6
        r0 = r * (0.78 if k % 3 else 0.68)
        line(d, [(cx + math.sin(a) * r0, cy - math.cos(a) * r0), (cx + math.sin(a) * r * 0.9, cy - math.cos(a) * r * 0.9)], (40, 26, 30, 255), 1.6 if k % 3 else 2.6)
    fnt = font(11)
    d.text((S(cx), S(cy - r * 0.55)), "XII", font=fnt, fill=(40, 26, 30, 255), anchor="mm")
    # both hands straight up: midnight
    line(d, [(cx, cy), (cx, cy - r * 0.5)], (24, 14, 20, 255), 3.2)
    line(d, [(cx, cy + 2), (cx, cy - r * 0.8)], (24, 14, 20, 255), 2.0)
    d.ellipse(P(cx - 2.5, cy - 2.5, cx + 2.5, cy + 2.5), fill=(180, 40, 40, 255))
    # windows on the hall
    for i, X in enumerate(range(X0 + 50, X1 - 40, 90)):
        on = i == 1
        a, b = p(X, 300), p(X + 50, 190)
        d.rectangle(P(a[0], a[1], b[0], b[1]), fill=(LIT if on else (28, 28, 56)) + (255,), outline=INK + (255,), width=S(1.2))
        if on:
            glow(img, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 14, LIT, 110)
            d = ImageDraw.Draw(img)
    # "12:00" sign on the tower under the clock
    t0, t1 = p(tX0 + 20, tower_h - 520), p(tX1 - 20, tower_h - 600)
    d.rounded_rectangle(P(t0[0], t0[1], t1[0], t1[1]), S(3), fill=(52, 30, 30, 255), outline=INK + (255,), width=S(1.5))
    d.text((S((t0[0] + t1[0]) / 2), S((t0[1] + t1[1]) / 2)), "12:00", font=font(16), fill=(255, 210, 120, 255), anchor="mm")
    return p


def water_tower(img, cx=205, base=352, s=1.0):
    d = ImageDraw.Draw(img)
    c = (30, 22, 46, 255)
    for dx in (-46, -16, 16, 46):
        line(d, [(cx + dx * 0.7, base - 90 * s), (cx + dx, base + 60)], c, 4)
    line(d, [(cx - 44, base - 20), (cx + 44, base + 30)], c, 2)
    line(d, [(cx + 44, base - 20), (cx - 44, base + 30)], c, 2)
    poly(d, [(cx - 54, base - 90), (cx + 54, base - 90), (cx + 50, base - 190), (cx - 50, base - 190)], (48, 36, 60, 255), INK + (255,), 2)
    poly(d, [(cx - 60, base - 186), (cx, base - 236), (cx + 60, base - 186)], (36, 26, 48, 255), INK + (255,), 2)
    for y in (base - 120, base - 160):
        line(d, [(cx - 52, y), (cx + 52, y)], (24, 18, 36, 255), 2)
    line(d, [(cx - 50, base - 190), (cx - 60, base - 186), (cx, base - 236)], (130, 120, 190, 255), 1.4)


def hitching_post(img):
    d = ImageDraw.Draw(img)
    Xh = XL + 170
    a, b = proj(Xh, GROUND - 105, 1.25), proj(Xh, GROUND - 105, 1.7)
    for dd in (1.25, 1.7):
        top, bot = proj(Xh, GROUND - 112, dd), proj(Xh, GROUND, dd)
        line(d, [top, bot], INK + (255,), 7 / dd)
        line(d, [top, bot], (70, 50, 46, 255), 4 / dd)
    line(d, [a, b], INK + (255,), 6)
    line(d, [a, b], (84, 60, 50, 255), 3.4)


def tumbleweed(img, x=835, y=532, r=10):
    d = ImageDraw.Draw(img)
    tw = random.Random(3)
    for _ in range(26):
        a0 = tw.uniform(0, 2 * math.pi)
        rr = tw.uniform(r * 0.3, r)
        box = P(x - rr, y - rr * 0.9, x + rr, y + rr * 0.9)
        d.arc(box, math.degrees(a0), math.degrees(a0) + tw.uniform(90, 220), fill=(110, 86, 70, 210), width=S(1.0))
    d.ellipse(P(x - r * 1.1, y + r * 0.8, x + r * 1.1, y + r * 1.2), fill=(30, 24, 40, 90))


def notice_board(img, X0=-830, X1=-530, dd=1.9):
    """Frontal board on the left sidewalk with the new Outlaw's wanted poster."""
    d = ImageDraw.Draw(img)
    p = lambda X, v: proj(X, GROUND - v, dd)
    for X in (X0 + 20, X1 - 20):
        line(d, [p(X, 0), p(X, 330)], INK + (255,), 7)
        line(d, [p(X, 0), p(X, 330)], (66, 46, 44, 255), 4)
    a, b = p(X0, 330), p(X1, 150)
    d.rectangle(P(a[0], a[1], b[0], b[1]), fill=(70, 50, 48, 255), outline=INK + (255,), width=S(2))
    # little peaked cap (sloped, so it never reads as a platform)
    poly(d, [(a[0] - 8, a[1] + 2), ((a[0] + b[0]) / 2, a[1] - 22), (b[0] + 8, a[1] + 2)], (46, 32, 40, 255), INK + (255,), 1.6)
    wanted(img, [p(X0 + 25, 318), p(X0 + 155, 318), p(X0 + 155, 160), p(X0 + 25, 160)], outlaw=True)
    wanted(img, [p(X0 + 175, 300), p(X0 + 270, 304), p(X0 + 268, 182), p(X0 + 177, 180)], outlaw=False)
    lantern(img, *p(X0 + 20, 345), 1.0)


def finish(img):
    rgb = img.convert("RGB")
    rgb = ImageEnhance.Color(rgb).enhance(0.9)
    # muted, darker toward the floor (but keep the moonlit dust band at character height)
    shade = Image.new("L", rgb.size, 0)
    sd = ImageDraw.Draw(shade)
    for y in range(S(560), S(DH)):
        yy = y / K
        a = 0 if yy < 640 else int(min(150, (yy - 640) * 3.2))
        sd.line([(0, y), (S(DW), y)], fill=a)
    for x in range(S(200)):  # soft side vignette
        sd.line([(x, 0), (x, S(DH))], fill=max(0, int(90 * (1 - x / S(200)))))
    shade = ImageChops.lighter(shade, shade)
    dark = Image.new("RGB", rgb.size, (10, 8, 22))
    rgb = Image.composite(dark, rgb, shade.filter(ImageFilter.GaussianBlur(S(16))))
    return rgb.resize(OUT_SIZE, Image.LANCZOS)


def main():
    img = Image.new("RGBA", (S(DW), S(DH)), (0, 0, 0, 255))
    sky(img)
    moon(img)
    horizon(img)
    water_tower(img)
    road(img)
    # far to near so nearer fronts overlap farther ones
    right = [(7.5, 11, 300, WOOD[3], None, ()), (4.6, 7.5, 360, WOOD[1], "HOTEL", (1, 3)),
             (2.6, 4.6, 340, WOOD[4], "BANK", (0,)), (1.5, 2.6, 330, WOOD[2], "SHERIFF", (2,)),
             (0.9, 1.5, 360, WOOD[0], None, ())]
    left = [(7.0, 11, 290, WOOD[2], None, (1,)), (4.0, 7.0, 340, WOOD[0], "BARBER", ()),
            (2.4, 4.0, 380, WOOD[3], "GENERAL STORE", (0, 2)), (1.0, 2.4, 400, WOOD[1], "SALOON", (0, 2, 3))]
    for d0, d1, h, col, nm, lit in right[:2]:
        facade(img, 1, d0, d1, h, col, nm, kind="store", lit=lit)
    clock_tower(img)
    for d0, d1, h, col, nm, lit in right[2:]:
        facade(img, 1, d0, d1, h, col, nm, kind="store", lit=lit)
    for d0, d1, h, col, nm, lit in left:
        kind = "saloon" if nm == "SALOON" else "store"
        poster = (0.66, 90) if nm == "GENERAL STORE" else None
        facade(img, -1, d0, d1, h, col, nm, kind=kind, lit=lit, poster=poster)
    # lanterns on porch posts
    for side, dd in ((-1, 1.7), (-1, 3.2), (1, 2.0), (1, 3.6), (-1, 5.5), (1, 6.0)):
        Xs = (XL if side < 0 else XR) - side * 90
        lantern(img, *proj(Xs, GROUND - 150, dd), 1.6 / dd + 0.3)
    hitching_post(img)
    notice_board(img)
    tumbleweed(img)
    out = finish(img)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, quality=90, optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} {out.size}")


if __name__ == "__main__":
    main()

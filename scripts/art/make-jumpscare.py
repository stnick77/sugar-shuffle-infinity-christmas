#!/usr/bin/env python3
"""
The intense Bacteria jumpscare, drawn in code (no AI or third-party art):

  jumpscare-face.png   a full-frame close-up of Bacteria in its Void form: a
                       dark purple-black head, glowing eyes and a huge glowing
                       Smiler grin, with green-black slime (never blood)
  goo-splats.png       4 green-black slime splats with drips (2x2 x 256px)
  glass-crack.png      cracked glass spreading from the impact point, as 3
                       growing stages (3 x 640x360, shown full-screen)

Kid-friendly: no gore, no blood, no red liquids; the slime is Bacteria goo.

    python3 scripts/art/make-jumpscare.py
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/game/sprites"
K = 2


def S(v):
    return int(round(v * K))


def glow(img, box, rgb, a, blur):
    lay = Image.new("RGBA", img.size, rgb + (0,))
    ImageDraw.Draw(lay).ellipse([S(v) for v in box], fill=rgb + (a,))
    img.alpha_composite(lay.filter(ImageFilter.GaussianBlur(S(blur))))


def slime_blob(d, rnd, cx, cy, r, col, drips=4, drip_len=(20, 60)):
    pts = []
    n = 22
    for i in range(n):
        a = i / n * math.tau
        rr = r * (0.78 + 0.32 * rnd.random())
        pts.append((S(cx + math.cos(a) * rr), S(cy + math.sin(a) * rr * 0.9)))
    d.polygon(pts, fill=col)
    for _ in range(drips):
        x = cx + rnd.uniform(-r * 0.7, r * 0.7)
        w = rnd.uniform(r * 0.10, r * 0.2)
        ln = rnd.uniform(*drip_len)
        d.rounded_rectangle((S(x - w / 2), S(cy), S(x + w / 2), S(cy + r * 0.5 + ln)), radius=S(w / 2), fill=col)
        d.ellipse((S(x - w * 0.75), S(cy + r * 0.5 + ln - w * 0.9), S(x + w * 0.75), S(cy + r * 0.5 + ln + w * 0.6)), fill=col)
    # small satellite droplets
    for _ in range(7):
        a = rnd.uniform(0, math.tau)
        dist = r * rnd.uniform(1.1, 1.6)
        rr = rnd.uniform(r * 0.05, r * 0.13)
        x, y = cx + math.cos(a) * dist, cy + math.sin(a) * dist
        d.ellipse((S(x - rr), S(y - rr), S(x + rr), S(y + rr)), fill=col)


def goo_shine(img, rnd, cx, cy, r):
    d = ImageDraw.Draw(img)
    for _ in range(3):
        x, y = cx + rnd.uniform(-r * 0.4, r * 0.2), cy + rnd.uniform(-r * 0.45, 0)
        rr = rnd.uniform(r * 0.06, r * 0.14)
        d.ellipse((S(x - rr), S(y - rr * 0.6), S(x + rr), S(y + rr * 0.6)), fill=(190, 255, 170, 190))


GOO_DARK = (18, 34, 16, 255)
GOO = (60, 120, 40, 255)
GOO_LIT = (120, 200, 70, 255)


def face():
    W = H = 768
    img = Image.new("RGBA", (S(W), S(H)), (0, 0, 0, 0))
    rnd = random.Random(470)
    # purple aura
    glow(img, (40, 30, W - 40, H - 10), (110, 40, 170), 150, 40)
    d = ImageDraw.Draw(img)
    # the head: a lumpy dark void blob that fills the frame
    pts = []
    for i in range(48):
        a = i / 48 * math.tau
        r = 330 + 18 * math.sin(a * 5 + 1) + 10 * math.sin(a * 11)
        pts.append((S(W / 2 + math.cos(a) * r * 0.95), S(H / 2 + 10 + math.sin(a) * r)))
    d.polygon(pts, fill=(16, 10, 24, 255))
    # inner shading rings (subtle purple)
    for k in range(5):
        glow(img, (140 + k * 20, 90 + k * 14, W - 140 - k * 20, H - 120 - k * 14), (40, 18, 60), 40, 30)
    # glowing eyes: hot white core, yellow ring, purple glow
    for sx in (-1, 1):
        ex, ey = W / 2 + sx * 150, 270
        glow(img, (ex - 120, ey - 90, ex + 120, ey + 90), (200, 120, 255), 170, 26)
        glow(img, (ex - 80, ey - 56, ex + 80, ey + 56), (255, 240, 170), 220, 12)
        d = ImageDraw.Draw(img)
        d.ellipse((S(ex - 62), S(ey - 42 + sx * 3), S(ex + 62), S(ey + 42)), fill=(255, 252, 230, 255))
        d.ellipse((S(ex - 16 + sx * 6), S(ey - 16), S(ex + 16 + sx * 6), S(ey + 16)), fill=(20, 8, 30, 255))
    # the giant Smiler grin
    gx0, gx1, gy = 150, W - 150, 470
    up, lo = [], []
    for i in range(41):
        t = i / 40
        x = gx0 + (gx1 - gx0) * t
        bend = 1 - (2 * t - 1) ** 2
        up.append((S(x), S(gy - 40 + bend * 50)))
        lo.append((S(x), S(gy - 30 + bend * 190)))
    mouth = Image.new("L", img.size, 0)
    ImageDraw.Draw(mouth).polygon(up + lo[::-1], fill=255)
    glow_l = Image.new("RGBA", img.size, (230, 170, 255, 0))
    glow_l.putalpha(mouth.filter(ImageFilter.GaussianBlur(S(18))).point(lambda v: int(v * 0.9)))
    img.alpha_composite(glow_l)
    teeth = Image.new("RGBA", img.size, (255, 250, 236, 255))
    img.paste(teeth, (0, 0), mouth)
    d = ImageDraw.Draw(img)
    # tooth gaps (rounded, friendly-ish) and the dark line between the rows
    for i in range(1, 16):
        t = i / 16
        x = gx0 + (gx1 - gx0) * t
        bend = 1 - (2 * t - 1) ** 2
        y0, y1 = gy - 40 + bend * 50, gy - 30 + bend * 190
        d.line([(S(x), S(y0 + 4)), (S(x + (t - 0.5) * 8), S(y1 - 4))], fill=(70, 40, 90, 255), width=S(4))
    mid = [(S(gx0 + (gx1 - gx0) * (i / 40)), S(gy - 35 + (1 - (2 * i / 40 - 1) ** 2) * 120)) for i in range(41)]
    d.line(mid, fill=(60, 30, 80, 255), width=S(6), joint="curve")
    # green-black slime oozing from the head (Bacteria goo, not blood)
    for cx, cy, r in ((W / 2 - 230, 120, 50), (W / 2 + 210, 100, 44), (W / 2 + 40, 640, 60), (W / 2 - 120, 650, 40), (W / 2 + 250, 600, 38)):
        slime_blob(d, rnd, cx, cy, r, GOO_DARK, drips=3, drip_len=(30, 90))
        slime_blob(d, rnd, cx, cy - 4, r * 0.75, GOO, drips=2, drip_len=(20, 60))
        goo_shine(img, rnd, cx, cy, r)
    out = img.resize((W, H), Image.LANCZOS)
    out.save(OUT / "jumpscare-face.png", optimize=True)
    print("wrote public/game/sprites/jumpscare-face.png", out.size)


def splats():
    sheet = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    for i in range(4):
        rnd = random.Random(900 + i)
        img = Image.new("RGBA", (S(256), S(256)), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        cx, cy, r = 128 + rnd.uniform(-10, 10), 96 + rnd.uniform(-10, 10), rnd.uniform(52, 66)
        slime_blob(d, rnd, cx, cy, r, GOO_DARK, drips=5, drip_len=(30, 90))
        slime_blob(d, rnd, cx, cy - 3, r * 0.78, GOO, drips=3, drip_len=(20, 70))
        slime_blob(d, rnd, cx - r * 0.1, cy - r * 0.12, r * 0.4, GOO_LIT, drips=0)
        goo_shine(img, rnd, cx, cy, r)
        sheet.alpha_composite(img.resize((256, 256), Image.LANCZOS), ((i % 2) * 256, (i // 2) * 256))
    sheet.save(OUT / "goo-splats.png", optimize=True)
    print("wrote public/game/sprites/goo-splats.png", sheet.size)


def cracks():
    W, H = 640, 360
    cx, cy = W / 2, H / 2 + 10
    rnd = random.Random(3)
    segs = []  # (dist from impact, line)
    # radial cracks with jagged kinks and branches
    for i in range(16):
        a = i / 16 * math.tau + rnd.uniform(-0.15, 0.15)
        x, y, dist = cx, cy, 0.0
        while 0 <= x <= W and 0 <= y <= H and dist < 520:
            step = rnd.uniform(14, 30)
            a += rnd.uniform(-0.28, 0.28)
            nx, ny = x + math.cos(a) * step, y + math.sin(a) * step
            segs.append((dist, (x, y, nx, ny), 2.2 if dist < 120 else 1.5))
            if rnd.random() < 0.12:
                ba = a + rnd.choice((-1, 1)) * rnd.uniform(0.5, 1.0)
                bx, by = nx, ny
                for k in range(rnd.randint(2, 5)):
                    ex, ey = bx + math.cos(ba) * 16, by + math.sin(ba) * 16
                    segs.append((dist + k * 16, (bx, by, ex, ey), 1.1))
                    bx, by = ex, ey
                    ba += rnd.uniform(-0.3, 0.3)
            x, y, dist = nx, ny, dist + step
    # concentric ring cracks
    for ring in (40, 95, 170, 260):
        n = int(ring / 6)
        prev = None
        for j in range(n + 1):
            if rnd.random() < 0.25:
                prev = None
                continue
            a = j / n * math.tau
            rr = ring * (1 + rnd.uniform(-0.08, 0.08))
            pt = (cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.8)
            if prev:
                segs.append((ring, (*prev, *pt), 1.2))
            prev = pt
    sheet = Image.new("RGBA", (W * 3, H), (0, 0, 0, 0))
    for stage, reach in enumerate((110, 230, 600)):
        img = Image.new("RGBA", (S(W), S(H)), (0, 0, 0, 0))
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        d, ds = ImageDraw.Draw(img), ImageDraw.Draw(sh)
        for dist, (x0, y0, x1, y1), w in segs:
            if dist > reach:
                continue
            ds.line([(S(x0 + 1), S(y0 + 1.5)), (S(x1 + 1), S(y1 + 1.5))], fill=(0, 0, 0, 150), width=S(w + 1))
            d.line([(S(x0), S(y0)), (S(x1), S(y1))], fill=(235, 245, 255, 235), width=S(w))
        # the impact point: a bright crushed star
        d.ellipse((S(cx - 9), S(cy - 9), S(cx + 9), S(cy + 9)), fill=(220, 235, 250, 200))
        sh.alpha_composite(img)
        sheet.alpha_composite(sh.resize((W, H), Image.LANCZOS), (stage * W, 0))
    sheet.save(OUT / "glass-crack.png", optimize=True)
    print("wrote public/game/sprites/glass-crack.png", sheet.size)


if __name__ == "__main__":
    face()
    splats()
    cracks()

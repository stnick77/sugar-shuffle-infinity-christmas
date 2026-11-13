#!/usr/bin/env python3
"""
Original door art for Sugar Shuffle Infinity ('Tis the Seasones refresh), drawn procedurally
(no reference art). Drawn at 4x and downsampled for smooth edges, with the same chunky dark
outline + soft shading as the hero sprites.

  python3 scripts/art/make-doors.py   ->  public/game/sprites/door-room.png   (92x144, shown 46x72)
                                          public/game/sprites/door-boss.png   (136x184, shown 68x92)

Room door: gingerbread frame with white icing trim, candy-cane posts, gumdrops on the arch,
chocolate plank door, peppermint knob and a round window (left see-through: the game lights
it in each room's accent colour).
Boss door: frosted midnight-candy door under an icy dripping arch, candy-corn horns, a
friendly candy skull, red licorice bars and a big ribbon-bow padlock (the game adds the glow).
"""
import math, os, random
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "game", "sprites")
S = 4  # supersample
INK = (34, 18, 14, 255)


def canvas(w, h):
    return Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))


def finish(img, w, h, name):
    img = img.resize((w, h), Image.LANCZOS)
    img.save(os.path.join(OUT, name))
    print("wrote", name, img.size)


def arch_poly(x0, y0, x1, y1, r, steps=48):
    """Rounded-top door outline: semicircle-ish arch of radius r on top."""
    cx = (x0 + x1) / 2
    pts = [(x0, y1), (x0, y0 + r)]
    for i in range(steps + 1):
        a = math.pi + math.pi * i / steps
        pts.append((cx + math.cos(a) * (x1 - x0) / 2, y0 + r + math.sin(a) * r))
    pts += [(x1, y0 + r), (x1, y1)]
    return pts


def shade(img, poly, top, bottom):
    """vertical gradient fill clipped to a polygon"""
    w, h = img.size
    grad = Image.new("RGBA", (w, h))
    gd = ImageDraw.Draw(grad)
    ys = [p[1] for p in poly]
    y0, y1 = int(min(ys)), int(max(ys))
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, y1 - y0)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,)
        gd.line([(0, y), (w, y)], fill=c)
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    img.paste(grad, (0, 0), mask)


def outline(d, poly, width):
    d.line(poly + [poly[0]], fill=INK, width=width, joint="curve")


def candy_cane(img, x0, y0, x1, y1):
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x0, y0, x1, y1], radius=(x1 - x0) // 2, fill=(250, 246, 240, 255), outline=INK, width=3 * S)
    # diagonal red stripes clipped to the post
    stripes = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(stripes)
    step = 9 * S
    for k in range(int(y0) - 40 * S, int(y1) + 40 * S, step):
        sd.polygon([(x0, k), (x1, k - (x1 - x0)), (x1, k - (x1 - x0) + 4 * S), (x0, k + 4 * S)], fill=(220, 40, 60, 255))
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([x0 + 3 * S, y0 + 3 * S, x1 - 3 * S, y1 - 3 * S], radius=(x1 - x0) // 2, fill=255)
    img.paste(stripes, (0, 0), Image.composite(stripes.split()[3], Image.new("L", img.size, 0), mask))
    d.line([(x0 + 5 * S, y0 + 6 * S), (x0 + 5 * S, y1 - 6 * S)], fill=(255, 255, 255, 140), width=2 * S)


def icing(d, pts, width=3):
    d.line(pts, fill=(255, 252, 246, 255), width=width * S, joint="curve")


def wavy(x0, x1, y, amp, n):
    return [(x0 + (x1 - x0) * i / (n * 8), y + math.sin(i / 8 * math.pi * 2) * amp) for i in range(n * 8 + 1)]


def room_door():
    W, H = 92, 144
    img = canvas(W, H)
    d = ImageDraw.Draw(img)
    s = S
    # gingerbread frame
    frame = arch_poly(10 * s, 18 * s, 82 * s, 142 * s, 36 * s)
    shade(img, frame, (196, 120, 62), (150, 84, 40))
    outline(d, frame, 4 * s)
    # gingerbread speckles
    rnd = random.Random(7)
    for _ in range(60):
        x = rnd.uniform(14, 78) * s
        y = rnd.uniform(24, 138) * s
        d.ellipse([x, y, x + 1.6 * s, y + 1.6 * s], fill=(120, 66, 30, 255))
    # door panel
    panel = arch_poly(22 * s, 32 * s, 70 * s, 140 * s, 24 * s)
    shade(img, panel, (110, 58, 30), (70, 34, 18))
    outline(d, panel, 3 * s)
    for x in (38, 54):  # planks
        d.line([(x * s, 50 * s), (x * s, 138 * s)], fill=(52, 26, 14, 255), width=2 * s)
    # icing trim on the arch + wavy line across the frame base
    arc = [(46 * s + math.cos(math.pi + math.pi * i / 40) * 31 * s, 54 * s + math.sin(math.pi + math.pi * i / 40) * 31 * s + math.sin(i * 1.3) * 1.5 * s) for i in range(41)]
    icing(d, arc, 3)
    icing(d, wavy(13 * s, 79 * s, 120 * s, 2 * s, 4), 2)
    # round window (see-through) with a candy rim
    cx, cy, r = 46 * s, 62 * s, 10 * s
    d.ellipse([cx - r - 3 * s, cy - r - 3 * s, cx + r + 3 * s, cy + r + 3 * s], fill=(255, 252, 246, 255), outline=INK, width=3 * s)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(0, 0, 0, 0))
    d.line([(cx, cy - r), (cx, cy + r)], fill=(255, 252, 246, 255), width=2 * s)
    d.line([(cx - r, cy), (cx + r, cy)], fill=(255, 252, 246, 255), width=2 * s)
    # peppermint knob
    kx, ky, kr = 62 * s, 98 * s, 5 * s
    d.ellipse([kx - kr, ky - kr, kx + kr, ky + kr], fill=(255, 255, 255, 255), outline=INK, width=2 * s)
    for i in range(4):
        a = i * math.pi / 2
        d.pieslice([kx - kr + s, ky - kr + s, kx + kr - s, ky + kr - s], math.degrees(a), math.degrees(a) + 45, fill=(220, 40, 60, 255))
    # candy-cane posts
    candy_cane(img, 2 * s, 54 * s, 14 * s, 143 * s)
    candy_cane(img, 78 * s, 54 * s, 90 * s, 143 * s)
    # gumdrops on the arch
    for (gx, gy, col) in [(27, 17, (230, 60, 80)), (46, 9, (90, 200, 110)), (65, 17, (255, 200, 60))]:
        dome = [(gx - 9) * s, (gy - 9) * s, (gx + 9) * s, (gy + 9) * s]
        d.pieslice(dome, 180, 360, fill=col + (255,), outline=INK, width=2 * s)
        d.line([((gx - 9) * s, gy * s), ((gx + 9) * s, gy * s)], fill=INK, width=2 * s)
        for k in range(5):  # sugar crystals
            d.ellipse([(gx - 6 + k * 3) * s, (gy - 4 - (k % 2) * 2) * s, (gx - 5 + k * 3) * s, (gy - 3 - (k % 2) * 2) * s], fill=(255, 255, 255, 200))
        d.ellipse([(gx - 5) * s, (gy - 7) * s, (gx - 2) * s, (gy - 4) * s], fill=(255, 255, 255, 190))
    finish(img, W, H, "door-room.png")


def boss_door():
    W, H = 136, 184
    img = canvas(W, H)
    d = ImageDraw.Draw(img)
    s = S
    # candy-corn horns
    for side in (-1, 1):
        bx = 68 + side * 40
        horn = [((bx - 10) * s, 46 * s), ((bx + 10) * s, 46 * s), ((bx + side * 18) * s, 4 * s)]
        d.polygon(horn, fill=(255, 150, 40, 255))
        d.polygon([((bx - 6.5) * s, 32 * s), ((bx + 6.5) * s, 32 * s), ((bx + side * 18) * s, 4 * s)], fill=(255, 214, 70, 255))
        d.polygon([((bx - 3) * s, 20 * s), ((bx + 3) * s, 20 * s), ((bx + side * 18) * s, 4 * s)], fill=(255, 250, 240, 255))
        d.line(horn + [horn[0]], fill=INK, width=4 * s, joint="curve")
    # dark frosted frame
    frame = arch_poly(6 * s, 26 * s, 130 * s, 182 * s, 60 * s)
    shade(img, frame, (88, 52, 120), (40, 20, 60))
    outline(d, frame, 5 * s)
    # door
    panel = arch_poly(24 * s, 46 * s, 112 * s, 180 * s, 44 * s)
    shade(img, panel, (54, 22, 48), (24, 8, 22))
    outline(d, panel, 4 * s)
    for x in (53, 83):
        d.line([(x * s, 70 * s), (x * s, 178 * s)], fill=(14, 4, 12, 255), width=3 * s)
    # icy frosting drips over the arch
    rnd = random.Random(3)
    pts = []
    for i in range(61):
        a = math.pi + math.pi * i / 60
        pts.append((68 * s + math.cos(a) * 62 * s, 86 * s + math.sin(a) * 62 * s))
    d.line(pts, fill=(200, 240, 255, 255), width=9 * s, joint="curve")
    for i in range(4, 58, 6):
        x, y = pts[i]
        L = rnd.uniform(6, 16) * s
        d.rounded_rectangle([x - 2.5 * s, y, x + 2.5 * s, y + L], radius=2.5 * s, fill=(200, 240, 255, 255))
        d.ellipse([x - 3.5 * s, y + L - 3 * s, x + 3.5 * s, y + L + 4 * s], fill=(200, 240, 255, 255))
    d.line(pts, fill=(255, 255, 255, 200), width=3 * s, joint="curve")
    # red licorice bars (X)
    for (a, b) in [((30, 96), (106, 172)), ((106, 96), (30, 172))]:
        d.line([(a[0] * s, a[1] * s), (b[0] * s, b[1] * s)], fill=INK, width=13 * s)
        d.line([(a[0] * s, a[1] * s), (b[0] * s, b[1] * s)], fill=(200, 24, 48, 255), width=8 * s)
        for k in range(1, 9):
            t = k / 9
            x = a[0] + (b[0] - a[0]) * t
            y = a[1] + (b[1] - a[1]) * t
            d.line([((x - 2) * s, (y - 2) * s), ((x + 2) * s, (y + 2) * s)], fill=(255, 110, 120, 255), width=2 * s)
    # friendly candy skull on top
    cx, cy = 68 * s, 70 * s
    d.ellipse([cx - 19 * s, cy - 17 * s, cx + 19 * s, cy + 15 * s], fill=(252, 248, 240, 255), outline=INK, width=4 * s)
    d.rounded_rectangle([cx - 11 * s, cy + 8 * s, cx + 11 * s, cy + 22 * s], radius=4 * s, fill=(252, 248, 240, 255), outline=INK, width=4 * s)
    for tx in (-5, 0, 5):
        d.line([(cx + tx * s, cy + 14 * s), (cx + tx * s, cy + 21 * s)], fill=INK, width=2 * s)
    for ex in (-8, 8):  # pink candy eyes
        d.ellipse([cx + (ex - 6) * s, cy - 7 * s, cx + (ex + 6) * s, cy + 5 * s], fill=(255, 77, 140, 255), outline=INK, width=3 * s)
        d.ellipse([cx + (ex - 3) * s, cy - 5 * s, cx + (ex) * s, cy - 2 * s], fill=(255, 255, 255, 230))
    d.polygon([(cx - 2 * s, cy + 6 * s), (cx + 2 * s, cy + 6 * s), (cx, cy + 9 * s)], fill=INK)
    # ribbon bow padlock in the middle
    bx, by = 68 * s, 134 * s
    for side in (-1, 1):
        loop = [(bx, by), (bx + side * 24 * s, by - 13 * s), (bx + side * 26 * s, by + 9 * s)]
        d.polygon(loop, fill=(255, 77, 140, 255))
        d.line(loop + [loop[0]], fill=INK, width=4 * s, joint="curve")
        tail = [(bx, by + 4 * s), (bx + side * 12 * s, by + 26 * s), (bx + side * 5 * s, by + 24 * s)]
        d.polygon(tail, fill=(230, 50, 110, 255))
        d.line(tail + [tail[0]], fill=INK, width=3 * s, joint="curve")
    d.arc([bx - 8 * s, by - 2 * s, bx + 8 * s, by + 16 * s], 180, 360, fill=(230, 210, 120, 255), width=4 * s)
    d.rounded_rectangle([bx - 11 * s, by + 6 * s, bx + 11 * s, by + 24 * s], radius=3 * s, fill=(255, 210, 70, 255), outline=INK, width=3 * s)
    d.ellipse([bx - 3 * s, by + 11 * s, bx + 3 * s, by + 17 * s], fill=INK)
    d.ellipse([bx - 7 * s, by - 5 * s, bx + 7 * s, by + 7 * s], fill=(255, 120, 170, 255), outline=INK, width=3 * s)
    # sugar sparkle on the frost
    for _ in range(26):
        x = rnd.uniform(10, 126) * s
        y = rnd.uniform(40, 178) * s
        if 22 * s < x < 114 * s and y > 46 * s:
            continue
        d.ellipse([x, y, x + 2 * s, y + 2 * s], fill=(220, 245, 255, 220))
    finish(img, W, H, "door-boss.png")


if __name__ == "__main__":
    room_door()
    boss_door()

#!/usr/bin/env python3
"""
Per-level hub doors for Sugar Shuffle Infinity, drawn in code (no AI or
third-party art). Same chunky ink outline + soft shading as make-doors.py.

  room doors: public/game/sprites/doors/door-<theme>.png       92x144 (shown 46x72)
  boss doors: public/game/sprites/doors/door-boss-<boss>.png  136x184 (shown 68x92)

  python3 scripts/art/make-level-doors.py
"""
import importlib.util, math, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(__file__)
spec = importlib.util.spec_from_file_location("doors_base", os.path.join(HERE, "make-doors.py"))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
arch_poly, shade, outline, candy_cane, wavy = base.arch_poly, base.shade, base.outline, base.candy_cane, base.wavy

OUT = os.path.join(HERE, "..", "..", "public", "game", "sprites", "doors")
S = 4
INK = (34, 18, 14, 255)
FONT = "/usr/share/fonts/truetype/sand-box/google/Lilita One/LilitaOne-Regular.ttf"


def C(c, a=255):
    return tuple(c[:3]) + (a,)


def P(*xy):
    """scale a flat list of coords to supersampled pixels"""
    return [v * S for v in xy]


def rect_poly(x0, y0, x1, y1):
    return [(x0 * S, y0 * S), (x1 * S, y0 * S), (x1 * S, y1 * S), (x0 * S, y1 * S)]


def arch(x0, y0, x1, y1, r):
    return arch_poly(x0 * S, y0 * S, x1 * S, y1 * S, r * S)


def fillpoly(img, poly, top, bottom, w=4):
    shade(img, poly, top, bottom)
    outline(ImageDraw.Draw(img), poly, w * S)


def text(d, xy, s, size, fill, stroke=INK):
    f = ImageFont.truetype(FONT, size * S)
    d.text((xy[0] * S, xy[1] * S), s, font=f, fill=fill, anchor="mm", stroke_width=max(1, size // 6) * S, stroke_fill=stroke)


def window(d, cx, cy, r, rim=(255, 252, 246), glass=(255, 236, 160)):
    d.ellipse(P(cx - r - 3, cy - r - 3, cx + r + 3, cy + r + 3), fill=C(rim), outline=INK, width=3 * S)
    d.ellipse(P(cx - r, cy - r, cx + r, cy + r), fill=C(glass))
    d.line(P(cx - r * 0.5, cy - r * 0.3, cx - r * 0.1, cy - r * 0.7), fill=(255, 255, 255, 200), width=2 * S)


def knob(d, x, y, col=(255, 214, 80)):
    d.ellipse(P(x - 4, y - 4, x + 4, y + 4), fill=C(col), outline=INK, width=2 * S)


def planks(d, xs, y0, y1, col=(52, 26, 14)):
    for x in xs:
        d.line(P(x, y0, x, y1), fill=C(col), width=2 * S)


def canvas(w, h):
    return Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))


def save(img, w, h, name):
    os.makedirs(OUT, exist_ok=True)
    img.resize((w, h), Image.LANCZOS).save(os.path.join(OUT, name + ".png"), optimize=True)


W, H = 92, 144
BW, BH = 136, 184


# ------------------------------------------------------------------ room doors
def door_candy_corn():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    fr = arch(8, 10, 84, 142, 38)
    fillpoly(img, fr, (255, 250, 236), (255, 250, 236))
    # candy-corn bands (white top, orange middle, yellow base)
    mask = Image.new("L", img.size, 0); ImageDraw.Draw(mask).polygon(fr, fill=255)
    bands = Image.new("RGBA", img.size, (0, 0, 0, 0)); bd = ImageDraw.Draw(bands)
    bd.rectangle(P(0, 50, 92, 100), fill=(255, 140, 30, 255)); bd.rectangle(P(0, 100, 92, 144), fill=(255, 210, 60, 255))
    img.paste(bands, (0, 0), Image.composite(bands.split()[3], Image.new("L", img.size, 0), mask))
    outline(d, fr, 4 * S)
    pn = arch(22, 34, 70, 140, 24); fillpoly(img, pn, (150, 90, 40), (100, 56, 24), 3)
    planks(d, (38, 54), 52, 138)
    window(d, 46, 60, 9)
    knob(d, 62, 98)
    return img


def door_marshmallow():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    for (x, y, r) in [(18, 40, 16), (46, 24, 20), (74, 40, 16), (10, 80, 12), (82, 80, 12), (10, 120, 12), (82, 120, 12)]:
        d.ellipse(P(x - r, y - r, x + r, y + r), fill=(255, 228, 238, 255), outline=INK, width=3 * S)
    fr = arch(8, 26, 84, 142, 36); fillpoly(img, fr, (255, 222, 236), (240, 176, 206))
    pn = arch(22, 42, 70, 140, 24); fillpoly(img, pn, (214, 150, 96), (170, 104, 60), 3)  # toasted
    for (x, y) in [(30, 70), (56, 92), (36, 118)]:
        d.ellipse(P(x - 5, y - 3, x + 5, y + 3), fill=(120, 66, 34, 180))
    window(d, 46, 66, 9, rim=(255, 236, 244))
    knob(d, 62, 104, (255, 160, 200))
    return img


def door_lollipop():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    fr = arch(14, 30, 78, 142, 32); fillpoly(img, fr, (150, 100, 60), (110, 70, 40))  # trunk
    for y in range(44, 140, 10):
        d.arc(P(16, y - 4, 76, y + 4), 0, 180, fill=(90, 56, 30, 255), width=2 * S)
    # lollipop crown
    cx, cy = 46, 30
    for k, col in enumerate([(255, 80, 140), (255, 250, 240), (120, 200, 255), (255, 250, 240), (255, 80, 140)]):
        r = 28 - k * 5
        d.ellipse(P(cx - r, cy - r, cx + r, cy + r), fill=C(col))
    d.ellipse(P(cx - 28, cy - 28, cx + 28, cy + 28), outline=INK, width=3 * S)
    pn = arch(28, 66, 64, 140, 18); fillpoly(img, pn, (90, 54, 30), (60, 34, 18), 3)
    for (x, y) in [(10, 140), (82, 140)]:
        d.polygon(P(x - 10, y, x + 10, y, x, y - 18), fill=(110, 220, 130, 255), outline=INK)
    knob(d, 56, 108, (120, 220, 140))
    return img


def door_mountain():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    rock = [(2 * S, 142 * S), (10 * S, 40 * S), (30 * S, 14 * S), (52 * S, 6 * S), (76 * S, 24 * S), (90 * S, 60 * S), (90 * S, 142 * S)]
    fillpoly(img, rock, (226, 166, 86), (170, 110, 50))
    d.polygon([(22 * S, 24 * S), (30 * S, 14 * S), (52 * S, 6 * S), (76 * S, 24 * S), (64 * S, 30 * S), (50 * S, 22 * S), (36 * S, 30 * S)], fill=(255, 255, 255, 255), outline=INK)
    for (x0, y0, x1, y1) in [(12, 60, 22, 66), (70, 70, 84, 78), (14, 110, 24, 118), (72, 116, 86, 122)]:
        d.line(P(x0, y0, x1, y1), fill=(130, 80, 34, 255), width=2 * S)
    pn = arch(24, 52, 68, 140, 22); fillpoly(img, pn, (40, 26, 20), (20, 12, 10), 3)  # cave mouth
    d.rounded_rectangle(P(26, 84, 66, 140), 4 * S, fill=(130, 84, 44, 255), outline=INK, width=3 * S)  # wooden mine door
    planks(d, (39, 53), 86, 138)
    d.line(P(26, 100, 66, 100), fill=INK, width=2 * S)
    window(d, 46, 70, 7, glass=(255, 214, 120))
    knob(d, 60, 116)
    return img


def door_desert():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    fr = [(6 * S, 142 * S), (6 * S, 30 * S), (16 * S, 18 * S), (76 * S, 18 * S), (86 * S, 30 * S), (86 * S, 142 * S)]
    fillpoly(img, fr, (246, 212, 160), (214, 170, 110))  # sugar adobe
    for x in (16, 34, 52, 70):
        d.ellipse(P(x - 3, 22, x + 3, 28), fill=(160, 110, 60, 255), outline=INK, width=S)  # vigas
    pn = arch(24, 40, 68, 140, 22); fillpoly(img, pn, (60, 140, 160), (36, 96, 116), 3)
    planks(d, (39, 53), 56, 138, (24, 64, 80))
    # pink candy cactus
    d.rounded_rectangle(P(74, 76, 86, 142), 6 * S, fill=(240, 110, 150, 255), outline=INK, width=2 * S)
    d.rounded_rectangle(P(80, 92, 92, 100), 4 * S, fill=(240, 110, 150, 255), outline=INK, width=2 * S)
    window(d, 46, 62, 8, glass=(255, 220, 150))
    knob(d, 60, 104)
    return img


def door_barn():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    fr = [(4 * S, 142 * S), (4 * S, 44 * S), (46 * S, 8 * S), (88 * S, 44 * S), (88 * S, 142 * S)]
    fillpoly(img, fr, (210, 60, 50), (160, 36, 30))
    d.line([(4 * S, 44 * S), (46 * S, 8 * S), (88 * S, 44 * S)], fill=(255, 250, 240, 255), width=4 * S)
    d.rectangle(P(18, 56, 74, 140), fill=(190, 46, 40, 255), outline=(255, 250, 240, 255), width=4 * S)
    d.line(P(20, 58, 72, 138), fill=(255, 250, 240, 255), width=4 * S)
    d.line(P(72, 58, 20, 138), fill=(255, 250, 240, 255), width=4 * S)
    d.rectangle(P(16, 54, 76, 142), outline=INK, width=2 * S)
    # cookie hay-loft window
    d.ellipse(P(34, 22, 58, 46), fill=(214, 160, 90, 255), outline=INK, width=3 * S)
    for (x, y) in [(40, 30), (50, 36), (44, 40), (52, 28)]:
        d.ellipse(P(x - 2, y - 2, x + 2, y + 2), fill=(80, 44, 24, 255))
    return img


def door_sheriff():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    fr = rect_poly(8, 16, 84, 142); fillpoly(img, fr, (140, 90, 50), (100, 62, 34))
    d.rectangle(P(4, 10, 88, 22), fill=(110, 70, 40, 255), outline=INK, width=3 * S)
    pn = rect_poly(20, 30, 72, 140); fillpoly(img, pn, (170, 220, 70), (120, 176, 40), 3)  # sour lime paint
    planks(d, (37, 55), 32, 138, (80, 120, 30))
    # wanted poster
    d.rectangle(P(28, 48, 64, 92), fill=(246, 230, 190, 255), outline=INK, width=2 * S)
    text(d, (46, 56), "WANTED", 8, (150, 40, 30, 255), stroke=(246, 230, 190, 255))
    d.ellipse(P(38, 62, 54, 80), fill=(190, 230, 80, 255), outline=INK, width=2 * S)  # sour candy face
    d.ellipse(P(42, 68, 45, 71), fill=INK); d.ellipse(P(48, 68, 51, 71), fill=INK)
    d.arc(P(42, 70, 50, 78), 200, 340, fill=INK, width=S)
    # sheriff star
    cx, cy, r = 46, 112, 10
    pts = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5
        rr = r if k % 2 == 0 else r * 0.45
        pts.append(((cx + math.cos(a) * rr) * S, (cy + math.sin(a) * rr) * S))
    d.polygon(pts, fill=(255, 210, 70, 255), outline=INK)
    knob(d, 64, 104)
    return img


def door_tent():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    tent = [(2 * S, 142 * S), (46 * S, 6 * S), (90 * S, 142 * S)]
    fillpoly(img, tent, (250, 200, 110), (214, 150, 60))
    for k in range(1, 4):
        d.line([(46 * S, 6 * S), ((2 + k * 22) * S, 142 * S)], fill=(200, 130, 50, 255), width=2 * S)
    flap = [(46 * S, 40 * S), (22 * S, 142 * S), (70 * S, 142 * S)]
    fillpoly(img, flap, (110, 60, 30), (70, 36, 18), 3)
    d.polygon([(46 * S, 40 * S), (30 * S, 142 * S), (22 * S, 142 * S)], fill=(240, 180, 90, 255), outline=INK)  # tied-back flap
    d.ellipse(P(42, 2, 50, 10), fill=(255, 90, 120, 255), outline=INK, width=2 * S)
    d.line(P(46, 2, 46, -6), fill=INK, width=2 * S)
    window(d, 46, 84, 6, glass=(255, 214, 120))
    return img


def door_ruins():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    fr = arch(6, 14, 86, 142, 40); fillpoly(img, fr, (156, 116, 172), (110, 76, 126))
    for y in range(26, 142, 16):
        off = 8 if (y // 16) % 2 else 0
        for x in range(6 + off, 86, 20):
            d.rectangle(P(x, y, x + 18, y + 14), outline=(80, 50, 96, 255), width=S)
    pn = arch(24, 40, 68, 140, 22); fillpoly(img, pn, (40, 24, 40), (20, 10, 20), 3)
    d.line(P(36, 48, 30, 70, 40, 90), fill=(90, 60, 100, 255), width=2 * S)  # crack
    for (x, y) in [(14, 30), (20, 56), (76, 36), (72, 70), (12, 100), (80, 110)]:  # vines + raisins
        d.ellipse(P(x - 5, y - 3, x + 5, y + 3), fill=(70, 30, 70, 255), outline=INK, width=S)
    d.line(P(10, 20, 14, 40, 20, 56, 14, 80, 12, 100), fill=(100, 170, 90, 255), width=3 * S)
    d.line(P(80, 22, 76, 36, 72, 70, 80, 110), fill=(100, 170, 90, 255), width=3 * S)
    d.ellipse(P(40, 56, 52, 68), fill=(255, 200, 90, 255), outline=INK, width=2 * S)  # glowing rune
    return img


def door_city():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    fr = rect_poly(6, 20, 86, 142); fillpoly(img, fr, (150, 156, 170), (110, 116, 130))
    for y in range(28, 142, 10):
        d.line(P(6, y, 86, y), fill=(120, 126, 140, 255), width=S)
    pn = rect_poly(22, 44, 70, 140); fillpoly(img, pn, (70, 120, 200), (40, 80, 150), 3)  # steel door
    d.rectangle(P(28, 54, 64, 76), fill=(170, 220, 255, 255), outline=INK, width=2 * S)
    d.line(P(22, 100, 70, 100), fill=(30, 50, 100, 255), width=3 * S)
    knob(d, 62, 112, (220, 220, 230))
    # neon sign
    d.rounded_rectangle(P(8, 4, 84, 20), 4 * S, fill=(30, 20, 40, 255), outline=INK, width=2 * S)
    text(d, (46, 12), "SMASH", 11, (255, 90, 200, 255), stroke=(80, 0, 60, 255))
    return img


def door_saloon():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    fr = rect_poly(4, 18, 88, 142); fillpoly(img, fr, (120, 70, 36), (86, 48, 24))
    d.rectangle(P(0, 8, 92, 24), fill=(150, 90, 46, 255), outline=INK, width=3 * S)
    text(d, (46, 16), "SALOON", 10, (255, 214, 120, 255))
    d.rectangle(P(16, 28, 76, 142), fill=(40, 22, 18, 255), outline=INK, width=2 * S)  # dark inside
    d.ellipse(P(36, 34, 56, 48), fill=(255, 210, 120, 120))  # warm lamp glow inside
    # swinging batwing doors (half height, gap in the middle)
    for side in (-1, 1):
        x0, x1 = (18, 45) if side < 0 else (47, 74)
        top = [(x0 * S, 70 * S), (x1 * S, 70 * S), (x1 * S, 112 * S), (x0 * S, 112 * S)]
        if side < 0:
            top = [(x0 * S, 64 * S), (x1 * S, 72 * S), (x1 * S, 112 * S), (x0 * S, 112 * S)]
        else:
            top = [(x0 * S, 72 * S), (x1 * S, 64 * S), (x1 * S, 112 * S), (x0 * S, 112 * S)]
        fillpoly(img, top, (196, 130, 70), (150, 92, 46), 3)
        for k in range(1, 4):
            x = x0 + (x1 - x0) * k / 4
            d.line(P(x, 76, x, 108), fill=(110, 64, 30, 255), width=2 * S)
    return img


def door_tv():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    d.line(P(30, 30, 18, 4), fill=INK, width=3 * S); d.line(P(62, 30, 74, 4), fill=INK, width=3 * S)  # antenna
    d.ellipse(P(14, 0, 22, 8), fill=(255, 90, 90, 255), outline=INK, width=S); d.ellipse(P(70, 0, 78, 8), fill=(90, 200, 255, 255), outline=INK, width=S)
    body = [(4 * S, 142 * S), (4 * S, 34 * S), (88 * S, 34 * S), (88 * S, 142 * S)]
    fillpoly(img, body, (196, 130, 60), (150, 92, 40))
    d.rounded_rectangle(P(12, 42, 80, 96), 10 * S, fill=(40, 40, 56, 255), outline=INK, width=3 * S)
    rnd = random.Random(4)
    for y in range(46, 92, 4):
        for x in range(16, 76, 4):
            if rnd.random() < 0.5:
                g = rnd.choice([200, 150, 100])
                d.rectangle(P(x, y, x + 4, y + 4), fill=(g, g, g + 10, 255))
    for i, col in enumerate([(255, 255, 255), (255, 230, 60), (60, 230, 230), (60, 220, 80), (230, 60, 230), (230, 50, 50), (50, 60, 230)]):
        d.rectangle(P(16 + i * 8.5, 82, 16 + (i + 1) * 8.5, 92), fill=C(col))
    d.rounded_rectangle(P(28, 104, 64, 142), 3 * S, fill=(90, 50, 24, 255), outline=INK, width=3 * S)  # the actual door
    knob(d, 58, 124)
    for (x, y) in [(16, 112), (16, 128), (76, 112)]:
        d.ellipse(P(x - 5, y - 5, x + 5, y + 5), fill=(220, 220, 220, 255), outline=INK, width=2 * S)
    return img


def door_landfill():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    fr = rect_poly(6, 30, 86, 142); fillpoly(img, fr, (70, 110, 80), (40, 70, 50))  # dumpster green
    for x in range(14, 86, 12):
        d.line(P(x, 34, x, 140), fill=(30, 56, 40, 255), width=2 * S)
    lid = [(2 * S, 30 * S), (90 * S, 30 * S), (80 * S, 12 * S), (12 * S, 18 * S)]
    fillpoly(img, lid, (60, 60, 64), (40, 40, 44), 3)
    pn = rect_poly(26, 56, 66, 140); fillpoly(img, pn, (30, 26, 30), (16, 12, 16), 3)
    for i, y in enumerate(range(60, 140, 14)):  # licorice ropes across
        d.rounded_rectangle(P(24, y, 68, y + 8), 4 * S, fill=(40, 30, 40, 255) if i % 2 else (150, 30, 50, 255), outline=INK, width=S)
    d.ellipse(P(66, 4, 84, 18), fill=(250, 220, 80, 255), outline=INK, width=2 * S)  # banana peel-ish candy wrapper
    d.polygon(P(60, 10, 66, 6, 66, 16), fill=(250, 220, 80, 255), outline=INK)
    d.polygon(P(90, 10, 84, 6, 84, 16), fill=(250, 220, 80, 255), outline=INK)
    return img


def door_factory():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    fr = rect_poly(4, 22, 88, 142); fillpoly(img, fr, (120, 130, 146), (90, 98, 112))
    d.rectangle(P(4, 22, 88, 32), fill=(80, 86, 98, 255), outline=INK, width=2 * S)
    pn = rect_poly(16, 36, 76, 140); fillpoly(img, pn, (170, 176, 186), (130, 136, 148), 3)  # roller shutter
    for y in range(40, 140, 7):
        d.line(P(16, y, 76, y), fill=(100, 106, 118, 255), width=2 * S)
    d.rectangle(P(38, 130, 54, 136), fill=(60, 60, 70, 255), outline=INK, width=S)
    # gear sign with a cube
    cx, cy = 46, 12
    for k in range(8):
        a = k * math.pi / 4
        d.line(P(cx, cy, cx + math.cos(a) * 12, cy + math.sin(a) * 12), fill=(255, 200, 60, 255), width=5 * S)
    d.ellipse(P(cx - 9, cy - 9, cx + 9, cy + 9), fill=(255, 200, 60, 255), outline=INK, width=2 * S)
    d.rectangle(P(cx - 4, cy - 4, cx + 4, cy + 4), fill=(255, 244, 214, 255), outline=INK, width=S)
    return img


def door_lab():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    fr = rect_poly(6, 14, 86, 142); fillpoly(img, fr, (220, 240, 240), (180, 210, 214))
    pn = rect_poly(20, 26, 72, 140); fillpoly(img, pn, (70, 190, 180), (40, 140, 136), 3)
    window(d, 46, 54, 12, rim=(200, 210, 220), glass=(160, 255, 200))
    for (x, y, r) in [(42, 52, 3), (50, 58, 2), (46, 46, 2)]:
        d.ellipse(P(x - r, y - r, x + r, y + r), fill=(255, 255, 255, 220))
    d.rectangle(P(26, 84, 66, 96), fill=(255, 230, 60, 255), outline=INK, width=2 * S)
    text(d, (46, 90), "LAB", 9, (40, 40, 40, 255), stroke=(255, 230, 60, 255))
    # slime drips over the top
    d.rectangle(P(6, 10, 86, 18), fill=(120, 230, 90, 255))
    for x in (12, 30, 52, 74):
        d.rounded_rectangle(P(x, 14, x + 7, 24 + (x % 9)), 3 * S, fill=(120, 230, 90, 255))
    knob(d, 64, 112, (210, 220, 230))
    return img


def door_music_box():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    lid = [(4 * S, 40 * S), (14 * S, 10 * S), (78 * S, 10 * S), (88 * S, 40 * S)]
    fillpoly(img, lid, (230, 170, 70), (196, 130, 50), 3)
    d.ellipse(P(38, 16, 54, 32), fill=(255, 190, 220, 255), outline=INK, width=2 * S)  # ballerina-ish candy
    fr = rect_poly(4, 40, 88, 142); fillpoly(img, fr, (210, 150, 60), (160, 104, 40))
    pn = rect_poly(22, 56, 70, 140); fillpoly(img, pn, (110, 40, 80), (70, 20, 50), 3)
    for x in range(26, 70, 6):  # piano-key trim
        d.rectangle(P(x, 132, x + 5, 140), fill=(250, 246, 236, 255), outline=INK, width=S)
    for (x, y) in [(36, 76), (54, 92)]:
        d.ellipse(P(x - 5, y - 3, x + 3, y + 4), fill=(255, 220, 120, 255))
        d.line(P(x + 2, y, x + 2, y - 14), fill=(255, 220, 120, 255), width=2 * S)
    # wind-up key on the side
    d.line(P(88, 90, 92, 90), fill=INK, width=3 * S)
    d.ellipse(P(84, 76, 92, 88), outline=(255, 214, 80, 255), width=3 * S)
    d.ellipse(P(84, 92, 92, 104), outline=(255, 214, 80, 255), width=3 * S)
    knob(d, 62, 110)
    return img


def door_pizza():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    fr = rect_poly(6, 30, 86, 142); fillpoly(img, fr, (196, 70, 50), (150, 46, 30))
    for y in range(36, 142, 10):
        for x in range(6 + (y // 10 % 2) * 10, 86, 20):
            d.rectangle(P(x, y, x + 18, y + 8), outline=(120, 30, 20, 255), width=S)
    # striped awning
    for k in range(6):
        col = (255, 250, 240) if k % 2 else (60, 160, 70)
        d.polygon(P(4 + k * 14, 18, 18 + k * 14, 18, 18 + k * 14, 34, 4 + k * 14, 34), fill=C(col), outline=INK)
    d.rectangle(P(4, 12, 88, 18), fill=(60, 160, 70, 255), outline=INK, width=2 * S)
    pn = rect_poly(24, 50, 68, 140); fillpoly(img, pn, (110, 60, 30), (70, 36, 18), 3)
    # pizza slice sign on the door
    d.polygon(P(46, 92, 32, 62, 60, 62), fill=(255, 206, 90, 255), outline=INK)
    d.line(P(32, 62, 60, 62), fill=(214, 150, 70, 255), width=4 * S)
    for (x, y) in [(42, 70), (50, 74), (46, 82)]:
        d.ellipse(P(x - 3, y - 3, x + 3, y + 3), fill=(196, 40, 40, 255))
    knob(d, 62, 112)
    return img


def door_bomb():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    fr = rect_poly(6, 14, 86, 142); fillpoly(img, fr, (90, 90, 100), (60, 60, 70))
    cx, cy = 46, 84
    d.ellipse(P(cx - 36, cy - 36, cx + 36, cy + 36), fill=(130, 136, 146, 255), outline=INK, width=4 * S)  # vault
    d.ellipse(P(cx - 26, cy - 26, cx + 26, cy + 26), fill=(100, 106, 116, 255), outline=INK, width=2 * S)
    for k in range(6):
        a = k * math.pi / 3
        d.line(P(cx, cy, cx + math.cos(a) * 20, cy + math.sin(a) * 20), fill=(200, 200, 210, 255), width=4 * S)
    d.ellipse(P(cx - 6, cy - 6, cx + 6, cy + 6), fill=(200, 200, 210, 255), outline=INK, width=2 * S)
    d.rounded_rectangle(P(22, 20, 70, 40), 3 * S, fill=(20, 16, 16, 255), outline=INK, width=2 * S)  # countdown
    text(d, (46, 30), "0:91", 13, (255, 80, 50, 255), stroke=(60, 10, 0, 255))
    # fuse
    d.line(P(80, 20, 86, 6, 90, 4), fill=(200, 170, 120, 255), width=3 * S)
    d.ellipse(P(86, 0, 92, 6), fill=(255, 200, 60, 255))
    return img


def door_crypt():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    fr = arch(8, 12, 84, 142, 38); fillpoly(img, fr, (150, 150, 156), (100, 100, 108))
    for (x0, y0, x1, y1) in [(14, 60, 22, 76), (70, 40, 78, 50), (12, 110, 20, 124)]:
        d.line(P(x0, y0, x1, y1), fill=(80, 80, 88, 255), width=2 * S)
    pn = arch(24, 36, 68, 140, 22); fillpoly(img, pn, (60, 50, 60), (30, 24, 30), 3)
    d.rectangle(P(42, 50, 50, 80), fill=(200, 200, 206, 255), outline=INK, width=S)  # cross
    d.rectangle(P(34, 58, 58, 64), fill=(200, 200, 206, 255), outline=INK, width=S)
    text(d, (46, 24), "RIP", 10, (220, 220, 226, 255))
    # moss + little ghost peeking
    d.line(P(8, 140, 20, 130, 30, 140), fill=(120, 130, 80, 255), width=4 * S)
    d.ellipse(P(60, 98, 78, 120), fill=(240, 244, 255, 230), outline=INK, width=2 * S)
    d.ellipse(P(64, 104, 67, 108), fill=INK); d.ellipse(P(71, 104, 74, 108), fill=INK)
    return img


def door_summit():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    fr = arch(6, 24, 86, 142, 40); fillpoly(img, fr, (170, 220, 245), (120, 180, 220))  # ice blocks
    for y in range(36, 142, 18):
        d.line(P(8, y, 84, y), fill=(100, 160, 200, 255), width=S)
    pn = arch(24, 46, 68, 140, 22); fillpoly(img, pn, (226, 170, 80), (190, 130, 50), 3)  # butterscotch door
    planks(d, (39, 53), 62, 138, (150, 100, 40))
    d.ellipse(P(10, 16, 82, 36), fill=(255, 255, 255, 255), outline=INK, width=2 * S)  # snow cap
    # summit flag
    d.line(P(70, 18, 70, -0), fill=INK, width=2 * S)
    d.polygon(P(70, 0, 88, 5, 70, 10), fill=(255, 90, 120, 255), outline=INK)
    window(d, 46, 70, 8, glass=(255, 236, 170))
    knob(d, 60, 108)
    return img


def door_pumpkin():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    d.rounded_rectangle(P(40, 0, 52, 16), 3 * S, fill=(80, 120, 40, 255), outline=INK, width=2 * S)
    for (x0, x1) in [(2, 50), (42, 90), (16, 76)]:
        d.ellipse(P(x0, 10, x1, 142), fill=(230, 110, 30, 255), outline=INK, width=3 * S)
    for (x, y, r) in [(18, 40, 7), (74, 56, 6), (24, 112, 8)]:  # rot spots
        d.ellipse(P(x - r, y - r * 0.7, x + r, y + r * 0.7), fill=(90, 80, 30, 255))
    d.polygon(P(26, 46, 38, 36, 40, 52), fill=(255, 220, 90, 255), outline=INK)  # eyes glow
    d.polygon(P(66, 46, 54, 36, 52, 52), fill=(255, 220, 90, 255), outline=INK)
    mouth = arch(28, 70, 64, 138, 18); fillpoly(img, mouth, (60, 20, 10), (30, 8, 4), 3)  # doorway = mouth
    for x in (34, 46, 58):
        d.polygon(P(x - 4, 76, x + 4, 76, x, 86), fill=(230, 110, 30, 255), outline=INK)
    d.ellipse(P(36, 104, 56, 124), fill=(255, 200, 80, 90))
    return img


def door_admin():
    img = canvas(W, H); d = ImageDraw.Draw(img)
    fr = rect_poly(4, 14, 88, 142); fillpoly(img, fr, (60, 40, 100), (30, 18, 56))
    for (x0, y0, x1, y1) in [(8, 40, 20, 40), (20, 40, 20, 90), (84, 60, 72, 60), (72, 60, 72, 120)]:
        d.line(P(x0, y0, x1, y1), fill=(255, 210, 90, 255), width=2 * S)
    pn = rect_poly(24, 30, 68, 140); fillpoly(img, pn, (30, 20, 50), (14, 8, 24), 3)
    d.line(P(46, 30, 46, 140), fill=(255, 210, 90, 255), width=2 * S)  # sliding blast door seam
    d.ellipse(P(32, 52, 60, 80), fill=(200, 120, 255, 255), outline=INK, width=3 * S)  # admin orb
    d.ellipse(P(40, 58, 48, 66), fill=(255, 255, 255, 220))
    d.rectangle(P(4, 4, 88, 16), fill=(255, 210, 90, 255), outline=INK, width=2 * S)
    text(d, (46, 10), "ADMIN", 9, (40, 20, 60, 255), stroke=(255, 210, 90, 255))
    for k, col in enumerate([(255, 90, 90), (255, 210, 90), (90, 255, 140)]):
        d.ellipse(P(30 + k * 12, 110, 36 + k * 12, 116), fill=C(col), outline=INK, width=S)
    return img


# ------------------------------------------------------------------ boss doors (136x184)
def boss_frame(img, top, bottom, panel_top, panel_bottom):
    fr = arch(6, 26, 130, 182, 60); fillpoly(img, fr, top, bottom, 5)
    pn = arch(24, 46, 112, 180, 44); fillpoly(img, pn, panel_top, panel_bottom, 4)
    return ImageDraw.Draw(img)


def boss_choco():
    img = canvas(BW, BH)
    d = boss_frame(img, (150, 86, 46), (100, 54, 26), (110, 60, 32), (70, 36, 18))
    for y in range(70, 180, 26):
        for x in (30, 68):
            d.rectangle(P(x, y, x + 36, y + 22), fill=(130, 72, 40, 255), outline=(60, 30, 14, 255), width=2 * S)
    d.ellipse(P(44, 60, 92, 108), fill=(150, 86, 46, 255), outline=INK, width=4 * S)  # Choco Man face
    for ex in (58, 78):
        d.ellipse(P(ex - 6, 74, ex + 6, 86), fill=(255, 255, 255, 255), outline=INK, width=2 * S)
        d.ellipse(P(ex - 2, 78, ex + 3, 84), fill=INK)
    d.arc(P(56, 84, 80, 102), 20, 160, fill=INK, width=3 * S)
    for (x, y) in [(20, 40), (116, 40)]:  # boxing gloves
        d.ellipse(P(x - 14, y - 14, x + 14, y + 14), fill=(220, 40, 50, 255), outline=INK, width=3 * S)
    d.line(P(24, 30, 112, 30), fill=(120, 60, 30, 255), width=6 * S)
    return img


def boss_outlaw():
    # Wanted poster of the redesigned Outlaw (scripts/art/make-outlaw.py): gray
    # cowboy hat, roasted-black marshmallow face, red glowing eyes and a
    # green-and-purple bandana over his mouth.
    img = canvas(BW, BH)
    d = boss_frame(img, (190, 140, 90), (140, 96, 56), (250, 244, 230), (220, 206, 180))
    d.polygon(P(20, 34, 116, 34, 104, 16, 86, 22, 68, 6, 50, 22, 32, 16), fill=(150, 148, 144, 255), outline=INK)  # gray hat brim
    d.rectangle(P(20, 30, 116, 38), fill=(108, 106, 104, 255), outline=INK, width=2 * S)
    d.rectangle(P(40, 70, 96, 124), fill=(246, 230, 190, 255), outline=INK, width=3 * S)
    text(d, (68, 80), "WANTED", 12, (160, 40, 30, 255), stroke=(246, 230, 190, 255))
    d.rounded_rectangle(P(54, 88, 82, 120), 6 * S, fill=(40, 32, 30, 255), outline=(150, 90, 40, 255), width=2 * S)  # charred face
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for x in (62, 74):
        gd.ellipse(P(x - 5, 92, x + 5, 102), fill=(255, 40, 30, 150))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(3 * S)))
    d = ImageDraw.Draw(img)
    for x in (62, 74):
        d.ellipse(P(x - 2.5, 95.5, x + 2.5, 98.5), fill=(255, 50, 40, 255))
    d.polygon(P(54, 102, 82, 102, 70, 118, 66, 118), fill=(60, 176, 84, 255), outline=INK)  # bandana
    for k in range(3):
        x = 63 + k * 6
        d.line(P(x, 104, x - 3, 110), fill=(136, 70, 196, 255), width=2 * S)
    d.rectangle(P(54, 101, 82, 104), fill=(84, 38, 130, 255))
    for (x0, y0, x1, y1) in [(28, 140, 108, 140), (28, 160, 108, 160)]:
        d.line(P(x0, y0, x1, y1), fill=(170, 120, 60, 255), width=4 * S)  # rope
    return img


def boss_fake_cubro():
    img = canvas(BW, BH)
    d = boss_frame(img, (110, 50, 150), (60, 20, 90), (40, 16, 56), (20, 6, 30))
    d.rounded_rectangle(P(36, 140, 100, 152), 6 * S, fill=(140, 60, 190, 255), outline=INK, width=3 * S)  # skateboard
    for x in (46, 90):
        d.ellipse(P(x - 6, 150, x + 6, 162), fill=(255, 90, 220, 255), outline=INK, width=2 * S)
    d.rounded_rectangle(P(44, 66, 92, 114), 8 * S, fill=(150, 80, 210, 255), outline=INK, width=4 * S)  # cursed cube
    d.rectangle(P(48, 80, 88, 92), fill=(30, 10, 40, 255))  # visor shades
    d.ellipse(P(54, 82, 62, 90), fill=(255, 60, 220, 255)); d.ellipse(P(74, 82, 82, 90), fill=(255, 60, 220, 255))
    rnd = random.Random(9)
    for _ in range(8):
        y = rnd.uniform(50, 176); x = rnd.uniform(26, 90)
        d.rectangle(P(x, y, x + rnd.uniform(8, 20), y + 2), fill=rnd.choice([(255, 60, 220, 255), (60, 255, 230, 255)]))
    return img


def boss_fake_cuboe():
    img = canvas(BW, BH)
    d = boss_frame(img, (236, 222, 190), (190, 170, 130), (90, 40, 130), (50, 20, 76))
    d.rounded_rectangle(P(42, 64, 94, 116), 8 * S, fill=(255, 244, 214, 255), outline=INK, width=4 * S)  # cursed cream cube
    d.line(P(54, 86, 64, 86), fill=INK, width=3 * S); d.line(P(72, 86, 82, 86), fill=INK, width=3 * S)  # dash eyes
    d.line(P(50, 70, 60, 90, 54, 108), fill=(150, 60, 200, 255), width=2 * S)  # crack
    d.arc(P(56, 92, 80, 108), 200, 340, fill=INK, width=2 * S)
    for k in range(10):  # laser spokes
        a = k * math.pi / 5
        d.line(P(68 + math.cos(a) * 36, 140 + math.sin(a) * 18, 68 + math.cos(a) * 46, 140 + math.sin(a) * 24), fill=(255, 90, 220, 255), width=3 * S)
    d.ellipse(P(56, 128, 80, 152), outline=(120, 220, 255, 255), width=4 * S)  # shield
    return img


def boss_warlock():
    img = canvas(BW, BH)
    d = boss_frame(img, (80, 44, 110), (40, 20, 60), (30, 14, 40), (14, 6, 20))
    # crown
    d.polygon(P(36, 30, 46, 4, 58, 24, 68, 0, 78, 24, 90, 4, 100, 30), fill=(255, 200, 60, 255), outline=INK)
    for x in (46, 68, 90):
        d.ellipse(P(x - 4, 10, x + 4, 18), fill=(200, 60, 255, 255), outline=INK, width=S)
    # candy-corn vines across the door
    pts = [((24 + t) * S, (100 + math.sin(t / 10) * 14) * S) for t in range(0, 89, 2)]
    d.line(pts, fill=(60, 140, 60, 255), width=5 * S)
    for t in range(4, 88, 14):
        x, y = 24 + t, 100 + math.sin(t / 10) * 14
        d.polygon(P(x - 6, y - 6, x + 6, y - 6, x, y + 10), fill=(255, 150, 40, 255), outline=INK)
        d.polygon(P(x - 3, y - 6, x + 3, y - 6, x, y - 1), fill=(255, 250, 240, 255))
    d.ellipse(P(54, 56, 82, 84), fill=(255, 120, 40, 255), outline=INK, width=3 * S)  # jack-o-lantern staff head
    d.polygon(P(60, 66, 66, 62, 66, 70), fill=(255, 230, 90, 255)); d.polygon(P(76, 66, 70, 62, 70, 70), fill=(255, 230, 90, 255))
    d.line(P(68, 84, 68, 176), fill=(90, 50, 30, 255), width=5 * S)
    return img


ROOM = {
    "door-candy-corn": door_candy_corn, "door-marshmallow": door_marshmallow, "door-lollipop": door_lollipop,
    "door-mountain": door_mountain, "door-desert": door_desert, "door-barn": door_barn, "door-sheriff": door_sheriff,
    "door-tent": door_tent, "door-ruins": door_ruins, "door-city": door_city, "door-saloon": door_saloon,
    "door-tv": door_tv, "door-landfill": door_landfill, "door-factory": door_factory, "door-lab": door_lab,
    "door-music-box": door_music_box, "door-pizza": door_pizza, "door-bomb": door_bomb, "door-crypt": door_crypt,
    "door-summit": door_summit, "door-pumpkin": door_pumpkin, "door-admin": door_admin,
}
BOSS = {
    "door-boss-choco": boss_choco, "door-boss-outlaw": boss_outlaw, "door-boss-fake-cubro": boss_fake_cubro,
    "door-boss-fake-cuboe": boss_fake_cuboe, "door-boss-warlock": boss_warlock,
}


def main():
    for name, fn in ROOM.items():
        save(fn(), W, H, name)
    for name, fn in BOSS.items():
        save(fn(), BW, BH, name)
    print("wrote", len(ROOM) + len(BOSS), "doors to public/game/sprites/doors/")


if __name__ == "__main__":
    main()

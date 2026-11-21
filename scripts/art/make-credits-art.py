#!/usr/bin/env python3
"""
Credits "Thanks for playing! -Cuboe and Cubro" picture, drawn in code.

Hayden's hand drawing (assets/hayden/originals/credits.jpg, kept as-is) is
redrawn here in the in-game sprite style, the same way make-candy-cube.py
redrew Candy Cube: rounded cube shapes, a chunky dark-maroon outline, soft side
shading, simple graphic faces. Colours are sampled from the in-game sheets
(public/game/sprites/cuboe-*.png and cubro-*.png).

His composition is kept: a white paper page, his words across the top
("Thanks for playing!" then "-Cuboe and Cubro"), Cuboe on the left waving one
arm high with his cap on and the star on his tummy, Cubro on the right with his
square head, sunglasses, muscles, dark shorts and a big thumbs-up.

No AI art and no third-party art. Lettering uses Lilita One, the same font the
game UI already uses (falls back to DejaVu Sans Bold).

    python3 scripts/art/make-credits-art.py
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/game/sprites/credits-cuboe-cubro.png"

W, H = 1200, 800
SS = 2  # supersample
INK = (41, 9, 33)
PAPER = (251, 248, 240)
PAPER_EDGE = (232, 224, 208)
PENCIL = (58, 52, 60)

# Cuboe (sampled from cuboe-idle / portrait)
CREAM = (252, 242, 217)
CREAM_SHADE = (228, 204, 168)
CREAM_LIT = (255, 252, 236)
CAP = (52, 46, 58)
CAP_LIT = (86, 78, 92)
EYE = (24, 14, 22)
BLUSH = (246, 170, 160)
# Cubro (sampled from cubro-idle / portrait)
BROWN = (110, 66, 42)
BROWN_LIT = (140, 88, 56)
BROWN_SHADE = (72, 42, 28)
SHORTS = (44, 36, 40)
SHORTS_LIT = (66, 56, 60)
BELT = (150, 100, 60)
GLASS = (14, 12, 14)
GLASS_LIT = (90, 96, 110)


def P(v: float) -> int:
    return int(round(v * SS))


def mask() -> Image.Image:
    return Image.new("L", (W * SS, H * SS), 0)


def rrect(box, r) -> Image.Image:
    m = mask()
    ImageDraw.Draw(m).rounded_rectangle([P(v) for v in box], radius=P(r), fill=255)
    return m


def ellipse(box) -> Image.Image:
    m = mask()
    ImageDraw.Draw(m).ellipse([P(v) for v in box], fill=255)
    return m


def poly(pts) -> Image.Image:
    m = mask()
    ImageDraw.Draw(m).polygon([(P(x), P(y)) for x, y in pts], fill=255)
    return m


def capsule(x1, y1, x2, y2, r) -> Image.Image:
    m = mask()
    d = ImageDraw.Draw(m)
    d.line([(P(x1), P(y1)), (P(x2), P(y2))], fill=255, width=P(r * 2))
    for x, y in ((x1, y1), (x2, y2)):
        d.ellipse([P(x - r), P(y - r), P(x + r), P(y + r)], fill=255)
    return m


def path_capsule(pts, r) -> Image.Image:
    out = mask()
    for (a, b) in zip(pts, pts[1:]):
        out = ImageChops.lighter(out, capsule(a[0], a[1], b[0], b[1], r))
    return out


def union(*ms) -> Image.Image:
    out = mask()
    for m in ms:
        out = ImageChops.lighter(out, m)
    return out


def inter(a, b) -> Image.Image:
    return ImageChops.multiply(a, b)


def dilate(m: Image.Image, width: float) -> Image.Image:
    k = max(3, P(width) * 2 + 1)
    return m.filter(ImageFilter.MaxFilter(k if k % 2 else k + 1))


def erode(m: Image.Image, width: float) -> Image.Image:
    k = max(3, P(width) * 2 + 1)
    return m.filter(ImageFilter.MinFilter(k if k % 2 else k + 1))


def fill(dst: Image.Image, m: Image.Image, rgb, alpha=255):
    layer = Image.new("RGBA", dst.size, tuple(rgb) + (alpha,))
    if alpha < 255:
        m = m.point(lambda v: v * alpha // 255)
    dst.paste(layer, (0, 0), m)


def side_shade(dst, m, rgb, box, from_right=True, band=0.32, soft=14):
    """Soft shading band on one side of a part, clipped to the part (like the sprites)."""
    x0, y0, x1, y1 = box
    w = (x1 - x0) * band
    s = mask()
    if from_right:
        ImageDraw.Draw(s).rectangle([P(x1 - w), P(y0 - 40), P(x1 + 40), P(y1 + 40)], fill=255)
    else:
        ImageDraw.Draw(s).rectangle([P(x0 - 40), P(y0 - 40), P(x0 + w), P(y1 + 40)], fill=255)
    s = s.filter(ImageFilter.GaussianBlur(P(soft)))
    fill(dst, inter(s, m), rgb)


def gloss(dst, m, rgb, box, soft=10):
    x0, y0, x1, y1 = box
    s = ellipse((x0 + (x1 - x0) * 0.1, y0 + (y1 - y0) * 0.06, x0 + (x1 - x0) * 0.55, y0 + (y1 - y0) * 0.32))
    s = s.filter(ImageFilter.GaussianBlur(P(soft)))
    fill(dst, inter(s, m), rgb, 150)


def part(dst, m, rgb, outline=6.0):
    fill(dst, dilate(m, outline), INK)
    fill(dst, m, rgb)


def ink_line(dst, pts, width, rgb=INK):
    d = ImageDraw.Draw(dst)
    d.line([(P(x), P(y)) for x, y in pts], fill=rgb + (255,), width=P(width), joint="curve")
    r = width / 2
    for x, y in (pts[0], pts[-1]):
        d.ellipse([P(x - r), P(y - r), P(x + r), P(y + r)], fill=rgb + (255,))


def arc_line(dst, box, start, end, width, rgb=INK):
    ImageDraw.Draw(dst).arc([P(v) for v in box], start, end, fill=rgb + (255,), width=P(width))


def star_pts(cx, cy, r_out, r_in, rot=-90):
    pts = []
    for i in range(10):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(rot + i * 36)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def font(size: int):
    for f in (
        "/usr/share/fonts/truetype/sand-box/google/Lilita One/LilitaOne-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ):
        try:
            return ImageFont.truetype(f, P(size))
        except OSError:
            continue
    return ImageFont.load_default()


def text_layer(txt, size, rot, center, fill_rgb, outline_rgb=None, stroke=0):
    f = font(size)
    tmp = Image.new("RGBA", (W * SS, P(size * 2)), (0, 0, 0, 0))
    d = ImageDraw.Draw(tmp)
    d.text((P(20), P(size * 0.3)), txt, font=f, fill=fill_rgb + (255,), stroke_width=P(stroke),
           stroke_fill=(outline_rgb or fill_rgb) + (255,))
    tmp = tmp.crop(tmp.getbbox())
    tmp = tmp.rotate(rot, resample=Image.Resampling.BICUBIC, expand=True)
    x = P(center[0]) - tmp.width // 2
    y = P(center[1]) - tmp.height // 2
    return tmp, (x, y)


# --------------------------------------------------------------------------- page

def draw_page(img):
    page = rrect((14, 14, W - 14, H - 14), 34)
    fill(img, dilate(page, 5), INK)
    fill(img, page, PAPER)
    # soft paper edge shading + Hayden's fold line down the page
    edge = ImageChops.subtract(page, erode(page, 18)).filter(ImageFilter.GaussianBlur(P(10)))
    fill(img, inter(edge, page), PAPER_EDGE, 160)
    fold = mask()
    ImageDraw.Draw(fold).line([(P(600), P(30)), (P(600), P(H - 30))], fill=140, width=P(3))
    fill(img, fold.filter(ImageFilter.GaussianBlur(P(3))), PAPER_EDGE)


def draw_words(img):
    # Hayden's lettering, top of the page, rising a little to the right.
    for txt, size, rot, c in (
        ("Thanks for playing!", 84, 2, (430, 92)),
        ("-Cuboe and Cubro", 50, 2, (820, 162)),
    ):
        layer, pos = text_layer(txt, size, rot, c, INK, INK, stroke=1)
        img.alpha_composite(layer, pos)


# --------------------------------------------------------------------------- Cuboe

def draw_cuboe(img):
    # ground shadow
    fill(img, ellipse((150, 728, 520, 762)).filter(ImageFilter.GaussianBlur(P(8))), (0, 0, 0), 40)

    # legs + feet (behind body)
    for lx, fx in ((262, 236), (398, 424)):
        part(img, capsule(lx, 600, lx + (fx - lx) * 0.3, 700, 22), CREAM)
        foot = rrect((fx - 46, 690, fx + 40, 738), 22)
        part(img, foot, CREAM)
        side_shade(img, foot, CREAM_SHADE, (fx - 46, 690, fx + 40, 738), soft=6)

    # waving arm, up high on the left (Hayden's raised hand)
    arm_up = path_capsule([(210, 430), (150, 360), (126, 278)], 23)
    hand_up = ellipse((92, 222, 164, 292))
    part(img, union(arm_up, hand_up), CREAM)
    side_shade(img, union(arm_up, hand_up), CREAM_SHADE, (92, 222, 230, 440), soft=8)
    for dx in (-18, -2, 14):  # little finger creases
        ink_line(img, [(128 + dx, 228), (128 + dx * 1.2, 246)], 4)

    # bent arm on the right with a fist by his side
    arm_r = path_capsule([(470, 470), (540, 430), (566, 500)], 23)
    fist_r = ellipse((534, 486, 604, 552))
    part(img, union(arm_r, fist_r), CREAM)
    side_shade(img, union(arm_r, fist_r), CREAM_SHADE, (460, 420, 604, 552), soft=8)

    # body: one big rounded cube, slightly tilted like his drawing
    body = rrect((196, 300, 480, 640), 70)
    body = body.rotate(4, resample=Image.Resampling.BICUBIC, center=(P(338), P(470)))
    part(img, body, CREAM, outline=7)
    side_shade(img, body, CREAM_SHADE, (196, 300, 480, 640), soft=20, band=0.3)
    gloss(img, body, CREAM_LIT, (196, 300, 480, 640))

    # face: big oval eyes + a wide smile (as drawn)
    for cx, cy, rot in ((278, 410, -12), (378, 418, 12)):
        e = ellipse((cx - 24, cy - 36, cx + 24, cy + 36)).rotate(rot, center=(P(cx), P(cy)))
        fill(img, e, EYE)
        fill(img, ellipse((cx - 12, cy - 26, cx, cy - 10)), (255, 255, 255), 230)
    fill(img, ellipse((240, 470, 278, 492)).filter(ImageFilter.GaussianBlur(P(5))), BLUSH, 170)
    fill(img, ellipse((392, 476, 430, 498)).filter(ImageFilter.GaussianBlur(P(5))), BLUSH, 170)
    arc_line(img, (268, 420, 398, 520), 22, 158, 8)

    # star on his tummy
    st = poly(star_pts(352, 576, 32, 14, rot=-80))
    fill(img, dilate(st, 4), INK)
    fill(img, st, (250, 206, 72))

    # cap, tipped on the top right like the drawing
    crown = ellipse((258, 248, 438, 360))
    crown = inter(crown, rrect((240, 240, 460, 330), 6))
    brim = rrect((398, 300, 500, 332), 14)
    cap = union(crown, brim).rotate(-10, resample=Image.Resampling.BICUBIC, center=(P(360), P(320)))
    part(img, cap, CAP, outline=6)
    gloss(img, cap, CAP_LIT, (258, 248, 438, 330), soft=8)
    fill(img, ellipse((338, 246, 358, 262)).rotate(-10, center=(P(360), P(320))), CAP_LIT)


# --------------------------------------------------------------------------- Cubro

def draw_cubro(img):
    fill(img, ellipse((736, 734, 1044, 766)).filter(ImageFilter.GaussianBlur(P(8))), (0, 0, 0), 40)

    # legs + boots
    for lx in (852, 928):
        leg = rrect((lx - 24, 590, lx + 24, 712), 18)
        part(img, leg, BROWN)
        side_shade(img, leg, BROWN_SHADE, (lx - 24, 590, lx + 24, 712), soft=6)
        boot = rrect((lx - 34, 700, lx + 40, 744), 18)
        part(img, boot, BROWN_SHADE)
        gloss(img, boot, BROWN, (lx - 34, 700, lx + 40, 744), soft=4)

    # right arm bent down to a fist at his side
    arm_r = path_capsule([(990, 430), (1034, 500), (1010, 560)], 24)
    fist_r = rrect((978, 540, 1046, 600), 22)
    part(img, union(arm_r, fist_r), BROWN)
    side_shade(img, union(arm_r, fist_r), BROWN_SHADE, (970, 420, 1050, 600), soft=8)

    # torso: muscly rounded block
    torso = rrect((806, 400, 1000, 600), 40)
    part(img, torso, BROWN, outline=7)
    side_shade(img, torso, BROWN_SHADE, (806, 400, 1000, 600), soft=18)
    gloss(img, torso, BROWN_LIT, (806, 400, 1000, 600))
    # pecs + abs (Hayden drew a six-pack)
    arc_line(img, (826, 418, 906, 478), 20, 160, 5, BROWN_SHADE)
    arc_line(img, (900, 418, 980, 478), 20, 160, 5, BROWN_SHADE)
    for y in (500, 530):
        ink_line(img, [(872, y), (934, y)], 4, BROWN_SHADE)
    ink_line(img, [(903, 482), (903, 566)], 4, BROWN_SHADE)

    # dark shorts + belt
    shorts = rrect((812, 560, 996, 640), 18)
    part(img, shorts, SHORTS, outline=6)
    gloss(img, shorts, SHORTS_LIT, (812, 560, 996, 640), soft=6)
    fill(img, rrect((812, 560, 996, 576), 6), BELT)
    fill(img, rrect((888, 558, 918, 578), 4), (220, 190, 120))
    ink_line(img, [(904, 590), (904, 640)], 4, (20, 16, 18))

    # left arm out to the side with a big thumbs-up (toward Cuboe)
    arm_l = path_capsule([(820, 440), (746, 470), (690, 470)], 24)
    fist_l = rrect((640, 440, 712, 510), 22)
    thumb = capsule(664, 446, 662, 384, 15)
    part(img, union(arm_l, fist_l, thumb), BROWN)
    side_shade(img, union(arm_l, fist_l), BROWN_SHADE, (640, 440, 830, 510), from_right=False, soft=8)
    for y in (464, 480, 496):
        ink_line(img, [(690, y), (708, y)], 4, BROWN_SHADE)

    # head: a box with a lighter top face, like the in-game Cubro
    neck = rrect((878, 372, 930, 412), 10)
    part(img, neck, BROWN)
    front = rrect((800, 236, 980, 390), 18)
    top = poly([(800, 248), (836, 200), (1012, 200), (980, 248)])
    side = poly([(980, 248), (1012, 200), (1012, 344), (980, 390)])
    head = union(front, top, side)
    fill(img, dilate(head, 7), INK)
    fill(img, side, BROWN_SHADE)
    fill(img, top, BROWN_LIT)
    fill(img, front, BROWN)
    gloss(img, front, BROWN_LIT, (800, 236, 980, 390))
    ink_line(img, [(800, 248), (980, 248), (1012, 200)], 5)
    ink_line(img, [(980, 248), (980, 388)], 5)

    # sunglasses
    for x0 in (814, 898):
        lens = rrect((x0, 276, x0 + 72, 322), 12)
        fill(img, dilate(lens, 3), INK)
        fill(img, lens, GLASS)
        fill(img, poly([(x0 + 12, 282), (x0 + 30, 282), (x0 + 18, 314), (x0 + 6, 314)]), GLASS_LIT)
    ink_line(img, [(886, 290), (898, 290)], 7, GLASS)
    ink_line(img, [(970, 286), (996, 270)], 6, GLASS)
    # cool little smirk
    arc_line(img, (862, 324, 932, 362), 20, 120, 6)


def main():
    img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    draw_page(img)
    draw_words(img)
    draw_cubro(img)
    draw_cuboe(img)
    out = img.resize((W, H), Image.Resampling.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} {out.size}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Drunk Saloon party background (level f3-3), drawn entirely in code.

Every boss in the game (Choco Man, the Outlaw, the Candy Warlock, Fake Cuboe,
Fake Cubro and the three Admin Warlords) is cut straight out of its in-game
sprite sheet (frame 0 of public/game/sprites/*.png), scaled up, tilted and
dropped into a cartoon bar party: string lights, a disco ball, streamers,
bunting, a long bar with frothy root-beer mugs, party hats, "hic!" bubbles
and dizzy swirls. No AI or third-party art.

Layout note: PlayScene stretches a level background to
  max(worldWidth, 1600) x (worldHeight + 80)  = 3456 x 800 for this level
and scrolls it at 0.22, so only display x 0..~1760, y 0..720 is ever seen.
The scene is composed in that display space and then squashed to the usual
1792x1008 jpg, so the game's stretch puts everyone back in proportion.
The final pass darkens and desaturates the picture so the real platforms
stay readable in front of it.

Usage: python3 scripts/art/make-saloon-party.py
Writes: public/game/bg/saloon-party.jpg
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SPRITES = ROOT / "public/game/sprites"
OUT = ROOT / "public/game/bg/saloon-party.jpg"

DW, DH = 3456, 800  # display space the game stretches the image to
VIS_W = 1780  # widest part the camera ever shows (scroll factor 0.22)
OUT_SIZE = (1792, 1008)  # same size/format as the other level backgrounds
FLOOR_Y = 585  # back wall meets the saloon floor
INK = (41, 9, 33)

FONT = "/usr/share/fonts/truetype/sand-box/google/Lilita One/LilitaOne-Regular.ttf"

rnd = random.Random(1203)


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT, size)


def frame(name: str, idx: int = 0) -> Image.Image:
    """One 128px frame from a 2x2 in-game sprite sheet, trimmed to its bbox."""
    sheet = Image.open(SPRITES / f"{name}.png").convert("RGBA")
    x, y = (idx % 2) * 128, (idx // 2) * 128
    f = sheet.crop((x, y, x + 128, y + 128))
    return f.crop(f.getbbox())


def soft_shadow(img: Image.Image, cx: int, y: int, w: int) -> None:
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    d.ellipse((cx - w // 2, y - 14, cx + w // 2, y + 14), fill=(20, 6, 10, 120))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)))


# ---------------------------------------------------------------- room shell
def wall(img: Image.Image) -> None:
    d = ImageDraw.Draw(img)
    # warm plank wall, slightly darker toward the top
    for y in range(FLOOR_Y):
        t = y / FLOOR_Y
        d.line([(0, y), (DW, y)], fill=(int(96 + 40 * t), int(52 + 22 * t), int(34 + 10 * t)))
    x = 0
    while x < DW:
        w = rnd.randint(56, 80)
        shade = rnd.randint(-10, 10)
        d.rectangle((x, 0, x + w, FLOOR_Y), fill=None)
        d.line([(x, 0), (x, FLOOR_Y)], fill=(58, 28, 20), width=3)
        # wood grain
        for _ in range(4):
            gx = x + rnd.randint(8, w - 8)
            d.line([(gx, rnd.randint(0, 200)), (gx + rnd.randint(-4, 4), rnd.randint(300, FLOOR_Y))],
                   fill=(110 + shade, 62 + shade, 40), width=1)
        x += w
    # wainscot rail + lower panel
    d.rectangle((0, FLOOR_Y - 120, DW, FLOOR_Y), fill=(70, 34, 24))
    d.rectangle((0, FLOOR_Y - 126, DW, FLOOR_Y - 114), fill=(122, 70, 40))
    for px in range(30, DW, 150):
        d.rounded_rectangle((px, FLOOR_Y - 100, px + 120, FLOOR_Y - 16), 8, outline=(52, 24, 16), width=4)


def floor(img: Image.Image) -> None:
    d = ImageDraw.Draw(img)
    for y in range(FLOOR_Y, DH):
        t = (y - FLOOR_Y) / (DH - FLOOR_Y)
        d.line([(0, y), (DW, y)], fill=(int(84 - 30 * t), int(46 - 16 * t), int(32 - 10 * t)))
    vx = VIS_W // 2
    for i in range(-30, 60):
        x0 = vx + i * 70
        d.line([(x0, FLOOR_Y), (vx + (x0 - vx) * 3.2, DH)], fill=(48, 24, 18), width=2)
    for y in (FLOOR_Y + 30, FLOOR_Y + 80, FLOOR_Y + 150):
        d.line([(0, y), (DW, y)], fill=(54, 28, 20), width=2)


def windows(img: Image.Image) -> None:
    """Swinging saloon doors + night windows on the back wall."""
    d = ImageDraw.Draw(img)
    for wx in (90, 1700, 2500, 3100):
        d.rounded_rectangle((wx, 120, wx + 150, 300), 10, fill=(28, 26, 64), outline=(58, 28, 20), width=10)
        d.line([(wx + 75, 120), (wx + 75, 300)], fill=(58, 28, 20), width=6)
        d.line([(wx, 210), (wx + 150, 210)], fill=(58, 28, 20), width=6)
        for _ in range(6):
            sx, sy = wx + rnd.randint(12, 138), 130 + rnd.randint(0, 160)
            d.ellipse((sx - 2, sy - 2, sx + 2, sy + 2), fill=(255, 240, 190))
        d.ellipse((wx + 96, 140, wx + 126, 170), fill=(255, 236, 170))


def sign(img: Image.Image) -> None:
    d = ImageDraw.Draw(img)
    cx = 660
    d.rounded_rectangle((cx - 230, 26, cx + 230, 112), 18, fill=(150, 84, 40), outline=INK, width=6)
    d.line([(cx - 160, 0), (cx - 160, 26)], fill=INK, width=5)
    d.line([(cx + 160, 0), (cx + 160, 26)], fill=INK, width=5)
    f = font(62)
    txt = "DRUNK SALOON"
    w = d.textlength(txt, font=f)
    d.text((cx - w / 2 + 4, 34), txt, font=f, fill=INK)
    d.text((cx - w / 2, 30), txt, font=f, fill=(255, 214, 120))
    # party banner over the dance floor
    bx, by = 1240, 150
    flag_cols = [(255, 94, 140), (255, 210, 80), (110, 220, 160), (120, 170, 255), (200, 120, 255)]
    f2 = font(54)
    for i, ch in enumerate("PARTY!"):
        x = bx + i * 70
        y = by + int(10 * math.sin(i * 0.9))
        col = flag_cols[i % len(flag_cols)]
        d.polygon([(x, y), (x + 62, y), (x + 31, y + 80)], fill=col, outline=INK)
        d.text((x + 31, y + 26), ch, font=f2, fill=INK, anchor="mm")
    d.line([(bx - 40, by - 6), (bx + 6 * 70 + 30, by + 4)], fill=INK, width=4)


def back_bar(img: Image.Image) -> None:
    """Shelves of root-beer barrels and mugs behind the counter."""
    d = ImageDraw.Draw(img)
    x0, x1 = 300, 1020
    d.rectangle((x0, 150, x1, FLOOR_Y - 126), fill=(64, 30, 22), outline=INK, width=5)
    # mirror
    d.rounded_rectangle((x0 + 40, 170, x1 - 40, 270), 24, fill=(70, 80, 110), outline=(170, 120, 60), width=8)
    d.line([(x0 + 90, 250), (x0 + 170, 185)], fill=(140, 150, 180), width=10)
    for sy in (330, 410):
        d.rectangle((x0 + 10, sy, x1 - 10, sy + 12), fill=(130, 76, 40))
        x = x0 + 30
        while x < x1 - 60:
            kind = rnd.random()
            if kind < 0.35:  # little barrel
                d.rounded_rectangle((x, sy - 56, x + 44, sy), 10, fill=(150, 90, 44), outline=INK, width=3)
                d.line([(x, sy - 40), (x + 44, sy - 40)], fill=INK, width=3)
                d.line([(x, sy - 16), (x + 44, sy - 16)], fill=INK, width=3)
                d.text((x + 22, sy - 28), "RB", font=font(16), fill=(255, 220, 140), anchor="mm")
                x += 60
            else:  # candy jar
                col = rnd.choice([(255, 120, 170), (120, 220, 255), (255, 210, 90), (170, 255, 140)])
                d.rounded_rectangle((x, sy - 50, x + 34, sy), 8, fill=(200, 220, 230), outline=INK, width=3)
                for _ in range(5):
                    cx, cy = x + rnd.randint(7, 27), sy - rnd.randint(8, 40)
                    d.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill=col)
                d.rectangle((x - 2, sy - 58, x + 36, sy - 50), fill=(180, 60, 80), outline=INK)
                x += 48


def mug(size: int, tilt: float = 0) -> Image.Image:
    """Frothy root-beer mug sprite."""
    s = size
    m = Image.new("RGBA", (s * 2, s * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(m)
    x0, y0 = s // 2, s // 2 + s // 5
    w, h = int(s * 0.7), int(s * 0.85)
    d.rounded_rectangle((x0 + w - 6, y0 + h * 0.2, x0 + w + s * 0.3, y0 + h * 0.75), int(s * 0.12),
                        outline=INK, width=max(3, s // 12))
    d.rounded_rectangle((x0, y0, x0 + w, y0 + h), int(s * 0.1), fill=(150, 72, 30), outline=INK, width=max(3, s // 14))
    d.rectangle((x0 + s * 0.12, y0 + 8, x0 + s * 0.2, y0 + h - 10), fill=(196, 110, 52))
    # foam
    for i in range(5):
        fx = x0 + i * w / 4
        r = s * 0.16
        d.ellipse((fx - r, y0 - r * 1.2, fx + r, y0 + r * 0.6), fill=(255, 246, 225), outline=INK, width=2)
    d.ellipse((x0 + w * 0.6, y0 - s * 0.05, x0 + w * 0.8, y0 + s * 0.35), fill=(255, 246, 225))
    m = m.crop(m.getbbox())
    return m.rotate(tilt, resample=Image.BICUBIC, expand=True) if tilt else m


def counter(img: Image.Image) -> None:
    """Long bar counter. Kept dark with a rounded front so it doesn't read as a platform."""
    d = ImageDraw.Draw(img)
    x0, x1, top = 240, 1080, 470
    d.rounded_rectangle((x0, top, x1, FLOOR_Y + 14), 14, fill=(78, 36, 24), outline=INK, width=6)
    d.rounded_rectangle((x0 - 16, top - 16, x1 + 16, top + 14), 14, fill=(84, 40, 26), outline=INK, width=5)
    for px in range(x0 + 30, x1 - 80, 130):
        d.rounded_rectangle((px, top + 34, px + 100, FLOOR_Y - 6), 10, outline=(52, 22, 14), width=5)
    d.line([(x0, FLOOR_Y - 10), (x1, FLOOR_Y - 10)], fill=(170, 130, 60), width=6)  # foot rail


def table(img: Image.Image, cx: int, top: int, w: int = 230) -> None:
    d = ImageDraw.Draw(img)
    d.line([(cx - w * 0.3, top), (cx - w * 0.4, FLOOR_Y + 40)], fill=INK, width=12)
    d.line([(cx + w * 0.3, top), (cx + w * 0.4, FLOOR_Y + 40)], fill=INK, width=12)
    d.ellipse((cx - w / 2, top - 22, cx + w / 2, top + 22), fill=(118, 40, 60), outline=INK, width=5)
    # checked cloth drape
    for i in range(-4, 5):
        d.polygon([(cx + i * w / 9, top + 10), (cx + (i + 1) * w / 9, top + 10), (cx + (i + 0.5) * w / 9, top + 46)],
                  fill=(230, 220, 210) if i % 2 else (190, 50, 70), outline=INK)


def string_lights(img: Image.Image) -> None:
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    d = ImageDraw.Draw(img)
    cols = [(255, 90, 120), (255, 214, 90), (110, 230, 150), (100, 180, 255), (220, 120, 255)]
    spans = [(0, 26, 420, 26, 70), (420, 26, 900, 20, 80), (900, 20, 1420, 30, 70),
             (1420, 30, 1900, 24, 80), (1900, 24, 2500, 30, 80), (2500, 30, 3456, 26, 90)]
    k = 0
    for xa, ya, xb, yb, sag in spans:
        pts = []
        for i in range(41):
            t = i / 40
            pts.append((xa + (xb - xa) * t, ya + (yb - ya) * t + sag * 4 * t * (1 - t)))
        d.line(pts, fill=INK, width=3)
        for i in range(2, 40, 4):
            x, y = pts[i]
            c = cols[k % len(cols)]
            k += 1
            gd.ellipse((x - 26, y - 14, x + 26, y + 38), fill=c + (90,))
            d.rectangle((x - 4, y, x + 4, y + 7), fill=(60, 60, 60))
            d.ellipse((x - 8, y + 6, x + 8, y + 26), fill=c, outline=INK, width=2)
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(14)))


def disco(img: Image.Image) -> None:
    cx, cy, r = 1400, 300, 54
    spots = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(spots)
    beam_cols = [(255, 120, 200, 40), (120, 200, 255, 40), (255, 230, 120, 40), (150, 255, 170, 40)]
    for i in range(10):
        a = -0.2 + i * (math.pi + 0.4) / 9
        ex, ey = cx + math.cos(a) * 900, cy + math.sin(a) * 600 + 200
        sd.polygon([(cx, cy), (ex - 50, ey), (ex + 50, ey)], fill=beam_cols[i % 4])
    for _ in range(70):
        x, y = rnd.randint(0, VIS_W), rnd.randint(60, FLOOR_Y + 160)
        sd.ellipse((x - 9, y - 6, x + 9, y + 6), fill=rnd.choice(beam_cols)[:3] + (120,))
    img.alpha_composite(spots.filter(ImageFilter.GaussianBlur(4)))
    d = ImageDraw.Draw(img)
    d.line([(cx, 0), (cx, cy - r)], fill=INK, width=4)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(190, 200, 215), outline=INK, width=4)
    for gy in range(-r + 10, r, 14):
        hw = int(math.sqrt(max(0, r * r - gy * gy)))
        d.line([(cx - hw, cy + gy), (cx + hw, cy + gy)], fill=(120, 130, 150), width=2)
    for gx in range(-r + 12, r, 16):
        d.arc((cx - abs(gx) - 2, cy - r, cx + abs(gx) + 2, cy + r), 0, 360, fill=(120, 130, 150))
    d.ellipse((cx - 30, cy - 34, cx - 8, cy - 14), fill=(255, 255, 255))


def streamers(img: Image.Image) -> None:
    d = ImageDraw.Draw(img)
    cols = [(255, 94, 140), (255, 210, 80), (110, 220, 160), (120, 170, 255), (200, 120, 255)]
    for i, x in enumerate(range(40, DW, 120)):
        c = cols[i % len(cols)]
        L = rnd.randint(70, 170)
        pts = [(x + 14 * math.sin(t / 9 + i), t) for t in range(0, L, 3)]
        d.line(pts, fill=c, width=9)
        d.line(pts, fill=INK, width=1)
    # confetti
    for _ in range(420):
        x, y = rnd.randint(0, DW), rnd.randint(40, FLOOR_Y + 180)
        c = rnd.choice(cols)
        a = rnd.random() * math.pi
        dx, dy = 6 * math.cos(a), 6 * math.sin(a)
        d.line([(x - dx, y - dy), (x + dx, y + dy)], fill=c, width=4)


# --------------------------------------------------------------- the guests
def party_hat(h: int, col: tuple[int, int, int]) -> Image.Image:
    w = int(h * 0.7)
    im = Image.new("RGBA", (w + 20, h + 30), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    tip = (w // 2 + 10, 18)
    d.polygon([tip, (10, h + 18), (w + 10, h + 18)], fill=col, outline=INK)
    for k in range(1, 4):  # stripes
        y = 18 + h * k / 4
        hw = (w / 2) * k / 4
        d.line([(tip[0] - hw, y), (tip[0] + hw, y)], fill=(255, 250, 230), width=max(3, h // 12))
    d.polygon([tip, (10, h + 18), (w + 10, h + 18)], outline=INK, width=3)
    d.ellipse((tip[0] - 12, 2, tip[0] + 12, 26), fill=(255, 250, 230), outline=INK, width=3)
    return im


def hic(img: Image.Image, x: int, y: int, s: float = 1.0) -> None:
    d = ImageDraw.Draw(img)
    for i, r in enumerate((10, 15, 22)):
        bx, by = x + i * 14 * s, y - i * 30 * s
        rr = r * s
        d.ellipse((bx - rr, by - rr, bx + rr, by + rr), fill=(230, 245, 255), outline=INK, width=3)
        d.ellipse((bx - rr * 0.5, by - rr * 0.6, bx - rr * 0.1, by - rr * 0.2), fill=(255, 255, 255))
    f = font(int(34 * s))
    tx, ty = x + 40 * s, y - 112 * s
    d.text((tx + 3, ty + 3), "hic!", font=f, fill=INK)
    d.text((tx, ty), "hic!", font=f, fill=(255, 236, 140))


def dizzy(img: Image.Image, cx: int, y: int, s: float = 1.0) -> None:
    """Little orbit of spirals and stars over a wobbly head."""
    d = ImageDraw.Draw(img)
    d.ellipse((cx - 60 * s, y - 14 * s, cx + 60 * s, y + 14 * s), outline=(255, 236, 140), width=3)
    for i in range(3):
        a = i * 2.1 + 0.4
        sx, sy = cx + math.cos(a) * 60 * s, y + math.sin(a) * 14 * s
        pts = []
        for t in range(0, 60):
            rr = t * 0.32 * s
            pts.append((sx + math.cos(t * 0.45) * rr, sy + math.sin(t * 0.45) * rr))
        d.line(pts, fill=(255, 236, 140), width=4)
        d.line(pts, fill=INK, width=1)


def place(img: Image.Image, name: str, cx: int, foot: int, height: int, tilt: float = 0,
          flip: bool = False, idx: int = 0, hat: tuple[int, int, int] | None = None,
          hat_dx: int = 0, shadow: bool = True) -> tuple[int, int, int]:
    """Composite a real sprite frame. Returns (head_x, head_y, sprite_w) after tilt."""
    f = frame(name, idx)
    if flip:
        f = f.transpose(Image.FLIP_LEFT_RIGHT)
    k = height / f.height
    f = f.resize((max(1, int(f.width * k)), height), Image.LANCZOS)
    if hat:
        hh = int(height * 0.28)
        h_im = party_hat(hh, hat).rotate(-tilt * 0.5 + 12 * (1 if flip else -1), resample=Image.BICUBIC, expand=True)
        canvas = Image.new("RGBA", (f.width + 80, f.height + h_im.height), (0, 0, 0, 0))
        canvas.alpha_composite(f, (40, h_im.height))
        top = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        # centre the hat on the head: middle of the top tenth of the opaque sprite
        a = f.getchannel("A").point(lambda v: 255 if v > 40 else 0)
        head = a.crop((0, 0, f.width, max(2, f.height // 10))).getbbox() or (0, 0, f.width, 1)
        head_x = (head[0] + head[2]) // 2
        top.alpha_composite(h_im, (40 + head_x - h_im.width // 2 + hat_dx, int(h_im.height * 0.5)))
        canvas = Image.alpha_composite(canvas, top)
        f = canvas
    if tilt:
        f = f.rotate(tilt, resample=Image.BICUBIC, expand=True)
    if shadow:
        soft_shadow(img, cx, foot, int(height * 0.7))
    x, y = cx - f.width // 2, foot - f.height
    img.alpha_composite(f, (x, y))
    return cx, y, f.width


def guests(img: Image.Image) -> None:
    # Outlaw tends the bar (behind the counter, so only the top shows)
    behind = Image.new("RGBA", img.size, (0, 0, 0, 0))
    place(behind, "outlaw", 700, 610, 300, tilt=-6, hat=None, shadow=False)
    img.alpha_composite(behind)
    counter(img)
    m = mug(70, 8)
    for mx in (330, 450, 900, 1000):
        img.alpha_composite(mug(56, rnd.uniform(-10, 10)), (mx, 470 - 62))
    img.alpha_composite(m, (790, 470 - m.height + 6))  # the Outlaw's mug
    hic(img, 760, 250)

    # Admin Warlord 1 slumped against the bar, arm up
    place(img, "warlord-1", 190, 640, 270, tilt=10, hat=(255, 94, 140))
    hic(img, 210, 330, 0.9)
    # Fake Cuboe dancing near the bar
    place(img, "fake-cuboe-idle", 900, 690, 200, tilt=-12, idx=1, hat=(120, 170, 255))
    img.alpha_composite(mug(52, -18), (965, 580))
    # Choco Man dancing on a table
    table(img, 1420, 470)
    place(img, "choco", 1420, 470, 230, tilt=14, idx=2, hat=(255, 210, 80), shadow=False)
    hic(img, 1500, 300, 0.8)
    # Candy Warlock wobbling with a mug
    place(img, "warlock", 1640, 660, 260, tilt=-9, flip=True, hat=(200, 120, 255))
    img.alpha_composite(mug(54, 20), (1560, 520))
    hic(img, 1680, 400, 0.8)
    # Admin Warlords 2 and 3 doing a conga under the disco ball
    place(img, "warlord-2", 1130, 700, 250, tilt=8, flip=True, idx=1, hat=(110, 220, 160))
    dizzy(img, 1130, 420, 0.8)
    place(img, "warlord-3", 1300, 720, 250, tilt=-10, idx=3, hat=(255, 140, 90))
    # Fake Cubro on his skateboard, spinning
    place(img, "fake-cubro-idle", 470, 740, 190, tilt=-16, idx=1, hat=(255, 210, 80))
    img.alpha_composite(mug(48, 30), (540, 610))
    hic(img, 520, 570, 0.7)

    # off-camera right (only shows if the level is ever widened): a quieter booth
    table(img, 2300, 500)
    place(img, "warlord-1", 2200, 650, 240, tilt=6, flip=True, idx=2, hat=(255, 94, 140))
    place(img, "choco", 2420, 650, 210, tilt=-8, hat=(120, 170, 255))


def finish(img: Image.Image) -> Image.Image:
    rgb = img.convert("RGB")
    rgb = ImageEnhance.Color(rgb).enhance(0.78)
    rgb = ImageEnhance.Brightness(rgb).enhance(0.72)
    rgb = ImageEnhance.Contrast(rgb).enhance(0.86)
    # deeper shade low down where the platforms and floor sit, plus a soft vignette
    shade = Image.new("L", rgb.size, 0)
    sd = ImageDraw.Draw(shade)
    for y in range(DH):
        t = max(0.0, (y - 480) / (DH - 480))
        sd.line([(0, y), (DW, y)], fill=int(150 * t))
    for x in range(0, 240):
        a = int(110 * (1 - x / 240))
        sd.line([(x, 0), (x, DH)], fill=max(a, 0))
    shade = shade.filter(ImageFilter.GaussianBlur(20))
    dark = Image.new("RGB", rgb.size, (18, 8, 20))
    rgb = Image.composite(dark, rgb, shade)
    return rgb.resize(OUT_SIZE, Image.LANCZOS)


def main() -> None:
    img = Image.new("RGBA", (DW, DH), (0, 0, 0, 255))
    wall(img)
    floor(img)
    windows(img)
    back_bar(img)
    sign(img)
    disco(img)
    string_lights(img)
    streamers(img)
    guests(img)
    out = finish(img)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, quality=90, optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} {out.size}")


if __name__ == "__main__":
    main()

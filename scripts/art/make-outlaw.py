#!/usr/bin/env python3
"""
Marshmallow Outlaw boss sheet (f2-boss), drawn in code in the in-game boss style.

Hayden's redesign: a thinner body, a roasted / charred black marshmallow body
(with toasted-brown edges so he still reads against dark backgrounds), a green
and purple bandana covering his mouth, a gray cowboy hat, a golden pistol and
red glowing eyes peeking out between the bandana and the hat brim.

Same format as the other boss sheets: 128px frames in a 256x256 2x2 sheet,
feet on y=118, facing right (the game flips him toward the player), a chunky
dark outline with soft shading and a top sheen. The four frames are his idle
loop (`outlaw-idle` at 6 fps: breathe/bob, pistol bob, eye-glow pulse,
bandana tails flutter); his attack poses are made by the boss rig from these.

The old painted sheet is kept at scripts/art/src/outlaw-original.png so the
change can be reverted (copy it back over public/game/sprites/outlaw.png).

No AI art and no third-party art.

    python3 scripts/art/make-outlaw.py
"""
from __future__ import annotations

import importlib.util
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, HERE / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # main() is guarded
    return mod


C = _load("candy", "make-candy-cube.py")
W = _load("warlords", "make-admin-warlords.py")

OUT = C.OUT
S, px, INK = C.S, C.px, C.INK
canvas, empty_mask, dilate, blit_color = C.canvas, C.empty_mask, C.dilate, C.blit_color
ellipse_mask, capsule_mask, union, subtract = C.ellipse_mask, C.capsule_mask, C.union, C.subtract
rounded_rect_mask = C.rounded_rect_mask
part, inner, glow, path_mask, poly_mask, highlight = W.part, W.inner, W.glow, W.path_mask, W.poly_mask, W.highlight

# roasted marshmallow
CHAR = (34, 28, 28)
CHAR_LIT = (66, 50, 44)
TOAST = (168, 98, 44)
TOAST_LIT = (214, 146, 70)
# outfit
HAT = (156, 154, 150)
HAT_DEEP = (100, 98, 96)
HAT_LIT = (214, 212, 208)
GREEN = (60, 176, 84)
GREEN_DEEP = (30, 112, 52)
PURPLE = (136, 70, 196)
PURPLE_DEEP = (84, 38, 130)
GOLD = (240, 196, 70)
GOLD_LIT = (255, 236, 150)
GOLD_DEEP = (168, 118, 34)
LEATHER = (110, 64, 34)
LEATHER_DEEP = (70, 38, 20)
EYE = (255, 36, 30)


def erode(mask: Image.Image, width: float) -> Image.Image:
    k = max(3, int(round(width * 2)) + 1)
    if k % 2 == 0:
        k += 1
    return mask.filter(ImageFilter.MinFilter(k))


def warm_shade(img, mask, band=7.0, strength=0.25):
    """Right-side shading without the cool/blue shadow tint (gray hat, char)."""
    a = np.array(img, dtype=np.float32)
    m = np.array(mask)
    h, w = m.shape
    band_px = max(1, px(band))
    factor = np.ones((h, w), dtype=np.float32)
    for yy in np.where(m.max(axis=1) > 0)[0]:
        xs = np.where(m[yy] > 0)[0]
        t = np.clip((int(xs[-1]) - np.arange(w)) / band_px, 0, 1)
        factor[yy] -= (1.0 - t) * strength
    a[:, :, :3] *= factor[:, :, None]
    img.paste(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA"), (0, 0), mask)


def gpart(dst, mask, rgb, outline=1.9, sheen=True):
    part(dst, mask, rgb, outline=outline, shade=False, sheen=False)
    warm_shade(dst, mask, band=6, strength=0.22)
    if sheen:
        highlight(dst, mask, tuple(v / S for v in mask.getbbox()), alpha=110)


def charred(dst, mask, outline=2.0, toast=4.0):
    """Roasted marshmallow: black body, toasted-brown edges, warm sheen."""
    if mask.getbbox() is None:
        return
    rim = dilate(mask, outline).filter(ImageFilter.GaussianBlur(0.8))
    blit_color(dst, rim, INK)
    blit_color(dst, mask, CHAR)
    edge = subtract(mask, erode(mask, toast)).filter(ImageFilter.GaussianBlur(px(0.9)))
    edge = ImageChops.multiply(edge, mask)
    blit_color(dst, edge.point(lambda v: v * 235 // 255), TOAST)
    # left/top edges catch the light a bit more (toasted-gold)
    bb = [v / S for v in mask.getbbox()]
    lit = ellipse_mask((bb[0] - 6, bb[1] - 6, bb[0] + (bb[2] - bb[0]) * 0.55, bb[1] + (bb[3] - bb[1]) * 0.5))
    lit = ImageChops.multiply(ImageChops.multiply(edge, lit), mask)
    blit_color(dst, lit.point(lambda v: v * 170 // 255), TOAST_LIT)
    warm_shade(dst, mask, band=7, strength=0.3)
    highlight(dst, mask, tuple(bb), alpha=55)


def char_spots(dst, mask, spots):
    """A few soot / blister marks on the roasted skin."""
    for (x, y, r) in spots:
        m = ImageChops.multiply(ellipse_mask((x - r, y - r * 0.7, x + r, y + r * 0.7)), mask)
        blit_color(dst, m.filter(ImageFilter.GaussianBlur(px(0.6))).point(lambda v: v * 150 // 255), CHAR_LIT)


def boot(dst, cx, lift=0.0):
    b = C.BOTTOM
    shaft = rounded_rect_mask((cx - 4.2, b - 15 - lift, cx + 4.2, b - 5 - lift), 1.6)
    foot = rounded_rect_mask((cx - 5, b - 7 - lift, cx + 9, b - lift), 3.0)
    part(dst, union(shaft, foot), LEATHER, outline=1.8)
    inner(dst, rounded_rect_mask((cx - 4.6, b - 2.4 - lift, cx + 9, b - lift), 1), LEATHER_DEEP)
    inner(dst, rounded_rect_mask((cx - 4.2, b - 15 - lift, cx + 4.2, b - 13 - lift), 0.8), GOLD_DEEP)


def pistol(dst, gx, gy, glint=0.0):
    """Golden revolver, barrel pointing right; (gx, gy) is the grip in the hand."""
    grip = poly_mask([(gx - 3, gy - 2), (gx + 3, gy - 2), (gx + 1.5, gy + 8), (gx - 4.5, gy + 7)])
    frame = rounded_rect_mask((gx - 3, gy - 6, gx + 10, gy), 1.6)
    cyl = rounded_rect_mask((gx + 4, gy - 7.5, gx + 12, gy + 0.5), 2.2)
    barrel = rounded_rect_mask((gx + 10, gy - 6, gx + 26, gy - 2.5), 1.2)
    hammer = poly_mask([(gx - 3.5, gy - 5), (gx - 6, gy - 9), (gx - 2, gy - 6.5)])
    guard = subtract(ellipse_mask((gx + 0.5, gy - 2, gx + 7.5, gy + 5)), ellipse_mask((gx + 2, gy - 0.5, gx + 6, gy + 3.5)))
    gun = union(grip, frame, cyl, barrel, hammer, guard)
    part(dst, gun, GOLD, outline=1.6, shade=True, sheen=False)
    inner(dst, grip, GOLD_DEEP)
    inner(dst, rounded_rect_mask((gx + 10, gy - 6, gx + 26, gy - 4.8), 0.5), GOLD_LIT)
    d = ImageDraw.Draw(dst)
    for k in (6.5, 9.5):
        d.line([(px(gx + k), px(gy - 7)), (px(gx + k), px(gy))], fill=GOLD_DEEP + (255,), width=px(0.7))
    d.ellipse((px(gx + 24.4), px(gy - 5.2), px(gx + 25.8), px(gy - 3.3)), fill=INK)  # muzzle
    # sparkle
    sx, sy = gx + 16 + glint * 6, gy - 5.4
    s = 1.2 + 0.6 * glint
    d.polygon([(px(sx), px(sy - s * 2.4)), (px(sx + s * 0.5), px(sy)), (px(sx), px(sy + s * 2.4)), (px(sx - s * 0.5), px(sy))], fill=(255, 255, 240, 230))
    d.polygon([(px(sx - s * 2.4), px(sy)), (px(sx), px(sy - s * 0.5)), (px(sx + s * 2.4), px(sy)), (px(sx), px(sy + s * 0.5))], fill=(255, 255, 240, 230))


def bandana(dst, y, flutter, head):
    """Green-and-purple bandana over the mouth, knotted at the back (left)."""
    # tails behind the head (left side, he faces right)
    for k, (dy, col) in enumerate(((0, GREEN), (3, PURPLE))):
        t = poly_mask([(48, 43 + y + dy), (40 - flutter * (1 + k), 44 + y + dy + flutter), (37 - flutter, 50 + y + dy + flutter * 1.4), (46, 47 + y + dy)])
        part(dst, t, col, outline=1.4, shade=False, sheen=False)
    cloth = poly_mask([(45.5, 40.5 + y), (78.5, 40.5 + y), (78, 45 + y), (66, 60 + y), (62, 61 + y), (47, 46 + y)])
    cloth = ImageChops.multiply(cloth, dilate(head, 1.4))
    blit_color(dst, dilate(cloth, 1.4).filter(ImageFilter.GaussianBlur(0.8)), INK)
    blit_color(dst, cloth, GREEN)
    # purple diagonal stripes + dots pattern
    stripes = empty_mask()
    sd = ImageDraw.Draw(stripes)
    for i in range(-3, 8):
        x0 = 44 + i * 9
        sd.polygon([(px(x0), px(40 + y)), (px(x0 + 4), px(40 + y)), (px(x0 + 4 - 18), px(60 + y)), (px(x0 - 18), px(60 + y))], fill=255)
    blit_color(dst, ImageChops.multiply(stripes, cloth), PURPLE)
    # hem band (purple) along the top edge with green dots
    hem = ImageChops.multiply(rounded_rect_mask((44, 40.5 + y, 78, 43.4 + y), 0.6), cloth)
    blit_color(dst, hem, PURPLE_DEEP)
    d = ImageDraw.Draw(dst)
    for x in range(48, 76, 5):
        d.ellipse((px(x - 0.7), px(41.3 + y), px(x + 0.7), px(42.7 + y)), fill=GREEN + (255,))
    warm_shade(dst, cloth, band=6, strength=0.22)
    # fold lines
    d.line([(px(52), px(46 + y)), (px(61), px(55 + y))], fill=GREEN_DEEP + (200,), width=px(0.7))
    d.line([(px(71), px(45 + y)), (px(64), px(54 + y))], fill=GREEN_DEEP + (200,), width=px(0.7))


def red_eyes(dst, y, pulse):
    for ex, w in ((58.5, 3.2), (69.5, 2.9)):
        glow(dst, ex, 36 + y, 6.5, EYE, 0.55 * pulse)
        eye = poly_mask([(ex - w, 35 + y), (ex + w, 34 + y), (ex + w * 0.8, 37.6 + y), (ex - w * 0.7, 37.8 + y)])
        blit_color(dst, dilate(eye, 0.7), INK)
        blit_color(dst, eye, EYE)
        core = ellipse_mask((ex - w * 0.45, 35.2 + y, ex + w * 0.45, 37.0 + y)).filter(ImageFilter.GaussianBlur(px(0.4)))
        blit_color(dst, core, (255, 190, 170))
    # angry brows (the hat brim shadow sits above)
    d = ImageDraw.Draw(dst)
    d.line([(px(54.5), px(31.8 + y)), (px(61.5), px(33.6 + y))], fill=INK, width=px(1.3))
    d.line([(px(73), px(31.8 + y)), (px(66.5), px(33.6 + y))], fill=INK, width=px(1.3))


def hat(dst, y):
    """Gray cowboy hat with an upturned brim and a dented crown."""
    cy = 24 + y
    crown = poly_mask([(51, cy + 1), (52, cy - 13), (57, cy - 16), (62, cy - 13.5), (67, cy - 16.5), (72, cy - 13), (74, cy + 1)])
    gpart(dst, crown, HAT, sheen=False)
    d = ImageDraw.Draw(dst)
    d.line([(px(62), px(cy - 13)), (px(62.3), px(cy - 5))], fill=HAT_DEEP + (255,), width=px(1.0))  # crease
    band = ImageChops.multiply(rounded_rect_mask((50, cy - 3.6, 75, cy + 0.5), 0.8), dilate(crown, 0.2))
    inner(dst, band, (60, 62, 70))
    for x in (55, 62.5, 70):  # little silver conchos
        d.ellipse((px(x - 1.1), px(cy - 2.6), px(x + 1.1), px(cy - 0.4)), fill=HAT_LIT + (255,))
    brim = poly_mask([(37, cy - 5), (41, cy - 0.5), (50, cy + 2.5), (62.5, cy + 3.2), (75, cy + 2.5), (84, cy - 0.5), (88, cy - 5.5),
                      (86, cy + 2), (78, cy + 5.6), (62.5, cy + 6.6), (47, cy + 5.6), (39, cy + 2)])
    gpart(dst, brim, HAT, sheen=False)
    inner(dst, poly_mask([(42, cy + 2.6), (50, cy + 4.6), (62.5, cy + 5.4), (75, cy + 4.6), (83, cy + 2.6), (78, cy + 5.4), (62.5, cy + 6.4), (47, cy + 5.4)]), HAT_DEEP)
    highlight(dst, crown, (51, cy - 16.5, 74, cy + 1), alpha=110)
    d.line([(px(41), px(cy - 1.2)), (px(52), px(cy + 1.6))], fill=HAT_LIT + (255,), width=px(0.9))


def outlaw(f: int) -> Image.Image:
    img = canvas()
    bob = [0, -0.8, -1.4, -0.6][f]
    gun = [0, -0.6, -1.0, -0.4][f]
    pulse = [0.85, 1.0, 1.2, 1.0][f]
    flutter = [0, 1.0, 1.8, 0.8][f]
    y = bob
    # thin legs + boots
    for lx in (55, 67):
        leg = path_mask([(lx, 92 + y * 0.5), (lx, 106)], 3.4)
        charred(img, leg, outline=1.8, toast=1.6)
        boot(img, lx)
    # back arm (left), hand on the belt
    arm_b = path_mask([(48, 62 + y), (42, 71 + y), (46, 79 + y)], 3.0)
    charred(img, arm_b, outline=1.8, toast=1.5)
    # one tall, thin roasted marshmallow (body + rounded head end)
    torso = rounded_rect_mask((47, 46 + y, 78, 96 + y), 9)
    head = rounded_rect_mask((47, 24 + y, 78, 62 + y), 10)
    body = union(head, torso)
    charred(img, body)
    char_spots(img, body, [(56, 68 + y, 2.2), (70, 76 + y, 1.8), (58, 90 + y, 1.6), (73, 30 + y, 1.4)])
    # belt + gold buckle + holster
    belt = ImageChops.multiply(rounded_rect_mask((46, 83 + y, 79, 88 + y), 1), dilate(body, 0.6))
    inner(img, belt, LEATHER)
    inner(img, rounded_rect_mask((59.5, 82.6 + y, 65.5, 88.4 + y), 1.2), GOLD)
    holster = rounded_rect_mask((74, 85 + y, 80, 97 + y), 2)
    part(img, holster, LEATHER, outline=1.5, sheen=False)
    part(img, ellipse_mask((43, 76 + y, 49.5, 82.5 + y)), CHAR, outline=1.4, shade=False, sheen=False)  # back fist
    # red eyes peeking between brim and bandana
    red_eyes(img, y, pulse)
    bandana(img, y, flutter, body)
    hat(img, y)
    # front arm out with the golden pistol
    hx, hy = 94, 69 + y + gun
    arm_f = path_mask([(74, 62 + y), (83, 67 + y), (hx - 3, hy)], 3.1)
    charred(img, arm_f, outline=1.8, toast=1.5)
    pistol(img, hx, hy, glint=[0, 0.4, 1.0, 0.5][f])
    part(img, ellipse_mask((hx - 5.5, hy - 4, hx + 1.5, hy + 3)), CHAR, outline=1.4, shade=False, sheen=False)  # fist
    blit_color(img, subtract(ellipse_mask((hx - 5.5, hy - 4, hx + 1.5, hy + 3)), ellipse_mask((hx - 4.5, hy - 3, hx + 0.5, hy + 2))).filter(ImageFilter.GaussianBlur(px(0.5))), TOAST)
    return img


def main():
    W.make_sheet([outlaw(f) for f in range(4)], OUT / "outlaw.png")


if __name__ == "__main__":
    main()

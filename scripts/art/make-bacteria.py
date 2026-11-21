#!/usr/bin/env python3
"""
Bacteria, the boss of Floor 470539758 (the Backrooms), drawn in code in the
in-game boss style (thick dark outline, soft shading, top sheen).

An original design: a very tall, very thin shadow figure with long dangling
arms and legs, a small round head with two little glowing eyes and a wobbly
line of a mouth. Spooky, never gory. 256x256 sheet, 2x2 128px frames, feet on
y=118, facing right; the four frames are an idle loop (sway, arm twitch, eye
glow pulse), played as `bacteria-idle` at 6 fps; the boss rig makes the attack
poses from them.

No AI art and no third-party art.

    python3 scripts/art/make-bacteria.py
"""
from __future__ import annotations

import importlib.util
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, HERE / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


C = _load("candy", "make-candy-cube.py")
W = _load("warlords", "make-admin-warlords.py")
px, INK = C.px, C.INK
ellipse_mask, union, blit_color, rounded_rect_mask = C.ellipse_mask, C.union, C.blit_color, C.rounded_rect_mask
part, path_mask, poly_mask, glow = W.part, W.path_mask, W.poly_mask, W.glow

SKIN = (30, 28, 34)
SKIN_LIT = (64, 60, 72)
EYE = (250, 250, 220)


def bacteria(f: int, void: bool = False) -> Image.Image:
    img = C.canvas()
    sway = [0, 1.2, 2.0, 0.8][f]
    tw = [0, -2.0, 1.0, -1.0][f]
    pulse = [0.8, 1.0, 1.25, 1.0][f]
    hx = 64 + sway
    # long thin legs (slightly bent knees)
    for lx, k in ((58, -1), (70, 1)):
        leg = path_mask([(lx + sway * 0.4, 70), (lx + k * 3, 94), (lx + k * 1.5, 116)], 2.2)
        part(img, leg, SKIN, outline=1.7)
        part(img, poly_mask([(lx + k * 1.5 - 3, 118), (lx + k * 1.5 + 6 * k + 3 * (k < 0), 118), (lx + k * 1.5, 113)]), SKIN, outline=1.3, sheen=False)
    # back arm (left), dangling to below the knee with long fingers
    arm_b = path_mask([(56 + sway, 36), (46 + sway * 0.5, 58), (40, 82 + tw), (38, 102 + tw)], 2.0)
    part(img, arm_b, SKIN, outline=1.6)
    for dx in (-4, -1, 2):
        part(img, path_mask([(38, 102 + tw), (38 + dx, 111 + tw)], 0.9), SKIN, outline=1.0, sheen=False)
    # thin torso
    torso = poly_mask([(hx - 7, 30), (hx + 7, 30), (hx + 5, 72), (hx - 5, 72)])
    part(img, torso, SKIN, outline=1.9)
    blit_color(img, poly_mask([(hx - 5, 32), (hx - 2, 32), (hx - 3, 70), (hx - 4.5, 70)]), SKIN_LIT)
    # front arm (right), reaching forward with long fingers
    arm_f = path_mask([(72 + sway, 36), (84 + sway * 0.5, 54), (92, 74 - tw), (96, 96 - tw)], 2.0)
    part(img, arm_f, SKIN, outline=1.6)
    for dx in (-2, 1, 4):
        part(img, path_mask([(96, 96 - tw), (96 + dx, 106 - tw)], 0.9), SKIN, outline=1.0, sheen=False)
    # small round head on a long neck
    part(img, path_mask([(hx, 30), (hx + 1, 20)], 2.2), SKIN, outline=1.5, sheen=False)
    if void:
        void_head(img, hx, f, pulse)
    else:
        head = ellipse_mask((hx - 9, 2, hx + 11, 24))
        part(img, head, SKIN, outline=2.0)
        for ex in (hx - 2, hx + 6):
            glow(img, ex, 12, 4.5, (255, 250, 200), 0.55 * pulse)
            blit_color(img, ellipse_mask((ex - 1.9, 10, ex + 1.9, 14.2)), EYE)
        d = ImageDraw.Draw(img)
        pts = [(px(hx - 3 + i * 1.6), px(18.5 + (0.6 if i % 2 else -0.6))) for i in range(7)]
        d.line(pts, fill=(140, 136, 150, 255), width=px(0.7))
    # wisps of shadow drifting off the shoulders
    for k, (sx, sy) in enumerate(((52, 34), (76, 32), (64, 60))):
        g = ellipse_mask((sx - 4 + f, sy - 10 - f * 2, sx + 4 + f, sy - 2 - f * 2)).filter(ImageFilter.GaussianBlur(px(1.5)))
        blit_color(img, g.point(lambda v: v * 90 // 255), (20, 18, 24))
    return img


def void_head(img: Image.Image, hx: float, f: int, pulse: float):
    """Phase 2, "Void": the same tall body, but the head is a pitch-black void
    with a big glowing white grin and two glowing eyes (Hayden's idea: Bacteria
    with a Smiler face). Original design."""
    # a dark aura around the head and shoulders
    for r, a in ((24, 0.3),):
        glow(img, hx + 1, 14, r, (40, 10, 60), a)
    head = ellipse_mask((hx - 11, 2, hx + 13, 26))
    part(img, head, (6, 4, 10), outline=2.2, sheen=False)
    for ex in (hx - 4, hx + 7):
        glow(img, ex, 9, 3.2, (255, 255, 255), 0.35 * pulse)
        blit_color(img, ellipse_mask((ex - 2.6, 6.5, ex + 2.6, 11.5)), (255, 255, 255))
    # the grin: a wide crescent full of little teeth
    grin = Image.new("L", img.size, 0)
    gd = ImageDraw.Draw(grin)
    gd.chord([px(hx - 9), px(10), px(hx + 12), px(24)], 15, 165, fill=255)
    gd.ellipse([px(hx - 8), px(8.5), px(hx + 11), px(17.5)], fill=0)
    glow(img, hx + 1.5, 19, 5, (255, 255, 240), 0.18 * pulse)
    blit_color(img, grin, (255, 255, 246))
    d = ImageDraw.Draw(img)
    for i in range(1, 8):
        tx = hx - 8 + i * 2.6
        d.line([(px(tx), px(17.5)), (px(tx), px(22.8))], fill=(20, 16, 24, 255), width=px(0.45))
    d.line([(px(hx - 8), px(19.6)), (px(hx + 11), px(19.6))], fill=(20, 16, 24, 255), width=px(0.45))
    # void specks drifting off
    for k in range(5):
        a = k * 1.3 + f * 0.6
        sx, sy = hx + math.cos(a) * 17, 13 + math.sin(a) * 12 - f
        blit_color(img, ellipse_mask((sx - 1.4, sy - 1.4, sx + 1.4, sy + 1.4)), (70, 30, 110))


def main():
    W.make_sheet([bacteria(f) for f in range(4)], C.OUT / "bacteria.png")
    W.make_sheet([bacteria(f, void=True) for f in range(4)], C.OUT / "bacteria-void.png")


if __name__ == "__main__":
    main()

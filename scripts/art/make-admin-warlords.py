#!/usr/bin/env python3
"""
Admin Warlords boss sheets, drawn in code in the same style as the other bosses.

Hayden drew the three Admin Warlords in pencil (assets/hayden/originals/
admin-warlords*.jpg; his cutouts stay in assets/hayden/cutouts/ as reference).
This script redraws each one in the painted language of the in-game bosses
(Choco Man, Outlaw, Candy Warlock) and heroes: 128px frames in a 256x256 2x2
sheet, feet on y=118, a chunky dark-maroon outline, soft side shading, a top
highlight, and the Candy Warlock's dark armour + purple + gold boss palette.
His black pencil areas become dark armour, the white paper areas become pale
bone-silver, and each phase gets its own glow colour so phase changes read.

Kept from his drawings:
  1  round head with two curved horns, black mask stripe and black teardrop
     eyes, V-shaped cape collar, dark chest block + belt, long legs, both
     hands raised in spiky claws with an orb above each (a spoked wheel and
     a swirl).
  2  round head with a tall centre spike and two side horns, a black diamond
     eye, an upside-down triangle chest plate with a V mark, jagged cape edges,
     a round belly, short legs, one claw holding a spoked orb out, the other
     claw low.
  3  tall oval ribbed helmet with a blade crest down the middle, a barrel
     body with black chevron bands, long legs, one arm out holding a spoked
     orb, the other down with a round fist.

The four frames are an idle loop (breathe/bob, orb spin and glow pulse) like
the other boss sheets, played as `warlord-N-idle` at 6 fps.

No AI art and no third-party art.

    python3 scripts/art/make-admin-warlords.py
"""
from __future__ import annotations

import importlib.util
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("candy", HERE / "make-candy-cube.py")
C = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(C)  # shared helpers (main() is guarded)

ROOT = C.ROOT
OUT = C.OUT
S, px, INK = C.S, C.px, C.INK
canvas, empty_mask, dilate, blit_color = C.canvas, C.empty_mask, C.dilate, C.blit_color
ellipse_mask, capsule_mask, union, subtract = C.ellipse_mask, C.capsule_mask, C.union, C.subtract
rounded_rect_mask, apply_side_ao = C.rounded_rect_mask, C.apply_side_ao

# boss palette (Candy Warlock family)
ARMOR = (52, 34, 78)
ARMOR_LIT = (88, 60, 128)
VOID = (20, 12, 28)
BONE = (232, 226, 240)
BONE_SHADE = (190, 180, 210)
GOLD = (232, 186, 74)
GOLD_DEEP = (170, 120, 40)
PHASE_GLOW = {1: (154, 92, 255), 2: (255, 70, 196), 3: (255, 86, 60)}


def poly_mask(pts) -> Image.Image:
    m = empty_mask()
    ImageDraw.Draw(m).polygon([(px(x), px(y)) for x, y in pts], fill=255)
    return m


def path_mask(pts, r) -> Image.Image:
    out = empty_mask()
    for a, b in zip(pts, pts[1:]):
        out = union(out, capsule_mask(a[0], a[1], b[0], b[1], r))
    return out


def highlight(dst, mask, box, alpha=90):
    """Soft top-left sheen, like the painted bosses."""
    x0, y0, x1, y1 = box
    h = ellipse_mask((x0 + (x1 - x0) * 0.08, y0 + (y1 - y0) * 0.04, x0 + (x1 - x0) * 0.6, y0 + (y1 - y0) * 0.42))
    h = h.filter(ImageFilter.GaussianBlur(px(2.5)))
    h = ImageChops.multiply(h, mask).point(lambda v: v * alpha // 255)
    blit_color(dst, h, (255, 255, 255))


def part(dst, mask, rgb, outline=2.0, shade=True, sheen=True):
    if mask.getbbox() is None:
        return
    rim = dilate(mask, outline).filter(ImageFilter.GaussianBlur(0.8))
    blit_color(dst, rim, INK)
    blit_color(dst, mask, rgb)
    if shade:
        apply_side_ao(dst, mask, from_left=False, band=9, strength=0.2)
    if sheen:
        bb = mask.getbbox()
        highlight(dst, mask, tuple(v / S for v in bb))


def inner(dst, mask, rgb):
    """Detail painted inside an already outlined part, with a thin ink edge."""
    blit_color(dst, dilate(mask, 0.8), INK)
    blit_color(dst, mask, rgb)


def glow(dst, cx, cy, r, rgb, strength=0.6):
    g = ellipse_mask((cx - r, cy - r, cx + r, cy + r)).filter(ImageFilter.GaussianBlur(px(r * 0.45)))
    blit_color(dst, g.point(lambda v: int(v * strength)), rgb)


def orb(dst, cx, cy, r, rgb, spin=0.0, swirl=False, pulse=1.0):
    glow(dst, cx, cy, r * 1.9, rgb, 0.55 * pulse)
    body = ellipse_mask((cx - r, cy - r, cx + r, cy + r))
    part(dst, body, tuple(int(c * 0.55) for c in rgb), outline=1.8, shade=True, sheen=False)
    core = ellipse_mask((cx - r * 0.7, cy - r * 0.7, cx + r * 0.7, cy + r * 0.7)).filter(ImageFilter.GaussianBlur(px(1.2)))
    blit_color(dst, ImageChops.multiply(core, body), tuple(min(255, int(c * 1.15) + 30) for c in rgb))
    d = ImageDraw.Draw(dst)
    w = max(2, px(1.1))
    if swirl:
        pts = []
        for i in range(40):
            t = i / 39
            a = spin + t * 2.6 * math.pi
            rr = r * 0.82 * t
            pts.append((px(cx + math.cos(a) * rr), px(cy + math.sin(a) * rr)))
        d.line(pts, fill=(255, 250, 255, 255), width=w, joint="curve")
    else:
        for k in range(6):
            a = spin + k * math.pi / 3
            d.line([(px(cx), px(cy)), (px(cx + math.cos(a) * r * 0.82), px(cy + math.sin(a) * r * 0.82))], fill=(255, 250, 255, 255), width=w)
        rim = ellipse_mask((cx - r * 0.82, cy - r * 0.82, cx + r * 0.82, cy + r * 0.82))
        ring = subtract(rim, ellipse_mask((cx - r * 0.66, cy - r * 0.66, cx + r * 0.66, cy + r * 0.66)))
        blit_color(dst, ring, (255, 250, 255))
    d.ellipse((px(cx - 1.6), px(cy - 1.6), px(cx + 1.6), px(cy + 1.6)), fill=(255, 255, 255, 255))
    d.ellipse((px(cx - r * 0.55), px(cy - r * 0.62), px(cx - r * 0.2), px(cy - r * 0.3)), fill=(255, 255, 255, 170))


def claw(dst, cx, cy, s=1.3, up=True, rgb=BONE):
    """Hayden's zigzag 'crown' hands: a palm with three spikes."""
    k = -1 if up else 1
    palm = ellipse_mask((cx - 5 * s, cy - 3.5 * s, cx + 5 * s, cy + 3.5 * s))
    spikes = poly_mask([
        (cx - 5 * s, cy), (cx - 7.5 * s, cy + k * 9 * s), (cx - 2.2 * s, cy + k * 2.5 * s),
        (cx, cy + k * 10.5 * s), (cx + 2.2 * s, cy + k * 2.5 * s), (cx + 7.5 * s, cy + k * 9 * s), (cx + 5 * s, cy),
    ])
    part(dst, union(palm, spikes), rgb, outline=1.7)


def limb(dst, pts, r, rgb, outline=1.9):
    part(dst, path_mask(pts, r), rgb, outline=outline)


def boot(dst, cx, w=13, h=8, rgb=ARMOR):
    m = rounded_rect_mask((cx - w / 2, C.BOTTOM - h, cx + w / 2 + 2, C.BOTTOM), 3.5)
    part(dst, m, rgb, outline=1.8)
    inner(dst, rounded_rect_mask((cx - w / 2 + 1, C.BOTTOM - h - 1, cx + w / 2 + 1, C.BOTTOM - h + 2), 1), GOLD)


def eye_glint(dst, x, y, rgb):
    glow(dst, x, y, 3.2, rgb, 0.9)
    ImageDraw.Draw(dst).ellipse((px(x - 1), px(y - 1), px(x + 1), px(y + 1)), fill=(255, 255, 255, 255))


# ---------------------------------------------------------------------------- warlord 1

def warlord1(f: int) -> Image.Image:
    img = canvas()
    g = PHASE_GLOW[1]
    bob = [0, -1.2, -2.0, -0.8][f]
    arm = [0, -1.0, -1.6, -0.6][f]
    spin = f * math.pi / 12
    pulse = [0.85, 1.0, 1.15, 1.0][f]
    y = bob
    # legs + boots
    for lx in (54, 68):
        limb(img, [(lx, 88 + y * 0.4), (lx, 112)], 4.6, BONE)
        boot(img, lx)
    # arms raised to the orbs
    limb(img, [(46, 62 + y), (34, 56 + y), (28, 46 + y + arm)], 4.2, BONE)
    limb(img, [(76, 62 + y), (88, 56 + y), (94, 46 + y + arm)], 4.2, BONE)
    claw(img, 28, 44 + y + arm)
    claw(img, 94, 44 + y + arm)
    orb(img, 26, 23 + y + arm * 1.4, 8.5, g, spin=spin, pulse=pulse)
    orb(img, 96, 23 + y + arm * 1.4, 8.5, g, spin=-spin, swirl=True, pulse=pulse)
    # dark chest block + belt
    chest = rounded_rect_mask((50, 60 + y, 72, 92 + y), 4)
    part(img, chest, ARMOR)
    inner(img, rounded_rect_mask((50, 80 + y, 72, 86 + y), 1.5), VOID)
    inner(img, rounded_rect_mask((58, 79.5 + y, 64, 86.5 + y), 1.2), GOLD)
    # V cape collar over the shoulders
    collar = poly_mask([(36, 56 + y), (86, 56 + y), (80, 64 + y), (61, 80 + y), (42, 64 + y)])
    part(img, collar, ARMOR_LIT)
    inner(img, poly_mask([(40, 57 + y), (82, 57 + y), (79, 60 + y), (43, 60 + y)]), GOLD)
    # horns (behind head top)
    for side in (-1, 1):
        hx = 61 + side * 9
        horn = path_mask([(hx, 34 + y), (hx + side * 6, 26 + y), (hx + side * 7, 17 + y), (hx + side * 3.5, 11 + y)], 2.4)
        part(img, horn, VOID, outline=1.6, sheen=False)
        tip = capsule_mask(hx + side * 6.2, 15 + y, hx + side * 3.5, 11 + y, 1.6)
        blit_color(img, tip, BONE_SHADE)
    # round head with the mask
    head = ellipse_mask((45, 26 + y, 77, 58 + y))
    part(img, head, BONE)
    stripe = ImageChops.multiply(poly_mask([(57, 25 + y), (65, 25 + y), (66, 46 + y), (61, 59 + y), (56, 46 + y)]), head)
    blit_color(img, stripe, VOID)
    for side in (-1, 1):
        ex = 61 + side * 8
        eye = poly_mask([(ex - side * 3.5, 37 + y), (ex + side * 5, 40 + y), (ex + side * 3, 47 + y), (ex - side * 1.5, 48 + y)])
        blit_color(img, dilate(eye, 0.5), VOID)
        eye_glint(img, ex + side * 1.0, 43 + y, g)
    return img


# ---------------------------------------------------------------------------- warlord 2

def warlord2(f: int) -> Image.Image:
    img = canvas()
    g = PHASE_GLOW[2]
    bob = [0, -1.2, -2.0, -0.8][f]
    sway = [0, 0.8, 1.4, 0.6][f]
    spin = f * math.pi / 12
    pulse = [0.85, 1.0, 1.15, 1.0][f]
    y = bob
    # short legs
    for lx in (52, 66):
        limb(img, [(lx, 98 + y * 0.3), (lx, 112)], 4.4, BONE)
        boot(img, lx)
    # jagged cape edges hanging behind
    for side in (-1, 1):
        x0 = 59 + side * 20
        cape = poly_mask([
            (x0, 54 + y), (x0 + side * 9, 60 + y), (x0 + side * 11 + sway * side, 90 + y),
            (x0 + side * 7, 84 + y), (x0 + side * 5 + sway * side, 94 + y), (x0 + side * 2, 86 + y), (x0 - side * 1, 92 + y), (x0 - side * 4, 60 + y),
        ])
        part(img, cape, ARMOR_LIT, outline=1.8)
    # round belly
    belly = ellipse_mask((49, 82 + y, 69, 102 + y))
    part(img, belly, BONE)
    d = ImageDraw.Draw(img)
    d.arc([px(52), px(86 + y), px(66), px(100 + y)], 200, 340, fill=INK + (255,) if len(INK) == 3 else INK, width=px(1.0))
    # arms: right out with the orb, left low with a claw
    limb(img, [(78, 58 + y), (90, 54 + y), (98, 46 + y)], 4.2, BONE)
    claw(img, 98, 44 + y)
    orb(img, 100, 24 + y, 8.5, g, spin=spin, pulse=pulse)
    limb(img, [(40, 58 + y), (32, 66 + y), (28, 74 + y)], 4.2, BONE)
    claw(img, 28, 76 + y, up=False)
    # upside-down triangle chest plate with a V mark
    plate = poly_mask([(37, 52 + y), (81, 52 + y), (60, 90 + y)])
    part(img, plate, ARMOR)
    inner(img, poly_mask([(45, 57 + y), (52, 57 + y), (59, 72 + y), (66, 57 + y), (73, 57 + y), (59, 82 + y)]), BONE_SHADE)
    inner(img, poly_mask([(38, 52 + y), (80, 52 + y), (78, 55.5 + y), (40, 55.5 + y)]), GOLD)
    # three horns: tall centre spike + two curved side horns
    spike = poly_mask([(55.5, 30 + y), (59, 6 + y), (62.5, 30 + y)])
    part(img, spike, VOID, outline=1.6, sheen=False)
    blit_color(img, poly_mask([(58.2, 14 + y), (59, 7.5 + y), (59.8, 14 + y)]), BONE_SHADE)
    for side in (-1, 1):
        hx = 59 + side * 9
        horn = path_mask([(hx, 30 + y), (hx + side * 6, 24 + y), (hx + side * 6.5, 15 + y)], 2.3)
        part(img, horn, VOID, outline=1.6, sheen=False)
    # head + black diamond eye
    head = ellipse_mask((46, 24 + y, 72, 52 + y))
    part(img, head, BONE)
    dia = poly_mask([(59, 30 + y), (65, 39 + y), (59, 48 + y), (53, 39 + y)])
    blit_color(img, dilate(dia, 0.6), VOID)
    eye_glint(img, 59, 38.5 + y, g)
    d.line([(px(55), px(46 + y)), (px(63), px(46 + y))], fill=VOID + (255,), width=px(1.2))
    return img


# ---------------------------------------------------------------------------- warlord 3

def warlord3(f: int) -> Image.Image:
    img = canvas()
    g = PHASE_GLOW[3]
    bob = [0, -1.2, -2.0, -0.8][f]
    arm = [0, -1.0, -1.6, -0.6][f]
    spin = f * math.pi / 12
    pulse = [0.85, 1.0, 1.15, 1.0][f]
    y = bob
    # long legs with dark knees
    for lx in (52, 66):
        limb(img, [(lx, 84 + y * 0.4), (lx, 112)], 4.6, BONE)
        inner(img, ellipse_mask((lx - 3.6, 96, lx + 3.6, 101)), ARMOR)
        boot(img, lx)
    # left arm down to a round fist
    limb(img, [(44, 62 + y), (38, 74 + y), (36, 86 + y)], 4.2, BONE)
    part(img, ellipse_mask((30.5, 84 + y, 41.5, 95 + y)), BONE)
    # barrel body with chevron bands
    body = ellipse_mask((40, 52 + y, 78, 92 + y))
    part(img, body, BONE)
    for i, cy in enumerate((60, 70, 80)):
        band = poly_mask([(40, cy - 3 + y), (59, cy + 5 + y), (78, cy - 3 + y), (78, cy + 1.5 + y), (59, cy + 9.5 + y), (40, cy + 1.5 + y)])
        band = ImageChops.multiply(band, body)
        blit_color(img, band, VOID if i != 1 else ARMOR)
    inner(img, ImageChops.multiply(rounded_rect_mask((40, 86 + y, 78, 90 + y), 1), body), GOLD)
    # right arm out with the orb
    limb(img, [(74, 62 + y), (86, 56 + y), (94, 48 + y + arm)], 4.2, BONE)
    claw(img, 94, 46 + y + arm)
    orb(img, 98, 26 + y + arm * 1.4, 8.5, g, spin=spin, pulse=pulse)
    # tall ribbed helmet with a blade crest
    head = ellipse_mask((46, 18 + y, 72, 56 + y))
    part(img, head, BONE)
    d = ImageDraw.Draw(img)
    for dx in (-8, -4.5, 4.5, 8):
        d.arc([px(59 + dx * 0.4 - abs(dx)), px(22 + y), px(59 + dx * 0.4 + abs(dx)), px(54 + y)],
              100 if dx < 0 else -80, 260 if dx < 0 else 80, fill=BONE_SHADE + (255,), width=px(1.1))
    blade = poly_mask([(56.5, 54 + y), (57, 20 + y), (59, 6 + y), (61, 20 + y), (61.5, 54 + y)])
    part(img, blade, VOID, outline=1.5, sheen=False)
    blit_color(img, poly_mask([(58.6, 18 + y), (59, 9 + y), (59.4, 18 + y)]), BONE_SHADE)
    for side in (-1, 1):
        ex = 59 + side * 6
        blit_color(img, ellipse_mask((ex - 2.6, 36 + y, ex + 2.6, 41 + y)), VOID)
        eye_glint(img, ex, 38.5 + y, g)
    return img


# ---------------------------------------------------------------------------- orb projectile

def admin_orb() -> Image.Image:
    img = Image.new("RGBA", (64 * S, 64 * S), (0, 0, 0, 0))
    # draw on a 128 canvas then crop to the centre 64
    big = canvas()
    orb(big, 64, 64, 22, PHASE_GLOW[1], spin=0.3)
    img = big.crop((px(32), px(32), px(96), px(96)))
    return img.resize((64, 64), Image.Resampling.LANCZOS)


def make_sheet(frames, path: Path):
    out = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    for i, fr in enumerate(frames[:4]):
        small = fr.resize((128, 128), Image.Resampling.LANCZOS)
        a = np.array(small)
        ys = np.where(a[:, :, 3] > 20)[0]
        dy = C.BOTTOM - int(ys.max())
        planted = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
        planted.paste(small, (0, dy), small)
        out.alpha_composite(planted, ((i % 2) * 128, (i // 2) * 128))
    out.save(path, optimize=True)
    print("wrote", path.relative_to(ROOT), out.size)


def main():
    for n, fn in ((1, warlord1), (2, warlord2), (3, warlord3)):
        make_sheet([fn(f) for f in range(4)], OUT / f"warlord-{n}.png")
    # group portrait (menus/HUD), first idle frame of each phase side by side
    grp = Image.new("RGBA", (384, 192), (0, 0, 0, 0))
    for n in (1, 2, 3):
        fr = Image.open(OUT / f"warlord-{n}.png").crop((0, 0, 128, 128)).resize((136, 136), Image.Resampling.LANCZOS)
        grp.alpha_composite(fr, (-4 + (n - 1) * 124, 192 - 136 - 6))
    grp.save(OUT / "admin-warlords.png", optimize=True)
    print("wrote", (OUT / "admin-warlords.png").relative_to(ROOT))
    admin_orb().save(OUT / "admin-orb.png", optimize=True)
    print("wrote", (OUT / "admin-orb.png").relative_to(ROOT))


if __name__ == "__main__":
    main()

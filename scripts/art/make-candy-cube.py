#!/usr/bin/env python3
"""
Candy Cube in-game sprites, drawn in code to match Cuboe and Cubro.

Hayden's design — red/white horizontal stripes, yellow swirl eyes, a smile,
striped arms with yellow/red cuffs, striped legs, red/white shoes — is
redrawn in the same painted style as the in-game Cuboe and Cubro sheets
and the same character language as his credits-page Cuboe + Cubro drawing:
rounded cube body, chunky dark-maroon outline, soft side shading, simple
graphic face, short capsule limbs, feet planted on y=118.

No AI art, no third-party art, and no photo cutout in the in-game sheets.
The photographed cutout stays in assets/hayden/cutouts/ as reference.

    python3 scripts/art/make-candy-cube.py
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/game/sprites"
OUT.mkdir(parents=True, exist_ok=True)

S = 4
FRAME = 128
BOTTOM = 118  # same foot line as Cuboe and Cubro
INK = (41, 9, 33, 255)

CREAM = (252, 242, 217)
CREAM_DEEP = (214, 180, 128)
RED = (196, 48, 56)
RED_DEEP = (132, 26, 34)
YELLOW = (240, 196, 48)
YELLOW_LIT = (255, 228, 110)
SHOE_RED = (176, 36, 42)
SHOE_WHITE = (252, 242, 217)


def px(v: float) -> int:
    return int(round(v * S))


def canvas() -> Image.Image:
    return Image.new("RGBA", (FRAME * S, FRAME * S), (0, 0, 0, 0))


def empty_mask() -> Image.Image:
    return Image.new("L", (FRAME * S, FRAME * S), 0)


def finish_frame(img: Image.Image) -> Image.Image:
    # Plant on the *output* pixel grid so antialiased soles land on y=118
    # like Cuboe/Cubro, not one pixel short after the 4x downsample.
    small = img.resize((FRAME, FRAME), Image.Resampling.LANCZOS)
    a = np.array(small)
    ys = np.where(a[:, :, 3] > 20)[0]
    if len(ys) == 0:
        return small
    dy = BOTTOM - int(ys.max())
    if dy == 0:
        return small
    shifted = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    shifted.paste(small, (0, dy), small)
    return shifted


def dilate(mask: Image.Image, width: float) -> Image.Image:
    k = max(3, int(round(width * 2)) + 1)
    if k % 2 == 0:
        k += 1
    return mask.filter(ImageFilter.MaxFilter(k))


def blit_color(dst: Image.Image, mask: Image.Image, rgb, x=0, y=0):
    if isinstance(rgb, tuple) and len(rgb) == 4:
        rgb = rgb[:3]
    layer = Image.new("RGBA", dst.size, rgb + (255,))
    dst.paste(layer, (x, y), mask)


def rounded_rect_mask(box, radius: float) -> Image.Image:
    m = empty_mask()
    x0, y0, x1, y1 = [px(v) for v in box]
    r = max(1, px(radius))
    r = min(r, max(1, (x1 - x0) // 2), max(1, (y1 - y0) // 2))
    ImageDraw.Draw(m).rounded_rectangle((x0, y0, x1, y1), radius=r, fill=255)
    return m


def capsule_mask(x1, y1, x2, y2, radius: float) -> Image.Image:
    m = empty_mask()
    d = ImageDraw.Draw(m)
    r = max(1, px(radius))
    p1 = (px(x1), px(y1))
    p2 = (px(x2), px(y2))
    d.line([p1, p2], fill=255, width=r * 2)
    d.ellipse((p1[0] - r, p1[1] - r, p1[0] + r, p1[1] + r), fill=255)
    d.ellipse((p2[0] - r, p2[1] - r, p2[0] + r, p2[1] + r), fill=255)
    return m


def ellipse_mask(box) -> Image.Image:
    m = empty_mask()
    x0, y0, x1, y1 = [px(v) for v in box]
    ImageDraw.Draw(m).ellipse((x0, y0, x1, y1), fill=255)
    return m


def union(*masks: Image.Image) -> Image.Image:
    out = empty_mask()
    for m in masks:
        out = ImageChops.lighter(out, m)
    return out


def subtract(a: Image.Image, b: Image.Image) -> Image.Image:
    return ImageChops.subtract(a, b)


def paint_stripes(dst: Image.Image, mask: Image.Image, y0: float, y1: float, n: int, deep=False):
    """Horizontal cream/red stripes clipped to mask. First stripe (top) is cream, like Hayden's drawing."""
    cream = CREAM_DEEP if deep else CREAM
    red = RED_DEEP if deep else RED
    layer = Image.new("RGBA", dst.size, cream + (255,))
    d = ImageDraw.Draw(layer)
    top, bot = px(y0), px(y1)
    span = max(1, bot - top)
    step = span / n
    # Start one stripe above so rounded tops stay cream, not a red cap.
    # i=0 is cream at [top-step, top]; i=1 is red at [top, top+step] — wait, that
    # would put red first. Offset so i=0 cream covers [top, top+step].
    for i in range(-1, n + 2):
        color = cream if i % 2 == 0 else red
        ya = int(round(top + i * step))
        yb = int(round(top + (i + 1) * step)) + 1
        d.rectangle((0, ya, layer.size[0], yb), fill=color + (255,))
    dst.paste(layer, (0, 0), mask)


def apply_side_ao(img: Image.Image, mask: Image.Image, from_left=True, band=8.0, strength=0.14):
    a = np.array(img, dtype=np.float32)
    m = np.array(mask)
    h, w = m.shape
    band_px = max(1, px(band))
    factor = np.ones((h, w), dtype=np.float32)
    rows = np.where(m.max(axis=1) > 0)[0]
    for y in rows:
        xs = np.where(m[y] > 0)[0]
        if len(xs) == 0:
            continue
        left, right = int(xs[0]), int(xs[-1])
        if from_left:
            t = np.clip((np.arange(w) - left) / band_px, 0, 1)
            edge = (1.0 - t) * strength
        else:
            t = np.clip((right - np.arange(w)) / band_px, 0, 1)
            edge = t * strength
        factor[y] -= edge
    if len(rows):
        y_bot = int(rows[-1])
        yy = np.arange(h)[:, None]
        bot_t = np.clip((yy - (y_bot - px(10))) / px(10), 0, 1)
        factor -= bot_t * (strength * 0.55)
    factor = np.clip(factor, 0.72, 1.0)
    a[:, :, 0] *= factor
    a[:, :, 1] *= factor
    a[:, :, 2] *= factor * (0.5 * (1.0 + np.clip(factor, 0, 1)) + 0.5)
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")
    img.paste(out, (0, 0), mask)


def stamp_part(dst: Image.Image, mask: Image.Image, fill_fn, outline=2.0):
    if mask.getbbox() is None:
        return
    rim = dilate(mask, outline).filter(ImageFilter.GaussianBlur(0.4 * S / 2))
    blit_color(dst, rim, INK)
    fill_fn(dst, mask)
    apply_side_ao(dst, mask)


def stripe_fill(y0, y1, n=8, deep=False):
    def fn(dst, mask):
        paint_stripes(dst, mask, y0, y1, n, deep=deep)
    return fn


def solid_fill(rgb):
    def fn(dst, mask):
        blit_color(dst, mask, rgb)
    return fn


def shoe_fill():
    def fn(dst, mask):
        blit_color(dst, mask, SHOE_RED)
        a_m = np.array(mask)
        ys = np.where(a_m.max(axis=1) > 0)[0]
        xs = np.where(a_m.max(axis=0) > 0)[0]
        if len(ys) == 0 or len(xs) == 0:
            return
        y_top, y_bot = int(ys[0]), int(ys[-1])
        x_left, x_right = int(xs[0]), int(xs[-1])
        stripe = empty_mask()
        mid_y0 = y_top + int((y_bot - y_top) * 0.28)
        mid_y1 = y_top + int((y_bot - y_top) * 0.58)
        ImageDraw.Draw(stripe).rectangle((x_left, mid_y0, x_right, mid_y1), fill=255)
        stripe = ImageChops.multiply(stripe, mask)
        blit_color(dst, stripe, SHOE_WHITE)
        apply_side_ao(dst, mask, band=4, strength=0.12)
    return fn


def draw_swirl_eye(dst: Image.Image, cx: float, cy: float, r: float):
    mask = ellipse_mask((cx - r, cy - r, cx + r, cy + r))
    rim = dilate(mask, 1.6).filter(ImageFilter.GaussianBlur(0.35))
    blit_color(dst, rim, INK)
    blit_color(dst, mask, YELLOW)
    shade = ellipse_mask((cx - r * 0.9, cy - r * 0.9, cx + r * 0.9, cy + r * 0.9))
    apply_side_ao(dst, shade, from_left=False, band=r * 0.7, strength=0.10)

    d = ImageDraw.Draw(dst)
    turns = 1.55
    n = 56
    pts = []
    for i in range(n):
        t = i / (n - 1)
        ang = t * turns * 2 * math.pi + math.pi * 0.15
        rad = r * (0.08 + 0.78 * t)
        pts.append((px(cx + math.cos(ang) * rad), px(cy + math.sin(ang) * rad)))
    d.line(pts, fill=INK[:3] + (255,), width=max(2, px(1.15)), joint="curve")
    hr = r * 0.28
    hx, hy = cx - r * 0.32, cy - r * 0.38
    d.ellipse((px(hx - hr), px(hy - hr), px(hx + hr), px(hy + hr)), fill=(255, 255, 245, 255))


def draw_smile(dst: Image.Image, cx: float, cy: float, w: float, thick=1.7, frown=False):
    d = ImageDraw.Draw(dst)
    n = 16
    pts = []
    for i in range(n):
        t = i / (n - 1)
        x = cx - w / 2 + w * t
        k = 1.0 if not frown else -0.7
        y = cy + k * (1 - (2 * t - 1) ** 2) * (w * 0.22)
        pts.append((px(x), px(y)))
    d.line(pts, fill=INK[:3] + (255,), width=max(2, px(thick)), joint="curve")
    r = thick * 0.55
    for p in (pts[0], pts[-1]):
        d.ellipse((p[0] - px(r), p[1] - px(r), p[0] + px(r), p[1] + px(r)), fill=INK[:3] + (255,))


def _axis(x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1.0
    return dx / L, dy / L, L


def draw_limb(dst, x1, y1, x2, y2, radius, *, striped=True, cuff=False, n_stripes=5):
    """Capsule limb. Cuff is a yellow band with a red lip, then a small cream hand — not a yellow ball."""
    ux, uy, L = _axis(x1, y1, x2, y2)

    # If cuffed, the striped shaft stops short of the hand so stripes stay visible
    hand_r = radius * 0.92
    cuff_len = radius * 1.15
    if cuff and L > radius * 2:
        shaft_end_x = x2 - ux * (hand_r + cuff_len * 0.85)
        shaft_end_y = y2 - uy * (hand_r + cuff_len * 0.85)
    else:
        shaft_end_x, shaft_end_y = x2, y2

    mask = capsule_mask(x1, y1, shaft_end_x, shaft_end_y, radius)
    if striped:
        ys = (min(y1, y2) - radius - 2, max(y1, y2) + radius + 2)
        stamp_part(dst, mask, stripe_fill(ys[0], ys[1], n=n_stripes), outline=1.8)
    else:
        stamp_part(dst, mask, solid_fill(CREAM), outline=1.8)

    if not cuff:
        return

    # Yellow cuff band sitting at the wrist (just before the hand)
    c_far_x = x2 - ux * hand_r * 0.85
    c_far_y = y2 - uy * hand_r * 0.85
    c_near_x = c_far_x - ux * cuff_len
    c_near_y = c_far_y - uy * cuff_len
    cuff_m = capsule_mask(c_near_x, c_near_y, c_far_x, c_far_y, radius * 1.12)
    stamp_part(dst, cuff_m, solid_fill(YELLOW), outline=1.6)
    # thin red lip at the distal edge of the cuff
    lip_m = capsule_mask(
        c_far_x - ux * radius * 0.35,
        c_far_y - uy * radius * 0.35,
        c_far_x + ux * radius * 0.05,
        c_far_y + uy * radius * 0.05,
        radius * 1.14,
    )
    # clip lip to the cuff so it stays a band
    lip_m = ImageChops.multiply(lip_m, dilate(cuff_m, 0.6))
    blit_color(dst, lip_m, RED)

    # small rounded cream hand
    hx, hy = x2, y2
    hand = ellipse_mask((hx - hand_r, hy - hand_r, hx + hand_r, hy + hand_r))
    stamp_part(dst, hand, solid_fill(CREAM), outline=1.6)


def draw_shoe(dst, cx, cy, w=15, h=9.5, angle=0.0):
    """Red/white rounded shoe; cy is the planted sole (BOTTOM)."""
    box = (cx - w / 2, cy - h, cx + w / 2, cy)
    mask = ellipse_mask(box)
    if angle:
        piv = (px(cx), px(cy - h * 0.15))
        mask = mask.rotate(-angle, resample=Image.Resampling.BICUBIC, center=piv, fillcolor=0)
    stamp_part(dst, mask, shoe_fill(), outline=1.7)


def draw_front_body(dst, x0, y0, x1, y1, radius=14, n_stripes=8):
    mask = rounded_rect_mask((x0, y0, x1, y1), radius)
    stamp_part(dst, mask, stripe_fill(y0, y1, n=n_stripes, deep=False), outline=2.0)
    return mask, (x0, y0, x1, y1)


def draw_three_quarter_body(dst, x0, y0, x1, y1, side_w=16, radius=12, n_stripes=8):
    """
    One rounded-cube silhouette (no double-hump), darker left side face,
    vertical crease — same construction as Cuboe's run/attack box.
    Returns (silhouette, front_box).
    """
    sil = rounded_rect_mask((x0, y0, x1, y1), radius)
    crease_x = x0 + side_w
    # side = left portion of the same silhouette
    side = empty_mask()
    ImageDraw.Draw(side).rectangle((0, 0, px(crease_x), sil.size[1]), fill=255)
    side = ImageChops.multiply(side, sil)
    front = subtract(sil, side)

    rim = dilate(sil, 2.0).filter(ImageFilter.GaussianBlur(0.4 * S / 2))
    blit_color(dst, rim, INK)
    paint_stripes(dst, side, y0, y1, n_stripes, deep=True)
    apply_side_ao(dst, side, from_left=True, band=6, strength=0.10)
    paint_stripes(dst, front, y0, y1, n_stripes, deep=False)
    apply_side_ao(dst, front, from_left=True, band=7, strength=0.12)

    # vertical crease, faded at the rounded top/bottom
    crease = empty_mask()
    inset = radius * 0.55
    ImageDraw.Draw(crease).line(
        [(px(crease_x), px(y0 + inset)), (px(crease_x), px(y1 - inset))],
        fill=255,
        width=max(2, px(1.35)),
    )
    crease = crease.filter(ImageFilter.GaussianBlur(0.7 * S / 2))
    crease = ImageChops.multiply(crease, sil)
    blit_color(dst, crease, INK[:3] + (170,))
    return sil, (crease_x, y0, x1, y1)


def face_on(dst, fx0, fy0, fx1, fy1, *, frown=False, eye_scale=1.0):
    fw = fx1 - fx0
    fh = fy1 - fy0
    cx = (fx0 + fx1) / 2
    eye_y = fy0 + fh * 0.29
    eye_dx = fw * 0.20
    eye_r = max(4.6, min(7.2, fw * 0.125)) * eye_scale
    draw_swirl_eye(dst, cx - eye_dx, eye_y, eye_r)
    draw_swirl_eye(dst, cx + eye_dx, eye_y, eye_r)
    # keep a readable gap from the eyes, even on squat frames
    smile_y = eye_y + max(13.5, fh * 0.21)
    smile_w = max(14, fw * 0.30)
    draw_smile(dst, cx, min(smile_y, fy1 - 8), smile_w, frown=frown)


def rotate_about_feet(img: Image.Image, deg: float) -> Image.Image:
    if deg:
        cx, cy = px(FRAME / 2), px(BOTTOM)
        img = img.rotate(deg, resample=Image.Resampling.BICUBIC, center=(cx, cy), fillcolor=(0, 0, 0, 0))
    return plant_feet(img)


def plant_feet(img: Image.Image) -> Image.Image:
    """Shift so the lowest opaque pixel sits on BOTTOM, matching Cuboe/Cubro."""
    a = np.array(img)
    ys = np.where(a[:, :, 3] > 20)[0]
    if len(ys) == 0:
        return img
    dy = px(BOTTOM) - int(ys.max())
    if dy == 0:
        return img
    shifted = Image.new("RGBA", img.size, (0, 0, 0, 0))
    shifted.paste(img, (0, dy), img)
    return shifted


def end_of(x, y, ang_deg, length):
    """ang 0 = straight down, positive = kick toward the right."""
    a = math.radians(ang_deg)
    return x + math.sin(a) * length, y + math.cos(a) * length


# ---------------------------------------------------------------------------
# Poses. Feet sit on BOTTOM. Numbers are in 128-space, matching Cuboe.
# ---------------------------------------------------------------------------

def pose_idle_stand(stretch=0.0, squat=0.0) -> Image.Image:
    img = canvas()
    body_w = 55 + squat * 10 - stretch * 5
    body_h = 76 - squat * 24 + stretch * 14
    leg_h = 20 - squat * 2
    cx = 64
    y1 = BOTTOM - leg_h + 3
    y0 = BOTTOM - leg_h - body_h
    x0, x1 = cx - body_w / 2, cx + body_w / 2

    gap = 8
    hip_y = y1 - 1
    # slightly out-turned feet, like Cuboe
    draw_limb(img, cx - gap, hip_y, cx - gap - 1, BOTTOM - 8, 5.8, striped=True, n_stripes=4)
    draw_shoe(img, cx - gap - 3, BOTTOM, w=16, h=10)
    draw_limb(img, cx + gap, hip_y, cx + gap + 1, BOTTOM - 8, 5.8, striped=True, n_stripes=4)
    draw_shoe(img, cx + gap + 3, BOTTOM, w=16, h=10)

    _, box = draw_front_body(img, x0, y0, x1, y1, radius=14)
    face_on(img, *box)

    # short stubby arms, tucked close — Cuboe's proportions
    arm_y = y0 + body_h * 0.68
    arm_len = 11.0
    draw_limb(img, x0 + 3, arm_y, x0 - arm_len, arm_y + 1.5, 5.0, striped=True, cuff=True, n_stripes=3)
    draw_limb(img, x1 - 3, arm_y, x1 + arm_len, arm_y + 1.5, 5.0, striped=True, cuff=True, n_stripes=3)
    return img


def pose_run(phase: int) -> Image.Image:
    img = canvas()
    side_w = 16
    front_w = 50
    total_w = side_w + front_w
    body_h = 66 if phase != 3 else 64
    leg_h = 18
    cx = 66
    y1 = BOTTOM - leg_h + 3
    y0 = y1 - body_h
    x0 = cx - total_w / 2
    x1 = x0 + total_w

    if phase == 0:
        l_leg, r_leg, l_arm, r_arm, lean = -32, 28, 28, -30, 6
    elif phase == 1:
        l_leg, r_leg, l_arm, r_arm, lean = -10, 12, 12, -12, 3
    elif phase == 2:
        l_leg, r_leg, l_arm, r_arm, lean = -38, 34, 34, -36, 8
    else:
        l_leg, r_leg, l_arm, r_arm, lean = -6, 8, 8, -8, 2

    hip_l, hip_r = (cx - 8, y1 - 1), (cx + 8, y1 - 1)
    lx, ly = end_of(*hip_l, l_leg, leg_h - 1)
    rx, ry = end_of(*hip_r, r_leg, leg_h - 1)
    # plant shoes on the sole line when the foot is down; allow lift when kicked
    def shoe_y(foot_y):
        return min(BOTTOM, foot_y + 6)

    draw_limb(img, hip_l[0], hip_l[1], lx, ly, 5.1, striped=True, n_stripes=4)
    draw_shoe(img, lx + math.sin(math.radians(l_leg)) * 2, shoe_y(ly), w=14, h=9, angle=-l_leg * 0.4)
    draw_limb(img, hip_r[0], hip_r[1], rx, ry, 5.1, striped=True, n_stripes=4)
    draw_shoe(img, rx + math.sin(math.radians(r_leg)) * 2, shoe_y(ry), w=14, h=9, angle=-r_leg * 0.4)

    _sil, front = draw_three_quarter_body(img, x0, y0, x1, y1, side_w=side_w, radius=12)
    face_on(img, *front, eye_scale=0.95)

    arm_y = y0 + body_h * 0.55
    ax0, ay0 = x0 + 8, arm_y
    ax1, ay1 = end_of(ax0, ay0, l_arm, 13)
    bx0, by0 = x1 - 5, arm_y
    bx1, by1 = end_of(bx0, by0, r_arm, 13)
    draw_limb(img, ax0, ay0, ax1, ay1, 5.0, striped=True, cuff=True, n_stripes=3)
    draw_limb(img, bx0, by0, bx1, by1, 5.1, striped=True, cuff=True, n_stripes=3)
    return rotate_about_feet(img, -lean)


def pose_jump(phase: int) -> Image.Image:
    img = canvas()
    if phase == 0:
        side_w, body_w, body_h, leg_h = 14, 50, 42, 14
        cx = 66
        y1 = BOTTOM - leg_h + 2
        y0 = y1 - body_h
        x0 = cx - (side_w + body_w) / 2
        x1 = x0 + side_w + body_w
        draw_limb(img, cx - 7, y1, cx - 8, BOTTOM - 7, 5.1, striped=True, n_stripes=3)
        draw_shoe(img, cx - 10, BOTTOM, w=14, h=9)
        draw_limb(img, cx + 7, y1, cx + 8, BOTTOM - 7, 5.1, striped=True, n_stripes=3)
        draw_shoe(img, cx + 10, BOTTOM, w=14, h=9)
        _, front = draw_three_quarter_body(img, x0, y0, x1, y1, side_w=side_w, radius=11)
        face_on(img, *front, eye_scale=0.95)
        arm_y = y0 + body_h * 0.58
        # short arms tucked down
        draw_limb(img, x0 + 8, arm_y, x0 - 2, arm_y + 7, 5.0, striped=True, cuff=True, n_stripes=3)
        draw_limb(img, x1 - 4, arm_y, x1 + 6, arm_y + 7, 5.0, striped=True, cuff=True, n_stripes=3)
        return img

    if phase == 1:
        side_w, body_w, body_h, leg_h = 12, 48, 52, 16
        cx = 66
        y1 = BOTTOM - leg_h + 1
        y0 = y1 - body_h
        x0 = cx - (side_w + body_w) / 2
        x1 = x0 + side_w + body_w
        draw_limb(img, cx - 5, y1, cx - 6, y1 + 14, 4.8, striped=True, n_stripes=3)
        draw_shoe(img, cx - 7, min(BOTTOM, y1 + 20), w=13, h=8)
        draw_limb(img, cx + 6, y1, cx + 8, y1 + 14, 4.8, striped=True, n_stripes=3)
        draw_shoe(img, cx + 9, min(BOTTOM, y1 + 20), w=13, h=8)
        _, front = draw_three_quarter_body(img, x0, y0, x1, y1, side_w=side_w, radius=11)
        face_on(img, *front, eye_scale=0.95)
        draw_limb(img, x0 + 10, y0 + 10, x0 + 0, y0 - 14, 5.0, striped=True, cuff=True, n_stripes=3)
        draw_limb(img, x1 - 5, y0 + 10, x1 + 4, y0 - 14, 5.0, striped=True, cuff=True, n_stripes=3)
        return img

    if phase == 2:
        body_w, body_h, leg_h = 48, 86, 16
        cx = 64
        y1 = BOTTOM - leg_h + 2
        y0 = y1 - body_h
        x0, x1 = cx - body_w / 2, cx + body_w / 2
        draw_limb(img, cx - 6, y1, cx - 5, BOTTOM - 7, 4.9, striped=True, n_stripes=3)
        draw_shoe(img, cx - 7, BOTTOM, w=13, h=8)
        draw_limb(img, cx + 6, y1, cx + 5, BOTTOM - 7, 4.9, striped=True, n_stripes=3)
        draw_shoe(img, cx + 7, BOTTOM, w=13, h=8)
        _, box = draw_front_body(img, x0, y0, x1, y1, radius=12, n_stripes=9)
        face_on(img, *box)
        draw_limb(img, x0 + 6, y0 + 8, x0 + 2, y0 - 16, 5.0, striped=True, cuff=True, n_stripes=3)
        draw_limb(img, x1 - 6, y0 + 8, x1 - 2, y0 - 16, 5.0, striped=True, cuff=True, n_stripes=3)
        return img

    # phase 3 — coming down
    side_w, body_w, body_h, leg_h = 13, 50, 44, 18
    cx = 66
    y1 = BOTTOM - leg_h + 2
    y0 = y1 - body_h
    x0 = cx - (side_w + body_w) / 2
    x1 = x0 + side_w + body_w
    draw_limb(img, cx - 6, y1, cx - 16, BOTTOM - 7, 5.0, striped=True, n_stripes=3)
    draw_shoe(img, cx - 18, BOTTOM, w=13.5, h=8.5, angle=18)
    draw_limb(img, cx + 7, y1, cx + 18, BOTTOM - 7, 5.0, striped=True, n_stripes=3)
    draw_shoe(img, cx + 20, BOTTOM, w=13.5, h=8.5, angle=-14)
    _, front = draw_three_quarter_body(img, x0, y0, x1, y1, side_w=side_w, radius=11)
    face_on(img, *front, eye_scale=0.95)
    arm_y = y0 + body_h * 0.50
    draw_limb(img, x0 + 8, arm_y, x0 - 8, arm_y + 4, 5.0, striped=True, cuff=True, n_stripes=3)
    draw_limb(img, x1 - 4, arm_y, x1 + 11, arm_y + 2, 5.0, striped=True, cuff=True, n_stripes=3)
    return rotate_about_feet(img, -4)


def pose_attack(phase: int) -> Image.Image:
    img = canvas()
    side_w, body_w, body_h, leg_h = 15, 52, 56, 16
    shift = [0, 2, 5, 3][phase]
    cx = 60 + shift * 0.4
    y1 = BOTTOM - leg_h + 2
    y0 = y1 - body_h
    x0 = cx - (side_w + body_w) / 2
    x1 = x0 + side_w + body_w

    draw_limb(img, cx - 8, y1, cx - 10, BOTTOM - 7, 5.2, striped=True, n_stripes=3)
    draw_shoe(img, cx - 12, BOTTOM, w=14.5, h=9)
    draw_limb(img, cx + 8, y1, cx + 10, BOTTOM - 7, 5.2, striped=True, n_stripes=3)
    draw_shoe(img, cx + 12, BOTTOM, w=14.5, h=9)

    # left (rear) arm first, then body, then the punch so z-order is right
    arm_y = y0 + body_h * 0.48
    if phase == 0:
        # windup: rear arm hanging, punch arm pulled back on the LEFT — not through the face
        draw_limb(img, x0 + 8, arm_y + 4, x0 - 4, arm_y + 12, 5.0, striped=True, cuff=True, n_stripes=3)
        _, front = draw_three_quarter_body(img, x0, y0, x1, y1, side_w=side_w, radius=12)
        face_on(img, *front, frown=False, eye_scale=0.95)
        # fist pulled back beside the left side
        draw_limb(img, x0 + side_w + 6, arm_y, x0 - 8, arm_y + 2, 5.4, striped=True, cuff=True, n_stripes=4)
        return img

    draw_limb(img, x0 + 8, arm_y + 2, x0 - 5, arm_y + 9, 5.0, striped=True, cuff=True, n_stripes=3)
    _, front = draw_three_quarter_body(img, x0, y0, x1, y1, side_w=side_w, radius=12)
    face_on(img, *front, frown=True, eye_scale=0.95)

    # Punch originates at the front-right edge and extends past the body,
    # same reach as Cuboe's attack (near the right of the 128 frame).
    origin_x = x1 - 6
    if phase == 1:
        end_x = min(110, x1 + 16)
    elif phase == 2:
        end_x = min(114, x1 + 26)
    else:
        end_x = min(112, x1 + 20)
    draw_limb(img, origin_x, arm_y, end_x, arm_y, 5.4, striped=True, cuff=True, n_stripes=5)
    return img


def make_sheet(frames: list[Image.Image], path: Path):
    out = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    for i, fr in enumerate(frames[:4]):
        out.alpha_composite(finish_frame(fr), ((i % 2) * 128, (i // 2) * 128))
    out.save(path, optimize=True)
    print("wrote", path.relative_to(ROOT), out.size)



def make_elf_hat() -> Image.Image:
    """
    Painted elf hat in the same outline + soft-shade language as Cuboe's
    Santa hat: floppy green cone, a solid puffy white fur brim (a cap,
    not a hollow tube), gold bell, a thin red/cream candy band.
    """
    img = canvas()

    # Floppy cone leaning right. Spine is a quadratic bezier.
    cone = empty_mask()
    d = ImageDraw.Draw(cone)

    def bez(t, p0, p1, p2):
        u = 1 - t
        return (u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
                u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1])

    p0, p1, p2 = (64, 96), (46, 50), (90, 18)
    for i in range(24):
        t = i / 23
        cx, cy = bez(t, p0, p1, p2)
        half = 38 * (1 - t) ** 1.05 + 7
        t2 = min(1, t + 0.04)
        nx, ny = bez(t2, p0, p1, p2)
        dx, dy = nx - cx, ny - cy
        L = math.hypot(dx, dy) or 1
        r = half
        d.ellipse((px(cx - r), px(cy - r * 0.85), px(cx + r), px(cy + r * 0.85)), fill=255)
    cone = union(cone, ellipse_mask((78, 6, 106, 32)))
    # keep the cone above the brim's mid-line so fur can sit on top of the base
    clip = empty_mask()
    ImageDraw.Draw(clip).rectangle((0, 0, clip.size[0], px(102)), fill=255)
    cone = ImageChops.multiply(cone, clip)

    green = (28, 122, 58)
    green_lit = (70, 172, 92)
    green_shade = (14, 80, 38)

    def green_fill(dst, mask):
        blit_color(dst, mask, green)
        a = np.array(dst, dtype=np.float32)
        m = np.array(mask) / 255.0
        h, w = m.shape
        yy, xx = np.ogrid[:h, :w]
        t = np.clip(1.0 - np.sqrt((xx - px(48)) ** 2 + (yy - px(48)) ** 2) / px(42), 0, 1) * m
        for i, c in enumerate(green_lit):
            a[:, :, i] = a[:, :, i] * (1 - t * 0.65) + c * (t * 0.65)
        t2 = np.clip((xx - px(72)) / px(28), 0, 1) * m
        t2 *= np.clip((yy - px(30)) / px(50), 0, 1)
        for i, c in enumerate(green_shade):
            a[:, :, i] = a[:, :, i] * (1 - t2 * 0.5) + c * (t2 * 0.5)
        out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")
        dst.paste(out, (0, 0), mask)

    stamp_part(img, cone, green_fill, outline=2.0)

    # Red candy band just above the fur, wrapping the cone base.
    band = empty_mask()
    ImageDraw.Draw(band).ellipse((px(22), px(80), px(106), px(104)), fill=255)
    band_cut = empty_mask()
    ImageDraw.Draw(band_cut).ellipse((px(22), px(74), px(106), px(94)), fill=255)
    band = ImageChops.multiply(subtract(band, band_cut), dilate(cone, 1.5))
    stamp_part(img, band, solid_fill(RED), outline=1.3)
    cream = empty_mask()
    ImageDraw.Draw(cream).ellipse((px(24), px(86), px(104), px(98)), fill=255)
    cream = ImageChops.multiply(cream, band)
    blit_color(img, cream, CREAM)

    # Solid puffy fur brim — a filled oval "cloud", no opening. This is a cap
    # that sits on the head, same idea as Cuboe's Santa brim.
    brim = ellipse_mask((14, 86, 114, 118))
    # a couple of overlapping ovals to puff the front lip a little
    brim = union(brim, ellipse_mask((20, 92, 108, 122)))
    brim = union(brim, ellipse_mask((8, 96, 40, 118)))
    brim = union(brim, ellipse_mask((88, 96, 120, 118)))

    def fur_fill(dst, mask):
        blit_color(dst, mask, (242, 240, 232))
        apply_side_ao(dst, mask, band=12, strength=0.11)
        d2 = ImageDraw.Draw(dst)
        for cx, cy, rx, ry in (
            (36, 100, 11, 8),
            (52, 96, 12, 9),
            (70, 96, 12, 9),
            (88, 100, 11, 8),
            (104, 106, 9, 7),
            (22, 106, 9, 7),
            (64, 108, 14, 7),
        ):
            d2.ellipse((px(cx - rx), px(cy - ry), px(cx + rx), px(cy + ry)), fill=(255, 255, 250, 110))

    stamp_part(img, brim, fur_fill, outline=2.0)

    # gold bell at the tip — simple sphere, highlight, tiny clapper
    bell = ellipse_mask((80, 4, 110, 34))

    def bell_fill(dst, mask):
        blit_color(dst, mask, YELLOW)
        apply_side_ao(dst, mask, from_left=False, band=6, strength=0.16)
        hi = ellipse_mask((86, 8, 98, 20))
        blit_color(dst, hi, YELLOW_LIT)
        d3 = ImageDraw.Draw(dst)
        d3.ellipse((px(92), px(24), px(100), px(32)), fill=INK[:3] + (255,))
        d3.ellipse((px(93), px(25), px(99), px(31)), fill=(90, 60, 20, 255))

    stamp_part(img, bell, bell_fill, outline=1.7)
    hat = finish_frame(img)
    # Pack the hat into the same frame layout as Cuboe's Santa: content
    # sits in the upper-middle of the 128 box (bottom around y=106) so
    # the shared hat FIT (dx, dy, w) lands on the crown, not the eyes.
    a = __import__("numpy").array(hat)
    ys, xs = __import__("numpy").where(a[:, :, 3] > 20)
    if len(xs) == 0:
        return hat
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    crop = hat.crop((x0, y0, x1, y1))
    target_h = 87  # matches the Santa hat's content height
    scale = target_h / crop.size[1]
    nw, nh = max(1, int(round(crop.size[0] * scale))), target_h
    # keep it inside the 128 box
    if nw > 124:
        scale = 124 / crop.size[0]
        nw, nh = 124, max(1, int(round(crop.size[1] * scale)))
    fitted = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    px_ = (128 - nw) // 2
    py_ = 106 - nh  # same content-bottom as Santa
    out.alpha_composite(fitted, (px_, max(0, py_)))
    return out


def make_cosmetics(hat: Image.Image):
    candle_path = OUT / "candy-candle.png"
    if candle_path.exists():
        candle = Image.open(candle_path).convert("RGBA")
        if candle.size != (128, 128):
            candle = candle.resize((128, 128), Image.Resampling.LANCZOS)
    else:
        candle = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    hat.save(OUT / "candy-elf-hat.png", optimize=True)
    cos = Image.new("RGBA", (256, 128), (0, 0, 0, 0))
    cos.alpha_composite(hat, (0, 0))
    cos.alpha_composite(candle, (128, 0))
    cos.save(OUT / "hayden-cosmetics.png", optimize=True)
    print("wrote public/game/sprites/candy-elf-hat.png and hayden-cosmetics.png")


def main():
    idle = [
        pose_idle_stand(),
        pose_idle_stand(squat=1.0),
        pose_idle_stand(stretch=1.0),
        pose_idle_stand(stretch=0.08),
    ]
    run = [pose_run(i) for i in range(4)]
    jump = [pose_jump(i) for i in range(4)]
    attack = [pose_attack(i) for i in range(4)]

    make_sheet(idle, OUT / "candy-cube-idle.png")
    make_sheet(run, OUT / "candy-cube-run.png")
    make_sheet(jump, OUT / "candy-cube-jump.png")
    make_sheet(attack, OUT / "candy-cube-attack.png")

    port = finish_frame(pose_idle_stand())
    port.save(OUT / "candy-cube-portrait.png", optimize=True)
    print("wrote public/game/sprites/candy-cube-portrait.png")

    hat = make_elf_hat()
    make_cosmetics(hat)


if __name__ == "__main__":
    main()

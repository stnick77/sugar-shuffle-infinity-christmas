#!/usr/bin/env python3
"""
The two Backrooms reward heroes, drawn in code (no AI or third-party art):

  Hazmat Cube  a scared cube in a yellow chemical suit: visor, wide nervous
               eyes, worried brows, a sweat drop, black gloves and boots.
  Entity Cube  a creepy (but kid-friendly) black cube with wavy black
               tentacles for arms and legs, a few more waving behind it, and
               a glowing purple smile. The in-game glitch makes it flicker.

They reuse Candy Cube's poses (scripts/art/make-candy-cube.py) so the frames,
foot line (y=118), outline weight and 2x2 x 128px sheet layout match Cuboe,
Cubro and Candy Cube exactly. Only the painters (body, face, limbs, shoes)
are swapped per hero.

    python3 scripts/art/make-backrooms-heroes.py
"""
from __future__ import annotations

import importlib.util
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent


def load_base():
    spec = importlib.util.spec_from_file_location("candybase", HERE / "make-candy-cube.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


# ------------------------------------------------------------------ Hazmat Cube
SUIT = (246, 204, 40)
SUIT_DEEP = (206, 160, 22)
RUBBER = (66, 64, 42)  # pre-warmed: the base shader lifts blue by up to 1.5x, so this lands on neutral dark grey
GLASS = (176, 226, 240)


def hazmat(B):
    px, mask_e, rr = B.px, B.ellipse_mask, B.rounded_rect_mask

    def paint_stripes(dst, mask, y0, y1, n, deep=False):
        base = SUIT_DEEP if deep else SUIT
        layer = Image.new("RGBA", dst.size, base + (255,))
        d = ImageDraw.Draw(layer)
        top, bot = px(y0), px(y1)
        span = max(1, bot - top)
        if n >= 8:  # the body: a seam, a zip and a black/yellow hazard band at the hem
            d.line([(0, top + span * 0.70), (layer.width, top + span * 0.70)], fill=(176, 132, 16, 255), width=px(1.2))
            hb0, hb1 = top + span * 0.80, top + span * 0.93
            d.rectangle((0, hb0, layer.width, hb1), fill=(30, 30, 34, 255))
            for x in range(-px(10), layer.width, px(9)):
                d.polygon([(x, hb1), (x + px(4.5), hb1), (x + px(4.5) + (hb1 - hb0), hb0), (x + (hb1 - hb0), hb0)], fill=SUIT + (255,))
        else:  # sleeves / legs: a wrinkle or two
            for k in (0.35, 0.65):
                y = top + span * k
                d.arc((px(0), y - px(2), layer.width, y + px(2)), 0, 180, fill=(196, 150, 18, 255), width=px(0.8))
        dst.paste(layer, (0, 0), mask)

    def face_on(dst, fx0, fy0, fx1, fy1, *, frown=False, eye_scale=1.0):
        fw, fh = fx1 - fx0, fy1 - fy0
        cx = (fx0 + fx1) / 2
        vx0, vx1 = fx0 + fw * 0.08, fx1 - fw * 0.08
        vy0, vy1 = fy0 + fh * 0.08, fy0 + fh * 0.60
        visor = rr((vx0, vy0, vx1, vy1), min(10, fw * 0.18))
        B.stamp_part(dst, visor, B.solid_fill(GLASS), outline=2.2)
        # glass shine
        d = ImageDraw.Draw(dst)
        d.line([(px(vx0 + 5), px(vy1 - 6)), (px(vx0 + 12), px(vy0 + 4))], fill=(240, 252, 255, 200), width=px(2.2))
        # wide, nervous eyes looking to the side
        eye_y = vy0 + (vy1 - vy0) * 0.48
        er = max(5.5, min(8.0, fw * 0.14)) * eye_scale
        for sx in (-1, 1):
            ex = cx + sx * fw * 0.19
            em = mask_e((ex - er, eye_y - er * 1.15, ex + er, eye_y + er * 1.15))
            B.stamp_part(dst, em, B.solid_fill((255, 255, 252)), outline=1.5)
            pr = er * 0.36
            d.ellipse((px(ex + er * 0.35 - pr), px(eye_y - pr), px(ex + er * 0.35 + pr), px(eye_y + pr)), fill=B.INK)
            d.ellipse((px(ex + er * 0.2 - pr * 0.35), px(eye_y - pr * 0.8), px(ex + er * 0.2 + pr * 0.35), px(eye_y - pr * 0.1)), fill=(255, 255, 255, 255))
            # worried brows (inner ends up)
            by = eye_y - er * 1.15 - 2.5
            d.line([(px(ex + sx * er * 0.9), px(by + 1.2)), (px(ex - sx * er * 0.7), px(by - 2.4))], fill=B.INK, width=px(1.3))  # outer low, inner high = worried
        # a wobbly little mouth inside the visor
        my = min(vy1 - 4.5, eye_y + er + 5)
        pts = [(px(cx - 6 + i * 2), px(my + (0.9 if i % 2 else -0.9))) for i in range(7)]
        d.line(pts, fill=B.INK, width=px(1.2), joint="curve")
        # sweat drop on the visor's edge
        sx0, sy0 = vx1 - 2, vy0 + 3
        drop = B.union(mask_e((sx0 - 3.2, sy0 + 3, sx0 + 3.2, sy0 + 9.5)))
        tri = B.empty_mask()
        ImageDraw.Draw(tri).polygon([(px(sx0), px(sy0)), (px(sx0 - 3), px(sy0 + 6)), (px(sx0 + 3), px(sy0 + 6))], fill=255)
        B.stamp_part(dst, B.union(drop, tri), B.solid_fill((150, 214, 255)), outline=1.2)
        d.ellipse((px(sx0 - 1.6), px(sy0 + 5), px(sx0 - 0.2), px(sy0 + 6.6)), fill=(255, 255, 255, 255))
        # respirator filter under the visor
        fy = vy1 + (fy1 - vy1) * 0.42
        if fy < fy1 - 4:
            fm = mask_e((cx - 6, fy - 4.5, cx + 6, fy + 4.5))
            B.stamp_part(dst, fm, B.solid_fill(RUBBER), outline=1.4)
            for k in (-2.5, 0, 2.5):
                d.line([(px(cx + k), px(fy - 2.5)), (px(cx + k), px(fy + 2.5))], fill=(130, 130, 120, 255), width=px(0.8))

    B.paint_stripes = paint_stripes
    B.face_on = face_on
    # gloves + boots: dark rubber cuffs, hands and shoes
    B.YELLOW = RUBBER
    B.RED = (36, 36, 24)
    B.CREAM = RUBBER
    B.SHOE_RED = (66, 64, 28)  # shoes get the shader twice (~2.25x blue)
    B.SHOE_WHITE = (124, 122, 54)
    return B


# ------------------------------------------------------------------ Entity Cube
VOID = (30, 24, 40)
VOID_DEEP = (16, 12, 24)
PURPLE = (200, 110, 255)
PURPLE_HOT = (240, 200, 255)
ENTITY_INK = (88, 40, 120, 255)  # a purple outline so the black cube still reads on dark rooms


def entity(B):
    px = B.px
    state = {"phase": 0.0}

    def paint_stripes(dst, mask, y0, y1, n, deep=False):
        base = VOID_DEEP if deep else VOID
        layer = Image.new("RGBA", dst.size, base + (255,))
        d = ImageDraw.Draw(layer)
        # faint purple shimmer bands (static-y, not stripes)
        top, bot = px(y0), px(y1)
        for k in range(3):
            y = top + (bot - top) * (0.2 + 0.3 * k + 0.05 * math.sin(state["phase"] + k))
            d.line([(0, y), (layer.width, y)], fill=(70, 40, 100, 255), width=px(0.9))
        dst.paste(layer, (0, 0), mask)

    def glow_blob(dst, m, rgb, blur, alpha=1.0):
        g = m.filter(ImageFilter.GaussianBlur(px(blur)))
        if alpha < 1:
            g = g.point(lambda v: int(v * alpha))
        B.blit_color(dst, g, rgb)

    def face_on(dst, fx0, fy0, fx1, fy1, *, frown=False, eye_scale=1.0):
        fw, fh = fx1 - fx0, fy1 - fy0
        cx = (fx0 + fx1) / 2
        eye_y = fy0 + fh * 0.30
        # two small glowing eyes, slightly uneven
        eyes = B.empty_mask()
        d = ImageDraw.Draw(eyes)
        for sx, r in ((-1, 3.4), (1, 2.8)):
            ex = cx + sx * fw * 0.2
            d.ellipse((px(ex - r * 1.3), px(eye_y - r), px(ex + r * 1.3), px(eye_y + r)), fill=255)
        glow_blob(dst, eyes, PURPLE, 2.2, 0.9)
        B.blit_color(dst, eyes, PURPLE_HOT)
        # the big glowing purple smile (a wide crescent)
        sw = fw * 0.62
        sy = min(fy1 - 10, eye_y + max(12, fh * 0.24))
        smile = B.empty_mask()
        sd = ImageDraw.Draw(smile)
        up, lo = [], []
        for i in range(21):
            t = i / 20
            x = cx - sw / 2 + sw * t
            bend = 1 - (2 * t - 1) ** 2
            up.append((px(x), px(sy + bend * 3.2 - 0.5)))
            lo.append((px(x), px(sy + bend * 9.5 + 0.5)))
        sd.polygon(up + lo[::-1], fill=255)
        glow_blob(dst, smile, PURPLE, 3.0)
        B.blit_color(dst, smile, PURPLE)
        inner = smile.filter(ImageFilter.MinFilter(5))
        B.blit_color(dst, inner, PURPLE_HOT)
        # little tooth lines (friendly, not sharp)
        dd = ImageDraw.Draw(dst)
        for k in range(1, 6):
            t = k / 6
            x = cx - sw / 2 + sw * t
            bend = 1 - (2 * t - 1) ** 2
            dd.line([(px(x), px(sy + bend * 3.2 + 0.5)), (px(x), px(sy + bend * 9.5 - 0.8))], fill=(150, 70, 210, 255), width=px(0.7))

    def tentacle(dst, x1, y1, x2, y2, radius, curl=1.0, tip=0.38, behind=False):
        ux, uy, L = B._axis(x1, y1, x2, y2)
        nx, ny = -uy, ux
        n = max(10, int(L / 1.6))
        pts = []
        for i in range(n + 1):
            t = i / n
            wob = math.sin(t * math.pi * 2.0 + state["phase"] + x1 * 0.07) * radius * 0.9 * curl * t
            pts.append((x1 + ux * L * t + nx * wob, y1 + uy * L * t + ny * wob, radius * (1 - (1 - tip) * t)))
        m = B.empty_mask()
        d = ImageDraw.Draw(m)
        for (ax, ay, ar), (bx, by, br) in zip(pts, pts[1:]):
            d.line([(px(ax), px(ay)), (px(bx), px(by))], fill=255, width=max(2, px((ar + br))))
            d.ellipse((px(bx - br), px(by - br), px(bx + br), px(by + br)), fill=255)
        d.ellipse((px(x1 - radius), px(y1 - radius), px(x1 + radius), px(y1 + radius)), fill=255)
        B.stamp_part(dst, m, B.solid_fill(VOID_DEEP if behind else VOID), outline=1.7)
        # suckers: tiny purple dots along the underside
        dd = ImageDraw.Draw(dst)
        for (ax, ay, ar) in pts[3:-2:3]:
            dd.ellipse((px(ax - ar * 0.28), px(ay - ar * 0.28), px(ax + ar * 0.28), px(ay + ar * 0.28)), fill=(110, 60, 150, 255))

    def draw_limb(dst, x1, y1, x2, y2, radius, *, striped=True, cuff=False, n_stripes=5):
        # arms (cuffed) wave more; legs stay planted-ish
        tentacle(dst, x1, y1, x2, y2, radius * (1.0 if cuff else 1.05), curl=1.3 if cuff else 0.5, tip=0.35 if cuff else 0.6)

    def draw_shoe(dst, cx, cy, w=15, h=9.5, angle=0.0):
        # a curled tentacle tip resting on the floor (keeps the foot line)
        m = B.ellipse_mask((cx - w / 2, cy - h * 0.7, cx + w / 2, cy))
        if angle:
            piv = (px(cx), px(cy - h * 0.15))
            m = m.rotate(-angle, resample=Image.Resampling.BICUBIC, center=piv, fillcolor=0)
        B.stamp_part(dst, m, B.solid_fill(VOID), outline=1.6)
        d = ImageDraw.Draw(dst)
        d.arc((px(cx - w * 0.28), px(cy - h * 0.62), px(cx + w * 0.12), px(cy - h * 0.12)), 200, 520, fill=(110, 60, 150, 255), width=px(0.9))

    B.paint_stripes = paint_stripes
    B.face_on = face_on
    B.draw_limb = draw_limb
    B.draw_shoe = draw_shoe
    B.INK = ENTITY_INK

    def with_back_tentacles(pose_fn, phase):
        def fn(*a, **k):
            state["phase"] = phase
            front = pose_fn(*a, **k)
            bb = front.getbbox()
            back = B.canvas()
            if bb:
                x0, y0, x1, y1 = [v / B.S for v in bb]
                cx, top = (x0 + x1) / 2, y0 + 14
                for sx, ang, ln in ((-1, -62, 30), (1, 58, 32), (-1, -28, 26), (1, 24, 24)):
                    a_ = math.radians(ang + 8 * math.sin(phase + sx))
                    tentacle(back, cx + sx * 12, top + 8, cx + sx * 12 + math.sin(a_) * ln, top + 8 - math.cos(a_) * ln, 3.6, curl=1.4, tip=0.3, behind=True)
            back.alpha_composite(front)
            return back
        return fn

    return B, with_back_tentacles


def make(name, B, wrap=None):
    out = B.OUT
    ph = [0.0, 1.6, 3.2, 4.8]
    W = (lambda f, i: wrap(f, ph[i])) if wrap else (lambda f, i: f)
    idle = [W(B.pose_idle_stand, 0)(), W(B.pose_idle_stand, 1)(squat=1.0), W(B.pose_idle_stand, 2)(stretch=1.0), W(B.pose_idle_stand, 3)(stretch=0.08)]
    run = [W(B.pose_run, i)(i) for i in range(4)]
    jump = [W(B.pose_jump, i)(i) for i in range(4)]
    attack = [W(B.pose_attack, i)(i) for i in range(4)]
    B.make_sheet(idle, out / f"{name}-idle.png")
    B.make_sheet(run, out / f"{name}-run.png")
    B.make_sheet(jump, out / f"{name}-jump.png")
    B.make_sheet(attack, out / f"{name}-attack.png")
    port = B.finish_frame(W(B.pose_idle_stand, 0)())
    port.save(out / f"{name}-portrait.png", optimize=True)
    print("wrote", f"public/game/sprites/{name}-portrait.png")


def main():
    make("hazmat-cube", hazmat(load_base()))
    B, wrap = entity(load_base())
    make("entity-cube", B, wrap)


if __name__ == "__main__":
    main()

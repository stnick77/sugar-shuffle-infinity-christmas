#!/usr/bin/env python3
"""
CURSED Fake Candy Cuboe / Fake Candy Cubro sprite sheets (original, procedural).

Starts from the heroes' own frames (same 2x2 grid of 128px frames, same poses, so every
animation and the boss rig keep working) and turns each one into a creepy-but-kid-friendly
cursed copy:
  * wrong-coloured sour candy: sickly lime-green (Cuboe) / bruise-purple (Cubro) gradient map
  * mismatched glowing eyes (one small acid-green, one big magenta) with a soft glow
  * a wide too-many-teeth grin
  * melting sour-goo cap with drips, cracks in the candy crust, sour-sugar crystals
  * glitchy outline: offset cyan/magenta ghost copies + a corrupted slice that changes each frame
The game adds a dark aura, floating cursed particles and a flicker on top (src/game/bosses/rig.ts).

  python3 scripts/art/make-cursed-fakes.py   ->  public/game/sprites/fake-{cuboe,cubro}-{idle,run,jump,attack}.png
"""
import math, os, random
from collections import deque
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

HERE = os.path.dirname(__file__)
SPR = os.path.join(HERE, "..", "..", "public", "game", "sprites")
F = 128

PAL = {
    "cuboe": dict(ramp=[(14, 30, 12), (70, 112, 34), (140, 190, 70), (205, 240, 140)], goo=(170, 255, 40), eye=(255, 205, 40), crack=(30, 60, 10), feat_lum=95),
    "cubro": dict(ramp=[(22, 8, 34), (84, 32, 120), (150, 80, 200), (220, 170, 255)], goo=(200, 90, 255), eye=(190, 255, 70), crack=(20, 4, 30), feat_lum=32),
}
EYE_A = (190, 255, 70)   # small eye: acid green (Cubro) / sour yellow (Cuboe), see PAL
EYE_B = (255, 60, 200)   # big magenta eye


def ramp(ramp_cols, t):
    t = min(1.0, max(0.0, t)) * (len(ramp_cols) - 1)
    i = min(int(t), len(ramp_cols) - 2)
    f = t - i
    a, b = ramp_cols[i], ramp_cols[i + 1]
    return tuple(int(a[k] + (b[k] - a[k]) * f) for k in range(3))


def blobs(mask):
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    out = []
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not seen[y, x]:
                q = deque([(y, x)])
                seen[y, x] = True
                pts = []
                while q:
                    cy, cx = q.popleft()
                    pts.append((cy, cx))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            q.append((ny, nx))
                ys = [p[0] for p in pts]
                xs = [p[1] for p in pts]
                out.append(dict(n=len(pts), x0=min(xs), x1=max(xs), y0=min(ys), y1=max(ys), cx=sum(xs) / len(xs), cy=sum(ys) / len(ys)))
    return out


def glow_eye(layer, glow, x, y, r, col):
    d = ImageDraw.Draw(layer)
    g = ImageDraw.Draw(glow)
    g.ellipse([x - r * 2.4, y - r * 2.4, x + r * 2.4, y + r * 2.4], fill=col + (170,))
    d.ellipse([x - r - 1, y - r - 1, x + r + 1, y + r + 1], fill=(10, 0, 10, 255))
    d.ellipse([x - r, y - r, x + r, y + r], fill=col + (255,))
    d.ellipse([x - r * 0.35, y - r * 0.35, x + r * 0.35, y + r * 0.35], fill=(255, 255, 255, 255))


def grin(layer, cx, cy, w, h):
    d = ImageDraw.Draw(layer)
    n = 24
    top = [(cx - w / 2 + w * i / n, cy - h * 0.15 * math.sin(math.pi * i / n) * -0.3) for i in range(n + 1)]
    bot = [(cx + w / 2 - w * i / n, cy + h * math.sin(math.pi * i / n)) for i in range(n + 1)]
    poly = top + bot
    d.polygon(poly, fill=(36, 0, 24, 255))
    # too many teeth: zigzag rows top and bottom
    teeth = max(7, int(w / 3.2))
    for i in range(teeth):
        x0 = cx - w / 2 + w * i / teeth
        x1 = cx - w / 2 + w * (i + 1) / teeth
        tx = (x0 + x1) / 2
        ty = cy + h * 0.15 * math.sin(math.pi * (tx - (cx - w / 2)) / w) * 0.3
        d.polygon([(x0, ty), (x1, ty), (tx, ty + h * 0.42)], fill=(250, 250, 225, 255))
        by = cy + h * math.sin(math.pi * (tx - (cx - w / 2)) / w)
        if by - cy > h * 0.35:
            d.polygon([(x0, by), (x1, by), (tx, by - h * 0.38)], fill=(250, 250, 225, 255))
    d.line(poly + [poly[0]], fill=(10, 0, 8, 255), width=1)


def cursify(frame, hero, seed):
    rnd = random.Random(seed)
    P = PAL[hero]
    a = np.array(frame).astype(np.float32)
    alpha = a[:, :, 3]
    A = alpha > 128
    if not A.any():
        return frame
    lum = 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]
    interior = np.array(Image.fromarray((A * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(9))) > 0
    ys, xs = np.where(interior)
    by0, by1, bx0, bx1 = ys.min(), ys.max(), xs.min(), xs.max()
    # head/block region: upper 65% of the interior box
    head_y1 = by0 + (by1 - by0) * 0.65
    # dark face features; for dark chocolate Cubro tighten the threshold until the
    # sunglasses separate from the body shading
    for thr in [P["feat_lum"], 26, 20, 15, 11, 8]:
        if thr > P["feat_lum"]:
            continue
        fb = [b for b in blobs(interior & (lum < thr)) if b["n"] >= 4 and b["cy"] < head_y1]
        big = [b for b in fb if (b["x1"] - b["x0"]) >= (bx1 - bx0) * 0.5]
        if hero != "cubro" or not big or max(b["y1"] - b["y0"] for b in big) < (by1 - by0) * 0.3:
            break

    # 1) wrong-coloured sour candy (gradient map on luminance, outline stays dark)
    lo, hi = np.percentile(lum[A], 3), np.percentile(lum[A], 97)
    t = np.clip((lum - lo) / max(1.0, hi - lo), 0, 1)
    out = a.copy()
    for y in range(F):
        for x in range(F):
            if alpha[y, x] > 0:
                c = ramp(P["ramp"], t[y, x] * 0.92 + 0.04)
                out[y, x, :3] = c
    img = Image.fromarray(out.astype(np.uint8), "RGBA")
    over = Image.new("RGBA", (F, F), (0, 0, 0, 0))
    glow = Image.new("RGBA", (F, F), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    body_w = bx1 - bx0
    body_h = by1 - by0

    # 2) melting goo cap + drips along the top edge of the candy block
    tops = {}
    for x in range(bx0, bx1 + 1):
        col = np.where(interior[:, x])[0]
        if len(col):
            tops[x] = col.min()
    goo = P["goo"]
    xs_sorted = sorted(tops)
    for x in xs_sorted:
        y = tops[x]
        d.line([(x, y - 1), (x, y + 3)], fill=goo + (255,))
    for _ in range(3 + rnd.randint(0, 2)):
        x = rnd.choice(xs_sorted[len(xs_sorted) // 6 : -len(xs_sorted) // 6 or None])
        y = tops[x] + 2
        L = rnd.randint(5, max(6, int(body_h * 0.28)))
        d.rounded_rectangle([x - 1.5, y, x + 1.5, y + L], radius=1.5, fill=goo + (255,))
        d.ellipse([x - 2.5, y + L - 2, x + 2.5, y + L + 3], fill=goo + (255,))
        d.point((x - 1, y + 2), fill=(255, 255, 255, 200))

    # 3) cracks in the candy crust
    for _ in range(2):
        side = rnd.choice([-1, 1])
        x = bx0 + 3 if side < 0 else bx1 - 3
        y = rnd.uniform(by0 + body_h * 0.15, by0 + body_h * 0.6)
        pts = [(x, y)]
        for _ in range(4):
            x += -side * rnd.uniform(3, 6)
            y += rnd.uniform(-4, 4)
            pts.append((x, y))
        d.line(pts, fill=P["crack"] + (255,), width=2)
        d.line([(px + 1, py + 1) for px, py in pts], fill=(255, 255, 255, 90), width=1)
    # sour sugar crystals
    for _ in range(int(body_w * body_h / 90)):
        x = rnd.uniform(bx0, bx1)
        y = rnd.uniform(by0, by1)
        if interior[int(y), int(x)]:
            d.rectangle([x, y, x + 1, y + 1], fill=(245, 255, 235, 200))

    # 4) mismatched glowing eyes + 5) too-many-teeth grin
    eyes = sorted([b for b in fb if b["n"] < 400 and (b["x1"] - b["x0"]) < body_w * 0.7], key=lambda b: b["cy"])
    # Cubro's shades are the biggest dark shape on his small cube head (his arms and legs
    # make the body box wide, so any dark shape at least 18px wide on the head counts)
    glasses = [b for b in fb if (b["x1"] - b["x0"]) >= body_w * (0.5 if hero != "cubro" else 0.0) and (hero != "cubro" or (b["x1"] - b["x0"]) >= 18)]
    if hero == "cubro" and glasses:
        g = max(glasses, key=lambda b: b["n"])
        gw = g["x1"] - g["x0"]
        ey = (g["y0"] + g["y1"]) / 2
        r = max(2.5, gw * 0.075)
        glow_eye(over, glow, g["x0"] + gw * 0.26, ey, r, P["eye"])
        glow_eye(over, glow, g["x0"] + gw * 0.74, ey, r * 1.45, EYE_B)
        gh = g["y1"] - g["y0"]
        gy = g["y1"] + 1  # right under the shades, spilling over his chin like a too-wide jaw
        grin(over, (g["x0"] + g["x1"]) / 2, gy, max(14, gw * 0.75), max(5, gh * 0.9))
    else:
        pair = []
        if len(eyes) >= 2:
            top = eyes[0]["cy"]
            row = [b for b in eyes if abs(b["cy"] - top) < 8]
            row.sort(key=lambda b: b["cx"])
            if len(row) >= 2:
                pair = [row[0], row[-1]]
        if pair:
            sep = pair[1]["cx"] - pair[0]["cx"]
            r = max(2.5, min(5.5, sep * 0.22))
            ey = (pair[0]["cy"] + pair[1]["cy"]) / 2
            glow_eye(over, glow, pair[0]["cx"], ey, r, P["eye"])
            glow_eye(over, glow, pair[1]["cx"], ey + 1, r * 1.45, EYE_B)
            mx = (pair[0]["cx"] + pair[1]["cx"]) / 2
            grin(over, mx, ey + max(6, sep * 0.55), max(14, sep * 1.7), max(5, sep * 0.42))
        else:
            # no readable face (tiny pose): put one in the upper middle of the block
            cx = (bx0 + bx1) / 2
            cy = by0 + body_h * 0.32
            r = max(2.2, body_w * 0.06)
            glow_eye(over, glow, cx - body_w * 0.16, cy, r, P["eye"])
            glow_eye(over, glow, cx + body_w * 0.16, cy, r * 1.45, EYE_B)
            grin(over, cx, cy + body_w * 0.16, body_w * 0.5, body_w * 0.13)

    # keep goo/cracks/crystals on the candy (eyes + glow may poke out a bit)
    clip = Image.fromarray((A * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
    over_clipped = Image.new("RGBA", (F, F), (0, 0, 0, 0))
    over_clipped.paste(over, (0, 0), ImageChops.multiply(over.split()[3], clip))
    glow = glow.filter(ImageFilter.GaussianBlur(2.4))
    img = Image.alpha_composite(img, glow)
    img = Image.alpha_composite(img, over_clipped)

    # 6) glitchy outline: cyan/magenta ghosts + a corrupted slice
    sil = img.split()[3]
    base = Image.new("RGBA", (F, F), (0, 0, 0, 0))
    for dx, col in ((-2, (60, 255, 230)), (2, (255, 40, 200))):
        ghost = Image.new("RGBA", (F, F), col + (0,))
        ghost.putalpha(ImageChops.offset(sil, dx, 0).point(lambda v: int(v * 0.55)))
        base = Image.alpha_composite(base, ghost)
    rim = Image.new("RGBA", (F, F), (12, 0, 16, 0))
    rim.putalpha(sil.filter(ImageFilter.MaxFilter(3)))
    base = Image.alpha_composite(base, rim)
    img = Image.alpha_composite(base, img)
    # corrupted slice (different every frame, so the animation flickers)
    arr = np.array(img)
    for _ in range(rnd.randint(1, 2)):
        y = rnd.randint(int(by0 + body_h * 0.1), int(by0 + body_h * 0.8))
        hgt = rnd.randint(2, 4)
        shift = rnd.choice([-4, -3, 3, 4])
        arr[y : y + hgt] = np.roll(arr[y : y + hgt], shift, axis=1)
    return Image.fromarray(arr, "RGBA")


def main():
    for hero in ("cuboe", "cubro"):
        for anim in ("idle", "run", "jump", "attack"):
            src = Image.open(os.path.join(SPR, f"{hero}-{anim}.png")).convert("RGBA")
            out = Image.new("RGBA", src.size, (0, 0, 0, 0))
            cols = src.width // F
            for i in range(cols * (src.height // F)):
                x, y = (i % cols) * F, (i // cols) * F
                fr = src.crop((x, y, x + F, y + F))
                out.paste(cursify(fr, hero, seed=hash((hero, anim, i)) & 0xFFFF), (x, y))
            name = f"fake-{hero}-{anim}.png"
            out.save(os.path.join(SPR, name))
            print("wrote", name)


if __name__ == "__main__":
    main()

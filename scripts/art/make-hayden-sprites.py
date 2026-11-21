#!/usr/bin/env python3
"""
Build in-game sprites from Hayden's cut-out drawings.

Animation frames are affine squash / stretch / tilt of the single standing
pose — no new drawn art. The elf hat is a small geometric (code-drawn)
costume piece; see assets/hayden/README.md.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parents[2]
CUT = ROOT / "assets/hayden/cutouts"
OUT = ROOT / "public/game/sprites"
OUT.mkdir(parents=True, exist_ok=True)

def fit(im: Image.Image, box: int, pad=0.08) -> Image.Image:
    im = im.convert("RGBA")
    inner = int(box * (1 - pad * 2))
    s = min(inner / im.size[0], inner / im.size[1])
    nw, nh = max(1, int(im.size[0] * s)), max(1, int(im.size[1] * s))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (box, box), (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((box - nw) // 2, box - nh - int(box * 0.04)))
    return canvas

def affine(frame: Image.Image, *, sx=1.0, sy=1.0, rot=0.0, dx=0, dy=0) -> Image.Image:
    w, h = frame.size
    # scale about feet (bottom center)
    cx, cy = w / 2, h * 0.88
    # PIL transform: inverse affine around pivot
    # first translate so pivot at origin, rotate/scale, translate back + offset
    from math import cos, sin, radians
    a = radians(-rot)
    ca, sa = cos(a), sin(a)
    # dest = R * S * (src - pivot) + pivot + (dx,dy)
    # We need the inverse for Image.transform
    # Use a slightly larger canvas then crop
    # Simpler: resize then rotate then paste
    nw, nh = max(1, int(w * sx)), max(1, int(h * sy))
    scaled = frame.resize((nw, nh), Image.Resampling.LANCZOS)
    # vertical align to feet: keep bottom at same place
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = int((w - nw) / 2 + dx)
    py = int(h - nh - (h * (1 - sy) * 0.0) + dy)
    # keep feet: original feet at h, scaled feet at py+nh
    py = int((h - nh) + dy)
    canvas.alpha_composite(scaled, (px, py))
    if rot:
        canvas = canvas.rotate(rot, resample=Image.Resampling.BICUBIC, center=(w / 2, h * 0.7), fillcolor=(0, 0, 0, 0))
    return canvas

def sheet(frames: list[Image.Image], path: Path):
    # 2x2 128px
    out = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    for i, fr in enumerate(frames[:4]):
        x, y = (i % 2) * 128, (i // 2) * 128
        out.alpha_composite(fr, (x, y))
    out.save(path, optimize=True)
    print("wrote", path.relative_to(ROOT), out.size)

def main():
    candy = Image.open(CUT / "candy-cube.png")
    base = fit(candy, 128, pad=0.06)

    idle = [
        affine(base, sy=1.00, sx=1.00),
        affine(base, sy=0.96, sx=1.03, dy=1),
        affine(base, sy=1.00, sx=1.00),
        affine(base, sy=1.04, sx=0.97, dy=-1),
    ]
    run = [
        affine(base, rot=-4, sy=0.98, sx=1.02, dx=-2),
        affine(base, rot=-7, sy=1.05, sx=0.96, dx=-1, dy=-3),
        affine(base, rot=-4, sy=0.97, sx=1.03, dx=2),
        affine(base, rot=3, sy=1.04, sx=0.97, dx=1, dy=-2),
    ]
    jump = [
        affine(base, sy=1.12, sx=0.90, dy=-4),
        affine(base, sy=1.08, sx=0.92, rot=-3, dy=-2),
        affine(base, sy=0.92, sx=1.08, dy=2),
        affine(base, sy=0.88, sx=1.12, dy=3),
    ]
    attack = [
        affine(base, rot=0),
        affine(base, rot=-8, sx=1.05, sy=0.96, dx=-3),
        affine(base, rot=10, sx=1.10, sy=0.94, dx=4),
        affine(base, rot=4, sx=1.02, sy=0.98, dx=1),
    ]
    sheet(idle, OUT / "candy-cube-idle.png")
    sheet(run, OUT / "candy-cube-run.png")
    sheet(jump, OUT / "candy-cube-jump.png")
    sheet(attack, OUT / "candy-cube-attack.png")
    # portrait: standing pose, a bit tighter
    port = fit(candy, 128, pad=0.04)
    port.save(OUT / "candy-cube-portrait.png", optimize=True)
    print("wrote public/game/sprites/candy-cube-portrait.png")

    def boss(name, box=256, pad=0.06):
        im = fit(Image.open(CUT / f"{name}.png"), box, pad=pad)
        im.save(OUT / f"{name}.png", optimize=True)
        print("wrote", f"public/game/sprites/{name}.png", im.size)

    boss("warlord-1")
    boss("warlord-2")
    boss("warlord-3")
    # group portrait for menus / HUD
    grp = Image.open(CUT / "admin-warlords.png")
    # wide
    W, H = 384, 192
    s = min((W * 0.96) / grp.size[0], (H * 0.96) / grp.size[1])
    rs = grp.resize((max(1, int(grp.size[0] * s)), max(1, int(grp.size[1] * s))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(rs, ((W - rs.size[0]) // 2, H - rs.size[1] - 4))
    canvas.save(OUT / "admin-warlords.png", optimize=True)
    print("wrote public/game/sprites/admin-warlords.png")

    orb = Image.open(CUT / "admin-orb.png")
    orb64 = fit(orb, 64, pad=0.04)
    orb64.save(OUT / "admin-orb.png", optimize=True)
    print("wrote public/game/sprites/admin-orb.png")

    # credits drawing used on the credits screen
    cred = Image.open(CUT / "credits-cuboe-cubro.png")
    # scale to a reasonable web width ~900
    tw = 900
    th = int(cred.size[1] * tw / cred.size[0])
    cred.resize((tw, th), Image.Resampling.LANCZOS).save(OUT / "credits-cuboe-cubro.png", optimize=True)
    print("wrote public/game/sprites/credits-cuboe-cubro.png")

    # --- code-drawn elf hat + candle icon (Hayden's cosmetics; not AI / not third-party) ---
    hat = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(hat)
    # brim
    d.ellipse((18, 84, 110, 114), fill=(16, 90, 36, 255))
    d.ellipse((22, 86, 106, 108), fill=(20, 120, 48, 255))
    # cone
    d.polygon([(36, 92), (64, 14), (92, 92)], fill=(180, 28, 36, 255))
    d.polygon([(48, 92), (64, 28), (80, 92)], fill=(210, 40, 48, 255))
    # fur trim on brim
    d.ellipse((16, 80, 112, 104), outline=(245, 245, 240, 255), width=6)
    d.ellipse((20, 88, 108, 112), fill=(236, 236, 230, 255))
    d.ellipse((28, 90, 100, 108), fill=(20, 110, 44, 255))
    # pom-pom
    d.ellipse((52, 4, 76, 28), fill=(245, 245, 240, 255))
    d.ellipse((56, 8, 72, 22), fill=(255, 255, 255, 255))
    hat.save(OUT / "candy-elf-hat.png", optimize=True)

    candle = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(candle)
    # glow
    d.ellipse((40, 8, 88, 64), fill=(255, 180, 60, 50))
    # flame
    d.ellipse((54, 18, 74, 54), fill=(255, 200, 70, 255))
    d.polygon([(64, 8), (78, 36), (64, 52), (50, 36)], fill=(255, 150, 40, 255))
    d.ellipse((58, 28, 70, 50), fill=(255, 240, 180, 255))
    # wick
    d.rectangle((62, 52, 66, 62), fill=(40, 24, 16, 255))
    # candle body
    d.rounded_rectangle((48, 60, 80, 118), radius=6, fill=(255, 244, 214, 255), outline=(210, 170, 90, 255), width=3)
    d.rectangle((52, 68, 58, 112), fill=(255, 252, 235, 180))
    # red stripe
    d.rectangle((48, 86, 80, 94), fill=(200, 40, 48, 220))
    candle.save(OUT / "candy-candle.png", optimize=True)

    # 2-frame cosmetics sheet (hat, candle) at 128
    cos = Image.new("RGBA", (256, 128), (0, 0, 0, 0))
    cos.alpha_composite(hat, (0, 0))
    cos.alpha_composite(candle, (128, 0))
    cos.save(OUT / "hayden-cosmetics.png", optimize=True)
    print("wrote elf hat, candle, hayden-cosmetics.png")

if __name__ == "__main__":
    main()

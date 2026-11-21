#!/usr/bin/env python3
"""
Credits "Thanks for playing! -Cuboe and Cubro" picture, built in code.

Hayden's hand drawing (assets/hayden/originals/credits.jpg, kept as-is) sets
the layout: a white paper page with a fold, his words across the top
("Thanks for playing!" then "-Cuboe and Cubro"), Cuboe on the left with his
arm up high, Cubro on the right.

Cuboe and Cubro are their real in-game selves, not redrawings: frames are cut
straight from the game's own sprite sheets
  - cuboe-jump.png, arms-up frame (top right)
  - cubro-idle.png, first frame, mirrored so he faces Cuboe (the game flips
    him the same way when he faces left)
and scaled up with smooth high-quality (Lanczos) resampling, because the game
renders its sprites smoothly (Phaser `pixelArt: false`). Each gets a soft
ground shadow.

No AI art and no third-party art. Lettering uses Lilita One, the same font the
game UI already uses (falls back to DejaVu Sans Bold).

    python3 scripts/art/make-credits-art.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SPRITES = ROOT / "public/game/sprites"
OUT = SPRITES / "credits-cuboe-cubro.png"

W, H = 1200, 800
SS = 2  # supersample, then downsample once at the end
FRAME = 128  # in-game sheets are 2x2 grids of 128px frames
INK = (41, 9, 33)
PAPER = (251, 248, 240)
PAPER_EDGE = (232, 224, 208)
FONTS = (
    "/usr/share/fonts/truetype/sand-box/google/Lilita One/LilitaOne-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
)


def P(v: float) -> int:
    return int(round(v * SS))


def mask() -> Image.Image:
    return Image.new("L", (W * SS, H * SS), 0)


def fill(dst: Image.Image, m: Image.Image, rgb, alpha=255):
    if alpha < 255:
        m = m.point(lambda v: v * alpha // 255)
    dst.paste(Image.new("RGBA", dst.size, tuple(rgb) + (255,)), (0, 0), m)


def font(size: int):
    for f in FONTS:
        try:
            return ImageFont.truetype(f, P(size))
        except OSError:
            continue
    return ImageFont.load_default()


# --------------------------------------------------------------------------- page + words

def draw_page(img: Image.Image):
    page = mask()
    ImageDraw.Draw(page).rounded_rectangle([P(14), P(14), P(W - 14), P(H - 14)], radius=P(34), fill=255)
    fill(img, page.filter(ImageFilter.MaxFilter(P(5) * 2 + 1)), INK)
    fill(img, page, PAPER)
    # soft paper edge + Hayden's fold down the middle of the page
    inner = page.filter(ImageFilter.MinFilter(P(18) * 2 + 1))
    edge = ImageChops.subtract(page, inner).filter(ImageFilter.GaussianBlur(P(10)))
    fill(img, ImageChops.multiply(edge, page), PAPER_EDGE, 160)
    fold = mask()
    ImageDraw.Draw(fold).line([(P(600), P(30)), (P(600), P(H - 30))], fill=140, width=P(3))
    fill(img, fold.filter(ImageFilter.GaussianBlur(P(3))), PAPER_EDGE)


def draw_words(img: Image.Image):
    # His lettering across the top, rising a little to the right.
    for txt, size, rot, (cx, cy) in (
        ("Thanks for playing!", 84, 2, (430, 92)),
        ("-Cuboe and Cubro", 50, 2, (820, 162)),
    ):
        tmp = Image.new("RGBA", (W * SS, P(size * 2)), (0, 0, 0, 0))
        ImageDraw.Draw(tmp).text((P(20), P(size * 0.3)), txt, font=font(size), fill=INK + (255,),
                                 stroke_width=P(1), stroke_fill=INK + (255,))
        tmp = tmp.crop(tmp.getbbox()).rotate(rot, resample=Image.Resampling.BICUBIC, expand=True)
        img.alpha_composite(tmp, (P(cx) - tmp.width // 2, P(cy) - tmp.height // 2))


# --------------------------------------------------------------------------- in-game sprites

def sprite_frame(sheet: str, col: int, row: int, flip=False) -> Image.Image:
    """One 128px frame from an in-game sheet, cropped to its pixels."""
    im = Image.open(SPRITES / sheet).convert("RGBA")
    fr = im.crop((col * FRAME, row * FRAME, (col + 1) * FRAME, (row + 1) * FRAME))
    if flip:
        fr = fr.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    return fr.crop(fr.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox())


def place(img: Image.Image, fr: Image.Image, cx: float, feet_y: float, height: float):
    """Scale a frame to `height` px (smooth, like the game) and stand it on feet_y with a soft shadow."""
    k = height / fr.height
    w, h = P(fr.width * k), P(fr.height * k)
    big = fr.resize((w, h), Image.Resampling.LANCZOS)
    sw = fr.width * k * 0.9
    sh = mask()
    ImageDraw.Draw(sh).ellipse([P(cx - sw / 2), P(feet_y - 14), P(cx + sw / 2), P(feet_y + 16)], fill=255)
    fill(img, sh.filter(ImageFilter.GaussianBlur(P(9))), (0, 0, 0), 60)
    img.alpha_composite(big, (P(cx) - w // 2, P(feet_y) - h))


def main():
    img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    draw_page(img)
    draw_words(img)
    # Cuboe, left: arms-up frame from his jump sheet (Hayden drew him waving high).
    place(img, sprite_frame("cuboe-jump.png", 1, 0), cx=330, feet_y=742, height=500)
    # Cubro, right: idle on his skateboard, facing Cuboe.
    place(img, sprite_frame("cubro-idle.png", 0, 0, flip=True), cx=870, feet_y=742, height=500)
    out = img.resize((W, H), Image.Resampling.LANCZOS)
    out.save(OUT, optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} {out.size}")


if __name__ == "__main__":
    main()

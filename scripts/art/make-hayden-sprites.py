#!/usr/bin/env python3
"""
Build Hayden's in-game art: the code-drawn candle icon here, then
make-candy-cube.py, make-admin-warlords.py, make-credits-art.py and
make-saloon-party.py.

Candy Cube's in-game sheets and the elf hat are drawn by
make-candy-cube.py (same painted style as Cuboe/Cubro). This script
calls that one at the end so a full rebuild stays one command.
The photographed Candy Cube cutout in assets/hayden/cutouts/ is kept
as reference and is no longer copied into the playable sheets.
"""
from pathlib import Path
from PIL import Image, ImageDraw

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

def main():
    # Admin Warlords (3 phase sheets), their group portrait and the Admin orb
    # are drawn in code in the boss style by make-admin-warlords.py (run at
    # the end); the photo cutouts stay in assets/hayden/cutouts/ as reference.

    # The credits picture is redrawn in code in the sprite style by
    # make-credits-art.py (run at the end); the cutout stays as reference.

    # --- code-drawn candle icon (closet); the elf hat and Candy Cube
    # sheets are drawn by make-candy-cube.py, which also composes
    # hayden-cosmetics.png from the hat + this candle.
    candle = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(candle)
    d.ellipse((40, 8, 88, 64), fill=(255, 180, 60, 50))
    d.ellipse((54, 18, 74, 54), fill=(255, 200, 70, 255))
    d.polygon([(64, 8), (78, 36), (64, 52), (50, 36)], fill=(255, 150, 40, 255))
    d.ellipse((58, 28, 70, 50), fill=(255, 240, 180, 255))
    d.rectangle((62, 52, 66, 62), fill=(40, 24, 16, 255))
    d.rounded_rectangle((48, 60, 80, 118), radius=6, fill=(255, 244, 214, 255), outline=(210, 170, 90, 255), width=3)
    d.rectangle((52, 68, 58, 112), fill=(255, 252, 235, 180))
    d.rectangle((48, 86, 80, 94), fill=(200, 40, 48, 220))
    candle.save(OUT / "candy-candle.png", optimize=True)
    print("wrote public/game/sprites/candy-candle.png")

    # Candy Cube in Cuboe/Cubro style + elf hat + cosmetics sheet
    import subprocess, sys
    subprocess.check_call([sys.executable, str(Path(__file__).with_name("make-candy-cube.py"))])
    subprocess.check_call([sys.executable, str(Path(__file__).with_name("make-admin-warlords.py"))])
    # Credits "Thanks for playing!" picture in the same style
    subprocess.check_call([sys.executable, str(Path(__file__).with_name("make-credits-art.py"))])
    # Drunk Saloon party background (uses the boss + warlord sheets above)
    subprocess.check_call([sys.executable, str(Path(__file__).with_name("make-saloon-party.py"))])


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Turn a 2x2 flat-background AI art grid into a 256x256 sheet of 128px frames
(the same layout as public/game/sprites/pickups.png). Used once for the
'Tis the Seasones DLC art; kept so the sheets can be regenerated.

usage: python3 scripts/xmas-sheet.py in.jpg out.png
"""
import sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
h, w, _ = im.shape
border = np.concatenate([im[:8].reshape(-1, 3), im[-8:].reshape(-1, 3), im[:, :8].reshape(-1, 3), im[:, -8:].reshape(-1, 3)])
bg = np.median(border, axis=0)
d = np.sqrt(((im - bg) ** 2).sum(axis=2))
alpha = np.clip((d - 60) / 70, 0, 1)
# de-spill: pull bg colour out of semi-transparent edge pixels
a3 = alpha[..., None]
rgb = np.where(a3 > 0.02, (im - bg * (1 - a3)) / np.maximum(a3, 0.02), 0)
rgba = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
full = Image.fromarray(rgba, "RGBA")
sheet = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
for i in range(4):
    qx, qy = (i % 2) * w // 2, (i // 2) * h // 2
    q = full.crop((qx, qy, qx + w // 2, qy + h // 2))
    bbox = q.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
    if not bbox:
        continue
    q = q.crop(bbox)
    s = 116 / max(q.size)
    q = q.resize((max(1, round(q.size[0] * s)), max(1, round(q.size[1] * s))), Image.LANCZOS)
    fx, fy = (i % 2) * 128, (i // 2) * 128
    sheet.paste(q, (fx + (128 - q.size[0]) // 2, fy + (128 - q.size[1]) // 2), q)
sheet.save(dst)
print("wrote", dst, "bg", bg.round())

#!/usr/bin/env python3
"""
Cubro in his attack-animation look, for every animation (original art, built by code).

Hayden asked for Cubro to always look the way he does in his attack animation: a small
chocolate-cube head with black shades on a chocolate body with arms and legs, black shorts
with a belt, chunky boots and a little wooden skateboard with tan wheels.

The attack sheet (cubro-attack.png) is the only source. Its two calm poses (frame 0: crouched
on the board, frame 3: standing on the board) are cut into "rider" (everything above the deck)
and "board" pieces and re-posed with small squash, bob, lean and tilt moves for idle, run and
jump. Every sheet stays a 2x2 grid of 128px frames with the feet/board on the same bottom line
(y=119), so the animations, hitbox, cosmetics and the fake boss all line up as before.

  python3 scripts/art/make-cubro-attack-look.py
      reads   scripts/art/src/cubro-attack-original.png
      writes  public/game/sprites/cubro-{idle,run,jump,portrait}.png  (cubro-attack.png is copied as-is)
  The old sheets are kept in scripts/art/src/cubro-*-original.png for reference.
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "src", "cubro-attack-original.png")
OUT = os.path.join(HERE, "..", "..", "public", "game", "sprites")
F = 128
DECK = 100      # first row of the skateboard deck in the attack frames
BOTTOM = 119    # wheels touch the ground here in every Cubro sheet
UP = 4          # supersample for smooth transforms


def frame(sheet, i):
    x, y = (i % 2) * F, (i // 2) * F
    return sheet.crop((x, y, x + F, y + F))


def split(fr):
    rider = fr.copy()
    ImageDraw.Draw(rider).rectangle((0, DECK + 3, F, F), fill=(0, 0, 0, 0))
    board = fr.copy()
    ImageDraw.Draw(board).rectangle((0, 0, F, DECK - 1), fill=(0, 0, 0, 0))
    # feet overlap the deck a little: keep the deck rows in the board piece only where the rider is absent
    return rider, board


def squash(img, sy, sx=1.0, anchor_y=DECK + 2, dx=0, dy=0, lean=0.0):
    """Scale about (centre-x of content, anchor_y) and shear forward by `lean` px per px of height."""
    big = img.resize((F * UP, F * UP), Image.LANCZOS)
    bb = img.getbbox() or (0, 0, F, F)
    cx = (bb[0] + bb[2]) / 2 * UP
    ay = anchor_y * UP
    # inverse affine: out(x,y) <- in(a*x+b*y+c, d*x+e*y+f)
    a = 1 / sx
    e = 1 / sy
    b = lean / sy
    c = cx - a * (cx + dx * UP) - b * (ay + dy * UP)
    f = ay - e * (ay + dy * UP)
    out = big.transform(big.size, Image.AFFINE, (a, b, c, 0, e, f), resample=Image.BICUBIC)
    return out.resize((F, F), Image.LANCZOS)


def rotate(img, deg, pivot=(64, BOTTOM - 8)):
    big = img.resize((F * UP, F * UP), Image.LANCZOS)
    big = big.rotate(deg, resample=Image.BICUBIC, center=(pivot[0] * UP, pivot[1] * UP))
    return big.resize((F, F), Image.LANCZOS)


def shift(img, dx, dy):
    out = Image.new("RGBA", (F, F))
    out.paste(img, (dx, dy))
    return out


def streaks(fr, seed, colour=(214, 40, 140)):
    """Little pink speed swooshes behind him, the same colour as the attack swooshes."""
    d = ImageDraw.Draw(fr)
    bb = fr.getbbox()
    x0 = bb[0] - 4
    for k, (y, ln) in enumerate([(70, 14), (82, 18), (94, 12)]):
        ln += (seed + k) % 3 * 3
        a = 150 - k * 30
        d.line((x0 - ln, y + seed % 2, x0, y + seed % 2), fill=colour + (a,), width=2)
    return fr


def compose(rider, board, board_dy=0):
    out = Image.new("RGBA", (F, F))
    out.alpha_composite(shift(board, 0, board_dy) if board_dy else board)
    out.alpha_composite(rider)
    return out


def sheet(frames):
    s = Image.new("RGBA", (F * 2, F * 2))
    for i, fr in enumerate(frames):
        s.alpha_composite(fr, ((i % 2) * F, (i // 2) * F))
    return s


def ground(fr):
    """Re-seat the frame so its lowest pixel sits on BOTTOM (no floating / sinking)."""
    bb = fr.getbbox()
    dy = BOTTOM - bb[3]
    if dy == 0:
        return fr
    out = Image.new("RGBA", (F, F))
    out.paste(fr, (0, dy))
    return out


def main():
    att = Image.open(SRC).convert("RGBA")
    crouch, stand = frame(att, 0), frame(att, 3)
    cr_r, cr_b = split(crouch)
    st_r, st_b = split(stand)

    # idle: standing on the board, breathing (squash/stretch from the feet) with a tiny head bob
    idle = [
        compose(st_r, st_b),
        compose(squash(st_r, 0.975, 1.015), st_b),
        compose(squash(st_r, 0.955, 1.03), st_b),
        compose(squash(st_r, 0.975, 1.015), st_b),
    ]

    # run (he always rides): crouched pump, leaning into the ride, bobbing, with speed swooshes
    run = [
        streaks(ground(compose(squash(cr_r, 1.0, lean=0.10), cr_b)), 0),
        streaks(ground(compose(squash(cr_r, 0.96, 1.02, lean=0.12), cr_b)), 1),
        streaks(ground(compose(squash(st_r, 0.93, 1.02, lean=0.14), st_b)), 2),
        streaks(ground(compose(squash(cr_r, 0.98, 1.01, lean=0.11), cr_b)), 3),
    ]

    # jump: deep crouch, ollie stretch with the board kicked up, tuck, then ready to land
    jump = [
        ground(compose(squash(cr_r, 0.90, 1.06), cr_b)),
        ground(rotate(compose(squash(st_r, 1.04, 0.97), st_b, board_dy=-2), 12)),
        ground(rotate(compose(squash(cr_r, 0.96, 1.0), cr_b, board_dy=-3), 6)),
        ground(rotate(compose(cr_r, cr_b), -3)),
    ]

    sheet(idle).save(os.path.join(OUT, "cubro-idle.png"))
    sheet(run).save(os.path.join(OUT, "cubro-run.png"))
    sheet(jump).save(os.path.join(OUT, "cubro-jump.png"))
    att.save(os.path.join(OUT, "cubro-attack.png"))

    # portrait (hero select + HUD): the standing pose, centred and filling the 128px square
    fr = idle[0]
    bb = fr.getbbox()
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    side = max(w, h) + 6
    sq = Image.new("RGBA", (side, side))
    sq.paste(fr.crop(bb), ((side - w) // 2, (side - h) // 2))
    sq.resize((F, F), Image.LANCZOS).save(os.path.join(OUT, "cubro-portrait.png"))


if __name__ == "__main__":
    main()

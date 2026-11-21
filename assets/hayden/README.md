# Hayden's drawings

Hand-drawn pages photographed by Hayden Noel on 21 November 2026.
These are his originals, not AI art and not third-party art.

## Source photos

`originals/` keeps every shot he sent (pairs are duplicate takes of the same page).
The cleaner take of each page was used for the cutouts:

- `candy-cube-2.jpg` — Christmas playable character **Candy Cube** (replaces the Candy Cane Scarf)
- `admin-warlords.jpg` — secret boss **Admin Warlords**
- `credits.jpg` — credits list and the Cuboe + Cubro thank-you drawing

## Cutouts

Figures were rotated upright from EXIF, then scissors-cut from the paper and
saved with a transparent background in `cutouts/`. The paper fill inside each
silhouette is part of the drawing. In-game sprite sheets in
`public/game/sprites/` are scaled from these cutouts.

Animation frames for Candy Cube are the same standing pose, squash-stretched
or tilted. No new lines were drawn on his character.

## Code-drawn exception

The **Elf costume** hat (`public/game/sprites/candy-elf-hat.png`) is a small
geometric PNG drawn in code, same convention as the existing door art in
`scripts/art/`. It is not AI-generated and not from another artist. The
**Candle aura** is in-engine warm particles plus a small code-drawn candle icon
for the closet.

Rebuild sprites: `python3 scripts/art/make-hayden-sprites.py`

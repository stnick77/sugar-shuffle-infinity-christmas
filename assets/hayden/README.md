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
silhouette is part of the drawing.

`cutouts/candy-cube.png` is kept here as Hayden's reference drawing. It is
**not** used as the in-game sprite (the photographed crayon cutout sat
outside the style of Cuboe, Cubro, and the credits drawing).

Admin Warlords, the Admin orb, and the credits Cuboe + Cubro drawing are
still scaled from these cutouts into `public/game/sprites/`.

## Candy Cube in-game art

Candy Cube's playable sheets (`candy-cube-{idle,run,jump,attack,portrait}.png`)
are drawn in code by `scripts/art/make-candy-cube.py`. They keep Hayden's
design (red/white horizontal stripes, yellow swirl eyes, smile, striped
arms with yellow/red cuffs, striped legs, red/white shoes) but use the
same painted language as the in-game Cuboe and Cubro sprites and as his
credits-page Cuboe + Cubro drawing: rounded cube body, chunky dark-maroon
outline, soft side shading, simple graphic face, short capsule limbs,
feet on y=118. Sheets are the same 256×256 2×2 of 128px frames, with the
same idle / run / jump / attack poses Cuboe uses.

This is original in-repo art (hand-authored in the script, vector/canvas
drawn, 4× then downsampled). It is not AI-generated and not third-party.

## Code-drawn cosmetics

The **Elf costume** hat (`public/game/sprites/candy-elf-hat.png`) is drawn
in the same script, in the same outline and soft-shade language as
Cuboe's Santa hat, and packed so the shared hat FIT sits on the crown.
The **Candle aura** is in-engine warm particles plus a small code-drawn
candle icon for the closet (`scripts/art/make-hayden-sprites.py`).

Rebuild sprites:

```
python3 scripts/art/make-hayden-sprites.py
```

(that also runs `make-candy-cube.py`), or just the character:

```
python3 scripts/art/make-candy-cube.py
```

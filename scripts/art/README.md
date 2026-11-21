# Generated art ('Tis the Seasones refresh)

All of this art is original and drawn by code: no image prompts, no reference art, no other games' characters.

- `make-doors.py` makes `public/game/sprites/door-room.png` and `door-boss.png`.
  - Room door: a gingerbread frame with candy-cane posts, gumdrops, a peppermint knob and a round window that the game lights in each room's colour.
  - Boss door: a frosted midnight door with candy-corn horns, a friendly candy skull, licorice bars and a bow padlock.
- `make-cursed-fakes.py` makes `public/game/sprites/fake-{cuboe,cubro}-{idle,run,jump,attack}.png`.
  - Each frame is the hero's own frame, with the same 2x2 grid of 128px frames, turned into a cursed sour-candy copy.
  - The copies have sickly green or purple candy, mismatched glowing eyes, a too-many-teeth grin, melting goo, cracks, sugar crystals and a glitchy outline.

- `make-cubro-attack-look.py` makes `public/game/sprites/cubro-{idle,run,jump,portrait}.png`.
  - Cubro now looks like his attack animation everywhere: small chocolate-cube head with black shades, a chocolate body with arms and legs, black shorts and belt, chunky boots and a little wooden skateboard.
  - The only source is the attack sheet (kept as `src/cubro-attack-original.png`). Its calm poses are cut into rider + board and re-posed with breathing, lean, bob and ollie tilts. Frames stay 128px in a 2x2 grid with the wheels on the same bottom line, so animations, hitbox and cosmetics still line up.
  - The old sheets are kept in `src/cubro-*-original.png` for reference.

Rebuild the art with (Cubro first, because the cursed fakes are made from his frames):
`python3 scripts/art/make-cubro-attack-look.py && python3 scripts/art/make-doors.py && PYTHONHASHSEED=7 python3 scripts/art/make-cursed-fakes.py`
(`PYTHONHASHSEED` keeps the per-frame glitch the same each time.)

In the game, `src/game/bosses/rig.ts` adds a dark aura, floating cursed bits and a short glitch flicker for the fakes.

## Hayden's drawings (November 2026)

`make-hayden-sprites.py` draws the small candle icon, then runs
`make-candy-cube.py`, `make-admin-warlords.py` and `make-credits-art.py`.

`make-admin-warlords.py` redraws Hayden's three Admin Warlords (one sheet per
phase, `warlord-1/2/3.png`), the Admin orb and the group portrait in the same
style as the other bosses (2x2 sheets of 128px frames, 4-frame idle loop,
dark outline, soft shading, dark armour + purple + gold). His photo cutouts
stay in `assets/hayden/cutouts/` as reference.

`make-credits-art.py` builds the credits page ("Thanks for playing!
-Cuboe and Cubro") in Hayden's layout, using Cuboe and Cubro frames taken
straight from their in-game sheets (cuboe-jump arms-up frame, cubro-idle
frame mirrored), into `public/game/sprites/credits-cuboe-cubro.png`. His
photo stays in `assets/hayden/originals/credits.jpg`.

`make-candy-cube.py` draws Candy Cube's in-game idle/run/jump/attack
sheets and portrait, plus the elf-hat costume, in the same painted style
as the Cuboe and Cubro sprites (rounded cube, chunky dark outline, soft
shading, short capsule limbs, feet on y=118) while keeping Hayden's
design (red/white stripes, yellow swirl eyes, smile, cuffs, striped
legs, red/white shoes). No AI, no third-party art, and no photo cutout
in the playable sheets — the photographed drawing stays in
`assets/hayden/cutouts/` as reference.

Rebuild: `python3 scripts/art/make-hayden-sprites.py`
(or just the character: `python3 scripts/art/make-candy-cube.py`)

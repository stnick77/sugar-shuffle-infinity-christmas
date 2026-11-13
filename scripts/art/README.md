# Generated art ('Tis the Seasones refresh)

All of this art is original and drawn by code: no image prompts, no reference art, no other games' characters.

- `make-doors.py` makes `public/game/sprites/door-room.png` and `door-boss.png`.
  - Room door: a gingerbread frame with candy-cane posts, gumdrops, a peppermint knob and a round window that the game lights in each room's colour.
  - Boss door: a frosted midnight door with candy-corn horns, a friendly candy skull, licorice bars and a bow padlock.
- `make-cursed-fakes.py` makes `public/game/sprites/fake-{cuboe,cubro}-{idle,run,jump,attack}.png`.
  - Each frame is the hero's own frame, with the same 2x2 grid of 128px frames, turned into a cursed sour-candy copy.
  - The copies have sickly green or purple candy, mismatched glowing eyes, a too-many-teeth grin, melting goo, cracks, sugar crystals and a glitchy outline.

Rebuild the art with:
`python3 scripts/art/make-doors.py && PYTHONHASHSEED=7 python3 scripts/art/make-cursed-fakes.py`
(`PYTHONHASHSEED` keeps the per-frame glitch the same each time.)

In the game, `src/game/bosses/rig.ts` adds a dark aura, floating cursed bits and a short glitch flicker for the fakes.

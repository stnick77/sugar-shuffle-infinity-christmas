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

# Generated art ('Tis the Seasones refresh)

All of this art is original and drawn by code: no image prompts, no reference art, no other games' characters.

- `make-doors.py` makes `public/game/sprites/door-room.png` and `door-boss.png` (still used for
  the exit doors, PC and elevators, and as a fallback).
- `make-level-doors.py` makes one themed hub door per level in `public/game/sprites/doors/`
  (room doors 92x144, boss doors 136x184; e.g. swinging saloon doors for Drunk Saloon). The
  Floor 5 elevator shows the Rotting Pumpkin door (it leads to the final run).
- `make-level-tiles.py` makes one platform tile sheet per level in `public/game/sprites/tiles/`
  (192x96: a surface frame and a fill frame, shown at the 48px tile size; collision unchanged).
  The old shared `ground-candy.png` / `ground-marsh.png` stay as the fallback.
  Which level uses which door/tiles/song: `src/game/data/levelThemes.ts`.
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
`make-candy-cube.py`, `make-admin-warlords.py`, `make-credits-art.py` and
`make-saloon-party.py`.

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

`make-outlaw.py` draws the Marshmallow Outlaw boss sheet (f2-boss,
`public/game/sprites/outlaw.png`, 2x2 128px idle frames, feet on y=118) from
Hayden's redesign: a thinner, roasted-black marshmallow with toasted-brown
edges, red glowing eyes, a green-and-purple bandana over his mouth, a gray
cowboy hat and a golden pistol. Run `make-saloon-party.py` (he is the
bartender) and `make-level-doors.py` (his wanted-poster door) after it. The
old painted sheet, door and saloon background stay in `scripts/art/src/`
(`outlaw-original.png`, `door-boss-outlaw-original.png`,
`saloon-party-original.jpg`) for reverting.

`make-midnight-shootout.py` draws the Marshmallow Outlaw fight (f2-boss)
background, "a western shootout at midnight": a town main street seen down the
road under a big full moon and stars, mesas and cacti, saloon (swinging doors),
general store, barber, bank, sheriff and hotel fronts with warm windows and
lanterns, a clock tower stopped at 12:00, a water tower, a hitching post, a
tumbleweed and a notice board with the new Outlaw's wanted poster (cut from
his in-game sprite, so run it after `make-outlaw.py`). Composed in the
1920x800 display space the game stretches the arena background to (only
x 0..~1425, y 0..720 is ever on camera, the floor covers y >= 672), with a
lighter moonlit dust band behind the fighters and a darker floor edge, then
saved as `public/game/bg/midnight-shootout.jpg` (1792x1008). The old
`marsh-mash.jpg` stays in `public/game/bg/` (other floors still use it).

`make-saloon-party.py` draws the Drunk Saloon (level f3-3) background: a
bar party with every boss (Choco Man, the Outlaw behind the bar, the Candy
Warlock, Fake Cuboe, Fake Cubro and all three Admin Warlords) cut from their
in-game sprite frames, tilted and wobbly, in party hats with "hic!" bubbles,
dizzy swirls, root-beer mugs, string lights, a disco ball and streamers. It is
composed in the 3456x800 space the game stretches this level's background to
(only the left ~1780px is ever on camera at scroll factor 0.22), darkened so
platforms stay readable, then saved as `public/game/bg/saloon-party.jpg`
(1792x1008, same as the other backgrounds). The old `desert.jpg` stays in
`public/game/bg/`.

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

# Sugar Shuffle Infinity + DLC: 'Tis the Seasones

A Christmas expansion for Sugar Shuffle Infinity, built from Hayden's two
hand-drawn design sheets (the DLC sheet and the "Cuboe and Cubro's Home" floor
plan). Hayden designed it and named the music; this branch is the build.

> The sheet says "sold separately from game". Nothing is sold here: the DLC
> is a switch on the main menu. There is no store and no payment.

## Turning it on and off

| | |
| --- | --- |
| **Enable** | Press the **DLC: 'Tis the Seasones** button on the main menu. |
| **Disable** | Press the same button again while the DLC is on. |

The choice is saved in the browser save (`localStorage` →
`sugar-shuffle-infinity-v1` → `dlc.xmas`), so it is still on after a reload.
With the DLC **off** the game plays exactly like the base game: same pickups,
same music, same controls, same menus. The DLC button is the only new thing you
see.

When it's on, the title reads **Sugar Shuffle Infinity + DLC: 'Tis the
Seasones**, snow falls, and two new main-menu buttons appear:
**Cuboe and Cubro's Home** and **Options**. Options is also in the pause menu.

## New content (from the sheet)

### 1. Cuboe and Cubro's Home
Reach it from the main menu or the Options menu (main menu or pause). You pick
Cuboe or Cubro, then walk around. It's "Not a level": no enemies, no timer, no
score. Press **Up** at a doorway to go through it.

| Room | What's in it (per the floor plan) | Doors |
| --- | --- | --- |
| **Living Room** | Brick chimney floor to ceiling, fireplace with a moving fire, stockings labelled Cuboe and Cubro, framed candy picture, presents, garland, a snowy window | Main Menu, Hallway |
| **Hallway** | Doors to the rooms, stairs up to the top-right Upstairs door | Living Room, Cuboe's Room, Cubro's Room, Upstairs |
| **Cuboe's Room** | Candle chandelier, "Sleep Zone" sign, bed with steps and Zzz | Hallway |
| **Cubro's Room** | Dresser with items on top, framed picture, bed with steps, wall candle sconce, a working **light switch** | Hallway |
| **Upstairs** | Stairs, framed "the Shade" poster, three floating candles, decorated Christmas tree with a star and presents underneath | Hallway (bottom left) |

Small extras: press Up at a bed to nap (refills HP), at the fire to warm up,
at the tree for a "Merry Christmas!".

### 2. Christmas cosmetics (equip at the pumpkin station)
Open the **pumpkin station** (the PC in any floor hub). With the DLC on it has
a **Christmas closet**. Equip/unequip there; it shows on your cube as soon as
you close the station. One item per slot.

| Cube | Cosmetics |
| --- | --- |
| Cuboe | Santa Hat, Present Aura |
| Cubro | Christmas Skateboard, Christmas Sweater, Snowflake Aura |
| Either | Candy Cane Scarf (the free December cosmetic, see 6) |

### 3. Christmas collectables
In normal rooms (not hubs, bosses, or the house) some candy is swapped for
Christmas collectables, and every room gets one Christmas tree near the exit.

| Collectable | Points |
| --- | --- |
| Present | 30 |
| Ornament | 45 |
| Christmas Tree | 65 |

Points feed your room score (with the combo multiplier, like candy). Totals are
shown in Options and the pumpkin station.

### 4. Christmas songs
**Options → Christmas music On/Off.** It plays in levels, bosses, the hub, the
main menu and the house. The song picker:

- **Area themes (default):** each place gets its own track, all named by Hayden:

| Track (by Hayden) | Plays in | Style (Hayden's direction) |
| --- | --- | --- |
| **Ready Up** | Main menu | Adventurous and steady |
| **Hub Theme** | Floor hubs | Adventurous and steady |
| **Level Theme** | Levels | Calm, retro, slow |
| **Boss Theme** | Boss fights | Fast, uplifting, techno |
| **Peaceful Home** | Cuboe and Cubro's Home | Calm and cozy |

  These are original melodies written for this DLC and played by a small
  chiptune synth (`src/game/dlc/xmasMusic.ts`). They don't quote any existing
  song.
- **Classic carols:** chiptune arrangements of public-domain carols: Jingle
  Bells, Deck the Halls, We Wish You a Merry Christmas, Carol of the Bells
  (Shchedryk), O Christmas Tree.
- **Bonus songs:** five empty slots for the songs on the sheet (see below).
  Picking one song plays it everywhere; pick "Area themes" to go back.

#### Adding the licensed songs
The sheet's bonus songs are copyrighted, so no audio for them ships with the
game:

1. All I Want for Christmas Is You
2. It's the Most Wonderful Time of the Year
3. Santa Claus Lane
4. Jingle Bell Rock
5. Rockin' Around the Christmas Tree

Each one is a placeholder slot. To fill one **(only with a file you have a
licence to use)**:

1. Put the audio file in `public/game/music/xmas/` (mp3, ogg or m4a), e.g.
   `public/game/music/xmas/jingle-bell-rock.mp3`.
2. Open `public/game/music/xmas/licensed.json` and set that slot's value to the
   file name: `"jingle-bell-rock": "jingle-bell-rock.mp3"`.
3. Reload. The slot unlocks in Options → Bonus songs and loops through the
   game's music volume.

Don't commit licensed audio to a public repo.

### 5. Co-op (max 2 players)
**Options → Co-op → 2P.** The next room you load spawns a second cube (the
one P1 didn't pick). Local co-op on one screen:

| | Move | Jump | Attack | Run | Doors |
| --- | --- | --- | --- | --- | --- |
| **P1** | A / D | Space, K or Z | J | Left Shift / L | W |
| **P2** | ← / → | Enter or Numpad 0 | / or Numpad 1 | Right Shift | (P1 only) |

Gamepad 1 drives P1 and gamepad 2 drives P2. The camera follows the midpoint.

Limits (kept simple to fit the existing one-player engine):
- Lives, HP and score are shared. Either cube getting hit costs shared HP.
- P2 has move, jump, attack and stomp, but no specials or meter moves.
- Only P1 uses doors, the station, the boss gate and the elevator, and only P1
  reaching the exit starts Sugar Time.
- If P2 falls or gets far off screen they pop back next to P1.
- No touch controls for P2. No online play.

### 6. December gift
Play with the DLC on in December and you get a free cosmetic: the **Candy Cane
Scarf** (either cube can wear it). You get a toast once per December, and the
scarf stays unlocked after that.

To test outside December, override the date (any of):
- URL: `http://localhost:8080/?dlcDate=2026-12-05`
- dev tools: `localStorage.setItem("ssi-dlc-date", "2026-12-05")`
- dev tools: `window.__ssiDlcDate = "2026-12-05"`

## How to test

```bash
npm install
cp .env.example .env
npm run dev                         # http://localhost:8080
npm test                            # includes src/game/dlc/dlc.test.ts
npm run typecheck
```

Headless smoke test with screenshots (needs a running dev server and
`npx playwright install chromium`):

```bash
node scripts/xmas-dlc-smoke.mjs http://127.0.0.1:8080 ./screens
```

It checks the toggle and persistence, every doorway in the house, the Main
Menu door, equipping at the pumpkin station, collectable points, the December
gift (date override), co-op P2 movement, the music for each area, and that the
base game has no DLC content with the DLC off.

Manual checklist:
1. Main menu → DLC button → title changes, snow, Options + Home appear. Reload: still on. Press again: off.
2. Home → pick a cube → walk Living Room → Hallway → each room → back → Main Menu door.
3. Play → hub PC → Christmas closet → equip → close → cosmetics on the cube.
4. Enter a room → grab a present (+30), ornament (+45), tree (+65).
5. Options → music on/off, try each song.
6. Options → 2P → Play → both cubes move.
7. `?dlcDate=2026-12-05` → toast → scarf unlocked in the closet.

## Where the code lives

| Path | What |
| --- | --- |
| `src/game/dlc/logic.ts` | DLC rules: toggle, cosmetics, collectables, December gift, date override |
| `src/game/dlc/carols.ts` | Hayden's themes, public-domain carols, licensed slots |
| `src/game/dlc/xmasMusic.ts` | Chiptune player (hooks into `audio.ts` only when the DLC music is on) |
| `src/game/dlc/house.ts` | Cuboe and Cubro's Home rooms, doors and art |
| `src/game/dlc/cosmetics.ts` | Draws equipped cosmetics on the cubes |
| `src/game/dlc/state.ts` | Save helpers |
| `src/components/xmas-dlc.tsx` | DLC button, Options menu, Christmas closet |
| `src/game/dlc/dlc.test.ts` | Unit tests |
| `scripts/xmas-dlc-smoke.mjs` | Headless smoke test + screenshots |
| `public/game/sprites/xmas-*.png` | Collectable and cosmetic sprite sheets |
| `public/game/music/xmas/licensed.json` | Licensed song drop-in slots (empty) |

## Notes for Hayden
- The game spells the hero **Cuboe**, so the house is "Cuboe and Cubro's Home".
- The Present's points are a little hard to read on the sheet; it's set to
  **30** (it could be 70). Change `COLLECTABLES` in `src/game/dlc/logic.ts`.
- The sheet doesn't say what the free December cosmetic is, so it's a Candy
  Cane Scarf for now.
- The shield and sword drawings are marked "not an in-game image", so they're
  not in the game.
- Collectable and cosmetic art was generated to match the game's candy style;
  the house is drawn in code from the floor plan.

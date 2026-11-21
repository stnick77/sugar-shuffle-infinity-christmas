/**
 * Per-level look and sound (Hayden, Nov 2026: "give all the levels their own
 * unique door art, song, and platform art").
 *
 * - door:  hub door sprite, public/game/sprites/doors/<door>.png
 *          (scripts/art/make-level-doors.py). Boss doors are the big frosted
 *          size; the final run's door replaces the Floor 5 "UP" elevator.
 * - tiles: platform/ground tile, public/game/sprites/tiles/<tiles>.png
 *          (scripts/art/make-level-tiles.py), same 48px tile and collision.
 * - song:  original procedural track id in src/game/music/levelSongs.ts.
 *
 * Hubs and Cuboe and Cubro's Home (Christmas DLC rooms) keep their own
 * shared look; they are not levels. The old shared assets (door-room.png,
 * door-boss.png, ground-candy.png, ground-marsh.png and the old music loop)
 * are still in the repo and are used as fallbacks.
 */
export interface LevelTheme {
  door: string;
  tiles: string;
  song: string;
}

export const LEVEL_THEMES: Record<string, LevelTheme> = {
  "f1-1": { door: "door-candy-corn", tiles: "tiles-candy-corn", song: "corn-row-canter" },
  "f1-2": { door: "door-marshmallow", tiles: "tiles-marshmallow", song: "squishy-steps" },
  "f1-3": { door: "door-lollipop", tiles: "tiles-lollipop", song: "lolly-waltz" },
  "f1-4": { door: "door-mountain", tiles: "tiles-mountain", song: "scotch-peak-climb" },
  "f1-boss": { door: "door-boss-choco", tiles: "tiles-choco", song: "choco-knockout" },
  "f2-1": { door: "door-desert", tiles: "tiles-desert", song: "sugar-mirage" },
  "f2-2": { door: "door-barn", tiles: "tiles-farm", song: "cookie-hoedown" },
  "f2-3": { door: "door-sheriff", tiles: "tiles-boardwalk", song: "high-noon-sour" },
  "f2-4": { door: "door-tent", tiles: "tiles-dune", song: "dune-drift" },
  "f2-boss": { door: "door-boss-outlaw", tiles: "tiles-outlaw", song: "puffball-duel" },
  "f3-1": { door: "door-ruins", tiles: "tiles-ruins", song: "wrinkled-relics" },
  "f3-2": { door: "door-city", tiles: "tiles-city", song: "smash-street" },
  "f3-3": { door: "door-saloon", tiles: "tiles-saloon", song: "root-beer-rag" },
  "f3-4": { door: "door-tv", tiles: "tiles-tv", song: "channel-scotch" },
  "f3-boss": { door: "door-boss-fake-cubro", tiles: "tiles-fake-cubro", song: "cursed-board" },
  "f4-1": { door: "door-landfill", tiles: "tiles-landfill", song: "junkyard-licorice" },
  "f4-2": { door: "door-factory", tiles: "tiles-factory", song: "assembly-line" },
  "f4-3": { door: "door-lab", tiles: "tiles-lab", song: "bubbling-beakers" },
  "f4-4": { door: "door-music-box", tiles: "tiles-music-box", song: "wind-up-lullaby" },
  "f4-boss": { door: "door-boss-fake-cuboe", tiles: "tiles-fake-cuboe", song: "mirror-cube" },
  "f5-1": { door: "door-pizza", tiles: "tiles-pizza", song: "pizza-plex-panic" },
  "f5-2": { door: "door-bomb", tiles: "tiles-bomb", song: "fuse-is-lit" },
  "f5-3": { door: "door-crypt", tiles: "tiles-grave", song: "tombstone-tiptoe" },
  "f5-4": { door: "door-summit", tiles: "tiles-summit", song: "summit-fanfare" },
  "f5-boss": { door: "door-boss-warlock", tiles: "tiles-warlock", song: "warlocks-hex" },
  "final-run": { door: "door-pumpkin", tiles: "tiles-pumpkin", song: "escape-the-rot" },
  "admin-warlords": { door: "door-admin", tiles: "tiles-admin", song: "admin-override" },
};

export function themeFor(levelId: string): LevelTheme | undefined {
  return LEVEL_THEMES[levelId];
}

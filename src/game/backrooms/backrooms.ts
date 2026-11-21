/**
 * Floor 470539758, the Backrooms (Hayden, Nov 2026): "a secret floor where if you
 * collect 1 lore you phase through the floor when you try to go to the final boss
 * door ... the BACKROOMS ... level 0, motion, pool rooms, cave system, and the
 * boss is Bacteria".
 *
 * Pure data and rules (no Phaser), so node can unit test them.
 *
 * - The "final boss door" is the Floor 5 BOSS door (the Candy Warlock). The
 *   first time you press Up there holding at least 1 lore, you noclip through
 *   the floor into the Backrooms hub instead of entering the fight. Without
 *   lore, or once the Backrooms are discovered, the door works as before.
 * - Once discovered, a "Floor 470539758" tear in the Floor 5 hub takes you
 *   back, and the Backrooms hub has an EXIT door back up to Floor 5.
 * - Everything here (hub, 4 levels, Bacteria) has its own door, song,
 *   background, tiles and enemies, shared with nothing else.
 */
import { FLOORS } from "../data/world.ts";

export const BACKROOMS_FLOOR = 470539758;
/** Shown everywhere the floor's name shows (hub title, HUD, door labels, rank screen). */
export const BACKROOMS_NAME = "Floor 470539758";
export const BACKROOMS_HUB = "hub-backrooms";
export const BACKROOMS_BOSS = "br-boss";
/** The escape chase right after you beat Bacteria. */
export const BACKROOMS_ESCAPE = "br-escape";
/** Past the escape door: the bright "heaven room" with the ESCAPE door. */
export const BACKROOMS_HEAVEN = "br-heaven";
/** The door that hides the noclip: the final (Floor 5) boss door. */
export const NOCLIP_DOOR = "f5-boss";
/** The floor you go back up to through the EXIT door. */
export const RETURN_FLOOR = 5;
export const BACKROOMS_LORE = "bacteria";
export const BACKROOMS_ENDING = "backrooms";
/** Lose all your lives anywhere on Floor 470539758. */
export const TRAPPED_ENDING = "trapped";
export const TRAPPED_NAME = "TrAppEd fOrEvEr";

export const BACKROOMS_LEVELS = [
  { id: "br-0", name: "Level 0", kind: "level" as const },
  { id: "br-motion", name: "Motion", kind: "level" as const },
  { id: "br-pool", name: "Pool Rooms", kind: "level" as const },
  { id: "br-cave", name: "Cave System", kind: "level" as const },
];

export const BACKROOMS_FLOOR_DEF = {
  id: BACKROOMS_FLOOR,
  name: BACKROOMS_NAME,
  hubTitle: BACKROOMS_NAME,
  bg: "/game/bg/br-hub.jpg",
  ground: "candy",
  tint: 0xffffff,
  levels: BACKROOMS_LEVELS,
  boss: { id: BACKROOMS_BOSS, name: "Bacteria", lives: 9 },
  keyCost: 0,
};

export type FloorDef = {
  id: number;
  name: string;
  hubTitle: string;
  levels: readonly { id: string; name: string; kind: "level" }[];
  boss: { id: string; name: string; lives: number };
  keyCost: number;
};

/** Floor data for a floor number (1-5 or the Backrooms). */
export function floorDef(floor: number): FloorDef | undefined {
  if (floor === BACKROOMS_FLOOR) return BACKROOMS_FLOOR_DEF;
  return FLOORS[floor - 1] as FloorDef | undefined;
}

export function isBackroomsFloor(floor: number) {
  return floor === BACKROOMS_FLOOR;
}

export function isBackroomsRoom(levelId: string) {
  return levelId === BACKROOMS_HUB || levelId === BACKROOMS_BOSS || levelId === BACKROOMS_ESCAPE || levelId === BACKROOMS_HEAVEN || BACKROOMS_LEVELS.some((l) => l.id === levelId);
}

type SaveLike = { lore: readonly string[]; unlockedFloors: readonly number[] };

export function discovered(save: SaveLike) {
  return save.unlockedFloors.includes(BACKROOMS_FLOOR);
}

/** Pressing Up at `doorId`: phase through the floor instead of opening the door? */
export function shouldNoclip(save: SaveLike, doorId: string) {
  return doorId === NOCLIP_DOOR && save.lore.length >= 1 && !discovered(save);
}

/** Save changes for landing in the Backrooms (discovery + current floor). */
export function enterBackrooms(save: SaveLike) {
  return { floor: BACKROOMS_FLOOR, unlockedFloors: Array.from(new Set([...save.unlockedFloors, BACKROOMS_FLOOR])) };
}

/** Save changes for the EXIT door back up to Floor 5. */
export function leaveBackrooms() {
  return { floor: RETURN_FLOOR };
}

/**
 * Each room's own enemies. Every set is used in exactly one room.
 * - br-moth:   pale ceiling moths that flutter around the hub lights (harmless).
 * - br-smiler: a floating grin in the dark wallpaper (Level 0).
 * - br-chair:  a runaway office chair that rolls back and forth (Motion).
 * - br-duck:   a hopping pool-floatie duck (Pool Rooms).
 * - br-hound:  a shadow hound that crouches, then charges (Cave System).
 * - br-spore:  Bacteria's little spore blobs (boss fight minions).
 */
export const BACKROOMS_ENEMIES: Record<string, string[]> = {
  [BACKROOMS_HUB]: ["br-moth"],
  "br-0": ["br-smiler"],
  "br-motion": ["br-chair"],
  "br-pool": ["br-duck"],
  "br-cave": ["br-hound"],
  [BACKROOMS_BOSS]: ["br-spore"],
};

/** Level map character for each placed enemy (spores are summoned by Bacteria). */
export const ENEMY_CHARS: Record<string, string> = {
  m: "br-moth",
  h: "br-smiler",
  r: "br-chair",
  d: "br-duck",
  k: "br-hound",
};

export const ENEMY_INFO: Record<string, { name: string; harmless?: boolean; flies?: boolean; speed: number; hp: number }> = {
  "br-moth": { name: "Light Moth", harmless: true, flies: true, speed: 40, hp: 1 },
  "br-smiler": { name: "Wallpaper Smiler", flies: true, speed: 60, hp: 1 },
  "br-chair": { name: "Runaway Office Chair", speed: 150, hp: 1 },
  "br-duck": { name: "Floatie Duck", speed: 70, hp: 1 },
  "br-hound": { name: "Shadow Hound", speed: 55, hp: 2 },
  "br-spore": { name: "Spore Blob", speed: 90, hp: 1 },
};

/** Each room's own background picture (scripts/art/make-backrooms.py). */
export const BACKROOMS_BACKGROUNDS: Record<string, string> = {
  [BACKROOMS_HUB]: "/game/bg/br-hub.jpg",
  "br-0": "/game/bg/br-level0.jpg",
  "br-motion": "/game/bg/br-motion.jpg",
  "br-pool": "/game/bg/br-pool.jpg",
  "br-cave": "/game/bg/br-cave.jpg",
  [BACKROOMS_BOSS]: "/game/bg/br-bacteria.jpg",
  [BACKROOMS_ESCAPE]: "/game/bg/br-escape.jpg",
  [BACKROOMS_HEAVEN]: "/game/bg/br-heaven.jpg",
};

/* ---------- the hub after you clear Backrooms levels (Hayden's "red hub") ---------- */

/** How changed the hub is: 0 = normal, 1-4 = Backrooms levels cleared. Saved via save.completed. */
export function redHubLevel(completed: readonly string[]) {
  return BACKROOMS_LEVELS.filter((l) => completed.includes(l.id)).length;
}

/** Words scrawled on the hub walls (positions on the 1470x720 hub picture, above the doors). */
const RED_WORDS = [
  { text: "RUN", x: 300, y: 250, size: 46, angle: -6 },
  { text: "NO ESCAPE", x: 640, y: 215, size: 34, angle: 4 },
  { text: "WHEN WILL IT END", x: 1010, y: 240, size: 28, angle: -3 },
  { text: "KEEP WALKING", x: 1360, y: 380, size: 24, angle: 7 },
  { text: "RUN", x: 610, y: 420, size: 30, angle: 9 },
  { text: "IT SEES YOU", x: 980, y: 420, size: 24, angle: -8 },
  { text: "DON'T LOOK BACK", x: 280, y: 395, size: 22, angle: 5 },
];

export function redHubWords(level: number) {
  if (level <= 0) return [];
  return RED_WORDS.slice(0, Math.min(RED_WORDS.length, 1 + level * 2 - 1 + (level >= 4 ? 1 : 0)));
}

/** Hallway openings in the hub picture (centre x, where a far-away figure's feet go, its size). */
const HALLWAYS = [
  { x: 135, feet: 512, size: 70 },
  { x: 485, feet: 512, size: 64 },
  { x: 845, feet: 512, size: 72 },
  { x: 1200, feet: 512, size: 66 },
];

/** The watcher moves to a different hallway after each clear; a second one appears from 3 clears. */
export function redHubWatchers(level: number) {
  if (level <= 0) return [];
  const first = HALLWAYS[(level - 1) % HALLWAYS.length]!;
  return level >= 3 ? [first, HALLWAYS[(level + 1) % HALLWAYS.length]!] : [first];
}

/* ---------- the escape chase (after Bacteria) ---------- */

/**
 * Bacteria chases you down a long red hallway. It waits a moment, then walks after you
 * a bit slower than you walk (and well under your run), catching up faster only when it
 * is far behind. If it reaches you: a short jumpscare (can be turned off), you lose a
 * life and the chase restarts. Reach the EXIT to escape.
 */
export const CHASE = {
  graceMs: 1600,
  speed: 210,
  catchUpSpeed: 380,
  catchUpGap: 720,
  restartGap: 460,
  reach: 30,
};

/**
 * Checkpoints along the hallway (tile columns on solid floor). Falling in a pit or being
 * caught puts you back at the last one you passed, with Bacteria a fair way behind.
 */
export const CHASE_CHECKPOINTS = [0, 30, 62, 86];

export function chaseCheckpoint(bestCol: number) {
  return CHASE_CHECKPOINTS.filter((c) => c <= bestCol).pop() ?? 0;
}

/** Where the chaser is after `ms` of chasing at the normal speed, starting `gap` behind x0. */
export function chaserX(x0: number, ms: number) {
  return x0 - CHASE.restartGap + Math.max(0, ms - CHASE.graceMs) * (CHASE.speed / 1000);
}

/** Next chaser x for one frame: normal speed, faster only when far behind. */
export function stepChaser(chaser: number, hero: number, dtSec: number) {
  const fast = hero - chaser > CHASE.catchUpGap;
  return chaser + (fast ? CHASE.catchUpSpeed : CHASE.speed) * dtSec;
}

export function caught(chaser: number, hero: number) {
  return chaser + CHASE.reach >= hero;
}

/** Words scrawled along the escape hallway (tile column, row offset from the top). */
export const CHASE_WORDS = [
  { text: "GET OUT", col: 8 },
  { text: "RUN FOR YOUR LIFE!", col: 30 },
  { text: "DON'T STOP", col: 52 },
  { text: "ESCAPE AHEAD", col: 80 },
  { text: "ALMOST OUT!", col: 104 },
];

/** Where the ESCAPE door can send you. The house needs the Christmas DLC; without it, Floor 5. */
export type EscapeTarget = "floor5" | "house";
export function escapeChoices(xmasOn: boolean): EscapeTarget[] {
  return xmasOn ? ["floor5", "house"] : ["floor5"];
}

/** Save changes for walking out of the ESCAPE door: rewards, and you are back on Floor 5. */
export function escapeRewards<R extends string>(
  save: { lore: readonly string[]; endings: readonly string[]; completed: readonly string[]; ranks: Readonly<Record<string, R>> },
  rank: R,
) {
  const add = (list: readonly string[], v: string) => (list.includes(v) ? [...list] : [...list, v]);
  return {
    lore: add(save.lore, BACKROOMS_LORE),
    endings: add(save.endings, BACKROOMS_ENDING),
    completed: add(add(save.completed, BACKROOMS_ESCAPE), BACKROOMS_HEAVEN),
    ranks: { ...save.ranks, [BACKROOMS_ESCAPE]: rank } as Record<string, R>,
    ...leaveBackrooms(),
  };
}

/* ---------- the character glitch (Backrooms only) ---------- */

/**
 * How glitched the hero is, from lost health: 0 at full health, mild at mid, 1 at the last HP.
 */
export function glitchLevel(hp: number, maxHp: number) {
  if (maxHp <= 1) return hp >= maxHp ? 0 : 1;
  const lost = Math.min(1, Math.max(0, (maxHp - hp) / (maxHp - 1)));
  return Math.round(lost * 100) / 100;
}

/** Ambient glitches per second (none until half health; capped at 2.5/s, well under 3 Hz). */
export function glitchAmbientRate(level: number) {
  if (level < 0.4) return 0;
  return Math.min(2.5, 0.3 + (level - 0.4) * 3.6);
}

/** A hit's glitch: how long (ms) and how far the ghost copies split (px). Stronger when hurt more. */
export function glitchBurst(level: number) {
  return { ms: Math.round(220 + 260 * level), split: Math.round(3 + 9 * level), slices: level < 0.5 ? 2 : 4 };
}

/** At the very last HP a faint split never goes away. */
export function glitchConstant(level: number) {
  return level >= 0.99;
}

/** The fastest the hero may blink while glitching (ms between flicker toggles, i.e. <= 3 Hz). */
export const GLITCH_FLICKER_MS = 170;

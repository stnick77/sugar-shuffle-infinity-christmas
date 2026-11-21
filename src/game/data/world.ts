export type HeroId = "cuboe" | "cubro" | "candy-cube" | "hazmat-cube" | "entity-cube";
export type Rank = "P" | "S" | "A" | "B" | "C" | "D" | "F";

export const HEROES: Record<
  HeroId,
  {
    name: string;
    tag: string;
    lives: number;
    /** Hit points per life. Defaults to `lives` when omitted (Cuboe / Cubro). */
    hp?: number;
    /** Walk/run speed relative to Cuboe's base (260 / 480). */
    speed?: number;
    /** Only offered on the character select screen when the Christmas DLC is on. */
    dlc?: boolean;
    /** Earned by escaping Floor 470539758 (beat Bacteria, then the heaven ESCAPE door). Shown locked until then. */
    reward?: "backrooms";
    /** Shown under the locked silhouette on the character select. */
    lockedHint?: string;
    control: string;
    blurb: string;
    color: string;
    portrait: string;
  }
> = {
  cuboe: {
    name: "Cuboe",
    tag: "Easy",
    lives: 6,
    control: "Punch, shield, air stall",
    blurb: "Cream cube with dash eyes. Safer jumps, a forward shield, and the Aeraste stomp.",
    color: "#fff4d6",
    portrait: "/game/sprites/cuboe-portrait.png",
  },
  cubro: {
    name: "Cubro",
    tag: "Mild",
    lives: 9,
    control: "Skateboard, bounce, tornado",
    blurb: "Chocolate cube in visor shades. Faster mach run, bounce jump, and Super Saiyan Burst.",
    color: "#c47a3a",
    portrait: "/game/sprites/cubro-portrait.png",
  },
  "candy-cube": {
    name: "Candy Cube",
    tag: "Hard",
    lives: 9,
    hp: 6,
    speed: 0.9,
    dlc: true,
    control: "Punch, shield, air stall — at Hard pace",
    blurb: "Hayden's Christmas cube: red and white stripes, swirl eyes, and a harder fight. HP 6, 9 lives, a little slower than Cuboe.",
    color: "#e11d2e",
    portrait: "/game/sprites/candy-cube-portrait.png",
  },
  "hazmat-cube": {
    name: "Hazmat Cube",
    tag: "Easy",
    lives: 6,
    hp: 7,
    speed: 1.05,
    reward: "backrooms",
    lockedHint: "Escape the Backrooms",
    control: "Punch, shield, air stall",
    blurb: "A very nervous cube in a yellow chemical suit. Scared, so it runs a little faster, and the suit soaks up an extra hit. HP 7, 6 lives.",
    color: "#f6cc28",
    portrait: "/game/sprites/hazmat-cube-portrait.png",
  },
  "entity-cube": {
    name: "Entity Cube",
    tag: "Mild",
    lives: 7,
    hp: 6,
    reward: "backrooms",
    lockedHint: "Escape the Backrooms",
    control: "Punch, shield, air stall",
    blurb: "Something followed you out of the Backrooms. A black cube with wavy tentacles and a glowing purple smile that never stops glitching. HP 6, 7 lives.",
    color: "#2a1f38",
    portrait: "/game/sprites/entity-cube-portrait.png",
  },
};

export const FLOORS = [
  {
    id: 1,
    name: "Candy Corn Valley",
    hubTitle: "Floor 1 Hub",
    bg: "/game/bg/candy-corn-valley.jpg",
    ground: "candy",
    tint: 0xffffff,
    levels: [
      { id: "f1-1", name: "Candy Corn Valley", kind: "level" as const },
      { id: "f1-2", name: "Marsh Mellow Mash", kind: "level" as const },
      { id: "f1-3", name: "Lolly Pop Forest", kind: "level" as const },
      { id: "f1-4", name: "Butter Scotch Mountain", kind: "level" as const },
    ],
    boss: { id: "f1-boss", name: "Choco Man", lives: 9 },
    keyCost: 400,
  },
  {
    id: 2,
    name: "Sugar Rush Desert",
    hubTitle: "Floor 2 Hub",
    bg: "/game/bg/sugar-rush-desert.jpg",
    ground: "candy",
    tint: 0xffd08a,
    levels: [
      { id: "f2-1", name: "Sugar Rush Desert", kind: "level" as const },
      { id: "f2-2", name: "Cookie War Farm", kind: "level" as const },
      { id: "f2-3", name: "Sour Showdown", kind: "level" as const },
      { id: "f2-4", name: "Butter Scotch Dune", kind: "level" as const },
    ],
    boss: { id: "f2-boss", name: "Marshmallow Outlaw", lives: 6 },
    keyCost: 400,
  },
  {
    id: 3,
    name: "Raisin Ruins",
    hubTitle: "Floor 3 Hub",
    bg: "/game/bg/marsh-mash.jpg",
    ground: "marsh",
    tint: 0xc9b8ff,
    levels: [
      { id: "f3-1", name: "Raisin Ruins", kind: "level" as const },
      { id: "f3-2", name: "Smash City", kind: "level" as const },
      { id: "f3-3", name: "Drunk Saloon", kind: "level" as const },
      { id: "f3-4", name: "Scotch T.V.", kind: "level" as const },
    ],
    boss: { id: "f3-boss", name: "Fake Candy Cubro", lives: 6 },
    keyCost: 400,
  },
  {
    id: 4,
    name: "Licorice Landfill",
    hubTitle: "Floor 4 Hub",
    bg: "/game/bg/hub.jpg",
    ground: "candy",
    tint: 0xb8d4c0,
    levels: [
      { id: "f4-1", name: "Licorice Landfill", kind: "level" as const },
      { id: "f4-2", name: "Cube Factory", kind: "level" as const },
      { id: "f4-3", name: "Sloppy Lab", kind: "level" as const },
      { id: "f4-4", name: "Butter Scotch Music Box", kind: "level" as const },
    ],
    boss: { id: "f4-boss", name: "Fake Candy Cuboe", lives: 6 },
    keyCost: 400,
  },
  {
    id: 5,
    name: "Ruin Pizza Plex",
    hubTitle: "Floor 5 Hub",
    bg: "/game/bg/marsh-mash.jpg",
    ground: "marsh",
    tint: 0xff9a6a,
    levels: [
      { id: "f5-1", name: "Ruin Pizza Plex", kind: "level" as const },
      { id: "f5-2", name: "Time Bomb Rush", kind: "level" as const },
      { id: "f5-3", name: "Grave Yard", kind: "level" as const },
      { id: "f5-4", name: "Butter Scotch Summit", kind: "level" as const },
    ],
    boss: { id: "f5-boss", name: "Candy Warlock", lives: 9 },
    keyCost: 400,
  },
] as const;

export const FINAL_RUN = {
  id: "final-run",
  name: "The Rotting Pumpkin",
  time: 240,
};

export const BOSSES: Record<
  string,
  {
    name: string;
    sprite: string;
    lives: number;
    moves: string[];
    hitWhen: string;
    lore: string;
  }
> = {
  "f1-boss": {
    name: "Choco Man",
    sprite: "choco",
    lives: 9,
    moves: ["Hadoken", "Shoryuken", "Tatsumaki", "Jump-in elbow"],
    hitWhen: "After a special, while he is flashing.",
    lore: "Block 25% of his attacks to claim The Lore of Choco Man.",
  },
  "f2-boss": {
    name: "Marshmallow Outlaw",
    sprite: "outlaw",
    lives: 6,
    moves: ["Sweet shots", "Super nuke", "Boot rush"],
    hitWhen: "Hit him while he is flashing after a shot.",
    lore: "Block 50% of his shots to claim The Lore of Marshmallow Outlaw.",
  },
  "f3-boss": {
    name: "Fake Candy Cubro",
    sprite: "fake-cubro-idle",
    lives: 6,
    moves: ["Tornado copy", "Rocket shot", "Board rush"],
    hitWhen: "Same windows as Cubro — strike during recovery.",
    lore: "Beat him without taking damage for The Lore of Candy Cubro.",
  },
  "f4-boss": {
    name: "Fake Candy Cuboe",
    sprite: "fake-cuboe-idle",
    lives: 6,
    moves: ["Aeraste copy", "Laser spin", "Shield bash"],
    hitWhen: "Same windows as Cuboe.",
    lore: "Attack the Metroid platform in this fight for The Lore of Fake Candy Cuboe.",
  },
  "f5-boss": {
    name: "Candy Warlock",
    sprite: "warlock",
    lives: 9,
    moves: ["Candy corn vine", "Licorice strike", "Candy ray"],
    hitWhen: "After a ray, while the crown flashes.",
    lore: "Fall into a pit 20 times in the campaign to unlock his backstory.",
  },
  "admin-warlords": {
    name: "Admin Warlords",
    sprite: "warlord-1",
    lives: 10,
    moves: ["Admin orbs", "Hand volleys", "Phase rush"],
    hitWhen: "After a volley, while they are flashing.",
    lore: "Secret extreme boss. Unlock the Admin button on the main menu after both the Good and Bad endings. Power type: Admin. 3 phases, 10 hits each.",
  },
  // Floor 470539758 (the Backrooms). Phase 2 is "Void": same body, a Smiler face.
  "br-boss": {
    name: "Bacteria",
    sprite: "bacteria",
    lives: 9,
    moves: ["Long reach", "Lights out", "Spore cloud", "Void orbs (Void)", "Grin in the dark (Void)", "Leg sweep", "Spore rain"],
    hitWhen: "After a move, while he is flashing.",
    lore: "Secret boss of Floor 470539758. Phase 1 and 3: Bacteria. Phase 2: Void.",
  },
};

export const COMBOS = {
  cuboe: [
    { id: "aeraste", name: "Aeraste", input: "Jump on an enemy", desc: "Stomp to bounce-kill." },
    { id: "laser", name: "Spinning Laser", input: "J in the air (35 meter)", desc: "Lasers spin in all directions." },
    { id: "shield", name: "Forward Shield", input: "Q (20 meter)", desc: "Protective shield for 5 seconds." },
    { id: "blackhole", name: "Black Hole", input: "Up + Q (40 meter)", desc: "Pulls enemies in." },
    { id: "beams", name: "Two-Side Energy Beam", input: "Up + J (30 meter)", desc: "Fires beams both ways." },
  ],
  "candy-cube": [
    { id: "aeraste", name: "Aeraste", input: "Jump on an enemy", desc: "Stomp to bounce-kill." },
    { id: "laser", name: "Spinning Laser", input: "J in the air (35 meter)", desc: "Lasers spin in all directions." },
    { id: "shield", name: "Forward Shield", input: "Q (20 meter)", desc: "Protective shield for 5 seconds." },
    { id: "blackhole", name: "Black Hole", input: "Up + Q (40 meter)", desc: "Pulls enemies in." },
    { id: "beams", name: "Two-Side Energy Beam", input: "Up + J (30 meter)", desc: "Fires beams both ways." },
  ],
  "hazmat-cube": [
    { id: "aeraste", name: "Aeraste", input: "Jump on an enemy", desc: "Stomp to bounce-kill." },
    { id: "laser", name: "Spinning Laser", input: "J in the air (35 meter)", desc: "Lasers spin in all directions." },
    { id: "shield", name: "Forward Shield", input: "Q (20 meter)", desc: "Protective shield for 5 seconds." },
    { id: "blackhole", name: "Black Hole", input: "Up + Q (40 meter)", desc: "Pulls enemies in." },
    { id: "beams", name: "Two-Side Energy Beam", input: "Up + J (30 meter)", desc: "Fires beams both ways." },
  ],
  "entity-cube": [
    { id: "aeraste", name: "Aeraste", input: "Jump on an enemy", desc: "Stomp to bounce-kill." },
    { id: "laser", name: "Spinning Laser", input: "J in the air (35 meter)", desc: "Lasers spin in all directions." },
    { id: "shield", name: "Forward Shield", input: "Q (20 meter)", desc: "Protective shield for 5 seconds." },
    { id: "blackhole", name: "Black Hole", input: "Up + Q (40 meter)", desc: "Pulls enemies in." },
    { id: "beams", name: "Two-Side Energy Beam", input: "Up + J (30 meter)", desc: "Fires beams both ways." },
  ],
  cubro: [
    { id: "tornado", name: "Tornado Spin", input: "J while mach running", desc: "Become a chocolate tornado." },
    { id: "rocket", name: "Rocket Shot", input: "Shift + J (25 meter)", desc: "Launch the skateboard like a missile." },
    { id: "barrier", name: "Saiyan Barrier", input: "Q (25 meter)", desc: "A barrier that lasts several seconds." },
    { id: "infinity", name: "Infinity Boost", input: "Up + Q (50 meter)", desc: "A 8-second super speed gem." },
    { id: "burst", name: "Super Saiyan Burst", input: "Up + J (40 meter)", desc: "Energy burst that clears nearby foes." },
  ],
};

export const LORE = [
  { id: "choco", name: "The Lore of Choco Man", how: "Block 25% of Choco Man's attacks." },
  { id: "outlaw", name: "The Lore of Marshmallow Outlaw", how: "Block 50% of his shots." },
  { id: "cubro", name: "The Lore of Cubro", how: "Master all of Cubro's combos." },
  { id: "cuboe", name: "The Lore of Cuboe", how: "Master all of Cuboe's combos." },
  { id: "fake-cubro", name: "The Lore of Candy Cubro", how: "Beat Fake Candy Cubro without taking damage." },
  { id: "fake-cuboe", name: "The Lore of Fake Candy Cuboe", how: "Attack the Metroid platform in his fight." },
  { id: "warlock", name: "Candy Warlock Backstory", how: "Fall into a pit 20 times." },
  { id: "rift", name: "Universe Rift", how: "Fall into the secret spot at Butter Scotch Summit." },
  { id: "bacteria", name: "The Lore of Bacteria", how: "Defeat Bacteria on Floor 470539758." },
];

export const ENDINGS = [
  { id: "normal", name: "Normal", how: "Complete the game and escape the rotting pumpkin." },
  { id: "bad", name: "Bad", how: "Fail to escape the rotting pumpkin." },
  { id: "good", name: "Good", how: "Punch the Warlock out of the rotting pumpkin: escape with 1:30 or more left." },
  { id: "playco", name: "Playco Path", how: "Spare the Candy Warlock: escape the rotting pumpkin without defeating anyone." },
  { id: "omega", name: "Omega Saiyan", how: "As Cubro, burst-kill 40 enemies, then escape the rotting pumpkin." },
  { id: "true", name: "True", how: "Collect every other ending. The Warlock becomes a friend." },
  // Secret: not needed for True (that list is fixed in PlayScene.finish).
  { id: "backrooms", name: "Floor 470539758", how: "A secret ending. Some floors are not on the elevator." },
  { id: "trapped", name: "TrAppEd fOrEvEr", how: "Lose all your lives on Floor 470539758. The hum never stops." },
];

/** Codes marked `soon` are saved now; their unlock is not built yet (future update). */
export const PROMO_CODES: { code: string; reward: string; label: string; soon?: boolean }[] = [
  { code: "SYIOX", reward: "secret-sylux", label: "Unlocks secret boss Sylux", soon: true },
  { code: "WERE CUBRO", reward: "were-cubro", label: "Were-Cubro palette" },
  { code: "WERE CUBOE", reward: "were-cuboe", label: "Were-Cuboe palette" },
  { code: "METROID", reward: "metroid", label: "Secret Metroid arena", soon: true },
  { code: "MARIONETTE", reward: "marionette", label: "Secret boss Marionette", soon: true },
  { code: "MOTHERBRAIN", reward: "mother-brain", label: "Secret boss Mother Brain", soon: true },
  { code: "MRGAW", reward: "mrgaw", label: "Mr. Game and Watch", soon: true },
  { code: "OCTAVIO", reward: "octavio", label: "DJ Octavio Mecha 2.0", soon: true },
  { code: "INKLING", reward: "inkling", label: "Inkling Squid", soon: true },
];

export const MINIGAMES = [
  { id: "match", name: "Match and Hang", blurb: "Flip candy cards. Hang on with Up." },
  { id: "wreck", name: "Wrecking Wednesday", blurb: "Smash the licorice tower. Press Attack." },
  { id: "bomb", name: "Bomb for All", blurb: "Toss bombs at a spinning target." },
  { id: "fit", name: "Mr. Game and Fit", blurb: "Pose to match the silhouette." },
  { id: "glitch", name: "Glitch Puppet", blurb: "Mini-boss. Earn A or P on every other mini first." },
];

export function rankFromScore(score: number, damaged: boolean, secrets: number): Rank {
  if (score >= 14000 && !damaged && secrets > 0) return "P";
  if (score >= 11000) return "S";
  if (score >= 8000) return "A";
  if (score >= 5000) return "B";
  if (score >= 2500) return "C";
  if (score >= 800) return "D";
  return "F";
}

export function minigameRank(seconds: number): Rank {
  if (seconds <= 20) return "P";
  if (seconds <= 30) return "A";
  if (seconds <= 40) return "C";
  if (seconds <= 50) return "D";
  return "F";
}

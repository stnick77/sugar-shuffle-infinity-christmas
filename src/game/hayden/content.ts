/**
 * Hayden's November 2026 designs: Candy Cube, Admin Warlords, and credits.
 * Pure data + rules so they can be unit-tested without Phaser or React.
 */

/** Hits the player must land in each Admin Warlords phase (Hayden's "Health: 10"). */
export const ADMIN_PHASE_HP = 10;
export const ADMIN_PHASES = 3;
/** Total hits to clear the fight (10 per phase × 3 phases). */
export const ADMIN_TOTAL_HP = ADMIN_PHASE_HP * ADMIN_PHASES;

export const ADMIN_BOSS_ID = "admin-warlords";
export const ADMIN_LEVEL_ID = "admin-warlords";
export const CANDY_CUBE_ID = "candy-cube" as const;

export const CANDY_CUBE_STATS = {
  id: CANDY_CUBE_ID,
  name: "Candy Cube",
  tag: "Hard",
  hp: 6,
  lives: 9,
  /** Walk/run multiplier vs Cuboe / base (260 walk, 480 run). */
  speed: 0.9,
} as const;

/** Candy Cube uses Cuboe's move kit (punch, shield, beams) at Hard rules. */
export function usesCuboeKit(hero: string) {
  return hero !== "cubro";
}

export function candyCubeUnlocked(dlcEnabled: boolean) {
  return dlcEnabled;
}

/** Secret Admin button: both the Good and Bad endings must already be earned. */
export function adminWarlordsUnlocked(endings: readonly string[]) {
  return endings.includes("good") && endings.includes("bad");
}

export const CREDITS = {
  title: "Credits",
  roles: [
    { role: "Art", names: ["Hayden Noel"] },
    { role: "Programming", names: ["Hayden Noel"] },
    { role: "Music", names: ["Hayden Noel"] },
    { role: "Sound effects", names: ["Hayden Noel"] },
    { role: "Visual effects", names: ["Hayden Noel"] },
  ],
  crewLabel: "Programming crew",
  crew: ["Hayden Noel", "Dylan Bradford", "Colton Begor", "Toren Noel", "Martin Noel"],
  signoff: "Thanks for playing! -Cuboe and Cubro",
  hint: "Space: main menu",
} as const;

export const SCARF_LEGACY_ID = "candy-cane-scarf";
export const ELF_COSTUME_ID = "elf-costume";
export const CANDLE_AURA_ID = "candle-aura";

/** Drop the retired Candy Cane Scarf from a DLC save and keep Candy Cube slots. */
export function migrateHaydenCosmetics(owned: string[], equipped: Record<string, string[] | undefined>) {
  const nextOwned = owned.filter((id) => id !== SCARF_LEGACY_ID);
  const clean = (list: string[] | undefined) => (list ?? []).filter((id) => id !== SCARF_LEGACY_ID);
  return {
    owned: nextOwned,
    equipped: {
      cuboe: clean(equipped.cuboe),
      cubro: clean(equipped.cubro),
      "candy-cube": clean(equipped["candy-cube"]),
    },
  };
}

import { SAVE_KEY, SAVE_VERSION } from "./config";
import type { HeroId, Rank } from "./data/world";
import { XMAS_DEFAULTS, normalizeXmas, type XmasSave } from "./dlc/logic";
import { BACKROOMS_HEROES, migrateRewardHeroes } from "./backrooms/heroes.ts";

export interface SaveData {
  version: number;
  hero: HeroId;
  floor: number;
  unlockedFloors: number[];
  completed: string[];
  bosses: string[];
  ranks: Record<string, Rank>;
  candyBux: number;
  highScore: number;
  lore: string[];
  endings: string[];
  promo: string[];
  combos: Record<HeroId, string[]>;
  /** Reward heroes earned (Hazmat Cube + Entity Cube for escaping Floor 470539758). */
  heroes: HeroId[];
  pits: number;
  saiyanKills: number;
  minigames: Record<string, Rank>;
  /** One-time grants already collected (hub Candy Bux spots, treasures). */
  claimed: string[];
  settings: { sfx: number; music: number; shake: boolean; jumpscares: boolean; glitch: boolean };
  /** 'Tis the Seasones DLC. Inert unless dlc.xmas.enabled. */
  dlc: { xmas: XmasSave };
}

const DEFAULTS: SaveData = {
  version: SAVE_VERSION,
  hero: "cuboe",
  floor: 1,
  unlockedFloors: [1],
  completed: [],
  bosses: [],
  ranks: {},
  candyBux: 0,
  highScore: 0,
  lore: [],
  endings: [],
  promo: [],
  combos: { cuboe: [], cubro: [], "candy-cube": [], "hazmat-cube": [], "entity-cube": [] },
  heroes: [],
  pits: 0,
  saiyanKills: 0,
  minigames: {},
  claimed: [],
  settings: { sfx: 0.8, music: 0.45, shake: true, jumpscares: true, glitch: true },
  dlc: { xmas: XMAS_DEFAULTS },
};

const HERO_IDS: HeroId[] = ["cuboe", "cubro", "candy-cube", "hazmat-cube", "entity-cube"];

function migrate(raw: SaveData): SaveData {
  // older saves that already escaped the Backrooms get the reward heroes too
  const heroes = migrateRewardHeroes(raw.heroes, raw.completed);
  const wanted = HERO_IDS.includes(raw.hero) ? raw.hero : DEFAULTS.hero;
  const hero = BACKROOMS_HEROES.includes(wanted) && !heroes.includes(wanted) ? DEFAULTS.hero : wanted;
  return {
    ...DEFAULTS,
    ...raw,
    version: SAVE_VERSION,
    hero,
    combos: {
      cuboe: raw.combos?.cuboe ?? [],
      cubro: raw.combos?.cubro ?? [],
      "candy-cube": raw.combos?.["candy-cube"] ?? [],
      "hazmat-cube": raw.combos?.["hazmat-cube"] ?? [],
      "entity-cube": raw.combos?.["entity-cube"] ?? [],
    },
    heroes,
    settings: { ...DEFAULTS.settings, ...raw.settings },
    dlc: { ...raw.dlc, xmas: normalizeXmas(raw.dlc?.xmas) },
  };
}

export function loadSave(): SaveData {
  try {
    const txt = localStorage.getItem(SAVE_KEY);
    if (!txt) return structuredClone(DEFAULTS);
    return migrate(JSON.parse(txt) as SaveData);
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function writeSave(data: SaveData) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, version: SAVE_VERSION }));
  } catch {
    /* private mode */
  }
}

export function resetSave(): SaveData {
  const next = structuredClone(DEFAULTS);
  writeSave(next);
  return next;
}

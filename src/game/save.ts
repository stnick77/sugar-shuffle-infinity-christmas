import { SAVE_KEY, SAVE_VERSION } from "./config";
import type { HeroId, Rank } from "./data/world";
import { XMAS_DEFAULTS, normalizeXmas, type XmasSave } from "./dlc/logic";

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
  combos: { cuboe: string[]; cubro: string[]; "candy-cube": string[] };
  pits: number;
  saiyanKills: number;
  minigames: Record<string, Rank>;
  /** One-time grants already collected (hub Candy Bux spots, treasures). */
  claimed: string[];
  settings: { sfx: number; music: number; shake: boolean; jumpscares: boolean };
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
  combos: { cuboe: [], cubro: [], "candy-cube": [] },
  pits: 0,
  saiyanKills: 0,
  minigames: {},
  claimed: [],
  settings: { sfx: 0.8, music: 0.45, shake: true, jumpscares: true },
  dlc: { xmas: XMAS_DEFAULTS },
};

function migrate(raw: SaveData): SaveData {
  const hero = raw.hero === "candy-cube" || raw.hero === "cuboe" || raw.hero === "cubro" ? raw.hero : DEFAULTS.hero;
  return {
    ...DEFAULTS,
    ...raw,
    version: SAVE_VERSION,
    hero,
    combos: {
      cuboe: raw.combos?.cuboe ?? [],
      cubro: raw.combos?.cubro ?? [],
      "candy-cube": raw.combos?.["candy-cube"] ?? [],
    },
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

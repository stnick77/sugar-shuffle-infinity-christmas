/**
 * Sugar Shuffle Infinity + DLC: 'Tis the Seasones (Christmas).
 *
 * Pure data + rules for the DLC. No Phaser, React, or "@/" imports so it can
 * be unit tested with `node --experimental-strip-types --test`.
 *
 * Everything here is inert while `enabled` is false: the base game reads none
 * of it unless the DLC button on the main menu has been pressed.
 */

export type HeroKey = "cuboe" | "cubro" | "candy-cube";

export const DLC_ID = "tis-the-seasones";
export const DLC_TITLE = "'Tis the Seasones";
export const DLC_FULL_TITLE = "Sugar Shuffle Infinity + DLC: 'Tis the Seasones";
export const HOME_NAME = "Cuboe and Cubro's Home";
export const HOME_START = "home-living";

export type CosmeticSlot = "head" | "aura" | "board" | "body" | "neck";

export interface Cosmetic {
  id: string;
  name: string;
  /** Which hero can wear it. "both" = either cube. */
  hero: HeroKey | "both";
  slot: CosmeticSlot;
  /** How you get it. "dlc" = comes with the DLC, "december" = free gift for playing in December. */
  source: "dlc" | "december";
  blurb: string;
  /** Frame in a 128px sprite sheet used for the closet icon. */
  icon: { sheet: "xmas-cosmetics" | "xmas-pickups" | "hayden-cosmetics"; frame: number };
}

/** From the design sheet: "DLC features → Cosmetics". */
export const COSMETICS: Cosmetic[] = [
  {
    id: "santa-hat",
    name: "Santa Hat",
    hero: "cuboe",
    slot: "head",
    source: "dlc",
    blurb: "Red and fluffy. Flops when Cuboe jumps.",
    icon: { sheet: "xmas-cosmetics", frame: 0 },
  },
  {
    id: "present-aura",
    name: "Present Aura",
    hero: "cuboe",
    slot: "aura",
    source: "dlc",
    blurb: "Little wrapped presents orbit Cuboe.",
    icon: { sheet: "xmas-pickups", frame: 0 },
  },
  {
    id: "xmas-skateboard",
    name: "Christmas Skateboard",
    hero: "cubro",
    slot: "board",
    source: "dlc",
    blurb: "Candy-cane deck, evergreen wheels.",
    icon: { sheet: "xmas-cosmetics", frame: 1 },
  },
  {
    id: "xmas-sweater",
    name: "Christmas Sweater",
    hero: "cubro",
    slot: "body",
    source: "dlc",
    blurb: "Knitted zigzags and one big snowflake.",
    icon: { sheet: "xmas-cosmetics", frame: 2 },
  },
  {
    id: "snowflake-aura",
    name: "Snowflake Aura",
    hero: "cubro",
    slot: "aura",
    source: "dlc",
    blurb: "Snow swirls around Cubro wherever he skates.",
    icon: { sheet: "xmas-pickups", frame: 3 },
  },
  {
    id: "elf-costume",
    name: "Elf costume",
    hero: "candy-cube",
    slot: "head",
    source: "dlc",
    blurb: "Candy's Christmas Cosmetics: a little elf hat for Candy Cube.",
    icon: { sheet: "hayden-cosmetics", frame: 0 },
  },
  {
    id: "candle-aura",
    name: "Candle aura",
    hero: "candy-cube",
    slot: "aura",
    source: "dlc",
    blurb: "Candy's Christmas Cosmetics: a warm candlelight glow.",
    icon: { sheet: "hayden-cosmetics", frame: 1 },
  },
];

/** Retired: Candy Cube replaced the Candy Cane Scarf. Kept so old saves can be cleaned up. */
export const DECEMBER_GIFT_ID = "candy-cane-scarf";

export type CollectableKind = "present" | "ornament" | "tree";

/** From the design sheet: "Christmas collectables" with their points. */
export const COLLECTABLES: Record<CollectableKind, { name: string; points: number; frame: number }> = {
  present: { name: "Present", points: 30, frame: 0 },
  ornament: { name: "Ornament", points: 45, frame: 1 },
  tree: { name: "Christmas Tree", points: 65, frame: 2 },
};

export interface XmasSave {
  enabled: boolean;
  /** Christmas music on/off (the options-menu button). */
  music: boolean;
  /** "area-themes" (default: Hayden's theme per area) or one song id from carols.ts played everywhere. */
  track: string;
  /** Local co-op, max 2 players. */
  coop: boolean;
  owned: string[];
  equipped: Record<HeroKey, string[]>;
  collected: Record<CollectableKind, number>;
  points: number;
  /** Years the December gift has already been handed out. */
  decemberYears: number[];
}

export const XMAS_DEFAULTS: XmasSave = {
  enabled: false,
  music: true,
  track: "area-themes",
  coop: false,
  owned: [],
  equipped: { cuboe: [], cubro: [], "candy-cube": [] },
  collected: { present: 0, ornament: 0, tree: 0 },
  points: 0,
  decemberYears: [],
};

export function normalizeXmas(raw: Partial<XmasSave> | undefined | null): XmasSave {
  const r = raw ?? {};
  return dropRetiredScarf({
    ...XMAS_DEFAULTS,
    ...r,
    owned: Array.isArray(r.owned) ? [...r.owned] : [],
    equipped: {
      cuboe: Array.isArray(r.equipped?.cuboe) ? [...r.equipped!.cuboe] : [],
      cubro: Array.isArray(r.equipped?.cubro) ? [...r.equipped!.cubro] : [],
      "candy-cube": Array.isArray(r.equipped?.["candy-cube"]) ? [...r.equipped!["candy-cube"]] : [],
    },
    collected: { ...XMAS_DEFAULTS.collected, ...(r.collected ?? {}) },
    decemberYears: Array.isArray(r.decemberYears) ? [...r.decemberYears] : [],
  });
}

function dropRetiredScarf(s: XmasSave): XmasSave {
  const drop = (list: string[]) => list.filter((id) => id !== DECEMBER_GIFT_ID);
  return {
    ...s,
    owned: drop(s.owned),
    equipped: {
      cuboe: drop(s.equipped.cuboe),
      cubro: drop(s.equipped.cubro),
      "candy-cube": drop(s.equipped["candy-cube"] ?? []),
    },
  };
}

export function cosmeticById(id: string) {
  return COSMETICS.find((c) => c.id === id);
}

export function cosmeticsFor(hero: HeroKey) {
  return COSMETICS.filter((c) => c.hero === hero || c.hero === "both");
}

/** Pressing the DLC button: off → on, on → off (design sheet "how to enable / disable"). */
export function toggleDlc(s: XmasSave): XmasSave {
  const enabled = !s.enabled;
  if (!enabled) return { ...s, enabled };
  const owned = Array.from(new Set([...s.owned, ...COSMETICS.filter((c) => c.source === "dlc").map((c) => c.id)]));
  return { ...s, enabled, owned };
}

export function isOwned(s: XmasSave, id: string) {
  return s.owned.includes(id);
}

export function isEquipped(s: XmasSave, hero: HeroKey, id: string) {
  return s.equipped[hero].includes(id);
}

/** Equip/unequip at the pumpkin station. One item per slot per hero. */
export function toggleEquip(s: XmasSave, hero: HeroKey, id: string): XmasSave {
  const c = cosmeticById(id);
  if (!c || !isOwned(s, id)) return s;
  if (c.hero !== "both" && c.hero !== hero) return s;
  const cur = s.equipped[hero];
  let next: string[];
  if (cur.includes(id)) next = cur.filter((x) => x !== id);
  else next = [...cur.filter((x) => cosmeticById(x)?.slot !== c.slot), id];
  return { ...s, equipped: { ...s.equipped, [hero]: next } };
}

/** Active cosmetics for a hero (owned + equipped + DLC on). */
export function activeCosmetics(s: XmasSave, hero: HeroKey): string[] {
  if (!s.enabled) return [];
  return s.equipped[hero].filter((id) => isOwned(s, id));
}

export function collect(s: XmasSave, kind: CollectableKind): XmasSave {
  return {
    ...s,
    collected: { ...s.collected, [kind]: (s.collected[kind] ?? 0) + 1 },
    points: s.points + COLLECTABLES[kind].points,
  };
}

/**
 * Which Christmas collectable (if any) replaces the n-th candy pickup in a level
 * while the DLC is on. Deterministic so every run of a room looks the same.
 */
export function collectableForCandy(index: number): CollectableKind | null {
  const k = index % 4;
  if (k === 1) return "present";
  if (k === 3) return "ornament";
  return null;
}

/* ---------------- December gift ---------------- */

export function isDecember(d: Date) {
  return d.getMonth() === 11;
}

export function decemberGiftDue(s: XmasSave, d: Date) {
  return s.enabled && isDecember(d) && !s.decemberYears.includes(d.getFullYear());
}

/**
 * The Candy Cane Scarf was retired (Candy Cube replaced it). We still stamp
 * the year so December doesn't nag, but nothing is granted.
 */
export function claimDecemberGift(s: XmasSave, d: Date): { state: XmasSave; granted: boolean; firstTime: boolean } {
  if (!decemberGiftDue(s, d)) return { state: s, granted: false, firstTime: false };
  return {
    state: { ...s, decemberYears: [...s.decemberYears, d.getFullYear()] },
    granted: false,
    firstTime: false,
  };
}

/**
 * The date the DLC uses. Override for testing with any of:
 *   - URL `?dlcDate=2026-12-05`
 *   - localStorage `ssi-dlc-date` = `2026-12-05`
 *   - `window.__ssiDlcDate = "2026-12-05"` (dev tools)
 */
export function parseDlcDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dlcNow(): Date {
  try {
    const g = globalThis as unknown as {
      __ssiDlcDate?: string;
      location?: { search: string };
      localStorage?: Storage;
    };
    const fromGlobal = parseDlcDate(g.__ssiDlcDate);
    if (fromGlobal) return fromGlobal;
    if (g.location) {
      const q = new URLSearchParams(g.location.search).get("dlcDate");
      const fromUrl = parseDlcDate(q);
      if (fromUrl) return fromUrl;
    }
    const fromLs = parseDlcDate(g.localStorage?.getItem("ssi-dlc-date"));
    if (fromLs) return fromLs;
  } catch {
    /* no window */
  }
  return new Date();
}

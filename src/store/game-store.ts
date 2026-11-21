import { create } from "zustand";
import { loadSave, writeSave, type SaveData } from "@/game/save";
import { HEROES, type HeroId, type Rank } from "@/game/data/world";
import { heroUnlocked } from "@/game/backrooms/heroes";

export type Screen =
  | "title"
  | "select"
  | "playing"
  | "pause"
  | "rank"
  | "over"
  | "trapped"
  | "gallery"
  | "lore"
  | "minigames"
  | "codes"
  | "how"
  | "endings"
  | "ending"
  | "credits"
  | "options";

export interface Hud {
  score: number;
  combo: number;
  lives: number;
  hp: number;
  maxHp: number;
  candy: number;
  timer: number;
  pizza: boolean;
  rank: string;
  label: string;
  prompt: string;
  meter: number;
  bossHp: number;
  bossMax: number;
}

interface Store {
  save: SaveData;
  screen: Screen;
  hud: Hud;
  lastRank: { levelId: string; rank: Rank; score: number; unlocked?: HeroId[] } | null;
  ending: string | null;
  toast: string;
  persist: (patch: Partial<SaveData>) => void;
  setScreen: (s: Screen) => void;
  setHud: (h: Partial<Hud>) => void;
  setToast: (t: string) => void;
  pickHero: (h: HeroId) => void;
}

const emptyHud: Hud = {
  score: 0,
  combo: 0,
  lives: 6,
  hp: 6,
  maxHp: 6,
  candy: 0,
  timer: 0,
  pizza: false,
  rank: "F",
  label: "",
  prompt: "",
  meter: 0,
  bossHp: 0,
  bossMax: 0,
};

export const useGame = create<Store>((set, get) => ({
  save: loadSave(),
  screen: "title",
  hud: emptyHud,
  lastRank: null,
  ending: null,
  toast: "",
  persist: (patch) => {
    const save = { ...get().save, ...patch };
    writeSave(save);
    set({ save });
  },
  setScreen: (screen) => set({ screen }),
  setHud: (h) => set({ hud: { ...get().hud, ...h } }),
  setToast: (toast) => set({ toast }),
  pickHero: (want) => {
    // a locked reward hero can't be picked (the select screen shows it as a silhouette)
    const hero = heroUnlocked(get().save, want) ? want : "cuboe";
    const def = HEROES[hero] ?? HEROES.cuboe;
    const maxHp = def.hp ?? def.lives;
    const lives = def.lives;
    get().persist({ hero });
    set({ hud: { ...get().hud, lives, hp: maxHp, maxHp } });
  },
}));

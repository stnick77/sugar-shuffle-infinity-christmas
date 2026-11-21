/**
 * The Backrooms reward heroes: Hazmat Cube and Entity Cube. Escaping Floor
 * 470539758 (beat Bacteria, survive the chase, take the heaven ESCAPE door)
 * unlocks both. Kept free of Phaser/React so node tests can import it.
 */
import type { HeroId } from "../data/world.ts";

export const BACKROOMS_HEROES: HeroId[] = ["hazmat-cube", "entity-cube"];
export const BACKROOMS_HERO_HINT = "Escape the Backrooms";
const ESCAPED = "br-heaven"; // marked completed by escapeRewards

export function isRewardHero(id: HeroId) {
  return BACKROOMS_HEROES.includes(id);
}

/** Is this hero playable for this save? Non-reward heroes always are (DLC gating is separate). */
export function heroUnlocked(save: { heroes?: readonly string[] }, id: HeroId) {
  return !isRewardHero(id) || (save.heroes ?? []).includes(id);
}

/** Add the reward heroes; returns the new list and which ones are new (for the unlock popup). */
export function unlockRewardHeroes(have: readonly string[] | undefined) {
  const list = [...(have ?? [])] as HeroId[];
  const fresh = BACKROOMS_HEROES.filter((h) => !list.includes(h));
  return { heroes: [...list, ...fresh], fresh };
}

/** Save migration: keep valid ids, and grant the heroes to saves that escaped before they existed. */
export function migrateRewardHeroes(have: readonly string[] | undefined, completed: readonly string[] | undefined): HeroId[] {
  const list = (Array.isArray(have) ? have : []).filter((h): h is HeroId => BACKROOMS_HEROES.includes(h as HeroId));
  return (completed ?? []).includes(ESCAPED) ? unlockRewardHeroes(list).heroes : [...new Set(list)];
}

/**
 * Entity Cube's look: it glitches all the time, but mildly. Faint red/cyan
 * ghosts every frame, plus a small burst at most `burstsPerSec` times a second
 * (well under the 3 Hz flash limit). Off when the Character glitch toggle is off.
 */
export const ENTITY_GLITCH = { ghostAlpha: 0.18, split: 1.5, burstsPerSec: 0.8, burstMs: 130, burstSplit: 4, burstSlices: 1 } as const;

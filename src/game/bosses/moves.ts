/**
 * Boss movesets (pure data, no Phaser — unit tested in dlc.test.ts).
 * Every boss cycles through its moves in order, and a new phase unlocks extra moves:
 * phase 2 at 2/3 health, phase 3 at 1/3. Wind-ups get shorter each phase.
 * Each move ends with the boss flashing gold — the "WAIT FOR THE FLASH" weak point.
 */
export type BossMove = { id: string; name: string; from: 1 | 2 | 3 };

export const BOSS_MOVES: Record<string, BossMove[]> = {
  "f2-boss": [
    { id: "sweet", name: "Sweet shots", from: 1 },
    { id: "boot", name: "Boot rush", from: 1 },
    { id: "nuke", name: "Super nuke", from: 2 },
  ],
  "f3-boss": [
    { id: "rush", name: "Board rush", from: 1 },
    { id: "rocket", name: "Rocket shot", from: 1 },
    { id: "tornado", name: "Tornado copy", from: 1 },
    { id: "stomp", name: "Sky stomp", from: 2 },
  ],
  "f4-boss": [
    { id: "aeraste", name: "Aeraste copy", from: 1 },
    { id: "laser", name: "Laser spin", from: 1 },
    { id: "shield", name: "Shield bash", from: 1 },
    { id: "beams", name: "Two-side beams", from: 2 },
  ],
  "f5-boss": [
    { id: "vine", name: "Candy corn vines", from: 1 },
    { id: "whip", name: "Licorice strike", from: 1 },
    { id: "ray", name: "Candy ray", from: 1 },
    { id: "summon", name: "Candy minions", from: 2 },
    { id: "rain", name: "Candy rain", from: 3 },
  ],
};

/** Wind-up (telegraph) time, weak-point window and rest between moves, per phase. */
export const TELEGRAPH_MS = [720, 580, 460] as const;
export const OPEN_MS = [950, 820, 720] as const;
export const REST_MS = [850, 650, 500] as const;

export function phaseFor(hp: number, max: number): 1 | 2 | 3 {
  if (max <= 0) return 1;
  if (hp <= max / 3) return 3;
  if (hp <= (2 * max) / 3) return 2;
  return 1;
}

export function movesFor(bossId: string, phase: number): BossMove[] {
  return (BOSS_MOVES[bossId] ?? []).filter((m) => m.from <= phase);
}

/** Next move in the cycle; never the same move twice in a row when there's a choice. */
export function nextMove(bossId: string, phase: number, count: number, last: string): string {
  const list = movesFor(bossId, phase);
  if (!list.length) return "";
  let pick = list[count % list.length]!;
  if (pick.id === last && list.length > 1) pick = list[(count + 1) % list.length]!;
  return pick.id;
}

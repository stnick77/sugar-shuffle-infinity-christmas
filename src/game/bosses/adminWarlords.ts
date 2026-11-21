/**
 * Admin Warlords — Hayden's secret "extreme" boss.
 *
 * 3 phases, 10 hits each (30 total). Patterns get denser and faster each
 * phase, with short open (flash) windows, but every volley leaves a dodge
 * lane so a skilled player can avoid damage.
 */

import { ADMIN_PHASE_HP, ADMIN_PHASES } from "../hayden/content.ts";

export type AdminPhase = 1 | 2 | 3;

export interface OrbShot {
  /** Offset from the warlord's body centre, in pixels. */
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  /** Delay before this orb is spawned, in milliseconds. */
  delay: number;
}

export interface AdminPattern {
  id: string;
  telegraphMs: number;
  /** Time after the last delayed orb before the weak point opens. */
  recoverMs: number;
  openMs: number;
  orbs: OrbShot[];
}

const HAND_L = { ox: -36, oy: -18 };
const HAND_R = { ox: 36, oy: -18 };

function aim(tx: number, ty: number, speed: number, ox = 0, oy = 0): Pick<OrbShot, "vx" | "vy"> {
  const dx = tx - ox;
  const dy = ty - oy;
  const len = Math.hypot(dx, dy) || 1;
  return { vx: (dx / len) * speed, vy: (dy / len) * speed };
}

function fan(tx: number, ty: number, speed: number, count: number, spreadDeg: number, origin: { ox: number; oy: number }, delay = 0): OrbShot[] {
  const mid = (count - 1) / 2;
  const rad = (spreadDeg * Math.PI) / 180;
  const base = Math.atan2(ty - origin.oy, tx - origin.ox);
  const orbs: OrbShot[] = [];
  for (let i = 0; i < count; i++) {
    const a = base + (i - mid) * (count === 1 ? 0 : rad / Math.max(1, count - 1));
    orbs.push({ ...origin, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, delay });
  }
  return orbs;
}

/** A downward volley with a missing slot so the player can stand in the gap. */
function wave(speed: number, gapIndex: number, n = 6, _y = 20): OrbShot[] {
  const orbs: OrbShot[] = [];
  for (let i = 0; i < n; i++) {
    if (i === gapIndex) continue;
    const t = n === 1 ? 0 : i / (n - 1);
    const x = -140 + t * 280;
    orbs.push({ ox: x, oy: -70, vx: 0, vy: speed, delay: i * 30 });
  }
  return orbs;
}

function ring(speed: number, count: number, gapStart: number, gapCount: number, origin = { ox: 0, oy: -10 }): OrbShot[] {
  const orbs: OrbShot[] = [];
  for (let i = 0; i < count; i++) {
    const k = (i - gapStart + count) % count;
    if (k < gapCount) continue;
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    orbs.push({ ...origin, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, delay: 0 });
  }
  return orbs;
}

export function patternsFor(phase: AdminPhase): AdminPattern[] {
  if (phase === 1) {
    return [
      {
        id: "spread3",
        telegraphMs: 280,
        recoverMs: 80,
        openMs: 800,
        orbs: fan(0, 80, 300, 3, 28, HAND_R),
      },
      {
        id: "wave",
        telegraphMs: 300,
        recoverMs: 80,
        openMs: 800,
        orbs: wave(260, 2, 6),
      },
      {
        id: "hands",
        telegraphMs: 260,
        recoverMs: 60,
        openMs: 720,
        orbs: [
          { ...HAND_L, ...aim(-80, 70, 320, HAND_L.ox, HAND_L.oy), delay: 0 },
          { ...HAND_R, ...aim(80, 70, 320, HAND_R.ox, HAND_R.oy), delay: 80 },
        ],
      },
    ];
  }
  if (phase === 2) {
    return [
      {
        id: "spread5",
        telegraphMs: 240,
        recoverMs: 60,
        openMs: 600,
        orbs: fan(0, 80, 400, 5, 36, HAND_R),
      },
      {
        id: "double",
        telegraphMs: 240,
        recoverMs: 80,
        openMs: 560,
        orbs: [...fan(0, 80, 380, 3, 24, HAND_L, 0), ...fan(0, 80, 380, 3, 24, HAND_R, 220)],
      },
      {
        id: "ring",
        telegraphMs: 260,
        recoverMs: 60,
        openMs: 600,
        // 10 orbs, skip 2 adjacent = a 72° safe cone
        orbs: ring(360, 10, 0, 2),
      },
    ];
  }
  return [
    {
      id: "stream",
      telegraphMs: 200,
      recoverMs: 40,
      openMs: 500,
      // Aimed at a slightly stale offset so strafing clears the line
      orbs: Array.from({ length: 8 }, (_, i) => ({
        ...HAND_R,
        ...aim(30, 90, 480, HAND_R.ox, HAND_R.oy),
        delay: i * 70,
      })),
    },
    {
      id: "highlow",
      telegraphMs: 200,
      recoverMs: 40,
      openMs: 500,
      orbs: [
        { ox: -40, oy: -50, vx: -420, vy: 40, delay: 0 },
        { ox: 40, oy: 30, vx: 420, vy: 0, delay: 90 },
        { ox: -40, oy: -50, vx: -450, vy: 40, delay: 180 },
        { ox: 40, oy: 30, vx: 450, vy: 0, delay: 270 },
        { ox: 0, oy: -60, vx: 0, vy: 400, delay: 200 },
      ],
    },
    {
      id: "spiral",
      telegraphMs: 200,
      recoverMs: 40,
      openMs: 480,
      // 12 orbs, skip 2 = a 60° rotating-style gap (fixed this volley)
      orbs: ring(420, 12, 3, 2),
    },
    {
      id: "cross",
      telegraphMs: 180,
      recoverMs: 40,
      openMs: 500,
      orbs: [
        ...fan(0, 80, 500, 3, 22, HAND_L, 0),
        ...fan(0, 80, 500, 3, 22, HAND_R, 120),
        ...wave(420, 3, 7, 24),
      ],
    },
  ];
}

export function patternAt(phase: AdminPhase, attackIndex: number): AdminPattern {
  const list = patternsFor(phase);
  return list[attackIndex % list.length]!;
}

export function nextAdminPhase(phase: number): AdminPhase | null {
  if (phase < 1) return 1;
  if (phase >= ADMIN_PHASES) return null;
  return (phase + 1) as AdminPhase;
}

export function adminPhaseHp() {
  return ADMIN_PHASE_HP;
}

/**
 * Every pattern must leave a dodge lane: at least one 40° cone (or a
 * downward-wave gap) with no orb velocity in it, measured from the boss.
 */
export function patternHasSafeLane(p: AdminPattern): boolean {
  if (p.id === "wave" || p.id === "highlow" || p.id === "cross") return true;
  if (p.orbs.length === 0) return false;
  const buckets = 18;
  const filled = new Array(buckets).fill(0);
  for (const o of p.orbs) {
    const a = (Math.atan2(o.vy, o.vx) + Math.PI * 2) % (Math.PI * 2);
    filled[Math.floor((a / (Math.PI * 2)) * buckets) % buckets]++;
  }
  // A safe lane is 2 adjacent empty buckets (~40°)
  const ext = filled.concat(filled);
  for (let i = 0; i < buckets; i++) {
    if (ext[i] === 0 && ext[i + 1] === 0) return true;
  }
  return false;
}

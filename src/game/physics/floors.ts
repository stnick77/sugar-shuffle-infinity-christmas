/**
 * Swept floor collision helpers. Arcade's discrete step can skip a 48px tile
 * when fall speed is high or a frame runs long; these tests use the previous
 * and current boxes so a body that crossed a floor this step still lands.
 */

/** Max downward speed so one 50ms step cannot skip a 48px floor tile. */
export const MAX_FALL_SPEED = 840;

/**
 * Arcade OVERLAP_BIAS for the play scene. Arcade resolves Y first (gravity is
 * on Y) and treats any vertical overlap up to |dy| + bias as "hit the top or
 * bottom". It must stay well under a tile: at 48 (one tile) walking into the
 * side of a one-tile step counted as a 48px vertical hit, and because the
 * hero's body (~39px) is shorter than the tile, Arcade decided the tile was
 * "on top" and shoved the hero DOWN through the floor, out of the world:
 * instant death. Fast falls don't need a big bias: the body's own per-step
 * fall (|dy|, capped by MAX_FALL_SPEED) is already part of the allowance, and
 * the swept snap below catches anything left.
 */
export const ARCADE_OVERLAP_BIAS = 8;

/** Bodies already standing sit a few pixels into the floor. */
export const FLOOR_SLOP = 8;

export type Aabb = { left: number; right: number; top: number; bottom: number };

export function overlapsX(a: Aabb, b: Aabb, inset = 1): boolean {
  return a.right > b.left + inset && a.left < b.right - inset;
}

export function sweptX(prev: Aabb, curr: Aabb): Aabb {
  return {
    left: Math.min(prev.left, curr.left),
    right: Math.max(prev.right, curr.right),
    top: Math.min(prev.top, curr.top),
    bottom: Math.max(prev.bottom, curr.bottom),
  };
}

/**
 * A falling body should land if it was on or above the floor last frame,
 * even if this frame's discrete step already buried it in the tile.
 */
export function shouldLandOnFloor(opts: {
  velocityY: number;
  dropping?: boolean;
  oneWay?: boolean;
  prev: Aabb;
  curr: Aabb;
  floor: Aabb;
  slop?: number;
}): boolean {
  const slop = opts.slop ?? FLOOR_SLOP;
  if (opts.oneWay && opts.dropping) return false;
  if (opts.velocityY < 0) return false;
  if (!overlapsX(opts.prev, opts.floor) && !overlapsX(opts.curr, opts.floor) && !overlapsX(sweptX(opts.prev, opts.curr), opts.floor)) {
    return false;
  }
  // Already fully under the surface last step — don't pop back up through a ceiling or pit wall.
  if (opts.prev.bottom > opts.floor.top + slop) return false;
  // Still short of the surface this step.
  if (opts.curr.bottom < opts.floor.top - slop) return false;
  return true;
}

/** Highest floor top the body should stand on this step, or null if none. */
export function landingFloorTop(opts: {
  velocityY: number;
  dropping?: boolean;
  prev: Aabb;
  curr: Aabb;
  floors: { aabb: Aabb; oneWay?: boolean }[];
  slop?: number;
}): number | null {
  let best: number | null = null;
  for (const f of opts.floors) {
    if (!shouldLandOnFloor({ ...opts, floor: f.aabb, oneWay: f.oneWay })) continue;
    // Smallest y is the first floor hit while falling (y grows downward).
    if (best === null || f.aabb.top < best) best = f.aabb.top;
  }
  return best;
}

export function capFallSpeed(velocityY: number, max = MAX_FALL_SPEED): number {
  return velocityY > max ? max : velocityY;
}

/** Hub doors / portals into a level: only a fresh Up press, never walk or jump. */
export function canEnterDoor(opts: { upPressed: boolean }): boolean {
  return !!opts.upPressed;
}

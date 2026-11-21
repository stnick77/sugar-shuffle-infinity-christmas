/**
 * Keyboard / gamepad navigation for the HTML menus (pumpkin station, Christmas
 * closet, options, lore, codes, minigames, credits...).
 *
 * The game's own key listener calls preventDefault on the arrow keys, W/S and
 * Space so the page never scrolls during play. That also stopped the browser
 * from scrolling the menus, so anything below the fold (like Candy Cube's elf
 * costume and candle aura in the Christmas closet) could not be reached with
 * Down. Menus now move a highlight themselves and scroll it into view.
 */

export type NavDir = -1 | 1;
export type NavAction = { kind: "move"; dir: NavDir } | { kind: "activate" } | null;

const UP_KEYS = new Set(["ArrowUp", "KeyW"]);
const DOWN_KEYS = new Set(["ArrowDown", "KeyS"]);
const ACTIVATE_KEYS = new Set(["Enter", "NumpadEnter", "Space"]);

/** Map a KeyboardEvent.code to a menu action (null = not a menu key). */
export function navActionForKey(code: string): NavAction {
  if (UP_KEYS.has(code)) return { kind: "move", dir: -1 };
  if (DOWN_KEYS.has(code)) return { kind: "move", dir: 1 };
  if (ACTIVATE_KEYS.has(code)) return { kind: "activate" };
  return null;
}

/**
 * Next highlighted index. `current` -1 means nothing is highlighted yet:
 * Down picks the first item, Up the last. Stops at the ends (no wrap) so
 * holding Down settles on the last item and the menu can scroll the rest.
 */
export function nextNavIndex(current: number, count: number, dir: NavDir): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return dir > 0 ? 0 : count - 1;
  return Math.min(count - 1, Math.max(0, current + dir));
}

export interface PadSnapshot {
  up: boolean;
  down: boolean;
  a: boolean;
}

/** Read menu-relevant gamepad state: d-pad 12/13 or left stick, A (0) to pick. */
export function padSnapshot(pads: readonly ({ axes: readonly number[]; buttons: readonly { pressed: boolean }[] } | null)[]): PadSnapshot {
  const s: PadSnapshot = { up: false, down: false, a: false };
  for (const p of pads) {
    if (!p) continue;
    const ay = p.axes[1] ?? 0;
    if (p.buttons[12]?.pressed || ay < -0.6) s.up = true;
    if (p.buttons[13]?.pressed || ay > 0.6) s.down = true;
    if (p.buttons[0]?.pressed) s.a = true;
  }
  return s;
}

/** Edge-detect pad presses so holding the stick moves one step, not every frame. */
export function padActions(prev: PadSnapshot, now: PadSnapshot): NavAction[] {
  const out: NavAction[] = [];
  if (now.up && !prev.up) out.push({ kind: "move", dir: -1 });
  if (now.down && !prev.down) out.push({ kind: "move", dir: 1 });
  if (now.a && !prev.a) out.push({ kind: "activate" });
  return out;
}

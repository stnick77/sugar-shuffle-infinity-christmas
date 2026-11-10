import { ssi } from "./runtime";

const LEFT = new Set(["ArrowLeft", "KeyA"]);
const RIGHT = new Set(["ArrowRight", "KeyD"]);
const JUMP = new Set(["Space", "KeyK", "KeyZ"]);
const ATTACK = new Set(["KeyJ"]);
const RUN = new Set(["ShiftLeft", "ShiftRight", "KeyL"]);
const UP = new Set(["ArrowUp", "KeyW"]);
const DOWN = new Set(["ArrowDown", "KeyS"]);
const PAUSE = new Set(["Escape", "KeyP"]);
const SPECIAL = new Set(["KeyQ", "KeyC"]);

/*
 * 'Tis the Seasones DLC local co-op (2 players). While co-op is on:
 *   P1 keeps WASD / Space / K / Z / J / Q / C / Left Shift / L (no arrows).
 *   P2 uses Arrows to move/up/down, Enter or Numpad0 to jump,
 *   Slash or Numpad1 to attack, Right Shift to run.
 *   Gamepad 1 drives P1, gamepad 2 drives P2.
 * With co-op off nothing here changes the base controls.
 */
let coop = false;
const ARROWS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
const P2 = {
  left: "ArrowLeft",
  right: "ArrowRight",
  up: "ArrowUp",
  down: "ArrowDown",
  jump: new Set(["Enter", "NumpadEnter", "Numpad0"]),
  attack: new Set(["Slash", "Numpad1"]),
  run: new Set(["ShiftRight"]),
};
const p2Prev = { jump: false, attack: false, up: false };

export function setCoopInput(on: boolean) {
  coop = on;
  p2Prev.jump = p2Prev.attack = p2Prev.up = false;
  ssi().padPrev = [];
}

export function coopInput() {
  return coop;
}

function allHeld() {
  const st = ssi();
  const s = new Set(st.held);
  st.injected.forEach((c) => s.add(c));
  return s;
}

export function bootInput() {
  const st = ssi();
  st.inputAbort?.abort();
  const ac = new AbortController();
  st.inputAbort = ac;
  st.prevJump = false;
  st.prevAttack = false;
  st.prevUp = false;
  st.prevPause = false;
  st.prevSpecial = false;

  const onDown = (e: KeyboardEvent) => {
    if (isTyping(e.target)) return;
    st.held.add(e.code);
    if (
      LEFT.has(e.code) ||
      RIGHT.has(e.code) ||
      JUMP.has(e.code) ||
      ATTACK.has(e.code) ||
      UP.has(e.code) ||
      DOWN.has(e.code) ||
      PAUSE.has(e.code) ||
      SPECIAL.has(e.code) ||
      RUN.has(e.code) ||
      (coop && (P2.jump.has(e.code) || P2.attack.has(e.code)))
    ) {
      e.preventDefault();
    }
  };
  const onUp = (e: KeyboardEvent) => st.held.delete(e.code);
  const clear = () => st.held.clear();
  window.addEventListener("keydown", onDown, { signal: ac.signal });
  window.addEventListener("keyup", onUp, { signal: ac.signal });
  window.addEventListener("blur", clear, { signal: ac.signal });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) clear();
    },
    { signal: ac.signal },
  );
}

/** Text fields (promo codes) keep their keys instead of feeding the game. */
function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

/** Remove the window key listeners and drop any held keys (called when the game is destroyed). */
export function stopInput() {
  const st = ssi();
  st.inputAbort?.abort();
  st.inputAbort = null;
  st.held.clear();
  st.injected.clear();
}

export function setTouch(code: string, down: boolean) {
  const st = ssi();
  if (down) st.held.add(code);
  else st.held.delete(code);
}

export function setInjected(codes: string[]) {
  const st = ssi();
  st.injected.clear();
  codes.forEach((c) => st.injected.add(c));
}

export interface Actions {
  moveX: number;
  jump: boolean;
  jumpPressed: boolean;
  attack: boolean;
  attackPressed: boolean;
  run: boolean;
  up: boolean;
  upPressed: boolean;
  down: boolean;
  pausePressed: boolean;
  specialPressed: boolean;
}

export function readActions(): Actions {
  const st = ssi();
  const h = allHeld();
  if (coop) {
    ARROWS.forEach((c) => h.delete(c));
    h.delete("ShiftRight");
  }
  let moveX = 0;
  if ([...LEFT].some((c) => h.has(c))) moveX -= 1;
  if ([...RIGHT].some((c) => h.has(c))) moveX += 1;
  const jump = [...JUMP].some((c) => h.has(c));
  const attack = [...ATTACK].some((c) => h.has(c)) || h.has("KeyX");
  const run = [...RUN].some((c) => h.has(c)) || h.has("ShiftLeft");
  const up = [...UP].some((c) => h.has(c));
  const down = [...DOWN].some((c) => h.has(c));
  const pause = [...PAUSE].some((c) => h.has(c));
  const special = [...SPECIAL].some((c) => h.has(c));
  const actions: Actions = {
    moveX,
    jump,
    jumpPressed: jump && !st.prevJump,
    attack,
    attackPressed: attack && !st.prevAttack,
    run,
    up,
    upPressed: up && !st.prevUp,
    down,
    pausePressed: pause && !st.prevPause,
    specialPressed: special && !st.prevSpecial,
  };
  st.prevJump = jump;
  st.prevAttack = attack;
  st.prevUp = up;
  st.prevPause = pause;
  st.prevSpecial = special;
  return actions;
}

/**
 * Merge gamepad input into `actions`. `player` picks the pad and its
 * just-pressed memory: solo play reads every pad as P1; co-op reads pad 1
 * for P1 and pad 2 for P2, each with its own edge detection so holding a
 * button on one pad never repeats or eats a press on the other.
 */
export function pollGamepad(actions: Actions, player = 0) {
  const st = ssi();
  if (!Array.isArray(st.padPrev)) st.padPrev = [];
  const pads = navigator.getGamepads?.() ?? [];
  const list = coop ? [pads[player] ?? null] : player === 0 ? [...pads] : [];
  const now = { jump: false, attack: false, up: false, pause: false, special: false };
  for (const pad of list) {
    if (!pad) continue;
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    const mag = Math.hypot(ax, ay);
    if (mag > 0.18) {
      if (Math.abs(ax) > 0.18) actions.moveX = Math.sign(ax);
    }
    if (pad.buttons[14]?.pressed) actions.moveX = -1;
    if (pad.buttons[15]?.pressed) actions.moveX = 1;
    if (pad.buttons[0]?.pressed) now.jump = true;
    if (pad.buttons[2]?.pressed) now.attack = true;
    // Y (3) or either bumper (4/5) is Special.
    if (pad.buttons[3]?.pressed || pad.buttons[4]?.pressed || pad.buttons[5]?.pressed) now.special = true;
    if (pad.buttons[9]?.pressed) now.pause = true;
    if (pad.buttons[12]?.pressed || ay < -0.6) now.up = true;
    if (pad.buttons[13]?.pressed || ay > 0.6) actions.down = true;
    if (pad.buttons[1]?.pressed) actions.run = true;
  }
  // Holding a pad button only counts as a press on the frame it goes down.
  const prev = st.padPrev[player] ?? { jump: false, attack: false, up: false, pause: false, special: false };
  if (now.jump && !prev.jump && !actions.jump) actions.jumpPressed = true;
  if (now.attack && !prev.attack && !actions.attack) actions.attackPressed = true;
  if (now.up && !prev.up && !actions.up) actions.upPressed = true;
  if (now.pause && !prev.pause) actions.pausePressed = true;
  if (now.special && !prev.special) actions.specialPressed = true;
  actions.jump ||= now.jump;
  actions.attack ||= now.attack;
  actions.up ||= now.up;
  st.padPrev[player] = now;
}

/** Player 2 actions (co-op only). No specials or pause for P2. */
export function readActionsP2(): Actions {
  const h = allHeld();
  let moveX = 0;
  if (h.has(P2.left)) moveX -= 1;
  if (h.has(P2.right)) moveX += 1;
  const jump = [...P2.jump].some((c) => h.has(c));
  const attack = [...P2.attack].some((c) => h.has(c));
  const up = h.has(P2.up);
  const a: Actions = {
    moveX,
    jump,
    jumpPressed: jump && !p2Prev.jump,
    attack,
    attackPressed: attack && !p2Prev.attack,
    run: [...P2.run].some((c) => h.has(c)),
    up,
    upPressed: up && !p2Prev.up,
    down: h.has(P2.down),
    pausePressed: false,
    specialPressed: false,
  };
  p2Prev.jump = jump;
  p2Prev.attack = attack;
  p2Prev.up = up;
  pollGamepad(a, 1);
  a.pausePressed = false;
  a.specialPressed = false;
  return a;
}

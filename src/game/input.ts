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

export function pollGamepad(actions: Actions, only?: number) {
  const pads = navigator.getGamepads?.() ?? [];
  const list = coop ? [pads[only ?? 0] ?? null] : pads;
  for (const pad of list) {
    if (!pad) continue;
    const ax = pad.axes[0] ?? 0;
    const mag = Math.hypot(ax, pad.axes[1] ?? 0);
    if (mag > 0.18) {
      const nx = ax;
      if (Math.abs(nx) > 0.18) actions.moveX = Math.sign(nx);
    }
    if (pad.buttons[14]?.pressed) actions.moveX = -1;
    if (pad.buttons[15]?.pressed) actions.moveX = 1;
    if (pad.buttons[0]?.pressed) {
      if (!actions.jump) actions.jumpPressed = true;
      actions.jump = true;
    }
    if (pad.buttons[2]?.pressed) {
      if (!actions.attack) actions.attackPressed = true;
      actions.attack = true;
    }
    if (pad.buttons[9]?.pressed) actions.pausePressed = true;
    if (pad.buttons[12]?.pressed) {
      if (!actions.up) actions.upPressed = true;
      actions.up = true;
    }
    if (pad.buttons[13]?.pressed) actions.down = true;
    if (pad.buttons[1]?.pressed) actions.run = true;
  }
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
  pollGamepad(a, 1);
  a.pausePressed = false;
  p2Prev.jump = a.jump;
  p2Prev.attack = a.attack;
  p2Prev.up = a.up;
  return a;
}

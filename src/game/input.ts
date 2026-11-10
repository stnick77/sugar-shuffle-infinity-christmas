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
      RUN.has(e.code)
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

export function pollGamepad(actions: Actions) {
  const st = ssi();
  if (!st.padPrev) st.padPrev = { jump: false, attack: false, up: false, pause: false, special: false };
  const pads = navigator.getGamepads?.() ?? [];
  const now = { jump: false, attack: false, up: false, pause: false, special: false };
  for (const pad of pads) {
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
  const prev = st.padPrev;
  if (now.jump && !prev.jump && !actions.jump) actions.jumpPressed = true;
  if (now.attack && !prev.attack && !actions.attack) actions.attackPressed = true;
  if (now.up && !prev.up && !actions.up) actions.upPressed = true;
  if (now.pause && !prev.pause) actions.pausePressed = true;
  if (now.special && !prev.special) actions.specialPressed = true;
  actions.jump ||= now.jump;
  actions.attack ||= now.attack;
  actions.up ||= now.up;
  st.padPrev = now;
}

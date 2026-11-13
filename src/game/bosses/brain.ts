import * as Phaser from "phaser";
import type { BossRig } from "./rig";
import { BOSS_MOVES, OPEN_MS, REST_MS, TELEGRAPH_MS, nextMove } from "./moves";

export type BossMob = {
  spr: Phaser.Physics.Arcade.Sprite;
  kind: string;
  dir: number;
  hp: number;
  next: number;
  rig?: BossRig;
  dying?: boolean;
};

export type ShotOpts = { tint?: number; w?: number; h?: number; life?: number; gravity?: number; frame?: number; spin?: boolean };

/** What a boss brain needs from the play scene. */
export interface BossHost {
  readonly scene: Phaser.Scene;
  target(): { x: number; y: number };
  readonly floorTop: number;
  readonly worldW: number;
  shot(x: number, y: number, vx: number, vy: number, o?: ShotOpts): Phaser.Physics.Arcade.Sprite;
  /** Hurts a hero touching `obj` while it's alive (until destroyed). */
  hazard(obj: Phaser.GameObjects.Shape): void;
  melee(m: BossMob, reach: number): void;
  open(m: BossMob, ms: number): void;
  pop(x: number, y: number, text: string): void;
  shake(n: number): void;
  summon(x: number): boolean;
  sound(kind: "telegraph" | "fire" | "slam" | "whoosh" | "zap" | "roar"): void;
}

type Ai = { busy: boolean; busyUntil: number; count: number; last: string; reach: number; phase: number; forced: string };
const AIS = new WeakMap<BossMob, Ai>();

function ai(m: BossMob): Ai {
  let a = AIS.get(m);
  if (!a) {
    a = { busy: false, busyUntil: 0, count: 0, last: "", reach: 52, phase: 1, forced: "" };
    AIS.set(m, a);
  }
  return a;
}

const body = (m: BossMob) => m.spr.body as Phaser.Physics.Arcade.Body;
const alive = (m: BossMob) => m.spr.active && !m.dying;
const grounded = (m: BossMob) => body(m).blocked.down || body(m).touching.down;

/** "fake-cubro-idle" → "fake-cubro": the fake heroes have their own run/jump/attack sheets. */
function heroOf(m: BossMob) {
  const k = m.spr.texture.key;
  const hit = /^(fake-)?(cubro|cuboe)-/.exec(k);
  return hit ? `${hit[1] ?? ""}${hit[2]}` : "";
}

function anim(host: BossHost, m: BossMob, a: "idle" | "run" | "jump" | "attack") {
  const h = heroOf(m);
  if (!h) return;
  const key = `${h}-${a}`;
  if (host.scene.anims.exists(key) && m.spr.anims.currentAnim?.key !== key) m.spr.play(key, true);
}

function after(host: BossHost, m: BossMob, ms: number, fn: () => void) {
  host.scene.time.delayedCall(ms, () => {
    if (alive(m)) fn();
  });
}

function face(host: BossHost, m: BossMob) {
  m.dir = host.target().x < m.spr.x ? -1 : 1;
  m.spr.setFlipX(m.dir < 0);
}

function clampX(host: BossHost, x: number) {
  return Phaser.Math.Clamp(x, 80, host.worldW - 80);
}

/* ---------- telegraph props ---------- */

/** Pulsing warning patch on the floor. */
function floorMark(host: BossHost, x: number, color: number, ms: number, w = 70) {
  const e = host.scene.add.ellipse(x, host.floorTop - 2, w, 16, color, 0.55).setDepth(4.7).setStrokeStyle(3, 0xffffff, 0.8);
  host.scene.tweens.add({ targets: e, alpha: 0.2, scaleX: 1.15, duration: 140, yoyo: true, repeat: -1 });
  host.scene.time.delayedCall(ms, () => e.destroy());
  return e;
}

/** Thin flashing line showing where a beam/ray will go. */
function warnLine(host: BossHost, x1: number, x2: number, y: number, color: number, ms: number) {
  const r = host.scene.add.rectangle((x1 + x2) / 2, y, Math.abs(x2 - x1), 4, color, 0.8).setDepth(4.7);
  host.scene.tweens.add({ targets: r, alpha: 0.15, duration: 110, yoyo: true, repeat: -1 });
  host.scene.time.delayedCall(ms, () => r.destroy());
}

function groundWave(host: BossHost, x: number, dir: number, speed: number, tint: number) {
  host.shot(x, host.floorTop - 15, dir * speed, 0, { tint, w: 38, h: 26, life: 3200, frame: 2 });
}

/* ---------- movement helpers ---------- */

function dash(host: BossHost, m: BossMob, speed: number, ms: number, then: () => void) {
  const t0 = host.scene.time.now;
  anim(host, m, "run");
  m.spr.setFlipX(m.dir < 0);
  const ev = host.scene.time.addEvent({
    delay: 40,
    loop: true,
    callback: () => {
      if (!alive(m)) return ev.remove();
      const b = body(m);
      b.setVelocityX(m.dir * speed);
      if (Math.floor((host.scene.time.now - t0) / 40) % 3 === 0) m.rig?.dustBurst(2);
      const hitWall = (m.dir < 0 && (b.blocked.left || m.spr.x < 90)) || (m.dir > 0 && (b.blocked.right || m.spr.x > host.worldW - 90));
      if (hitWall || host.scene.time.now - t0 > ms) {
        ev.remove();
        b.setVelocityX(0);
        anim(host, m, "idle");
        then();
      }
    },
  });
}

/** Jump in an arc onto x and call `land` when the boss touches down. */
function leapTo(host: BossHost, m: BossMob, x: number, land: () => void) {
  const b = body(m);
  const air = 0.82; // 2 * 900 / 2200 gravity
  b.setVelocityY(-900);
  b.setVelocityX(Phaser.Math.Clamp((clampX(host, x) - m.spr.x) / air, -760, 760));
  anim(host, m, "jump");
  m.rig?.release("leap");
  host.sound("whoosh");
  const t0 = host.scene.time.now;
  const ev = host.scene.time.addEvent({
    delay: 30,
    loop: true,
    callback: () => {
      if (!alive(m)) return ev.remove();
      if ((host.scene.time.now - t0 > 180 && grounded(m)) || host.scene.time.now - t0 > 2000) {
        ev.remove();
        b.setVelocityX(0);
        anim(host, m, "idle");
        m.rig?.land();
        host.shake(0.45);
        host.sound("slam");
        land();
      }
    },
  });
}

/* ---------- the loop ---------- */

function start(host: BossHost, m: BossMob, a: Ai, move: string) {
  a.busy = true;
  a.busyUntil = host.scene.time.now + 9000;
  a.last = move;
  a.count++;
  m.spr.setData("move", move);
  m.spr.setData("attacks", Number(m.spr.getData("attacks") ?? 0) + 1);
  body(m).setVelocityX(0);
  face(host, m);
}

function finish(host: BossHost, m: BossMob, a: Ai, openMs: number) {
  if (!alive(m)) return;
  a.busy = false;
  a.reach = 52;
  body(m).setVelocityX(0);
  m.spr.setRotation(0);
  m.spr.setData("move", "");
  anim(host, m, "idle");
  host.open(m, openMs);
  m.next = host.scene.time.now + openMs + REST_MS[a.phase - 1]!;
}

/**
 * Called every frame for floors 2–5. Picks the next move when the boss is ready,
 * strolls/keeps its distance between moves, and handles contact damage.
 */
export function tickBrain(host: BossHost, bossId: string, m: BossMob, now: number) {
  const a = ai(m);
  const phase = Number(m.spr.getData("phase") ?? 1);
  if (phase > a.phase) {
    // a new phase: lead with the move it just unlocked
    a.phase = phase;
    a.forced = (BOSS_MOVES[bossId] ?? []).find((mv) => mv.from === phase)?.id ?? "";
  }
  if (m.rig?.entering) return;
  if (a.reach > 0) host.melee(m, a.reach);
  if (a.busy) {
    if (now > a.busyUntil) finish(host, m, a, 600); // watchdog: a move can never stall the fight
    return;
  }
  const b = body(m);
  if (now < m.next) {
    face(host, m);
    const dx = host.target().x - m.spr.x;
    const dist = Math.abs(dx);
    const speed = bossId === "f5-boss" ? 60 : 95;
    if (dist > 340) b.setVelocityX(m.dir * speed);
    else if (dist < 150 && grounded(m)) b.setVelocityX(-m.dir * speed * 0.8);
    else b.setVelocityX(b.velocity.x * 0.8);
    anim(host, m, Math.abs(b.velocity.x) > 30 ? "run" : "idle");
    return;
  }
  const move = a.forced || nextMove(bossId, a.phase, a.count, a.last);
  a.forced = "";
  if (!move) return;
  start(host, m, a, move);
  const T = TELEGRAPH_MS[a.phase - 1]!;
  const O = OPEN_MS[a.phase - 1]!;
  const p = a.phase;
  const fn = MOVES[move];
  if (fn) fn({ host, m, a, T, O, p });
  else finish(host, m, a, O);
}

type Ctx = { host: BossHost; m: BossMob; a: Ai; T: number; O: number; p: number };

function windup(c: Ctx, color: number, label: string, ms = c.T) {
  c.m.rig?.telegraph(color, ms);
  c.host.sound("telegraph");
  c.host.pop(c.m.spr.x, c.m.spr.y - 96, label);
}

const MOVES: Record<string, (c: Ctx) => void> = {
  /* ---------- Marshmallow Outlaw ---------- */
  sweet(c) {
    const { host, m } = c;
    windup(c, 0xff7ab8, "SWEET SHOTS");
    const n = c.p + 1;
    for (let i = 0; i < n; i++) {
      after(host, m, c.T + i * 260, () => {
        face(host, m);
        m.rig?.release("lunge");
        host.sound("fire");
        host.shot(m.spr.x + m.dir * 44, host.floorTop - 30, m.dir * 300, 0, { tint: 0xff9ad0, w: 26, h: 26 });
      });
    }
    after(host, m, c.T + n * 260 + 120, () => finish(host, m, c.a, c.O));
  },
  boot(c) {
    const { host, m } = c;
    windup(c, 0xffa040, "BOOT RUSH");
    after(host, m, c.T, () => {
      m.rig?.release("lunge");
      host.sound("whoosh");
      c.a.reach = 64;
      dash(host, m, 400 + 40 * c.p, 750, () => finish(host, m, c.a, c.O + 150));
    });
  },
  nuke(c) {
    const { host, m } = c;
    const tx = clampX(host, host.target().x);
    windup(c, 0xff4040, "SUPER NUKE");
    floorMark(host, tx, 0xff4040, c.T + 1000, 150);
    after(host, m, c.T, () => {
      m.rig?.release("cast");
      host.sound("fire");
      const bomb = host.scene.add.circle(m.spr.x, m.spr.y - 40, 16, 0xff5050).setStrokeStyle(4, 0xffe066).setDepth(7);
      const x0 = m.spr.x;
      const y0 = m.spr.y - 40;
      host.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 1000,
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          bomb.setPosition(x0 + (tx - x0) * t, y0 + (host.floorTop - 16 - y0) * t - 320 * Math.sin(Math.PI * t));
          bomb.rotation += 0.2;
        },
        onComplete: () => {
          bomb.destroy();
          const boom = host.scene.add.circle(tx, host.floorTop - 30, 75, 0xffb040, 0.7).setDepth(7);
          host.hazard(boom);
          host.shake(0.6);
          host.sound("slam");
          m.rig?.burst(tx, host.floorTop - 30, 16);
          host.scene.tweens.add({ targets: boom, scale: 1.25, alpha: 0, duration: 300, onComplete: () => boom.destroy() });
          if (c.p >= 3) {
            groundWave(host, tx, -1, 260, 0xffb040);
            groundWave(host, tx, 1, 260, 0xffb040);
          }
        },
      });
    });
    after(host, m, c.T + 1150, () => finish(host, m, c.a, c.O + 150));
  },

  /* ---------- Fake Candy Cubro ---------- */
  rush(c) {
    const { host, m } = c;
    windup(c, 0xff5a5a, "BOARD RUSH");
    anim(host, m, "run");
    after(host, m, c.T, () => {
      m.rig?.release("lunge");
      host.sound("whoosh");
      c.a.reach = 66;
      dash(host, m, 480 + 60 * (c.p - 1), 1000, () => {
        if (c.p < 2) return finish(host, m, c.a, c.O);
        // phase 2+: skid, turn around and rush back
        m.dir = -m.dir;
        m.rig?.telegraph(0xff5a5a, 320);
        after(host, m, 320, () => {
          m.rig?.release("lunge");
          dash(host, m, 520 + 60 * (c.p - 1), 1000, () => finish(host, m, c.a, c.O));
        });
      });
    });
  },
  rocket(c) {
    const { host, m } = c;
    windup(c, 0xffa040, "ROCKET SHOT");
    const n = c.p;
    for (let i = 0; i < n; i++) {
      after(host, m, c.T + i * 480, () => {
        face(host, m);
        anim(host, m, "attack");
        m.rig?.release("lunge");
        host.sound("fire");
        const r = host.shot(m.spr.x + m.dir * 46, host.floorTop - 30, m.dir * 340, 0, { tint: 0xff8a30, w: 40, h: 20, frame: 1 });
        r.setFlipX(m.dir < 0);
        m.rig?.burst(m.spr.x + m.dir * 46, host.floorTop - 30, 5);
      });
    }
    after(host, m, c.T + n * 480 + 100, () => finish(host, m, c.a, c.O));
  },
  tornado(c) {
    const { host, m } = c;
    windup(c, 0xb48cff, "TORNADO");
    m.rig?.spin(1, c.T);
    after(host, m, c.T, () => {
      const ms = 1100 + 300 * (c.p - 1);
      m.rig?.release("cast");
      m.rig?.spin(Math.round(ms / 160), ms);
      host.sound("whoosh");
      c.a.reach = 70;
      const t0 = host.scene.time.now;
      const ev = host.scene.time.addEvent({
        delay: 40,
        loop: true,
        callback: () => {
          if (!alive(m)) return ev.remove();
          const b = body(m);
          face(host, m);
          b.setVelocityX(m.dir * 330);
          if (grounded(m) && Math.random() < 0.06) b.setVelocityY(-380);
          if (Math.random() < 0.3) m.rig?.dustBurst(1);
          if (host.scene.time.now - t0 > ms) {
            ev.remove();
            b.setVelocityX(0);
            if (c.p >= 3) {
              host.shot(m.spr.x, m.spr.y - 30, -220, -420, { tint: 0xb48cff, gravity: 900, w: 24, h: 24 });
              host.shot(m.spr.x, m.spr.y - 30, 220, -420, { tint: 0xb48cff, gravity: 900, w: 24, h: 24 });
            }
            m.rig?.dizzy(900);
            finish(host, m, c.a, c.O + 200);
          }
        },
      });
    });
  },
  stomp(c) {
    const { host, m } = c;
    const tx = clampX(host, host.target().x);
    windup(c, 0xffe066, "SKY STOMP");
    floorMark(host, tx, 0xffe066, c.T + 900, 110);
    after(host, m, c.T, () =>
      leapTo(host, m, tx, () => {
        groundWave(host, m.spr.x - 40, -1, 300, 0xffe066);
        groundWave(host, m.spr.x + 40, 1, 300, 0xffe066);
        finish(host, m, c.a, c.O);
      }),
    );
  },

  /* ---------- Fake Candy Cuboe ---------- */
  aeraste(c) {
    const { host, m } = c;
    const stompOnce = (left: number, done: () => void) => {
      const tx = clampX(host, host.target().x);
      windup(c, 0x7dff9a, left > 1 ? "AERASTE" : "AGAIN!", left > 1 ? c.T : Math.round(c.T * 0.75));
      floorMark(host, tx, 0x7dff9a, c.T + 900, 110);
      after(host, m, left > 1 ? c.T : Math.round(c.T * 0.75), () =>
        leapTo(host, m, tx, () => {
          groundWave(host, m.spr.x - 40, -1, 280, 0x7dff9a);
          groundWave(host, m.spr.x + 40, 1, 280, 0x7dff9a);
          done();
        }),
      );
    };
    // phase 3 stomps twice in a row
    if (c.p >= 3) stompOnce(2, () => after(host, m, 350, () => stompOnce(1, () => finish(host, m, c.a, c.O))));
    else stompOnce(2, () => finish(host, m, c.a, c.O));
  },
  laser(c) {
    const { host, m } = c;
    windup(c, 0x6ff0ff, "LASER SPIN");
    m.rig?.hover(50, c.T);
    const ring = (offset: number) => {
      const n = 6 + 2 * (c.p - 1);
      const cy = host.floorTop - 100;
      host.sound("zap");
      for (let i = 0; i < n; i++) {
        const ang = offset + (i * Math.PI * 2) / n;
        host.shot(m.spr.x + Math.cos(ang) * 30, cy + Math.sin(ang) * 30, Math.cos(ang) * 190, Math.sin(ang) * 190, { tint: 0x6ff0ff, w: 18, h: 18, life: 3000 });
      }
    };
    after(host, m, c.T, () => {
      m.rig?.release("cast");
      m.rig?.spin(1, 420);
      ring(0);
    });
    if (c.p >= 2) after(host, m, c.T + 480, () => ring(Math.PI / (6 + 2 * (c.p - 1))));
    after(host, m, c.T + (c.p >= 2 ? 800 : 400), () => {
      m.rig?.settle();
      finish(host, m, c.a, c.O);
    });
  },
  shield(c) {
    const { host, m } = c;
    windup(c, 0x7aa8ff, "SHIELD BASH");
    const sh = host.scene.add.rectangle(m.spr.x, m.spr.y, 16, 78, 0x7aa8ff, 0.7).setStrokeStyle(3, 0xe0f0ff).setDepth(6);
    const follow = host.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!alive(m)) {
          sh.destroy();
          return follow.remove();
        }
        sh.setPosition(m.spr.x + m.dir * 44, m.spr.y + 4);
      },
    });
    after(host, m, c.T, () => {
      m.rig?.release("lunge");
      host.sound("whoosh");
      c.a.reach = 68;
      dash(host, m, 440 + 40 * c.p, 950, () => {
        follow.remove();
        sh.destroy();
        host.shake(0.35);
        m.rig?.dizzy(1100);
        host.pop(m.spr.x, m.spr.y - 96, "DIZZY!");
        finish(host, m, c.a, c.O + 300);
      });
    });
  },
  beams(c) {
    const { host, m } = c;
    const y = host.floorTop - 30;
    const ms = c.T + 200;
    windup(c, 0xe0ffff, "JUMP!", ms);
    warnLine(host, 0, m.spr.x - 40, y, 0xe0ffff, ms);
    warnLine(host, m.spr.x + 40, host.worldW, y, 0xe0ffff, ms);
    after(host, m, ms, () => {
      m.rig?.release("cast");
      host.sound("zap");
      host.shake(0.3);
      const l = host.scene.add.rectangle((m.spr.x - 40) / 2, y, m.spr.x - 40, 22, 0x8ff8ff, 0.85).setDepth(7);
      const r = host.scene.add.rectangle((m.spr.x + 40 + host.worldW) / 2, y, host.worldW - m.spr.x - 40, 22, 0x8ff8ff, 0.85).setDepth(7);
      for (const b of [l, r]) {
        host.hazard(b);
        host.scene.tweens.add({ targets: b, scaleY: 0.2, alpha: 0, delay: 300, duration: 120, onComplete: () => b.destroy() });
      }
    });
    after(host, m, ms + 500, () => finish(host, m, c.a, c.O));
  },

  /* ---------- Candy Warlock ---------- */
  vine(c) {
    const { host, m } = c;
    windup(c, 0x7dff9a, "CANDY CORN VINES");
    m.rig?.hover(20, c.T);
    const wave = (shift: number, delay: number) => {
      const px = host.target().x;
      const n = 1 + c.p;
      const xs = Array.from({ length: n }, (_, i) => clampX(host, px + shift + (i - (n - 1) / 2) * 170));
      xs.forEach((x) => floorMark(host, x, 0x7dff9a, delay + c.T, 54));
      after(host, m, delay + c.T + 120, () => {
        host.sound("slam");
        for (const x of xs) {
          const v = host.scene.add.rectangle(x, host.floorTop, 34, 130, 0xffb347).setOrigin(0.5, 1).setStrokeStyle(4, 0x3fbf5f).setDepth(7);
          v.setScale(1, 0.05);
          host.scene.tweens.add({ targets: v, scaleY: 1, duration: 120, ease: "Back.easeOut" });
          host.hazard(v);
          host.scene.tweens.add({ targets: v, scaleY: 0, delay: 560, duration: 160, onComplete: () => v.destroy() });
          m.rig?.burst(x, host.floorTop - 10, 4);
        }
      });
    };
    after(host, m, c.T, () => m.rig?.release("cast"));
    wave(0, 0);
    if (c.p >= 3) wave(85, 700);
    after(host, m, c.T + (c.p >= 3 ? 1500 : 820), () => {
      m.rig?.settle();
      finish(host, m, c.a, c.O);
    });
  },
  whip(c) {
    const { host, m } = c;
    const side = host.target().x < m.spr.x ? 1 : -1; // appear on the near side, never on top of you
    const dest = clampX(host, host.target().x + side * 150);
    windup(c, 0xff3b5c, "LICORICE STRIKE", 300);
    floorMark(host, dest, 0xb48cff, c.T + 300, 90);
    c.a.reach = 0;
    after(host, m, 250, () => {
      m.rig?.fade(0, 180);
      host.sound("whoosh");
    });
    after(host, m, c.T + 300, () => {
      body(m).reset(dest, m.spr.y);
      face(host, m);
      m.rig?.fade(1, 160);
      m.rig?.burst(dest, host.floorTop - 50, 10);
      c.a.reach = 52;
      m.rig?.telegraph(0xff3b5c, 320);
    });
    const lash = (at: number, dirFlip: number) =>
      after(host, m, at, () => {
        const d = m.dir * dirFlip;
        m.rig?.release("lunge");
        host.sound("whoosh");
        const w = host.scene.add.rectangle(m.spr.x + d * 30, host.floorTop - 40, 190, 14, 0xd2143a).setOrigin(d > 0 ? 0 : 1, 0.5).setStrokeStyle(2, 0x5a0010).setDepth(7);
        w.setScale(0.05, 1);
        host.scene.tweens.add({ targets: w, scaleX: 1, duration: 110, ease: "Back.easeOut" });
        host.hazard(w);
        host.scene.tweens.add({ targets: w, scaleX: 0, delay: 260, duration: 120, onComplete: () => w.destroy() });
      });
    lash(c.T + 640, 1);
    if (c.p >= 2) lash(c.T + 1060, -1);
    after(host, m, c.T + (c.p >= 2 ? 1300 : 900), () => finish(host, m, c.a, c.O));
  },
  ray(c) {
    const { host, m } = c;
    const y = host.floorTop - 26;
    const ms = c.T + 150;
    windup(c, 0xff4dd8, "CANDY RAY - JUMP!", ms);
    const fire = (dir: number, at: number) => {
      const x1 = dir > 0 ? m.spr.x + 40 : 0;
      const x2 = dir > 0 ? host.worldW : m.spr.x - 40;
      warnLine(host, x1, x2, y, 0xff4dd8, at);
      after(host, m, at, () => {
        m.rig?.release("cast");
        host.sound("zap");
        host.shake(0.25);
        const r = host.scene.add.rectangle((x1 + x2) / 2, y, x2 - x1, 26, 0xff6ae0, 0.85).setStrokeStyle(2, 0xffffff).setDepth(7);
        host.hazard(r);
        host.scene.tweens.add({ targets: r, scaleY: 0.2, alpha: 0, delay: 330, duration: 120, onComplete: () => r.destroy() });
      });
    };
    fire(m.dir, ms);
    if (c.p >= 2) fire(-m.dir, ms + 650);
    if (c.p >= 3)
      after(host, m, ms + 1100, () => {
        for (let i = 0; i < 3; i++) host.shot(m.spr.x, host.floorTop - 130, m.dir * (160 + i * 50), -60 + i * 40, { tint: 0xff9ad0, w: 22, h: 22 });
      });
    // the crown flashes after a ray: a longer weak-point window
    after(host, m, ms + (c.p >= 2 ? 1200 : 560), () => finish(host, m, c.a, c.O + 250));
  },
  summon(c) {
    const { host, m } = c;
    windup(c, 0xb48cff, "CANDY MINIONS");
    const xs = [clampX(host, m.spr.x - 160), clampX(host, m.spr.x + 160)];
    xs.forEach((x) => floorMark(host, x, 0xb48cff, c.T, 80));
    after(host, m, c.T, () => {
      m.rig?.release("cast");
      host.sound("roar");
      for (const x of xs) {
        const portal = host.scene.add.ellipse(x, host.floorTop - 30, 20, 60, 0xb48cff, 0.8).setDepth(4.9);
        host.scene.tweens.add({ targets: portal, scaleX: 3, alpha: 0, duration: 450, onComplete: () => portal.destroy() });
        host.summon(x);
      }
    });
    after(host, m, c.T + 300, () => finish(host, m, c.a, c.O));
  },
  rain(c) {
    const { host, m } = c;
    windup(c, 0xffe066, "CANDY RAIN");
    const px = host.target().x;
    const gap = Phaser.Math.Between(-1, 1); // one safe lane near you
    const xs = [-2, -1, 0, 1, 2].filter((i) => i !== gap).map((i) => clampX(host, px + i * 110));
    xs.forEach((x) => floorMark(host, x, 0xffe066, c.T + 1300, 60));
    after(host, m, c.T, () => {
      m.rig?.release("cast");
      host.sound("fire");
      const top = host.scene.cameras.main.worldView.top + 10;
      const tints = [0xff4d7a, 0xffe066, 0x8be9ff, 0x7dff9a];
      xs.forEach((x, i) => host.shot(x, top, 0, 520, { tint: tints[i % tints.length], w: 28, h: 28, life: 2400 }));
    });
    after(host, m, c.T + 700, () => finish(host, m, c.a, c.O));
  },
};

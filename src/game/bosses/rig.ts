import * as Phaser from "phaser";

/**
 * Boss animation rig. The physics sprite stays the hitbox (invisible); this draws the boss
 * on top of it, anchored at its feet, so squash/stretch, bobbing and hops never move or
 * resize the physics body (which is what kept bosses standing on the floor).
 *
 * Everything is tweens + two tiny particle emitters on the shared 4px "px" texture,
 * so it stays cheap on phones.
 */
export class BossRig {
  readonly vis: Phaser.GameObjects.Sprite;
  private aura: Phaser.GameObjects.Ellipse;
  private shadow: Phaser.GameObjects.Ellipse;
  private weak: Phaser.GameObjects.Ellipse;
  private mark: Phaser.GameObjects.Text;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  /** tweened motion state */
  private m = { sx: 1, sy: 1, shake: 0, glow: 0 };
  /** position/visibility state, tweened separately so a wind-up never cancels a hover or fade */
  private f = { lift: 0, spin: 0, alpha: 1 };
  private glowColor = 0xffffff;
  private base: number;
  /** how far the frame bottom hangs under the body (display px) */
  private drop: number;
  private tintBase: number | undefined;
  /** cursed fakes: dark aura, floating cursed bits, glitch flicker */
  private cursed: { aura: Phaser.GameObjects.Ellipse; bits: Phaser.GameObjects.Particles.ParticleEmitter; nextGlitch: number; glitchUntil: number } | null = null;
  entering = false;
  dying = false;
  hidden = false;

  constructor(
    private scene: Phaser.Scene,
    private spr: Phaser.Physics.Arcade.Sprite,
    opts: { tint?: number; scale?: number; cursed?: boolean; drop?: number } = {},
  ) {
    this.base = opts.scale ?? 0.75;
    this.drop = opts.drop ?? 6;
    this.tintBase = opts.tint;
    spr.setVisible(false);
    this.shadow = scene.add.ellipse(spr.x, 0, 74, 14, 0x000000, 0.28).setDepth(4.8);
    this.aura = scene.add.ellipse(spr.x, 0, 120, 120, 0xffffff, 0).setDepth(4.9);
    this.weak = scene.add.ellipse(spr.x, 0, 96, 22, 0xffe066, 0).setDepth(4.85).setStrokeStyle(3, 0xfff4b0, 0);
    this.vis = scene.add.sprite(spr.x, spr.y, spr.texture.key, spr.frame.name).setOrigin(0.5, 1).setDepth(5);
    this.mark = scene.add
      .text(spr.x, 0, "!", { fontFamily: "Lilita One, Impact, sans-serif", fontSize: "44px", color: "#ffec5c", stroke: "#7a1010", strokeThickness: 7 })
      .setOrigin(0.5, 1)
      .setDepth(31)
      .setVisible(false);
    this.sparks = scene.add.particles(0, 0, "px", {
      lifespan: { min: 420, max: 820 },
      speed: { min: 120, max: 360 },
      angle: { min: 0, max: 360 },
      scale: { start: 3.2, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: 380,
      tint: [0xff4d7a, 0xffe066, 0x8be9ff, 0xb48cff, 0xffffff],
      emitting: false,
    });
    this.sparks.setDepth(29);
    if (opts.cursed) {
      const aura = scene.add.ellipse(spr.x, 0, 130, 120, 0x2a0a3a, 0.35).setDepth(4.75);
      scene.tweens.add({ targets: aura, scaleX: 1.12, scaleY: 1.08, alpha: 0.22, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      const bits = scene.add.particles(0, 0, "px", {
        frequency: 160,
        lifespan: { min: 900, max: 1500 },
        speedY: { min: -60, max: -25 },
        speedX: { min: -14, max: 14 },
        scale: { start: 1.8, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [0x9b5cff, 0x7dff3a, 0xff3ccf, 0x2a0a3a],
        emitZone: { type: "random", source: new Phaser.Geom.Rectangle(-38, -80, 76, 80), quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      });
      bits.setDepth(5.1);
      this.cursed = { aura, bits, nextGlitch: 0, glitchUntil: 0 };
    }
  }

  private feet() {
    const body = this.spr.body as Phaser.Physics.Arcade.Body | null;
    // frame bottom sits 8 source px (6 display px) under the body; the art's feet are at the body bottom
    return (body ? body.bottom : this.spr.y + 42) + this.drop;
  }

  /** Called every frame from the scene. */
  sync(now: number, s: { flash: boolean; open: boolean; busy: boolean; warn?: boolean }) {
    if (!this.spr.active && !this.dying) return;
    const v = this.vis;
    v.setTexture(this.spr.texture.key, this.spr.frame.name);
    v.setFlipX(this.spr.flipX);
    const feet = this.feet();
    const breathe = !s.busy && !this.entering && !this.dying ? Math.sin(now / 260) * 0.035 : 0;
    const bob = !s.busy && !this.entering && !this.dying ? Math.abs(Math.sin(now / 520)) * -3 : 0;
    const rot = this.spr.rotation + this.f.spin;
    if (rot !== 0) {
      // spinning moves pivot around the middle
      v.setOrigin(0.5, 0.5);
      v.setPosition(this.spr.x + this.m.shake, feet - 48 * this.m.sy + this.f.lift);
    } else {
      v.setOrigin(0.5, 1);
      v.setPosition(this.spr.x + this.m.shake, feet + this.f.lift + bob);
    }
    v.setRotation(rot);
    v.setScale(this.base * this.m.sx * (1 - breathe * 0.6), this.base * this.m.sy * (1 + breathe));
    v.setAlpha(this.f.alpha * (this.hidden ? 0 : 1));
    if (this.dying) {
      /* defeat() drives the tint */
    } else if (s.flash) v.setTintFill(0xffffff);
    else if (s.open) v.setTint(Math.floor(now / 90) % 2 ? 0xffe088 : 0xfff8d0);
    // Telegraph: the boss turns yellow while winding up (Admin Warlords "tell").
    else if (s.warn) v.setTint(0xffe066);
    else if (this.m.glow > 0.05) v.setTint(Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(this.tintBase ?? 0xffffff),
      Phaser.Display.Color.ValueToColor(this.glowColor),
      100,
      Math.round(this.m.glow * 70),
    ).color);
    else if (this.tintBase !== undefined) v.setTint(this.tintBase);
    else v.clearTint();
    // aura behind the boss while winding up
    this.aura.setPosition(v.x, feet - 46 + this.f.lift);
    this.aura.setFillStyle(this.glowColor, this.m.glow * 0.45);
    this.aura.setScale(1 + this.m.glow * 0.25 + Math.sin(now / 60) * 0.04 * this.m.glow);
    // ground shadow shrinks as the boss rises
    const h = Math.max(0, -this.f.lift) + Math.max(0, this.groundY() - (feet - 6));
    this.shadow.setPosition(this.spr.x, this.groundY());
    this.shadow.setScale(Math.max(0.35, 1 - h / 500)).setAlpha(this.hidden ? 0 : 1);
    // weak-point ring under the boss while it's open
    this.weak.setPosition(this.spr.x, this.groundY());
    this.weak.setFillStyle(0xffe066, s.open ? 0.35 + Math.sin(now / 70) * 0.15 : 0);
    this.weak.setStrokeStyle(3, 0xfff4b0, s.open ? 0.9 : 0);
    this.mark.setPosition(v.x, feet - 104 + this.f.lift);
    if (this.cursed) this.syncCursed(now, feet, s.flash || s.open);
  }

  /** Cursed fakes: aura + bits follow; every 1–2.5s a quick glitch (jitter, skew, colour split). */
  private syncCursed(now: number, feet: number, busyTint: boolean) {
    const c = this.cursed!;
    const v = this.vis;
    c.aura.setPosition(this.spr.x, feet - 44 + this.f.lift).setVisible(!this.hidden && !this.dying);
    c.bits.setPosition(this.spr.x, feet + this.f.lift);
    c.bits.emitting = !this.hidden && !this.dying;
    if (this.dying || this.entering) return;
    if (now > c.nextGlitch) {
      c.glitchUntil = now + 140;
      c.nextGlitch = now + 1000 + Math.random() * 1500;
    }
    if (now < c.glitchUntil) {
      const step = Math.floor(now / 35) % 2;
      v.x += step ? 4 : -3;
      v.setScale(v.scaleX * (step ? 1.08 : 0.94), v.scaleY);
      v.setAlpha(v.alpha * 0.8);
      if (!busyTint) v.setTint(step ? 0x6cfff0 : 0xff4fd8);
    }
  }

  /** floor line under the boss (for shadow + markers) */
  groundY() {
    return Number(this.spr.getData("floorTop") ?? this.feet());
  }

  private tw(props: Partial<typeof this.m>, duration: number, ease = "Sine.easeOut", yoyo = false, hold = 0) {
    return this.scene.tweens.add({ targets: this.m, ...props, duration, ease, yoyo, hold });
  }

  /** Wind-up before an attack: crouch (squash), glow in the attack's colour, shake, "!" overhead. */
  telegraph(color: number, ms: number) {
    this.glowColor = color;
    this.scene.tweens.killTweensOf(this.m);
    this.m.glow = 0;
    this.tw({ sx: 1.18, sy: 0.8, glow: 1 }, ms * 0.8, "Quad.easeOut");
    this.scene.tweens.add({ targets: this.m, shake: { from: -3, to: 3 }, duration: 50, yoyo: true, repeat: Math.max(1, Math.floor(ms / 100)) });
    this.mark.setVisible(true).setScale(0.4).setColor(Phaser.Display.Color.IntegerToColor(color).rgba);
    this.scene.tweens.add({ targets: this.mark, scale: 1, duration: 160, ease: "Back.easeOut" });
    this.scene.time.delayedCall(ms, () => {
      this.mark.setVisible(false);
      this.m.shake = 0;
    });
  }

  /** Release: stretch out of the crouch and let the glow fade. */
  release(kind: "lunge" | "leap" | "cast" | "slam" = "lunge") {
    this.scene.tweens.killTweensOf(this.m);
    this.m.shake = 0;
    const pose = { leap: [0.82, 1.25], cast: [0.9, 1.18], slam: [1.3, 0.72], lunge: [1.22, 0.9] }[kind];
    this.m.sx = pose[0]!;
    this.m.sy = pose[1]!;
    this.tw({ sx: 1, sy: 1, glow: 0 }, 320, "Back.easeOut");
  }

  /** Landing thud: squash + dust + optional shake handled by caller. */
  land() {
    this.m.sx = 1.3;
    this.m.sy = 0.72;
    this.tw({ sx: 1, sy: 1 }, 260, "Back.easeOut");
    this.dustBurst(10);
  }

  dustBurst(n = 8) {
    this.sparks.setParticleTint(0xf3e2c4);
    this.sparks.explode(n, this.spr.x, this.groundY() - 4);
  }

  /** Coloured burst at a point (used for attacks and hits). */
  burst(x: number, y: number, n = 10) {
    this.sparks.explode(n, x, y);
  }

  /** Spin the drawing (tornado / laser spin). */
  spin(turns: number, ms: number) {
    this.f.spin = 0;
    this.scene.tweens.add({ targets: this.f, spin: Math.PI * 2 * turns, duration: ms, ease: "Linear", onComplete: () => (this.f.spin = 0) });
  }

  /** Float the drawing up (hover casts); body stays planted. */
  hover(px: number, ms: number) {
    this.scene.tweens.add({ targets: this.f, lift: -px, duration: ms, ease: "Sine.easeOut" });
  }

  settle(ms = 220) {
    this.scene.tweens.add({ targets: this.f, lift: 0, duration: ms, ease: "Bounce.easeOut" });
  }

  /** Fade out / in (teleport). */
  fade(to: number, ms: number) {
    this.scene.tweens.add({ targets: this.f, alpha: to, duration: ms });
  }

  /** Took a hit: knocked back a little, squashed, sparks. */
  flinch(dir: number) {
    this.m.shake = dir * 10;
    this.m.sx = 0.82;
    this.m.sy = 1.12;
    this.tw({ shake: 0, sx: 1, sy: 1 }, 260, "Back.easeOut");
    this.burst(this.spr.x, this.feet() - 50, 8);
  }

  /** Dizzy stars over the head (long weak-point window after a bash). */
  dizzy(ms: number) {
    const y = this.feet() - 100;
    for (let i = 0; i < 3; i++) {
      const star = this.scene.add.star(this.spr.x, y, 5, 5, 11, 0xffe066).setDepth(31);
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: ms,
        onUpdate: (tw) => {
          const a = (tw.getValue() ?? 0) * Math.PI * 4 + (i * Math.PI * 2) / 3;
          star.setPosition(this.spr.x + Math.cos(a) * 34, this.feet() - 100 + Math.sin(a) * 8);
        },
        onComplete: () => star.destroy(),
      });
    }
  }

  /** New phase: white flash, expanding ring, quick grow pulse. */
  phaseUp(color: number) {
    const ring = this.scene.add.circle(this.spr.x, this.feet() - 48, 40, color, 0).setStrokeStyle(8, color, 1).setDepth(28);
    this.scene.tweens.add({ targets: ring, scale: 6, alpha: 0, duration: 650, ease: "Cubic.easeOut", onComplete: () => ring.destroy() });
    this.m.sx = 1.35;
    this.m.sy = 1.35;
    this.tw({ sx: 1, sy: 1 }, 500, "Elastic.easeOut");
    this.glowColor = color;
    this.m.glow = 1;
    this.tw({ glow: 0 }, 900);
    this.sparks.setParticleTint(color);
    this.burst(this.spr.x, this.feet() - 48, 26);
  }

  /** Entrance: drop in from above the screen and land with a thud. */
  entrance(onLand: () => void) {
    this.entering = true;
    this.f.lift = -620;
    this.m.sx = 0.85;
    this.m.sy = 1.2;
    this.scene.tweens.add({
      targets: this.f,
      lift: 0,
      duration: 620,
      delay: 250,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.land();
        this.dustBurst(18);
        this.entering = false;
        onLand();
      },
    });
  }

  /** Defeat: flash + shake, pop upward, then burst into confetti. */
  defeat(onDone: () => void) {
    this.dying = true;
    this.scene.tweens.killTweensOf(this.m);
    this.scene.tweens.killTweensOf(this.f);
    this.f.alpha = 1;
    this.mark.setVisible(false);
    this.weak.setVisible(false);
    this.scene.tweens.add({ targets: this.m, shake: { from: -8, to: 8 }, duration: 45, yoyo: true, repeat: 7 });
    let n = 0;
    const flick = this.scene.time.addEvent({
      delay: 90,
      repeat: 8,
      callback: () => {
        n++;
        if (n % 2) this.vis.setTintFill(0xffffff);
        else this.vis.clearTint();
        this.burst(this.spr.x + Phaser.Math.Between(-40, 40), this.feet() - Phaser.Math.Between(20, 90), 6);
      },
    });
    this.scene.time.delayedCall(820, () => {
      flick.remove();
      this.scene.tweens.add({ targets: this.m, sx: 1.6, sy: 1.6, duration: 360, ease: "Cubic.easeOut" });
      this.scene.tweens.add({ targets: this.f, lift: -60, alpha: 0, spin: 1.2, duration: 360, ease: "Cubic.easeOut" });
      this.sparks.setParticleTint(0xffffff);
      this.sparks.setConfig({
        lifespan: { min: 500, max: 1100 },
        speed: { min: 160, max: 520 },
        angle: { min: 0, max: 360 },
        scale: { start: 4, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 420,
        tint: [0xff4d7a, 0xffe066, 0x8be9ff, 0xb48cff, 0x7dff9a],
        emitting: false,
      });
      this.burst(this.spr.x, this.feet() - 48, 60);
      const ring = this.scene.add.circle(this.spr.x, this.feet() - 48, 30, 0xffffff, 0.9).setDepth(28);
      this.scene.tweens.add({ targets: ring, scale: 7, alpha: 0, duration: 520, onComplete: () => ring.destroy() });
    });
    this.scene.time.delayedCall(1500, onDone);
  }

  destroy() {
    for (const o of [this.vis, this.aura, this.shadow, this.weak, this.mark, this.sparks]) o.destroy();
    if (this.cursed) {
      this.cursed.aura.destroy();
      this.cursed.bits.destroy();
    }
  }
}

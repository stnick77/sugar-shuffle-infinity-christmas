/**
 * Draws equipped 'Tis the Seasones cosmetics on a hero sprite.
 * Created only when the DLC is on and something is equipped.
 */
import * as Phaser from "phaser";
import type { HeroKey } from "./logic";

export const XMAS_COS = "xmas-cos";
export const XMAS_PK = "xmas-pk";
export const HAYDEN_COS = "hayden-cos";

export function preloadXmas(scene: Phaser.Scene) {
  const sheet = (k: string, path: string) => {
    if (!scene.textures.exists(k)) scene.load.spritesheet(k, path, { frameWidth: 128, frameHeight: 128 });
  };
  sheet(XMAS_COS, "/game/sprites/xmas-cosmetics.png");
  sheet(XMAS_PK, "/game/sprites/xmas-pickups.png");
  sheet(HAYDEN_COS, "/game/sprites/hayden-cosmetics.png");
}

type Part = { img: Phaser.GameObjects.Image; dx: number; dy: number; tilt?: boolean };

/** Offsets are for the 64px display size PlayScene uses for heroes. */
const FIT: Record<HeroKey, Record<string, { frame: number; dx: number; dy: number; w: number; depth: number; sheet?: "xmas" | "hayden" }>> = {
  cuboe: {
    "santa-hat": { frame: 0, dx: 2, dy: -24, w: 40, depth: 7 },
  },
  // Cubro wears his attack-animation look everywhere now: small cube head, slim body, little board.
  cubro: {
    "xmas-sweater": { frame: 2, dx: -1, dy: 6, w: 20, depth: 7 },
    "xmas-skateboard": { frame: 1, dx: 1, dy: 23, w: 32, depth: 7 },
  },
  "candy-cube": {
    "elf-costume": { frame: 0, dx: 2, dy: -26, w: 42, depth: 7, sheet: "hayden" },
  },
};

export class CosmeticRig {
  private parts: Part[] = [];
  private orbit: Phaser.GameObjects.Image[] = [];
  private snow?: Phaser.GameObjects.Particles.ParticleEmitter;
  private t = 0;

  constructor(
    private scene: Phaser.Scene,
    private target: Phaser.GameObjects.Sprite,
    hero: HeroKey,
    ids: string[],
  ) {
    for (const id of ids) {
      const fit = FIT[hero][id];
      if (fit) {
        const tex = fit.sheet === "hayden" ? HAYDEN_COS : XMAS_COS;
        const img = scene.add.image(target.x, target.y, tex, fit.frame).setDepth(fit.depth);
        img.setDisplaySize(fit.w, fit.w * (fit.frame === 1 ? 0.42 : 1));
        if (fit.frame === 0) img.setDisplaySize(fit.w, fit.w * 0.72);
        this.parts.push({ img, dx: fit.dx, dy: fit.dy, tilt: id === "santa-hat" });
      }
      if (id === "present-aura" || id === "snowflake-aura" || id === "candle-aura") {
        const frame = id === "present-aura" ? 0 : 3;
        if (id === "candle-aura") {
          this.snow = scene.add.particles(0, 0, "px", {
            lifespan: 800,
            speed: { min: 8, max: 28 },
            scale: { start: 1.8, end: 0 },
            alpha: { start: 0.85, end: 0 },
            tint: [0xffe08a, 0xff9a3a, 0xff5a2a, 0xfff4d0],
            frequency: 70,
            gravityY: -40,
            emitZone: { type: "random", source: new Phaser.Geom.Circle(0, 0, 38) } as never,
          });
          this.snow.setDepth(5);
          this.snow.startFollow(target);
          continue;
        }
        for (let i = 0; i < 4; i++) {
          this.orbit.push(scene.add.image(target.x, target.y, XMAS_PK, frame).setDisplaySize(18, 18).setAlpha(0.9));
        }
        if (id === "snowflake-aura") {
          this.snow = scene.add.particles(0, 0, XMAS_PK, {
            frame: 3,
            lifespan: 900,
            speedY: { min: 10, max: 40 },
            speedX: { min: -30, max: 30 },
            scale: { start: 0.09, end: 0 },
            alpha: { start: 0.8, end: 0 },
            frequency: 120,
            emitZone: { type: "random", source: new Phaser.Geom.Circle(0, 0, 36) } as never,
          });
          this.snow.setDepth(5);
          this.snow.startFollow(target);
        } else {
          this.snow = scene.add.particles(0, 0, "px", {
            lifespan: 700,
            speed: { min: 6, max: 20 },
            scale: { start: 1.4, end: 0 },
            alpha: { start: 0.7, end: 0 },
            tint: [0xffd75e, 0xff4d7a, 0x3ecf8e],
            frequency: 90,
            emitZone: { type: "random", source: new Phaser.Geom.Circle(0, 0, 40) } as never,
          });
          this.snow.setDepth(5);
          this.snow.startFollow(target);
        }
      }
    }
  }

  get empty() {
    return this.parts.length === 0 && this.orbit.length === 0;
  }

  update(dt: number, facing: number, airborne: boolean) {
    this.t += dt;
    const { x, y } = this.target;
    for (const p of this.parts) {
      p.img.setPosition(x + p.dx * facing, y + p.dy);
      p.img.setFlipX(facing < 0);
      p.img.setVisible(this.target.visible);
      if (p.tilt) p.img.setRotation((airborne ? -0.25 : Math.sin(this.t * 3) * 0.05) * facing);
    }
    const n = this.orbit.length;
    this.orbit.forEach((o, i) => {
      const a = this.t * 2.2 + (i / n) * Math.PI * 2;
      const s = Math.sin(a);
      o.setPosition(x + Math.cos(a) * 44, y + s * 14 - 4);
      o.setDepth(s > 0 ? 7 : 5);
      o.setScale(o.scaleX > 0 ? Math.abs(o.scaleX) : o.scaleX);
      o.setAlpha(s > 0 ? 0.95 : 0.6);
      o.setVisible(this.target.visible);
    });
  }

  destroy() {
    this.parts.forEach((p) => p.img.destroy());
    this.orbit.forEach((o) => o.destroy());
    this.snow?.destroy();
    this.parts = [];
    this.orbit = [];
  }
}

import * as Phaser from "phaser";
import { TILE } from "../config";
import { ARCADE_OVERLAP_BIAS, MAX_FALL_SPEED, canEnterDoor, capFallSpeed, landingFloorTop, shouldLandOnFloor, type Aabb } from "../physics/floors";
import { LEVELS, eachCell, hubIdFor, worldSize, type LevelDef } from "../data/levels";
import { BOSSES, FLOORS, HEROES, rankFromScore, type HeroId } from "../data/world";
import { ADMIN_BOSS_ID, ADMIN_PHASE_HP, usesCuboeKit } from "../hayden/content";
import { ADMIN_POWERS, freezeSpeedMul, inFreeze, nextAdminPhase, patternAt, powerAt, powerDue, teleportTarget, type AdminPhase, type AdminPowerId } from "../bosses/adminWarlords";
import { emitGame } from "../bus";
import { bootInput, pollGamepad, readActions, readActionsP2, setCoopInput, setInjected } from "../input";
import { setLevelSong, sfx } from "../audio";
import { themeFor } from "../data/levelThemes";
import { useGame } from "@/store/game-store";
import { ssi } from "../runtime";
// 'Tis the Seasones DLC — everything below is gated on xmasOn() / house rooms.
import { COLLECTABLES, activeCosmetics, collect, collectableForCandy, type CollectableKind } from "../dlc/logic";
import { setXmas, xmas, xmasOn } from "../dlc/state";
import { CosmeticRig, XMAS_PK, preloadXmas } from "../dlc/cosmetics";
import { HOUSE_LEVELS, drawHouseRoom, houseSpawn, isHouseLevel } from "../dlc/house";
import { setMusicArea } from "../dlc/xmasMusic";
import { BossRig } from "../bosses/rig";
import { tickBrain, type BossHost, type BossMob } from "../bosses/brain";
import { BOSS_FORMS, phaseFor } from "../bosses/moves";
// Floor 470539758, the Backrooms (secret floor under the Floor 5 boss door)
import {
  BACKROOMS_BOSS,
  BACKROOMS_ESCAPE,
  BACKROOMS_HEAVEN,
  CHASE,
  CHASE_WORDS,
  CHASE_CHECKPOINTS,
  GLITCH_FLICKER_MS,
  glitchAmbientRate,
  glitchBurst,
  glitchConstant,
  glitchLevel,
  chaseCheckpoint,
  TRAPPED_ENDING,
  caught,
  escapeRewards,
  stepChaser,
  BACKROOMS_ENEMIES,
  BACKROOMS_HUB,
  BACKROOMS_LORE,
  BACKROOMS_NAME,
  ENEMY_CHARS,
  ENEMY_INFO,
  discovered,
  enterBackrooms,
  floorDef,
  isBackroomsRoom,
  shouldNoclip,
  redHubLevel,
  redHubWatchers,
  redHubWords,
} from "../backrooms/backrooms";

type Partner = {
  spr: Phaser.Physics.Arcade.Sprite;
  hero: HeroId;
  facing: number;
  coyote: number;
  jumpBuf: number;
  attackT: number;
  dropT: number;
};

/** Candy bux paid for clearing a room, by rank. */
/** Floor gaps this wide or narrower are real pits; wider ones keep a walkable trench floor. */
const PIT_MAX_TILES = 4;

/** Texture key for a background image path (one texture per picture). */
function bgKeyFor(path: string) {
  return `bg:${path}`;
}

/** Ending thresholds (see escapePumpkin). */
const GOOD_ESCAPE_SECONDS = 90;
const OMEGA_BURST_KILLS = 40;

/** Boss sprite centre sits this far above its feet (96px display, body bottom at 120/128 of the frame). */
const BOSS_FEET = 42;

/** Choco Man's wind-up glow, per move. */
const CHOCO_TELL: Record<string, number> = {
  hadoken: 0x6ff0ff,
  shoryuken: 0xff8a3a,
  tatsu: 0xb48cff,
  jump: 0xffe066,
  rush: 0xff5a5a,
};

const CLEAR_BUX: Record<string, number> = { P: 250, S: 200, A: 175, B: 150, C: 125, D: 100, F: 75 };

type Mob = BossMob;

/** Colour of each boss's phase-change burst. */
const BOSS_COLOR: Record<string, number> = {
  "f1-boss": 0xc87a3a,
  "f2-boss": 0xff7ab8,
  "f3-boss": 0xff5a5a,
  "f4-boss": 0x6ff0ff,
  "f5-boss": 0xb48cff,
  "admin-warlords": 0x9a5cff,
  "br-boss": 0xfff2a0,
};

/** Bacteria is drawn tall (rig scale), on the standard 96px boss hitbox. */
const BACTERIA_SCALE = 1.25;

type Mover = { img: Phaser.Physics.Arcade.Image; x0: number; y0: number; axis: "x" | "y"; amp: number; period: number };
type Stalactite = { x: number; top: number; floor: number; tri: Phaser.GameObjects.Triangle | null; state: "hang" | "shake" | "fall" | "gone"; until: number; vy: number };

export class PlayScene extends Phaser.Scene {
  private levelId = "hub-1";
  private level!: LevelDef;
  private player!: Phaser.Physics.Arcade.Sprite;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private oneWay!: Phaser.Physics.Arcade.StaticGroup;
  private mobs: Mob[] = [];
  /** Boss attack shapes (vines, rays, beams…) that hurt a hero touching them while they exist. */
  private hazards: Phaser.GameObjects.Shape[] = [];
  private bossHost: BossHost | null = null;
  private pickups!: Phaser.Physics.Arcade.Group;
  private shots!: Phaser.Physics.Arcade.Group;
  private facing = 1;
  private coyote = 0;
  private jumpBuf = 0;
  private attackT = 0;
  private hurtT = 0;
  private shieldT = 0;
  private mach = 0;
  private comboT = 0;
  private pizza = false;
  private timer = 0;
  private goal: "exit" | "start" = "exit";
  private spawn = { x: 80, y: 80 };
  private exitPt = { x: 200, y: 80 };
  private interactives: { kind: string; id: string; x: number; y: number; label?: string }[] = [];
  private frozen = false;
  private trauma = 0;
  private secrets = 0;
  private blocked = 0;
  private incoming = 0;
  private metroidHit = false;
  private label = "";
  private prompt = "";
  private hero: HeroId = "cuboe";
  private score = 0;
  private combo = 0;
  private hp = 6;
  private maxHp = 6;
  private lives = 6;
  private damaged = false;
  private burstT = 0;
  private meter = 0;
  private dropT = 0;
  private holeT = 0;
  private invulnT = 0;
  private speedT = 0;
  /** Admin Warlords "Freeze": seconds left of the 30% slow. */
  private freezeT = 0;
  /** Admin power warning markers / glitch static, cleared on phase change and defeat. */
  private adminFx: Phaser.GameObjects.GameObject[] = [];
  private kills = 0;
  private startMark?: Phaser.GameObjects.Text;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  // DLC
  private homeFrom: string | undefined;
  private isHouse = false;
  private partner: Partner | null = null;
  private rigs: { rig: CosmeticRig; spr: () => Phaser.GameObjects.Sprite | null; facing: () => number }[] = [];
  private camTarget: Phaser.GameObjects.Zone | null = null;
  private darkness: Phaser.GameObjects.Rectangle | undefined;
  // Floor 470539758 room features
  private movers: Mover[] = [];
  private moverGroup: Phaser.Physics.Arcade.Group | null = null;
  private stalactites: Stalactite[] = [];
  private caveDark: Phaser.GameObjects.Image | null = null;
  private noclipping = false;
  private moversWired = false;
  // the escape chase after Bacteria, and its jumpscare
  private chaser: Phaser.GameObjects.Sprite | null = null;
  private chaserGlow: Phaser.GameObjects.Ellipse | null = null;
  private chaseWait = 0;
  private scaring = false;
  private catches = 0;
  private chaseBest = 0;
  // the hero's damage glitch (Floor 470539758 only)
  private glitchFx: { ghosts: Phaser.GameObjects.Sprite[]; slices: Phaser.GameObjects.Sprite[] } | null = null;
  private glitchUntil = 0;
  private glitchSplit = 0;
  private glitchSlices = 0;
  private glitchFlickAt = 0;
  private glitchNextAmbient = 0;

  constructor() {
    super("play");
  }

  init(data: { levelId?: string; from?: string }) {
    const floor = useGame.getState().save.floor;
    const start = ssi().startLevel;
    ssi().startLevel = undefined;
    let id = data.levelId ?? start ?? hubIdFor(floor);
    this.homeFrom = data.from;
    this.isHouse = isHouseLevel(id);
    this.partner = null;
    this.rigs = [];
    this.camTarget = null;
    this.darkness = undefined;
    this.movers = [];
    this.moverGroup = null;
    this.stalactites = [];
    this.caveDark = null;
    this.noclipping = false;
    this.moversWired = false;
    this.chaser = null;
    this.chaserGlow = null;
    this.chaseWait = 0;
    this.scaring = false;
    this.catches = 0;
    this.chaseBest = 0;
    this.glitchFx = null;
    this.glitchUntil = 0;
    this.glitchNextAmbient = 0;
    if (id === "hub") id = hubIdFor(floor);
    this.levelId = id;
    this.mobs = [];
    this.hazards = [];
    this.freezeT = 0;
    this.adminFx = [];
    this.bossHost = null;
    this.interactives = [];
    this.pizza = false;
    this.goal = "exit";
    this.frozen = false;
    this.trauma = 0;
    this.combo = 0;
    this.comboT = 0;
    this.attackT = 0;
    this.hurtT = 0;
    this.shieldT = 0;
    this.mach = 0;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.secrets = 0;
    this.blocked = 0;
    this.incoming = 0;
    this.metroidHit = false;
    this.damaged = false;
    this.burstT = 0;
    this.dropT = 0;
    this.holeT = 0;
    this.invulnT = 0;
    this.speedT = 0;
    this.kills = 0;
    this.prompt = "";
    this.startMark = undefined;
  }

  preload() {
    const s = (k: string, path: string) => {
      if (!this.textures.exists(k)) this.load.image(k, path);
    };
    const sheet = (k: string, path: string) => {
      if (!this.textures.exists(k)) this.load.spritesheet(k, path, { frameWidth: 128, frameHeight: 128 });
    };
    // Only this room's background: every room has its own picture now, so load it on demand.
    const room = LEVELS[this.levelId] ?? HOUSE_LEVELS[this.levelId] ?? LEVELS["hub-1"]!;
    s(bgKeyFor(room.bg), room.bg);
    s("ground-candy", "/game/sprites/ground-candy.png");
    s("ground-marsh", "/game/sprites/ground-marsh.png");
    for (const h of ["cuboe", "cubro", "candy-cube"] as const) {
      for (const a of ["idle", "run", "jump", "attack"] as const) sheet(`${h}-${a}`, `/game/sprites/${h}-${a}.png`);
    }
    sheet("boxguy", "/game/sprites/boxguy.png");
    sheet("nincube", "/game/sprites/nincube.png");
    sheet("pump", "/game/sprites/pump.png");
    sheet("choco", "/game/sprites/choco.png");
    sheet("outlaw", "/game/sprites/outlaw.png");
    sheet("warlock", "/game/sprites/warlock.png");
    // Admin Warlords: one 2x2 idle sheet per phase, same 128px frame layout as the other bosses
    // (drawn by scripts/art/make-admin-warlords.py).
    sheet("warlord-1", "/game/sprites/warlord-1.png");
    sheet("warlord-2", "/game/sprites/warlord-2.png");
    sheet("warlord-3", "/game/sprites/warlord-3.png");
    s("admin-orb", "/game/sprites/admin-orb.png");
    sheet("pickups", "/game/sprites/pickups.png");
    s("door-room", "/game/sprites/door-room.png");
    s("door-boss", "/game/sprites/door-boss.png");
    // Per-level tiles (2 frames: surface, fill) and, in a hub, each room's own door.
    const theme = themeFor(room.id);
    if (theme && !this.textures.exists(theme.tiles)) {
      this.load.spritesheet(theme.tiles, `/game/sprites/tiles/${theme.tiles}.png`, { frameWidth: 96, frameHeight: 96 });
    }
    if (room.isHub && !this.isHouse) {
      const f = floorDef(useGame.getState().save.floor);
      const ids = f ? [...f.levels.map((l) => l.id), f.boss.id, ...(f.id === 5 ? ["final-run"] : [])] : [];
      for (const id of ids) {
        const door = themeFor(id)?.door;
        if (door) s(door, `/game/sprites/doors/${door}.png`);
      }
      // the "Floor 470539758" tear (in the Floor 5 hub, once found)
      s("door-br-noclip", "/game/sprites/doors/door-br-noclip.png");
    }
    for (const kind of BACKROOMS_ENEMIES[room.id] ?? []) sheet(kind, `/game/sprites/${kind}.png`);
    if (room.chase || room.heaven) {
      // the escape's own door (red EXIT at the end of the hall / the white ESCAPE door)
      const door = themeFor(room.id)?.door;
      if (door) s(door, `/game/sprites/doors/${door}.png`);
    }
    if (room.bossId === BACKROOMS_BOSS || room.id === BACKROOMS_HUB || room.chase) {
      // the hub uses Bacteria's silhouette for the watcher in the hallways
      sheet("bacteria", "/game/sprites/bacteria.png");
      sheet("bacteria-void", "/game/sprites/bacteria-void.png");
    }
    if (room.bossId === "f3-boss" || room.bossId === "f4-boss") {
      // cursed Fake Candy Cuboe / Cubro (own sheets, same frame layout as the heroes)
      for (const h of ["cuboe", "cubro"] as const) {
        for (const a of ["idle", "run", "jump", "attack"] as const) sheet(`fake-${h}-${a}`, `/game/sprites/fake-${h}-${a}.png`);
      }
    }
    sheet("props", "/game/sprites/props.png");
    if (xmasOn() || this.isHouse) preloadXmas(this);
  }

  create() {
    try {
      this.bootWorld();
    } catch (err) {
      console.error(err);
      this.frozen = true;
      emitGame({ t: "toast", text: "Couldn't load that room" });
      emitGame({ t: "ready" });
    }
  }

  private bootWorld() {
    this.holdWorld(false);
    bootInput();
    this.hero = useGame.getState().save.hero;
    const def = HEROES[this.hero];
    this.maxHp = def.hp ?? def.lives;
    this.hp = this.maxHp;
    this.lives = useGame.getState().hud.lives || def.lives;
    this.score = 0;
    this.meter = 20;

    this.level = LEVELS[this.levelId] ?? HOUSE_LEVELS[this.levelId] ?? LEVELS["hub-1"]!;
    setMusicArea(this.isHouse ? "home" : this.level.isBoss ? "boss" : this.level.isHub ? "hub" : "level");
    // each level has its own original track (hubs and the house keep the shared loop)
    setLevelSong(this.isHouse || (this.level.isHub && !this.level.themed) ? null : (themeFor(this.level.id)?.song ?? null));
    this.label = this.level.name;
    const { w, h } = worldSize(this.level);
    const open = !this.level.isHub && !this.level.isBoss;
    // Rooms have an extra row below the camera so short gaps can be fallen through.
    this.physics.world.setBounds(0, 0, w, open ? h + TILE : h);
    this.physics.world.setBoundsCollision(true, true, true, !open);
    // Fast falls are handled by the fall-speed cap, fixed-step physics and the post-step swept
    // snap. Keep Arcade's overlap bias small: a tile-sized bias turned side hits into vertical
    // hits and pushed the hero down through the floor (see ARCADE_OVERLAP_BIAS).
    this.physics.world.OVERLAP_BIAS = ARCADE_OVERLAP_BIAS;

    if (!this.textures.exists("px")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture("px", 4, 4);
      g.destroy();
    }

    const bgKey = this.bgKey();
    const bg = this.add.image(0, 0, bgKey).setOrigin(0, 0).setDepth(-8);
    if (this.level.bgSpan) {
      // show the whole picture once across the room (it is composed for this room's size)
      const fx = this.level.isHub ? 0.12 : 0.22;
      const camW = this.scale.width;
      const dw = camW + fx * Math.max(0, w - camW) + 24;
      if (this.level.isHub) bg.setScrollFactor(fx, 0).setDisplaySize(dw, Math.max(h, 720));
      else bg.setScrollFactor(fx, 0.08).setDisplaySize(dw, h + 80);
    } else if (this.level.isHub) {
      bg.setScrollFactor(0.12, 0).setDisplaySize(Math.max(w, 1600), Math.max(h, 720));
    } else {
      bg.setScrollFactor(0.22, 0.08).setDisplaySize(Math.max(w, 1600), h + 80);
    }
    if (this.level.tint) bg.setTint(this.level.tint);

    this.solids = this.physics.add.staticGroup();
    this.oneWay = this.physics.add.staticGroup();
    this.pickups = this.physics.add.group();
    this.shots = this.physics.add.group();

    this.dust = this.add.particles(0, 0, "px", {
      lifespan: 320,
      speed: { min: 30, max: 110 },
      scale: { start: 2.4, end: 0 },
      alpha: { start: 0.7, end: 0 },
      emitting: false,
      gravityY: 240,
    });
    this.dust.setDepth(5);

    this.makeAnims();
    if (this.isHouse) {
      const { things, darkness } = drawHouseRoom(this, this.levelId);
      this.interactives.push(...things);
      this.darkness = darkness;
    }
    this.buildMap();
    if (this.isHouse) this.spawn = houseSpawn(this.levelId, this.homeFrom);
    this.spawnPlayer();
    this.bootXmas();

    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.player, this.oneWay, undefined, (_p, plat) =>
      this.oneWayLand(this.player.body as Phaser.Physics.Arcade.Body, plat as Phaser.Physics.Arcade.Sprite, this.dropT > 0),
    );
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.snapToFloors, this);
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.snapToFloors, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.snapToFloors, this);
    });
    this.physics.add.overlap(this.player, this.pickups, (_p, pk) => this.grab(pk as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.player, this.shots, (_p, sh) => {
      const s = sh as Phaser.Physics.Arcade.Sprite;
      if (s.getData("friendly")) return;
      s.destroy();
      this.incoming++;
      if (this.shieldT > 0 || this.invulnT > 0) {
        this.blocked++;
        sfx.land();
        return;
      }
      this.hurt(1);
    });

    const cam = this.cameras.main;
    cam.startFollow(this.camTarget ?? this.player, true, 0.14, 0.1);
    cam.setBounds(0, 0, w, Math.max(h, 720));
    cam.setDeadzone(140, 64);
    cam.fadeIn(250, 20, 12, 8);

    this.events.once("shutdown", () => {
      this.mobs.length = 0;
      this.rigs.forEach((r) => r.rig.destroy());
      this.rigs = [];
    });

    emitGame({ t: "ready" });
    this.pushHud();
    this.wireControlsTest();
  }

  /* ---------------- Floor 470539758 (the Backrooms) ---------------- */

  private brTiles() {
    const t = themeFor(this.level.id)?.tiles;
    return t && this.textures.exists(t) ? t : null;
  }

  /** Motion: a conveyor floor tile. Solid, and pushes whoever stands on it. */
  private conveyor(tx: number, ty: number, dir: number) {
    this.tileSpr(tx, ty, false);
    const x = tx * TILE + TILE / 2;
    const y = ty * TILE + 8;
    const g = this.add.graphics().setDepth(1.5);
    g.fillStyle(0xffe066, 0.9).lineStyle(2, 0x2a2010, 1);
    for (const off of [-12, 4]) {
      const cx = x + off * dir;
      g.fillTriangle(cx - 6 * dir, y - 4, cx + 6 * dir, y, cx - 6 * dir, y + 4);
      g.strokeTriangle(cx - 6 * dir, y - 4, cx + 6 * dir, y, cx - 6 * dir, y + 4);
    }
    this.tweens.add({ targets: g, x: 6 * dir, duration: 380, repeat: -1, ease: "Linear" });
  }

  /** Motion: a 2-tile platform that slides side to side (~) or rides up and down (^). */
  private addMover(tx: number, ty: number, axis: "x" | "y") {
    if (!this.moverGroup) {
      this.moverGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    }
    const x0 = tx * TILE + TILE;
    const y0 = ty * TILE + 12;
    const tiles = this.brTiles();
    const img = (tiles ? this.physics.add.image(x0, y0, tiles, 0) : this.physics.add.image(x0, y0, "px")).setDisplaySize(TILE * 2, 24).setDepth(1.6);
    this.moverGroup.add(img);
    const body = img.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.pushable = false;
    // a little yellow lamp strip so it reads as "this one moves"
    const lamp = this.add.rectangle(x0, y0 + 10, TILE * 2 - 10, 3, 0xffe066, 0.9).setDepth(1.7);
    img.setData("lamp", lamp);
    this.movers.push({ img, x0, y0, axis, amp: axis === "x" ? TILE : TILE * 3, period: axis === "x" ? 2600 : 3400 });
  }

  private water(tx: number, ty: number) {
    const x = tx * TILE + TILE / 2;
    const y = ty * TILE + TILE / 2;
    this.add.rectangle(x, y, TILE + 1, TILE + 1, 0x5fc4e8, 0.42).setDepth(6.5);
    const above = this.level.rows[ty - 1]?.[tx] ?? ".";
    if (above !== "w") {
      const wave = this.add.rectangle(x, ty * TILE + 2, TILE + 1, 4, 0xdff6ff, 0.85).setDepth(6.6);
      this.tweens.add({ targets: wave, y: ty * TILE + 5, duration: 900 + (tx % 3) * 120, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  private inWater(spr: Phaser.GameObjects.Sprite | undefined) {
    if (!spr || !this.level) return false;
    const tx = Math.floor(spr.x / TILE);
    const ty = Math.floor(spr.y / TILE);
    return this.level.rows[ty]?.[tx] === "w";
  }

  /** Cave System: a stalactite under the ceiling. It shakes when you are under it, then drops. */
  private addStalactite(tx: number, ty: number) {
    const x = tx * TILE + TILE / 2;
    const top = ty * TILE;
    let floor = worldSize(this.level).h;
    for (let r = ty + 1; r < this.level.rows.length; r++) {
      if ("#=".includes(this.level.rows[r]?.[tx] ?? ".")) {
        floor = r * TILE;
        break;
      }
    }
    const st: Stalactite = { x, top, floor, tri: null, state: "hang", until: 0, vy: 0 };
    st.tri = this.stalactiteShape(x, top);
    this.stalactites.push(st);
  }

  private stalactiteShape(x: number, top: number) {
    // drawn above the cave darkness so a falling one is always readable
    return this.add.triangle(x, top, 0, 0, 26, 0, 13, 44, 0xb8c4d8).setOrigin(0.5, 0).setStrokeStyle(2, 0x1a1420).setDepth(8.2);
  }

  /** Per-room atmosphere: flickering lights (hub, Level 0) and cave darkness. */
  private roomFx() {
    if (this.level.id === "br-cave") {
      if (!this.textures.exists("br-dark")) {
        const W = 2560;
        const H = 1440;
        const tex = this.textures.createCanvas("br-dark", W, H);
        const ctx = tex?.getContext();
        if (tex && ctx) {
          ctx.fillStyle = "rgba(4,3,8,1)";
          ctx.fillRect(0, 0, W, H);
          ctx.globalCompositeOperation = "destination-out";
          const g = ctx.createRadialGradient(W / 2, H / 2, 150, W / 2, H / 2, 380);
          g.addColorStop(0, "rgba(0,0,0,1)");
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
          tex.refresh();
        }
      }
      this.caveDark = this.add.image(0, 0, "br-dark").setScrollFactor(0).setDepth(7.9).setAlpha(0.86);
    }
    if (this.level.id === BACKROOMS_HUB) this.redHub();
    if (this.level.chase) this.startChase();
    if (this.level.heaven) this.heavenFx();
    const flicker = this.level.id === BACKROOMS_HUB || this.level.id === "br-0";
    if (flicker) {
      const cam = this.cameras.main;
      const shade = this.add.rectangle(0, 0, cam.width, cam.height, 0x14100a, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(7.8);
      const strong = this.level.id === "br-0";
      const go = () => {
        this.time.delayedCall(Phaser.Math.Between(2200, 5200), () => {
          if (!shade.active) return;
          sfx.buzz();
          const a = strong ? 0.45 : 0.25;
          this.tweens.chain({
            targets: shade,
            tweens: [
              { fillAlpha: a, duration: 50 },
              { fillAlpha: 0.05, duration: 70 },
              { fillAlpha: a * 0.8, duration: 60 },
              { fillAlpha: 0, duration: 160 },
            ],
          });
          go();
        });
      };
      go();
    }
  }

  /**
   * Hayden: after you beat any Backrooms level, the hub changes when you come back —
   * a red glow, words scrawled on the walls and something watching from a hallway.
   * It gets stronger with every level you clear (saved: it reads save.completed).
   */
  private redHub() {
    const n = redHubLevel(useGame.getState().save.completed);
    if (n <= 0) return;
    const cam = this.cameras.main;
    const red = this.add.rectangle(0, 0, cam.width, cam.height, 0xff1a1a, 0.1 + 0.04 * n).setOrigin(0, 0).setScrollFactor(0).setDepth(7.7);
    red.setBlendMode(Phaser.BlendModes.MULTIPLY);
    const glow = this.add.rectangle(0, 0, cam.width, cam.height, 0xff2a2a, 0.05 + 0.02 * n).setOrigin(0, 0).setScrollFactor(0).setDepth(7.71);
    this.tweens.add({ targets: [red, glow], alpha: { from: 1, to: 0.7 }, duration: Math.max(260, 900 - n * 150), yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    // the words sit on the wallpaper (same parallax as the background), above the doors
    const bgW = this.scale.width + 0.12 * Math.max(0, worldSize(this.level).w - this.scale.width) + 24;
    const sx = bgW / 1470;
    redHubWords(n).forEach((w, i) => {
      const t = this.add
        .text(w.x * sx, w.y, w.text, { fontFamily: "Lilita One, Impact, sans-serif", fontSize: `${w.size}px`, color: "#c4161c", stroke: "#4a0508", strokeThickness: 3 })
        .setOrigin(0.5)
        .setAngle(w.angle)
        .setAlpha(0.88)
        .setScrollFactor(0.12, 0)
        .setDepth(-7);
      // drips under the letters
      const g = this.add.graphics().setScrollFactor(0.12, 0).setDepth(-7.1);
      g.fillStyle(0xa8121a, 0.8);
      for (let k = 0; k < 3 + (i % 3); k++) g.fillRect(t.x - t.width / 2 + ((k * 37 + i * 13) % Math.max(10, t.width)), t.y + w.size * 0.35, 3, 10 + ((k * 7 + i * 5) % 22));
    });
    // something stands far back in a hallway opening; it vanishes when you get close
    if (!this.textures.exists("bacteria")) return;
    for (const d of redHubWatchers(n)) {
      const x = d.x * sx;
      const e = this.add.sprite(x, d.feet, "bacteria", 0).setOrigin(0.5, 1).setDisplaySize(d.size, d.size).setTint(0x120608).setAlpha(0.92).setScrollFactor(0.12, 0).setDepth(-7.2);
      const eyes = this.add.text(x + 1, d.feet - d.size * 0.89, "• •", { fontFamily: "Arial", fontSize: "9px", color: "#ff4040" }).setOrigin(0.5).setScrollFactor(0.12, 0).setDepth(-7.15);
      let gone = false;
      const ev = this.time.addEvent({
        delay: 120,
        loop: true,
        callback: () => {
          if (gone || !this.player?.active) return;
          // screen position of the doorway vs the hero
          const screenX = x - cam.scrollX * 0.12;
          if (Math.abs(this.player.x - cam.scrollX - screenX) < 170) {
            gone = true;
            sfx.buzz();
            this.tweens.add({ targets: [e, eyes], alpha: 0, duration: 140, onComplete: () => { e.destroy(); eyes.destroy(); ev.remove(); } });
          }
        },
      });
    }
  }

  private tickRoomFx(dt: number) {
    const now = this.time.now;
    this.tickChase(dt);
    this.tickGlitch(now);
    // moving platforms: velocity-driven so riders are carried along
    for (const mv of this.movers) {
      const t = (now % mv.period) / mv.period;
      const body = mv.img.body as Phaser.Physics.Arcade.Body;
      if (mv.axis === "x") {
        const target = mv.x0 + mv.amp * Math.sin(t * Math.PI * 2);
        body.setVelocity((target - mv.img.x) / Math.max(dt, 1 / 120), 0);
      } else {
        const target = mv.y0 + (mv.amp * (1 - Math.cos(t * Math.PI * 2))) / 2;
        body.setVelocity(0, (target - mv.img.y) / Math.max(dt, 1 / 120));
      }
      const lamp = mv.img.getData("lamp") as Phaser.GameObjects.Rectangle | undefined;
      lamp?.setPosition(mv.img.x, mv.img.y + 10);
    }
    if (this.moverGroup && !this.moversWired) {
      this.moversWired = true;
      this.physics.add.collider(this.player, this.moverGroup, undefined, (p, plat) => {
        const pb = (p as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
        const mb = (plat as Phaser.Physics.Arcade.Image).body as Phaser.Physics.Arcade.Body;
        if (this.dropT > 0) return false;
        // one-way: only land from above
        return pb.prev.y + pb.height <= mb.prev.y + 14;
      });
      for (const m of this.mobs) if (m.kind === "br-chair") this.physics.add.collider(m.spr, this.moverGroup);
    }
    // conveyors push whoever stands on them
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down || body.touching.down) {
      const row = this.level.rows[Math.floor((body.bottom + 4) / TILE)];
      const ch = row?.[Math.floor(this.player.x / TILE)];
      if (ch === ">" || ch === "<") this.player.x += (ch === ">" ? 1 : -1) * 140 * dt;
    }
    // cave darkness follows you
    if (this.caveDark) {
      const cam = this.cameras.main;
      this.caveDark.setPosition(this.player.x - cam.scrollX, this.player.y - cam.scrollY);
    }
    for (const st of this.stalactites) this.tickStalactite(st, dt, now);
  }

  private tickStalactite(st: Stalactite, dt: number, now: number) {
    const tri = st.tri;
    if (st.state === "hang" && tri) {
      if (Math.abs(this.player.x - st.x) < 60 && this.player.y > st.top && this.player.y < st.floor + 10) {
        st.state = "shake";
        st.until = now + 520; // the tell: it shakes for half a second
        this.tweens.add({ targets: tri, x: st.x + 3, duration: 45, yoyo: true, repeat: 5 });
        tri.setFillStyle(0xe8f0ff);
      }
    } else if (st.state === "shake" && tri) {
      if (now >= st.until) {
        st.state = "fall";
        st.vy = 0;
        tri.setX(st.x);
        this.hazards.push(tri);
      }
    } else if (st.state === "fall" && tri) {
      st.vy = Math.min(900, st.vy + 1800 * dt);
      tri.y += st.vy * dt;
      if (tri.y + 44 >= st.floor) {
        this.dust.emitParticleAt(st.x, st.floor - 4, 8);
        tri.destroy();
        st.tri = null;
        st.state = "gone";
        st.until = now + 2600;
      }
    } else if (st.state === "gone" && now >= st.until) {
      st.tri = this.stalactiteShape(st.x, st.top);
      st.tri.setScale(1, 0.1);
      this.tweens.add({ targets: st.tri, scaleY: 1, duration: 400 });
      st.state = "hang";
    }
  }

  private spawnBackroomsMob(x: number, y: number, kind: string) {
    const info = ENEMY_INFO[kind]!;
    const spr = this.physics.add.sprite(x, y, kind, 0);
    spr.setDisplaySize(kind === "br-spore" ? 44 : 56, kind === "br-spore" ? 44 : 56);
    const body = spr.body as Phaser.Physics.Arcade.Body;
    body.setSize(70, 80).setOffset(29, 40);
    spr.setData("home", { x, y });
    spr.setDepth(kind === "br-moth" ? 2.5 : 5);
    if (info.flies) {
      body.setAllowGravity(false);
    } else {
      spr.setCollideWorldBounds(true);
      body.setGravityY(2200);
      this.physics.add.collider(spr, this.solids);
      this.physics.add.collider(spr, this.oneWay);
    }
    if (this.anims.exists(`${kind}-walk`)) spr.play(`${kind}-walk`);
    this.mobs.push({ spr, kind, dir: Math.random() > 0.5 ? 1 : -1, hp: info.hp, next: this.time.now + Phaser.Math.Between(400, 1400) });
  }

  private tickBackroomsMob(m: Mob, body: Phaser.Physics.Arcade.Body, now: number, hard: number) {
    const info = ENEMY_INFO[m.kind]!;
    const home = m.spr.getData("home") as { x: number; y: number };
    const spd = info.speed * hard;
    switch (m.kind) {
      case "br-moth": {
        // flutter in loops around its light
        const t = now / 1000 + home.x * 0.01;
        m.spr.setPosition(home.x + Math.sin(t * 1.3) * 60, home.y + Math.sin(t * 2.6) * 22);
        m.dir = Math.cos(t * 1.3) >= 0 ? 1 : -1;
        break;
      }
      case "br-smiler": {
        // drifts back and forth in the wallpaper, bobbing
        if (m.spr.x > home.x + 140) m.dir = -1;
        if (m.spr.x < home.x - 140) m.dir = 1;
        body.setVelocity(m.dir * spd, Math.sin(now / 380 + home.x) * 40);
        break;
      }
      case "br-chair": {
        body.setVelocityX(m.dir * spd);
        if (body.blocked.left) m.dir = 1;
        if (body.blocked.right) m.dir = -1;
        m.spr.setAngle(Math.sin(now / 90) * 3);
        break;
      }
      case "br-duck": {
        body.setVelocityX(m.dir * spd);
        if (body.blocked.left) m.dir = 1;
        if (body.blocked.right) m.dir = -1;
        if (Math.abs(m.spr.x - home.x) > 150) m.dir = m.spr.x > home.x ? -1 : 1;
        if (body.blocked.down && now > m.next) {
          m.next = now + 1100;
          body.setVelocityY(-460);
        }
        break;
      }
      case "br-hound": {
        // walk; when you are close and level with it: crouch (the tell), then charge
        const state = String(m.spr.getData("st") ?? "walk");
        const until = Number(m.spr.getData("until") ?? 0);
        const dx = this.player.x - m.spr.x;
        if (state === "walk") {
          body.setVelocityX(m.dir * spd);
          if (body.blocked.left) m.dir = 1;
          if (body.blocked.right) m.dir = -1;
          if (now > m.next && Math.abs(dx) < 300 && Math.abs(this.player.y - m.spr.y) < 70) {
            m.dir = dx < 0 ? -1 : 1;
            m.spr.setData("st", "crouch").setData("until", now + 600);
            m.spr.setTint(0xb48cff);
            body.setVelocityX(0);
            this.pop(m.spr.x, m.spr.y - 50, "!");
          }
        } else if (state === "crouch") {
          body.setVelocityX(0);
          m.spr.setScale(m.spr.scaleX, Math.abs(m.spr.scaleX) * 0.85);
          if (now > until) m.spr.setData("st", "charge").setData("until", now + 850);
        } else {
          m.spr.setScale(m.spr.scaleX, Math.abs(m.spr.scaleX));
          m.spr.clearTint();
          body.setVelocityX(m.dir * 330 * hard);
          if (now > until || body.blocked.left || body.blocked.right) {
            m.spr.setData("st", "walk");
            m.next = now + 1800;
          }
        }
        break;
      }
      case "br-spore": {
        m.dir = this.player.x < m.spr.x ? -1 : 1;
        body.setVelocityX(m.dir * spd);
        break;
      }
    }
  }

  /** The secret: phase through the floor at the final boss door into Floor 470539758. */
  private noclip() {
    if (this.noclipping) return;
    this.noclipping = true;
    this.frozen = true;
    setInjected([]);
    const save = useGame.getState().save;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0).setAcceleration(0, 0);
    body.setAllowGravity(false);
    body.checkCollision.none = true;
    this.player.setDepth(0.5); // behind the floor tiles: you sink into them
    // a glowing yellow tear in the floor under your feet
    const fx = this.player.x;
    const fy = (this.player.body as Phaser.Physics.Arcade.Body).bottom;
    const tear = this.add.graphics().setDepth(1.5);
    tear.fillStyle(0xfff3a0, 0.95);
    tear.fillPoints(
      [
        { x: fx - 46, y: fy },
        { x: fx - 24, y: fy - 5 },
        { x: fx - 8, y: fy + 4 },
        { x: fx + 10, y: fy - 6 },
        { x: fx + 28, y: fy + 3 },
        { x: fx + 46, y: fy },
        { x: fx + 30, y: fy + 12 },
        { x: fx + 6, y: fy + 8 },
        { x: fx - 16, y: fy + 14 },
        { x: fx - 34, y: fy + 7 },
      ],
      true,
    );
    const halo = this.add.ellipse(fx, fy - 30, 120, 150, 0xffe066, 0.25).setDepth(0.45);
    this.tweens.add({ targets: [tear, halo], alpha: { from: 1, to: 0.4 }, duration: 80, yoyo: true, repeat: -1 });
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.shake(1700, 0.006);
    sfx.noclip();
    this.pop(this.player.x, this.player.y - 70, "...?");
    emitGame({ t: "toast", text: "You phased through the floor..." });
    this.time.addEvent({ delay: 280, repeat: 6, callback: () => sfx.buzz() });
    this.time.addEvent({
      delay: 60,
      repeat: 30,
      callback: () => {
        const colors = [0xe8d67a, 0xfff6b0, 0x9a8a3a, 0x14100a];
        const r = this.add
          .rectangle(cam.scrollX + Math.random() * cam.width, cam.scrollY + Math.random() * cam.height, 40 + Math.random() * 260, 6 + Math.random() * 26, colors[Math.floor(Math.random() * colors.length)]!, 0.75)
          .setDepth(40);
        this.time.delayedCall(150, () => r.destroy());
      },
    });
    this.tweens.add({ targets: this.player, alpha: { from: 1, to: 0.2 }, duration: 70, yoyo: true, repeat: 12 });
    this.tweens.add({ targets: this.player, y: this.player.y + 210, duration: 1500, delay: 300, ease: "Quad.easeIn" });
    this.time.delayedCall(1600, () => cam.fadeOut(550, 232, 214, 120));
    this.time.delayedCall(2200, () => {
      useGame.getState().persist(enterBackrooms(save));
      emitGame({ t: "toast", text: `${BACKROOMS_NAME}` });
      this.scene.restart({ levelId: BACKROOMS_HUB });
    });
  }

  /** Floor 5 hub: the tear back down (after you've found the Backrooms once). */
  private enterBackroomsDoor() {
    this.frozen = true;
    sfx.noclip();
    useGame.getState().persist(enterBackrooms(useGame.getState().save));
    this.cameras.main.fadeOut(400, 232, 214, 120);
    this.time.delayedCall(420, () => this.scene.restart({ levelId: BACKROOMS_HUB }));
  }

  /** Backrooms hub EXIT: back up to Floor 5. */
  /* ---------------- the hero's damage glitch (Backrooms only) ---------------- */

  private glitchOn() {
    return isBackroomsRoom(this.levelId) && useGame.getState().save.settings.glitch !== false && !!this.player;
  }

  /** Ghost copies (red / cyan split, a jitter copy) and slice strips of the hero; never touch the body. */
  private ensureGlitchFx() {
    if (this.glitchFx) return this.glitchFx;
    const mk = (tint?: number) => {
      const g = this.add.sprite(0, 0, this.player.texture.key, 0).setVisible(false).setDepth(this.player.depth + 0.01);
      if (tint !== undefined) g.setTint(tint).setBlendMode(Phaser.BlendModes.ADD);
      return g;
    };
    this.glitchFx = { ghosts: [mk(0xff2040), mk(0x30e0ff), mk()], slices: [mk(), mk(), mk(), mk()] };
    return this.glitchFx;
  }

  private glitchHit() {
    if (!this.glitchOn()) return;
    const lvl = glitchLevel(Math.max(0, this.hp), this.maxHp);
    const b = glitchBurst(Math.max(0.3, lvl));
    this.glitchUntil = this.time.now + b.ms;
    this.glitchSplit = b.split;
    this.glitchSlices = b.slices;
    sfx.glitch();
  }

  private tickGlitch(now: number) {
    if (!this.glitchOn()) {
      if (this.glitchFx) this.hideGlitch();
      return;
    }
    const lvl = glitchLevel(Math.max(0, this.hp), this.maxHp);
    // ambient glitches at low health (rate capped well under 3 per second)
    const rate = glitchAmbientRate(lvl);
    if (rate > 0 && now >= this.glitchNextAmbient) {
      if (this.glitchNextAmbient > 0 && now > this.glitchUntil) {
        const b = glitchBurst(lvl);
        this.glitchUntil = now + Math.min(160, b.ms * 0.5);
        this.glitchSplit = Math.max(2, Math.round(b.split * 0.6));
        this.glitchSlices = Math.max(1, b.slices - 2);
        if (Math.random() < 0.5) sfx.glitch();
      }
      this.glitchNextAmbient = now + (1000 / rate) * (0.6 + Math.random() * 0.8);
    }
    const burst = now < this.glitchUntil;
    const constant = glitchConstant(lvl);
    if (!burst && !constant) {
      if (this.glitchFx) this.hideGlitch();
      return;
    }
    const fx = this.ensureGlitchFx();
    const p = this.player;
    const sync = (g: Phaser.GameObjects.Sprite) => {
      if (g.texture.key !== p.texture.key || g.frame.name !== p.frame.name) g.setTexture(p.texture.key, p.frame.name);
      g.setOrigin(p.originX, p.originY).setScale(p.scaleX, p.scaleY).setFlipX(p.flipX).setAngle(p.angle).setDepth(p.depth + 0.01);
      return g;
    };
    const split = burst ? this.glitchSplit : 1.5;
    const [red, cyan, jit] = fx.ghosts as [Phaser.GameObjects.Sprite, Phaser.GameObjects.Sprite, Phaser.GameObjects.Sprite];
    sync(red).setPosition(p.x - split, p.y).setAlpha(burst ? 0.55 : 0.22).setVisible(true);
    sync(cyan).setPosition(p.x + split, p.y).setAlpha(burst ? 0.55 : 0.22).setVisible(true);
    // flicker no faster than ~3 Hz: the hero dims and a jittered copy stands in for a frame
    const flick = burst && now - this.glitchFlickAt >= GLITCH_FLICKER_MS;
    if (flick) this.glitchFlickAt = now;
    const jitterOn = burst && now - this.glitchFlickAt < 50;
    p.setAlpha(jitterOn ? 0.35 : 1);
    sync(jit).setPosition(p.x + (Math.random() - 0.5) * split * 2, p.y + (Math.random() - 0.5) * 4).setAlpha(1).setVisible(jitterOn);
    // horizontal slice displacement of the sprite
    const fw = p.frame.width;
    const fh = p.frame.height;
    fx.slices.forEach((sl, i) => {
      if (!burst || i >= this.glitchSlices) {
        sl.setVisible(false);
        return;
      }
      sync(sl);
      const band = fh / 6;
      const y0 = ((i * 2 + (Math.floor(now / 90) % 3)) % 6) * band;
      sl.setCrop(0, y0, fw, band * 0.8);
      sl.setPosition(p.x + (Math.random() < 0.5 ? -1 : 1) * (split * 0.8 + Math.random() * split), p.y).setVisible(true);
    });
  }

  private hideGlitch() {
    if (!this.glitchFx) return;
    for (const g of [...this.glitchFx.ghosts, ...this.glitchFx.slices]) g.setVisible(false);
    this.player?.setAlpha(1);
  }

  /* ---------------- the escape chase ---------------- */

  private floorY() {
    return this.exitPt.y + TILE / 2;
  }

  private startChase() {
    const cam = this.cameras.main;
    // red-lit hallway: a flickering red wash over everything
    const red = this.add.rectangle(0, 0, cam.width, cam.height, 0xff2020, 0.16).setOrigin(0, 0).setScrollFactor(0).setDepth(7.7);
    red.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.tweens.add({ targets: red, alpha: { from: 1, to: 0.55 }, duration: 140, yoyo: true, repeat: -1, repeatDelay: 900, ease: "Stepped" });
    // scrawled words along the walls
    const fy = this.floorY();
    CHASE_WORDS.forEach((w, i) => {
      const t = this.add
        .text(w.col * TILE, fy - 250 - (i % 2) * 40, w.text, { fontFamily: "Lilita One, Impact, sans-serif", fontSize: "40px", color: "#e01822", stroke: "#3a0406", strokeThickness: 4 })
        .setOrigin(0.5)
        .setAngle(i % 2 ? 4 : -5)
        .setAlpha(0.9)
        .setDepth(-6);
      const g = this.add.graphics().setDepth(-6.1);
      g.fillStyle(0xb0121a, 0.85);
      for (let k = 0; k < 5; k++) g.fillRect(t.x - t.width / 2 + ((k * 41 + i * 17) % Math.max(10, t.width)), t.y + 16, 3, 12 + ((k * 9 + i * 5) % 26));
    });
    // checkpoints: a little green emergency light on the wall
    for (const c of CHASE_CHECKPOINTS.slice(1)) {
      const x = c * TILE + TILE / 2;
      const lamp = this.add.rectangle(x, fy - 150, 34, 14, 0x3ce07a, 1).setStrokeStyle(2, 0x0d2a16).setDepth(-5);
      this.tweens.add({ targets: lamp, alpha: 0.5, duration: 600, yoyo: true, repeat: -1 });
      this.add.text(x, fy - 172, "SAFE", { fontFamily: "Lilita One, Impact, sans-serif", fontSize: "14px", color: "#bfffd2" }).setOrigin(0.5).setDepth(-5);
    }
    // Bacteria, a little way behind you
    if (this.textures.exists("bacteria")) {
      this.chaserGlow = this.add.ellipse(0, fy - 80, 190, 220, 0xff1010, 0.2).setDepth(4.9);
      this.chaser = this.add.sprite(0, fy, "bacteria", 0).setOrigin(0.5, 118 / 128).setDisplaySize(190, 190).setDepth(5);
      if (this.anims.exists("bacteria-idle")) this.chaser.play("bacteria-idle");
      this.tweens.add({ targets: this.chaserGlow, alpha: 0.06, duration: 300, yoyo: true, repeat: -1 });
    }
    this.resetChaser();
    this.pop(this.player.x, this.player.y - 70, "RUN!");
  }

  private chaseSpot() {
    const col = chaseCheckpoint(this.chaseBest);
    return col === 0 ? this.spawn : { x: col * TILE + TILE / 2, y: this.spawn.y };
  }

  private resetChaser() {
    if (!this.chaser) return;
    this.chaser.x = this.chaseSpot().x - CHASE.restartGap;
    this.chaserGlow?.setX(this.chaser.x);
    this.chaseWait = CHASE.graceMs / 1000;
  }

  private tickChase(dt: number) {
    if (!this.chaser || this.scaring) return;
    const col = Math.floor(this.player.x / TILE);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (col > this.chaseBest && body.blocked.down) {
      const before = chaseCheckpoint(this.chaseBest);
      this.chaseBest = col;
      if (chaseCheckpoint(col) > before) {
        sfx.pickup();
        this.pop(this.player.x, this.player.y - 70, "CHECKPOINT");
      }
    }
    if (this.chaseWait > 0) {
      this.chaseWait -= dt;
      return;
    }
    this.chaser.x = stepChaser(this.chaser.x, this.player.x, dt);
    this.chaser.y = this.floorY() + Math.sin(this.time.now / 90) * 3;
    this.chaserGlow?.setPosition(this.chaser.x, this.floorY() - 80);
    if (caught(this.chaser.x, this.player.x)) this.catchPlayer();
  }

  /** Bacteria got you: jumpscare (if on), lose a life, the chase restarts. */
  private catchPlayer() {
    this.scaring = true;
    this.catches += 1;
    setInjected([]);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.physics.world.pause();
    this.lives -= 1;
    this.damaged = true;
    this.pushHud();
    this.jumpscare(() => {
      this.physics.world.resume();
      this.scaring = false;
      if (this.lives <= 0) {
        this.gameOver();
        return;
      }
      this.hp = this.maxHp;
      this.respawn();
      this.invulnT = 1;
      this.pop(this.player.x, this.player.y - 70, "RUN!");
    });
  }

  /**
   * Bacteria's face zooms up to fill the screen: shake, red flash and a short screech
   * (about 1 s), then a fade to the retry. Off in Options/Pause ("Jumpscares") = just a red flash.
   */
  private jumpscare(done: () => void) {
    const cam = this.cameras.main;
    const settings = useGame.getState().save.settings;
    if (settings.jumpscares === false) {
      cam.flash(220, 200, 20, 20);
      sfx.hurt();
      this.pop(this.player.x, this.player.y - 60, "CAUGHT!");
      this.time.delayedCall(600, done);
      return;
    }
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    const dim = this.add.rectangle(0, 0, cam.width, cam.height, 0x000000, 0.92).setOrigin(0, 0).setScrollFactor(0).setDepth(80);
    const face = this.add.container(cx, cy).setScrollFactor(0).setDepth(81);
    const g = this.add.graphics();
    // soft red haze around a black void head
    for (let k = 4; k >= 1; k--) g.fillStyle(0xb01010, 0.07).fillEllipse(0, 0, 300 + k * 26, 380 + k * 26);
    g.fillStyle(0x050304, 1).fillEllipse(0, 0, 300, 380);
    // glowing eyes (soft rings of light, then the eye)
    for (const sx of [-62, 62]) {
      for (let k = 4; k >= 1; k--) g.fillStyle(0xfff2b0, 0.08).fillEllipse(sx, -60, 62 + k * 12, 40 + k * 10);
      g.fillStyle(0xffffff, 1).fillEllipse(sx, -60, 62, 40);
      g.fillStyle(0x200808, 1).fillCircle(sx, -58, 9);
    }
    // the big glowing grin
    for (let k = 3; k >= 1; k--) {
      g.lineStyle(k * 7, 0xfff6d0, 0.1);
      g.strokePoints([{ x: -110, y: 40 }, { x: 110, y: 40 }, { x: 70, y: 100 }, { x: -70, y: 100 }], true);
    }
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.moveTo(-110, 40);
    g.lineTo(110, 40);
    g.lineTo(70, 100);
    g.lineTo(-70, 100);
    g.closePath();
    g.fillPath();
    g.lineStyle(4, 0x1a0606, 1);
    for (let k = -4; k <= 4; k++) g.lineBetween(k * 22, 42, k * 17, 98);
    g.lineBetween(-100, 70, 100, 70);
    face.add(g);
    face.setScale(0.12);
    this.tweens.add({ targets: face, scale: 1.9, duration: 360, ease: "Back.easeOut" });
    this.tweens.add({ targets: face, x: { from: cx - 6, to: cx + 6 }, duration: 40, yoyo: true, repeat: 12, delay: 360 });
    if (settings.shake) cam.shake(800, 0.02);
    cam.flash(260, 255, 30, 30);
    sfx.screech();
    this.time.delayedCall(820, () => cam.fadeOut(200, 0, 0, 0));
    this.time.delayedCall(1040, () => {
      dim.destroy();
      face.destroy();
      cam.fadeIn(260, 0, 0, 0);
      done();
    });
  }

  /** The end of the hallway: step through the EXIT, then fall into the light. */
  private chaseExit() {
    if (this.frozen) return;
    this.frozen = true;
    setInjected([]);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0).setAllowGravity(false);
    body.checkCollision.none = true;
    this.chaser?.setVisible(false);
    this.chaserGlow?.setVisible(false);
    sfx.door();
    const cam = this.cameras.main;
    cam.stopFollow();
    this.tweens.add({ targets: this.player, x: this.exitPt.x, alpha: 0.5, duration: 220 });
    this.time.delayedCall(260, () => {
      sfx.noclip();
      cam.flash(300, 255, 250, 220);
      this.tweens.add({ targets: this.player, y: this.player.y + 520, angle: 540, scale: 0.4, duration: 1100, ease: "Quad.easeIn" });
      cam.fadeOut(1000, 255, 252, 236);
    });
    this.time.delayedCall(1400, () => this.scene.restart({ levelId: BACKROOMS_HEAVEN }));
  }

  /** The heaven room: soft light rays, drifting sparkles, a white fade in while you float down. */
  private heavenFx() {
    const cam = this.cameras.main;
    cam.fadeIn(1200, 255, 252, 236);
    const w = worldSize(this.level).w;
    const rays = this.add.graphics().setDepth(-5).setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < 7; i++) {
      const x = (i + 0.5) * (w / 7);
      rays.fillStyle(0xfff2c0, 0.1);
      rays.fillTriangle(x - 20, 0, x + 20, 0, x + 140, this.floorYHeaven());
      rays.fillTriangle(x - 20, 0, x - 140, this.floorYHeaven(), x + 140, this.floorYHeaven());
    }
    this.tweens.add({ targets: rays, alpha: { from: 1, to: 0.5 }, duration: 2400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.time.addEvent({
      delay: 160,
      loop: true,
      callback: () => {
        const p = this.add.circle(Math.random() * w, this.floorYHeaven() - Math.random() * 60, 2 + Math.random() * 3, 0xfff1a8, 0.9).setDepth(3);
        this.tweens.add({ targets: p, y: p.y - 260 - Math.random() * 200, alpha: 0, duration: 2600 + Math.random() * 1400, onComplete: () => p.destroy() });
      },
    });
    this.pop(this.player.x, this.player.y + 120, "...it's so bright");
  }

  private floorYHeaven() {
    const ty = this.level.rows.findIndex((r) => r.includes("Y"));
    return ty < 0 ? worldSize(this.level).h : (ty + 1) * TILE;
  }

  /** The ESCAPE door: rewards, then Floor 5 or Cuboe & Cubro's House (picked on the next screen). */
  private escapeDoor() {
    if (this.frozen) return;
    this.frozen = true;
    const rank = rankFromScore(4000 + Math.max(0, this.lives) * 1500, false, 0);
    const save = useGame.getState().save;
    const hadLore = save.lore.includes(BACKROOMS_LORE);
    useGame.getState().persist(escapeRewards(save, rank));
    if (!hadLore) this.pop(this.player.x, this.player.y - 40, "SECRET LORE");
    sfx.win();
    this.cameras.main.flash(500, 255, 255, 255);
    this.tweens.add({ targets: this.player, alpha: 0, duration: 500 });
    this.time.delayedCall(550, () => emitGame({ t: "rank", levelId: BACKROOMS_ESCAPE, rank, score: 4000 + Math.max(0, this.lives) * 1500 }));
  }

  private bgKey() {
    return bgKeyFor(this.level.bg);
  }

  private makeAnims() {
    const mk = (key: string, sheet: string, rate: number, rep: number) => {
      if (this.anims.exists(key)) return;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(sheet, { start: 0, end: 3 }),
        frameRate: rate,
        repeat: rep,
      });
    };
    for (const h of ["cuboe", "cubro", "candy-cube"] as const) {
      mk(`${h}-idle`, `${h}-idle`, 7, -1);
      mk(`${h}-run`, `${h}-run`, 12, -1);
      mk(`${h}-jump`, `${h}-jump`, 8, 0);
      mk(`${h}-attack`, `${h}-attack`, 14, 0);
    }
    for (const h of ["cuboe", "cubro"] as const) {
      if (!this.textures.exists(`fake-${h}-idle`)) continue;
      mk(`fake-${h}-idle`, `fake-${h}-idle`, 7, -1);
      mk(`fake-${h}-run`, `fake-${h}-run`, 12, -1);
      mk(`fake-${h}-jump`, `fake-${h}-jump`, 8, 0);
      mk(`fake-${h}-attack`, `fake-${h}-attack`, 14, 0);
    }
    mk("boxguy-walk", "boxguy", 8, -1);
    mk("nincube-walk", "nincube", 12, -1);
    mk("pump-walk", "pump", 8, -1);
    mk("choco-idle", "choco", 6, -1);
    mk("outlaw-idle", "outlaw", 6, -1);
    mk("warlock-idle", "warlock", 6, -1);
    mk("warlord-1-idle", "warlord-1", 6, -1);
    mk("warlord-2-idle", "warlord-2", 6, -1);
    mk("warlord-3-idle", "warlord-3", 6, -1);
    for (const kind of Object.keys(ENEMY_INFO)) if (this.textures.exists(kind)) mk(`${kind}-walk`, kind, kind === "br-moth" ? 14 : 8, -1);
    if (this.textures.exists("bacteria")) mk("bacteria-idle", "bacteria", 6, -1);
    if (this.textures.exists("bacteria-void")) mk("bacteria-void-idle", "bacteria-void", 6, -1);
  }

  private tileSpr(tx: number, ty: number, oneWay: boolean) {
    const x = tx * TILE + TILE / 2;
    const y = ty * TILE + TILE / 2;
    let img: Phaser.GameObjects.GameObject;
    if (this.isHouse) {
      // Cuboe and Cubro's Home: wood floor (#), invisible walls (|) and furniture tops (=)
      const ch = this.level.rows[ty]?.[tx];
      if (ch === "#") {
        img = this.add.rectangle(x, y, TILE + 1, TILE + 1, 0x7a4426).setDepth(1);
        this.add.rectangle(x, y - TILE / 2 + 3, TILE + 1, 6, 0xe0a060).setDepth(1);
        this.add.rectangle(x - TILE / 2 + 1, y, 2, TILE, 0x4a2a18).setDepth(1);
      } else img = this.add.rectangle(x, y, TILE, TILE, 0x000000, 0);
    } else if (this.level.isHub && !this.level.themed) {
      const rec = this.add.rectangle(x, y, TILE + 1, TILE + 1, 0x3a2214).setDepth(1);
      this.add.rectangle(x, y - TILE / 2 + 3, TILE + 1, 6, 0xc47a3a).setDepth(1);
      img = rec;
    } else {
      const theme = themeFor(this.level.id);
      if (theme && this.textures.exists(theme.tiles)) {
        // surface frame where the cell above is open, fill frame under another tile
        const above = this.level.rows[ty - 1]?.[tx] ?? ".";
        const frame = "#=<>".includes(above) ? 1 : 0;
        img = this.add.image(x, y, theme.tiles, frame).setDisplaySize(TILE + 1, TILE + 1).setDepth(1);
      } else {
        const key = this.level.ground === "marsh" ? "ground-marsh" : "ground-candy";
        img = this.add.image(x, y, key).setDisplaySize(TILE + 1, TILE + 1).setDepth(1);
      }
    }
    this.physics.add.existing(img, true);
    const body = (img as Phaser.Physics.Arcade.Image).body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(TILE, TILE);
    if (oneWay) this.oneWay.add(img);
    else this.solids.add(img);
  }

  private marker(x: number, y: number, text: string) {
    this.add
      .text(x, y, text, {
        fontFamily: "Lilita One, Impact, sans-serif",
        fontSize: "20px",
        color: "#fff4d6",
        stroke: "#140c0a",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(8);
  }

  private drawDoor(x: number, y: number, label: string, kind: "room" | "boss" | "up" | "pc" | "exit", accent?: number, art?: string) {
    const bottom = y + TILE / 2 - 4; // stand on the floor tile below
    const own = art && this.textures.exists(art) ? art : null;
    if (kind === "boss") {
      // frosted boss door: pulsing glow behind it
      const glow = this.add.ellipse(x, bottom - 46, 92, 112, 0xff4d8a, 0.28).setDepth(1.9);
      this.tweens.add({ targets: glow, alpha: 0.08, scale: 1.08, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.add.image(x, bottom, own ?? "door-boss").setOrigin(0.5, 1).setDisplaySize(68, 92).setDepth(2);
      this.marker(x, bottom - 104, label);
      return;
    }
    if (own) {
      // the level's own themed door (scripts/art/make-level-doors.py)
      this.add.image(x, bottom, own).setOrigin(0.5, 1).setDisplaySize(46, 72).setDepth(2);
      this.marker(x, bottom - 86, label);
      return;
    }
    // gingerbread door; its round window glows in the room's accent colour
    const win = accent ?? (kind === "up" ? 0x7dff9a : kind === "pc" ? 0x8be9ff : kind === "exit" ? 0xffe066 : 0xfff4d6);
    const lamp = this.add.circle(x, bottom - 41, 6, win, 1).setDepth(1.95);
    this.tweens.add({ targets: lamp, alpha: 0.65, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.add.image(x, bottom, "door-room").setOrigin(0.5, 1).setDisplaySize(46, 72).setDepth(2);
    if (kind === "up") {
      const g = this.add.graphics().setDepth(2.1);
      g.fillStyle(0x7dff9a, 1).lineStyle(2, 0x22120e, 1);
      g.fillTriangle(x, bottom - 30, x - 8, bottom - 18, x + 8, bottom - 18);
      g.strokeTriangle(x, bottom - 30, x - 8, bottom - 18, x + 8, bottom - 18);
    }
    this.marker(x, bottom - 86, label);
  }


  private buildMap() {
    const floor = useGame.getState().save.floor;
    let candyIdx = 0;
    eachCell(this.level, (ch, tx, ty) => {
      const x = tx * TILE + TILE / 2;
      const y = ty * TILE + TILE / 2;
      if (ch === "#" || (ch === "|" && this.isHouse)) this.tileSpr(tx, ty, false);
      else if (ch === "<" || ch === ">") this.conveyor(tx, ty, ch === ">" ? 1 : -1);
      else if (ch === "~" || ch === "^") this.addMover(tx, ty, ch === "~" ? "x" : "y");
      else if (ch === "w") this.water(tx, ty);
      else if (ch === "v") this.addStalactite(tx, ty);
      else if (ENEMY_CHARS[ch]) this.spawnMob(x, y, ENEMY_CHARS[ch]!);
      else if (ch === "N") {
        // the way back down, once you have found it
        if (discovered(useGame.getState().save)) {
          this.interactives.push({ kind: "tear", id: BACKROOMS_HUB, x, y });
          this.drawDoor(x, y, BACKROOMS_NAME, "room", undefined, "door-br-noclip");
        }
      }
      else if (ch === "=") this.tileSpr(tx, ty, true);
      else if (ch === "S") this.spawn = { x: Math.max(x, 96), y: y - 8 };
      else if (ch === "X") this.exitPt = { x, y };
      else if (ch === "Y") {
        // the big white ESCAPE door in the heaven room
        this.interactives.push({ kind: "escape", id: "escape", x, y });
        const bottom = y + TILE / 2 - 4;
        const glow = this.add.ellipse(x, bottom - 70, 170, 210, 0xfff1b0, 0.45).setDepth(1.9);
        this.tweens.add({ targets: glow, alpha: 0.18, scale: 1.1, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        const door = themeFor(this.level.id)?.door;
        if (door && this.textures.exists(door)) this.add.image(x, bottom, door).setOrigin(0.5, 1).setDisplaySize(92, 144).setDepth(2);
        this.marker(x, bottom - 158, "ESCAPE");
      }
      else if (ch === "c" || ch === "l") {
        const xk = this.xmasLevel() ? collectableForCandy(candyIdx) : null;
        candyIdx++;
        if (xk) this.dropXmas(x, y, xk);
        else this.dropPickup(x, y, ch === "l" ? 1 : 0, 20);
      }
      else if (ch === "g") {
        if (this.level.isHub) {
          // Hub Candy Bux spot: a one-time +50 per hub, collected with Up.
          const id = `giver-${this.levelId}`;
          if (!useGame.getState().save.claimed.includes(id)) {
            this.dropPickup(x, y, 3, 0);
            this.interactives.push({ kind: "giver", id, x, y });
            this.marker(x, y - 50, "+50");
          }
        } else this.dropPickup(x, y, 3, 50);
      } else if (ch === "b") this.spawnMob(x, y, "boxguy");
      else if (ch === "n") this.spawnMob(x, y, "nincube");
      else if (ch === "p") this.spawnMob(x, y, "pump");
      else if (ch === "C") this.spawnMob(x, y, "cannon");
      else if (ch === "B") {
        if (this.level.isBoss) this.spawnBoss(x, y);
        else {
          const bossId = floorDef(floor)?.boss.id ?? `f${floor}-boss`;
          this.interactives.push({ kind: "boss", id: bossId, x, y });
          this.drawDoor(x, y, "BOSS", "boss", undefined, themeFor(bossId)?.door);
        }
      } else if (ch === "P") {
        this.interactives.push({ kind: "pc", id: "pc", x, y });
        this.drawDoor(x, y, "PC", "pc");
      } else if (ch === "E") {
        this.interactives.push({ kind: "elevator", id: "next", x, y });
        // Floor 5's elevator leads to the final run: show the Rotting Pumpkin door there.
        if (floor === 5) this.drawDoor(x, y, "FINAL", "up", undefined, themeFor("final-run")?.door);
        else this.drawDoor(x, y, "UP", "up");
      } else if (ch === "T") {
        const id = `treasure-${this.levelId}`;
        if (!useGame.getState().save.claimed.includes(id)) {
          this.interactives.push({ kind: "treasure", id, x, y });
          const chest = this.add.sprite(x, y, "pickups", 3).setDisplaySize(44, 44).setTint(0xffd84a).setDepth(3);
          chest.setData("treasure", id);
          this.tweens.add({ targets: chest, angle: { from: -8, to: 8 }, yoyo: true, repeat: -1, duration: 500 });
          this.marker(x, y - 40, "!");
        }
      } else if (ch === "R") {
        this.secrets++;
        this.interactives.push({ kind: "rift", id: "rift", x, y });
        // Lore spots stay findable but unmarked until you discover them.
      } else if (ch === "M") {
        this.interactives.push({ kind: "metroid", id: "metroid", x, y });
        // No in-world marker or special colour — attack this ledge to find the lore.
      }
      else if (ch === "H") {
        this.interactives.push({ kind: "tv", id: "tv", x, y });
        const tv = this.add.rectangle(x, y - 18, 40, 32, 0x1a1210).setDepth(2);
        this.add.rectangle(x, y - 18, 28, 20, 0x3ecf8e).setDepth(2);
        void tv;
        this.marker(x, y - 52, "TV");
      } else if (ch >= "1" && ch <= "4") {
        const idx = Number(ch) - 1;
        const room = floorDef(floor)?.levels[idx];
        this.interactives.push({ kind: "door", id: room?.id ?? `f${floor}-${ch}`, x, y });
        const short = (room?.name ?? ch).replace(/^(Candy Corn |Marsh Mellow |Lolly Pop |Butter Scotch |Sugar Rush |Cookie War |Sour |Raisin |Smash |Drunk |Scotch |Licorice |Cube |Sloppy |Ruin Pizza |Time Bomb |Grave )/i, "").trim();
        const accents = [0xff8a3a, 0xffc0d8, 0xff4d7a, 0xe8b84a];
        this.drawDoor(x, y, short || ch, "room", accents[idx], room ? themeFor(room.id)?.door : undefined);
      }
    });
    if (!this.level.isHub && !this.level.isBoss && !this.level.heaven) {
      this.drawDoor(this.exitPt.x, this.exitPt.y, "EXIT", "exit", undefined, this.level.chase ? themeFor(this.level.id)?.door : undefined);
      if (!this.level.chase) this.drawStartFlag();
      this.buildPits();
    }
    this.roomFx();
  }

  /** Start flag: where Sugar Time sends you back to. */
  private drawStartFlag() {
    const { x, y } = this.spawn;
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0xfff4d6, 1);
    g.fillRect(x - 2, y - 56, 4, 84);
    g.fillStyle(0xff4d7a, 1);
    g.fillTriangle(x + 2, y - 56, x + 34, y - 46, x + 2, y - 36);
    this.startMark = this.add
      .text(x, y - 74, "START", {
        fontFamily: "Lilita One, Impact, sans-serif",
        fontSize: "18px",
        color: "#fff4d6",
        stroke: "#140c0a",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(8);
  }

  /** Short floor gaps become deadly pits (marked with goo); long ones get a trench floor under the camera. */
  private buildPits() {
    const rows = this.level.rows;
    const ty = rows.length - 1;
    const floor = rows[ty]!;
    let tx = 0;
    // moving platforms (~ ^) sit over open floor, so they count as gaps
    const open = (c: string | undefined) => c === "." || c === "~" || c === "^";
    while (tx < floor.length) {
      if (!open(floor[tx])) {
        tx++;
        continue;
      }
      let end = tx;
      while (end < floor.length && open(floor[end])) end++;
      const len = end - tx;
      if (len > PIT_MAX_TILES) {
        for (let i = tx; i < end; i++) this.tileSpr(i, ty + 1, false);
      } else {
        const x = (tx + len / 2) * TILE;
        this.add.rectangle(x, (ty + 1) * TILE - 5, len * TILE, 10, 0x7a1f3d, 0.9).setDepth(1);
      }
      tx = end;
    }
    // DLC: one Christmas tree collectable per room, a little before the exit door
    // (on the first tile with floor under it, so it never hangs over a gap)
    if (this.xmasLevel()) {
      const ex = Math.floor(this.exitPt.x / TILE);
      const below = this.level.rows[Math.floor(this.exitPt.y / TILE) + 1] ?? "";
      let tx = Math.max(2, ex - 3);
      while (tx < ex - 1 && !"#=".includes(below[tx] ?? ".")) tx++;
      this.dropXmas(tx * TILE + TILE / 2, this.exitPt.y - 24, "tree");
    }
  }

  /* ---------------- 'Tis the Seasones DLC ---------------- */

  private xmasLevel() {
    return xmasOn() && !this.level.isHub && !this.level.isBoss && !this.isHouse;
  }

  private dropXmas(x: number, y: number, kind: CollectableKind) {
    const info = COLLECTABLES[kind];
    const s = this.pickups.create(x, y, XMAS_PK, info.frame) as Phaser.Physics.Arcade.Sprite;
    s.setDisplaySize(kind === "tree" ? 46 : 38, kind === "tree" ? 46 : 38);
    (s.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    s.setData("value", info.points);
    s.setData("xmas", kind);
    this.tweens.add({ targets: s, y: y - 6, yoyo: true, duration: 700, repeat: -1, ease: "Sine.easeInOut" });
  }

  private bootXmas() {
    const on = xmasOn();
    const coop = on && xmas().coop;
    setCoopInput(coop);
    if (!on && !this.isHouse) return;
    if (coop) this.spawnPartner();
    this.refreshCosmetics();
    const onPost = (_t: number, delta: number) => {
      for (const r of this.rigs) {
        const spr = r.spr();
        if (!spr?.active) continue;
        const body = spr.body as Phaser.Physics.Arcade.Body;
        r.rig.update(Math.min(delta, 50) / 1000, r.facing(), !(body.blocked.down || body.touching.down));
      }
    };
    this.events.on("postupdate", onPost);
    this.events.once("shutdown", () => this.events.off("postupdate", onPost));
    // gentle snowfall everywhere the DLC is on (not inside the house)
    if (on && !this.isHouse) {
      this.add
        .particles(0, 0, "px", {
          x: { min: 0, max: 1280 },
          y: -10,
          lifespan: 7000,
          speedY: { min: 30, max: 70 },
          speedX: { min: -15, max: 15 },
          scale: { start: 1, end: 0.6 },
          alpha: { start: 0.75, end: 0.2 },
          frequency: 90,
          maxAliveParticles: 90,
        })
        .setScrollFactor(0)
        .setDepth(12);
    }
  }

  /** (Re)build the cosmetics drawn on P1/P2 — called after equipping at the pumpkin station. */
  refreshCosmetics() {
    this.rigs.forEach((r) => r.rig.destroy());
    this.rigs = [];
    if (!this.player) return;
    if (!this.textures.exists(XMAS_PK)) return;
    const add = (hero: HeroId, spr: () => Phaser.GameObjects.Sprite | null, facing: () => number) => {
      const ids = activeCosmetics(xmas(), hero);
      const target = spr();
      if (!ids.length || !target) return;
      this.rigs.push({ rig: new CosmeticRig(this, target, hero, ids), spr, facing });
    };
    add(this.hero, () => this.player, () => this.facing);
    if (this.partner) add(this.partner.hero, () => this.partner?.spr ?? null, () => this.partner?.facing ?? 1);
  }

  /** DLC: jump straight to Cuboe and Cubro's Home (pause/options menu). */
  enterHouse() {
    this.scene.restart({ levelId: "home-living" });
  }

  private spawnPartner() {
    const hero: HeroId = this.hero === "cuboe" ? "cubro" : "cuboe";
    const spr = this.physics.add.sprite(this.spawn.x + 56, this.spawn.y, `${hero}-idle`, 0);
    spr.setDisplaySize(64, 64);
    spr.setCollideWorldBounds(true);
    const body = spr.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(1900);
    body.setMaxVelocity(780, MAX_FALL_SPEED);
    body.setSize(54, 78).setOffset(37, 42);
    spr.play(`${hero}-idle`);
    spr.setDepth(6);
    const p: Partner = { spr, hero, facing: 1, coyote: 0, jumpBuf: 0, attackT: 0, dropT: 0 };
    this.partner = p;
    this.physics.add.collider(spr, this.solids);
    this.physics.add.collider(spr, this.oneWay, undefined, (_p, plat) =>
      this.oneWayLand(body, plat as Phaser.Physics.Arcade.Sprite, p.dropT > 0),
    );
    this.physics.add.overlap(spr, this.pickups, (_p, pk) => this.grab(pk as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(spr, this.shots, (_p, sh) => {
      const s = sh as Phaser.Physics.Arcade.Sprite;
      if (s.getData("friendly")) return;
      s.destroy();
      this.hurt(1);
    });
    this.camTarget = this.add.zone(this.spawn.x, this.spawn.y, 1, 1);
    this.add
      .text(0, 0, "P2", { fontFamily: "Lilita One, Impact, sans-serif", fontSize: "14px", color: "#3ecf8e", stroke: "#140c0a", strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(9)
      .setName("p2tag");
  }

  private controlPartner(dt: number) {
    const p = this.partner;
    if (!p || !p.spr.active) return;
    const a = readActionsP2();
    const body = p.spr.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down;
    p.coyote = grounded ? 0.11 : Math.max(0, p.coyote - dt);
    p.jumpBuf = a.jumpPressed ? 0.13 : Math.max(0, p.jumpBuf - dt);
    if (p.attackT > 0) p.attackT -= dt;
    if (p.dropT > 0) p.dropT -= dt;
    if (a.moveX !== 0) p.facing = a.moveX;
    p.spr.setFlipX(p.facing < 0);
    if (a.down && a.jumpPressed && grounded) p.dropT = 0.22;
    const run = a.run || p.hero === "cubro";
    const max = run ? (p.hero === "cubro" ? 560 : 480) : 260;
    if (a.moveX !== 0) body.setAccelerationX(a.moveX * (grounded ? 3200 : 1800));
    else {
      body.setAccelerationX(0);
      body.setVelocityX(body.velocity.x * (grounded ? 0.78 : 0.94));
    }
    if (Math.abs(body.velocity.x) > max) body.setVelocityX(max * Math.sign(body.velocity.x));
    const vy = body.velocity.y;
    body.setGravityY(vy > 0 ? 3400 : vy > -90 ? 1200 : 1900);
    if (this.isHouse && grounded && a.moveX !== 0 && !a.jump) this.stepUp(p.spr, a.moveX);
    if (p.jumpBuf > 0 && p.coyote > 0 && p.dropT <= 0) {
      body.setVelocityY(p.hero === "cubro" ? -820 : -760);
      p.coyote = 0;
      p.jumpBuf = 0;
      sfx.jump();
    }
    if (!a.jump && body.velocity.y < 0) body.setVelocityY(body.velocity.y * 0.52);
    if (body.velocity.y > MAX_FALL_SPEED) body.setVelocityY(MAX_FALL_SPEED);
    if (a.attackPressed && p.attackT <= 0) {
      p.attackT = 0.22;
      p.spr.play(`${p.hero}-attack`, true);
      sfx.attack();
      const hx = p.spr.x + p.facing * (p.hero === "cubro" ? 54 : 42);
      this.mobs.forEach((m) => {
        if (m.spr.active && Phaser.Math.Distance.Between(hx, p.spr.y, m.spr.x, m.spr.y) < 50) this.hitMob(m, 1);
      });
    }
    // stomp / bump enemies
    if (this.hurtT <= 0 && this.invulnT <= 0) {
      for (const m of this.mobs) {
        if (!m.spr.active || m.kind === "boss") continue;
        if (Phaser.Math.Distance.Between(p.spr.x, p.spr.y, m.spr.x, m.spr.y) >= 40) continue;
        if (body.velocity.y > 80 && p.spr.y < m.spr.y) {
          body.setVelocityY(-560);
          this.hitMob(m, 1);
        } else {
          this.hurt(1);
          body.setVelocity(-p.facing * 220, -240);
        }
        break;
      }
    }
    if (p.attackT <= 0) {
      const key = !grounded ? `${p.hero}-jump` : Math.abs(body.velocity.x) > 40 ? `${p.hero}-run` : `${p.hero}-idle`;
      if (p.spr.anims.currentAnim?.key !== key) p.spr.play(key, true);
    }
    // leash: P2 can't get lost off-screen or fall out
    const far = Math.abs(p.spr.x - this.player.x) > 1100 || Math.abs(p.spr.y - this.player.y) > 640;
    if (far || p.spr.y > worldSize(this.level).h + 40) {
      p.spr.setPosition(this.player.x - this.facing * 40, this.player.y - 20);
      body.setVelocity(0, 0);
    }
    if (this.camTarget) this.camTarget.setPosition((this.player.x + p.spr.x) / 2, (this.player.y + p.spr.y) / 2);
    const tag = this.children.getByName("p2tag") as Phaser.GameObjects.Text | null;
    tag?.setPosition(p.spr.x, p.spr.y - 48);
  }

  private dropPickup(x: number, y: number, frame: number, value: number) {
    const s = this.pickups.create(x, y, "pickups", frame) as Phaser.Physics.Arcade.Sprite;
    s.setDisplaySize(36, 36);
    (s.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    s.setData("value", value);
    this.tweens.add({ targets: s, y: y - 6, yoyo: true, duration: 700, repeat: -1, ease: "Sine.easeInOut" });
  }

  private spawnMob(x: number, y: number, kind: string) {
    if (ENEMY_INFO[kind]) return this.spawnBackroomsMob(x, y, kind);
    const key = kind === "cannon" ? "props" : kind;
    const spr = this.physics.add.sprite(x, y, key, 0);
    spr.setDisplaySize(kind === "cannon" ? 52 : 56, kind === "cannon" ? 40 : 56);
    spr.setCollideWorldBounds(true);
    (spr.body as Phaser.Physics.Arcade.Body).setGravityY(2200);
    (spr.body as Phaser.Physics.Arcade.Body).setSize(70, 80).setOffset(29, 40);
    this.physics.add.collider(spr, this.solids);
    this.physics.add.collider(spr, this.oneWay);
    if (kind !== "cannon" && this.anims.exists(`${kind}-walk`)) spr.play(`${kind}-walk`);
    this.mobs.push({ spr, kind, dir: Math.random() > 0.5 ? 1 : -1, hp: kind === "nincube" ? 2 : 1, next: 0 });
  }

  private spawnBoss(x: number, _y: number) {
    const id = this.level.bossId ?? "f1-boss";
    const info = BOSSES[id]!;
    // Stand the boss ON the floor. Spawning at the tile centre left its 67px-tall body
    // 18px inside the floor tile; that's more than Arcade's overlap bias, so the collider
    // never separated it and gravity pulled it through to the world bottom (inside the floor).
    const floorTop = this.arenaFloorTop(x);
    const spr = this.physics.add.sprite(x, floorTop - BOSS_FEET, info.sprite, 0);
    spr.setDisplaySize(id === ADMIN_BOSS_ID ? 120 : 96, id === ADMIN_BOSS_ID ? 120 : 96);
    spr.setDepth(5); // in front of the ground tiles (depth 1), behind the heroes
    (spr.body as Phaser.Physics.Arcade.Body).setGravityY(2200);
    (spr.body as Phaser.Physics.Arcade.Body).setSize(80, 90).setOffset(24, 30);
    spr.setData("floorTop", floorTop);
    spr.setCollideWorldBounds(true);
    this.physics.add.collider(spr, this.solids);
    const idle = this.anims.exists(`${info.sprite}-idle`) ? `${info.sprite}-idle` : info.sprite;
    if (this.anims.exists(idle)) spr.play(idle);
    spr.setData("open", false);
    spr.setData("phase", 1);
    spr.setData("adminPhase", 1);
    spr.setData("attacks", 0);
    spr.setFlipX(true);
    // Fake Cubro / Fake Cuboe: cursed sheets + aura, floating cursed bits and a glitch flicker.
    const cursed = id === "f3-boss" || id === "f4-boss";
    // Admin Warlords draw at 120px like their hitbox size (other bosses: 128px frames at 0.75 = 96px).
    const bacteria = id === BACKROOMS_BOSS;
    const rig = new BossRig(this, spr, {
      cursed,
      scale: id === ADMIN_BOSS_ID ? 120 / 128 : bacteria ? BACTERIA_SCALE : undefined,
      // feet sit 10 source px above the frame bottom
      drop: bacteria ? 10 * BACTERIA_SCALE : undefined,
    });
    const m: Mob = { spr, kind: "boss", dir: -1, hp: info.lives, next: this.time.now + 2000, rig };
    this.mobs.push(m);
    this.label = info.name;
    rig.entrance(() => {
      this.trauma = Math.min(1, this.trauma + 0.55);
      sfx.bossSlam();
      this.pop(x, floorTop - 130, info.name.toUpperCase());
      this.time.delayedCall(500, () => this.pop(x, floorTop - 100, id === ADMIN_BOSS_ID ? "EXTREME · HIT WHEN FLASHING" : "HIT WHEN FLASHING"));
    });
  }

  private spawnPlayer() {
    const h = this.hero;
    this.player = this.physics.add.sprite(this.spawn.x, this.spawn.y, `${h}-idle`, 0);
    this.player.setDisplaySize(64, 64);
    this.player.setCollideWorldBounds(true);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(1900);
    body.setMaxVelocity(780, MAX_FALL_SPEED);
    body.setSize(54, 78).setOffset(37, 42);
    this.player.play(`${h}-idle`);
    this.player.setDepth(6);
    const promo = useGame.getState().save.promo;
    if (h === "cuboe" && promo.includes("were-cuboe")) this.player.setTint(0x88ffaa);
    if (h === "cubro" && promo.includes("were-cubro")) this.player.setTint(0xff6688);
  }

  update(_t: number, delta: number) {
    if (this.frozen || this.scaring) return;
    const dt = Math.min(delta, 50) / 1000;
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    if (this.attackT > 0) this.attackT -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.shieldT > 0) this.shieldT -= dt;
    if (this.burstT > 0) this.burstT -= dt;
    if (this.dropT > 0) this.dropT -= dt;
    if (this.holeT > 0) this.holeT -= dt;
    if (this.invulnT > 0) this.invulnT -= dt;
    if (this.freezeT > 0) this.freezeT -= dt;
    if (this.speedT > 0) this.speedT -= dt;
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 2.2);
      const s = this.trauma * this.trauma;
      if (useGame.getState().save.settings.shake) {
        this.cameras.main.setScroll(
          this.cameras.main.scrollX + (Math.random() - 0.5) * 18 * s,
          this.cameras.main.scrollY + (Math.random() - 0.5) * 12 * s,
        );
      }
    }

    const actions = readActions();
    pollGamepad(actions);
    if (actions.pausePressed) {
      this.frozen = true;
      this.holdWorld(true);
      emitGame({ t: "pause" });
      return;
    }
    this.controlPlayer(actions, dt);
    this.tickRoomFx(dt);
    if (this.partner) this.controlPartner(dt);
    this.tickMobs();
    this.tickHazards();
    this.tickGoal();
    this.tickInteract(actions);
    this.tickPizza(dt);
    this.tickAnims();
    this.tickFx();
    if (this.player.y > worldSize(this.level).h + 40) this.fallOut();
    this.cameras.main.setFollowOffset(-this.facing * 90, 12);
    this.pushHud();
  }

  private tickFx() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (this.mach > 0.45 && (body.blocked.down || body.touching.down)) {
      this.dust.emitParticleAt(this.player.x - this.facing * 18, this.player.y + 26, 1);
    }
    if (this.holeT > 0) {
      this.mobs.forEach((m) => {
        if (!m.spr.active) return;
        const dx = this.player.x - m.spr.x;
        const dy = this.player.y - m.spr.y;
        (m.spr.body as Phaser.Physics.Arcade.Body).setVelocity(dx * 1.4, dy * 0.6);
      });
    }
  }

  private controlPlayer(actions: ReturnType<typeof readActions>, dt: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down;
    if (grounded) this.coyote = 0.11;
    else this.coyote = Math.max(0, this.coyote - dt);
    if (actions.jumpPressed) this.jumpBuf = 0.13;
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt);

    if (actions.moveX !== 0) this.facing = actions.moveX;
    this.player.setFlipX(this.facing < 0);

    if (actions.down && actions.jumpPressed && grounded) {
      this.dropT = 0.22;
    }

    const wantRun = actions.run || this.hero === "cubro";
    const speedMul = (HEROES[this.hero].speed ?? 1) * freezeSpeedMul(this.freezeT > 0);
    const walk = 260 * speedMul;
    const run = (this.hero === "cubro" ? 560 : 480) * speedMul;
    const max = this.burstT > 0 ? 760 * speedMul : this.speedT > 0 ? 640 * speedMul : wantRun ? run : walk;
    const swim = this.inWater(this.player);
    const accel = grounded ? 3200 : 1800;
    if (actions.moveX !== 0) {
      body.setAccelerationX(actions.moveX * accel);
      this.mach = Math.min(1, this.mach + dt * (wantRun ? 0.7 : 0.25));
    } else {
      body.setAccelerationX(0);
      body.setVelocityX(body.velocity.x * (grounded ? 0.78 : 0.94));
      this.mach = Math.max(0, this.mach - dt * 1.4);
    }
    const cap = swim ? max * 0.6 : max; // Pool Rooms water slows you down
    if (Math.abs(body.velocity.x) > cap) body.setVelocityX(cap * Math.sign(body.velocity.x));

    const vy = body.velocity.y;
    if (swim) body.setGravityY(vy > 0 ? 300 : 700);
    else if (vy > 0) body.setGravityY(3400);
    else if (vy > -90) body.setGravityY(1200);
    else body.setGravityY(1900);
    if (this.level.heaven && vy > 0) {
      // drifting down into the heaven room like a feather
      body.setGravityY(260);
      if (vy > 260) body.setVelocityY(260);
    }
    if (swim) {
      // safe water: sink slowly, Jump is a swim stroke (works anywhere in the pool)
      if (body.velocity.y > 170) body.setVelocityY(170);
      if (this.jumpBuf > 0 && this.dropT <= 0) {
        body.setVelocityY(-600);
        this.jumpBuf = 0;
        this.coyote = 0;
        sfx.jump();
        this.player.play(`${this.hero}-jump`, true);
      }
    }

    if (this.isHouse && grounded && actions.moveX !== 0 && !actions.jump) this.stepUp(this.player, actions.moveX);

    if (this.jumpBuf > 0 && this.coyote > 0 && this.dropT <= 0) {
      body.setVelocityY(this.hero === "cubro" ? -820 : -760);
      this.coyote = 0;
      this.jumpBuf = 0;
      sfx.jump();
      this.player.play(`${this.hero}-jump`, true);
    }
    if (!actions.jump && body.velocity.y < 0) body.setVelocityY(body.velocity.y * 0.52);
    if (actions.down && !grounded && body.velocity.y > 80) body.setVelocityY(capFallSpeed(body.velocity.y + 2400 * dt));
    if (body.velocity.y > MAX_FALL_SPEED) body.setVelocityY(MAX_FALL_SPEED);
    if (actions.attackPressed && this.attackT <= 0) this.doAttack(actions);
    if (actions.specialPressed) this.doSpecial(actions);

    if (this.shieldT > 0) this.player.setTint(0x9ad7ff);
    else if (this.hurtT > 0) this.player.setTint(0xff6677);
    else if (this.freezeT > 0) this.player.setTint(0x9fe8ff);
    else if (this.burstT > 0) this.player.setTint(0xffe066);
    else if (this.invulnT > 0) this.player.setTint(0xffffff);
    else {
      const promo = useGame.getState().save.promo;
      if (this.hero === "cuboe" && promo.includes("were-cuboe")) this.player.setTint(0x88ffaa);
      else if (this.hero === "cubro" && promo.includes("were-cubro")) this.player.setTint(0xff6688);
      else this.player.clearTint();
    }
  }

  /** Arcade process callback: swept test so a fast fall still lands on a one-way platform. */
  private oneWayLand(body: Phaser.Physics.Arcade.Body, plat: Phaser.Physics.Arcade.Sprite, dropping: boolean) {
    const pb = plat.body as Phaser.Physics.Arcade.StaticBody;
    return shouldLandOnFloor({
      velocityY: body.velocity.y,
      dropping,
      oneWay: true,
      prev: this.prevAabb(body),
      curr: this.bodyAabb(body),
      floor: this.bodyAabb(pb),
    });
  }

  private bodyAabb(body: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody): Aabb {
    return { left: body.x, right: body.right, top: body.y, bottom: body.bottom };
  }

  private prevAabb(body: Phaser.Physics.Arcade.Body): Aabb {
    const x = body.prev.x;
    const y = body.prev.y;
    return { left: x, right: x + body.width, top: y, bottom: y + body.height };
  }

  private listFloors(): { aabb: Aabb; oneWay?: boolean }[] {
    const out: { aabb: Aabb; oneWay?: boolean }[] = [];
    const add = (group: Phaser.Physics.Arcade.StaticGroup, oneWay?: boolean) => {
      group.getChildren().forEach((obj) => {
        const b = (obj as Phaser.Physics.Arcade.Image).body as Phaser.Physics.Arcade.StaticBody | null;
        if (!b) return;
        out.push({ aabb: this.bodyAabb(b), oneWay });
      });
    };
    add(this.solids);
    add(this.oneWay, true);
    return out;
  }

  /** After the physics step, snap anyone who tunneled through a floor back on top. */
  private snapToFloors() {
    if (this.frozen) return;
    this.landIfTunneled(this.player, this.dropT > 0);
    if (this.partner?.spr.active) this.landIfTunneled(this.partner.spr, this.partner.dropT > 0);
  }

  private landIfTunneled(spr: Phaser.Physics.Arcade.Sprite, dropping: boolean) {
    const body = spr.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return;
    if (body.velocity.y > MAX_FALL_SPEED) body.setVelocityY(MAX_FALL_SPEED);
    const floors = dropping ? this.listFloors().filter((f) => !f.oneWay) : this.listFloors();
    const top = landingFloorTop({
      velocityY: body.velocity.y,
      dropping,
      prev: this.prevAabb(body),
      curr: this.bodyAabb(body),
      floors,
    });
    if (top === null) return;
    if (body.bottom <= top + 2 && (body.blocked.down || body.touching.down)) return;
    const lift = body.bottom - spr.y;
    body.reset(spr.x, top - lift);
    body.setVelocityY(0);
  }

  /** House stairs: walking into a one-tile step climbs it, so the staircases work like stairs. */
  private stepUp(spr: Phaser.Physics.Arcade.Sprite, dir: number) {
    const body = spr.body as Phaser.Physics.Arcade.Body;
    if (!(dir > 0 ? body.blocked.right : body.blocked.left)) return;
    const rows = this.level.rows;
    const col = Math.floor((dir > 0 ? body.right + 2 : body.left - 2) / TILE);
    const footRow = Math.floor((body.bottom - 2) / TILE);
    const solid = (r: number) => rows[r]?.[col] === "#";
    if (!solid(footRow) || solid(footRow - 1) || solid(footRow - 2)) return;
    const lift = body.bottom - spr.y;
    const vx = body.velocity.x;
    body.reset(spr.x + dir * 6, footRow * TILE - lift - 1);
    body.setVelocityX(vx || dir * 120);
  }

  private tickAnims() {
    if (this.attackT > 0) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down;
    const key = !grounded ? `${this.hero}-jump` : Math.abs(body.velocity.x) > 40 ? `${this.hero}-run` : `${this.hero}-idle`;
    if (this.player.anims.currentAnim?.key !== key) this.player.play(key, true);
  }

  private spend(n: number) {
    if (this.meter < n) return false;
    this.meter -= n;
    return true;
  }

  private doAttack(actions: ReturnType<typeof readActions>) {
    this.attackT = 0.22;
    this.player.play(`${this.hero}-attack`, true);
    sfx.attack();
    const grounded = (this.player.body as Phaser.Physics.Arcade.Body).blocked.down;

    if (usesCuboeKit(this.hero) && actions.up && this.spend(30)) {
      this.masterCombo("beams");
      this.shoot(this.player.x, this.player.y, 1);
      this.shoot(this.player.x, this.player.y, -1);
      this.pop(this.player.x, this.player.y - 40, "BEAMS");
      return;
    }
    if (usesCuboeKit(this.hero) && !grounded && this.spend(35)) {
      this.masterCombo("laser");
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.shootAngle(this.player.x, this.player.y, Math.cos(a), Math.sin(a));
      }
      this.pop(this.player.x, this.player.y - 40, "LASER");
      return;
    }
    if (this.hero === "cubro" && actions.up && this.spend(40)) {
      this.doBurst();
      return;
    }
    if (this.hero === "cubro" && actions.run && this.spend(25)) {
      this.masterCombo("rocket");
      this.shoot(this.player.x + this.facing * 20, this.player.y, this.facing, true);
      this.pop(this.player.x, this.player.y - 40, "ROCKET");
      return;
    }

    const reach = this.hero === "cubro" ? 54 : 42;
    const hx = this.player.x + this.facing * reach;
    const hy = this.player.y;
    this.mobs.forEach((m) => {
      if (!m.spr.active) return;
      if (Phaser.Math.Distance.Between(hx, hy, m.spr.x, m.spr.y) < 50) this.hitMob(m, 1);
    });
    if (this.hero === "cubro" && this.mach > 0.4) {
      this.masterCombo("tornado");
      this.mobs.forEach((m) => {
        if (m.spr.active && Math.abs(m.spr.x - this.player.x) < 90 && Math.abs(m.spr.y - this.player.y) < 60)
          this.hitMob(m, 1);
      });
    }
  }

  private doSpecial(actions: ReturnType<typeof readActions>) {
    if (usesCuboeKit(this.hero)) {
      if (actions.up && this.spend(40)) {
        this.holeT = 2;
        this.masterCombo("blackhole");
        sfx.boom();
        this.pop(this.player.x, this.player.y - 40, "BLACK HOLE");
      } else if (this.spend(20)) {
        this.shieldT = 5;
        this.masterCombo("shield");
        sfx.ui();
      }
    } else if (actions.up && this.spend(50)) {
      this.burstT = 8;
      this.speedT = 8;
      this.masterCombo("infinity");
      sfx.pizza();
      this.pop(this.player.x, this.player.y - 40, "INFINITY");
    } else if (this.spend(25)) {
      this.shieldT = 8;
      this.masterCombo("barrier");
      sfx.ui();
      this.pop(this.player.x, this.player.y - 40, "BARRIER");
    }
  }

  private doBurst() {
    this.burstT = 1.2;
    this.masterCombo("burst");
    sfx.boom();
    this.trauma = Math.min(1, this.trauma + 0.55);
    let kills = 0;
    this.mobs.forEach((m) => {
      if (!m.spr.active) return;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, m.spr.x, m.spr.y) < 180) {
        this.hitMob(m, 3);
        kills++;
      }
    });
    if (kills) useGame.getState().persist({ saiyanKills: useGame.getState().save.saiyanKills + kills });
    this.pop(this.player.x, this.player.y - 40, "BURST");
  }

  private hitMob(m: Mob, dmg: number) {
    if (m.spr.getData("flash")) return;
    if (m.kind === "boss" && !m.spr.getData("open")) {
      this.pop(m.spr.x, m.spr.y - 50, "WAIT FOR THE FLASH");
      return;
    }
    if (m.dying) return;
    m.hp -= dmg;
    if (m.kind === "boss") m.rig?.flinch(this.player.x < m.spr.x ? 1 : -1);
    m.spr.setTintFill(0xffffff);
    m.spr.setData("flash", true);
    this.time.delayedCall(80, () => {
      if (m.spr.active) {
        m.spr.clearTint();
        m.spr.setData("flash", false);
      }
    });
    this.trauma = Math.min(1, this.trauma + 0.28);
    this.dust.emitParticleAt(m.spr.x, m.spr.y, 6);
    sfx.hit();
    this.addCombo(100);
    this.meter = Math.min(100, this.meter + 8);
    if (m.hp <= 0) {
      if (m.kind === "boss" && this.advanceAdminPhase(m)) return;
      this.pop(m.spr.x, m.spr.y, m.kind === "boss" ? "KO" : "+100");
      if (m.kind === "boss") this.defeatBoss(m);
      else {
        m.spr.destroy();
        this.kills++;
      }
    }
  }


  private isAdminFight() {
    return (this.level.bossId ?? "") === ADMIN_BOSS_ID;
  }

  /** 10 hits down in phase 1 or 2: swap to the next warlord, refill, keep fighting. */
  private advanceAdminPhase(m: Mob): boolean {
    if (!this.isAdminFight()) return false;
    const next = nextAdminPhase(Number(m.spr.getData("adminPhase") ?? 1));
    if (!next) return false;
    m.hp = ADMIN_PHASE_HP;
    m.spr.setData("adminPhase", next);
    m.spr.setData("phase", next);
    m.spr.setData("open", false);
    m.spr.setData("move", "");
    const key = next === 2 ? "warlord-2" : "warlord-3";
    if (this.textures.exists(key)) {
      // Play the new warlord's own idle loop; otherwise the old idle anim keeps drawing the previous phase.
      if (this.anims.exists(`${key}-idle`)) m.spr.play(`${key}-idle`);
      else m.spr.setTexture(key);
    }
    m.spr.setDisplaySize(120, 120);
    this.clearAdminFx();
    m.rig?.fade(1, 150); // a teleport wind-up may have faded them
    this.hazards.forEach((h) => h.destroy());
    this.hazards = [];
    this.shots.getChildren().forEach((c) => {
      if (!(c as Phaser.GameObjects.Sprite).getData("friendly")) c.destroy();
    });
    m.rig?.phaseUp(0x9a5cff);
    this.trauma = Math.min(1, this.trauma + 0.55);
    this.cameras.main.flash(140, 180, 160, 255);
    sfx.bossRoar();
    this.pop(m.spr.x, m.spr.y - 110, next === 3 ? "FINAL PHASE!" : "PHASE 2!");
    this.label = `Admin Warlords · Phase ${next}`;
    m.next = this.time.now + 900;
    return true;
  }

  private fireAdminOrb(x: number, y: number, vx: number, vy: number) {
    const hard = this.hero === "candy-cube" ? 1.12 : 1;
    const b = this.shots.create(x, y, "admin-orb") as Phaser.Physics.Arcade.Sprite;
    b.setDisplaySize(28, 28);
    b.setDepth(7);
    b.setData("friendly", false);
    const body = b.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocity(vx * hard, vy * hard);
    this.time.delayedCall(2400, () => b.destroy());
  }

  /**
   * Extreme but fair Admin Warlords AI: orbs come from their hands, each phase
   * is denser and faster, open windows shrink, and every volley leaves a dodge lane.
   */
  private tickAdminWarlords(m: Mob, now: number) {
    const phase = (Number(m.spr.getData("adminPhase") ?? 1) || 1) as AdminPhase;
    this.label = `Admin Warlords · Phase ${phase}`;
    if (now < m.next) return;
    const attacks = Number(m.spr.getData("attacks") ?? 0);
    const pat = patternAt(phase, attacks);
    const move = String(m.spr.getData("move") ?? "");
    if (!move && powerDue(phase, Number(m.spr.getData("sincePower") ?? 0))) {
      this.startAdminPower(m, phase, now);
      return;
    }
    if (move === "power") {
      if (now < Number(m.spr.getData("moveUntil") ?? 0)) return;
      const id = String(m.spr.getData("power")) as AdminPowerId;
      this.runAdminPower(m, id);
      m.spr.setData("move", "");
      m.spr.setData("sincePower", 0);
      m.spr.setData("powers", Number(m.spr.getData("powers") ?? 0) + 1);
      m.next = now + ADMIN_POWERS[id].recoverMs;
      return;
    }
    if (!move) {
      m.spr.setData("move", "tell");
      m.spr.setData("moveUntil", now + pat.telegraphMs);
      m.spr.setTint(0xffe066);
      sfx.bossWarn();
      m.next = now + 16;
      return;
    }
    if (move === "tell") {
      if (now < Number(m.spr.getData("moveUntil") ?? 0)) return;
      m.spr.clearTint();
      m.spr.setData("move", "fire");
      const px = this.player.x - m.spr.x;
      const py = this.player.y - m.spr.y;
      // Aim patterns that used local "toward +y" at the player by rotating? Most
      // patterns already have absolute velocities. Retarget spread/stream at the player.
      for (const o of pat.orbs) {
        let vx = o.vx;
        let vy = o.vy;
        if (pat.id === "spread3" || pat.id === "spread5" || pat.id === "double" || pat.id === "stream" || pat.id === "hands") {
          const speed = Math.hypot(o.vx, o.vy) || 300;
          const tx = px + o.ox * 0.4;
          const ty = py;
          const len = Math.hypot(tx, ty) || 1;
          vx = (tx / len) * speed;
          vy = (ty / len) * speed;
        }
        const sx = m.spr.x + o.ox;
        const sy = m.spr.y + o.oy;
        this.time.delayedCall(o.delay, () => {
          if (m.spr.active && !m.dying) this.fireAdminOrb(sx, sy, vx, vy);
        });
      }
      const last = pat.orbs.reduce((n, o) => Math.max(n, o.delay), 0);
      m.spr.setData("moveUntil", now + last + pat.recoverMs);
      m.next = now + 16;
      return;
    }
    if (move === "fire") {
      if (now < Number(m.spr.getData("moveUntil") ?? 0)) return;
      m.spr.setData("move", "");
      m.spr.setData("attacks", attacks + 1);
      m.spr.setData("sincePower", Number(m.spr.getData("sincePower") ?? 0) + 1);
      this.openBoss(m, pat.openMs);
      m.next = now + pat.openMs + 80;
    }
  }

  private clearAdminFx() {
    this.adminFx.forEach((o) => o.destroy());
    this.adminFx = [];
  }

  private adminFloorY(x: number) {
    return this.arenaFloorTop(x);
  }

  /** Admin power wind-up: yellow boss, "!" overhead, "ADMIN: ..." pop-up and a marker where it will hit. */
  private startAdminPower(m: Mob, phase: AdminPhase, now: number) {
    const id = powerAt(phase, Number(m.spr.getData("powers") ?? 0));
    const p = ADMIN_POWERS[id];
    m.spr.setData("move", "power");
    m.spr.setData("power", id);
    m.spr.setData("moveUntil", now + p.warnMs);
    m.rig?.telegraph(0xffe066, p.warnMs);
    sfx.bossWarn();
    this.pop(m.spr.x, m.spr.y - 120, p.popup);
    const w = worldSize(this.level).w;
    const pulse = (o: Phaser.GameObjects.Shape) => {
      o.setDepth(6);
      this.adminFx.push(o);
      this.tweens.add({ targets: o, alpha: { from: 0.9, to: 0.35 }, duration: 140, yoyo: true, repeat: -1 });
      return o;
    };
    if (id === "teleport") {
      const tx = teleportTarget(this.player.x, TILE * 4, w - TILE * 4);
      m.spr.setData("powerX", tx);
      pulse(this.add.ellipse(tx, this.adminFloorY(tx) - 4, 100, 20, 0x9a5cff, 0.5).setStrokeStyle(3, 0xffe066, 1));
      m.rig?.fade(0.35, p.warnMs);
    } else if (id === "spawn") {
      const xs = [-150, 150].map((dx) => Phaser.Math.Clamp(this.player.x + dx, TILE * 3, w - TILE * 3));
      m.spr.setData("powerXs", xs);
      for (const x of xs) pulse(this.add.ellipse(x, this.adminFloorY(x) - 4, 60, 14, 0xff46c4, 0.5).setStrokeStyle(3, 0xffe066, 1));
    } else if (id === "banhammer") {
      const x = this.player.x;
      const floor = this.adminFloorY(x);
      m.spr.setData("powerX", x);
      pulse(this.add.rectangle(x, floor / 2, ADMIN_POWERS.banhammer.width, floor, 0xffe066, 0.18).setStrokeStyle(4, 0xffe066, 1));
    } else if (id === "freeze") {
      m.spr.setData("powerX", this.player.x);
      m.spr.setData("powerY", this.player.y);
      pulse(this.add.circle(this.player.x, this.player.y, ADMIN_POWERS.freeze.radius, 0x9fe8ff, 0.15).setStrokeStyle(4, 0xffe066, 1));
    }
  }

  private runAdminPower(m: Mob, id: AdminPowerId) {
    this.clearAdminFx();
    if (id === "teleport") {
      const tx = Number(m.spr.getData("powerX") ?? m.spr.x);
      const ty = this.adminFloorY(tx) - BOSS_FEET;
      m.rig?.burst(m.spr.x, m.spr.y - 20, 18);
      (m.spr.body as Phaser.Physics.Arcade.Body).reset(tx, ty);
      m.dir = this.player.x < tx ? -1 : 1;
      m.rig?.fade(1, 220);
      m.rig?.burst(tx, ty - 20, 18);
      this.cameras.main.flash(90, 154, 92, 255);
      sfx.bossWhoosh();
    } else if (id === "spawn") {
      const xs = (m.spr.getData("powerXs") as number[] | undefined) ?? [];
      for (const x of xs) {
        const alive = this.mobs.filter((mm) => mm.kind !== "boss" && mm.spr.active).length;
        if (alive >= ADMIN_POWERS.spawn.maxAlive) break;
        this.spawnMob(x, this.adminFloorY(x) - 26, "boxguy");
        m.rig?.burst(x, this.adminFloorY(x) - 20, 10);
      }
      sfx.bossZap();
    } else if (id === "glitch") {
      // Screen static only: controls are untouched.
      const cam = this.cameras.main;
      const bars = Array.from({ length: 14 }, () =>
        this.add.rectangle(0, 0, 10, 10, 0x9a5cff, 0.3).setOrigin(0, 0).setScrollFactor(0).setDepth(40),
      );
      bars.forEach((b) => this.adminFx.push(b));
      const colors = [0x9a5cff, 0x7dff3a, 0xff3ccf, 0x8be9ff, 0x000000];
      const shuffle = () => {
        for (const b of bars) {
          if (!b.active) continue;
          b.setPosition(Math.random() * cam.width, Math.random() * cam.height);
          b.setSize(40 + Math.random() * cam.width * 0.5, 3 + Math.random() * 14);
          b.setFillStyle(colors[Math.floor(Math.random() * colors.length)]!, 0.22 + Math.random() * 0.2);
        }
      };
      shuffle();
      const ev = this.time.addEvent({ delay: 60, repeat: Math.floor(ADMIN_POWERS.glitch.durationMs / 60), callback: shuffle });
      cam.shake(ADMIN_POWERS.glitch.durationMs, 0.003);
      this.time.delayedCall(ADMIN_POWERS.glitch.durationMs, () => {
        ev.remove();
        bars.forEach((b) => b.destroy());
      });
      sfx.bossZap();
    } else if (id === "banhammer") {
      const b = ADMIN_POWERS.banhammer;
      const x = Number(m.spr.getData("powerX") ?? this.player.x);
      const floor = this.adminFloorY(x);
      const col = this.add.rectangle(x, floor / 2, b.width, floor, 0x9a5cff, 0.9).setStrokeStyle(4, 0xfff4b0, 1).setDepth(8);
      col.setScale(1, 0.05);
      this.tweens.add({ targets: col, scaleY: 1, duration: 90, ease: "Quad.easeIn" });
      this.hazards.push(col);
      this.trauma = Math.min(1, this.trauma + 0.5);
      sfx.bossSlam();
      this.time.delayedCall(b.activeMs, () => {
        if (!col.active) return;
        this.tweens.add({ targets: col, alpha: 0, duration: 200, onComplete: () => col.destroy() });
      });
    } else if (id === "freeze") {
      const f = ADMIN_POWERS.freeze;
      const cx = Number(m.spr.getData("powerX") ?? this.player.x);
      const cy = Number(m.spr.getData("powerY") ?? this.player.y);
      const burst = this.add.circle(cx, cy, f.radius, 0x9fe8ff, 0.55).setDepth(8);
      this.tweens.add({ targets: burst, alpha: 0, scale: 1.2, duration: 380, onComplete: () => burst.destroy() });
      if (inFreeze(this.player.x, this.player.y, cx, cy) && this.shieldT <= 0 && this.invulnT <= 0) {
        this.freezeT = f.durationMs / 1000;
        this.pop(this.player.x, this.player.y - 50, "FROZEN!");
      }
      sfx.bossZap();
    }
  }

  /** Boss KO: stop the fight, clear its attacks, play the defeat burst, then the rank screen. */
  private defeatBoss(m: Mob) {
    m.dying = true;
    this.clearAdminFx();
    m.spr.setData("move", "");
    const body = m.spr.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    body.setGravityY(0);
    this.invulnT = Math.max(this.invulnT, 3);
    this.hazards.forEach((h) => h.destroy());
    this.hazards = [];
    this.shots.getChildren().forEach((c) => {
      if (!(c as Phaser.GameObjects.Sprite).getData("friendly")) c.destroy();
    });
    this.mobs.forEach((mm) => {
      if (mm !== m && mm.spr.active) mm.spr.destroy();
    });
    this.trauma = Math.min(1, this.trauma + 0.8);
    sfx.bossRoar();
    const done = () => {
      m.rig?.destroy();
      m.spr.destroy();
      this.winBoss();
    };
    if (m.rig) m.rig.defeat(() => this.time.delayedCall(0, done));
    else done();
  }

  private tickMobs() {
    const now = this.time.now;
    for (const m of this.mobs) {
      if (!m.spr.active) continue;
      if (m.spr.y > worldSize(this.level).h + TILE * 2) {
        m.spr.destroy();
        continue;
      }
      const body = m.spr.body as Phaser.Physics.Arcade.Body;
      if (!m.dying) m.spr.setFlipX(m.dir < 0);
      if (m.kind === "boss") {
        if (!m.dying) this.tickBoss(m, now);
        m.rig?.sync(now, {
          flash: !!m.spr.getData("flash"),
          open: !!m.spr.getData("open"),
          busy: !!m.spr.getData("move"),
          warn: m.spr.getData("move") === "tell" || m.spr.getData("move") === "power",
        });
        continue;
      }
      const hard = this.hero === "candy-cube" ? 1.2 : 1;
      if (ENEMY_INFO[m.kind]) {
        this.tickBackroomsMob(m, body, now, hard);
        if (ENEMY_INFO[m.kind]!.harmless) continue; // hub moths are just ambience
      } else {
      const spd = (m.kind === "nincube" ? 90 : m.kind === "pump" ? 55 : 70) * hard;
      if (m.kind !== "cannon") body.setVelocityX(m.dir * spd);
      if (body.blocked.left) m.dir = 1;
      if (body.blocked.right) m.dir = -1;
      if (m.kind === "cannon") {
        m.dir = this.player.x < m.spr.x ? -1 : 1;
        if (now > m.next) {
          m.next = now + 1600;
          this.shoot(m.spr.x + m.dir * 24, m.spr.y, m.dir);
        }
      }
      if (m.kind === "pump" && body.blocked.down && Math.random() < 0.01) body.setVelocityY(-420);
      }
      if (this.hurtT <= 0 && this.shieldT <= 0 && this.invulnT <= 0 && this.player.active) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.spr.x, m.spr.y);
        if (dist < 40) {
          const pbody = this.player.body as Phaser.Physics.Arcade.Body;
          if (pbody.velocity.y > 80 && this.player.y < m.spr.y) {
            pbody.setVelocityY(-560);
            this.hitMob(m, 1);
            this.masterCombo("aeraste");
          } else {
            this.hurt(1);
            pbody.setVelocity(-this.facing * 220, -240);
          }
        }
      }
    }
  }

  private openBoss(m: Mob, ms = 700) {
    m.spr.setTint(0xffe088);
    m.spr.setData("open", true);
    this.time.delayedCall(ms, () => {
      if (!m.spr.active) return;
      m.spr.clearTint();
      m.spr.setData("open", false);
    });
  }

  /** Safety net: if anything ever pushes a boss into the floor, put it back on top. */
  private keepBossOnFloor(m: Mob) {
    const body = m.spr.body as Phaser.Physics.Arcade.Body;
    const floorTop = Number(m.spr.getData("floorTop") ?? this.arenaFloorTop(m.spr.x));
    if (body.bottom > floorTop + 2) {
      body.reset(m.spr.x, floorTop - BOSS_FEET);
      body.setVelocityY(0);
    }
  }

  private tickBoss(m: Mob, now: number) {
    this.keepBossOnFloor(m);
    const id = this.level.bossId ?? "f1-boss";
    if (id === ADMIN_BOSS_ID) {
      if (!m.rig?.entering) this.tickAdminWarlords(m, now);
      return;
    }
    this.bossPhase(m, id);
    if (id === "f1-boss") {
      if (!m.rig?.entering) this.tickChocoMan(m, now);
      return;
    }
    tickBrain(this.host(), id, m, now);
  }

  /** Phase 2 at 2/3 health, phase 3 at 1/3: roar, flash and a ring burst. */
  private bossPhase(m: Mob, id: string) {
    const max = BOSSES[id]?.lives ?? m.hp;
    const p = phaseFor(m.hp, max);
    const was = Number(m.spr.getData("phase") ?? 1);
    if (p <= was) return;
    m.spr.setData("phase", p);
    m.rig?.phaseUp(BOSS_COLOR[id] ?? 0xffffff);
    this.trauma = Math.min(1, this.trauma + 0.5);
    this.cameras.main.flash(120, 255, 240, 200);
    sfx.bossRoar();
    const form = BOSS_FORMS[id]?.[p];
    if (form && m.spr.texture.key !== form.sprite && this.textures.exists(form.sprite)) {
      // Bacteria <-> Void: a new sheet, same frames
      m.spr.setTexture(form.sprite, 0);
      if (this.anims.exists(`${form.sprite}-idle`)) m.spr.play(`${form.sprite}-idle`);
      this.label = form.name;
      m.rig?.burst(m.spr.x, m.spr.y - 60, 30);
      this.cameras.main.flash(260, 20, 0, 40);
      this.pop(m.spr.x, m.spr.y - 150, form.name === "Void" ? "VOID" : "BACTERIA RETURNS");
    }
    this.pop(m.spr.x, m.spr.y - 110, p === 3 ? "FINAL PHASE!" : "PHASE 2!");
    // a short roar pause before the new moves
    m.next = Math.max(m.next, this.time.now + 700);
  }

  /** What the boss brains (src/game/bosses) can do in this room. */
  private host(): BossHost {
    if (this.bossHost) return this.bossHost;
    const floorTop = this.arenaFloorTop(this.player?.x ?? 0);
    this.bossHost = {
      scene: this,
      floorTop,
      worldW: worldSize(this.level).w,
      target: () => ({ x: this.player.x, y: this.player.y }),
      shot: (x, y, vx, vy, o = {}) => {
        const b = this.shots.create(x, y, "pickups", o.frame ?? 0) as Phaser.Physics.Arcade.Sprite;
        b.setDisplaySize(o.w ?? 22, o.h ?? 22);
        if (o.tint !== undefined) b.setTint(o.tint);
        b.setDepth(7);
        b.setData("friendly", false);
        const body = b.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(!!o.gravity);
        if (o.gravity) body.setGravityY(o.gravity);
        body.setVelocity(vx, vy);
        this.time.delayedCall(o.life ?? 2600, () => b.destroy());
        return b;
      },
      hazard: (obj) => {
        this.hazards.push(obj);
      },
      melee: (m, reach) => this.bossMelee(m, reach),
      open: (m, ms) => this.openBoss(m, ms),
      pop: (x, y, text) => this.pop(x, y, text),
      shake: (n) => {
        this.trauma = Math.min(1, this.trauma + n);
      },
      summon: (x, kind = "boxguy") => {
        const alive = this.mobs.filter((mm) => mm.kind !== "boss" && mm.spr.active).length;
        if (alive >= 2) return false;
        this.spawnMob(x, floorTop - 26, kind);
        return true;
      },
      sound: (k) => {
        const map = { telegraph: sfx.bossWarn, fire: sfx.bossFire, slam: sfx.bossSlam, whoosh: sfx.bossWhoosh, zap: sfx.bossZap, roar: sfx.bossRoar };
        map[k]();
      },
    };
    return this.bossHost;
  }

  /** Boss hazard shapes hurt a hero who touches them (shield/invulnerability still protect). */
  private tickHazards() {
    if (!this.hazards.length) return;
    this.hazards = this.hazards.filter((h) => h.active);
    const heroes = [this.player, this.partner?.spr].filter((s): s is Phaser.Physics.Arcade.Sprite => !!s && s.active);
    for (const h of this.hazards) {
      if (h.alpha < 0.3) continue; // fading out
      const r = h.getBounds();
      for (const hero of heroes) {
        const b = hero.body as Phaser.Physics.Arcade.Body;
        if (!Phaser.Geom.Intersects.RectangleToRectangle(r, new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height))) continue;
        if (this.shieldT > 0 || this.invulnT > 0 || this.hurtT > 0) continue;
        this.hurt(1);
      }
    }
  }

  private bossMelee(m: Mob, reach: number) {
    if (this.hurtT > 0 || this.shieldT > 0 || this.invulnT > 0) return;
    if (!this.player.active) return;
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, m.spr.x, m.spr.y) < reach) this.hurt(1);
  }

  private endChocoMove(m: Mob, recover = 620) {
    const was = String(m.spr.getData("move") ?? "");
    if (was === "shoryuken" || was === "jump" || was === "tatsu") {
      m.rig?.land();
      this.trauma = Math.min(1, this.trauma + 0.2);
    }
    m.spr.setData("move", "");
    m.spr.setRotation(0);
    const body = m.spr.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(0);
    this.openBoss(m);
    m.next = this.time.now + recover;
  }

  private tickChocoMan(m: Mob, now: number) {
    const body = m.spr.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down;
    const dx = this.player.x - m.spr.x;
    const dist = Math.abs(dx);
    const move = String(m.spr.getData("move") ?? "");
    const until = Number(m.spr.getData("moveUntil") ?? 0);
    if (move && now > until + 4000) {
      this.endChocoMove(m, 400); // watchdog: never stall mid-move
      return;
    }
    if (move !== "tatsu") m.dir = dx < 0 ? -1 : 1;

    if (move === "shoryuken") {
      this.bossMelee(m, 84);
      if (!grounded) body.setVelocityX(m.dir * 110);
      if (grounded && now > until) this.endChocoMove(m, 500);
      return;
    }
    if (move === "tatsu") {
      this.bossMelee(m, 72);
      if (body.blocked.left) m.dir = 1;
      if (body.blocked.right) m.dir = -1;
      m.spr.rotation += m.dir * 0.42;
      body.setVelocityX(m.dir * (m.hp <= 3 ? 560 : 470));
      if (grounded && now < until - 80 && Math.random() < 0.12) body.setVelocityY(-280);
      if (now > until) this.endChocoMove(m, 560);
      return;
    }
    if (move === "jump") {
      this.bossMelee(m, 58);
      if (grounded && now > until) {
        if (m.hp <= 5 && dist > 80) this.chocoHadoken(m);
        else this.endChocoMove(m, 460);
      }
      return;
    }
    if (move === "rush") {
      this.bossMelee(m, 64);
      body.setVelocityX(m.dir * 400);
      if (now > until) this.endChocoMove(m, 480);
      return;
    }
    if (move === "hadoken") {
      if (now > until) this.endChocoMove(m, 680);
      return;
    }
    if (move === "windup") {
      // telegraph: he crouches and glows in the colour of the move that's coming
      if (grounded) body.setVelocityX(body.velocity.x * 0.7);
      this.bossMelee(m, 46);
      if (now > until) this.chocoGo(m, String(m.spr.getData("pick") ?? "rush"));
      return;
    }

    if (now < m.next) {
      if (grounded) body.setVelocityX(body.velocity.x * 0.82);
      this.bossMelee(m, 46);
      return;
    }

    const angry = m.hp <= 3;
    let pick = "rush";
    if (this.player.y < m.spr.y - 70 && dist < 240) pick = "shoryuken";
    else if (dist > 260) pick = Math.random() < 0.72 ? "hadoken" : "jump";
    else if (dist < 100) pick = Math.random() < 0.6 ? "shoryuken" : "tatsu";
    else {
      const pool = ["rush", "tatsu", "jump", "hadoken"] as const;
      pick = pool[Math.floor(Math.random() * pool.length)]!;
    }
    if (angry && Math.random() < 0.4) pick = dist < 140 ? "shoryuken" : "tatsu";

    // short wind-up so every move is readable (shorter when he's angry)
    const wind = angry ? 300 : m.hp <= 6 ? 360 : 420;
    this.beginChocoMove(m, "windup", now + wind);
    m.spr.setData("pick", pick);
    m.spr.setData("attacks", Number(m.spr.getData("attacks") ?? 0) + 1);
    m.rig?.telegraph(CHOCO_TELL[pick] ?? 0xffffff, wind);
    sfx.bossWarn();
  }

  private chocoGo(m: Mob, pick: string) {
    m.rig?.release(pick === "shoryuken" || pick === "jump" ? "leap" : pick === "hadoken" ? "cast" : "lunge");
    if (pick === "hadoken") this.chocoHadoken(m);
    else if (pick === "shoryuken") this.chocoShoryuken(m);
    else if (pick === "tatsu") this.chocoTatsu(m);
    else if (pick === "jump") this.chocoJump(m);
    else this.chocoRush(m);
  }

  private chocoBall(x: number, y: number, dir: number) {
    const b = this.shots.create(x, y, "pickups", 0) as Phaser.Physics.Arcade.Sprite;
    b.setDisplaySize(36, 30);
    b.setTint(0x5c2a10);
    b.setData("friendly", false);
    const body = b.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocity(dir * 360, 0);
    this.time.delayedCall(2200, () => b.destroy());
  }

  private beginChocoMove(m: Mob, move: string, until: number) {
    m.spr.setData("move", move);
    m.spr.setData("moveUntil", until);
    m.spr.setData("open", false);
    m.spr.clearTint();
  }

  private chocoHadoken(m: Mob) {
    this.beginChocoMove(m, "hadoken", this.time.now + 360);
    this.pop(m.spr.x, m.spr.y - 88, "HADOKEN");
    sfx.hadoken();
    const dir = m.dir;
    this.chocoBall(m.spr.x + dir * 40, m.spr.y - 10, dir);
    this.incoming++;
    if (m.hp <= 4) {
      this.time.delayedCall(140, () => {
        if (!m.spr.active) return;
        this.chocoBall(m.spr.x + dir * 40, m.spr.y - 22, dir);
        this.incoming++;
      });
    }
  }

  private chocoShoryuken(m: Mob) {
    const body = m.spr.body as Phaser.Physics.Arcade.Body;
    this.beginChocoMove(m, "shoryuken", this.time.now + 220);
    this.pop(m.spr.x, m.spr.y - 88, "SHORYUKEN");
    sfx.shoryuken();
    body.setVelocityY(m.hp <= 3 ? -980 : -860);
    body.setVelocityX(m.dir * 150);
    this.incoming++;
  }

  private chocoTatsu(m: Mob) {
    const body = m.spr.body as Phaser.Physics.Arcade.Body;
    this.beginChocoMove(m, "tatsu", this.time.now + (m.hp <= 3 ? 920 : 720));
    this.pop(m.spr.x, m.spr.y - 88, "TATSUMAKI");
    sfx.tatsu();
    body.setVelocityY(-340);
    body.setVelocityX(m.dir * 500);
    this.incoming++;
  }

  private chocoJump(m: Mob) {
    const body = m.spr.body as Phaser.Physics.Arcade.Body;
    this.beginChocoMove(m, "jump", this.time.now + 180);
    this.pop(m.spr.x, m.spr.y - 72, "JUMP-IN");
    sfx.jump();
    body.setVelocityY(-800);
    body.setVelocityX(m.dir * 320);
  }

  private chocoRush(m: Mob) {
    const body = m.spr.body as Phaser.Physics.Arcade.Body;
    this.beginChocoMove(m, "rush", this.time.now + 440);
    this.pop(m.spr.x, m.spr.y - 80, "ELBOW");
    sfx.attack();
    body.setVelocityX(m.dir * 420);
    this.incoming++;
  }

  private shoot(x: number, y: number, dir: number, friendly = false) {
    const b = this.shots.create(x, y, "pickups", friendly ? 1 : 0) as Phaser.Physics.Arcade.Sprite;
    b.setDisplaySize(22, 22);
    b.setData("friendly", friendly);
    const body = b.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    const shotMul = !friendly && this.hero === "candy-cube" ? 1.2 : 1;
    body.setVelocity(dir * (friendly ? 420 : 280) * shotMul, 0);
    if (friendly) {
      this.time.delayedCall(80, () => {
        this.mobs.forEach((m) => {
          if (m.spr.active && Phaser.Math.Distance.Between(b.x, b.y, m.spr.x, m.spr.y) < 46) this.hitMob(m, 2);
        });
      });
    }
    this.time.delayedCall(2400, () => b.destroy());
  }

  private shootAngle(x: number, y: number, dx: number, dy: number) {
    const b = this.shots.create(x, y, "pickups", 1) as Phaser.Physics.Arcade.Sprite;
    b.setDisplaySize(16, 16);
    b.setData("friendly", true);
    const body = b.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocity(dx * 360, dy * 360);
    this.time.delayedCall(40, () => {
      this.mobs.forEach((m) => {
        if (m.spr.active && Phaser.Math.Distance.Between(b.x, b.y, m.spr.x, m.spr.y) < 50) this.hitMob(m, 1);
      });
    });
    this.time.delayedCall(900, () => b.destroy());
  }

  private grab(pk: Phaser.Physics.Arcade.Sprite) {
    const v = Number(pk.getData("value") ?? 20);
    if (v <= 0) return; // hub Candy Bux spot: claimed with Up, not by touch
    const xk = pk.getData("xmas") as CollectableKind | undefined;
    if (xk) setXmas((s) => collect(s, xk));
    this.addCombo(v);
    useGame.getState().persist({ candyBux: useGame.getState().save.candyBux + (v >= 50 ? 50 : 5) });
    this.pop(pk.x, pk.y, `+${v}`);
    sfx.pickup();
    this.meter = Math.min(100, this.meter + 4);
    pk.destroy();
  }

  private addCombo(pts: number) {
    this.combo += 1;
    this.comboT = 2.2;
    this.score += pts * Math.min(8, 1 + Math.floor(this.combo / 3));
    if (this.combo > 1) sfx.combo();
  }

  private hurt(n: number) {
    if (this.hurtT > 0 || this.invulnT > 0) return;
    this.hurtT = this.hero === "candy-cube" ? 0.62 : 0.85;
    this.hp -= n;
    this.damaged = true;
    this.trauma = Math.min(1, this.trauma + 0.5);
    this.cameras.main.flash(80, 180, 40, 40);
    sfx.hurt();
    this.glitchHit();
    if (this.hp <= 0) {
      this.lives -= 1;
      if (this.lives <= 0) {
        this.gameOver();
        return;
      }
      this.hp = this.maxHp;
      this.respawn();
    }
  }

  /** Back to the start, or to the exit door once Sugar Time is racing home (so a pit or death can't finish the room). */
  private respawn() {
    let at = this.goal === "start" ? { x: this.exitPt.x, y: this.exitPt.y - 8 } : this.spawn;
    // the chase: back to the last checkpoint you passed, not the very start
    if (this.level.chase) at = this.chaseSpot();
    // reset() moves the body too; setPosition alone leaves it below the floor and it falls through.
    (this.player.body as Phaser.Physics.Arcade.Body).reset(at.x, at.y);
    this.resetChaser();
  }

  /**
   * Out of lives. On Floor 470539758 (hub, rooms, Bacteria, the chase) that is the
   * "TrAppEd fOrEvEr" ending first; the usual game over (lives refill) follows it.
   */
  private gameOver() {
    this.frozen = true;
    sfx.lose();
    if (isBackroomsRoom(this.levelId)) {
      const save = useGame.getState().save;
      if (!save.endings.includes(TRAPPED_ENDING)) useGame.getState().persist({ endings: [...save.endings, TRAPPED_ENDING] });
      emitGame({ t: "over", ending: TRAPPED_ENDING });
      return;
    }
    emitGame({ t: "over" });
  }

  private fallOut() {
    useGame.getState().persist({ pits: useGame.getState().save.pits + 1 });
    if (useGame.getState().save.pits >= 20) this.unlockLore("warlock");
    this.hurt(1);
    if (!this.frozen) this.respawn();
  }

  private tickGoal() {
    if (this.level.isHub || this.level.isBoss || this.level.heaven) return;
    const target = this.goal === "exit" ? this.exitPt : this.spawn;
    // A tall box, so running or jumping through the door / start flag still counts.
    // The start sits at the left wall and the exit door at the right wall, so overshooting
    // either one (e.g. jumping a pit next to it) counts too.
    const dx = this.player.x - target.x;
    const past = (this.goal === "start" ? dx < 0 : dx > 0) && Math.abs(this.player.y - target.y) <= 160;
    if (!past && (Math.abs(dx) > 56 || Math.abs(this.player.y - target.y) > 96)) return;
    if (this.goal === "exit") {
      if (this.level.chase) {
        this.chaseExit();
        return;
      }
      if (this.level.isFinal) {
        this.escapePumpkin();
        return;
      }
      this.startSugarTime();
    } else if (this.pizza) {
      this.completeLevel();
    }
  }

  private startSugarTime() {
    this.pizza = true;
    this.timer = this.level.pizzaTime || 70;
    this.goal = "start";
    this.cameras.main.flash(180, 255, 80, 40);
    this.cameras.main.setBackgroundColor(0x3a1008);
    sfx.pizza();
    this.pop(this.player.x, this.player.y - 20, "SUGAR TIME");
    if (this.startMark) {
      this.startMark.setText("RUN BACK!").setColor("#ff4d7a");
      this.tweens.add({ targets: this.startMark, scale: 1.25, yoyo: true, repeat: -1, duration: 320 });
    }
    // Ambush a few tiles back along the way home, not on top of the player at the door.
    for (let i = 0; i < 3; i++) {
      this.spawnMob(this.exitPt.x - 300 - i * 110, this.exitPt.y - 60, i === 1 ? "nincube" : "boxguy");
    }
  }

  private tickPizza(dt: number) {
    if (!this.pizza && this.level.id === "f5-2") {
      this.pizza = true;
      this.timer = this.level.pizzaTime || 90;
    }
    if (!this.pizza && this.level.isFinal) {
      this.pizza = true;
      this.timer = this.level.pizzaTime || 240;
    }
    if (!this.pizza) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      if (this.level.isFinal) {
        this.finish("bad");
        return;
      }
      this.hurt(1);
      this.timer = 12;
    }
  }

  private tickInteract(actions: ReturnType<typeof readActions>) {
    this.prompt = "";
    if (!this.level.isHub && !this.level.isBoss && !this.level.heaven) {
      this.tickSecrets();
      return;
    }
    let nearest: (typeof this.interactives)[0] | null = null;
    let best = 70;
    for (const it of this.interactives) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.x, it.y);
      if (d < best) {
        best = d;
        nearest = it;
      }
    }
    if (!nearest) return;
    const names: Record<string, string> = {
      door: "Enter  ·  Up",
      boss: "Boss gate  ·  400 bux  ·  Up",
      elevator: "Next floor  ·  Up",
      pc: "Station  ·  Up",
      giver: "Candy Bux  ·  Up",
      rift: "Strange rift  ·  Up",
      metroid: "Metroid platform  ·  Attack",
      tv: "It's Me  ·  Up",
      tear: `${BACKROOMS_NAME}  ·  Up`,
      escape: "ESCAPE  ·  Up",
    };
    this.prompt = names[nearest.kind] ?? "Up";
    if (nearest.kind === "boss" && nearest.id === BACKROOMS_BOSS) this.prompt = "Bacteria  ·  Up";
    if (nearest.kind.startsWith("home-")) {
      this.prompt = `${nearest.label ?? "Look"}  ·  Up`;
      if (actions.upPressed) this.useHouseThing(nearest);
      return;
    }
    if (nearest.kind === "metroid" && actions.attackPressed) {
      this.metroidHit = true;
      this.unlockLore("fake-cuboe");
      this.pop(nearest.x, nearest.y, "LORE");
    }
    if (!canEnterDoor({ upPressed: actions.upPressed })) return;
    sfx.door();
    if (nearest.kind === "door") this.scene.restart({ levelId: nearest.id });
    if (nearest.kind === "pc") emitGame({ t: "interact", kind: "pc", id: "pc" });
    if (nearest.kind === "tv") {
      emitGame({ t: "toast", text: "it's Me" });
      this.pop(nearest.x, nearest.y - 20, "it's Me");
    }
    if (nearest.kind === "giver") this.claimGiver(nearest);
    if (nearest.kind === "rift") {
      this.unlockLore("rift");
      this.pop(nearest.x, nearest.y, "UNIVERSE RIFT");
    }
    if (nearest.kind === "boss") this.tryBoss();
    if (nearest.kind === "elevator") this.tryElevator();
    if (nearest.kind === "tear") this.enterBackroomsDoor();
    if (nearest.kind === "escape") this.escapeDoor();
  }

  private useHouseThing(it: { kind: string; id: string; x: number; y: number; label?: string }) {
    if (it.kind === "home-door") {
      sfx.door();
      this.frozen = true;
      this.cameras.main.fadeOut(160, 20, 12, 8);
      this.time.delayedCall(170, () => this.scene.restart({ levelId: it.id, from: this.levelId }));
    } else if (it.kind === "home-menu") {
      sfx.door();
      this.frozen = true;
      emitGame({ t: "title" });
    } else if (it.kind === "home-switch") {
      sfx.ui();
      const d = this.darkness;
      if (d) d.setVisible(!d.visible);
      const nub = (this as unknown as { __switchNub?: Phaser.GameObjects.Rectangle }).__switchNub;
      nub?.setY(d?.visible ? nub.y + 12 : nub.y - 12);
      this.pop(it.x, it.y - 40, d?.visible ? "Lights off" : "Lights on");
    } else if (it.kind === "home-bed") {
      sfx.ui();
      this.cameras.main.fadeOut(400, 5, 3, 10);
      this.time.delayedCall(700, () => this.cameras.main.fadeIn(500, 5, 3, 10));
      this.hp = this.maxHp;
      this.pop(it.x, it.y - 30, it.id === "cuboe" ? "Zzz... cozy" : "Zzz... rad dreams");
    } else if (it.kind === "home-fire") {
      sfx.ui();
      this.pop(it.x, it.y - 60, "So warm!");
    } else if (it.kind === "home-tree") {
      sfx.win();
      this.pop(it.x, it.y - 120, "Merry Christmas!");
    }
  }

  /** Room secrets: drop into the spot under the rift "?", or touch a treasure. */
  private tickSecrets() {
    for (const it of [...this.interactives]) {
      const dx = Math.abs(this.player.x - it.x);
      if (it.kind === "rift" && dx < 44 && this.player.y > it.y + 100) {
        this.interactives = this.interactives.filter((i) => i !== it);
        this.unlockLore("rift");
        this.pop(this.player.x, this.player.y - 20, "UNIVERSE RIFT");
        sfx.pizza();
      } else if (it.kind === "treasure" && dx < 40 && Math.abs(this.player.y - it.y) < 48) {
        this.interactives = this.interactives.filter((i) => i !== it);
        const save = useGame.getState().save;
        if (!save.claimed.includes(it.id)) {
          useGame.getState().persist({ candyBux: save.candyBux + 100, claimed: [...save.claimed, it.id] });
        }
        this.addCombo(1000);
        this.pop(it.x, it.y - 20, "TREASURE +100 BUX");
        sfx.win();
        this.children.list.find((o) => o.getData?.("treasure") === it.id)?.destroy();
      }
    }
  }

  private claimGiver(it: (typeof this.interactives)[0]) {
    const save = useGame.getState().save;
    this.interactives = this.interactives.filter((i) => i !== it);
    if (save.claimed.includes(it.id)) return;
    useGame.getState().persist({ candyBux: save.candyBux + 50, claimed: [...save.claimed, it.id] });
    this.pop(it.x, it.y, "+50 BUX");
    sfx.pickup();
    this.pickups.getChildren().forEach((c) => {
      const s = c as Phaser.Physics.Arcade.Sprite;
      if (Math.abs(s.x - it.x) < 4) s.destroy();
    });
  }

  private tryBoss() {
    const floor = useGame.getState().save.floor;
    const f = floorDef(floor)!;
    // the secret: holding any lore, the final boss door drops you into the Backrooms (once)
    if (shouldNoclip(useGame.getState().save, f.boss.id)) {
      this.noclip();
      return;
    }
    const done = f.levels.filter((l) => useGame.getState().save.completed.includes(l.id)).length;
    if (done < 4) {
      this.pop(this.player.x, this.player.y - 30, "Clear all 4 rooms");
      return;
    }
    if (f.keyCost > 0 && useGame.getState().save.candyBux < f.keyCost) {
      this.pop(this.player.x, this.player.y - 30, `${f.keyCost} candy bux`);
      return;
    }
    useGame.getState().persist({ candyBux: useGame.getState().save.candyBux - f.keyCost });
    this.scene.restart({ levelId: f.boss.id });
  }

  private tryElevator() {
    const floor = useGame.getState().save.floor;
    const f = floorDef(floor)!;
    if (!useGame.getState().save.bosses.includes(f.boss.id)) {
      this.pop(this.player.x, this.player.y - 30, "Beat the floor boss");
      return;
    }
    if (floor >= 5) {
      this.scene.restart({ levelId: "final-run" });
      return;
    }
    const next = floor + 1;
    const unlocked = Array.from(new Set([...useGame.getState().save.unlockedFloors, next]));
    useGame.getState().persist({ floor: next, unlockedFloors: unlocked });
    this.frozen = true;
    this.scene.restart({ levelId: hubIdFor(next) });
  }

  private completeLevel() {
    this.frozen = true;
    const rank = rankFromScore(this.score, this.damaged, this.secrets);
    const save = useGame.getState().save;
    const completed = save.completed.includes(this.levelId) ? save.completed : [...save.completed, this.levelId];
    const ranks = { ...save.ranks, [this.levelId]: rank };
    if (save.highScore < this.score) useGame.getState().persist({ highScore: this.score });
    // Clearing a room pays candy bux so the 400-bux boss gate is reachable without farming.
    const bonus = CLEAR_BUX[rank] ?? 75;
    useGame.getState().persist({ completed, ranks, candyBux: useGame.getState().save.candyBux + bonus });
    this.pop(this.player.x, this.player.y - 60, `+${bonus} BUX`);
    sfx.win();
    emitGame({ t: "rank", levelId: this.levelId, rank, score: this.score });
  }

  private winBoss() {
    this.frozen = true;
    const id = this.level.bossId ?? this.levelId;
    const save = useGame.getState().save;
    const bosses = save.bosses.includes(id) ? save.bosses : [...save.bosses, id];
    useGame.getState().persist({ bosses });
    if (id === "f1-boss" && this.incoming > 0 && this.blocked / this.incoming >= 0.25) this.unlockLore("choco");
    if (id === "f2-boss" && this.incoming > 0 && this.blocked / this.incoming >= 0.5) this.unlockLore("outlaw");
    if (id === "f3-boss" && !this.damaged) this.unlockLore("fake-cubro");
    const rank = rankFromScore(this.score + 3000, this.damaged, 0);
    if (id === BACKROOMS_BOSS) {
      // Bacteria goes down... and gets back up. Run! (the reward waits at the end of the chase)
      const s2 = useGame.getState().save;
      useGame.getState().persist({ ranks: { ...s2.ranks, [id]: rank } });
      sfx.win();
      this.pop(this.player.x, this.player.y - 60, "...IT'S GETTING UP");
      emitGame({ t: "toast", text: "Bacteria is getting back up. RUN!" });
      this.cameras.main.shake(900, 0.008);
      this.time.delayedCall(1100, () => this.cameras.main.fadeOut(400, 120, 10, 10));
      this.time.delayedCall(1550, () => this.scene.restart({ levelId: BACKROOMS_ESCAPE }));
      return;
    }
    sfx.win();
    emitGame({ t: "rank", levelId: id, rank, score: this.score + 3000 });
  }

  /**
   * Escaping the Rotting Pumpkin. Every escape is Normal; the run can also earn:
   * Good — escape with 90+ seconds left (punched the Warlock out in time),
   * Playco — escape without defeating anyone in the pumpkin (spared the Warlock),
   * Omega — as Cubro with 40+ Super Saiyan Burst kills over the save.
   * The best one earned is shown; all of them are saved.
   */
  private escapePumpkin() {
    const save = useGame.getState().save;
    const earned = ["normal"];
    if (this.timer >= GOOD_ESCAPE_SECONDS) earned.push("good");
    if (this.kills === 0) earned.push("playco");
    if (this.hero === "cubro" && save.saiyanKills >= OMEGA_BURST_KILLS) earned.push("omega");
    this.finish(earned);
  }

  private finish(earned: string | string[]) {
    this.frozen = true;
    const list = Array.isArray(earned) ? earned : [earned];
    const save = useGame.getState().save;
    const endings = [...save.endings];
    for (const e of list) if (!endings.includes(e)) endings.push(e);
    const others = ["normal", "bad", "good", "playco", "omega"];
    const gotTrue = !endings.includes("true") && others.every((e) => endings.includes(e));
    if (gotTrue) endings.push("true");
    useGame.getState().persist({ endings });
    if (gotTrue) {
      emitGame({ t: "win", ending: "true" });
      return;
    }
    const best = ["omega", "playco", "good", "normal", "bad"].find((e) => list.includes(e)) ?? list[0]!;
    emitGame({ t: "win", ending: best });
  }

  private unlockLore(id: string) {
    const save = useGame.getState().save;
    if (save.lore.includes(id)) return;
    useGame.getState().persist({ lore: [...save.lore, id] });
    this.pop(this.player.x, this.player.y - 40, "SECRET LORE");
  }

  private masterCombo(id: string) {
    const save = useGame.getState().save;
    const list = save.combos[this.hero];
    if (list.includes(id)) return;
    const next = { ...save.combos, [this.hero]: [...list, id] };
    useGame.getState().persist({ combos: next });
    if (next[this.hero].length >= 5) this.unlockLore(this.hero);
  }

  private pop(x: number, y: number, text: string) {
    const t = this.add
      .text(x, y, text, { fontFamily: "Lilita One, Impact, sans-serif", fontSize: "22px", color: "#fff4d6" })
      .setOrigin(0.5)
      .setDepth(30);
    this.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 640, ease: "Cubic.easeOut", onComplete: () => t.destroy() });
  }

  private pushHud() {
    const rank = rankFromScore(this.score, this.damaged, this.secrets);
    const boss = this.level.isBoss ? this.mobs.find((m) => m.kind === "boss") : undefined;
    const bossMax = boss ? (BOSSES[this.level.bossId ?? ""]?.lives ?? 0) : 0;
    emitGame({
      t: "hud",
      score: this.score,
      combo: this.combo,
      lives: this.lives,
      hp: this.hp,
      maxHp: this.maxHp,
      candy: useGame.getState().save.candyBux,
      timer: this.pizza ? this.timer : 0,
      pizza: this.pizza,
      rank,
      label: this.prompt || this.label,
      meter: this.meter,
      bossHp: boss ? Math.max(0, boss.hp) : 0,
      bossMax,
    });
  }

  freeze() {
    this.frozen = true;
    setInjected([]);
    this.holdWorld(true);
  }

  unfreeze() {
    this.frozen = false;
    this.holdWorld(false);
  }

  /** Pause/resume physics, timers and tweens with the pause menu, so a boss's attack doesn't play out behind it. */
  private holdWorld(on: boolean) {
    if (!this.sys?.isActive() && on) return;
    if (on) {
      this.physics?.world?.pause();
      if (this.time) this.time.paused = true;
      this.tweens?.pauseAll();
    } else {
      this.physics?.world?.resume();
      if (this.time) this.time.paused = false;
      this.tweens?.resumeAll();
    }
  }

  goHub() {
    this.scene.restart({ levelId: hubIdFor(useGame.getState().save.floor) });
  }

  private wireControlsTest() {
    window.__controlsTest = {
      getYaw: () => this.player?.x ?? 0,
      getSpeed: () => Math.abs((this.player?.body as Phaser.Physics.Arcade.Body | undefined)?.velocity.x ?? 0),
      setKeys: (codes: string[]) => setInjected(codes),
      // DLC test hooks (used by scripts/xmas-dlc-smoke.mjs)
      dlc: {
        goRoom: (id: string, from?: string) => this.scene.restart({ levelId: id, from }),
        teleport: (x: number, y: number) => this.player?.setPosition(x, y),
        zoom: (z: number) => this.cameras.main.setZoom(z),
        // Guarded: during scene.restart the pickups group is torn down (children undefined), so never throw.
        state: () => {
          try {
            return this.testState();
          } catch {
            return { level: "", hp: 0, lives: 0, x: 0, y: 0, score: 0, prompt: "", partner: null, cosmetics: 0, xmasPickups: 0, xmasList: [], things: [] };
          }
        },
        boss: () => {
          try {
            return this.testBoss();
          } catch {
            return null;
          }
        },
      },
    };
  }

  private testPickups(): Phaser.GameObjects.Sprite[] {
    const g = this.pickups as Phaser.Physics.Arcade.Group | undefined;
    if (!g || !g.children) return [];
    return g.getChildren().map((c) => c as Phaser.GameObjects.Sprite);
  }

  private testState() {
    const pk = this.testPickups();
    return {
          level: this.levelId,
          hp: this.hp,
          lives: this.lives,
          x: this.player?.x ?? 0,
          y: this.player?.y ?? 0,
          score: this.score,
          prompt: this.prompt,
          partner: this.partner ? { hero: this.partner.hero, x: this.partner.spr.x, y: this.partner.spr.y } : null,
          cosmetics: this.rigs.length,
          xmasPickups: pk.filter((c) => c.getData("xmas")).length,
          xmasList: pk.filter((c) => c.getData("xmas")).map((c) => ({ kind: String(c.getData("xmas")), x: c.x, y: c.y })),
          things: this.interactives.map((i) => ({ kind: i.kind, id: i.id, x: i.x, y: i.y, label: i.label })),
          label: this.label,
          noclipping: this.noclipping,
          mobs: this.mobs.filter((mm) => mm.spr.active).map((mm) => ({ kind: mm.kind, x: mm.spr.x, y: mm.spr.y })),
          movers: this.movers.length,
          stalactites: this.stalactites.length,
          chaser: this.chaser ? { x: this.chaser.x, wait: this.chaseWait } : null,
          catches: this.catches,
          scaring: this.scaring,
          glitch: { level: glitchLevel(Math.max(0, this.hp), this.maxHp), on: this.glitchOn(), burst: this.time.now < this.glitchUntil, shown: !!this.glitchFx?.ghosts[0]?.visible },
          swimming: this.inWater(this.player),
    };
  }

  /** Boss probe for tests: body vs the arena floor, hp, current move and phase. */
  private testBoss() {
    const m = this.mobs.find((b) => b.kind === "boss" && b.spr.active);
    if (!m) return null;
    const body = m.spr.body as Phaser.Physics.Arcade.Body;
    return {
      id: this.level.bossId ?? "",
      x: m.spr.x,
      y: m.spr.y,
      hp: m.hp,
      open: !!m.spr.getData("open"),
      move: String(m.spr.getData("move") ?? ""),
      phase: Number(m.spr.getData("phase") ?? 1),
      attacks: Number(m.spr.getData("attacks") ?? 0),
      bodyTop: body.top,
      bodyBottom: body.bottom,
      spriteBottom: (m.rig?.vis ?? m.spr).getBounds().bottom,
      floorTop: this.arenaFloorTop(m.spr.x),
      grounded: body.blocked.down || body.touching.down,
      depth: m.spr.depth,
    };
  }

  /** Top of the solid floor directly under x (bottom of the world if there's none). */
  private arenaFloorTop(x: number) {
    const tx = Math.floor(x / TILE);
    const rows = this.level.rows;
    for (let ty = 0; ty < rows.length; ty++) if (rows[ty]?.[tx] === "#") return ty * TILE;
    return worldSize(this.level).h;
  }
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys?: (codes: string[]) => void;
      dlc?: {
        goRoom: (id: string, from?: string) => void;
        teleport: (x: number, y: number) => void;
        zoom: (z: number) => void;
        state: () => {
          level: string;
          hp: number;
          lives: number;
          x: number;
          y: number;
          score: number;
          prompt: string;
          partner: { hero: string; x: number; y: number } | null;
          cosmetics: number;
          xmasPickups: number;
          xmasList: { kind: string; x: number; y: number }[];
          things: { kind: string; id: string; x: number; y: number; label?: string }[];
        };
        boss: () => {
          id: string;
          x: number;
          y: number;
          hp: number;
          open: boolean;
          move: string;
          phase: number;
          attacks: number;
          bodyTop: number;
          bodyBottom: number;
          spriteBottom: number;
          floorTop: number;
          grounded: boolean;
          depth: number;
        } | null;
      };
    };
  }
}




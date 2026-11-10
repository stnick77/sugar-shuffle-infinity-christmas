/**
 * Cuboe and Cubro's Home — 'Tis the Seasones DLC.
 *
 * Built from Hayden's floor plan ("Not a level"): an explorable hub-like house
 * of five rooms joined by doorways. No enemies, no score, no timer.
 *
 *   Living Room ── Hallway ──┬── Cuboe's Room
 *        │                   ├── Cubro's Room
 *    Main Menu               └── (stairs) Upstairs
 *
 * Tile legend used by PlayScene for house rooms:
 *   #  wooden floor / stairs (solid, drawn)
 *   |  wall (solid, invisible)
 *   =  furniture top: bed, steps, dresser (one-way, invisible — art drawn here)
 */
import * as Phaser from "phaser";
import { TILE } from "../config";
import type { LevelDef } from "../data/levels";
import { HOME_NAME } from "./logic";
import { XMAS_PK } from "./cosmetics";

export interface HouseDoor {
  tx: number;
  ty: number;
  /** Room id, or "menu" for the Main Menu door. */
  to: string;
  label: string;
}

export interface HouseRoom {
  id: string;
  name: string;
  width: number;
  doors: HouseDoor[];
  wall: number;
  stripe: number;
  build: (grid: string[][]) => void;
}

export interface HouseThing {
  kind: string;
  id: string;
  x: number;
  y: number;
  label: string;
}

const ROWS = 15;
const FLOOR = 13;

function fill(grid: string[][], tx: number, fromRow: number, toRow: number, ch: string) {
  for (let r = fromRow; r <= toRow; r++) if (grid[r]) grid[r]![tx] = ch;
}

export const HOUSE_ROOMS: Record<string, HouseRoom> = {
  "home-living": {
    id: "home-living",
    name: "Living Room",
    width: 28,
    wall: 0x5a2420,
    stripe: 0x652b25,
    doors: [
      { tx: 2, ty: 12, to: "menu", label: "Main Menu" },
      { tx: 25, ty: 12, to: "home-hall", label: "Hallway" },
    ],
    build: () => undefined,
  },
  "home-hall": {
    id: "home-hall",
    name: "Hallway",
    width: 40,
    wall: 0x1f3a2a,
    stripe: 0x244331,
    doors: [
      { tx: 3, ty: 12, to: "home-living", label: "Living Room" },
      { tx: 12, ty: 12, to: "home-cuboe", label: "Cuboe's Room" },
      { tx: 18, ty: 12, to: "home-cubro", label: "Cubro's Room" },
      { tx: 36, ty: 7, to: "home-up", label: "Upstairs" },
    ],
    build: (g) => {
      // stairs up to the landing (top-right "upstairs" door on the plan)
      for (let i = 0; i < 5; i++) fill(g, 25 + i, 12 - i, 12, "#");
      for (let tx = 30; tx <= 38; tx++) fill(g, tx, 8, 12, "#");
    },
  },
  "home-cuboe": {
    id: "home-cuboe",
    name: "Cuboe's Room",
    width: 28,
    wall: 0x24304a,
    stripe: 0x2a3754,
    doors: [{ tx: 2, ty: 12, to: "home-hall", label: "Hallway" }],
    build: (g) => {
      g[12]![16] = "=";
      g[11]![17] = "=";
      for (let tx = 18; tx <= 25; tx++) g[11]![tx] = "=";
    },
  },
  "home-cubro": {
    id: "home-cubro",
    name: "Cubro's Room",
    width: 30,
    wall: 0x3a2418,
    stripe: 0x45291c,
    doors: [{ tx: 4, ty: 12, to: "home-hall", label: "Hallway" }],
    build: (g) => {
      for (let tx = 8; tx <= 10; tx++) g[12]![tx] = "=";
      g[12]![21] = "=";
      g[11]![22] = "=";
      for (let tx = 23; tx <= 28; tx++) g[11]![tx] = "=";
    },
  },
  "home-up": {
    id: "home-up",
    name: "Upstairs",
    width: 34,
    wall: 0x2a1f3a,
    stripe: 0x312444,
    doors: [{ tx: 2, ty: 12, to: "home-hall", label: "Hallway" }],
    build: (g) => {
      for (let i = 0; i < 4; i++) fill(g, 5 + i, 12 - i, 12, "#");
      for (let tx = 9; tx <= 32; tx++) fill(g, tx, 9, 12, "#");
    },
  },
};

export { HOME_START } from "./logic";

function rowsFor(room: HouseRoom): string[] {
  const g: string[][] = Array.from({ length: ROWS }, () => Array.from({ length: room.width }, () => "."));
  for (let r = 0; r < FLOOR; r++) {
    g[r]![0] = "|";
    g[r]![room.width - 1] = "|";
  }
  for (let r = FLOOR; r < ROWS; r++) g[r] = Array.from({ length: room.width }, () => "#");
  room.build(g);
  return g.map((r) => r.join(""));
}

export const HOUSE_LEVELS: Record<string, LevelDef & { house: true }> = Object.fromEntries(
  Object.values(HOUSE_ROOMS).map((room) => [
    room.id,
    {
      id: room.id,
      name: room.name,
      rows: rowsFor(room),
      bg: "/game/bg/hub-interior.jpg",
      ground: "candy" as const,
      pizzaTime: 0,
      isHub: true,
      house: true as const,
    },
  ]),
);

export function isHouseLevel(id: string) {
  return id in HOUSE_LEVELS;
}

/** Where to stand when arriving in `roomId` from `from`. */
export function houseSpawn(roomId: string, from?: string) {
  const room = HOUSE_ROOMS[roomId]!;
  const door = room.doors.find((d) => d.to === from) ?? room.doors[0]!;
  return { x: door.tx * TILE + TILE / 2 + (door.tx < room.width / 2 ? 40 : -40), y: door.ty * TILE + TILE / 2 - 8 };
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

const TEXT = {
  fontFamily: "Lilita One, Impact, sans-serif",
  color: "#fff4d6",
  stroke: "#140c0a",
  strokeThickness: 5,
};

function label(scene: Phaser.Scene, x: number, y: number, text: string, size = 18, depth = 8) {
  return scene.add.text(x, y, text, { ...TEXT, fontSize: `${size}px` }).setOrigin(0.5).setDepth(depth);
}

function flame(scene: Phaser.Scene, x: number, y: number, s = 1, depth = 3) {
  const outer = scene.add.ellipse(x, y, 10 * s, 18 * s, 0xff9a2a).setDepth(depth).setOrigin(0.5, 1);
  const inner = scene.add.ellipse(x, y, 5 * s, 10 * s, 0xfff2a0).setDepth(depth).setOrigin(0.5, 1);
  scene.tweens.add({ targets: [outer, inner], scaleY: 1.25, scaleX: 0.85, yoyo: true, repeat: -1, duration: 160 + Math.random() * 120 });
  const glow = scene.add.circle(x, y - 8 * s, 26 * s, 0xffc060, 0.12).setDepth(depth - 0.1);
  scene.tweens.add({ targets: glow, alpha: 0.05, yoyo: true, repeat: -1, duration: 400 });
  return [outer, inner, glow];
}

function candle(scene: Phaser.Scene, x: number, y: number, h = 26, depth = 3) {
  scene.add.rectangle(x, y, 10, h, 0xfff4d6).setOrigin(0.5, 1).setDepth(depth);
  scene.add.rectangle(x, y - h, 2, 5, 0x140c0a).setOrigin(0.5, 1).setDepth(depth);
  flame(scene, x, y - h - 3, 1, depth + 0.1);
}

function frame(scene: Phaser.Scene, x: number, y: number, w: number, h: number, inner = 0xfff4d6) {
  const g = scene.add.graphics().setDepth(2);
  g.fillStyle(0x140c0a, 0.35).fillRect(x - w / 2 + 6, y - h / 2 + 6, w, h);
  g.fillStyle(0xe8b84a, 1).fillRect(x - w / 2, y - h / 2, w, h);
  g.lineStyle(3, 0x8a5a1a, 1).strokeRect(x - w / 2, y - h / 2, w, h);
  g.fillStyle(inner, 1).fillRect(x - w / 2 + 10, y - h / 2 + 10, w - 20, h - 20);
  return g;
}

function archDoor(scene: Phaser.Scene, x: number, floorY: number, text: string, accent = 0xfff4d6) {
  const g = scene.add.graphics().setDepth(2);
  const w = 56;
  const h = 92;
  const top = floorY - h;
  g.fillStyle(0x6b3b22, 1).fillRoundedRect(x - w / 2 - 8, top - 8, w + 16, h + 8, { tl: 34, tr: 34, bl: 0, br: 0 });
  g.fillStyle(0x140c0a, 1).fillRoundedRect(x - w / 2, top, w, h, { tl: 28, tr: 28, bl: 0, br: 0 });
  g.lineStyle(3, accent, 0.9).strokeRoundedRect(x - w / 2, top, w, h, { tl: 28, tr: 28, bl: 0, br: 0 });
  // little wreath on every door
  const wr = scene.add.circle(x, top + 26, 11).setStrokeStyle(5, 0x2f8a4a).setDepth(2.1);
  scene.add.circle(x, top + 37, 3, 0xd12d5c).setDepth(2.2);
  void wr;
  label(scene, x, top - 22, text, 18);
}

function garland(scene: Phaser.Scene, x0: number, x1: number, y: number) {
  const g = scene.add.graphics().setDepth(2.5);
  const span = 96;
  const bulbs = [0xff4d7a, 0xffd75e, 0x3ecf8e, 0x7ac8ff];
  let k = 0;
  for (let x = x0; x < x1; x += span) {
    const c = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(x, y),
      new Phaser.Math.Vector2(x + span / 2, y + 34),
      new Phaser.Math.Vector2(Math.min(x1, x + span), y),
    );
    g.lineStyle(9, 0x1f6b3a, 1).strokePoints(c.getPoints(16));
    g.lineStyle(3, 0x2f8a4a, 1).strokePoints(c.getPoints(16));
    for (const t of [0.25, 0.5, 0.75]) {
      const p = c.getPoint(t);
      const b = scene.add.circle(p.x, p.y + 6, 4, bulbs[k++ % bulbs.length]).setDepth(2.6);
      scene.tweens.add({ targets: b, alpha: 0.4, yoyo: true, repeat: -1, duration: 500 + (k % 3) * 220, delay: k * 90 });
    }
  }
}

function present(scene: Phaser.Scene, x: number, floorY: number, size: number, tint?: number) {
  const p = scene.add.image(x, floorY, XMAS_PK, 0).setOrigin(0.5, 1).setDisplaySize(size, size).setDepth(3);
  if (tint) p.setTint(tint);
  return p;
}

function bed(scene: Phaser.Scene, x0: number, x1: number, topY: number, floorY: number, blanket: number, steps: { x: number; y: number }[]) {
  const g = scene.add.graphics().setDepth(2);
  // steps up to the bed
  for (const s of steps) {
    g.fillStyle(0x8a5230, 1).fillRect(s.x - TILE / 2, s.y, TILE, floorY - s.y);
    g.fillStyle(0xc47a3a, 1).fillRect(s.x - TILE / 2, s.y, TILE, 6);
    g.lineStyle(2, 0x3a2214, 1).strokeRect(s.x - TILE / 2, s.y, TILE, floorY - s.y);
  }
  // frame + legs
  g.fillStyle(0x6b3b22, 1).fillRect(x0, topY + 30, x1 - x0, floorY - topY - 30);
  g.fillStyle(0x4a2a18, 1).fillRect(x1 - 18, topY - 70, 18, floorY - topY + 70);
  g.fillRoundedRect(x1 - 30, topY - 84, 42, 24, 8);
  // mattress, blanket, pillow
  g.fillStyle(0xfff4d6, 1).fillRoundedRect(x0, topY - 2, x1 - x0 - 18, 32, 8);
  g.fillStyle(blanket, 1).fillRoundedRect(x0, topY + 4, x1 - x0 - 90, 30, 8);
  g.fillStyle(0xffffff, 1).fillRoundedRect(x1 - 92, topY - 16, 66, 24, 10);
  g.lineStyle(3, 0x140c0a, 0.5).strokeRoundedRect(x0, topY - 2, x1 - x0 - 18, 32, 8);
}

function zzz(scene: Phaser.Scene, x: number, y: number) {
  for (let i = 0; i < 3; i++) {
    const z = label(scene, x + i * 18, y, "Z", 18 + i * 6, 9);
    scene.tweens.add({ targets: z, y: y - 40, alpha: 0, duration: 1800, repeat: -1, delay: i * 600 });
  }
}

function wallpaper(scene: Phaser.Scene, room: HouseRoom) {
  const W = room.width * TILE;
  const floorY = FLOOR * TILE;
  const g = scene.add.graphics().setDepth(-7);
  g.fillStyle(room.wall, 1).fillRect(0, 0, W, floorY);
  g.fillStyle(room.stripe, 1);
  for (let x = 0; x < W; x += 48) g.fillRect(x, 0, 20, floorY);
  // wainscot + trim
  g.fillStyle(0x2a1810, 0.55).fillRect(0, floorY - 120, W, 120);
  g.fillStyle(0xc47a3a, 1).fillRect(0, floorY - 124, W, 6);
  g.fillStyle(0x3a2214, 1).fillRect(0, 0, W, 18);
  g.fillStyle(0xc47a3a, 1).fillRect(0, 18, W, 5);
  // side walls
  g.fillStyle(0x3a2214, 1).fillRect(0, 0, TILE, floorY);
  g.fillRect(W - TILE, 0, TILE, floorY);
}

function roomSign(scene: Phaser.Scene, room: HouseRoom) {
  const g = scene.add.graphics().setDepth(2);
  const text = room.name;
  const w = 26 + text.length * 11;
  const cx = 640;
  const y = room.id === "home-living" ? 88 : 48;
  g.fillStyle(0xfff4d6, 1).fillRoundedRect(cx - w / 2, y, w, 34, 6);
  g.lineStyle(3, 0x140c0a, 1).strokeRoundedRect(cx - w / 2, y, w, 34, 6);
  scene.add
    .text(cx, y + 17, text, { fontFamily: "Lilita One, Impact, sans-serif", fontSize: "20px", color: "#140c0a" })
    .setOrigin(0.5)
    .setDepth(2.1);
}

/** Draw a room and return its doors + things you can press Up on. */
export function drawHouseRoom(scene: Phaser.Scene, roomId: string): { things: HouseThing[]; darkness?: Phaser.GameObjects.Rectangle } {
  const room = HOUSE_ROOMS[roomId]!;
  const things: HouseThing[] = [];
  const floorY = FLOOR * TILE;
  const W = room.width * TILE;
  wallpaper(scene, room);
  roomSign(scene, room);
  garland(scene, TILE, W - TILE, 26);

  for (const d of room.doors) {
    const x = d.tx * TILE + TILE / 2;
    const fy = (d.ty + 1) * TILE;
    archDoor(scene, x, fy, d.label, d.to === "menu" ? 0xff4d7a : 0xfff4d6);
    things.push({ kind: d.to === "menu" ? "home-menu" : "home-door", id: d.to, x, y: d.ty * TILE + TILE / 2, label: d.label });
  }

  let darkness: Phaser.GameObjects.Rectangle | undefined;

  if (roomId === "home-living") {
    label(scene, 640, 62, HOME_NAME, 28, 3);
    // chimney (brick, floor to ceiling) + fireplace
    const g = scene.add.graphics().setDepth(1.5);
    const cx = 380;
    g.fillStyle(0x9a4a32, 1).fillRect(cx - 70, 0, 140, floorY - 160);
    g.lineStyle(2, 0x5a2a1a, 1);
    for (let y = 0; y < floorY - 160; y += 22) {
      g.lineBetween(cx - 70, y, cx + 70, y);
      for (let x = cx - 70 + ((y / 22) % 2 ? 0 : 23); x < cx + 70; x += 46) g.lineBetween(x, y, x, y + 22);
    }
    g.fillStyle(0xb85a3a, 1).fillRect(cx - 120, floorY - 160, 240, 160);
    g.lineStyle(2, 0x5a2a1a, 1);
    for (let y = floorY - 160; y < floorY; y += 22) g.lineBetween(cx - 120, y, cx + 120, y);
    g.fillStyle(0x6b3b22, 1).fillRect(cx - 136, floorY - 172, 272, 18);
    g.fillStyle(0x140c0a, 1).fillRoundedRect(cx - 74, floorY - 112, 148, 112, { tl: 40, tr: 40, bl: 0, br: 0 });
    // logs + fire
    g.fillStyle(0x5c3418, 1).fillRoundedRect(cx - 50, floorY - 18, 100, 14, 6);
    g.fillStyle(0x4a2a18, 1).fillRoundedRect(cx - 40, floorY - 28, 80, 12, 6);
    const fires: [number, number, number, number][] = [
      [-26, 46, 0xd12d5c, 70],
      [0, 64, 0xff8a3a, 90],
      [24, 44, 0xd12d5c, 64],
      [-8, 40, 0xffd75e, 50],
      [12, 34, 0xfff2a0, 38],
    ];
    for (const [dx, w, col, h] of fires) {
      const f = scene.add.ellipse(cx + dx, floorY - 22, w * 0.6, h, col).setOrigin(0.5, 1).setDepth(1.7);
      scene.tweens.add({ targets: f, scaleY: 1.2, scaleX: 0.85, yoyo: true, repeat: -1, duration: 180 + Math.random() * 160 });
    }
    const glow = scene.add.circle(cx, floorY - 50, 150, 0xff9a2a, 0.1).setDepth(1.6);
    scene.tweens.add({ targets: glow, alpha: 0.04, yoyo: true, repeat: -1, duration: 500 });
    // stockings on the mantel
    for (const [dx, name, col] of [
      [-70, "Cuboe", 0xd12d5c],
      [50, "Cubro", 0x2f8a4a],
    ] as const) {
      const sx = cx + dx;
      const sy = floorY - 154;
      const s = scene.add.graphics().setDepth(2.2);
      s.fillStyle(col, 1).fillPoints(
        [
          new Phaser.Math.Vector2(sx, sy),
          new Phaser.Math.Vector2(sx + 30, sy),
          new Phaser.Math.Vector2(sx + 30, sy + 48),
          new Phaser.Math.Vector2(sx + 48, sy + 58),
          new Phaser.Math.Vector2(sx + 44, sy + 72),
          new Phaser.Math.Vector2(sx + 10, sy + 70),
          new Phaser.Math.Vector2(sx, sy + 56),
        ],
        true,
      );
      s.fillStyle(0xfff4d6, 1).fillRect(sx - 4, sy - 4, 38, 14);
      scene.add
        .text(sx + 15, sy + 3, name, { fontFamily: "Lilita One, Impact, sans-serif", fontSize: "11px", color: "#140c0a" })
        .setOrigin(0.5)
        .setDepth(2.3);
    }
    // framed candy picture
    frame(scene, 700, 260, 140, 120, 0xffd8e4);
    scene.add.image(675, 262, "pickups", 0).setDisplaySize(52, 52).setDepth(2.1);
    scene.add.image(728, 258, "pickups", 1).setDisplaySize(52, 52).setDepth(2.1);
    // presents by the fire
    present(scene, 560, floorY, 52);
    present(scene, 610, floorY, 40, 0x9ad7ff);
    present(scene, 200, floorY, 44, 0xffe066);
    // window with snow
    const wg = scene.add.graphics().setDepth(1.5);
    wg.fillStyle(0x0d1b3a, 1).fillRect(930, 170, 160, 190);
    wg.lineStyle(10, 0xfff4d6, 1).strokeRect(930, 170, 160, 190);
    wg.lineBetween(1010, 170, 1010, 360);
    wg.lineBetween(930, 265, 1090, 265);
    scene.add
      .particles(0, 0, "px", {
        x: { min: 936, max: 1084 },
        y: 176,
        lifespan: 2600,
        speedY: { min: 30, max: 60 },
        speedX: { min: -8, max: 8 },
        scale: { start: 0.9, end: 0.6 },
        alpha: { start: 0.9, end: 0.3 },
        frequency: 140,
        maxAliveParticles: 30,
        deathZone: { type: "onLeave", source: new Phaser.Geom.Rectangle(930, 170, 160, 190) } as never,
      })
      .setDepth(1.6);
    things.push({ kind: "home-fire", id: "fire", x: cx, y: floorY - 30, label: "Warm up" });
  }

  if (roomId === "home-hall") {
    // stair art + railing
    const g = scene.add.graphics().setDepth(2);
    g.lineStyle(5, 0xc47a3a, 1);
    g.lineBetween(25 * TILE, 12 * TILE - 50, 30 * TILE, 8 * TILE - 50);
    g.lineBetween(30 * TILE, 8 * TILE - 50, 39 * TILE, 8 * TILE - 50);
    for (let i = 0; i < 5; i++) g.lineBetween((25 + i) * TILE + 24, (12 - i) * TILE, (25 + i) * TILE + 24, (12 - i) * TILE - 48);
    frame(scene, 480, 260, 110, 90, 0x9ad7ff);
    scene.add.image(480, 262, XMAS_PK, 3).setDisplaySize(50, 50).setDepth(2.1);
    present(scene, 1000, FLOOR * TILE, 40);
    label(scene, 25 * TILE, 12 * TILE - 92, "Upstairs ↗", 16, 3);
  }

  if (roomId === "home-cuboe") {
    // chandelier / candelabra
    const cx = 420;
    const g = scene.add.graphics().setDepth(2);
    g.lineStyle(3, 0x8a5a1a, 1).lineBetween(cx, 20, cx, 150);
    g.fillStyle(0xe8b84a, 1).fillCircle(cx, 160, 12);
    g.lineStyle(5, 0xe8b84a, 1);
    for (const dx of [-70, -35, 35, 70]) {
      const c = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(cx, 160),
        new Phaser.Math.Vector2(cx + dx, 200),
        new Phaser.Math.Vector2(cx + dx, 170),
      );
      g.strokePoints(c.getPoints(10));
    }
    g.fillStyle(0xe8b84a, 1).fillCircle(cx, 190, 7);
    for (const dx of [-70, -35, 0, 35, 70]) candle(scene, cx + dx, dx === 0 ? 150 : 172, 18, 2.2);
    // Sleep Zone sign
    const sx = 700;
    const sy = 300;
    const sg = scene.add.graphics().setDepth(2);
    sg.lineStyle(2, 0x140c0a, 1).lineBetween(sx - 40, sy - 70, sx, sy - 34).lineBetween(sx + 40, sy - 70, sx, sy - 34);
    sg.fillStyle(0xfff4d6, 1).fillRoundedRect(sx - 70, sy - 34, 140, 64, 16);
    sg.lineStyle(4, 0x140c0a, 1).strokeRoundedRect(sx - 70, sy - 34, 140, 64, 16);
    scene.add
      .text(sx, sy - 2, "Sleep\nZone", { fontFamily: "Lilita One, Impact, sans-serif", fontSize: "22px", color: "#24304a", align: "center" })
      .setOrigin(0.5)
      .setDepth(2.1);
    // bed with steps + Zzz
    bed(scene, 18 * TILE, 26 * TILE, 11 * TILE, floorY, 0x7ac8ff, [
      { x: 16 * TILE + 24, y: 12 * TILE },
      { x: 17 * TILE + 24, y: 11 * TILE },
    ]);
    label(scene, 21 * TILE, 11 * TILE + 20, "Z Z Z", 20, 2.5);
    zzz(scene, 21 * TILE, 11 * TILE - 40);
    present(scene, 6 * TILE, floorY, 40, 0xffc0d8);
    frame(scene, 1000, 220, 100, 100, 0xfff4d6);
    scene.add.image(1000, 222, "cuboe-idle", 0).setDisplaySize(70, 70).setDepth(2.1);
    things.push({ kind: "home-bed", id: "cuboe", x: 21 * TILE, y: 11 * TILE - 20, label: "Sleep" });
  }

  if (roomId === "home-cubro") {
    // dresser with items
    const dg = scene.add.graphics().setDepth(2);
    const dx0 = 8 * TILE;
    dg.fillStyle(0x8a5230, 1).fillRect(dx0, 12 * TILE, 3 * TILE, TILE);
    dg.lineStyle(3, 0x3a2214, 1).strokeRect(dx0, 12 * TILE, 3 * TILE, TILE);
    for (let i = 0; i < 3; i++) {
      dg.strokeRect(dx0 + 6 + i * 46, 12 * TILE + 6, 40, 36);
      dg.fillStyle(0xe8b84a, 1).fillCircle(dx0 + 26 + i * 46, 12 * TILE + 24, 4);
    }
    scene.add.image(dx0 + 30, 12 * TILE, XMAS_PK, 0).setOrigin(0.5, 1).setDisplaySize(36, 36).setDepth(2.2);
    const sh = scene.add.graphics().setDepth(2.2);
    sh.fillStyle(0x140c0a, 1).fillEllipse(dx0 + 80, 12 * TILE - 8, 22, 12).fillEllipse(dx0 + 104, 12 * TILE - 8, 22, 12);
    sh.lineStyle(3, 0x140c0a, 1).lineBetween(dx0 + 90, 12 * TILE - 10, dx0 + 94, 12 * TILE - 10);
    scene.add.image(dx0 + 128, 12 * TILE, "pickups", 1).setOrigin(0.5, 1).setDisplaySize(30, 30).setDepth(2.2);
    // framed picture
    frame(scene, 660, 250, 120, 110, 0xffd8e4);
    scene.add.image(660, 252, "cubro-idle", 0).setDisplaySize(80, 80).setDepth(2.1);
    // light switch
    const lx = 820;
    const ly = 380;
    const lg = scene.add.graphics().setDepth(2);
    lg.fillStyle(0xfff4d6, 1).fillRoundedRect(lx - 14, ly - 22, 28, 44, 5);
    lg.lineStyle(2, 0x140c0a, 1).strokeRoundedRect(lx - 14, ly - 22, 28, 44, 5);
    const nub = scene.add.rectangle(lx, ly - 6, 8, 14, 0x140c0a).setDepth(2.1);
    // wall candle sconce
    const cx = 960;
    const cg = scene.add.graphics().setDepth(2);
    cg.fillStyle(0xe8b84a, 1).fillRect(cx - 4, 300, 8, 30).fillRoundedRect(cx - 18, 300, 36, 8, 3);
    candle(scene, cx, 300, 22, 2.2);
    // bed with steps
    bed(scene, 23 * TILE, 29 * TILE, 11 * TILE, floorY, 0x2f8a4a, [
      { x: 21 * TILE + 24, y: 12 * TILE },
      { x: 22 * TILE + 24, y: 11 * TILE },
    ]);
    darkness = scene.add.rectangle(0, 0, W, 720, 0x05030a, 0.62).setOrigin(0, 0).setDepth(20).setVisible(false);
    things.push({ kind: "home-switch", id: "switch", x: lx, y: floorY - 30, label: "Light switch" });
    things.push({ kind: "home-bed", id: "cubro", x: 26 * TILE, y: 11 * TILE - 20, label: "Sleep" });
    (scene as unknown as { __switchNub?: Phaser.GameObjects.Rectangle }).__switchNub = nub;
  }

  if (roomId === "home-up") {
    const platY = 9 * TILE;
    // "the Shade" poster
    const px = 520;
    const py = 230;
    frame(scene, px, py, 150, 190, 0x1a1210);
    const pg = scene.add.graphics().setDepth(2.1);
    pg.fillStyle(0x3a2a4a, 1).fillEllipse(px - 26, py - 34, 40, 46).fillRect(px - 44, py - 14, 36, 70);
    pg.fillStyle(0xff4d7a, 1).fillCircle(px - 34, py - 36, 4).fillCircle(px - 18, py - 36, 4);
    pg.lineStyle(4, 0x3a2a4a, 1).lineBetween(px - 46, py - 50, px - 56, py - 66).lineBetween(px - 8, py - 50, px + 2, py - 66);
    pg.fillStyle(0xfff4d6, 1).fillTriangle(px + 22, py + 20, px + 44, py + 20, px + 33, py + 44);
    pg.fillRect(px + 29, py - 40, 8, 60);
    scene.add
      .text(px, py + 70, "the Shade", { fontFamily: "Lilita One, Impact, sans-serif", fontSize: "20px", color: "#fff4d6" })
      .setOrigin(0.5)
      .setDepth(2.2);
    // three floating candles
    [1080, 1160, 1240].forEach((x, i) => {
      const c = scene.add.container(x, 230 + i * 10).setDepth(2.5);
      const body = scene.add.rectangle(0, 0, 12, 46, 0xfff4d6).setOrigin(0.5, 1);
      const wick = scene.add.rectangle(0, -46, 2, 5, 0x140c0a).setOrigin(0.5, 1);
      const f1 = scene.add.ellipse(0, -50, 10, 18, 0xff9a2a).setOrigin(0.5, 1);
      const f2 = scene.add.ellipse(0, -50, 5, 10, 0xfff2a0).setOrigin(0.5, 1);
      const glow = scene.add.circle(0, -58, 26, 0xffc060, 0.12);
      c.add([glow, body, wick, f1, f2]);
      scene.tweens.add({ targets: c, y: c.y - 16, yoyo: true, repeat: -1, duration: 1400 + i * 260, ease: "Sine.easeInOut" });
      scene.tweens.add({ targets: [f1, f2], scaleY: 1.25, yoyo: true, repeat: -1, duration: 170 + i * 30 });
    });
    // decorated Christmas tree with star + presents underneath
    const tx = 28 * TILE;
    const tree = scene.add.image(tx, platY + 4, XMAS_PK, 2).setOrigin(0.5, 1).setDisplaySize(250, 250).setDepth(2);
    void tree;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const l = scene.add
        .circle(tx + Math.cos(a) * (30 + (i % 4) * 14), platY - 70 - (i % 5) * 26, 4, [0xffd75e, 0xff4d7a, 0x7ac8ff][i % 3])
        .setDepth(2.1);
      scene.tweens.add({ targets: l, alpha: 0.2, yoyo: true, repeat: -1, duration: 420 + i * 70 });
    }
    const starGlow = scene.add.circle(tx, platY - 230, 30, 0xffd75e, 0.25).setDepth(1.9);
    scene.tweens.add({ targets: starGlow, scale: 1.4, alpha: 0.08, yoyo: true, repeat: -1, duration: 900 });
    present(scene, tx - 110, platY, 54);
    present(scene, tx - 60, platY, 40, 0x9ad7ff);
    present(scene, tx + 70, platY, 48, 0xffe066);
    present(scene, tx + 118, platY, 36, 0xffc0d8);
    // stair rail
    const g = scene.add.graphics().setDepth(2);
    g.lineStyle(5, 0xc47a3a, 1).lineBetween(5 * TILE, 12 * TILE - 50, 9 * TILE, 9 * TILE - 50);
    things.push({ kind: "home-tree", id: "tree", x: tx, y: platY - 30, label: "Admire the tree" });
  }

  return { things, darkness };
}

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_FALL_SPEED,
  canEnterDoor,
  capFallSpeed,
  landingFloorTop,
  shouldLandOnFloor,
  type Aabb,
} from "./floors.ts";

const floor: Aabb = { left: 0, right: 48, top: 200, bottom: 248 };
const onTop = (bottom: number, x = 8): Aabb => ({ left: x, right: x + 32, top: bottom - 48, bottom });

describe("swept floor landing", () => {
  it("lands when a fast fall skips past the floor top in one step", () => {
    const prev = onTop(190);
    const curr = onTop(250);
    assert.equal(
      shouldLandOnFloor({ velocityY: 1100, prev, curr, floor, oneWay: true }),
      true,
    );
    assert.equal(landingFloorTop({ velocityY: 1100, prev, curr, floors: [{ aabb: floor, oneWay: true }] }), 200);
  });

  it("lands when already standing a few pixels into the floor", () => {
    const box = onTop(204);
    assert.equal(shouldLandOnFloor({ velocityY: 0, prev: box, curr: box, floor }), true);
  });

  it("does not land when jumping up through a one-way platform", () => {
    const prev = onTop(230);
    const curr = onTop(180);
    assert.equal(
      shouldLandOnFloor({ velocityY: -760, prev, curr, floor, oneWay: true }),
      false,
    );
  });

  it("does not land on a one-way platform while dropping through it", () => {
    const prev = onTop(198);
    const curr = onTop(220);
    assert.equal(
      shouldLandOnFloor({ velocityY: 200, dropping: true, oneWay: true, prev, curr, floor }),
      false,
    );
  });

  it("does not pop a body back up if it was already under the floor", () => {
    const prev = onTop(260);
    const curr = onTop(280);
    assert.equal(shouldLandOnFloor({ velocityY: 800, prev, curr, floor }), false);
  });

  it("ignores floors the body is not horizontally over", () => {
    const prev = onTop(190, 400);
    const curr = onTop(250, 400);
    assert.equal(shouldLandOnFloor({ velocityY: 1100, prev, curr, floor }), false);
  });

  it("picks the highest crossed floor when several are in the path", () => {
    const low: Aabb = { left: 0, right: 48, top: 200, bottom: 248 };
    const high: Aabb = { left: 0, right: 48, top: 120, bottom: 168 };
    const prev = onTop(100);
    const curr = onTop(230);
    assert.equal(
      landingFloorTop({
        velocityY: 1100,
        prev,
        curr,
        floors: [
          { aabb: low },
          { aabb: high },
        ],
      }),
      120,
    );
  });
});

describe("fall speed cap", () => {
  it("clamps downward speed so a long frame cannot skip a tile", () => {
    assert.equal(capFallSpeed(400), 400);
    assert.equal(capFallSpeed(2000), MAX_FALL_SPEED);
    assert.ok(MAX_FALL_SPEED * 0.05 < 48, "50ms at max fall still fits inside a 48px tile");
  });
});

describe("level entrances", () => {
  it("only lets you into a level on a fresh Up press, not walk or jump", () => {
    assert.equal(canEnterDoor({ upPressed: true }), true);
    assert.equal(canEnterDoor({ upPressed: false }), false);
  });
});

/*
 * Regression: "walk into the side of a floor platform and you instantly die".
 * Runs Phaser's real Arcade Y-overlap + Y-separation code (Y goes first because
 * gravity is on Y) against a static 48px tile, the way the play scene's
 * colliders do.
 */
import { createRequire } from "node:module";
import { ARCADE_OVERLAP_BIAS } from "./floors.ts";

const req = createRequire(import.meta.url);
const GetOverlapY = req("phaser/src/physics/arcade/GetOverlapY.js");
const ProcessY = req("phaser/src/physics/arcade/ProcessY.js");
const ARCADE = req("phaser/src/physics/arcade/const.js");

type FakeBody = ReturnType<typeof makeBody>;
function makeBody(x: number, bottom: number, w: number, h: number, dy: number, isStatic = false) {
  const flags = () => ({ none: true, up: false, down: false, left: false, right: false });
  const b = {
    x,
    y: bottom - h,
    width: w,
    height: h,
    _dy: dy,
    get right() { return this.x + this.width; },
    get bottom() { return this.y + this.height; },
    deltaAbsY() { return Math.abs(this._dy); },
    physicsType: isStatic ? ARCADE.STATIC_BODY : ARCADE.DYNAMIC_BODY,
    immovable: isStatic,
    pushable: !isStatic,
    moves: false,
    mass: 1,
    bounce: { x: 0, y: 0 },
    velocity: { x: 0, y: isStatic ? 0 : dy * 60 },
    checkCollision: { none: false, up: true, down: true, left: true, right: true },
    touching: flags(),
    blocked: flags(),
    embedded: false,
    processY(by: number) { this.y += by; },
  };
  return b;
}

/** One Arcade Y-separation of a moving body against a static tile (SeparateY with body2 immovable). */
function separateY(body: FakeBody, tile: FakeBody, bias: number) {
  const overlap = GetOverlapY(body, tile, false, bias);
  if (overlap === 0) return 0;
  ProcessY.RunImmovableBody2(ProcessY.Set(body, tile, overlap));
  return overlap;
}

const TILE = 48;
const tileAt = (col: number, row: number) => makeBody(col * TILE, (row + 1) * TILE, TILE, TILE, 0, true);

describe("side collisions never push a hero through the floor", () => {
  // Hero bodies are ~27x39 (Cuboe, Cubro, Candy Cube), enemies ~30x35: all shorter than a tile.
  for (const h of [35, 39, 44, 47]) {
    it(`walking into a one-tile step (body ${h}px) is not a vertical hit`, () => {
      // Standing on row 14 (top y=672), pressing right into the tile at col 58 row 13 (624..672).
      const hero = makeBody(58 * TILE - 26, 672, 27, h, 0.3);
      const wall = tileAt(58, 13);
      const y0 = hero.y;
      assert.equal(separateY(hero, wall, ARCADE_OVERLAP_BIAS), 0);
      assert.equal(hero.y, y0, "no vertical shove");
    });

    it(`walking in a trench into the floor's side (body ${h}px) is not a vertical hit`, () => {
      // Trench row 15 (top 720) next to the floor tile on row 14 (672..720).
      const hero = makeBody(58 * TILE - 26, 720, 27, h, 0.3);
      assert.equal(separateY(hero, tileAt(58, 14), ARCADE_OVERLAP_BIAS), 0);
    });
  }

  it("documents the bug: a tile-sized bias shoved the hero DOWN into the floor", () => {
    const hero = makeBody(58 * TILE - 26, 672, 27, 39, 0.3);
    separateY(hero, tileAt(58, 13), TILE);
    assert.ok(hero.bottom > 672, "old bias pushed the body below the floor top");
  });

  it("floor phasing still prevented: a max-speed fall that sank into the floor is put back on top", () => {
    const dy = MAX_FALL_SPEED / 60; // fixed 60fps step
    const hero = makeBody(100, 672 + dy - 1, 27, 39, dy);
    const floorTile = tileAt(2, 14);
    assert.notEqual(separateY(hero, floorTile, ARCADE_OVERLAP_BIAS), 0);
    assert.equal(hero.bottom, 672);
  });

  it("ceilings: jumping up into a tile pushes the hero back down below it", () => {
    const dy = -14;
    const hero = makeBody(100, 672 - 9 + 39, 27, 39, dy); // head 9px into the tile above (624..672)
    const ceiling = tileAt(2, 13);
    assert.notEqual(separateY(hero, ceiling, ARCADE_OVERLAP_BIAS), 0);
    assert.equal(hero.y, 672);
  });

  it("standing still on a floor next to a wall is untouched", () => {
    const hero = makeBody(58 * TILE - 27, 672, 27, 39, 0);
    assert.equal(separateY(hero, tileAt(58, 13), ARCADE_OVERLAP_BIAS), 0);
  });
});

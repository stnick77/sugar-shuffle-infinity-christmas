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

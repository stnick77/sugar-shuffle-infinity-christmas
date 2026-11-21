import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { navActionForKey, nextNavIndex, padActions, padSnapshot } from "./nav.ts";

describe("menu navigation", () => {
  it("maps Down / S and Up / W to moves, Enter / Space to activate", () => {
    assert.deepEqual(navActionForKey("ArrowDown"), { kind: "move", dir: 1 });
    assert.deepEqual(navActionForKey("KeyS"), { kind: "move", dir: 1 });
    assert.deepEqual(navActionForKey("ArrowUp"), { kind: "move", dir: -1 });
    assert.deepEqual(navActionForKey("KeyW"), { kind: "move", dir: -1 });
    assert.deepEqual(navActionForKey("Enter"), { kind: "activate" });
    assert.deepEqual(navActionForKey("Space"), { kind: "activate" });
    assert.equal(navActionForKey("KeyJ"), null);
  });

  it("Down walks through every item of a long list (Christmas closet with Candy Cube rows)", () => {
    const count = 12;
    let i = -1;
    const seen: number[] = [];
    for (let n = 0; n < count + 3; n++) {
      i = nextNavIndex(i, count, 1);
      seen.push(i);
    }
    assert.deepEqual(seen.slice(0, count), [...Array(count).keys()]);
    assert.equal(i, count - 1, "settles on the last item");
    assert.equal(nextNavIndex(i, count, -1), count - 2);
    assert.equal(nextNavIndex(0, count, -1), 0);
    assert.equal(nextNavIndex(-1, count, -1), count - 1);
    assert.equal(nextNavIndex(-1, 0, 1), -1);
  });

  it("gamepad d-pad / stick / A are edge-detected", () => {
    const pad = (b: number[], ay = 0) => ({ axes: [0, ay], buttons: Array.from({ length: 16 }, (_, k) => ({ pressed: b.includes(k) })) });
    const idle = padSnapshot([null]);
    const down = padSnapshot([pad([13])]);
    assert.deepEqual(padActions(idle, down), [{ kind: "move", dir: 1 }]);
    assert.deepEqual(padActions(down, down), [], "holding does not repeat");
    assert.deepEqual(padActions(idle, padSnapshot([pad([], -0.9)])), [{ kind: "move", dir: -1 }]);
    assert.deepEqual(padActions(idle, padSnapshot([pad([0])])), [{ kind: "activate" }]);
  });
});

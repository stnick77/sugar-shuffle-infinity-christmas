import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BACKROOMS_HEROES, BACKROOMS_HERO_HINT, ENTITY_GLITCH, heroUnlocked, migrateRewardHeroes, unlockRewardHeroes } from "./heroes.ts";
import { escapeRewards } from "./backrooms.ts";
import { COMBOS, HEROES } from "../data/world.ts";

const png = (rel: string) => {
  const b = readFileSync(new URL(`../../../public${rel}`, import.meta.url));
  assert.equal(b.toString("ascii", 1, 4), "PNG", rel);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] };
};

describe("Backrooms reward heroes", () => {
  it("are Hazmat Cube and Entity Cube, locked with the hint until you escape", () => {
    assert.deepEqual(BACKROOMS_HEROES, ["hazmat-cube", "entity-cube"]);
    assert.equal(HEROES["hazmat-cube"].name, "Hazmat Cube");
    assert.equal(HEROES["entity-cube"].name, "Entity Cube");
    for (const id of BACKROOMS_HEROES) {
      assert.equal(HEROES[id].reward, "backrooms");
      assert.equal(HEROES[id].lockedHint ?? BACKROOMS_HERO_HINT, "Escape the Backrooms");
      assert.ok(COMBOS[id]?.length, `${id} has a combo list`);
      assert.equal(heroUnlocked({ heroes: [] }, id), false);
      assert.equal(heroUnlocked({}, id), false);
      assert.equal(heroUnlocked({ heroes: [id] }, id), true);
    }
    assert.equal(heroUnlocked({ heroes: [] }, "cuboe"), true, "normal heroes are never reward-locked");
  });

  it("escaping (heaven ESCAPE door) persists both, once", () => {
    const save = { lore: [], endings: [], completed: ["br-boss"], ranks: {}, heroes: [] as string[] };
    const r = escapeRewards(save, "A");
    assert.deepEqual(r.heroes, ["hazmat-cube", "entity-cube"]);
    assert.ok(r.completed.includes("br-heaven"));
    assert.deepEqual(unlockRewardHeroes([]).fresh, ["hazmat-cube", "entity-cube"], "popup shows both the first time");
    assert.deepEqual(unlockRewardHeroes(r.heroes).fresh, [], "no popup on a second escape");
    assert.deepEqual(escapeRewards({ ...save, heroes: r.heroes }, "S").heroes, r.heroes, "no duplicates");
  });

  it("save migration keeps valid unlocks and grants them to saves that escaped before", () => {
    assert.deepEqual(migrateRewardHeroes(undefined, []), []);
    assert.deepEqual(migrateRewardHeroes(["entity-cube", "bogus", "cuboe"], []), ["entity-cube"]);
    assert.deepEqual(migrateRewardHeroes([], ["br-escape", "br-heaven"]), ["hazmat-cube", "entity-cube"]);
  });

  it("Entity Cube's constant glitch is mild and stays under 3 Hz", () => {
    assert.ok(ENTITY_GLITCH.burstsPerSec <= 3);
    assert.ok(1000 / (ENTITY_GLITCH.burstMs + 1000 / ENTITY_GLITCH.burstsPerSec * 0.6) < 3);
    assert.ok(ENTITY_GLITCH.ghostAlpha <= 0.25, "faint ghosts");
    assert.ok(ENTITY_GLITCH.burstSplit <= 5 && ENTITY_GLITCH.burstSlices <= 2, "small bursts");
  });

  it("have full sprite sheets in the player format (2x2 x 128px) and a 128px portrait", () => {
    for (const id of BACKROOMS_HEROES) {
      for (const a of ["idle", "run", "jump", "attack"]) {
        const m = png(`/game/sprites/${id}-${a}.png`);
        assert.deepEqual([m.w, m.h, m.colorType], [256, 256, 6], `${id}-${a}`);
      }
      assert.deepEqual([png(HEROES[id].portrait).w, png(HEROES[id].portrait).h], [128, 128]);
      const ref = png("/game/sprites/cuboe-idle.png");
      assert.deepEqual([ref.w, ref.h], [256, 256]);
    }
  });
});

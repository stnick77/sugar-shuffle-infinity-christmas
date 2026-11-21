import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { LEVELS } from "./levels.ts";
import { LEVEL_THEMES } from "./levelThemes.ts";
import { FLOORS } from "./world.ts";
import { LEVEL_SONGS, composeSong, songById, songGain } from "../music/levelSongs.ts";

// every level, plus the one themed hub (Floor 470539758, the Backrooms)
const levelIds = Object.values(LEVELS)
  .filter((l) => !l.isHub || l.themed)
  .map((l) => l.id);
const root = new URL("../../../", import.meta.url);

describe("per-level themes (door, platform tiles, song)", () => {
  it("every level has a theme", () => {
    for (const id of levelIds) assert.ok(LEVEL_THEMES[id], `missing theme for ${id}`);
    assert.equal(Object.keys(LEVEL_THEMES).length, levelIds.length);
  });

  it("doors, tiles and songs are unique per level", () => {
    for (const key of ["door", "tiles", "song"] as const) {
      const vals = levelIds.map((id) => LEVEL_THEMES[id]![key]);
      assert.equal(new Set(vals).size, vals.length, `${key} ids are shared`);
    }
  });

  it("art files exist", () => {
    for (const id of levelIds) {
      const t = LEVEL_THEMES[id]!;
      assert.ok(existsSync(new URL(`public/game/sprites/doors/${t.door}.png`, root)), t.door);
      assert.ok(existsSync(new URL(`public/game/sprites/tiles/${t.tiles}.png`, root)), t.tiles);
    }
  });

  it("every hub door and boss door has art", () => {
    for (const f of FLOORS) for (const l of [...f.levels, f.boss]) assert.ok(LEVEL_THEMES[l.id]?.door, l.id);
  });

  it("every song exists, belongs to its level and is distinct", () => {
    const combos = new Set<string>();
    for (const id of levelIds) {
      const song = songById(LEVEL_THEMES[id]!.song);
      assert.ok(song, `${id} song`);
      assert.equal(song.level, id);
      combos.add(`${song.key}-${song.mode}-${song.bpm}`);
      const { events, length } = composeSong(song);
      assert.ok(length > 15 && length < 60, `${song.id} loop length ${length}`);
      assert.ok(events.every((e) => Number.isFinite(e.hz) && e.t >= 0 && e.t < length), `${song.id} events in loop`);
      assert.ok(events.some((e) => e.voice === "lead") && events.some((e) => e.voice === "bass"));
      const g = songGain(song.id);
      assert.ok(g >= 0.4 && g <= 2.5, `${song.id} gain ${g}`);
    }
    assert.equal(combos.size, levelIds.length, "two songs share key + mode + tempo");
    assert.equal(new Set(LEVEL_SONGS.map((s) => s.title)).size, LEVEL_SONGS.length);
  });
});

describe("level backgrounds", () => {
  it("every level background file exists", () => {
    for (const l of Object.values(LEVELS)) assert.ok(existsSync(new URL(`public${l.bg}`, root)), `${l.id}: ${l.bg}`);
  });

  it("the Marshmallow Outlaw fights in the midnight shootout (and only he does)", () => {
    assert.equal(LEVELS["f2-boss"]!.bg, "/game/bg/midnight-shootout.jpg");
    const users = Object.values(LEVELS).filter((l) => l.bg === "/game/bg/midnight-shootout.jpg").map((l) => l.id);
    assert.deepEqual(users, ["f2-boss"]);
  });
});

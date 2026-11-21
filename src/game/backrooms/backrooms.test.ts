import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  BACKROOMS_BACKGROUNDS,
  BACKROOMS_BOSS,
  BACKROOMS_ENEMIES,
  BACKROOMS_FLOOR,
  BACKROOMS_FLOOR_DEF,
  BACKROOMS_HUB,
  BACKROOMS_LEVELS,
  BACKROOMS_NAME,
  ENEMY_CHARS,
  ENEMY_INFO,
  discovered,
  enterBackrooms,
  floorDef,
  leaveBackrooms,
  shouldNoclip,
  redHubLevel,
  redHubWatchers,
  redHubWords,
} from "./backrooms.ts";
import { LEVELS, hubIdFor } from "../data/levels.ts";
import {
  BACKROOMS_ESCAPE,
  BACKROOMS_HEAVEN,
  CHASE,
  CHASE_WORDS,
  CHASE_CHECKPOINTS,
  chaseCheckpoint,
  TRAPPED_ENDING,
  TRAPPED_NAME,
  caught,
  escapeChoices,
  escapeRewards,
  isBackroomsRoom as inBackrooms,
  stepChaser,
} from "./backrooms.ts";
import { HEROES } from "../data/world.ts";
import { LEVEL_THEMES } from "../data/levelThemes.ts";
import { BOSSES, ENDINGS, FLOORS, LORE } from "../data/world.ts";
import { BOSS_FORMS, BOSS_MOVES, movesFor, phaseFor } from "../bosses/moves.ts";
import { songById } from "../music/levelSongs.ts";

const root = new URL("../../../", import.meta.url);
const ROOMS = [BACKROOMS_HUB, ...BACKROOMS_LEVELS.map((l) => l.id), BACKROOMS_BOSS];
/** Every room with its own look, including the escape chase and the heaven room (no enemies there). */
const ALL = [...ROOMS, BACKROOMS_ESCAPE, BACKROOMS_HEAVEN];
const fresh = { lore: [] as string[], unlockedFloors: [1, 2, 3, 4, 5] };

describe("Floor 470539758: getting there", () => {
  it("the final boss door phases you through the floor with 1 lore", () => {
    assert.equal(shouldNoclip({ ...fresh, lore: ["choco"] }, "f5-boss"), true);
    assert.equal(shouldNoclip({ ...fresh, lore: ["choco", "rift"] }, "f5-boss"), true);
  });

  it("without lore the boss door is a normal boss door", () => {
    assert.equal(shouldNoclip(fresh, "f5-boss"), false);
  });

  it("only the final boss door hides it", () => {
    for (const f of FLOORS.slice(0, 4)) assert.equal(shouldNoclip({ ...fresh, lore: ["choco"] }, f.boss.id), false, f.boss.id);
    assert.equal(shouldNoclip({ ...fresh, lore: ["choco"] }, "final-run"), false);
  });

  it("once found, the boss door works normally again (the tear in the Floor 5 hub takes you back)", () => {
    const after = { ...fresh, lore: ["choco"], ...enterBackrooms({ ...fresh, lore: ["choco"] }) };
    assert.equal(discovered(after), true);
    assert.equal(shouldNoclip(after, "f5-boss"), false);
    assert.ok(LEVELS["hub-5"]!.rows.some((r) => r.includes("N")), "Floor 5 hub has the tear");
  });

  it("landing saves the discovery and the floor; EXIT goes back to Floor 5", () => {
    const s = enterBackrooms(fresh);
    assert.equal(s.floor, BACKROOMS_FLOOR);
    assert.ok(s.unlockedFloors.includes(BACKROOMS_FLOOR));
    assert.equal(hubIdFor(s.floor), BACKROOMS_HUB);
    assert.equal(leaveBackrooms().floor, 5);
    assert.equal(hubIdFor(5), "hub-5");
    assert.ok(LEVELS[BACKROOMS_HUB]!.rows.some((r) => r.includes("O")), "hub has the EXIT door");
  });
});

describe("Floor 470539758: the name", () => {
  it("is exactly 'Floor 470539758' everywhere", () => {
    assert.equal(BACKROOMS_NAME, "Floor 470539758");
    assert.equal(BACKROOMS_NAME, `Floor ${BACKROOMS_FLOOR}`);
    assert.equal(LEVELS[BACKROOMS_HUB]!.name, "Floor 470539758");
    assert.equal(BACKROOMS_FLOOR_DEF.name, "Floor 470539758");
    assert.equal(BACKROOMS_FLOOR_DEF.hubTitle, "Floor 470539758");
    assert.equal(floorDef(BACKROOMS_FLOOR)?.name, "Floor 470539758");
  });
});

describe("Floor 470539758: rooms", () => {
  it("has the four Backrooms levels and Bacteria", () => {
    assert.deepEqual(
      BACKROOMS_LEVELS.map((l) => l.name),
      ["Level 0", "Motion", "Pool Rooms", "Cave System"],
    );
    for (const l of BACKROOMS_LEVELS) assert.equal(LEVELS[l.id]?.name, l.name);
    assert.equal(LEVELS[BACKROOMS_BOSS]?.isBoss, true);
    assert.equal(LEVELS[BACKROOMS_BOSS]?.bossId, BACKROOMS_BOSS);
    assert.equal(LEVELS[BACKROOMS_HUB]?.isHub, true);
  });

  it("hub, levels, boss, chase and heaven room each have their own door, tiles, song and background", () => {
    for (const key of ["door", "tiles", "song"] as const) {
      const mine = ALL.map((id) => LEVEL_THEMES[id]?.[key]);
      assert.ok(mine.every(Boolean), `${key} missing`);
      assert.equal(new Set(mine).size, ALL.length, `${key} shared inside the Backrooms`);
      const others = Object.entries(LEVEL_THEMES).filter(([id]) => !ALL.includes(id)).map(([, t]) => t[key]);
      for (const v of mine) assert.ok(!others.includes(v!), `${key} ${v} shared with another floor`);
    }
    const bgs = ALL.map((id) => LEVELS[id]!.bg);
    assert.equal(new Set(bgs).size, ALL.length, "backgrounds shared inside the Backrooms");
    for (const id of ALL) {
      assert.equal(LEVELS[id]!.bg, BACKROOMS_BACKGROUNDS[id]);
      assert.ok(existsSync(new URL(`public${LEVELS[id]!.bg}`, root)), LEVELS[id]!.bg);
    }
    const otherBgs = Object.values(LEVELS).filter((l) => !ALL.includes(l.id)).map((l) => l.bg);
    for (const b of bgs) assert.ok(!otherBgs.includes(b), `${b} shared with another floor`);
    for (const id of ALL) {
      const song = songById(LEVEL_THEMES[id]!.song);
      assert.ok(song, id);
      assert.equal(song.level, id);
    }
  });

  it("hub, levels and boss each have their own enemies", () => {
    assert.deepEqual(Object.keys(BACKROOMS_ENEMIES).sort(), [...ROOMS].sort());
    const all = Object.values(BACKROOMS_ENEMIES).flat();
    assert.equal(new Set(all).size, all.length, "an enemy is used in two rooms");
    for (const kind of all) {
      assert.ok(ENEMY_INFO[kind], kind);
      assert.ok(existsSync(new URL(`public/game/sprites/${kind}.png`, root)), kind);
    }
    assert.equal(ENEMY_INFO["br-moth"]!.harmless, true, "hub enemies are harmless ambience");
    // each room's map places only its own enemies, and only the Backrooms use them
    for (const l of Object.values(LEVELS)) {
      const placed = new Set<string>();
      for (const row of l.rows) for (const ch of row) if (ENEMY_CHARS[ch]) placed.add(ENEMY_CHARS[ch]!);
      if (!ROOMS.includes(l.id)) {
        assert.equal(placed.size, 0, `${l.id} uses Backrooms enemies`);
        continue;
      }
      for (const k of placed) assert.ok(BACKROOMS_ENEMIES[l.id]!.includes(k), `${l.id} places ${k}`);
      if (l.id !== BACKROOMS_BOSS) assert.ok(placed.size > 0, `${l.id} has no enemies`);
    }
  });

  it("every Backrooms map is a clean rectangle (no row longer than the floor under it)", () => {
    for (const id of ALL) {
      const rows = LEVELS[id]!.rows;
      for (const r of rows) assert.equal(r.length, rows[0]!.length, `${id}: ragged row "${r}"`);
    }
  });

  it("every Backrooms level can be finished (start to exit)", () => {
    for (const l of BACKROOMS_LEVELS) assert.ok(reachable(LEVELS[l.id]!.rows), `${l.id} exit unreachable`);
  });
});

describe("Bacteria (and Void)", () => {
  it("boss config", () => {
    const b = BOSSES[BACKROOMS_BOSS]!;
    assert.equal(b.name, "Bacteria");
    assert.equal(b.sprite, "bacteria");
    assert.equal(b.lives, 9);
    assert.ok(existsSync(new URL("public/game/sprites/bacteria.png", root)));
    assert.ok(existsSync(new URL("public/game/sprites/bacteria-void.png", root)));
    assert.equal(LEVEL_THEMES[BACKROOMS_BOSS]!.door, "door-boss-bacteria");
  });

  it("3 phases: Bacteria, then Void, then Bacteria again", () => {
    assert.equal(phaseFor(9, 9), 1);
    assert.equal(phaseFor(6, 9), 2);
    assert.equal(phaseFor(3, 9), 3);
    assert.equal(BOSS_FORMS[BACKROOMS_BOSS]![1]!.sprite, "bacteria");
    assert.equal(BOSS_FORMS[BACKROOMS_BOSS]![2]!.sprite, "bacteria-void");
    assert.equal(BOSS_FORMS[BACKROOMS_BOSS]![2]!.name, "Void");
    assert.equal(BOSS_FORMS[BACKROOMS_BOSS]![3]!.sprite, "bacteria");
  });

  it("each phase has its own moves; Void's moves are only in phase 2", () => {
    const ids = (p: number) => movesFor(BACKROOMS_BOSS, p).map((m) => m.id);
    assert.ok(ids(1).length >= 3);
    assert.ok(ids(2).includes("voidorbs") && ids(2).includes("grin"));
    for (const p of [1, 3]) assert.ok(!ids(p).includes("voidorbs") && !ids(p).includes("grin"), `void move in phase ${p}`);
    assert.ok(ids(3).includes("stretch") && ids(3).includes("frenzy"));
    assert.ok(BOSS_MOVES[BACKROOMS_BOSS]!.length >= 6);
  });

  it("reward: lore + secret ending (the True ending list is unchanged)", () => {
    assert.ok(LORE.some((l) => l.id === "bacteria"));
    assert.ok(ENDINGS.some((e) => e.id === "backrooms"));
  });
});

/**
 * Coarse platforming check: standing spots are open 2-tall cells over something solid
 * (or water, where you can swim; or a moving platform). From a spot you can jump to
 * another up to 2 tiles higher (the hero's jump) and 4 across, or drop to one up to 6 across.
 */
function reachable(rows: string[]): boolean {
  const H = rows.length;
  const W = rows[0]!.length;
  const at = (x: number, y: number) => rows[y]?.[x] ?? (y >= H ? "#" : ".");
  const solid = (c: string) => "#=<>".includes(c);
  const open = (c: string) => !solid(c);
  const stand: [number, number][] = [];
  let start: [number, number] | null = null;
  let exit: [number, number] | null = null;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = at(x, y);
      if (c === "S") start = [x, y];
      if (c === "X") exit = [x, y];
      const below = at(x, y + 1);
      const ok = open(c) && open(at(x, y - 1)) && (solid(below) || below === "w" || c === "w" || "~^".includes(below) || "~^".includes(at(x - 1, y + 1)));
      if (ok) stand.push([x, y]);
    }
  if (!start || !exit) return false;
  const key = (p: [number, number]) => `${p[0]},${p[1]}`;
  const seen = new Set([key(start)]);
  const q: [number, number][] = [start];
  const standSet = new Map(stand.map((p) => [key(p), p]));
  standSet.set(key(start), start);
  while (q.length) {
    const [x, y] = q.shift()!;
    if (Math.abs(x - exit[0]) <= 1 && Math.abs(y - exit[1]) <= 1) return true;
    for (const p of standSet.values()) {
      if (seen.has(key(p))) continue;
      const dx = Math.abs(p[0] - x);
      const up = y - p[1];
      const swim = at(x, y) === "w" || at(x, y + 1) === "w";
      if ((up >= 0 && up <= (swim ? 3 : 2) && dx <= 4) || (up < 0 && dx <= 6)) {
        seen.add(key(p));
        q.push(p);
      }
    }
  }
  return false;
}

describe("the hub turns red after you clear Backrooms levels", () => {
  it("normal until a Backrooms level is cleared, then stronger with each one", () => {
    assert.equal(redHubLevel([]), 0);
    assert.equal(redHubLevel(["f1-1", "f5-boss"]), 0);
    assert.deepEqual(redHubWords(0), []);
    assert.deepEqual(redHubWatchers(0), []);
    assert.equal(redHubLevel(["br-pool"]), 1);
    assert.equal(redHubLevel(["br-0", "br-motion", "br-pool", "br-cave"]), 4);
    let last = 0;
    for (let n = 1; n <= 4; n++) {
      const words = redHubWords(n);
      assert.ok(words.length > last, `more words at ${n}`);
      last = words.length;
      assert.ok(words.every((w) => w.y + w.size < 500), "words stay above the doors");
    }
    assert.ok(redHubWords(1).some((w) => w.text === "RUN"));
    assert.ok(redHubWords(4).some((w) => w.text === "NO ESCAPE") && redHubWords(4).some((w) => w.text === "WHEN WILL IT END"));
  });

  it("the watcher stands in a different hallway after each clear", () => {
    const spots = [1, 2, 3, 4].map((n) => redHubWatchers(n)[0]!.x);
    assert.equal(new Set(spots).size, 4);
    assert.equal(redHubWatchers(3).length, 2);
  });
});

describe("the escape chase after Bacteria", () => {
  const rows = LEVELS[BACKROOMS_ESCAPE]!.rows;

  it("is a long, red Backrooms hallway with its own background and song", () => {
    const l = LEVELS[BACKROOMS_ESCAPE]!;
    assert.equal(l.chase, true);
    assert.ok(rows[0]!.length >= 100, "the hallway is long");
    assert.equal(LEVEL_THEMES[BACKROOMS_ESCAPE]!.song, "red-hallway-run");
    assert.ok(inBackrooms(BACKROOMS_ESCAPE));
    assert.ok(CHASE_WORDS.some((w) => w.text === "GET OUT"));
    assert.ok(CHASE_WORDS.some((w) => w.text === "ESCAPE AHEAD"));
    assert.ok(CHASE_WORDS.some((w) => w.text === "RUN FOR YOUR LIFE!"));
    for (const w of CHASE_WORDS) assert.ok(w.col > 0 && w.col < rows[0]!.length);
  });

  it("the exit can be reached", () => {
    assert.ok(reachable(rows));
  });

  it("is fair: Bacteria walks slower than you do and waits before it starts", () => {
    assert.ok(CHASE.graceMs >= 1000);
    assert.ok(CHASE.speed < 260, "slower than walking");
    assert.ok(CHASE.catchUpSpeed < 432, "even catching up it is slower than running");
    // running the whole hallway at a plain walk with a few stumbles still escapes
    const len = rows[0]!.length * 48;
    let hero = 96;
    let chaser = hero - CHASE.restartGap;
    let t = 0;
    while (hero < len) {
      const dt = 1 / 60;
      t += dt;
      const stumble = Math.floor(t) % 6 === 5; // a second lost every 6 s (jumping, a pit wobble)
      hero += stumble ? 60 * dt : 260 * dt;
      if (t * 1000 > CHASE.graceMs) chaser = stepChaser(chaser, hero, dt);
      assert.ok(!caught(chaser, hero), `caught at ${Math.round(hero)}px`);
    }
  });

  it("checkpoints sit on solid floor, so a pit or a catch never sends you all the way back", () => {
    const floor = rows[rows.length - 1]!;
    for (const c of CHASE_CHECKPOINTS) assert.equal(floor[c], "#", `checkpoint ${c} over a pit`);
    assert.equal(chaseCheckpoint(10), 0);
    assert.equal(chaseCheckpoint(70), 62);
    assert.equal(chaseCheckpoint(119), 86);
  });

  it("standing still gets you caught (it really chases)", () => {
    let chaser = 96 - CHASE.restartGap;
    let n = 0;
    while (!caught(chaser, 96) && n++ < 2000) chaser = stepChaser(chaser, 96, 1 / 60);
    assert.ok(caught(chaser, 96));
  });
});

describe("the heaven room and the ESCAPE door", () => {
  it("is a bright room with a white ESCAPE door, its own art and calm song", () => {
    const l = LEVELS[BACKROOMS_HEAVEN]!;
    assert.equal(l.heaven, true);
    assert.ok(l.rows.some((r) => r.includes("Y")), "ESCAPE door");
    assert.equal(LEVEL_THEMES[BACKROOMS_HEAVEN]!.door, "door-br-heaven");
    assert.equal(songById("above-the-yellow")!.drums, "none");
  });

  it("escaping gives the reward and puts you back on Floor 5", () => {
    const save = { lore: ["rift"], endings: [], completed: [], ranks: {} as Record<string, string> };
    const r = escapeRewards<string>(save, "S");
    assert.ok(r.lore.includes("bacteria"));
    assert.ok(r.endings.includes("backrooms"));
    assert.ok(r.completed.includes(BACKROOMS_ESCAPE));
    assert.equal(r.ranks[BACKROOMS_ESCAPE], "S");
    assert.equal(r.floor, 5);
    // twice is the same
    assert.deepEqual(escapeRewards<string>({ ...save, ...r }, "S").lore, r.lore);
  });

  it("you pick Floor 5 or the house; without the Christmas DLC it is just Floor 5", () => {
    assert.deepEqual(escapeChoices(true), ["floor5", "house"]);
    assert.deepEqual(escapeChoices(false), ["floor5"]);
  });
});

describe("TrAppEd fOrEvEr", () => {
  it("is a saved ending with that exact name", () => {
    assert.equal(TRAPPED_NAME, "TrAppEd fOrEvEr");
    const e = ENDINGS.find((x) => x.id === TRAPPED_ENDING);
    assert.equal(e?.name, "TrAppEd fOrEvEr");
  });

  it("counts anywhere on Floor 470539758", () => {
    for (const id of [...ALL]) assert.ok(inBackrooms(id), id);
    assert.ok(!inBackrooms("f5-1"));
    assert.ok(!inBackrooms("hub-5"));
  });
  void HEROES;
});

import { describe, it } from "node:test";
import { BOSS_MOVES, movesFor, nextMove, phaseFor } from "../bosses/moves.ts";
import assert from "node:assert/strict";
import {
  COLLECTABLES,
  DECEMBER_GIFT_ID,
  XMAS_DEFAULTS,
  activeCosmetics,
  claimDecemberGift,
  collect,
  collectableForCandy,
  decemberGiftDue,
  normalizeXmas,
  parseDlcDate,
  toggleDlc,
  toggleEquip,
} from "./logic.ts";
import { ALL_SONGS, LICENSED_SLOTS, ORIGINAL_THEMES, PUBLIC_DOMAIN_CAROLS, bassLine, parseMelody, songBeats, themeForArea } from "./carols.ts";

describe("DLC toggle", () => {
  it("is off by default and the DLC button flips it on then off", () => {
    const s0 = normalizeXmas(undefined);
    assert.equal(s0.enabled, false);
    const s1 = toggleDlc(s0);
    assert.equal(s1.enabled, true);
    assert.ok(s1.owned.includes("santa-hat"));
    assert.ok(s1.owned.includes("elf-costume"));
    assert.ok(s1.owned.includes("candle-aura"));
    assert.ok(!s1.owned.includes(DECEMBER_GIFT_ID), "retired scarf is not granted with the DLC");
    const s2 = toggleDlc(s1);
    assert.equal(s2.enabled, false);
    assert.deepEqual(activeCosmetics({ ...s2, equipped: { cuboe: ["santa-hat"], cubro: [], "candy-cube": [] } }, "cuboe"), []);
  });
  it("survives a JSON round-trip (localStorage persistence)", () => {
    const s = toggleDlc(normalizeXmas(undefined));
    const back = normalizeXmas(JSON.parse(JSON.stringify(s)));
    assert.equal(back.enabled, true);
    assert.deepEqual(back.owned, s.owned);
  });
  it("normalizes old/partial saves", () => {
    const s = normalizeXmas({ enabled: true } as never);
    assert.deepEqual(s.collected, XMAS_DEFAULTS.collected);
    assert.deepEqual(s.equipped, { cuboe: [], cubro: [], "candy-cube": [] });
  });
});

describe("cosmetics", () => {
  it("equips per hero and per slot", () => {
    let s = toggleDlc(normalizeXmas(undefined));
    s = toggleEquip(s, "cuboe", "santa-hat");
    s = toggleEquip(s, "cuboe", "present-aura");
    assert.deepEqual(activeCosmetics(s, "cuboe").sort(), ["present-aura", "santa-hat"]);
    // Cubro can't wear Cuboe's hat
    assert.deepEqual(toggleEquip(s, "cubro", "santa-hat"), s);
    s = toggleEquip(s, "cubro", "snowflake-aura");
    s = toggleEquip(s, "cubro", "xmas-sweater");
    s = toggleEquip(s, "cubro", "xmas-skateboard");
    assert.equal(activeCosmetics(s, "cubro").length, 3);
    // unequip
    s = toggleEquip(s, "cuboe", "santa-hat");
    assert.deepEqual(activeCosmetics(s, "cuboe"), ["present-aura"]);
  });
  it("can't equip the retired scarf", () => {
    const s = toggleDlc(normalizeXmas(undefined));
    assert.deepEqual(toggleEquip(s, "cuboe", DECEMBER_GIFT_ID), s);
  });
  it("equips Candy Cube's elf costume and candle aura", () => {
    let s = toggleDlc(normalizeXmas(undefined));
    s = toggleEquip(s, "candy-cube", "elf-costume");
    s = toggleEquip(s, "candy-cube", "candle-aura");
    assert.deepEqual(activeCosmetics(s, "candy-cube").sort(), ["candle-aura", "elf-costume"]);
    assert.deepEqual(toggleEquip(s, "cuboe", "elf-costume"), s);
  });
});

describe("collectables", () => {
  it("score what the design sheet says", () => {
    assert.equal(COLLECTABLES.present.points, 30);
    assert.equal(COLLECTABLES.ornament.points, 45);
    assert.equal(COLLECTABLES.tree.points, 65);
    let s = normalizeXmas(undefined);
    s = collect(s, "present");
    s = collect(s, "ornament");
    s = collect(s, "tree");
    assert.equal(s.points, 140);
    assert.deepEqual(s.collected, { present: 1, ornament: 1, tree: 1 });
  });
  it("swaps a deterministic share of candy", () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5].map(collectableForCandy), [null, "present", null, "ornament", null, "present"]);
  });
});

describe("December gift", () => {
  const nov = parseDlcDate("2026-11-10")!;
  const dec = parseDlcDate("2026-12-05")!;
  const dec27 = parseDlcDate("2027-12-01")!;
  it("needs the DLC on and a December date", () => {
    const off = normalizeXmas(undefined);
    assert.equal(decemberGiftDue(off, dec), false);
    const on = toggleDlc(off);
    assert.equal(decemberGiftDue(on, nov), false);
    assert.equal(decemberGiftDue(on, dec), true);
  });
  it("no longer grants the retired scarf; it only stamps the year", () => {
    const on = toggleDlc(normalizeXmas(undefined));
    const a = claimDecemberGift(on, dec);
    assert.equal(a.granted, false);
    assert.ok(!a.state.owned.includes(DECEMBER_GIFT_ID));
    assert.ok(a.state.decemberYears.includes(2026));
    const b = claimDecemberGift(a.state, dec);
    assert.equal(b.granted, false);
    const c = claimDecemberGift(a.state, dec27);
    assert.ok(c.state.decemberYears.includes(2027));
    assert.ok(!c.state.owned.includes(DECEMBER_GIFT_ID));
  });
  it("strips a leftover scarf from old saves", () => {
    const s = normalizeXmas({
      enabled: true,
      owned: [DECEMBER_GIFT_ID, "santa-hat"],
      equipped: { cuboe: [DECEMBER_GIFT_ID], cubro: [] },
    } as never);
    assert.ok(!s.owned.includes(DECEMBER_GIFT_ID));
    assert.deepEqual(s.equipped.cuboe, []);
  });
  it("parses override dates", () => {
    assert.equal(parseDlcDate("2026-12-24")!.getMonth(), 11);
    assert.equal(parseDlcDate("nope"), null);
  });
});

describe("music", () => {
  it("every song's melody fits its bars", () => {
    for (const c of [...ORIGINAL_THEMES, ...PUBLIC_DOMAIN_CAROLS]) {
      const notes = parseMelody(c.melody);
      const total = notes.reduce((n, e) => n + e.beats, 0);
      assert.equal(total, songBeats(c), `${c.title}: ${total} beats vs ${songBeats(c)}`);
      assert.ok(bassLine(c).length > 0);
    }
  });
  it("has Hayden's named themes for every area", () => {
    assert.equal(themeForArea("home").title, "Peaceful Home");
    assert.equal(themeForArea("menu").title, "Ready Up");
    for (const a of ["hub", "level", "boss"] as const) assert.equal(themeForArea(a).area, a);
  });
  it("keeps the five licensed slots as empty placeholders", () => {
    assert.equal(LICENSED_SLOTS.length, 5);
    for (const s of LICENSED_SLOTS) assert.equal(s.kind, "licensed");
    assert.equal(new Set(ALL_SONGS.map((s) => s.id)).size, ALL_SONGS.length);
  });
});

describe("bosses", () => {
  it("phases at 2/3 and 1/3 health", () => {
    assert.equal(phaseFor(6, 6), 1);
    assert.equal(phaseFor(4, 6), 2);
    assert.equal(phaseFor(2, 6), 3);
    assert.equal(phaseFor(7, 9), 1);
    assert.equal(phaseFor(6, 9), 2);
    assert.equal(phaseFor(3, 9), 3);
  });
  it("the last three bosses have 3+ moves from the start and more in later phases", () => {
    for (const id of ["f3-boss", "f4-boss", "f5-boss"]) {
      assert.ok(movesFor(id, 1).length >= 3, id);
      assert.ok(movesFor(id, 3).length > movesFor(id, 1).length, id);
    }
    assert.ok(BOSS_MOVES["f2-boss"]!.length >= 3);
  });
  it("cycles through every move without repeating one back to back", () => {
    for (const id of Object.keys(BOSS_MOVES)) {
      for (const phase of [1, 2, 3]) {
        const seen = new Set<string>();
        let last = "";
        for (let i = 0; i < 12; i++) {
          const mv = nextMove(id, phase, i, last);
          assert.notEqual(mv, last, `${id} p${phase} repeats ${mv}`);
          seen.add(mv);
          last = mv;
        }
        assert.equal(seen.size, movesFor(id, phase).length, `${id} p${phase}`);
      }
    }
  });
});

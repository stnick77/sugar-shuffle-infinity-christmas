import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HEROES } from "../data/world.ts";
import { BOSSES } from "../data/world.ts";
import { toggleDlc, normalizeXmas, cosmeticsFor, DECEMBER_GIFT_ID } from "../dlc/logic.ts";
import {
  ADMIN_BOSS_ID,
  ADMIN_LEVEL_ID,
  ADMIN_PHASE_HP,
  ADMIN_PHASES,
  ADMIN_TOTAL_HP,
  CANDY_CUBE_STATS,
  CREDITS,
  adminWarlordsUnlocked,
  candyCubeUnlocked,
} from "./content.ts";
import { nextAdminPhase, patternAt, patternHasSafeLane, patternsFor } from "../bosses/adminWarlords.ts";

describe("Candy Cube", () => {
  it("matches Hayden's sheet: HP 6, lives 9, speed 0.9, Hard", () => {
    const h = HEROES["candy-cube"];
    assert.equal(h.name, "Candy Cube");
    assert.equal(h.tag, "Hard");
    assert.equal(h.hp, CANDY_CUBE_STATS.hp);
    assert.equal(h.lives, CANDY_CUBE_STATS.lives);
    assert.equal(h.speed, CANDY_CUBE_STATS.speed);
    assert.equal(h.dlc, true);
    assert.equal(h.hp, 6);
    assert.equal(h.lives, 9);
    assert.equal(h.speed, 0.9);
  });
  it("unlocks when the Christmas DLC is on, not by a December gift", () => {
    assert.equal(candyCubeUnlocked(false), false);
    assert.equal(candyCubeUnlocked(true), true);
    const s = toggleDlc(normalizeXmas(undefined));
    assert.ok(s.enabled);
    assert.ok(!s.owned.includes(DECEMBER_GIFT_ID));
    const ids = cosmeticsFor("candy-cube").map((c) => c.id).sort();
    assert.deepEqual(ids, ["candle-aura", "elf-costume"]);
  });
});

describe("Admin Warlords", () => {
  it("is a 3-phase fight with 10 hits per phase (30 total)", () => {
    assert.equal(ADMIN_PHASE_HP, 10);
    assert.equal(ADMIN_PHASES, 3);
    assert.equal(ADMIN_TOTAL_HP, 30);
    assert.equal(BOSSES[ADMIN_BOSS_ID]?.lives, 10);
    assert.equal(ADMIN_LEVEL_ID, ADMIN_BOSS_ID);
    assert.equal(nextAdminPhase(1), 2);
    assert.equal(nextAdminPhase(2), 3);
    assert.equal(nextAdminPhase(3), null);
  });
  it("unlocks only after both the Good and Bad endings", () => {
    assert.equal(adminWarlordsUnlocked([]), false);
    assert.equal(adminWarlordsUnlocked(["good"]), false);
    assert.equal(adminWarlordsUnlocked(["bad"]), false);
    assert.equal(adminWarlordsUnlocked(["good", "bad"]), true);
    assert.equal(adminWarlordsUnlocked(["good", "bad", "normal"]), true);
  });
  it("has a dodge lane in every pattern, and each phase is denser/faster than the last", () => {
    const speeds = (phase: 1 | 2 | 3) =>
      patternsFor(phase).flatMap((p) => p.orbs.map((o) => Math.hypot(o.vx, o.vy)));
    const dens = (phase: 1 | 2 | 3) => patternsFor(phase).reduce((n, p) => n + p.orbs.length, 0);
    const open = (phase: 1 | 2 | 3) => Math.min(...patternsFor(phase).map((p) => p.openMs));
    assert.ok(Math.max(...speeds(2)) > Math.max(...speeds(1)));
    assert.ok(Math.max(...speeds(3)) > Math.max(...speeds(2)));
    assert.ok(dens(2) > dens(1));
    assert.ok(dens(3) > dens(2));
    assert.ok(open(2) < open(1));
    assert.ok(open(3) <= open(2));
    for (const phase of [1, 2, 3] as const) {
      for (let i = 0; i < patternsFor(phase).length; i++) {
        const p = patternAt(phase, i);
        assert.ok(patternHasSafeLane(p), `${p.id} phase ${phase} needs a safe lane`);
        assert.ok(p.openMs >= 450, `${p.id} open window too tight to land a hit`);
        assert.ok(p.orbs.length > 0);
      }
    }
  });
});

describe("Credits", () => {
  it("uses Hayden's transcribed names and sign-off", () => {
    assert.equal(CREDITS.signoff, "Thanks for playing! -Cuboe and Cubro");
    assert.ok(CREDITS.hint.toLowerCase().includes("space"));
    const all: string[] = [...CREDITS.roles.flatMap((r) => r.names), ...CREDITS.crew];
    for (const n of ["Hayden Noel", "Dylan Bradford", "Colton Begor", "Toren Noel", "Martin Noel"]) {
      assert.ok(all.includes(n), n);
    }
    assert.ok(!all.some((n) => /dylon/i.test(n)));
  });
});

import {
  ADMIN_POWERS,
  ADMIN_POWER_EVERY,
  freezeSpeedMul,
  inFreeze,
  powerAt,
  powerDue,
  powersFor,
  teleportTarget,
} from "../bosses/adminWarlords.ts";

describe("Admin Warlords admin powers", () => {
  it("phase 1 teleports; phase 2 adds spawn + glitch; phase 3 adds ban hammer + freeze", () => {
    assert.deepEqual(powersFor(1), ["teleport"]);
    assert.deepEqual([...powersFor(2)].sort(), ["glitch", "spawn", "teleport"]);
    assert.deepEqual([...powersFor(3)].sort(), ["banhammer", "freeze", "glitch", "spawn", "teleport"]);
    for (const ph of [1, 2, 3] as const) for (const id of powersFor(ph)) assert.ok(ADMIN_POWERS[id].from <= ph);
    assert.equal(powerAt(1, 5), "teleport");
    assert.equal(powerAt(3, 0), "banhammer");
  });

  it("every power is telegraphed and announced as ADMIN: ...", () => {
    for (const p of Object.values(ADMIN_POWERS)) {
      assert.ok(p.warnMs >= 500, `${p.id} warning too short`);
      assert.match(p.popup, /^ADMIN: [A-Z ]+$/);
    }
  });

  it("powers come more often each phase", () => {
    assert.ok(ADMIN_POWER_EVERY[1] >= ADMIN_POWER_EVERY[2] && ADMIN_POWER_EVERY[2] >= ADMIN_POWER_EVERY[3]);
    assert.equal(powerDue(1, 2), false);
    assert.equal(powerDue(1, 3), true);
    assert.equal(powerDue(3, 2), true);
  });

  it("ban hammer can be walked out of in time, even as slow Candy Cube (234 px/s walk)", () => {
    const b = ADMIN_POWERS.banhammer;
    const escapePx = b.width / 2 + 24; // half the column + half a hero body
    assert.ok((escapePx / 234) * 1000 < b.warnMs, "warning must be longer than the walk out");
  });

  it("teleport lands far from the player", () => {
    assert.equal(teleportTarget(200, 150, 1750), 1750);
    assert.equal(teleportTarget(1700, 150, 1750), 150);
    assert.ok(Math.abs(teleportTarget(950, 150, 1750) - 950) >= ADMIN_POWERS.teleport.minDist);
  });

  it("freeze: 30% slower for 1.5 s, only inside the burst; glitch never touches controls", () => {
    assert.equal(freezeSpeedMul(true), 0.7);
    assert.equal(freezeSpeedMul(false), 1);
    assert.equal(ADMIN_POWERS.freeze.durationMs, 1500);
    assert.ok(inFreeze(10, 10, 0, 0));
    assert.ok(!inFreeze(200, 0, 0, 0));
    assert.ok(ADMIN_POWERS.glitch.durationMs <= 1500);
    assert.ok(!("reverse" in ADMIN_POWERS.glitch));
  });
});

/**
 * Level data checks (no Phaser): every room has its own background picture,
 * and every ledge and door in the floor hubs can be reached with a normal jump.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/game/data/levels.ts"), "utf8");

function layout(name) {
  const m = new RegExp(`const ${name}: string\\[\\] = \\[([\\s\\S]*?)\\];`).exec(src);
  assert.ok(m, `layout ${name} exists`);
  return [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
}

/** Room id -> background path, read from the LEVELS table. */
function backgrounds() {
  const out = {};
  const body = src.slice(src.indexOf("export const LEVELS"));
  for (const m of body.matchAll(/"?([\w-]+)"?: pack\("[\w-]+",[\s\S]*?\}\),?\n/g)) {
    const bg = /bg: "([^"]+)"/.exec(m[0]);
    out[m[1]] = bg ? bg[1] : "/game/bg/candy-corn-valley.jpg";
  }
  return out;
}

test("every room has its own background picture", () => {
  const bgs = backgrounds();
  delete bgs.hub; // alias of hub-1
  assert.ok(Object.keys(bgs).length >= 31, `found ${Object.keys(bgs).length} rooms`);
  const seen = new Map();
  for (const [id, bg] of Object.entries(bgs)) {
    assert.ok(existsSync(join(root, "public", bg)), `${id}: ${bg} exists`);
    assert.ok(!seen.has(bg), `${id} shares ${bg} with ${seen.get(bg)}`);
    seen.set(bg, id);
  }
});

/*
 * Jump physics (PlayScene): vy -760 (Cuboe) / -820 (Cubro), gravity 1900 rising,
 * 1200 near the top. Cuboe tops out ~150px (~3.1 tiles), Cubro ~178px.
 * Hub rule: no ledge needs more than a 2-tile (96px) climb, so both heroes
 * reach everything without pixel-perfect jumps.
 */
const MAX_RISE = 2;
const maxGap = (rise) => (rise <= 0 ? 5 : rise === 1 ? 3 : 2);

function surfaces(rows) {
  const out = [];
  rows.forEach((row, r) => {
    let c = 0;
    const top = (cc) => "#=".includes(row[cc]) && (r === 0 || !"#=".includes(rows[r - 1][cc]));
    while (c < row.length) {
      if (top(c)) {
        const s = c;
        while (c < row.length && top(c)) c++;
        out.push({ r, c0: s, c1: c - 1, solid: row[s] === "#" });
      } else c++;
    }
  });
  return out;
}

for (const hub of ["HUB1", "HUB2", "HUB3", "HUB4", "HUB5"]) {
  test(`${hub}: every ledge and door is reachable`, () => {
    const rows = layout(hub);
    const S = surfaces(rows);
    const startRow = rows.findIndex((r) => r.includes("S")) + 1;
    const start = S.find((s) => s.r === startRow);
    const seen = new Set([start]);
    const q = [start];
    while (q.length) {
      const a = q.shift();
      for (const b of S) {
        if (seen.has(b)) continue;
        const rise = a.r - b.r;
        if (rise > MAX_RISE) continue;
        const gap = Math.max(0, b.c0 - a.c1 - 1, a.c0 - b.c1 - 1);
        if (gap > maxGap(rise)) continue;
        // can't jump up through a solid block from directly underneath it
        if (rise > 0 && b.solid && b.c0 - 1 <= a.c0 && a.c1 <= b.c1 + 1) continue;
        seen.add(b);
        q.push(b);
      }
    }
    const missing = S.filter((s) => !seen.has(s)).map((s) => `row ${s.r} cols ${s.c0}-${s.c1}`);
    assert.deepEqual(missing, []);
    // every door sits on a reachable surface
    rows.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (!"1234PBEgH".includes(ch)) return;
        const under = S.find((s) => s.r === r + 1 && s.c0 <= c && c <= s.c1);
        assert.ok(under && seen.has(under), `${hub} '${ch}' at row ${r} col ${c} is reachable`);
      });
    });
  });
}

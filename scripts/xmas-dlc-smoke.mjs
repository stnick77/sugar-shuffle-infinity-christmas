#!/usr/bin/env node
/**
 * Headless smoke test + screenshots for the 'Tis the Seasones DLC.
 *   npm run dev   (or any running dev server)
 *   node scripts/xmas-dlc-smoke.mjs http://127.0.0.1:8080 ./screens
 * Exits non-zero if a check fails. Uses only the DLC test hooks on window.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:8080";
const out = process.argv[3] ?? "screens";
mkdirSync(out, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const sleep = (ms) => page.waitForTimeout(ms);
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const save = () => page.evaluate(() => JSON.parse(localStorage.getItem("sugar-shuffle-infinity-v1") || "{}"));
const st = () => page.evaluate(() => window.__controlsTest?.dlc?.state());
const music = () => page.evaluate(() => window.__ssiMusic?.nowPlaying?.() ?? null);
const keys = (k) => page.evaluate((k) => window.__controlsTest?.setKeys?.(k), k);
const waitRoom = async (id) => {
  await page.waitForFunction((id) => window.__controlsTest?.dlc?.state().level === id, id, { timeout: 15000 });
  await sleep(700);
};
const pickHero = async (name) => {
  await sleep(2500); // let the title's async destroyGame() settle before booting
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).first().click();
  await page.waitForFunction(() => !!window.__controlsTest?.dlc, null, { timeout: 60000 });
  await sleep(1200);
};
const press = async (k, ms = 160) => {
  await keys([k]);
  await sleep(ms);
  await keys([]);
  await sleep(120);
};
const toTitle = async () => {
  await page.goto(base);
  await page.waitForSelector("[data-testid=dlc-button]");
  await sleep(1800); // hydration
};

/* 1. DLC off: base title */
await page.goto(base);
await page.evaluate(() => localStorage.clear());
await toTitle();
check("DLC off by default", (await save()).dlc?.xmas?.enabled !== true);
check("no DLC title/options while off", (await page.locator("[data-testid=dlc-title]").count()) === 0 && (await page.getByRole("button", { name: "Options" }).count()) === 0);
await shot("01-title-dlc-off");

/* 2. toggle + persistence */
await page.click("[data-testid=dlc-button]");
await sleep(500);
check("DLC button enables", (await save()).dlc.xmas.enabled === true);
await shot("02-title-dlc-on");
check("Ready Up plays on the main menu", (await music()) === "ready-up", String(await music()));
await toTitle();
check("DLC state persists across reload", (await save()).dlc.xmas.enabled === true && (await page.locator("[data-testid=dlc-title]").count()) === 1);
await page.click("[data-testid=dlc-button]");
await sleep(300);
check("pressing DLC again disables", (await save()).dlc.xmas.enabled === false);
await page.click("[data-testid=dlc-button]");
await sleep(300);

/* 3. options */
await page.getByRole("button", { name: "Options" }).click();
await sleep(400);
await shot("03-options");
check("options menu shows licensed slots disabled", (await page.getByRole("button", { name: /Jingle Bell Rock/ }).isDisabled()));
await page.getByRole("button", { name: /^Back$/ }).last().click();
await sleep(300);

/* 4. house */
await page.getByRole("button", { name: "Cuboe and Cubro's Home" }).click();
await pickHero("Cuboe");
await waitRoom("home-living");
check("house reachable from main menu", true);
await sleep(600);
check("Peaceful Home plays in the house", (await music()) === "peaceful-home", String(await music()));
await shot("04-house-living-room");
// walk through a real doorway: stand at the Hallway door and press Up
let s = await st();
const hallDoor = s.things.find((t) => t.kind === "home-door" && t.id === "home-hall");
await page.evaluate(({ x, y }) => window.__controlsTest.dlc.teleport(x, y), hallDoor);
await sleep(300);
await press("ArrowUp");
await waitRoom("home-hall");
check("Living Room → Hallway doorway", (await st()).level === "home-hall");
await shot("05-house-hallway");
for (const [id, n] of [
  ["home-cuboe", "06-house-cuboes-room"],
  ["home-cubro", "07-house-cubros-room"],
  ["home-up", "08-house-upstairs"],
]) {
  s = await st();
  const d = s.things.find((t) => t.kind === "home-door" && t.id === id);
  await page.evaluate(({ x, y }) => window.__controlsTest.dlc.teleport(x, y - 10), d);
  await sleep(300);
  await press("ArrowUp");
  await waitRoom(id);
  check(`Hallway → ${id}`, true);
  if (id === "home-cubro") {
    const sw = (await st()).things.find((t) => t.kind === "home-switch");
    await page.evaluate(({ x, y }) => window.__controlsTest.dlc.teleport(x, y), sw);
    await sleep(300);
    await shot(n);
    await press("ArrowUp");
    await sleep(400);
    await shot("07b-house-cubros-room-lights-off");
    await press("ArrowUp");
  } else if (id === "home-up") {
    await page.evaluate(() => window.__controlsTest.dlc.teleport(1200, 380));
    await sleep(900);
    await shot(n);
  } else {
    await page.evaluate(() => window.__controlsTest.dlc.teleport(700, 560));
    await sleep(600);
    await shot(n);
  }
  // back to the hallway through this room's Hallway door
  const back = (await st()).things.find((t) => t.kind === "home-door" && t.id === "home-hall");
  await page.evaluate(({ x, y }) => window.__controlsTest.dlc.teleport(x, y - 10), back);
  await sleep(300);
  await press("ArrowUp");
  await waitRoom("home-hall");
}
check("rooms all lead back to the Hallway", (await st()).level === "home-hall");
// Main Menu door
await page.evaluate(() => window.__controlsTest.dlc.goRoom("home-living", "home-hall"));
await waitRoom("home-living");
const menuDoor = (await st()).things.find((t) => t.kind === "home-menu");
await page.evaluate(({ x, y }) => window.__controlsTest.dlc.teleport(x, y), menuDoor);
await sleep(300);
await press("ArrowUp");
await page.waitForSelector("[data-testid=dlc-button]", { timeout: 10000 });
check("Main Menu door returns to the title", true);

/* 5. cosmetics at the pumpkin station */
await page.getByRole("button", { name: /Play/ }).first().click();
await pickHero("Cuboe");
s = await st();
check("Hub Theme plays in the hub", (await music()) === "hub-theme", String(await music()));
await page.evaluate(() => window.__controlsTest.dlc.teleport(26 * 48 + 24, 9 * 48 + 24 + 3 * 48));
await sleep(500);
const pc = (await st()).things.find((t) => t.kind === "pc");
await page.evaluate(({ x, y }) => window.__controlsTest.dlc.teleport(x, y - 8), pc);
await sleep(400);
await press("ArrowUp");
await page.waitForSelector("[data-testid=xmas-closet]", { timeout: 8000 });
const closet = page.locator("[data-testid=xmas-closet] li");
const equip = async (name) => closet.filter({ hasText: name }).first().getByRole("button").click();
await equip("Santa Hat");
await equip("Present Aura");
await equip("Christmas Sweater");
await equip("Christmas Skateboard");
await equip("Snowflake Aura");
await sleep(300);
await page.locator("[data-testid=xmas-closet]").scrollIntoViewIfNeeded();
await shot("09-pumpkin-station-closet");
const eq = (await save()).dlc.xmas.equipped;
check("cosmetics equip at the pumpkin station", eq.cuboe.length === 2 && eq.cubro.length === 3, JSON.stringify(eq));
check("scarf locked outside December", await closet.filter({ hasText: "Candy Cane Scarf" }).first().getByRole("button").isDisabled());
await page.getByRole("button", { name: "Back to hub" }).click();
await sleep(900);
check("Cuboe wears cosmetics in game", (await st()).cosmetics === 1);
await page.evaluate(() => window.__controlsTest.dlc.teleport(700, 600));
await page.evaluate(() => window.__controlsTest.dlc.zoom(2.4));
await sleep(1500);
await shot("10-cuboe-santa-hat-present-aura");
await page.evaluate(() => window.__controlsTest.dlc.zoom(1));

/* 6. collectables */
await page.evaluate(() => window.__controlsTest.dlc.goRoom("f1-1"));
await waitRoom("f1-1");
check("Level Theme plays in levels", (await music()) === "level-theme", String(await music()));
s = await st();
check("Christmas collectables placed in levels", s.xmasPickups >= 2, JSON.stringify(s.xmasList));
{
  const first = s.xmasList[0];
  await page.evaluate(({ x, y }) => window.__controlsTest.dlc.teleport(x - 110, y - 20), first);
  await page.evaluate(() => window.__controlsTest.dlc.zoom(1.8));
  await sleep(1400);
  await shot("11-level-collectables");
  const tree = s.xmasList.find((p) => p.kind === "tree");
  if (tree) {
    await page.evaluate(({ x, y }) => window.__controlsTest.dlc.teleport(x - 110, y - 20), tree);
    await sleep(1400);
    await shot("11b-level-christmas-tree-collectable");
  }
  await page.evaluate(() => window.__controlsTest.dlc.zoom(1));
  await page.evaluate(() => window.__controlsTest.dlc.teleport(96, 300));
  await sleep(500);
}
const before = await save();
for (const kind of ["present", "ornament", "tree"]) {
  const it = (await st()).xmasList.find((p) => p.kind === kind);
  if (!it) continue;
  await page.evaluate(({ x, y }) => window.__controlsTest.dlc.teleport(x, y), it);
  await sleep(250);
}
const after = await save();
const got = after.dlc.xmas.collected;
check(
  "collectables score 30/45/65",
  after.dlc.xmas.points - before.dlc.xmas.points === 30 * got.present + 45 * got.ornament + 65 * got.tree && got.present >= 1,
  JSON.stringify(got) + " points " + after.dlc.xmas.points,
);
check("level score increased", (await st()).score > 0, String((await st()).score));

/* boss music */
await page.evaluate(() => window.__controlsTest.dlc.goRoom("f1-boss"));
await waitRoom("f1-boss");
check("Boss Theme plays in boss fights", (await music()) === "boss-theme", String(await music()));

/* 7. Cubro with cosmetics */
await toTitle();
await page.getByRole("button", { name: /Play/ }).first().click();
await pickHero("Cubro");
await page.evaluate(() => window.__controlsTest.dlc.teleport(700, 600));
await page.evaluate(() => window.__controlsTest.dlc.zoom(2.4));
await sleep(1500);
check("Cubro wears cosmetics in game", (await st()).cosmetics === 1);
await shot("12-cubro-sweater-skateboard-snowflake-aura");

/* 8. December gift with date override */
await page.goto(base + "/?dlcDate=2026-12-05");
await page.waitForSelector("[data-testid=dlc-button]");
await sleep(2000);
check("December grants the free cosmetic", (await save()).dlc.xmas.owned.includes("candy-cane-scarf"));
await shot("13-december-gift-toast");
await page.getByRole("button", { name: "Options" }).click();
await sleep(300);
check("options shows December gift unlocked", /Unlocked/.test(await page.locator("[data-testid=december-status]").innerText()));
/* co-op on */
await page.getByRole("button", { name: "2P" }).click();
await page.getByRole("button", { name: /^Back$/ }).last().click();
await sleep(300);
await page.getByRole("button", { name: /Play/ }).first().click();
await pickHero("Cuboe");
s = await st();
check("co-op spawns player 2 (Cubro)", s.partner?.hero === "cubro", JSON.stringify(s.partner));
const p2x = s.partner.x;
const p1x = s.x;
await keys(["ArrowRight"]);
await sleep(1400);
await keys([]);
s = await st();
check("P2 moves with the arrows, P1 stays", s.partner.x - p2x > 40 && Math.abs(s.x - p1x) < 30, `p1 ${p1x}->${s.x} p2 ${p2x}->${s.partner.x}`);
await shot("14-coop-two-players");

/* 9. base game with DLC off */
await toTitle();
await page.click("[data-testid=dlc-button]");
await sleep(300);
check("DLC off again", (await save()).dlc.xmas.enabled === false);
await page.getByRole("button", { name: /Play/ }).first().click();
await pickHero("Cuboe");
await page.evaluate(() => window.__controlsTest.dlc.goRoom("f1-1"));
await waitRoom("f1-1");
s = await st();
check("DLC off: no Christmas pickups, cosmetics, partner, or Christmas music", s.xmasPickups === 0 && s.cosmetics === 0 && !s.partner && (await music()) === null, JSON.stringify({ x: s.xmasPickups, c: s.cosmetics, m: await music() }));
await shot("15-base-game-dlc-off");

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JUMPSCARE, SCREECH_LIMIT_DB, SCREECH_MAX_GAIN, flickerHz, jumpscareTimeline, screechGain } from "./jumpscare.ts";

const png = (rel: string) => {
  const b = readFileSync(new URL(`../../../public${rel}`, import.meta.url));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};
const rgb = (n: number) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));

describe("Intense Bacteria jumpscare", () => {
  it("runs silence -> lunge -> impact -> glitch-out -> fade in order, and stays short", () => {
    const t = jumpscareTimeline();
    assert.ok(t.silence < t.lunge && t.lunge < t.impact && t.impact < t.glitch && t.glitch < t.fade && t.fade < t.end);
    assert.ok(JUMPSCARE.silenceMs >= 250, "a real silence beat before the lunge");
    assert.ok(JUMPSCARE.lungeMs <= 250, "the lunge is fast");
    assert.ok(t.end <= 2500, "over in under 2.5 s");
  });
  it("flickers red/black at or under 3 Hz and never strobes white", () => {
    assert.ok(flickerHz() <= 3, `flicker ${flickerHz()} Hz`);
    for (const c of JUMPSCARE.flickerColors) {
      const [r, g, b] = rgb(c);
      assert.ok(g < 40 && b < 40, "red or black only");
      assert.ok(r + g + b < 300, "nothing close to white");
    }
  });
  it("uses green-black slime, never blood-red", () => {
    for (const c of JUMPSCARE.gooColors) {
      const [r, g] = hex(c);
      assert.ok(g > r, `${c} is green, not red`);
    }
  });
  it("caps the screech volume", () => {
    assert.ok(SCREECH_MAX_GAIN <= 0.35);
    assert.ok(SCREECH_LIMIT_DB <= -10, "limiter threshold");
    for (const v of [0, 0.5, 1, 2, -1]) assert.ok(screechGain(v) <= SCREECH_MAX_GAIN && screechGain(v) >= 0);
  });
  it("has its own code-drawn art (face close-up, slime splats, 3-stage cracked glass)", () => {
    assert.deepEqual(Object.values(png("/game/sprites/jumpscare-face.png")), [768, 768]);
    assert.deepEqual(Object.values(png("/game/sprites/goo-splats.png")), [512, 512]);
    assert.deepEqual(Object.values(png("/game/sprites/glass-crack.png")), [640 * JUMPSCARE.crackStages, 360]);
  });
});

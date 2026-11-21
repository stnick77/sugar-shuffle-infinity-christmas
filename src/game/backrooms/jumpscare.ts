/**
 * The intense Bacteria jumpscare (escape chase), as plain numbers so tests can
 * check it stays kid-safe: flicker at or under 3 Hz, red/black only (never a
 * white strobe), slime is green-black (no blood), and the screech is capped.
 * The "Jumpscares" setting turns all of it off (a short red tint + CAUGHT! only).
 *
 * Timeline (ms from the catch):
 *   0      silence beat: everything freezes and the music cuts out
 *   380    the Smiler face lunges from small to full screen
 *   550    impact: heavy shake, screech, glass cracks spread, goo splats
 *   550+   red/black flicker (each colour held 180 ms = 2.8 Hz)
 *   1450   brief glitch-out (RGB split + slices) of the whole scare
 *   1750   fade to black, then the life is lost / game over
 */
export const JUMPSCARE = {
  silenceMs: 380,
  lungeMs: 170,
  holdMs: 900,
  glitchOutMs: 300,
  fadeMs: 200,
  flickerStepMs: 180,
  flickerColors: [0x9a0c12, 0x000000] as const,
  flickerAlpha: [0.32, 0.55] as const,
  shake: 0.034,
  splats: 7,
  crackStages: 3,
  crackStepMs: 90,
  gooColors: ["#12220f", "#3c7828", "#78c846"] as const,
} as const;

export function jumpscareTimeline(j = JUMPSCARE) {
  const lunge = j.silenceMs;
  const impact = lunge + j.lungeMs;
  const glitch = impact + j.holdMs;
  const fade = glitch + j.glitchOutMs;
  return { silence: 0, lunge, impact, glitch, fade, end: fade + j.fadeMs };
}

/** Full red/black cycles per second (two colour steps per cycle). */
export function flickerHz(j = JUMPSCARE) {
  return 1000 / (2 * j.flickerStepMs);
}

/**
 * Screech loudness: a brick-wall limiter in front of this fixed gain, which is
 * then scaled by the player's SFX volume. Never above SCREECH_MAX_GAIN.
 */
export const SCREECH_MAX_GAIN = 0.32;
export const SCREECH_LIMIT_DB = -12;
export function screechGain(sfxVolume: number) {
  const v = Math.min(1, Math.max(0, sfxVolume));
  return Math.min(SCREECH_MAX_GAIN, SCREECH_MAX_GAIN * (0.5 + 0.5 * v));
}

/**
 * Offline renderer for the per-level songs (src/game/music/levelSongs.ts).
 *
 * Renders each song's events with the same voices and envelopes the game uses
 * (levelMusic.ts / the DLC carol synth), measures loudness, writes
 * src/game/music/levelSongGains.ts so every level song plays at the same
 * level as the existing DLC themes, and writes preview audio files.
 *
 *   node --experimental-strip-types scripts/music/render-level-songs.ts [outDir]
 *   (outDir default: ./level-songs-out, files <level>-<song>.ogg / .mp3)
 */
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LEVEL_SONGS, composeSong, voicePeak, type LevelSong, type SongEvent, type Wave } from "../../src/game/music/levelSongs.ts";
import { ORIGINAL_THEMES, bassLine, parseMelody, songBeats, type Carol } from "../../src/game/dlc/carols.ts";

const SR = 44100;
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = process.argv[2] ?? join(root, "level-songs-out");

// ---------------------------------------------------------------- synth
let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1;

function polyblep(t: number, dt: number) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
function osc(wave: Wave, phase: number, dt: number) {
  switch (wave) {
    case "sine": return Math.sin(2 * Math.PI * phase);
    case "triangle": return 1 - 4 * Math.abs(Math.round(phase - 0.25) - (phase - 0.25));
    case "sawtooth": return 2 * phase - 1 - polyblep(phase, dt);
    case "square": {
      let v = phase < 0.5 ? 1 : -1;
      v += polyblep(phase, dt);
      v -= polyblep((phase + 0.5) % 1, dt);
      return v;
    }
  }
}
/** Web Audio style exponential envelope: 0.0001 -> peak (12 ms) -> 0.4 peak (half) -> 0.0001 (end). */
function env(t: number, dur: number, peak: number) {
  const a = 0.012, m = Math.max(0.03, dur * 0.5);
  const ex = (v0: number, v1: number, x: number) => v0 * Math.pow(v1 / v0, Math.min(1, Math.max(0, x)));
  if (t < a) return ex(0.0001, peak, t / a);
  if (t < m) return ex(peak, Math.max(0.0002, peak * 0.4), (t - a) / (m - a));
  if (t < dur) return ex(Math.max(0.0002, peak * 0.4), 0.0001, (t - m) / (dur - m));
  return 0;
}
function biquad(type: "highpass" | "bandpass", f0: number) {
  const w = (2 * Math.PI * f0) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * 1);
  let b0, b1, b2;
  if (type === "highpass") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
  else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x: number) => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

interface Ev { t: number; dur: number; hz: number; kind: "tone" | "kick" | "tom" | "snare" | "hat"; wave: Wave; peak: number; vib?: number }

function renderEvents(evs: Ev[], len: number, gain: number): Float32Array {
  const n = Math.ceil(len * SR);
  const buf = new Float32Array(n);
  for (const e of evs) {
    const start = Math.floor(e.t * SR);
    const tail = e.kind === "kick" || e.kind === "tom" ? Math.max(0.08, e.dur) + 0.08 : e.dur;
    const count = Math.ceil(tail * SR);
    let phase = 0;
    const filt = e.kind === "hat" ? biquad("highpass", 7000) : e.kind === "snare" ? biquad("bandpass", 1800) : null;
    for (let k = 0; k < count; k++) {
      const t = k / SR;
      let v = 0;
      if (e.kind === "tone") {
        let f = e.hz;
        if (e.vib) f *= Math.pow(2, (e.vib * Math.sin(2 * Math.PI * 5.5 * t)) / 1200);
        const dt = f / SR;
        phase = (phase + dt) % 1;
        v = osc(e.wave, phase, dt) * env(t, e.dur, e.peak);
      } else if (e.kind === "kick" || e.kind === "tom") {
        const span = Math.max(0.08, e.dur);
        const [f0, f1] = e.kind === "kick" ? [150, 42] : [220, 110];
        const f = f0 * Math.pow(f1 / f0, Math.min(1, t / span));
        phase = (phase + f / SR) % 1;
        v = Math.sin(2 * Math.PI * phase) * e.peak * Math.pow(0.0001 / e.peak, t / tail);
      } else {
        v = filt!(rand()) * e.peak * Math.pow(0.0001 / e.peak, t / e.dur);
      }
      buf[(start + k) % n] += v * gain; // wrap the tail into the loop start (seamless loop)
    }
  }
  return buf;
}

function levelEvents(song: LevelSong): { evs: Ev[]; len: number } {
  const { events, length } = composeSong(song);
  const evs = events.map((e: SongEvent): Ev => {
    if (e.voice === "kick") return { t: e.t, dur: e.dur, hz: 150, kind: "kick", wave: "sine", peak: 0.12 };
    if (e.voice === "tom") return { t: e.t, dur: e.dur, hz: 220, kind: "tom", wave: "sine", peak: 0.06 };
    if (e.voice === "snare") return { t: e.t, dur: e.dur, hz: 0, kind: "snare", wave: "sine", peak: 0.05 };
    if (e.voice === "hat") return { t: e.t, dur: e.dur, hz: 0, kind: "hat", wave: "sine", peak: 0.025 };
    const wave: Wave = e.voice === "lead" || e.voice === "harm" ? song.lead : e.voice === "bass" ? song.bassWave ?? "triangle" : e.voice === "arp" ? song.arp ?? "square" : e.voice === "stab" ? "triangle" : "square";
    return { t: e.t, dur: e.dur, hz: e.hz, kind: "tone", wave, peak: voicePeak(e.voice, wave), vib: e.voice === "lead" && e.dur > 0.2 ? song.vibrato : undefined };
  });
  return { evs, len: length };
}

/** The DLC theme synth (xmasMusic.ts buildEvents/voice), for the loudness reference. */
function carolEvents(c: Carol): { evs: Ev[]; len: number } {
  const spb = 60 / c.bpm;
  const evs: Ev[] = [];
  const lead = (c.lead ?? "square") as Wave;
  const leadPeak = lead === "sawtooth" ? 0.03 : 0.05;
  for (const n of parseMelody(c.melody)) {
    if (n.hz == null) continue;
    evs.push({ t: n.at * spb, hz: n.hz, dur: n.beats * spb * 0.92, kind: "tone", wave: lead, peak: leadPeak });
    evs.push({ t: n.at * spb, hz: n.hz * 2, dur: Math.min(0.5, n.beats * spb), kind: "tone", wave: "sine", peak: 0.012 });
  }
  for (const n of bassLine(c)) evs.push({ t: n.at * spb, hz: n.hz!, dur: n.beats * spb * 0.8, kind: "tone", wave: "triangle", peak: 0.055 });
  const beats = songBeats(c);
  if (c.bells) for (let b = 0; b < beats; b += 0.5) evs.push({ t: b * spb, hz: b % 1 === 0 ? 5200 : 6400, dur: 0.05, kind: "tone", wave: "square", peak: 0.008 });
  if (c.drums) {
    for (let b = 0; b < beats; b += 1) {
      const inBar = (b - c.pickup + c.beatsPerBar * 8) % c.beatsPerBar;
      if (c.drums === "techno" || inBar === 0 || inBar === 2) evs.push({ t: b * spb, hz: 150, dur: 0.18, kind: "kick", wave: "sine", peak: 0.12 });
      if (c.drums === "techno") evs.push({ t: (b + 0.5) * spb, hz: 0, dur: 0.05, kind: "hat", wave: "sine", peak: 0.025 });
      if (inBar === 1 || inBar === 3) evs.push({ t: b * spb, hz: 0, dur: c.drums === "techno" ? 0.12 : 0.09, kind: "snare", wave: "sine", peak: 0.05 });
    }
  }
  return { evs, len: beats * spb };
}

const rms = (b: Float32Array) => Math.sqrt(b.reduce((s, v) => s + v * v, 0) / b.length);

// ---------------------------------------------------------------- main
const refs = ORIGINAL_THEMES.map((c) => rms(renderEvents(carolEvents(c).evs, carolEvents(c).len, 1)));
const target = refs.reduce((a, b) => a + b, 0) / refs.length;
console.log(`DLC theme loudness (RMS): ${refs.map((r) => r.toFixed(4)).join(" ")} -> target ${target.toFixed(4)}`);

const gains: Record<string, number> = {};
for (const s of LEVEL_SONGS) {
  const { evs, len } = levelEvents(s);
  const r = rms(renderEvents(evs, len, 1));
  gains[s.id] = Math.round(Math.min(2.5, Math.max(0.4, target / r)) * 1000) / 1000;
}
const gainsFile = join(root, "src/game/music/levelSongGains.ts");
writeFileSync(
  gainsFile,
  `// Generated by scripts/music/render-level-songs.ts: per-song gain so each level song\n// matches the loudness (RMS) of the DLC's original themes. Do not edit by hand.\nexport const LEVEL_SONG_GAINS: Record<string, number> = ${JSON.stringify(gains, null, 2).replace(/"([^"]+)":/g, '"$1":')};\n`,
);

mkdirSync(outDir, { recursive: true });
const LOOPS = 2;
const rendered = LEVEL_SONGS.map((s) => ({ s, len: levelEvents(s).len, one: renderEvents(levelEvents(s).evs, levelEvents(s).len, gains[s.id]!) }));
// One shared preview lift for every file (keeps them loudness-matched) with no clipping.
const peak = Math.max(...rendered.map((r) => r.one.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
const lift = Math.min(6, 0.89 / peak);
console.log(`preview lift x${lift.toFixed(2)} (peak ${peak.toFixed(3)})`);
for (const { s, len, one } of rendered) {
  const n = one.length * LOOPS;
  const pcm = Buffer.alloc(44 + n * 2);
  pcm.write("RIFF", 0); pcm.writeUInt32LE(36 + n * 2, 4); pcm.write("WAVEfmt ", 8);
  pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(SR, 24);
  pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write("data", 36); pcm.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(one[i % one.length]! * lift * 32767))), 44 + i * 2);
  const base = join(outDir, `${s.level}-${s.id}`);
  writeFileSync(`${base}.wav`, pcm);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", `${base}.wav`, "-c:a", "libvorbis", "-q:a", "5", `${base}.ogg`]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", `${base}.wav`, "-c:a", "libmp3lame", "-q:a", "4", `${base}.mp3`]);
  rmSync(`${base}.wav`);
  console.log(`${s.level.padEnd(15)} ${s.title.padEnd(20)} ${s.key}${s.mode === "major" ? "" : " " + s.mode} ${s.bpm}bpm ${s.beatsPerBar}/4 loop ${len.toFixed(1)}s gain ${gains[s.id]}`);
}

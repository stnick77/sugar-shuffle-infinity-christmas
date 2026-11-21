import { levelSongPlaying, startLevelSong, stopLevelSong } from "./music/levelMusic.ts";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let musicTimer: number | null = null;
/** Per-level song id (src/game/music/levelSongs.ts); null = the shared hub/menu loop. */
let levelSong: string | null = null;
let musicRunning = false;
/** True while the DLC music hook owns the music (level songs then wait in the wings). */
let hookPlaying = false;

/** Create/resume the audio context. Pass the saved volumes so a muted save stays muted. */
export function unlockAudio(prefs?: { sfx: number; music: number }) {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.connect(master);
    musicBus.connect(master);
    master.connect(ctx.destination);
    sfxBus.gain.value = prefs ? prefs.sfx * prefs.sfx : 0.8;
    musicBus.gain.value = prefs ? prefs.music * prefs.music : 0.35;
    master.gain.value = 0.9;
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export function setSfxVolume(v: number) {
  if (sfxBus) sfxBus.gain.setTargetAtTime(v * v, ctx!.currentTime, 0.02);
}
export function setMusicVolume(v: number) {
  if (musicBus) musicBus.gain.setTargetAtTime(v * v, ctx!.currentTime, 0.05);
}

function beep(freq: number, dur: number, type: OscillatorType, gain = 0.12, slide = 0) {
  if (!ctx || !sfxBus) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + dur);
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g);
  g.connect(sfxBus);
  o.start();
  o.stop(ctx.currentTime + dur + 0.02);
}

/** The intense jumpscare's silence beat: cut the music for `ms`, then bring it back. */
export function silenceMusic(ms: number) {
  if (!ctx || !musicBus) return;
  const was = musicBus.gain.value;
  const t = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setValueAtTime(was, t);
  musicBus.gain.linearRampToValueAtTime(0, t + 0.03);
  musicBus.gain.setValueAtTime(0, t + ms / 1000);
  musicBus.gain.linearRampToValueAtTime(was, t + ms / 1000 + 0.4);
}

/**
 * A loud, distorted screech for the intense jumpscare, made procedurally:
 * detuned saws + a noise burst through a waveshaper, a sweeping band-pass,
 * then a brick-wall limiter and a fixed gain cap (never ear-damaging).
 */
export function screechIntense(gainCap: number, limitDb: number, dur = 1.0) {
  if (!ctx || !sfxBus) return;
  const t = ctx.currentTime;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 6);
  }
  shaper.curve = curve;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 2.5;
  band.frequency.setValueAtTime(700, t);
  band.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.35);
  band.frequency.exponentialRampToValueAtTime(900, t + dur);
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = limitDb;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(gainCap, t + 0.02);
  out.gain.setValueAtTime(gainCap, t + dur * 0.7);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  shaper.connect(band);
  band.connect(limiter);
  limiter.connect(out);
  out.connect(sfxBus);
  const pre = ctx.createGain();
  pre.gain.value = 0.6;
  pre.connect(shaper);
  for (const [f, slide] of [[620, 1400], [655, 1300], [930, -300], [140, -40]] as const) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + dur * 0.4);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, f * 0.7), t + dur);
    o.connect(pre);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.connect(pre);
  noise.start(t);
}

export const sfx = {
  jump: () => beep(420, 0.12, "square", 0.08, 180),
  land: () => beep(140, 0.08, "triangle", 0.1, -40),
  attack: () => beep(220, 0.09, "sawtooth", 0.09, 320),
  hit: () => {
    beep(180, 0.14, "square", 0.12, -80);
    beep(90, 0.18, "triangle", 0.1, -30);
  },
  pickup: () => beep(660, 0.1, "square", 0.07, 400),
  combo: () => beep(880, 0.08, "square", 0.06, 200),
  hurt: () => beep(110, 0.22, "sawtooth", 0.14, -70),
  door: () => beep(300, 0.16, "triangle", 0.08, 80),
  pizza: () => {
    beep(520, 0.12, "square", 0.1, 0);
    setTimeout(() => beep(780, 0.16, "square", 0.1, 0), 90);
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.18, "square", 0.08), i * 90));
  },
  lose: () => beep(200, 0.4, "sawtooth", 0.12, -140),
  ui: () => beep(480, 0.06, "square", 0.05),
  boom: () => beep(70, 0.28, "triangle", 0.16, -20),
  hadoken: () => {
    beep(160, 0.22, "sawtooth", 0.12, 420);
    beep(70, 0.28, "square", 0.08, 180);
  },
  shoryuken: () => {
    beep(240, 0.16, "square", 0.12, 520);
    beep(90, 0.2, "triangle", 0.1, 80);
  },
  tatsu: () => beep(140, 0.26, "triangle", 0.11, 90),
  // boss moves
  bossWarn: () => beep(520, 0.18, "triangle", 0.07, 260),
  bossFire: () => beep(300, 0.12, "square", 0.08, -160),
  bossSlam: () => {
    beep(60, 0.3, "triangle", 0.16, -20);
    beep(120, 0.12, "square", 0.06, -60);
  },
  bossWhoosh: () => beep(200, 0.16, "sawtooth", 0.05, 380),
  bossZap: () => beep(900, 0.22, "sawtooth", 0.06, -600),
  bossRoar: () => {
    beep(90, 0.45, "sawtooth", 0.12, 60);
    beep(140, 0.4, "square", 0.06, -50);
  },
  // Floor 470539758: fluorescent-light buzz (and the noclip glitch)
  buzz: () => {
    beep(120, 0.22, "sawtooth", 0.035, 4);
    beep(240, 0.18, "square", 0.012, -6);
  },
  // the TrAppEd fOrEvEr ending: a low, uneasy fluorescent drone
  hum: () => {
    beep(60, 2.4, "sawtooth", 0.035, 2);
    beep(120.6, 2.4, "triangle", 0.03, -1);
    beep(181, 1.6, "sine", 0.015, 3);
  },
  // the hero glitching on Floor 470539758: a tiny digital blip
  glitch: () => {
    beep(1800 + Math.random() * 900, 0.05, "square", 0.025, -1200);
    setTimeout(() => beep(300 + Math.random() * 200, 0.04, "square", 0.02, 400), 45);
  },
  // escape-chase jumpscare: a short screech (volume-capped well under the boss roar peak)
  screech: () => {
    beep(900, 0.7, "sawtooth", 0.07, 900);
    beep(1340, 0.6, "square", 0.035, -500);
    beep(180, 0.8, "sawtooth", 0.06, -60);
    setTimeout(() => beep(1600, 0.35, "sawtooth", 0.04, -900), 160);
  },
  // glass cracking (short bright noise ticks)
  crack: () => {
    [0, 40, 95].forEach((d, i) => setTimeout(() => beep(2400 - i * 500, 0.05, "square", 0.03, -1500), d));
  },
  // wet slime splat
  splat: () => {
    beep(160, 0.16, "sine", 0.06, -110);
    setTimeout(() => beep(90, 0.12, "triangle", 0.04, -40), 30);
  },
  noclip: () => {
    [0, 70, 140, 230, 330].forEach((d, i) => setTimeout(() => beep(120 + i * 37, 0.12, "sawtooth", 0.05, -40), d));
  },
};

/**
 * Optional music hook (used by the 'Tis the Seasones DLC). When it returns
 * true it has started its own music and the base loop is skipped. Unset or
 * returning false = base game music, exactly as before.
 */
type MusicHook = { start: (ctx: AudioContext, bus: GainNode) => boolean; stop: () => void };
let musicHook: MusicHook | null = null;

export function setMusicHook(hook: MusicHook | null) {
  musicHook = hook;
}

/** Pick the level's own song (or null for the shared loop); restarts music if it is playing. */
export function setLevelSong(id: string | null) {
  if (id === levelSong) return;
  levelSong = id;
  if (musicRunning && !hookPlaying) startMusic();
}

export function currentLevelSong() {
  return levelSong;
}

export function startMusic() {
  if (!ctx || !musicBus) return;
  stopMusic();
  musicRunning = true;
  hookPlaying = !!musicHook?.start(ctx, musicBus);
  if (hookPlaying) return;
  if (levelSong && startLevelSong(ctx, musicBus, levelSong)) return;
  const notes = [196, 247, 294, 330, 392, 330, 294, 247];
  let i = 0;
  const tick = () => {
    if (!ctx || !musicBus) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = notes[i % notes.length]!;
    g.gain.setValueAtTime(0.04, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    o.connect(g);
    g.connect(musicBus);
    o.start();
    o.stop(ctx.currentTime + 0.3);
    i++;
    musicTimer = window.setTimeout(tick, 320);
  };
  tick();
}

export function stopMusic() {
  musicRunning = false;
  musicHook?.stop();
  stopLevelSong();
  if (musicTimer != null) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
}

if (typeof window !== "undefined") {
  (window as unknown as { __ssiAudio?: unknown }).__ssiAudio = { levelSong: () => levelSongPlaying(), wanted: () => levelSong };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void ctx?.resume();
  });
}

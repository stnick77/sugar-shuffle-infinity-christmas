/**
 * Christmas music player for the 'Tis the Seasones DLC.
 * Plugs into audio.ts through setMusicHook, so base music is untouched when
 * the DLC (or its Christmas music option) is off.
 */
import { setMusicHook, startMusic, stopMusic } from "../audio";
import {
  AREA_THEMES,
  LICENSED_SLOTS,
  bassLine,
  parseMelody,
  songBeats,
  songById,
  themeForArea,
  type Carol,
  type MusicArea,
} from "./carols";
import { xmas } from "./state";

let area: MusicArea = "menu";
let timer: number | null = null;
let licensedEl: HTMLAudioElement | null = null;
let licensedSrc: MediaElementAudioSourceNode | null = null;
let manifest: Record<string, string> | null = null;
let manifestLoading: Promise<void> | null = null;
let playing: string | null = null;

/** Loads public/game/music/xmas/licensed.json (drop-in licensed songs). */
export function loadLicensedManifest(): Promise<void> {
  if (manifest) return Promise.resolve();
  if (!manifestLoading) {
    manifestLoading = fetch("/game/music/xmas/licensed.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((j: Record<string, string>) => {
        manifest = {};
        for (const s of LICENSED_SLOTS) if (typeof j[s.id] === "string" && j[s.id]) manifest[s.id] = j[s.id]!;
      })
      .catch(() => {
        manifest = {};
      });
  }
  return manifestLoading;
}

export function licensedFile(id: string): string | null {
  return manifest?.[id] ?? null;
}

export function nowPlaying() {
  return playing;
}

function wantsXmas() {
  const s = xmas();
  return s.enabled && s.music;
}

/** Song the player would pick right now. */
export function pickSong(): Carol | { id: string; title: string; file: string } {
  const s = xmas();
  if (s.track !== AREA_THEMES) {
    const song = songById(s.track);
    if (song?.kind === "licensed") {
      const file = licensedFile(song.id);
      if (file) return { id: song.id, title: song.title, file: `/game/music/xmas/${file}` };
    } else if (song) return song;
  }
  return themeForArea(area);
}

type Ev = { t: number; hz: number; dur: number; voice: "lead" | "bass" | "spark" | "bell" | "kick" | "hat" | "snare" };

function buildEvents(c: Carol): { evs: Ev[]; len: number } {
  const spb = 60 / c.bpm;
  const evs: Ev[] = [];
  for (const n of parseMelody(c.melody)) {
    if (n.hz == null) continue;
    evs.push({ t: n.at * spb, hz: n.hz, dur: n.beats * spb * 0.92, voice: "lead" });
    evs.push({ t: n.at * spb, hz: n.hz * 2, dur: Math.min(0.5, n.beats * spb), voice: "spark" });
  }
  for (const n of bassLine(c)) evs.push({ t: n.at * spb, hz: n.hz!, dur: n.beats * spb * 0.8, voice: "bass" });
  const beats = songBeats(c);
  if (c.bells) for (let b = 0; b < beats; b += 0.5) evs.push({ t: b * spb, hz: b % 1 === 0 ? 5200 : 6400, dur: 0.05, voice: "bell" });
  if (c.drums) {
    for (let b = 0; b < beats; b += 1) {
      const inBar = (b - c.pickup + c.beatsPerBar * 8) % c.beatsPerBar;
      if (c.drums === "techno" || inBar === 0 || inBar === 2) evs.push({ t: b * spb, hz: 150, dur: 0.18, voice: "kick" });
      if (c.drums === "techno") evs.push({ t: (b + 0.5) * spb, hz: 0, dur: 0.05, voice: "hat" });
      if (inBar === 1 || inBar === 3) evs.push({ t: b * spb, hz: 0, dur: c.drums === "techno" ? 0.12 : 0.09, voice: "snare" });
    }
  }
  evs.sort((a, b) => a.t - b.t);
  return { evs, len: beats * spb };
}

let noise: AudioBuffer | null = null;
function noiseBuf(ctx: AudioContext) {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise;
  noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

function drum(ctx: AudioContext, bus: GainNode, e: Ev, at: number) {
  const g = ctx.createGain();
  g.connect(bus);
  if (e.voice === "kick") {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(150, at);
    o.frequency.exponentialRampToValueAtTime(42, at + e.dur);
    g.gain.setValueAtTime(0.12, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + e.dur);
    o.connect(g);
    o.start(at);
    o.stop(at + e.dur + 0.02);
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf(ctx);
  const f = ctx.createBiquadFilter();
  f.type = e.voice === "hat" ? "highpass" : "bandpass";
  f.frequency.value = e.voice === "hat" ? 7000 : 1800;
  g.gain.setValueAtTime(e.voice === "hat" ? 0.025 : 0.05, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + e.dur);
  src.connect(f);
  f.connect(g);
  src.start(at);
  src.stop(at + e.dur + 0.02);
}

function voice(ctx: AudioContext, bus: GainNode, e: Ev, at: number, lead: OscillatorType) {
  if (e.voice === "kick" || e.voice === "hat" || e.voice === "snare") {
    drum(ctx, bus, e, at);
    return;
  }
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const peak = e.voice === "lead" ? (lead === "sawtooth" ? 0.03 : 0.05) : e.voice === "bass" ? 0.055 : e.voice === "spark" ? 0.012 : 0.008;
  o.type = e.voice === "lead" ? lead : e.voice === "bass" ? "triangle" : e.voice === "spark" ? "sine" : "square";
  o.frequency.setValueAtTime(e.hz, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * 0.4), at + Math.max(0.03, e.dur * 0.5));
  g.gain.exponentialRampToValueAtTime(0.0001, at + e.dur);
  o.connect(g);
  g.connect(bus);
  o.start(at);
  o.stop(at + e.dur + 0.03);
}

function playSynth(ctx: AudioContext, bus: GainNode, c: Carol) {
  const { evs, len } = buildEvents(c);
  let i = 0;
  let loopStart = ctx.currentTime + 0.08;
  const lead = c.lead ?? "square";
  const tick = () => {
    const horizon = ctx.currentTime + 0.3;
    let guard = 0;
    while (guard++ < 400) {
      const e = evs[i];
      if (!e) break;
      const at = loopStart + e.t;
      if (at > horizon) break;
      if (at >= ctx.currentTime - 0.02) voice(ctx, bus, e, at, lead);
      i++;
      if (i >= evs.length) {
        i = 0;
        loopStart += len;
      }
    }
    timer = window.setTimeout(tick, 60);
  };
  tick();
}

function playFile(ctx: AudioContext, bus: GainNode, file: string) {
  licensedEl = new Audio(file);
  licensedEl.loop = true;
  licensedEl.crossOrigin = "anonymous";
  try {
    licensedSrc = ctx.createMediaElementSource(licensedEl);
    licensedSrc.connect(bus);
  } catch {
    /* fall back to element volume */
  }
  void licensedEl.play().catch(() => undefined);
}

const hook = {
  start(ctx: AudioContext, bus: GainNode) {
    if (!wantsXmas()) {
      playing = null;
      return false;
    }
    const song = pickSong();
    playing = song.id;
    if ("file" in song) playFile(ctx, bus, song.file);
    else playSynth(ctx, bus, song);
    return true;
  },
  stop() {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
    if (licensedEl) {
      licensedEl.pause();
      licensedEl.src = "";
      licensedEl = null;
    }
    if (licensedSrc) {
      try {
        licensedSrc.disconnect();
      } catch {
        /* gone */
      }
      licensedSrc = null;
    }
    playing = null;
  },
};

export function installXmasMusic() {
  setMusicHook(hook);
  (window as unknown as { __ssiMusic?: unknown }).__ssiMusic = { nowPlaying: () => playing, area: () => area };
  void loadLicensedManifest();
}

/** Tell the player where we are; restarts music if the area theme changes. */
export function setMusicArea(next: MusicArea) {
  const changed = next !== area;
  area = next;
  if (!changed) return;
  if (wantsXmas() && xmas().track === AREA_THEMES && playing) restartMusic();
}

/** Re-pick music after a DLC/option change (only if music was already running). */
export function restartMusic() {
  stopMusic();
  startMusic();
}

export function currentArea() {
  return area;
}

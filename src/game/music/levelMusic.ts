/**
 * Live player for the per-level songs (levelSongs.ts). Same scheduling and
 * chiptune voices as the DLC's carol synth: Web Audio oscillators for the
 * tune, bass and arpeggio, filtered noise for snare and hats.
 */
import { composeSong, songById, songGain, voicePeak, type LevelSong, type SongEvent, type Wave } from "./levelSongs.ts";

let timer: number | null = null;
let current: string | null = null;
let noise: AudioBuffer | null = null;
const cache = new Map<string, ReturnType<typeof composeSong>>();

function noiseBuf(ctx: AudioContext) {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise;
  noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

function waveFor(song: LevelSong, e: SongEvent): Wave {
  if (e.voice === "lead" || e.voice === "harm") return song.lead;
  if (e.voice === "bass") return song.bassWave ?? "triangle";
  if (e.voice === "arp") return song.arp ?? "square";
  if (e.voice === "stab") return "triangle";
  return "square";
}

function play(ctx: AudioContext, bus: GainNode, song: LevelSong, e: SongEvent, at: number, gain: number) {
  const g = ctx.createGain();
  g.connect(bus);
  if (e.voice === "kick" || e.voice === "tom") {
    const o = ctx.createOscillator();
    o.type = "sine";
    const f0 = e.voice === "kick" ? 150 : 220;
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(e.voice === "kick" ? 42 : 110, at + Math.max(0.08, e.dur));
    const pk = (e.voice === "kick" ? 0.12 : 0.06) * gain;
    g.gain.setValueAtTime(pk, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.08, e.dur) + 0.08);
    o.connect(g);
    o.start(at);
    o.stop(at + e.dur + 0.2);
    return;
  }
  if (e.voice === "snare" || e.voice === "hat") {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf(ctx);
    const f = ctx.createBiquadFilter();
    f.type = e.voice === "hat" ? "highpass" : "bandpass";
    f.frequency.value = e.voice === "hat" ? 7000 : 1800;
    g.gain.setValueAtTime((e.voice === "hat" ? 0.025 : 0.05) * gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + e.dur);
    src.connect(f);
    f.connect(g);
    src.start(at);
    src.stop(at + e.dur + 0.02);
    return;
  }
  const wave = waveFor(song, e);
  const peak = voicePeak(e.voice, wave) * gain;
  const o = ctx.createOscillator();
  o.type = wave;
  o.frequency.setValueAtTime(e.hz, at);
  if (song.vibrato && e.voice === "lead" && e.dur > 0.2) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.value = song.vibrato;
    lfo.connect(depth);
    depth.connect(o.detune);
    lfo.start(at);
    lfo.stop(at + e.dur + 0.03);
  }
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * 0.4), at + Math.max(0.03, e.dur * 0.5));
  g.gain.exponentialRampToValueAtTime(0.0001, at + e.dur);
  o.connect(g);
  o.start(at);
  o.stop(at + e.dur + 0.03);
}

/** Start a level song on `bus`. Returns false if the id is unknown. */
export function startLevelSong(ctx: AudioContext, bus: GainNode, id: string): boolean {
  const song = songById(id);
  if (!song) return false;
  stopLevelSong();
  let built = cache.get(id);
  if (!built) {
    built = composeSong(song);
    cache.set(id, built);
  }
  const { events, length } = built;
  const gain = songGain(id);
  current = id;
  let i = 0;
  let loopStart = ctx.currentTime + 0.08;
  const tick = () => {
    const horizon = ctx.currentTime + 0.3;
    let guard = 0;
    while (guard++ < 600) {
      const e = events[i];
      if (!e) break;
      const at = loopStart + e.t;
      if (at > horizon) break;
      if (at >= ctx.currentTime - 0.02) play(ctx, bus, song, e, at, gain);
      i++;
      if (i >= events.length) {
        i = 0;
        loopStart += length;
      }
    }
    timer = window.setTimeout(tick, 60);
  };
  tick();
  return true;
}

export function stopLevelSong() {
  if (timer != null) clearTimeout(timer);
  timer = null;
  current = null;
}

export function levelSongPlaying() {
  return current;
}

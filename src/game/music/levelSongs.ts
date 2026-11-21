/**
 * One original track per level (Hayden, Nov 2026).
 *
 * Every song is composed procedurally from the spec below: a key + mode, a
 * chord progression, tempo, groove and instruments. composeSong() writes the
 * melody from seeded note patterns (chord tones on strong beats, stepwise
 * motion between, a repeated motif, a cadence home), then adds bass, arpeggio,
 * bells and drums. 16 bars, so every track loops seamlessly. Played live by
 * levelMusic.ts with the same chiptune voices as the Christmas DLC themes
 * (Web Audio oscillators + noise drums); scripts/music/render-level-songs.ts
 * renders the same events to audio files for previews and loudness matching.
 *
 * No samples, no third-party or AI music: everything here is written for this
 * game. Only .ts-suffixed local imports, so node can run it directly.
 */
import { LEVEL_SONG_GAINS } from "./levelSongGains.ts";

export type Wave = "square" | "sawtooth" | "triangle" | "sine";
export type BassStyle = "root" | "pump" | "fifth" | "octave" | "walk" | "waltz" | "boom";
export type DrumStyle = "none" | "march" | "rock" | "techno" | "breakbeat" | "shuffle" | "waltz" | "halftime" | "western" | "dnb" | "tick";

export const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  phrygianDom: [0, 1, 4, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  blues: [0, 3, 5, 6, 7, 10],
  wholeTone: [0, 2, 4, 6, 8, 10],
} as const;
export type Mode = keyof typeof MODES;

export interface LevelSong {
  id: string;
  title: string;
  level: string;
  style: string;
  key: string; // tonic, e.g. "C", "F#", "Bb"
  mode: Mode;
  bpm: number;
  beatsPerBar: 3 | 4;
  lead: Wave;
  vibrato?: number; // lead vibrato depth in cents
  harmony?: boolean; // parallel line a third under the lead
  bass: BassStyle;
  bassWave?: Wave;
  drums: DrumStyle;
  arp?: Wave;
  arpRate?: 0.5 | 0.25;
  bells?: boolean;
  swing?: boolean;
  /** 8 chord roots (scale degrees, 0 = tonic) for the A section; B is derived unless given. */
  prog: number[];
  progB?: number[];
  seed: number;
  /** 0 = calm, 1 = busy melody rhythm. */
  busy?: number;
}

export type Voice = "lead" | "harm" | "bass" | "arp" | "stab" | "bell" | "kick" | "snare" | "hat" | "tom";
export interface SongEvent {
  t: number; // seconds from loop start
  dur: number; // seconds
  hz: number;
  voice: Voice;
}

/** Peak gains, matched to the DLC synth (xmasMusic.ts) so volumes line up. */
export function voicePeak(v: Voice, wave: Wave): number {
  if (v === "lead") return wave === "sawtooth" ? 0.03 : wave === "square" ? 0.045 : wave === "triangle" ? 0.07 : 0.075;
  if (v === "harm") return wave === "sawtooth" ? 0.012 : wave === "square" ? 0.016 : 0.025;
  if (v === "bass") return wave === "triangle" || wave === "sine" ? 0.055 : 0.026;
  if (v === "arp") return wave === "sawtooth" ? 0.008 : wave === "square" ? 0.01 : 0.018;
  if (v === "stab") return 0.014;
  if (v === "bell") return 0.009;
  return 0;
}

export const LEVEL_SONGS: LevelSong[] = [
  { id: "corn-row-canter", title: "Corn Row Canter", level: "f1-1", style: "Sunny, bouncy opener", key: "C", mode: "major", bpm: 124, beatsPerBar: 4, lead: "square", bass: "pump", drums: "march", bells: true, prog: [0, 3, 4, 0, 5, 3, 1, 4], seed: 101, busy: 0.5 },
  { id: "squishy-steps", title: "Squishy Steps", level: "f1-2", style: "Soft, squishy and slow", key: "F", mode: "major", bpm: 100, beatsPerBar: 4, lead: "triangle", bass: "fifth", drums: "halftime", arp: "sine", prog: [0, 5, 3, 4, 0, 2, 3, 4], seed: 202, busy: 0.3 },
  { id: "lolly-waltz", title: "Lolly Waltz", level: "f1-3", style: "Dreamy forest waltz", key: "G", mode: "lydian", bpm: 132, beatsPerBar: 3, lead: "sine", vibrato: 12, bass: "waltz", drums: "waltz", bells: true, prog: [0, 1, 0, 4, 5, 1, 3, 4], seed: 303, busy: 0.4 },
  { id: "scotch-peak-climb", title: "Scotch Peak Climb", level: "f1-4", style: "Climbing, heroic", key: "D", mode: "mixolydian", bpm: 132, beatsPerBar: 4, lead: "square", harmony: true, bass: "octave", drums: "rock", prog: [0, 6, 3, 0, 0, 6, 3, 4], seed: 404, busy: 0.6 },
  { id: "choco-knockout", title: "Choco Knockout", level: "f1-boss", style: "Punchy fighting-game boss", key: "E", mode: "harmonic", bpm: 150, beatsPerBar: 4, lead: "sawtooth", bass: "pump", bassWave: "square", drums: "rock", arp: "square", arpRate: 0.25, prog: [0, 0, 5, 4, 0, 3, 5, 4], seed: 505, busy: 0.7 },
  { id: "sugar-mirage", title: "Sugar Mirage", level: "f2-1", style: "Hot desert, snake-charmer scale", key: "A", mode: "phrygianDom", bpm: 112, beatsPerBar: 4, lead: "square", vibrato: 20, bass: "boom", drums: "breakbeat", prog: [0, 1, 0, 6, 0, 1, 6, 0], seed: 606, busy: 0.5 },
  { id: "cookie-hoedown", title: "Cookie Hoedown", level: "f2-2", style: "Barn-dance fiddle tune", key: "G", mode: "major", bpm: 144, beatsPerBar: 4, lead: "square", bass: "walk", drums: "western", prog: [0, 0, 3, 0, 0, 4, 4, 0], progB: [3, 3, 0, 0, 3, 3, 4, 4], seed: 707, busy: 0.85 },
  { id: "high-noon-sour", title: "High Noon Sour", level: "f2-3", style: "Lonely whistle at high noon", key: "B", mode: "minor", bpm: 92, beatsPerBar: 4, lead: "triangle", vibrato: 25, bass: "root", drums: "western", arp: "triangle", prog: [0, 0, 6, 6, 5, 5, 4, 4], seed: 808, busy: 0.25 },
  { id: "dune-drift", title: "Dune Drift", level: "f2-4", style: "Floating over warm dunes", key: "Eb", mode: "major", bpm: 108, beatsPerBar: 4, lead: "sine", bass: "fifth", drums: "halftime", arp: "triangle", bells: true, prog: [0, 4, 5, 3, 0, 4, 3, 4], seed: 909, busy: 0.35 },
  { id: "puffball-duel", title: "Puffball Duel", level: "f2-boss", style: "Wild-west showdown boss", key: "D", mode: "minor", bpm: 156, beatsPerBar: 4, lead: "sawtooth", harmony: true, bass: "octave", bassWave: "square", drums: "western", prog: [0, 0, 6, 6, 5, 3, 4, 4], seed: 1010, busy: 0.7 },
  { id: "wrinkled-relics", title: "Wrinkled Relics", level: "f3-1", style: "Mysterious old ruins", key: "C", mode: "dorian", bpm: 104, beatsPerBar: 4, lead: "square", bass: "walk", drums: "halftime", arp: "triangle", prog: [0, 3, 0, 3, 6, 3, 4, 4], seed: 1111, busy: 0.45 },
  { id: "smash-street", title: "Smash Street", level: "f3-2", style: "Busy city, big beat", key: "F#", mode: "minor", bpm: 138, beatsPerBar: 4, lead: "sawtooth", bass: "octave", bassWave: "square", drums: "breakbeat", arp: "square", prog: [0, 5, 2, 6, 0, 5, 3, 4], seed: 1212, busy: 0.65 },
  { id: "root-beer-rag", title: "Root Beer Rag", level: "f3-3", style: "Tipsy honky-tonk piano rag", key: "Bb", mode: "major", bpm: 116, beatsPerBar: 4, lead: "square", harmony: true, swing: true, bass: "walk", drums: "shuffle", prog: [0, 0, 3, 3, 0, 5, 1, 4], seed: 1313, busy: 0.75 },
  { id: "channel-scotch", title: "Channel Scotch", level: "f3-4", style: "Cheesy TV theme jingle", key: "E", mode: "major", bpm: 128, beatsPerBar: 4, lead: "square", bass: "pump", drums: "techno", arp: "square", arpRate: 0.25, prog: [0, 5, 3, 4, 0, 5, 3, 4], seed: 1414, busy: 0.55 },
  { id: "cursed-board", title: "Cursed Board", level: "f3-boss", style: "Fast, glitchy skate battle", key: "G#", mode: "minor", bpm: 164, beatsPerBar: 4, lead: "sawtooth", bass: "pump", bassWave: "sawtooth", drums: "dnb", arp: "square", arpRate: 0.25, prog: [0, 5, 6, 4, 0, 5, 6, 6], seed: 1515, busy: 0.6 },
  { id: "junkyard-licorice", title: "Junkyard Licorice", level: "f4-1", style: "Grimy slow blues", key: "D", mode: "blues", bpm: 92, beatsPerBar: 4, lead: "triangle", swing: true, bass: "walk", drums: "shuffle", prog: [0, 0, 0, 0, 2, 2, 0, 3], seed: 1616, busy: 0.4 },
  { id: "assembly-line", title: "Assembly Line", level: "f4-2", style: "Mechanical factory groove", key: "A", mode: "minor", bpm: 130, beatsPerBar: 4, lead: "square", bass: "pump", bassWave: "square", drums: "techno", arp: "square", arpRate: 0.25, prog: [0, 0, 5, 5, 3, 3, 4, 4], seed: 1717, busy: 0.5 },
  { id: "bubbling-beakers", title: "Bubbling Beakers", level: "f4-3", style: "Wobbly mad-science", key: "D", mode: "wholeTone", bpm: 110, beatsPerBar: 4, lead: "sine", vibrato: 40, bass: "root", drums: "halftime", arp: "triangle", arpRate: 0.25, prog: [0, 1, 0, 2, 0, 1, 3, 2], seed: 1818, busy: 0.45 },
  { id: "wind-up-lullaby", title: "Wind-Up Lullaby", level: "f4-4", style: "Tinkly music box", key: "Ab", mode: "major", bpm: 96, beatsPerBar: 3, lead: "sine", bass: "waltz", bassWave: "sine", drums: "none", arp: "sine", bells: true, prog: [0, 3, 4, 0, 5, 3, 1, 4], seed: 1919, busy: 0.5 },
  { id: "mirror-cube", title: "Mirror Cube", level: "f4-boss", style: "Dark mirror-match boss", key: "C", mode: "harmonic", bpm: 152, beatsPerBar: 4, lead: "sawtooth", harmony: true, bass: "octave", bassWave: "square", drums: "rock", arp: "square", prog: [0, 5, 3, 4, 0, 5, 1, 4], seed: 2020, busy: 0.65 },
  { id: "pizza-plex-panic", title: "Pizza Plex Panic", level: "f5-1", style: "Frantic arcade rock", key: "E", mode: "mixolydian", bpm: 140, beatsPerBar: 4, lead: "square", bass: "octave", drums: "rock", arp: "triangle", prog: [0, 6, 3, 0, 0, 6, 4, 4], seed: 2121, busy: 0.75 },
  { id: "fuse-is-lit", title: "Fuse Is Lit", level: "f5-2", style: "Ticking-clock race", key: "B", mode: "phrygian", bpm: 168, beatsPerBar: 4, lead: "square", bass: "pump", bassWave: "square", drums: "tick", arp: "square", arpRate: 0.25, prog: [0, 1, 0, 6, 0, 1, 5, 6], seed: 2222, busy: 0.6 },
  { id: "tombstone-tiptoe", title: "Tombstone Tiptoe", level: "f5-3", style: "Spooky theremin creep", key: "D", mode: "harmonic", bpm: 84, beatsPerBar: 3, lead: "sine", vibrato: 35, bass: "waltz", drums: "waltz", bells: true, prog: [0, 0, 3, 4, 0, 5, 3, 4], seed: 2323, busy: 0.35 },
  { id: "summit-fanfare", title: "Summit Fanfare", level: "f5-4", style: "Triumphant mountaintop march", key: "A", mode: "major", bpm: 120, beatsPerBar: 4, lead: "square", harmony: true, bass: "fifth", drums: "march", bells: true, prog: [0, 3, 0, 4, 0, 3, 4, 0], seed: 2424, busy: 0.5 },
  { id: "warlocks-hex", title: "Warlock's Hex", level: "f5-boss", style: "Sinister spell-casting boss", key: "F", mode: "harmonic", bpm: 144, beatsPerBar: 4, lead: "sawtooth", vibrato: 15, bass: "pump", bassWave: "sawtooth", drums: "rock", arp: "square", arpRate: 0.25, prog: [0, 5, 1, 4, 0, 5, 3, 4], seed: 2525, busy: 0.6 },
  { id: "escape-the-rot", title: "Escape the Rot", level: "final-run", style: "All-out final escape", key: "C#", mode: "minor", bpm: 176, beatsPerBar: 4, lead: "sawtooth", harmony: true, bass: "octave", bassWave: "sawtooth", drums: "dnb", arp: "square", arpRate: 0.25, prog: [0, 5, 6, 4, 0, 5, 3, 4], seed: 2626, busy: 0.55 },
  { id: "admin-override", title: "Admin Override", level: "admin-warlords", style: "Glitchy cyber secret boss", key: "E", mode: "locrian", bpm: 148, beatsPerBar: 4, lead: "square", bass: "octave", bassWave: "square", drums: "techno", arp: "sawtooth", arpRate: 0.25, prog: [0, 1, 0, 5, 0, 1, 3, 2], seed: 2727, busy: 0.6 },
  // Floor 470539758, the Backrooms
  { id: "fluorescent-hum", title: "Fluorescent Hum", level: "hub-backrooms", style: "Buzzing lights, eerie empty calm", key: "F#", mode: "lydian", bpm: 72, beatsPerBar: 4, lead: "sine", vibrato: 25, bass: "root", bassWave: "triangle", drums: "none", bells: true, prog: [0, 0, 1, 0, 0, 4, 1, 0], seed: 4701, busy: 0.2 },
  { id: "yellow-wallpaper-walk", title: "Yellow Wallpaper Walk", level: "br-0", style: "Lonely office-hallway drift", key: "Bb", mode: "dorian", bpm: 88, beatsPerBar: 4, lead: "triangle", bass: "walk", drums: "tick", arp: "sine", arpRate: 0.5, prog: [0, 3, 0, 4, 0, 3, 5, 4], seed: 4702, busy: 0.35 },
  { id: "conveyor-shuffle", title: "Conveyor Shuffle", level: "br-motion", style: "Moving-floor machine groove", key: "G", mode: "mixolydian", bpm: 126, beatsPerBar: 4, lead: "square", bass: "pump", drums: "techno", arp: "triangle", arpRate: 0.25, prog: [0, 6, 3, 0, 0, 6, 4, 0], seed: 4703, busy: 0.55 },
  { id: "chlorine-dream", title: "Chlorine Dream", level: "br-pool", style: "Echoey pool-room float", key: "Eb", mode: "lydian", bpm: 80, beatsPerBar: 3, lead: "sine", vibrato: 30, harmony: true, bass: "waltz", bassWave: "sine", drums: "waltz", bells: true, prog: [0, 1, 4, 0, 5, 1, 4, 0], seed: 4704, busy: 0.3 },
  { id: "stalactite-drip", title: "Stalactite Drip", level: "br-cave", style: "Dark dripping cave pulse", key: "C#", mode: "phrygian", bpm: 96, beatsPerBar: 4, lead: "triangle", bass: "boom", drums: "halftime", bells: true, prog: [0, 1, 0, 6, 0, 1, 5, 0], seed: 4705, busy: 0.3 },
  { id: "bacteria-stalks", title: "Bacteria Stalks", level: "br-boss", style: "Tense creeping secret boss", key: "A", mode: "locrian", bpm: 160, beatsPerBar: 4, lead: "sawtooth", bass: "octave", bassWave: "sawtooth", drums: "breakbeat", arp: "square", arpRate: 0.25, prog: [0, 1, 0, 4, 0, 1, 5, 4], seed: 4706, busy: 0.6 },
  { id: "red-hallway-run", title: "Red Hallway Run", level: "br-escape", style: "Panicked escape chase", key: "F", mode: "phrygian", bpm: 184, beatsPerBar: 4, lead: "square", harmony: true, bass: "octave", bassWave: "sawtooth", drums: "dnb", arp: "sawtooth", arpRate: 0.25, prog: [0, 1, 0, 6, 0, 1, 4, 5], seed: 4707, busy: 0.6 },
  { id: "above-the-yellow", title: "Above the Yellow", level: "br-heaven", style: "Calm, glowing relief", key: "D", mode: "lydian", bpm: 76, beatsPerBar: 4, lead: "sine", harmony: true, bass: "root", bassWave: "triangle", drums: "none", arp: "sine", arpRate: 0.5, prog: [0, 4, 5, 3, 0, 4, 1, 4], seed: 4708, busy: 0.3 },
];

export function songById(id: string): LevelSong | undefined {
  return LEVEL_SONGS.find((s) => s.id === id);
}

export function songGain(id: string): number {
  return LEVEL_SONG_GAINS[id] ?? 1;
}

// ------------------------------------------------------------------ composer
const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function tonicMidi(key: string, octave: number) {
  let s = SEMI[key[0]!]!;
  if (key[1] === "#") s += 1;
  if (key[1] === "b") s -= 1;
  return (octave + 1) * 12 + s;
}
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RHYTHMS: Record<3 | 4, { calm: number[][]; busy: number[][] }> = {
  4: {
    calm: [[1, 1, 1, 1], [2, 1, 1], [1, 1, 2], [1.5, 0.5, 2], [2, 2], [1, 0.5, 0.5, 2], [3, 1]],
    busy: [[1, 0.5, 0.5, 1, 1], [0.5, 0.5, 1, 0.5, 0.5, 1], [0.5, 0.5, 0.5, 0.5, 1, 1], [0.75, 0.25, 1, 0.75, 0.25, 1], [1.5, 0.5, 0.5, 0.5, 1], [0.5, 1, 0.5, 1, 1], [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1]],
  },
  3: {
    calm: [[1, 1, 1], [2, 1], [3], [1, 2], [1.5, 0.5, 1]],
    busy: [[1, 0.5, 0.5, 1], [0.5, 0.5, 1, 1], [0.5, 0.5, 0.5, 0.5, 1], [1.5, 0.5, 0.5, 0.5]],
  },
};

interface Note {
  at: number; // beats
  beats: number;
  deg: number | null; // scale degree index (null = rest)
}

function degMidi(song: LevelSong, deg: number, octave: number) {
  const sc = MODES[song.mode];
  const n = sc.length;
  const o = Math.floor(deg / n);
  const i = ((deg % n) + n) % n;
  return tonicMidi(song.key, octave) + o * 12 + sc[i]!;
}

/** Writes the 16-bar melody as scale degrees (relative to the tonic in octave 4). */
export function composeMelody(song: LevelSong): Note[] {
  const r = rng(song.seed);
  const bpb = song.beatsPerBar;
  const progA = song.prog;
  const progB = song.progB ?? [...progA.slice(4), ...progA.slice(0, 3).map((p) => (p + 3) % 7), 4];
  const prog = [...progA, ...progB];
  const busy = song.busy ?? 0.5;
  const pools = RHYTHMS[bpb];
  const pickRhythm = () => {
    const pool = r() < busy ? pools.busy : pools.calm;
    return pool[Math.floor(r() * pool.length)]!;
  };
  const chordTones = (root: number) => [root, root + 2, root + 4, root + 7, root + 9, root + 11, root - 3, root - 5];
  const notes: Note[] = [];
  let prev = 4;
  const barNotes: Note[][] = [];
  for (let bar = 0; bar < 16; bar++) {
    const sec = bar < 8 ? 0 : 1;
    const lo = sec ? 2 : 0;
    const hi = sec ? 11 : 9;
    const root = prog[bar]!;
    const local = bar % 8;
    const out: Note[] = [];
    if (local === 4 || local === 5) {
      // motif returns: same rhythm + contour as bars 0/1 (of this section), moved to this chord
      const src = barNotes[bar - 4]!;
      const shift = root - prog[bar - 4]!;
      for (const n of src) out.push({ at: n.at + 4 * bpb, beats: n.beats, deg: n.deg == null ? null : Math.max(lo, Math.min(hi, n.deg + shift)) });
    } else if (local === 7) {
      // cadence: a chord tone, held (home on the tonic at the end of B so the loop resolves)
      const target = bar === 15 ? root + 4 : root;
      const options = [target, target + 7, target - 7].filter((d) => d >= lo - 2 && d <= hi + 2);
      const deg = options.sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev))[0] ?? target;
      const lead = bpb === 4 ? [1, 3] : [1, 2];
      const pre = Math.max(lo, Math.min(hi, deg + (r() < 0.5 ? 1 : -1)));
      out.push({ at: bar * bpb, beats: lead[0]!, deg: pre });
      out.push({ at: bar * bpb + lead[0]!, beats: lead[1]!, deg });
    } else {
      const rhythm = pickRhythm();
      let at = bar * bpb;
      rhythm.forEach((b, i) => {
        const pos = at - bar * bpb;
        const strong = pos === 0 || (bpb === 4 && pos === 2);
        let deg: number;
        if (strong) {
          const cands = chordTones(root).filter((d) => d >= lo && d <= hi);
          cands.sort((a, b2) => Math.abs(a - prev) - Math.abs(b2 - prev));
          deg = cands[Math.min(cands.length - 1, Math.floor(r() * 2))] ?? root;
        } else {
          const step = r() < 0.7 ? (r() < 0.5 ? 1 : -1) : r() < 0.5 ? 2 : -2;
          deg = prev + step;
          if (deg < lo || deg > hi) deg = prev - step;
        }
        const rest = i > 0 && !strong && r() < 0.08;
        out.push({ at, beats: b, deg: rest ? null : deg });
        if (!rest) prev = deg;
        at += b;
      });
    }
    for (const n of out) if (n.deg != null) prev = n.deg;
    barNotes.push(out);
    notes.push(...out);
  }
  return notes;
}

/** All events for one loop, in seconds. */
export function composeSong(song: LevelSong): { events: SongEvent[]; length: number; prog: number[] } {
  const spb = 60 / song.bpm;
  const bpb = song.beatsPerBar;
  const progA = song.prog;
  const progB = song.progB ?? [...progA.slice(4), ...progA.slice(0, 3).map((p) => (p + 3) % 7), 4];
  const prog = [...progA, ...progB];
  const beats = 16 * bpb;
  const ev: SongEvent[] = [];
  const sw = (b: number) => (song.swing && Math.abs((b % 1) - 0.5) < 1e-6 ? b + 1 / 6 : b);
  const add = (b: number, len: number, f: number, voice: Voice) => ev.push({ t: sw(b) * spb, dur: len * spb, hz: f, voice });

  for (const n of composeMelody(song)) {
    if (n.deg == null) continue;
    add(n.at, n.beats * 0.92, hz(degMidi(song, n.deg, 4)), "lead");
    if (song.harmony) add(n.at, n.beats * 0.9, hz(degMidi(song, n.deg - 2, 4)), "harm");
  }
  for (let bar = 0; bar < 16; bar++) {
    const root = prog[bar]!;
    const next = prog[(bar + 1) % 16]!;
    const at = bar * bpb;
    let rm = degMidi(song, root, 2);
    if (rm < 38) rm += 12;
    const fifth = rm + 7;
    const third = degMidi(song, root + 2, 2) + (rm - degMidi(song, root, 2));
    switch (song.bass) {
      case "root":
        add(at, bpb * 0.9, hz(rm), "bass");
        break;
      case "pump":
        for (let k = 0; k < bpb * 2; k++) add(at + k * 0.5, 0.42, hz(rm), "bass");
        break;
      case "fifth":
        for (let k = 0; k < bpb; k++) add(at + k, 0.85, hz(k % 2 ? fifth : rm), "bass");
        break;
      case "octave":
        for (let k = 0; k < bpb * 2; k++) add(at + k * 0.5, 0.42, hz(k % 2 ? rm + 12 : rm), "bass");
        break;
      case "walk": {
        let nm = degMidi(song, next, 2);
        if (nm < 38) nm += 12;
        const line = [rm, third, fifth, nm + (nm > fifth ? -1 : 1)];
        for (let k = 0; k < bpb; k++) add(at + k, 0.85, hz(line[k]!), "bass");
        break;
      }
      case "boom":
        add(at, bpb / 2 - 0.1, hz(rm), "bass");
        add(at + bpb / 2, bpb / 2 - 0.1, hz(fifth), "bass");
        break;
      case "waltz":
        add(at, 0.9, hz(rm), "bass");
        for (let k = 1; k < bpb; k++) for (const d of [root + 2, root + 4]) add(at + k, 0.4, hz(degMidi(song, d, 3)), "stab");
        break;
    }
    if (song.arp) {
      const rate = song.arpRate ?? 0.5;
      const tones = [root, root + 2, root + 4, root + 7];
      for (let k = 0; k * rate < bpb; k++) add(at + k * rate, rate * 0.8, hz(degMidi(song, tones[k % 4]!, 5)), "arp");
    }
    if (song.bells) add(at, 0.5, hz(degMidi(song, root + 4, 6)), "bell");
  }
  // drums
  const D = (b: number, v: Voice, len = 0.1) => add(b, len, v === "kick" ? 150 : v === "tom" ? 200 : 0, v);
  for (let bar = 0; bar < 16; bar++) {
    const a = bar * bpb;
    switch (song.drums) {
      case "march":
        for (let k = 0; k < bpb; k++) D(a + k, k % 2 ? "snare" : "kick");
        break;
      case "rock":
        D(a, "kick"); D(a + 2, "kick"); D(a + 2.5, "kick"); D(a + 1, "snare"); D(a + 3, "snare");
        for (let k = 0; k < 8; k++) D(a + k * 0.5, "hat", 0.04);
        break;
      case "techno":
        for (let k = 0; k < 4; k++) { D(a + k, "kick"); D(a + k + 0.5, "hat", 0.05); }
        D(a + 1, "snare"); D(a + 3, "snare");
        break;
      case "breakbeat":
        D(a, "kick"); D(a + 1.5, "kick"); D(a + 2.75, "kick"); D(a + 1, "snare"); D(a + 3, "snare"); D(a + 3.5, "snare", 0.06);
        for (let k = 0; k < 8; k++) D(a + k * 0.5, "hat", 0.04);
        break;
      case "shuffle":
        D(a, "kick"); D(a + 2, "kick"); D(a + 1, "snare"); D(a + 3, "snare");
        for (let k = 0; k < 8; k++) D(a + k * 0.5, "hat", 0.04);
        break;
      case "waltz":
        D(a, "kick"); D(a + 1, "hat", 0.05); D(a + 2, "hat", 0.05);
        break;
      case "halftime":
        D(a, "kick"); D(a + 2, "snare");
        if (bar % 2) D(a + 3.5, "kick");
        for (let k = 0; k < 4; k++) D(a + k + 0.5, "hat", 0.04);
        break;
      case "western":
        D(a, "kick"); D(a + 2, "kick"); D(a + 1, "snare"); D(a + 3, "snare");
        for (let k = 0; k < 4; k++) D(a + k + 0.5, "tom", 0.08);
        break;
      case "dnb":
        D(a, "kick"); D(a + 2.5, "kick"); D(a + 1, "snare"); D(a + 3, "snare");
        for (let k = 0; k < 8; k++) D(a + k * 0.5, "hat", 0.03);
        break;
      case "tick":
        for (let k = 0; k < 8; k++) D(a + k * 0.5, "hat", 0.03);
        D(a, "kick"); D(a + 2, "kick"); D(a + 3.5, "tom", 0.08);
        break;
      case "none":
        break;
    }
  }
  ev.sort((x, y) => x.t - y.t);
  return { events: ev, length: beats * spb, prog };
}

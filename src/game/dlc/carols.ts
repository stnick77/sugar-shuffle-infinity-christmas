/**
 * Christmas songs for the 'Tis the Seasones DLC.
 *
 * ORIGINAL_THEMES are brand-new melodies written for this DLC (track names by
 * Hayden). They play per area when the song picker is on "Area themes".
 *
 * PUBLIC_DOMAIN_CAROLS are original chiptune arrangements of traditional,
 * public-domain melodies (written note-by-note for this game).
 *
 * LICENSED_SLOTS are the five songs from the design sheet. Those recordings
 * and compositions are copyrighted, so NOTHING from them ships here. Each slot
 * stays silent until a licensed audio file is dropped in — see DLC.md
 * ("Adding the licensed songs") and public/game/music/xmas/licensed.json.
 */

export type MusicArea = "menu" | "home" | "hub" | "level" | "boss";

export interface Carol {
  id: string;
  title: string;
  kind: "carol" | "theme";
  /** For original themes: where it plays in "Area themes" mode. */
  area?: MusicArea;
  /** Who named / made the track (shown in the options menu). */
  credit?: string;
  /** Lead voice. Default square. */
  lead?: OscillatorType;
  bpm: number;
  beatsPerBar: number;
  /** Beats before bar 1 (anacrusis). */
  pickup: number;
  /** Space separated `NOTE:beats` (e.g. `E4:1 F#4:0.5 R:1`). R = rest. */
  melody: string;
  /** One bass root per bar (octave 2/3 is chosen automatically). */
  roots: string[];
  bells?: boolean;
  /** Drum kit: "techno" = four-on-the-floor + hats + clap, "march" = steady kick/snare. */
  drums?: "techno" | "march";
  /** Hayden's style note for the track. */
  style?: string;
}

export interface LicensedSlot {
  id: string;
  title: string;
  kind: "licensed";
}

/** Original compositions for the DLC — not based on any existing song. */
export const ORIGINAL_THEMES: Carol[] = [
  {
    id: "ready-up",
    title: "Ready Up",
    kind: "theme",
    area: "menu",
    credit: "Hayden",
    style: "Adventurous and steady",
    drums: "march",
    bpm: 126,
    beatsPerBar: 4,
    pickup: 0,
    bells: true,
    melody: [
      "G4:0.5 C5:0.5 E5:0.5 G5:0.5 E5:1 C5:1",
      "D5:0.5 E5:0.5 F5:1 E5:0.5 D5:0.5 C5:1",
      "A4:0.5 C5:0.5 F5:0.5 A5:0.5 G5:1 E5:1",
      "F5:0.5 E5:0.5 D5:1 G4:2",
      "G4:0.5 C5:0.5 E5:0.5 G5:0.5 A5:1 G5:1",
      "F5:0.5 G5:0.5 A5:1 C6:1 B5:1",
      "A5:0.5 G5:0.5 F5:0.5 E5:0.5 D5:1 B4:1",
      "C5:2 R:1 G4:1",
      "E5:1 E5:0.5 F5:0.5 G5:1 E5:1",
      "D5:1 D5:0.5 E5:0.5 F5:1 D5:1",
      "C5:0.5 D5:0.5 E5:0.5 F5:0.5 G5:0.5 A5:0.5 B5:0.5 C6:0.5",
      "G5:2 R:2",
    ].join(" "),
    roots: ["C", "G", "F", "G", "C", "F", "G", "C", "A", "D", "F", "G"],
  },
  {
    id: "peaceful-home",
    title: "Peaceful Home",
    kind: "theme",
    area: "home",
    credit: "Hayden",
    lead: "triangle",
    style: "Calm and cozy",
    bpm: 84,
    beatsPerBar: 3,
    pickup: 0,
    melody: [
      "A4:1.5 C5:0.5 Bb4:1",
      "A4:1 F4:2",
      "G4:1 A4:0.5 Bb4:0.5 D5:1",
      "C5:3",
      "D5:1.5 C5:0.5 A4:1",
      "Bb4:1 G4:2",
      "E4:1 G4:1 Bb4:1",
      "A4:3",
      "F5:1.5 E5:0.5 D5:1",
      "C5:1 A4:2",
      "Bb4:1 D5:0.5 C5:0.5 G4:1",
      "A4:2 C5:1",
      "Bb4:1 A4:1 G4:1",
      "E4:1.5 F4:0.5 G4:1",
      "A4:1 G4:1 E4:1",
      "F4:3",
    ].join(" "),
    roots: ["F", "F", "Bb", "F", "Bb", "G", "C", "F", "D", "F", "G", "F", "Bb", "C", "C", "F"],
  },
  {
    id: "hub-theme",
    title: "Hub Theme",
    kind: "theme",
    area: "hub",
    credit: "Hayden",
    style: "Adventurous and steady",
    drums: "march",
    bpm: 116,
    beatsPerBar: 4,
    pickup: 0,
    bells: true,
    melody: [
      "B4:1 D5:0.5 B4:0.5 A4:1 G4:1",
      "E4:0.5 G4:0.5 A4:1 B4:2",
      "C5:1 E5:0.5 C5:0.5 B4:1 A4:1",
      "F#4:0.5 A4:0.5 B4:1 A4:2",
      "B4:1 D5:0.5 E5:0.5 D5:1 B4:1",
      "G4:0.5 A4:0.5 B4:1 E5:2",
      "D5:0.5 C5:0.5 B4:0.5 A4:0.5 G4:1 F#4:1",
      "G4:3 R:1",
    ].join(" "),
    roots: ["G", "E", "C", "D", "G", "E", "D", "G"],
  },
  {
    id: "level-theme",
    title: "Level Theme",
    kind: "theme",
    area: "level",
    credit: "Hayden",
    style: "Calm, retro, slow",
    lead: "square",
    bpm: 92,
    beatsPerBar: 4,
    pickup: 0,
    melody: [
      "E4:1 G4:1 C5:2",
      "B4:1 A4:1 G4:2",
      "A4:1 C5:1 F5:1.5 E5:0.5",
      "D5:4",
      "C5:1 E5:1 G5:1.5 F5:0.5",
      "E5:1 D5:1 C5:2",
      "A4:1 B4:0.5 C5:0.5 D5:1 G4:1",
      "C5:4",
    ].join(" "),
    roots: ["C", "E", "F", "G", "C", "A", "G", "C"],
  },
  {
    id: "boss-theme",
    title: "Boss Theme",
    kind: "theme",
    area: "boss",
    credit: "Hayden",
    style: "Fast, uplifting, techno",
    lead: "sawtooth",
    drums: "techno",
    bpm: 148,
    beatsPerBar: 4,
    pickup: 0,
    melody: [
      "D5:0.5 F#5:0.5 A5:0.5 F#5:0.5 D5:0.5 F#5:0.5 A5:0.5 B5:0.5",
      "G5:0.5 B5:0.5 D6:0.5 B5:0.5 G5:0.5 B5:0.5 A5:1",
      "E5:0.5 G5:0.5 B5:0.5 G5:0.5 E5:0.5 G5:0.5 B5:0.5 C#6:0.5",
      "A5:1 F#5:1 E5:1 A4:1",
      "D5:0.5 F#5:0.5 A5:0.5 F#5:0.5 D5:0.5 F#5:0.5 A5:0.5 B5:0.5",
      "G5:0.5 B5:0.5 D6:0.5 E6:0.5 F#6:1 E6:1",
      "D6:0.5 C#6:0.5 B5:0.5 A5:0.5 G5:0.5 F#5:0.5 E5:0.5 C#5:0.5",
      "D5:2 A5:1 D6:1",
    ].join(" "),
    roots: ["D", "G", "E", "A", "D", "G", "A", "D"],
  },
];

export const PUBLIC_DOMAIN_CAROLS: Carol[] = [
  {
    id: "jingle-bells",
    title: "Jingle Bells",
    kind: "carol",
    bpm: 168,
    beatsPerBar: 4,
    pickup: 0,
    bells: true,
    melody: [
      "E4:1 E4:1 E4:2",
      "E4:1 E4:1 E4:2",
      "E4:1 G4:1 C4:1.5 D4:0.5",
      "E4:4",
      "F4:1 F4:1 F4:1.5 F4:0.5",
      "F4:1 E4:1 E4:1 E4:0.5 E4:0.5",
      "E4:1 D4:1 D4:1 E4:1",
      "D4:2 G4:2",
      "E4:1 E4:1 E4:2",
      "E4:1 E4:1 E4:2",
      "E4:1 G4:1 C4:1.5 D4:0.5",
      "E4:4",
      "F4:1 F4:1 F4:1 F4:1",
      "F4:1 E4:1 E4:1 E4:0.5 E4:0.5",
      "G4:1 G4:1 F4:1 D4:1",
      "C4:4",
    ].join(" "),
    roots: ["C", "C", "C", "C", "F", "C", "G", "G", "C", "C", "C", "C", "F", "C", "G", "C"],
  },
  {
    id: "deck-the-halls",
    title: "Deck the Halls",
    kind: "carol",
    bpm: 144,
    beatsPerBar: 4,
    pickup: 0,
    melody: [
      "G4:1.5 F4:0.5 E4:1 D4:1",
      "C4:1 D4:1 E4:1 C4:1",
      "D4:0.5 E4:0.5 F4:0.5 D4:0.5 E4:1.5 D4:0.5",
      "C4:1 B3:1 C4:2",
      "G4:1.5 F4:0.5 E4:1 D4:1",
      "C4:1 D4:1 E4:1 C4:1",
      "D4:0.5 E4:0.5 F4:0.5 D4:0.5 E4:1.5 D4:0.5",
      "C4:1 B3:1 C4:2",
      "D4:1.5 E4:0.5 F4:1 D4:1",
      "E4:1.5 F4:0.5 G4:1 D4:1",
      "E4:0.5 F#4:0.5 G4:1 A4:0.5 B4:0.5 C5:1",
      "B4:1 A4:1 G4:2",
      "G4:1.5 F4:0.5 E4:1 D4:1",
      "C4:1 D4:1 E4:1 C4:1",
      "A4:0.5 A4:0.5 A4:0.5 A4:0.5 G4:1.5 F4:0.5",
      "E4:1 D4:1 C4:2",
    ].join(" "),
    roots: ["C", "C", "G", "C", "C", "C", "G", "C", "G", "C", "D", "G", "C", "C", "F", "C"],
  },
  {
    id: "we-wish-you",
    title: "We Wish You a Merry Christmas",
    kind: "carol",
    bpm: 168,
    beatsPerBar: 3,
    pickup: 1,
    melody: [
      "D4:1",
      "G4:1 G4:0.5 A4:0.5 G4:0.5 F#4:0.5",
      "E4:1 E4:1 E4:1",
      "A4:1 A4:0.5 B4:0.5 A4:0.5 G4:0.5",
      "F#4:1 D4:1 D4:1",
      "B4:1 B4:0.5 C5:0.5 B4:0.5 A4:0.5",
      "G4:1 E4:1 D4:0.5 D4:0.5",
      "E4:1 A4:1 F#4:1",
      "G4:2 R:1",
    ].join(" "),
    roots: ["G", "C", "A", "D", "G", "C", "D", "G"],
  },
  {
    id: "carol-of-the-bells",
    title: "Carol of the Bells (Shchedryk)",
    kind: "carol",
    bpm: 192,
    beatsPerBar: 3,
    pickup: 0,
    bells: true,
    melody: [
      // the four-note bell motif, eight times
      "Bb4:1 A4:0.5 Bb4:0.5 G4:1",
      "Bb4:1 A4:0.5 Bb4:0.5 G4:1",
      "Bb4:1 A4:0.5 Bb4:0.5 G4:1",
      "Bb4:1 A4:0.5 Bb4:0.5 G4:1",
      "Bb4:1 A4:0.5 Bb4:0.5 G4:1",
      "Bb4:1 A4:0.5 Bb4:0.5 G4:1",
      "Bb4:1 A4:0.5 Bb4:0.5 G4:1",
      "Bb4:1 A4:0.5 Bb4:0.5 G4:1",
      // up high
      "D5:1 C5:0.5 D5:0.5 Bb4:1",
      "D5:1 C5:0.5 D5:0.5 Bb4:1",
      "D5:1 C5:0.5 D5:0.5 Bb4:1",
      "D5:1 C5:0.5 D5:0.5 Bb4:1",
      "G5:1 F5:0.5 G5:0.5 D5:1",
      "G5:1 F5:0.5 G5:0.5 D5:1",
      // tumbling down
      "G5:0.5 F5:0.5 Eb5:0.5 D5:0.5 C5:0.5 Bb4:0.5",
      "C5:0.5 D5:0.5 C5:0.5 Bb4:0.5 A4:1",
      "Bb4:0.5 C5:0.5 Bb4:0.5 A4:0.5 G4:1",
      "D4:0.5 E4:0.5 F#4:0.5 G4:0.5 A4:0.5 Bb4:0.5",
      "Bb4:1 A4:0.5 Bb4:0.5 G4:1",
      "Bb4:1 A4:0.5 Bb4:0.5 G4:1",
      "G4:3",
    ].join(" "),
    roots: ["G", "G", "F", "F", "Eb", "Eb", "D", "D", "G", "F", "Eb", "D", "G", "G", "Eb", "D", "G", "D", "G", "D", "G"],
  },
  {
    id: "o-christmas-tree",
    title: "O Christmas Tree (O Tannenbaum)",
    kind: "carol",
    bpm: 104,
    beatsPerBar: 3,
    pickup: 1,
    melody: [
      "D4:1",
      "G4:0.75 G4:0.25 G4:1.5 A4:0.5",
      "B4:0.75 B4:0.25 B4:1.5 B4:0.5",
      "A4:0.5 B4:0.5 C5:1 F#4:1",
      "A4:1 G4:1 D4:1",
      "G4:0.75 G4:0.25 G4:1.5 A4:0.5",
      "B4:0.75 B4:0.25 B4:1.5 B4:0.5",
      "A4:0.5 B4:0.5 C5:1 F#4:1",
      "A4:1 G4:1 D5:1",
      "D5:0.5 B4:0.5 E5:1.5 D5:0.5",
      "D5:0.5 C5:0.5 C5:1.5 C5:0.5",
      "C5:0.5 A4:0.5 D5:1.5 C5:0.5",
      "C5:0.5 B4:0.5 B4:1 D4:1",
      "G4:0.75 G4:0.25 G4:1.5 A4:0.5",
      "B4:0.75 B4:0.25 B4:1.5 B4:0.5",
      "A4:0.5 B4:0.5 C5:1 F#4:1",
      "A4:1 G4:2",
    ].join(" "),
    roots: ["G", "G", "D", "G", "G", "G", "D", "G", "G", "C", "D", "G", "G", "G", "D", "G"],
  },
];

/** The design sheet's "Bonus songs". Placeholders only — no audio ships for these. */
export const LICENSED_SLOTS: LicensedSlot[] = [
  { id: "all-i-want-for-christmas-is-you", title: "All I Want for Christmas Is You", kind: "licensed" },
  { id: "most-wonderful-time-of-the-year", title: "It's the Most Wonderful Time of the Year", kind: "licensed" },
  { id: "santa-claus-lane", title: "Santa Claus Lane", kind: "licensed" },
  { id: "jingle-bell-rock", title: "Jingle Bell Rock", kind: "licensed" },
  { id: "rockin-around-the-christmas-tree", title: "Rockin' Around the Christmas Tree", kind: "licensed" },
];

export const ALL_SONGS: (Carol | LicensedSlot)[] = [...ORIGINAL_THEMES, ...PUBLIC_DOMAIN_CAROLS, ...LICENSED_SLOTS];

/** Song picker value meaning "play Hayden's theme for wherever you are". */
export const AREA_THEMES = "area-themes";

export function themeForArea(area: MusicArea): Carol {
  return ORIGINAL_THEMES.find((t) => t.area === area) ?? ORIGINAL_THEMES[0]!;
}

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "F#4" → Hz (A4 = 440). */
export function noteHz(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  let semi = SEMI[m[1]!]!;
  if (m[2] === "#") semi += 1;
  if (m[2] === "b") semi -= 1;
  const midi = (Number(m[3]) + 1) * 12 + semi;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface NoteEvent {
  /** start, in beats from song start */
  at: number;
  beats: number;
  hz: number | null;
}

export function parseMelody(melody: string): NoteEvent[] {
  const out: NoteEvent[] = [];
  let at = 0;
  for (const tok of melody.trim().split(/\s+/)) {
    const [n, b] = tok.split(":");
    const beats = Number(b);
    if (!n || !Number.isFinite(beats) || beats <= 0) throw new Error(`bad token ${tok}`);
    out.push({ at, beats, hz: n === "R" ? null : noteHz(n) });
    at += beats;
  }
  return out;
}

export function songBeats(c: Carol) {
  return c.pickup + c.roots.length * c.beatsPerBar;
}

/** Bass line: root on beat 1 and the fifth mid-bar, an octave under the tune. */
export function bassLine(c: Carol): NoteEvent[] {
  const out: NoteEvent[] = [];
  c.roots.forEach((r, i) => {
    const at = c.pickup + i * c.beatsPerBar;
    const root = noteHz(`${r}2`) < 70 ? noteHz(`${r}3`) : noteHz(`${r}2`);
    if (c.drums === "techno") {
      for (let k = 0; k < c.beatsPerBar * 2; k++) out.push({ at: at + k * 0.5 + 0.25, beats: 0.25, hz: root });
    } else if (c.beatsPerBar === 4) {
      out.push({ at, beats: 2, hz: root });
      out.push({ at: at + 2, beats: 2, hz: root * 1.5 });
    } else {
      out.push({ at, beats: 1, hz: root });
      out.push({ at: at + 1, beats: 1, hz: root * 1.5 });
      out.push({ at: at + 2, beats: 1, hz: root * 1.5 });
    }
  });
  return out;
}

export function songById(id: string) {
  return ALL_SONGS.find((s) => s.id === id);
}

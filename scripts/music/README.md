# Level music

Every level has its own original track, composed procedurally in code
(`src/game/music/levelSongs.ts`): key + mode, chord progression, tempo,
groove and chiptune instruments per level; the melody is written from seeded
note patterns. The game plays them live with Web Audio (`levelMusic.ts`), the
same way the 'Tis the Seasones DLC plays its themes. No samples, no
third-party or AI music.

`render-level-songs.ts` renders the same events offline, measures loudness
against the DLC's original themes, regenerates
`src/game/music/levelSongGains.ts` (per-song gain so all tracks play at the
same volume) and writes ogg + mp3 previews:

    node --experimental-strip-types scripts/music/render-level-songs.ts /path/to/out

Hubs, menus and Cuboe and Cubro's Home keep the original shared loop. When
the Christmas DLC's music option is on, its area themes still take over.

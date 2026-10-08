// Taiko Drum Circle: the music and the rule constants. Pure data + pure functions (no clock, no randomness).
// The Rules page prints these same constants, so the text cannot drift from the engine.
//
// Notation (one character per step, `steps` characters per bar; spaces are ignored):
//   D = don (centre hit)  d = soft don   K = ka (rim hit)  k = soft ka   . = rest
// A bar is 4 beats. steps = 16 (sixteenth notes) or 12 (triplet feel, three steps per beat).

export const DRUMS = [
  { id: 'shime', name: 'Shime-daiko', short: 'Shime', blurb: 'The small, tightly roped drum: bright and sharp. It keeps time for the circle.', size: 0.82 },
  { id: 'chu', name: 'Chu-daiko', short: 'Chu', blurb: 'The mid-sized barrel drum: warm and round. It carries the tune of the circle.', size: 1.0 },
  { id: 'okedo', name: 'Okedo-daiko', short: 'Okedo', blurb: 'A lighter, rope-laced barrel drum with a lower voice. It fills the middle of the sound.', size: 1.0 },
  { id: 'odaiko', name: 'O-daiko', short: 'O-daiko', blurb: 'The big drum: deep and long. One hit is felt in the chest.', size: 1.28 },
  { id: 'atari', name: 'Atarigane', short: 'Bell', blurb: 'A small hand gong struck with a mallet. It rings above the drums and is played by the ensemble only.', size: 0.5, ensembleOnly: true },
];
export const PLAYABLE = 4;                                                  // drums 0-3 can be played; drum 4 (the bell) belongs to the ensemble

// ---- judging and scoring (all read by the Rules page) -------------------------------------------------------------
export const JUDGE = { perfect: 0.05, great: 0.09, good: 0.14 };          // seconds either side of the note, at the "Normal" timing setting
export const TIMING = [{ id: 'relaxed', name: 'Relaxed', k: 1.4 }, { id: 'normal', name: 'Normal', k: 1 }, { id: 'tight', name: 'Tight', k: 0.8 }];
export const SPEEDS = [{ id: 'slow', name: 'Slow', approach: 2.4 }, { id: 'normal', name: 'Normal', approach: 1.9 }, { id: 'fast', name: 'Fast', approach: 1.5 }];
export const SCORE = { perfect: 300, great: 200, good: 100, off: 40, comboStep: 10, comboMax: 4 };   // multiplier = 1 + floor(combo / 10), at most 4
export const WEIGHT = { perfect: 1, great: 0.85, good: 0.6, off: 0.4, miss: 0 };                    // accuracy credit per note
export const STARS = [0.55, 0.75, 0.9];                                                             // accuracy for 1, 2, 3 stars
export const ENSEMBLE = { every: 8, start: 1, max: 3 };                                             // +1 layer per 8 clean hits in a row; a miss takes one away
export const LEARN = { pass: 0.5, tries: 2 };
export const ZONE = { don: 0.52, rim: 1.32 };                                                       // touch zones as a fraction of the drum head radius
export const LOOKAHEAD = 0.12;                                                                      // seconds: how far ahead the ensemble is handed to the audio clock
export const GRADES = [['S', 0.95], ['A', 0.85], ['B', 0.7], ['C', 0.5], ['D', 0]];

export const accuracyToStars = (a) => (a >= STARS[2] ? 3 : a >= STARS[1] ? 2 : a >= STARS[0] ? 1 : 0);
export const gradeOf = (a) => GRADES.find((g) => a >= g[1])[0];
export const comboMult = (combo) => Math.min(SCORE.comboMax, 1 + Math.floor(combo / SCORE.comboStep));

// ---- the six pieces -----------------------------------------------------------------------------------------------
// player: the drum indexes (0 shime, 1 chu, 2 okedo, 3 o-daiko) the player plays. pat: named one-bar patterns per drum.
// form: one letter per bar ('.' = the drum is silent). layers: 0 = the base groove (always on), 1-3 join as the player plays cleanly.
// Each part is { drum, pat: {A, B, ...}, form }.
const P = (drum, pat, form) => ({ drum, pat, form });

export const PIECES = [
  {
    id: 'first-pulse', name: 'First Pulse', bpm: 76, steps: 16, bars: 16, level: 1, player: [1],
    blurb: 'One drum, steady beats, then the rim joins in. The place to begin.',
    parts: {
      player: [P(1, { A: 'D...D...D...D...', B: 'D...K...D...K...', C: 'D...K...D.K.D...' }, 'AAABAAABBBCCBBCC')],
      layers: [
        [P(0, { A: 'k...k...k...k...' }, 'AAAAAAAAAAAAAAAA')],
        [P(2, { A: 'D.......d.......' }, 'AAAAAAAAAAAAAAAA')],
        [P(3, { A: '........D.......' }, '....AAAAAAAAAAAA')],
        [P(0, { A: '..k...k...k...k.' }, '........AAAAAAAA')],
      ],
    },
  },
  {
    id: 'doko-don', name: 'Doko Don', bpm: 88, steps: 16, bars: 16, level: 2, player: [1],
    blurb: 'The classic doko pairs: two quick hits, then a don. Syncopation starts here.',
    parts: {
      player: [P(1, { A: 'D..dD..dD..dD...', B: 'D..DK..DD..DK...', C: 'DdDdK.K.DdDdK.K.' }, 'AABAAABAABCBAABC')],
      layers: [
        [P(0, { A: 'K.k.K.k.K.k.K.k.' }, 'AAAAAAAAAAAAAAAA')],
        [P(2, { A: 'D.......D.....d.' }, 'AAAAAAAAAAAAAAAA')],
        [P(3, { A: 'D...............' }, 'AAAAAAAAAAAAAAAA')],
        [P(4, { A: '....K.......K.k.' }, '....AAAAAAAAAAAA')],
      ],
    },
  },
  {
    id: 'rolling-waves', name: 'Rolling Waves', bpm: 96, steps: 12, bars: 16, level: 3, player: [2, 1],
    blurb: 'A rocking twelve-step feel with two drums. Think swing, not march.',
    parts: {
      player: [
        P(2, { A: 'D..d..D..d..', B: 'D..d.dD..d.d', C: 'D.....D..d.d' }, 'AABAAABAABCBAABC'),
        P(1, { A: '...K.d...K.d', B: '...K..K..K..', C: '..dK.d..dK.d' }, '....AAAB....AABC'),
      ],
      layers: [
        [P(0, { A: 'k.kk.kk.kk.k' }, 'AAAAAAAAAAAAAAAA')],
        [P(3, { A: 'D...........' }, 'AAAAAAAAAAAAAAAA')],
        [P(0, { A: 'K..k..K..k..' }, '....AAAAAAAAAAAA')],
        [P(3, { A: '......D.....' }, '........AAAAAAAA')],
      ],
    },
  },
  {
    id: 'festival-run', name: 'Festival Run', bpm: 104, steps: 16, bars: 16, level: 3, player: [0, 1],
    blurb: 'Quick and bright. The small drum and the mid drum trade phrases.',
    parts: {
      player: [
        P(0, { A: 'K.K.K.K.K.K.K.K.', B: 'K.kkK.kkK.kkK.K.', C: 'KkKkKkKkK...K...' }, 'AABAAABAABCBAABC'),
        P(1, { A: 'D.......D.......', B: 'D...D...D..dD...', C: 'D.dDD.dDD...D...' }, 'AAAAAABAAAABAABC'),
      ],
      layers: [
        [P(2, { A: 'D...D...D...D...' }, 'AAAAAAAAAAAAAAAA')],
        [P(3, { A: 'D.......D...D...' }, 'AAAAAAAAAAAAAAAA')],
        [P(4, { A: '..k...k...k...k.' }, '....AAAAAAAAAAAA')],
        [P(3, { A: '....D.......D.d.' }, '........AAAAAAAA')],
      ],
    },
  },
  {
    id: 'thunder-circle', name: 'Thunder Circle', bpm: 112, steps: 16, bars: 20, level: 4, player: [1, 2, 3],
    blurb: 'Three drums, big accents, rolling fills. Keep your hands relaxed.',
    parts: {
      player: [
        P(1, { A: 'D..dD..dD..dD...', B: 'D.dDK.K.D.dDK...', C: 'DdDdDdDdK.K.K.K.' }, 'AABAAABAAABCBABCBCCC'),
        P(2, { A: '....D.......D...', B: '....D...K...D.K.', C: 'D...D...D...D...' }, '....AAAB....AAAB....'),
        P(3, { A: 'D...............', B: 'D.......D.......', C: 'D...D...D...D.D.' }, 'AAAAAAAAAABBBBBBCCCC'),
      ],
      layers: [
        [P(0, { A: 'k.k.k.k.k.k.k.k.' }, 'AAAAAAAAAAAAAAAAAAAA')],
        [P(0, { A: 'K...k...K...k.k.' }, 'AAAAAAAAAAAAAAAAAAAA')],
        [P(4, { A: 'K...k...K...k.k.' }, '....AAAAAAAAAAAAAAAA')],
        [P(0, { A: 'KkKkKkKk........' }, '..............AAAAAA')],
      ],
    },
  },
  {
    id: 'four-winds', name: 'Four Winds', bpm: 120, steps: 16, bars: 24, level: 5, player: [0, 1, 2, 3],
    blurb: 'The whole circle at once. Four drums, both hands, no passengers.',
    parts: {
      player: [
        P(0, { A: 'k.k.k.k.k.k.k.k.', B: 'K.k.K.kkK.k.K.K.' }, 'ABABABAB........ABABBBAB'),
        P(1, { A: 'D..dD..dD..dD...', B: 'D.dDK.K.D.dDK.K.', C: 'DdDdDdDdK.K.K.K.' }, 'AAAB....AABA....AABBAABC'),
        P(2, { A: '....D.......D...', B: '....D...K...D.K.' }, '........AABAAABA....ABAB'),
        P(3, { A: 'D...............', B: 'D.......D...D...' }, '................AAABAAAB'),
      ],
      layers: [
        [P(4, { A: 'K...k...K...k...' }, 'AAAAAAAAAAAAAAAAAAAAAAAA')],
        [P(2, { A: 'D.......D...d...' }, 'AAAAAAAA................'), P(0, { A: 'k.k.k.k.k.k.k.k.' }, '........AAAAAAAA........'), P(4, { A: 'k.k.k.k.k.k.k.k.' }, '................AAAAAAAA')],
        [P(3, { A: 'D.......D.......' }, 'AAAAAAAAAAAAAAAA........'), P(4, { A: '..k...k...k...k.' }, '................AAAAAAAA')],
        [P(3, { A: 'D...D...D...D.D.' }, '........AAAAAAAA........'), P(2, { A: '..d...d...d...d.' }, '....AAAA................'), P(4, { A: 'KkKkKkKkKkKkKkKk' }, '..............AAAAAAAAAA')],
      ],
    },
  },
];

const clean = (s) => s.replace(/\s+/g, '');

// ---- timing ---------------------------------------------------------------------------------------------------------
export const beatDur = (piece, speed = 1) => 60 / (piece.bpm * speed);
export const barDur = (piece, speed = 1) => 4 * beatDur(piece, speed);
export const stepDur = (piece, speed = 1) => barDur(piece, speed) / piece.steps;

// Expand a part into hits: [{ bar, step, k: 'D'|'K', soft }].
function partHits(part, piece, b0, b1) {
  const out = [];
  for (let b = b0; b < b1; b++) {
    const ch = part.form[b] ?? '.';
    if (ch === '.' || ch === '-') continue;
    const pat = clean(part.pat[ch] ?? '');
    for (let st = 0; st < pat.length && st < piece.steps; st++) {
      const c = pat[st];
      if (c === '.') continue;
      out.push({ bar: b, step: st, k: c === 'D' || c === 'd' ? 'D' : 'K', soft: c === 'd' || c === 'k' });
    }
  }
  return out;
}

// How many notes the player part has in bars [b0, b1).
export const playerNoteCount = (piece, b0 = 0, b1 = piece.bars) => piece.parts.player.reduce((n, p) => n + partHits(p, piece, b0, b1).length, 0);

// buildRun: lays a list of segments end to end on the song clock starting at T0.
//   segments: [{ kind: 'count' | 'listen' | 'echo' | 'play' | 'auto', b0, b1 }]   (count = one bar of clicks, b0/b1 ignored)
//   opts: { click: bool, speed: 1 | 0.75, layersFrom: 0..3 (which layers are written into the run; the game switches them on by its level) }
// Events: { t, drum, k, soft, who, layer, seg, id } with who = 'note' (the player must hit it), 'teach' (the teacher plays the player's part),
// 'ens' (ensemble layer), 'click' (metronome; drum = -1, k = 'accent' | 'beat').
export function buildRun(piece, segments, T0 = 0, opts = {}) {
  const speed = opts.speed ?? 1, bd = barDur(piece, speed), sd = stepDur(piece, speed), events = [], bars = [];
  let t = T0, id = 0;
  segments.forEach((seg, si) => {
    const nBars = seg.kind === 'count' ? 1 : seg.b1 - seg.b0;
    const t0 = t;
    for (let i = 0; i < nBars; i++) {
      const bar = seg.kind === 'count' ? -1 : seg.b0 + i, tb = t0 + i * bd;
      bars.push({ t0: tb, t1: tb + bd, bar, kind: seg.kind, seg: si });
      if (seg.kind === 'count' || opts.click || seg.kind === 'echo' && opts.clickInEcho) {
        for (let b = 0; b < 4; b++) events.push({ t: tb + b * bd / 4, drum: -1, k: b === 0 ? 'accent' : 'beat', soft: false, who: 'click', layer: -1, seg: si, cnt: seg.kind === 'count', id: id++ });
      }
    }
    if (seg.kind !== 'count') {
      const place = (h, who, layer, drum) => events.push({ t: t0 + (h.bar - seg.b0) * bd + h.step * sd, drum, k: h.k, soft: h.soft, who, layer, seg: si, id: id++ });
      const playerWho = seg.kind === 'echo' || seg.kind === 'play' ? 'note' : seg.kind === 'listen' || seg.kind === 'auto' ? 'teach' : null;
      for (const part of piece.parts.player) for (const h of partHits(part, piece, seg.b0, seg.b1)) place(h, playerWho, 4, part.drum);
      // Ensemble: the base groove in every playing segment, the upper layers only where the game wants the whole circle.
      const upto = seg.kind === 'play' || seg.kind === 'auto' ? 3 : 0;
      piece.parts.layers.forEach((layer, li) => {
        if (li > upto) return;
        for (const part of layer) for (const h of partHits(part, piece, seg.b0, seg.b1)) place(h, 'ens', li, part.drum);
      });
    }
    t = t0 + nBars * bd;
  });
  events.sort((a, b) => a.t - b.t || a.id - b.id);
  const notes = events.filter((e) => e.who === 'note');
  return { events, notes, bars, T0, end: t, speed, beatDur: bd / 4, barDur: bd, stepDur: sd };
}

// Free-play metronome / echo helpers are in game.js; the calibration pulse uses beats only.
export const PIECE_BY_ID = Object.fromEntries(PIECES.map((p) => [p.id, p]));

// Player drums used in a piece, as a sorted list.
export const lanesOf = (piece) => [...piece.player].sort((a, b) => a - b);

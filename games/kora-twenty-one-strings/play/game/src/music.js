// Kora: the instrument, the music and the rule constants. Pure data + pure functions (no clock, no randomness).
// The Rules page prints these same constants, so the text cannot drift from the engine.
//
// THE INSTRUMENT. A kora has 21 strings in two rows over a calabash. The scale alternates between the hands: the strings are numbered
// 0..20 from the lowest note up; even numbers are the LEFT row (11 strings), odd numbers the RIGHT row (10 strings). The tuning here is a
// seven-note scale with a raised fourth, (G A B C# D E F#) over three octaves from G2, and every piece uses only its five-note core
// (G A B D E), so any two strings sound well together.
//
// NOTATION (one character per step, `steps` characters per bar; spaces are ignored):
//   1-9 = pluck the n-th string of the part's table     a-i = the same, played softly     . = rest
// A bar is 4 beats. steps = 16 (sixteenth notes) or 12 (triplet feel, three steps per beat).

export const STRING_COUNT = 21;
export const ROOT_MIDI = 43;                                                       // G2
const SCALE = [0, 2, 4, 6, 7, 9, 11];
const NAMES = ['G', 'A', 'B', 'C#', 'D', 'E', 'F#'];
export const stringMidi = (i) => ROOT_MIDI + 12 * Math.floor(i / 7) + SCALE[i % 7];
export const stringFreq = (i) => 440 * Math.pow(2, (stringMidi(i) - 69) / 12);
export const stringName = (i) => NAMES[i % 7];
export const stringFull = (i) => NAMES[i % 7] + (Math.floor(stringMidi(i) / 12) - 1);
export const handOf = (i) => (i % 2 === 0 ? 'L' : 'R');                              // L = left row, R = right row
export const fingerOf = (i) => (i <= 9 ? 'thumb' : 'index');                         // thumbs play the lower strings of each row, index fingers the upper ones
export const FINGER_NAMES = ['Left thumb', 'Left index', 'Right thumb', 'Right index'];
export const fingerId = (i) => (i % 2) * 2 + (i <= 9 ? 0 : 1);                        // 0 L thumb, 1 L index, 2 R thumb, 3 R index

// ---- judging and scoring (all read by the Rules page) -------------------------------------------------------------
export const JUDGE = { perfect: 0.05, great: 0.09, good: 0.14 };          // seconds either side of the note, at the "Normal" timing setting
export const TIMING = [{ id: 'relaxed', name: 'Relaxed', k: 1.4 }, { id: 'normal', name: 'Normal', k: 1 }, { id: 'tight', name: 'Tight', k: 0.8 }];
export const SPEEDS = [{ id: 'slow', name: 'Slow', approach: 2.4 }, { id: 'normal', name: 'Normal', approach: 1.9 }, { id: 'fast', name: 'Fast', approach: 1.5 }];
export const SCORE = { perfect: 300, great: 200, good: 100, comboStep: 10, comboMax: 4 };       // multiplier = 1 + floor(combo / 10), at most 4
export const WEIGHT = { perfect: 1, great: 0.85, good: 0.6, miss: 0 };                          // accuracy credit per note
export const STARS = [0.55, 0.75, 0.9];                                                         // accuracy for 1, 2, 3 stars
export const ENSEMBLE = { every: 8, start: 1, max: 3 };                                        // +1 accompaniment layer per 8 clean plucks in a row; a miss takes one away
export const LEARN = { pass: 0.5, tries: 2 };
export const LOOKAHEAD = 0.12;                                                                  // seconds: how far ahead the accompaniment is handed to the audio clock
export const GRADES = [['S', 0.95], ['A', 0.85], ['B', 0.7], ['C', 0.5], ['D', 0]];

export const accuracyToStars = (a) => (a >= STARS[2] ? 3 : a >= STARS[1] ? 2 : a >= STARS[0] ? 1 : 0);
export const gradeOf = (a) => GRADES.find((g) => a >= g[1])[0];
export const comboMult = (combo) => Math.min(SCORE.comboMax, 1 + Math.floor(combo / SCORE.comboStep));

// ---- the six pieces -----------------------------------------------------------------------------------------------
// lanes: the strings the player plays (string numbers, low to high); the player parts index into them (digit 1 = the first lane).
// parts.player: [{ pat: {A, B, ...}, form }]  one letter per bar ('.' = silent bar).
// parts.layers: layer 0 = the base accompaniment (always on), layers 1-3 join as the player plays cleanly.
//   An accompaniment part is { S: [string numbers], pat, form } and its digits index into S.
// why: four short captions for Watch and Learn, shown in turn across the piece (what the hands are doing and why).
const P = (pat, form) => ({ pat, form });
const Q = (S, pat, form) => ({ S, pat, form });

export const PIECES = [
  {
    id: 'first-thumbs', name: 'First Thumbs', bpm: 72, steps: 16, bars: 16, level: 1, lanes: [4, 7, 9],
    blurb: 'Three strings, steady beats. The left thumb keeps the low string going while the right hand answers.',
    roles: 'Low string: the steady pulse. High strings: the tune on top.',
    why: ['The left thumb plays the low string like a heartbeat: it keeps the pattern steady so the rest can float above it.', 'The right hand answers on the higher strings. Bass and tune take turns, like two voices talking.', 'The pattern repeats. A kora player repeats a short pattern on purpose, so the listener can settle into it.', 'Now the tune adds a little pair of quick notes. The pulse underneath has not moved.'],
    parts: {
      player: [P({ A: '1...2...1...2...', B: '1...2...1.3.2...', C: '1.2.3.2.1.2.3.2.' }, 'AAABAAABAABCAABC')],
      layers: [
        [Q([0, 7], { A: '1.......2.......' }, 'AAAAAAAAAAAAAAAA')],
        [Q([11, 12], { A: '....1.......2...' }, '....AAAAAAAAAAAA')],
        [Q([14, 16], { A: '1.......2...1...' }, '........AAAAAAAA')],
        [Q([18, 19, 16], { A: 'a.b.c.b.a.b.c.b.' }, '............AAAA')],
      ],
    },
  },
  {
    id: 'courtyard-evening', name: 'Courtyard Evening', bpm: 84, steps: 16, bars: 16, level: 2, lanes: [5, 8, 9, 12],
    blurb: 'A rocking three-three-two pattern that sounds like the end of a warm day.',
    roles: 'Lower strings: the rocking pattern. Upper strings: the sing-along tune.',
    why: ['The pattern is grouped 3 + 3 + 2: three steps, three steps, two steps. That gentle lopsidedness is what makes the music rock.', 'Both thumbs share the work. Each hand plays every second string of the scale, so the tune zigzags between them.', 'The accompaniment adds higher strings. They are quiet on purpose, like voices at the edge of a courtyard.', 'Keep the rocking even. Listen for the note that comes back at the start of every bar.'],
    parts: {
      player: [P({ A: '1..2..3.1..2..3.', B: '1..2..3.4..2..3.', C: '1.2.3.4.3.2.1.4.' }, 'AABAAABAABCBAABC')],
      layers: [
        [Q([0, 4, 7], { A: '1.......2...3...' }, 'AAAAAAAAAAAAAAAA')],
        [Q([11, 14], { A: '..1...2...1...2.' }, '....AAAAAAAAAAAA')],
        [Q([16, 18], { A: '1.......2.......' }, '........AAAAAAAA')],
        [Q([7, 11, 14, 16], { A: 'a.b.c.d.c.b.a.b.' }, '............AAAA')],
      ],
    },
  },
  {
    id: 'moon-on-the-river', name: 'Moon on the River', bpm: 92, steps: 12, bars: 16, level: 3, lanes: [4, 7, 9, 11, 12],
    blurb: 'A flowing twelve-step bar. Two beats against three: swing, not march.',
    roles: 'Bass strings: the flow. Upper strings: the ripples on top.',
    why: ['Each bar has twelve steps. The bass falls on the four big beats, while the tune moves in twos. Two against three is the heart of this piece.', 'The right hand plays pairs of quick notes that ripple over the beat. Do not rush them.', 'The left thumb keeps the beat steady even when the tune gets busy. That steadiness lets the tune stretch.', 'The ripples settle, and the bass takes the lead again.'],
    parts: {
      player: [P({ A: '1..2..3..2..', B: '1.2.3.1.2.3.', C: '1..2.3.4.5.4' }, 'AABAAABAABCBAABC')],
      layers: [
        [Q([0, 4], { A: '1.....2.....' }, 'AAAAAAAAAAAAAAAA')],
        [Q([14, 16, 18], { A: '..1...2...3.' }, '....AAAAAAAAAAAA')],
        [Q([8, 11], { A: 'a.....b.....' }, '........AAAAAAAA')],
        [Q([19, 18, 16], { A: 'a.b.c.a.b.c.' }, '............AAAA')],
      ],
    },
  },
  {
    id: 'griots-greeting', name: 'Griot’s Greeting', bpm: 100, steps: 16, bars: 20, level: 3, lanes: [8, 9, 11, 12, 14],
    blurb: 'A tune that calls and answers itself, over a steady bass. Listen to the phrase, then play it back.',
    roles: 'The five upper strings sing the tune. The accompaniment keeps the bass going.',
    why: ['This is a call: three notes falling, one by one, then a breath. A griot often greets the audience this way, with a short, clear phrase.', 'The answer climbs back up. Call and answer: one phrase asks, the next replies.', 'The accompaniment keeps a steady bass below, so the tune has something solid to lean on.', 'The tune and the bass lock together on the first beat of each bar.'],
    parts: {
      player: [P({ A: '3.2.1...3.2.1...', B: '1.2.3.4.5...4.3.', C: '5..4..3.2..1..2.' }, 'AABAABCAAABCBABCBCCA')],
      layers: [
        [Q([0, 4, 7], { A: '1...2...3...2...' }, 'AAAAAAAAAAAAAAAAAAAA')],
        [Q([16, 18], { A: '....1.......2...' }, '....AAAAAAAAAAAAAAAA')],
        [Q([19, 14], { A: '1.....2.....1...' }, '........AAAAAAAAAAAA')],
        [Q([11, 12, 14, 16], { A: 'a.b.c.d.c.b.a.b.' }, '............AAAAAAAA')],
      ],
    },
  },
  {
    id: 'dancing-hands', name: 'Dancing Hands', bpm: 108, steps: 12, bars: 20, level: 4, lanes: [4, 5, 8, 9, 12],
    blurb: 'Quick runs that hop from hand to hand. Five strings, bright and busy.',
    roles: 'All five strings are in play; the hands take turns, so the run never stops.',
    why: ['The run goes up and down the scale. Because the hands take turns, each one only plays every second note, which keeps the pace easy to hold.', 'Quick pairs of notes sit on the off-beat. This is the lively, dancing part of the piece.', 'The run turns around and comes back down. Follow the string names to see the shape.', 'Same run, but now the accompaniment is at full strength. Listen for how the layers lock in.'],
    parts: {
      player: [P({ A: '1.2.3.4.5.4.', B: '1.23.45.43.2', C: '5.4.3.2.1.23' }, 'AABAABCAABAABCBCAABC')],
      layers: [
        [Q([0, 4], { A: '1..2..1..2..' }, 'AAAAAAAAAAAAAAAAAAAA')],
        [Q([14, 15, 16], { A: '..1...2...3.' }, '....AAAAAAAAAAAAAAAA')],
        [Q([7, 11], { A: 'a.b.a.b.a.b.' }, '........AAAAAAAAAAAA')],
        [Q([19, 18, 16, 14], { A: 'a.b.c.d.c.b.' }, '..........AAAAAAAAAA')],
      ],
    },
  },
  {
    id: 'twenty-one-strings', name: 'Twenty-One Strings', bpm: 116, steps: 16, bars: 24, level: 5, lanes: [4, 5, 8, 9, 11, 12],
    blurb: 'The full performance: the left hand keeps the bass pattern, the right plays the tune on top, both at once.',
    roles: 'Three low strings: the bass pattern (kumbengo). Three upper strings: the melody on top (birimintingo).',
    why: ['A kora player does two jobs at once. The low strings repeat a bass pattern, called kumbengo. It never changes for long stretches.', 'Over it, the upper strings play the melody, called birimintingo. The tune can stretch and change, because the bass holds everything together.', 'Notice that each hand plays a mix of low and high strings. The thumbs take the lower strings and the index fingers take the upper ones.', 'The tune and the bass finish together, back on the starting pattern.'],
    parts: {
      player: [
        P({ A: '1...2...3...2...', B: '1.2.1.2.3.2.3.2.' }, 'AAAAAAAABBBBAAAABBBBAAAA'),
        P({ A: '....4.5.6...5.4.', B: '6.5.4.5.6.6.5.4.', C: '4.5.6.5.4...6...' }, '........AABAABAACBAABCBC'),
      ],
      layers: [
        [Q([0, 7], { A: '1.......2.......' }, 'AAAAAAAAAAAAAAAAAAAAAAAA')],
        [Q([14, 16], { A: '..1...2...1...2.' }, '....AAAAAAAAAAAAAAAAAAAA')],
        [Q([18, 19], { A: 'a...b...a...b...' }, '........AAAAAAAAAAAAAAAA')],
        [Q([16, 14, 11], { A: 'a.b.c.b.a.b.c.b.' }, '................AAAAAAAA')],
      ],
    },
  },
];

const clean = (s) => s.replace(/\s+/g, '');

// ---- timing ---------------------------------------------------------------------------------------------------------
export const beatDur = (piece, speed = 1) => 60 / (piece.bpm * speed);
export const barDur = (piece, speed = 1) => 4 * beatDur(piece, speed);
export const stepDur = (piece, speed = 1) => barDur(piece, speed) / piece.steps;

// Expand a part into plucks: [{ bar, step, slot, soft }]. `slot` is the 0-based index into the part's string table.
function partHits(part, piece, b0, b1) {
  const out = [];
  for (let b = b0; b < b1; b++) {
    const ch = part.form[b] ?? '.';
    if (ch === '.' || ch === '-') continue;
    const pat = clean(part.pat[ch] ?? '');
    for (let st = 0; st < pat.length && st < piece.steps; st++) {
      const c = pat[st];
      if (c === '.') continue;
      const soft = c >= 'a' && c <= 'i';
      const slot = soft ? c.charCodeAt(0) - 97 : c.charCodeAt(0) - 49;
      out.push({ bar: b, step: st, slot, soft });
    }
  }
  return out;
}

// How many notes the player part has in bars [b0, b1).
export const playerNoteCount = (piece, b0 = 0, b1 = piece.bars) => piece.parts.player.reduce((n, p) => n + partHits(p, piece, b0, b1).length, 0);

// buildRun: lays a list of segments end to end on the song clock starting at T0.
//   segments: [{ kind: 'count' | 'listen' | 'echo' | 'play' | 'auto', b0, b1 }]   (count = one bar of clicks, b0/b1 ignored)
//   opts: { click: bool, speed: 1 | 0.75 }
// Events: { t, str, lane, soft, who, layer, seg, id } with str = string number 0..20 (-1 for the metronome), lane = index into piece.lanes (or -1),
// who = 'note' (the player must pluck it), 'teach' (the teacher plays the player's part), 'ens' (accompaniment layer), 'click' (metronome).
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
        for (let b = 0; b < 4; b++) events.push({ t: tb + b * bd / 4, str: -1, lane: -1, soft: false, who: 'click', accent: b === 0, layer: -1, seg: si, cnt: seg.kind === 'count', id: id++ });
      }
    }
    if (seg.kind !== 'count') {
      const place = (h, who, layer, str) => events.push({ t: t0 + (h.bar - seg.b0) * bd + h.step * sd, str, lane: piece.lanes.indexOf(str), soft: h.soft, who, layer, seg: si, id: id++ });
      const playerWho = seg.kind === 'echo' || seg.kind === 'play' ? 'note' : seg.kind === 'listen' || seg.kind === 'auto' ? 'teach' : null;
      for (const part of piece.parts.player) for (const h of partHits(part, piece, seg.b0, seg.b1)) place(h, playerWho, 4, piece.lanes[h.slot]);
      // Accompaniment: the base layer in every playing segment, the upper layers only where the game wants the whole ensemble.
      const upto = seg.kind === 'play' || seg.kind === 'auto' ? 3 : 0;
      piece.parts.layers.forEach((layer, li) => {
        if (li > upto) return;
        for (const part of layer) for (const h of partHits(part, piece, seg.b0, seg.b1)) place(h, 'ens', li, part.S[h.slot]);
      });
    }
    t = t0 + nBars * bd;
  });
  events.sort((a, b) => a.t - b.t || a.id - b.id);
  const notes = events.filter((e) => e.who === 'note');
  return { events, notes, bars, T0, end: t, speed, beatDur: bd / 4, barDur: bd, stepDur: sd };
}

export const PIECE_BY_ID = Object.fromEntries(PIECES.map((p) => [p.id, p]));

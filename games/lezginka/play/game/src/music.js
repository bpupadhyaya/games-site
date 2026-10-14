// Lezginka: the dances and the rule constants. Pure data + pure functions (no clock, no randomness).
// The Rules page prints these same constants, so the text cannot drift from the engine.
//
// Notation. A bar has 4 beats. A pattern is four space-separated tokens, one per beat; the characters of a token share its beat evenly
// ("L." = two eighths, "L.R" = a triplet). "." is a rest.
//   dancer steps:  L left stomp   R right stomp   A arms lift   S spin
//   drum voices:   D low drum (dum)   T rim (tek)   t soft rim   C hand clap   B bass note   b fifth below
//   melody:        1-9 notes of the accordion tune (1 = tonic ... 8 = tonic an octave up)

export const PADS = [
  { id: 'L', name: 'Left stomp', short: 'Left', blurb: 'The left boot stamps the floor.', key: 'KeyA' },
  { id: 'R', name: 'Right stomp', short: 'Right', blurb: 'The right boot stamps the floor.', key: 'KeyD' },
  { id: 'A', name: 'Arms lift', short: 'Arms', blurb: 'Both arms sweep up and out like wings.', key: 'KeyW' },
  { id: 'S', name: 'Spin', short: 'Spin', blurb: 'A quick turn on the toes.', key: 'KeyS' },
];
export const PAD_ID = { L: 0, R: 1, A: 2, S: 3 };
export const PAD_KEYS = { ArrowLeft: 0, KeyA: 0, ArrowRight: 1, KeyD: 1, ArrowUp: 2, KeyW: 2, ArrowDown: 3, KeyS: 3 };

// ---- judging and scoring (all read by the Rules page) -------------------------------------------------------------
export const JUDGE = { perfect: 0.055, great: 0.1, good: 0.15 };            // seconds either side of the beat, at the "Normal" timing setting
export const TIMING = [{ id: 'relaxed', name: 'Relaxed', k: 1.4 }, { id: 'normal', name: 'Normal', k: 1 }, { id: 'tight', name: 'Tight', k: 0.8 }];
export const SPEEDS = [{ id: 'slow', name: 'Slow', approach: 1.7 }, { id: 'normal', name: 'Normal', approach: 1.35 }, { id: 'fast', name: 'Fast', approach: 1.05 }];
export const SCORE = { perfect: 300, great: 200, good: 100, off: 40, comboStep: 10, comboMax: 4 };   // multiplier = 1 + floor(combo / 10), at most 4
export const WEIGHT = { perfect: 1, great: 0.85, good: 0.6, off: 0.4, miss: 0 };                    // accuracy credit per step
export const STARS = [0.55, 0.75, 0.9];                                                             // accuracy for 1, 2, 3 stars
export const FLOOR = { every: 8, start: 1, max: 3 };                                                // +1 dancer group per 8 clean steps in a row; a miss sends one away
export const LEARN = { pass: 0.5, tries: 2 };
export const LOOKAHEAD = 0.12;                                                                      // seconds: how far ahead the band is handed to the audio clock
export const GRADES = [['S', 0.95], ['A', 0.85], ['B', 0.7], ['C', 0.5], ['D', 0]];

export const accuracyToStars = (a) => (a >= STARS[2] ? 3 : a >= STARS[1] ? 2 : a >= STARS[0] ? 1 : 0);
export const gradeOf = (a) => GRADES.find((g) => a >= g[1])[0];
export const comboMult = (combo) => Math.min(SCORE.comboMax, 1 + Math.floor(combo / SCORE.comboStep));

// Accordion tune: the semitones above the tonic (a D-phrygian-dominant scale: a flat second and a major third, the sound of the region).
export const SCALE = [0, 1, 4, 5, 7, 8, 10, 12, 13];
export const TONIC_HZ = 146.83;                                             // D3

// ---- the five dances --------------------------------------------------------------------------------------------
// figures: named one-bar step patterns. form: one figure key per bar ('.' = the bar is a rest for the player).
// band: the four layers. layer 0 is always on; layers 1-3 join as the floor fills. Each part: { pat: {A, B..}, form }.
const rep = (s, n) => s.repeat(n);
const parts = (pats, form) => ({ pat: pats, form });

export const PIECES = [
  {
    id: 'first-steps', name: 'First Steps', bpm: 92, ramp: 0.1, bars: 16, level: 1, pads: [0, 1, 2],
    blurb: 'Two boots and a lift. Stomp left, stomp right, and raise the arms.',
    figures: {
      a: { name: 'Toe Walk', pat: 'L. R. L. R.' },
      b: { name: 'Eagle Lift', pat: 'L. R. A. ..' },
      c: { name: 'Quick Change', pat: 'L. R. LR A.' },
    },
    form: 'aabaaabaabcaabcb',
    band: [
      [parts({ A: 'D. T. D. t.' }, rep('A', 16)), parts({ A: 'B. .. b. ..' }, rep('A', 16))],
      [parts({ A: '1. 12 3. 2.', B: '4. 43 2. 1.' }, 'AB'.repeat(8))],
      [parts({ A: '.C .C .C .C' }, rep('A', 16))],
      [parts({ A: '5. 54 3. 4.', B: '8. 76 5. 3.' }, '....' + 'AB'.repeat(6)), parts({ A: 'D. D. D. D.' }, rep('A', 16))],
    ],
  },
  {
    id: 'eagle-wings', name: 'Eagle Wings', bpm: 100, ramp: 0.12, bars: 16, level: 2, pads: [0, 1, 2],
    blurb: 'Arms rise on the big beats and the feet answer in between.',
    figures: {
      a: { name: 'Wings Wide', pat: 'A. .. A. ..' },
      b: { name: 'Swoop', pat: 'L. A. R. A.' },
      c: { name: 'Glide', pat: 'A. L. R. ..' },
      d: { name: 'Soar', pat: 'AL R. AR L.' },
    },
    form: 'abacabadabacbcdd',
    band: [
      [parts({ A: 'D. T. D. T.' }, rep('A', 16)), parts({ A: 'B. .. b. ..' }, rep('A', 16))],
      [parts({ A: '5. 5. 6. 5.', B: '4. 4. 3. 1.' }, 'AB'.repeat(8))],
      [parts({ A: '.C .C .C .C' }, rep('A', 16))],
      [parts({ A: '8. 8. 9. 8.', B: '7. 7. 6. 5.' }, '....' + 'AB'.repeat(6)), parts({ A: 'D. .. D. D.' }, rep('A', 16))],
    ],
  },
  {
    id: 'quick-feet', name: 'Quick Feet', bpm: 108, ramp: 0.16, bars: 16, level: 3, pads: [0, 1, 2],
    blurb: 'The footwork gets busy: patters, skips and a rattle of stomps.',
    figures: {
      a: { name: 'Patter', pat: 'LR LR LR LR' },
      b: { name: 'Skip Step', pat: 'L.R L.R L.R L.R' },
      c: { name: 'Stamp', pat: 'L. L. R. R.' },
      d: { name: 'Rattle', pat: 'LRL RLR LRL A..' },
    },
    form: 'cacbcacbaabdaabd',
    band: [
      [parts({ A: 'D. T. D. TT' }, rep('A', 16)), parts({ A: 'B. .. b. B.' }, rep('A', 16))],
      [parts({ A: '1. 12 3. 4.', B: '5. 54 3. 1.' }, 'AB'.repeat(8))],
      [parts({ A: '.C .C .C CC' }, rep('A', 16))],
      [parts({ A: '8. 87 6. 5.', B: '6. 65 4. 3.' }, '....' + 'AB'.repeat(6)), parts({ A: 'D. D. D. D.' }, rep('A', 16))],
    ],
  },
  {
    id: 'the-whirl', name: 'The Whirl', bpm: 96, ramp: 0.14, bars: 16, level: 4, pads: [0, 1, 2, 3],
    blurb: 'A rolling twelve-beat feel, and the first spins on the toes.',
    figures: {
      a: { name: 'Turn', pat: 'L.. R.. S.. ...' },
      b: { name: 'Spiral', pat: 'L.R A.. S.. ...' },
      c: { name: 'Double Turn', pat: 'S.. S.. L.R A..' },
      d: { name: 'Lift and Spin', pat: 'A.. L.. R.. S..' },
    },
    form: 'aabaaabcaabdaabc',
    band: [
      [parts({ A: 'D.. t.t T.. t.t' }, rep('A', 16)), parts({ A: 'B.. ... b.. ...' }, rep('A', 16))],
      [parts({ A: '1.. 123 4.. 3..', B: '5.. 543 2.. 1..' }, 'AB'.repeat(8))],
      [parts({ A: '..C ..C ..C ..C' }, rep('A', 16))],
      [parts({ A: '8.. 876 5.. 6..', B: '9.. 987 6.. 5..' }, '....' + 'AB'.repeat(6)), parts({ A: 'D.. D.. D.. D..' }, rep('A', 16))],
    ],
  },
  {
    id: 'wedding-floor', name: 'Wedding Floor', bpm: 100, ramp: 0.26, bars: 24, level: 5, pads: [0, 1, 2, 3],
    blurb: 'Everything at once, and the music speeds up all the way to the finish.',
    figures: {
      a: { name: 'Toe Walk', pat: 'L. R. L. R.' },
      b: { name: 'Swoop', pat: 'L. A. R. A.' },
      c: { name: 'Patter', pat: 'LR LR LR LR' },
      d: { name: 'Lift and Spin', pat: 'A. L. R. S.' },
      e: { name: 'Double Turn', pat: 'S. .. S. LR' },
      f: { name: 'Grand Finale', pat: 'LR AS LR AS' },
    },
    form: 'aabcaabdcdceabdcdecdefef',
    band: [
      [parts({ A: 'D. T. D. TT' }, rep('A', 24)), parts({ A: 'B. .. b. B.' }, rep('A', 24))],
      [parts({ A: '1. 12 3. 4.', B: '5. 54 3. 1.', C: '4. 43 2. 1.' }, 'ABAC'.repeat(6))],
      [parts({ A: '.C .C .C CC' }, rep('A', 24))],
      [parts({ A: '8. 87 6. 5.', B: '9. 98 7. 6.' }, '....' + 'AB'.repeat(10)), parts({ A: 'D. D. D. D.' }, rep('A', 24))],
    ],
  },
];

const clean = (s) => s.replace(/\s+/g, ' ').trim();

// ---- timing ---------------------------------------------------------------------------------------------------------
// The tempo climbs over a piece: bar b lasts 1 / (1 + ramp * b / (bars - 1)) of the opening bar.
export const beatBase = (piece, speed = 1) => 60 / (piece.bpm * speed);
export const rampK = (piece, bar) => 1 / (1 + piece.ramp * Math.max(0, Math.min(bar, piece.bars - 1)) / Math.max(1, piece.bars - 1));
export const barDurAt = (piece, bar, speed = 1) => 4 * beatBase(piece, speed) * rampK(piece, bar);
export const bpmAt = (piece, bar, speed = 1) => 60 / (beatBase(piece, speed) * rampK(piece, bar));

// Expand one bar of a pattern into [{ frac (0..4 beats), ch }].
function tokens(pat) {
  const out = [], toks = clean(pat).split(' ');
  toks.forEach((tk, beat) => {
    const n = tk.length;
    for (let i = 0; i < n; i++) if (tk[i] !== '.') out.push({ beats: beat + i / n, ch: tk[i], len: 1 / n });
  });
  return out;
}

// Player steps of a piece: [{ bar, beats, pad, fig }].
export function stepsOf(piece, b0 = 0, b1 = piece.bars) {
  const out = [];
  for (let b = b0; b < b1; b++) {
    const key = piece.form[b];
    const fig = piece.figures[key];
    if (!fig) continue;
    for (const h of tokens(fig.pat)) if (PAD_ID[h.ch] !== undefined) out.push({ bar: b, beats: h.beats, pad: PAD_ID[h.ch], fig: key });
  }
  return out;
}
export const stepCount = (piece, b0 = 0, b1 = piece.bars) => stepsOf(piece, b0, b1).length;
export const figureAt = (piece, bar) => piece.figures[piece.form[bar]] ?? null;

// buildRun: lays a list of segments end to end on the song clock starting at T0.
//   segments: [{ kind: 'count' | 'listen' | 'echo' | 'play' | 'auto', b0, b1 }]   (count = one bar of clicks, b0/b1 ignored)
//   opts: { click: bool, speed: 1 | 0.75 }
// Events: { t, who, pad, v, deg, dur, layer, seg, id, bar } with who = 'note' (the player must hit it), 'teach' (the teacher plays the
// player's part), 'band' (a band layer), 'click' (metronome; v = 'accent' | 'beat').
export function buildRun(piece, segments, T0 = 0, opts = {}) {
  const speed = opts.speed ?? 1, events = [], bars = [];
  let t = T0, id = 0;
  segments.forEach((seg, si) => {
    const count = seg.kind === 'count';
    const nBars = count ? 1 : seg.b1 - seg.b0;
    const t0 = t;
    const starts = [];                                                       // start time of each bar in this segment
    let tt = t0;
    for (let i = 0; i < nBars; i++) {
      const bar = count ? 0 : seg.b0 + i, bd = barDurAt(piece, bar, speed);
      starts.push({ t: tt, bd, bar });
      bars.push({ t0: tt, t1: tt + bd, bar: count ? -1 : bar, kind: seg.kind, seg: si });
      if (count || opts.click) for (let b = 0; b < 4; b++) events.push({ t: tt + b * bd / 4, who: 'click', v: b === 0 ? 'accent' : 'beat', cnt: count, layer: -1, seg: si, id: id++, bar: count ? -1 : bar });
      tt += bd;
    }
    if (!count) {
      const at = (barIdx, beats) => { const s = starts[barIdx]; return s.t + beats * s.bd / 4; };
      const playerWho = seg.kind === 'echo' || seg.kind === 'play' ? 'note' : 'teach';
      const mine = stepsOf(piece, seg.b0, seg.b1);
      for (const h of mine) events.push({ t: at(h.bar - seg.b0, h.beats), who: playerWho, pad: h.pad, v: PADS[h.pad].id, layer: 4, seg: si, id: id++, bar: h.bar, fig: h.fig });
      const upto = seg.kind === 'play' || seg.kind === 'auto' ? 3 : 0;
      piece.band.forEach((layer, li) => {
        if (li > upto) return;
        for (const part of layer) {
          for (let i = 0; i < nBars; i++) {
            const bar = seg.b0 + i, ch = part.form[bar] ?? '.';
            if (ch === '.' || !part.pat[ch]) continue;
            for (const h of tokens(part.pat[ch])) {
              const isDeg = h.ch >= '1' && h.ch <= '9';
              events.push({ t: at(i, h.beats), who: 'band', pad: -1, v: isDeg ? 'N' : h.ch, deg: isDeg ? Number(h.ch) : 0, dur: h.len * starts[i].bd / 4, layer: li, seg: si, id: id++, bar });
            }
          }
        }
      });
    }
    t = tt;
  });
  events.sort((a, b) => a.t - b.t || a.id - b.id);
  return { events, bars, T0, end: t, speed };
}

export const PIECE_BY_ID = Object.fromEntries(PIECES.map((p) => [p.id, p]));

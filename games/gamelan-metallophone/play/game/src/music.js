// Gamelan: the music and the rule constants. Pure data + pure functions (no clock, no randomness).
// The Rules page prints these same constants, so the text cannot drift from the engine.
//
// A piece is built from a BALUNGAN (the skeleton melody, one note per beat, written in the numerals of its tuning) and a CYCLE map
// (which beats the kethuk, kenong, kempul and gong sound on). Every part is derived from the balungan, so the pitches always agree.
// A bar is 4 beats = STEPS (8) eighth-note steps. A part is { inst, reg, style, on } where
//   inst   'bar' (a tuned bronze bar, its register chosen by `reg`) | 'kenong' | 'kempul' | 'gong' | 'kethuk'
//   reg    'lo' (slenthem) | 'mid' (saron, the playable row) | 'hi' (peking)           (bars only)
//   style  bal   one note on every beat                 half   beats 1 and 3 only
//          dbl   every beat struck twice (eighths)      nacah  on the beat, then the NEXT melody note early on the off-beat (softer)
//          off   the off-beat only (between the beats)  cycle  the colotomic instruments: only on their beats of the cycle
//   on     one char per bar: 'x' = the part plays that bar, '.' = silent

export const STEPS = 8;
export const REG = { lo: 0.5, mid: 1, hi: 2 };
const POT = { kenong: 0.5, kempul: 0.5, gong: 0.25 };                         // pitch of the colotomic instruments relative to the mid bars

// Typical interval sizes in cents above the first note. Real ensembles are each tuned differently; these are representative values.
export const TUNINGS = {
  slendro: { id: 'slendro', name: 'Slendro', n: 5, numerals: [1, 2, 3, 5, 6], cents: [0, 231, 474, 717, 955], base: 294 },
  pelog: { id: 'pelog', name: 'Pelog', n: 7, numerals: [1, 2, 3, 4, 5, 6, 7], cents: [0, 120, 258, 540, 675, 785, 943], base: 277 },
};
export const TUNING_LIST = [TUNINGS.slendro, TUNINGS.pelog];
export const noteFreq = (tuning, idx, mult = 1) => TUNINGS[tuning].base * Math.pow(2, TUNINGS[tuning].cents[idx] / 1200) * mult;
export const numeralOf = (tuning, idx) => TUNINGS[tuning].numerals[idx];
const idxOf = (tuning, ch) => TUNINGS[tuning].numerals.indexOf(Number(ch));

// Instrument ids. 0-6 are the bars of the middle row (degree index). The others are fixed.
export const I = { KENONG: 7, KEMPUL: 8, GONG: 9, KETHUK: 10, SLENTHEM: 11, PEKING: 12 };
export const INSTRUMENTS = [
  { id: 7, key: 'kenong', name: 'Kenong', short: 'Kenong', blurb: 'A squat bronze pot gong that sits on cords. It marks the quarters of the cycle with a clear, pitched note.' },
  { id: 8, key: 'kempul', name: 'Kempul', short: 'Kempul', blurb: 'A smaller hanging gong. Its warm note falls between the kenong strokes and leans the cycle towards the end.' },
  { id: 9, key: 'gong', name: 'Gong', short: 'Gong', blurb: 'The big hanging gong. One deep stroke closes the cycle, and the whole ensemble starts again from it.' },
  { id: 10, key: 'kethuk', name: 'Kethuk', short: 'Kethuk', blurb: 'A small flat pot that gives a dry tick, the pulse between the gongs. The ensemble plays it for you.' },
  { id: 11, key: 'slenthem', name: 'Slenthem', short: 'Slenthem', blurb: 'Low bars with a long, humming sustain. They carry the melody an octave down, more slowly.' },
  { id: 12, key: 'peking', name: 'Peking', short: 'Peking', blurb: 'High, small bars with a bright, quick ring. They double the melody and fill the gaps.' },
];
export const GONG_IDS = [7, 8, 9];                                              // the three gongs the player can take over

// ---- judging and scoring (all read by the Rules page) -------------------------------------------------------------
export const JUDGE = { perfect: 0.05, great: 0.09, good: 0.14 };               // seconds either side of the note, at the "Normal" timing setting
export const TIMING = [{ id: 'relaxed', name: 'Relaxed', k: 1.4 }, { id: 'normal', name: 'Normal', k: 1 }, { id: 'tight', name: 'Tight', k: 0.8 }];
export const SPEEDS = [{ id: 'slow', name: 'Slow', approach: 2.4 }, { id: 'normal', name: 'Normal', approach: 1.9 }, { id: 'fast', name: 'Fast', approach: 1.5 }];
export const SCORE = { perfect: 300, great: 200, good: 100, off: 40, comboStep: 10, comboMax: 4 };
export const WEIGHT = { perfect: 1, great: 0.85, good: 0.6, off: 0.4, miss: 0 };
export const STARS = [0.55, 0.75, 0.9];
export const ENSEMBLE = { every: 8, start: 1, max: 3 };
export const LEARN = { pass: 0.5, tries: 2 };
export const LOOKAHEAD = 0.12;
export const GRADES = [['S', 0.95], ['A', 0.85], ['B', 0.7], ['C', 0.5], ['D', 0]];
export const accuracyToStars = (a) => (a >= STARS[2] ? 3 : a >= STARS[1] ? 2 : a >= STARS[0] ? 1 : 0);
export const gradeOf = (a) => GRADES.find((g) => a >= g[1])[0];
export const comboMult = (combo) => Math.min(SCORE.comboMax, 1 + Math.floor(combo / SCORE.comboStep));

// ---- the cycles (beat numbers are 1-based inside the cycle) --------------------------------------------------------
export const CYCLES = {
  short: { id: 'short', beats: 8, kethuk: [2, 6], kenong: [4, 8], kempul: [6], gong: [8] },
  long: { id: 'long', beats: 16, kethuk: [2, 6, 10, 14], kenong: [4, 8, 12, 16], kempul: [6, 10, 14], gong: [16] },
};

// ---- the pieces ------------------------------------------------------------------------------------------------------------
const M = (s) => [...s.matchAll(/([x.])(\d+)/g)].map((m) => m[1].repeat(Number(m[2]))).join('');
const bar = (reg, style, on) => ({ inst: 'bar', reg, style, on: M(on) });
const colo = (inst, on) => ({ inst, reg: 'mid', style: 'cycle', on: M(on) });
const COLO_ALL = (n) => [colo('kethuk', `x${n}`), colo('kenong', `x${n}`), colo('kempul', `x${n}`), colo('gong', `x${n}`)];

export const PIECES = [
  {
    id: 'keep-the-cycle', name: 'Keep the Cycle', tuning: 'slendro', bpm: 72, level: 1, cycle: 'short', rack: 'colo',
    blurb: 'Take the kenong and the gong. Learn what keeps the whole ensemble together.',
    gongans: { A: '23565356', B: '56353536' }, form: 'AABAAABB',
    player: [colo('kenong', 'x16'), colo('gong', 'x16')],
    layers: [
      [bar('mid', 'bal', 'x16'), colo('kethuk', 'x16'), colo('kempul', 'x16')],
      [bar('lo', 'half', 'x16')],
      [bar('hi', 'dbl', '.4x12')],
      [bar('lo', 'bal', '.8x8')],
    ],
  },
  {
    id: 'first-balungan', name: 'First Balungan', tuning: 'slendro', bpm: 80, level: 1, cycle: 'short', rack: 'bars',
    blurb: 'Three bars and one note a beat: the skeleton of the melody.',
    gongans: { A: '12321232', B: '32123212' }, form: 'AABAABAB',
    player: [bar('mid', 'bal', 'x16')],
    layers: [
      COLO_ALL(16),
      [bar('lo', 'half', 'x16')],
      [bar('hi', 'dbl', '.4x12')],
      [bar('lo', 'bal', '.8x8')],
    ],
  },
  {
    id: 'walking-cycle', name: 'Walking Cycle', tuning: 'slendro', bpm: 88, level: 2, cycle: 'long', rack: 'bars',
    blurb: 'All five bars and a full sixteen-beat cycle. Some bars add an early note.',
    gongans: { A: '3235653235653236', B: '6563565365356536' }, form: 'ABAB',
    player: [bar('mid', 'bal', 'x4.4x4.4'), bar('mid', 'nacah', '.4x4.4x4')],
    layers: [
      COLO_ALL(16),
      [bar('lo', 'half', 'x16')],
      [bar('hi', 'dbl', '.4x12')],
      [bar('lo', 'bal', '.8x8')],
    ],
  },
  {
    id: 'pelog-evening', name: 'Pelog Evening', tuning: 'pelog', bpm: 84, level: 3, cycle: 'long', rack: 'bars',
    blurb: 'The second tuning, seven bars with uneven steps: a darker, sweeter colour.',
    gongans: { A: '5653235676532356', B: '3567653256732356' }, form: 'ABAB',
    player: [bar('mid', 'bal', 'x12'), bar('mid', 'dbl', '.12x4')],
    layers: [
      COLO_ALL(16),
      [bar('lo', 'half', 'x16')],
      [bar('hi', 'nacah', '.4x12')],
      [bar('lo', 'bal', '.8x8')],
    ],
  },
  {
    id: 'interlock', name: 'Interlock', tuning: 'pelog', bpm: 96, level: 4, cycle: 'long', rack: 'bars',
    blurb: 'The ensemble plays the beats. You play the gaps between them.',
    gongans: { A: '3567653256723566', B: '5653765635672356' }, form: 'ABAB',
    player: [bar('mid', 'off', 'x16')],
    layers: [
      [...COLO_ALL(16), bar('mid', 'bal', 'x16')],
      [bar('lo', 'half', 'x16')],
      [bar('hi', 'dbl', '.4x12')],
      [bar('lo', 'bal', '.8x8')],
    ],
  },
  {
    id: 'whole-gamelan', name: 'The Whole Gamelan', tuning: 'slendro', bpm: 100, level: 5, cycle: 'long', rack: 'bars',
    blurb: 'Six cycles, five bars, every layer. Melody, early notes and doubled notes.',
    gongans: { A: '3235653235653236', B: '6563565365356536', C: '5356323565356526' }, form: 'AABACA',
    player: [bar('mid', 'bal', 'x8.16'), bar('mid', 'nacah', '.8x8.8'), bar('mid', 'dbl', '.16x8')],
    layers: [
      COLO_ALL(24),
      [bar('lo', 'half', 'x24')],
      [bar('hi', 'dbl', '.4x20')],
      [bar('lo', 'bal', '.8x16')],
    ],
  },
];
for (const p of PIECES) {
  p.bal = p.form.split('').map((c) => p.gongans[c]).join('');
  p.bars = p.bal.length / 4;
  p.cyc = CYCLES[p.cycle];
  p.steps = STEPS;
  p.tun = TUNINGS[p.tuning];
}
export const PIECE_BY_ID = Object.fromEntries(PIECES.map((p) => [p.id, p]));

// ---- timing ---------------------------------------------------------------------------------------------------------------
export const beatDur = (piece, speed = 1) => 60 / (piece.bpm * speed);
export const barDur = (piece, speed = 1) => 4 * beatDur(piece, speed);
export const stepDur = (piece, speed = 1) => barDur(piece, speed) / STEPS;
export const cycleBeat = (piece, absBeat) => ((absBeat % piece.cyc.beats) + piece.cyc.beats) % piece.cyc.beats;   // 0-based position in the cycle

const balIdx = (piece, gb) => (gb >= 0 && gb < piece.bal.length ? idxOf(piece.tuning, piece.bal[gb]) : idxOf(piece.tuning, piece.bal[piece.bal.length - 1]));
const REGINST = { lo: I.SLENTHEM, mid: -1, hi: I.PEKING };

// One expanded event of a part: { bar, step, inst, kind, idx, f, soft, why }.
function why(piece, part, gb, step, idx) {
  const num = numeralOf(piece.tuning, idx), pos = cycleBeat(piece, gb) + 1, prev = gb > 0 ? balIdx(piece, gb - 1) : idx;
  if (part.inst === 'gong') return 'Gong: closes the cycle. Everything starts again from here.';
  if (part.inst === 'kenong') return `Kenong: beat ${pos} marks a quarter of the cycle.`;
  if (part.inst === 'kempul') return `Kempul: beat ${pos} leans the cycle towards the gong.`;
  if (part.inst === 'kethuk') return 'Kethuk: a dry tick for the pulse.';
  if (part.style === 'off') return `Off-beat ${num}: you fill the gap between the ensemble's beats.`;
  if (part.style === 'nacah' && step % 2 === 1) return `Early ${num}: the next melody note is struck a half beat ahead.`;
  if (part.style === 'dbl' && step % 2 === 1) return `${num} again: doubling the melody note.`;
  const d = idx - prev;
  const move = d === 0 ? `${num} again: the melody repeats` : d === 1 ? `Step up to ${num}` : d === -1 ? `Step down to ${num}` : d > 0 ? `Leap up to ${num}` : `Leap down to ${num}`;
  return pos === piece.cyc.beats ? `${move}. This is the last beat: the gong tone.` : `${move}.`;
}
export function partHits(piece, part, b0, b1) {
  const out = [], cyc = piece.cyc;
  for (let b = b0; b < b1; b++) {
    if (part.on[b] !== 'x') continue;
    for (let k = 0; k < 4; k++) {
      const gb = b * 4 + k, idx = balIdx(piece, gb), pos = cycleBeat(piece, gb) + 1;
      const add = (step, ix, soft) => {
        let inst, kind, f;
        if (part.inst === 'bar') {
          inst = part.reg === 'mid' ? ix : REGINST[part.reg]; kind = 'bar'; f = noteFreq(piece.tuning, ix, REG[part.reg]);
        } else {
          inst = I[part.inst.toUpperCase()]; kind = part.inst; f = part.inst === 'kethuk' ? 0 : noteFreq(piece.tuning, ix, POT[part.inst]);
        }
        out.push({ bar: b, step, inst, kind, idx: ix, f, soft, reg: part.reg, pos, why: why(piece, part, gb, step, ix) });
      };
      const s = part.style;
      if (part.inst !== 'bar') { if (cyc[part.inst].includes(pos)) add(2 * k, idx, false); continue; }
      if (s === 'bal') add(2 * k, idx, false);
      else if (s === 'half') { if (k % 2 === 0) add(2 * k, idx, false); }
      else if (s === 'dbl') { add(2 * k, idx, false); add(2 * k + 1, idx, true); }
      else if (s === 'nacah') { add(2 * k, idx, false); add(2 * k + 1, balIdx(piece, gb + 1), true); }
      else if (s === 'off') add(2 * k + 1, idx, false);
    }
  }
  return out;
}

// The pitch index used when a gong is struck with no note to match (a free strike): the final tone of the first cycle.
export const finalIdx = (piece) => idxOf(piece.tuning, piece.gongans[piece.form[0]][piece.cyc.beats - 1]);
// The sound of one instrument for a given piece tuning: { kind, f }. `idx` is the pitch index for the gongs.
export function voiceOf(tuning, inst, idx = 0) {
  if (inst < 7) return { kind: 'bar', f: noteFreq(tuning, inst, 1) };
  if (inst === I.KENONG) return { kind: 'kenong', f: noteFreq(tuning, idx, POT.kenong) };
  if (inst === I.KEMPUL) return { kind: 'kempul', f: noteFreq(tuning, idx, POT.kempul) };
  if (inst === I.GONG) return { kind: 'gong', f: noteFreq(tuning, idx, POT.gong) };
  return { kind: 'kethuk', f: 0 };
}
export const panOf = (inst, n = 5) => (inst < 7 ? ((inst - (n - 1) / 2) / n) * 0.8 : { 7: -0.3, 8: 0.3, 9: 0, 10: 0.45, 11: -0.2, 12: 0.25 }[inst] ?? 0);

export const playerNoteCount = (piece, b0 = 0, b1 = piece.bars) => piece.player.reduce((n, p) => n + partHits(piece, p, b0, b1).length, 0);
// The instruments (lane ids) the player plays in a piece, ascending.
export const lanesOf = (piece) => [...new Set(piece.player.flatMap((p) => partHits(piece, p, 0, piece.bars).map((h) => h.inst)))].sort((a, b) => a - b);

// buildRun: lays a list of segments end to end on the song clock starting at T0.
//   segments: [{ kind: 'count' | 'listen' | 'echo' | 'play' | 'auto', b0, b1 }]   (count = one bar of clicks, b0/b1 ignored)
// Events: { t, inst, kind, f, idx, soft, who, layer, seg, id, why } with who = 'note' (the player must hit it), 'teach' (the teacher plays the
// player's part), 'ens' (ensemble layer), 'click' (metronome; inst = -1, kind 'click', k = 'accent' | 'beat').
export function buildRun(piece, segments, T0 = 0, opts = {}) {
  const speed = opts.speed ?? 1, bd = barDur(piece, speed), sd = stepDur(piece, speed), events = [], bars = [];
  let t = T0, id = 0;
  segments.forEach((seg, si) => {
    const nBars = seg.kind === 'count' ? 1 : seg.b1 - seg.b0;
    const t0 = t;
    for (let i = 0; i < nBars; i++) {
      const b = seg.kind === 'count' ? -1 : seg.b0 + i, tb = t0 + i * bd;
      bars.push({ t0: tb, t1: tb + bd, bar: b, kind: seg.kind, seg: si });
      if (seg.kind === 'count' || opts.click) {
        for (let k = 0; k < 4; k++) events.push({ t: tb + k * bd / 4, inst: -1, kind: 'click', k: k === 0 ? 'accent' : 'beat', soft: false, who: 'click', layer: -1, seg: si, cnt: seg.kind === 'count', id: id++ });
      }
    }
    if (seg.kind !== 'count') {
      const place = (h, who, layer) => events.push({ t: t0 + (h.bar - seg.b0) * bd + h.step * sd, inst: h.inst, kind: h.kind, f: h.f, idx: h.idx, soft: h.soft, pos: h.pos, who, layer, seg: si, why: h.why, id: id++ });
      const playerWho = seg.kind === 'echo' || seg.kind === 'play' ? 'note' : seg.kind === 'listen' || seg.kind === 'auto' ? 'teach' : null;
      for (const part of piece.player) for (const h of partHits(piece, part, seg.b0, seg.b1)) place(h, playerWho, 4);
      const upto = seg.kind === 'play' || seg.kind === 'auto' ? 3 : 0;
      piece.layers.forEach((layer, li) => {
        if (li > upto) return;
        for (const part of layer) for (const h of partHits(piece, part, seg.b0, seg.b1)) place(h, 'ens', li);
      });
    }
    t = t0 + nBars * bd;
  });
  events.sort((a, b) => a.t - b.t || a.id - b.id);
  return { events, bars, T0, end: t, speed, beatDur: bd / 4, barDur: bd, stepDur: sd };
}

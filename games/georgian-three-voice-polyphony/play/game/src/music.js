// Three Voices: the music and every rule constant. Pure data and pure functions (no DOM, no clock), so the engine, the Rules page and
// the tests all read the same numbers.
//
// Pitch is measured in CENTS above the piece's tonic (100 cents = one equal-tempered semitone). The scales use just-intonation steps so a
// chord that is in tune has no beating, like unaccompanied singing.

export const NPART = 3;
export const PARTS = [
  { id: 'bass', name: 'Bass', who: 'the low drone voice', col: '#f4a73c', hi: '#ffe0a0', vowelShift: 0.86, pan: 0 },
  { id: 'mid', name: 'Middle', who: 'the melody voice', col: '#ff6f86', hi: '#ffd0d8', vowelShift: 1.0, pan: -0.28 },
  { id: 'top', name: 'Top', who: 'the high ornamenting voice', col: '#5fe0d2', hi: '#d6fff9', vowelShift: 1.12, pan: 0.28 },
];

// Scale steps in cents for degrees 0..6 (just intonation). Degree d >= 7 is an octave up, d < 0 an octave down.
export const SCALES = {
  bright: { id: 'bright', name: 'Bright', steps: [0, 204, 386, 498, 702, 884, 1088], blurb: 'a major sound, the easiest to hear' },
  amber: { id: 'amber', name: 'Amber', steps: [0, 204, 386, 498, 702, 884, 996], blurb: 'major with a soft flat seventh, common in work songs' },
  dusk: { id: 'dusk', name: 'Dusk', steps: [0, 204, 316, 498, 702, 884, 996], blurb: 'a minor third with a bright sixth, wistful' },
  night: { id: 'night', name: 'Night', steps: [0, 204, 316, 498, 702, 814, 996], blurb: 'natural minor, dark and calm' },
};
export const SCALE_LIST = Object.values(SCALES);
export const scaleOf = (id) => SCALES[id] ?? SCALES.bright;
export const degCents = (scale, d) => {
  const o = Math.floor(d / 7), i = ((d % 7) + 7) % 7;
  return o * 1200 + scale.steps[i];
};
export const hzOf = (tonicHz, cents) => tonicHz * Math.pow(2, cents / 1200);

// Pure intervals used by the Harmony Lab and the teacher captions: name, ratio, cents.
export const INTERVALS = [
  { n: 'unison', r: '1:1', c: 0 }, { n: 'major second', r: '9:8', c: 204 }, { n: 'minor third', r: '6:5', c: 316 }, { n: 'major third', r: '5:4', c: 386 },
  { n: 'fourth', r: '4:3', c: 498 }, { n: 'fifth', r: '3:2', c: 702 }, { n: 'minor sixth', r: '8:5', c: 814 }, { n: 'major sixth', r: '5:3', c: 884 },
  { n: 'minor seventh', r: '9:5', c: 996 }, { n: 'major seventh', r: '15:8', c: 1088 }, { n: 'octave', r: '2:1', c: 1200 },
];
export function nearestInterval(cents) {
  const a = Math.abs(cents), o = Math.floor(a / 1200 + 1e-9), r = a - o * 1200;
  let best = INTERVALS[0], bd = 1e9;
  for (const iv of INTERVALS) { const d = Math.abs(iv.c - r); if (d < bd) { bd = d; best = iv; } }
  const oct = best.c === 1200 ? o + 1 : o, base = best.c === 1200 ? INTERVALS[0] : best;
  let [qa, qb] = base.r.split(':').map(Number); qa *= Math.pow(2, oct);
  while (qb % 2 === 0 && qa % 2 === 0) { qa /= 2; qb /= 2; }
  const name = best.c === 1200 || (best.c === 0 && o > 0) ? (oct === 1 ? 'octave' : 'double octave') : o > 0 ? `compound ${best.n}` : best.n;
  // pure target ratio a:b (octaves folded into a); the beating rate of two tones this far apart is |b f2 - a f1|
  return { name, ratio: base.r, off: r - best.c, ok: bd <= 28, a: qa, b: qb, c: base.c + oct * 1200 };
}

// Pitch assist (a gentle magnet toward the ladder's lines), and the cents windows. lock = "in tune" (the chord can lock), near = partial credit.
export const ASSIST = [
  { id: 'strong', name: 'Strong', pull: 110, lock: 60, near: 130, blurb: 'a wide magnet; easiest' },
  { id: 'light', name: 'Light', pull: 55, lock: 45, near: 100, blurb: 'a small magnet' },
  { id: 'off', name: 'Off', pull: 0, lock: 34, near: 75, blurb: 'free pitch; you tune by ear' },
];
// Note scoring.
export const JUDGE = { grace: 0.18, perfectCov: 0.9, perfectLat: 0.32, greatCov: 0.75, goodCov: 0.5, offCov: 0.2, nearWeight: 0.5 };
export const GRADE_ORDER = ['perfect', 'great', 'good', 'off', 'miss'];
export const SCORE = { perfect: 100, great: 80, good: 55, off: 25, miss: 0 };
export const WEIGHT = { perfect: 1, great: 0.85, good: 0.6, off: 0.3, miss: 0 };
export const CADENCE_K = 2;                        // score multiplier of the last note of a phrase
export const PARTS_K = [0, 1, 1.4, 1.8];           // score multiplier by the number of voices the player sings
// Resonance: seconds of chord lock per level, the top level, and the score multiplier of a level.
export const RESONANCE = { step: 1.6, max: 5, mult: (lvl) => 1 + 0.5 * (lvl - 1), lockHold: 0.5, breakAfter: 0.35 };
export const BREATH = { lead: 0.22, tail: 0.15, maxSung: 0.3 };    // a rest of one beat or more: be silent for all but lead/tail; more than maxSung of voice breaks it
export const LEARN = { pass: 0.6, tries: 2 };
export const THINK = { def: 5, min: 2, max: 10, reveal: 2 };
export const STARS = [0.55, 0.75, 0.9];
export const LOOKAHEAD = 0.6;
export const PXPS = 150;                           // note bars move at 150 virtual units per second
export const GRADES = [[0.95, 'S'], [0.88, 'A'], [0.75, 'B'], [0.6, 'C'], [0, 'D']];
export const gradeOf = (acc) => GRADES.find(([lim]) => acc >= lim)[1];
export const accuracyToStars = (acc) => (acc >= STARS[2] ? 3 : acc >= STARS[1] ? 2 : acc >= STARS[0] ? 1 : 0);
export const comboLabel = (g) => ({ perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', off: 'NEAR', miss: 'MISS' })[g];

// ---- the songs -----------------------------------------------------------------------------------------------------------------
// A part is four phrases separated by "|". A phrase is space-separated tokens  degree:beats  (r:beats = a breath / rest). Degrees are
// scale degrees from the tonic (negative = below). Every phrase is `bars * beatsPerBar` beats long (checked when the module loads).
// syl = the syllables the voices sing (not words), taken in turn.
const P = (o) => o;
export const PIECES = [
  P({
    id: 'table-toast', name: 'Table Toast', blurb: 'A slow toast. The two upper voices walk in thirds over a steady low voice.', scale: 'bright', tonicHz: 196, bpm: 76, bpb: 4, bars: 4,
    level: 1, syl: ['na', 'ho', 'ay', 'ra'], tag: 'Feast song',
    parts: [
      '-7:8 -4:4 -7:4 | -7:8 -5:4 -7:4 | -4:8 -3:4 -4:4 | -3:4 -4:4 -7:8',
      '2:2 4:2 2:2 0:2 2:2 4:2 2:4 | 4:2 5:2 4:2 2:2 4:2 2:2 0:4 | 3:2 4:2 5:2 4:2 3:2 2:2 3:4 | 4:2 2:2 1:2 0:2 1:2 0:2 0:4',
      '4:2 6:2 4:2 2:2 4:2 6:2 4:4 | 6:2 7:2 6:2 4:2 6:2 4:2 2:4 | 5:2 6:2 7:2 6:2 5:2 4:2 5:4 | 6:2 4:2 3:2 2:2 3:2 2:2 4:4',
    ],
  }),
  P({
    id: 'mountain-road', name: 'Mountain Road', blurb: 'A walking song. The middle voice steps along while the top voice leans on it with seconds.', scale: 'dusk', tonicHz: 207.65, bpm: 92, bpb: 4, bars: 4,
    level: 2, syl: ['lo', 'na', 'ay', 'ho'], tag: 'Road song',
    parts: [
      '-7:4 -7:4 -5:4 -7:4 | -7:4 -4:4 -5:4 -7:4 | -4:4 -3:4 -4:4 -6:4 | -5:4 -4:4 -7:8',
      '0:1 1:1 2:2 1:1 0:1 -1:2 0:1 1:1 2:1 3:1 2:2 0:2 | 2:1 3:1 4:2 3:1 2:1 1:2 2:2 1:1 0:1 1:2 0:2 | 3:1 4:1 5:2 4:1 3:1 2:2 3:1 4:1 3:1 2:1 1:2 2:2 | 4:1 3:1 2:2 1:1 0:1 -1:2 0:2 1:1 0:1 0:4',
      '2:4 4:2 3:2 2:2 4:2 5:2 4:2 | 4:4 5:2 4:2 4:2 3:2 2:2 3:2 | 5:4 7:2 6:2 5:2 6:2 5:2 4:2 | 6:4 5:2 4:2 4:2 3:1 2:1 4:4',
    ],
  }),
  P({
    id: 'harvest-rows', name: 'Harvest Rows', blurb: 'A work song of call and answer. The middle voice calls, the top voice answers in the gaps.', scale: 'amber', tonicHz: 220, bpm: 100, bpb: 4, bars: 4,
    level: 3, syl: ['ho', 'ra', 'ey', 'no'], tag: 'Work song',
    parts: [
      '-7:2 -7:1 -7:1 -4:2 -4:1 -4:1 -7:2 -7:1 -7:1 -5:2 -7:2 | -7:2 -7:1 -7:1 -3:2 -3:1 -3:1 -4:2 -4:1 -4:1 -7:4 | -6:2 -6:1 -6:1 -4:2 -4:1 -4:1 -3:2 -3:1 -3:1 -4:2 -5:2 | -4:2 -4:1 -4:1 -3:2 -3:1 -3:1 -4:2 -5:2 -7:4',
      '2:1.5 2:0.5 4:1 2:1 0:2 r:2 2:1.5 2:0.5 4:1 5:1 4:4 | 4:1.5 4:0.5 5:1 4:1 2:2 r:2 4:1.5 4:0.5 5:1 6:1 5:4 | 5:1.5 5:0.5 6:1 5:1 3:2 r:2 4:1.5 4:0.5 3:1 2:1 3:4 | 4:1.5 4:0.5 3:1 2:1 1:2 r:2 2:1.5 1:0.5 0:1 1:1 0:4',
      'r:4 4:1 5:1 6:2 r:4 6:1 7:1 6:2 | r:4 6:1 7:1 8:2 r:4 8:1 7:1 6:2 | r:4 7:1 6:1 5:2 r:4 5:1 6:1 5:2 | r:4 6:1 5:1 4:2 4:1 3:1 2:2 4:4',
    ],
  }),
  P({
    id: 'river-crossing', name: 'River Crossing', blurb: 'A rocking song in three. The voices swing in a long, minor-coloured line.', scale: 'night', tonicHz: 233.08, bpm: 72, bpb: 3, bars: 4,
    level: 3, syl: ['na', 'lo', 'ai', 'ra'], tag: 'Travel song',
    parts: [
      '-7:6 -5:3 -4:3 | -7:6 -6:3 -4:3 | -4:6 -3:3 -4:3 | -5:3 -6:3 -7:6',
      '0:1.5 2:1.5 4:3 2:1.5 1:1.5 0:3 | 2:1.5 4:1.5 5:3 4:1.5 2:1.5 1:3 | 4:1.5 5:1.5 6:3 5:1.5 4:1.5 2:3 | 3:1.5 2:1.5 1:3 2:1.5 1:1.5 0:3',
      '4:3 5:1.5 4:1.5 2:3 4:3 | 5:3 6:1.5 5:1.5 4:3 5:3 | 6:3 7:1.5 6:1.5 5:3 6:3 | 5:3 4:1.5 3:1.5 2:3 4:3',
    ],
  }),
  P({
    id: 'evening-gathering', name: 'Evening Gathering', blurb: 'Three independent lines. The bass walks, the middle voice winds, the top voice leaps and rests.', scale: 'bright', tonicHz: 246.94, bpm: 84, bpb: 4, bars: 4,
    level: 4, syl: ['ay', 'no', 'ra', 'lei'], tag: 'Gathering song',
    parts: [
      '-7:4 -6:2 -5:2 -4:4 -5:2 -6:2 | -5:4 -4:2 -3:2 -4:4 -5:2 -7:2 | -3:4 -4:2 -5:2 -6:4 -5:2 -4:2 | -5:2 -4:2 -3:2 -4:2 -5:4 -7:4',
      '0:2 2:1 1:1 0:2 -1:2 0:1 1:1 2:2 4:2 2:2 | 2:2 4:1 3:1 2:2 1:2 2:1 3:1 4:2 5:2 4:2 | 4:2 5:1 4:1 3:2 2:2 3:1 2:1 1:2 2:2 3:2 | 2:2 1:1 0:1 1:2 2:2 1:2 0:2 0:4',
      '4:1 5:1 6:2 4:2 r:2 6:2 5:1 4:1 5:2 4:2 | 6:1 7:1 8:2 6:2 r:2 7:2 6:1 5:1 6:2 4:2 | 7:1 8:1 9:2 7:2 r:2 6:2 5:1 4:1 5:2 6:2 | 6:1 5:1 4:2 3:2 r:2 4:2 3:1 2:1 4:4',
    ],
  }),
  P({
    id: 'travelers-farewell', name: "Travelers' Farewell", blurb: 'A slow, wide song with long held notes, high leaps and an ending that takes a deep breath.', scale: 'dusk', tonicHz: 207.65, bpm: 66, bpb: 4, bars: 4,
    level: 5, syl: ['ay', 'lo', 'na', 'ei'], tag: 'Parting song',
    parts: [
      '-7:8 -7:4 -3:4 | -4:8 -5:4 -4:4 | -3:8 -6:4 -3:4 | -4:4 -5:4 -7:8',
      '0:3 2:1 4:2 2:2 0:1 2:1 4:2 5:2 4:2 | 4:3 5:1 7:2 5:2 4:1 5:1 7:2 6:2 4:2 | 5:3 6:1 7:2 5:2 3:1 4:1 5:2 4:2 2:2 | 4:2 3:1 2:1 1:2 0:2 1:1 2:1 1:2 0:4',
      '7:2 9:1 7:1 6:2 4:2 6:1 7:1 9:2 8:2 7:2 | 8:2 9:1 8:1 7:2 5:2 7:1 8:1 9:2 8:2 7:2 | 9:2 8:1 7:1 6:2 5:2 6:1 7:1 8:2 6:2 4:2 | 7:2 6:1 5:1 4:2 3:2 4:2 3:1 2:1 4:4',
    ],
  }),
];

// ---- parsing and building --------------------------------------------------------------------------------------------------------------
// -> phrases[k] = [{ beat, dur, deg | null, syl }] with `beat` counted from the start of the piece
export function parsePart(piece, partIdx) {
  const bpp = piece.bpb * piece.bars, out = [];
  piece.parts[partIdx].split('|').forEach((ph, k) => {
    const notes = []; let b = k * bpp, si = k * 3 + partIdx;
    for (const tok of ph.trim().split(/\s+/)) {
      const [d, du] = tok.split(':'), dur = Number(du);
      if (!(dur > 0)) throw new Error(`${piece.id}: bad token "${tok}"`);
      if (d === 'r') notes.push({ beat: b, dur, deg: null, syl: null });
      else { notes.push({ beat: b, dur, deg: Number(d), syl: piece.syl[si % piece.syl.length] }); si += 1; }
      b += dur;
    }
    if (Math.abs(b - (k + 1) * bpp) > 1e-9) throw new Error(`${piece.id}: part ${partIdx} phrase ${k + 1} is ${b - k * bpp} beats, expected ${bpp}`);
    out.push(notes);
  });
  if (out.length !== 4) throw new Error(`${piece.id}: part ${partIdx} has ${out.length} phrases`);
  return out;
}
const parsedCache = new Map();
export function parsePiece(piece) {
  let p = parsedCache.get(piece.id);
  if (!p) { p = PARTS.map((_, i) => parsePart(piece, i)); parsedCache.set(piece.id, p); }
  return p;
}
PIECES.forEach(parsePiece);                                            // validate every song when the module loads

export const beatSec = (piece, speed = 1) => 60 / piece.bpm / speed;
export const phraseBeats = (piece) => piece.bpb * piece.bars;
export const pieceSeconds = (piece) => Math.round(4 * phraseBeats(piece) * beatSec(piece));
export const scaleFor = (piece) => scaleOf(piece.scale);
export const centsOf = (piece, deg) => degCents(scaleFor(piece), deg);

export function pieceRange(piece) {
  let lo = 1e9, hi = -1e9;
  for (const part of parsePiece(piece)) for (const ph of part) for (const n of ph) if (n.deg !== null) { const c = centsOf(piece, n.deg); lo = Math.min(lo, c); hi = Math.max(hi, c); }
  return { lo, hi };
}

// segments: { kind: 'count' } | { kind: 'gap' } | { kind: 'listen' | 'echo' | 'play' | 'auto', b0, b1 } (beat range inside the piece)
// parts: [bool x3], which voices the player sings (judged in 'play' and 'echo'; friends sing the rest).
// Returns the notes of every part (absolute times), the clicks, the bar lines and the segment spans.
export function buildRun(piece, segments, T0, { speed = 1, parts = [false, true, false] } = {}) {
  const beat = beatSec(piece, speed), P = parsePiece(piece), bpp = phraseBeats(piece);
  const notes = [], clicks = [], bars = [], segs = [], rests = [];
  let t = T0;
  for (const seg of segments) {
    if (seg.kind === 'count') {
      for (let i = 0; i < piece.bpb; i++) clicks.push({ t: t + i * beat, accent: i === 0 });
      segs.push({ kind: 'count', t0: t, t1: t + piece.bpb * beat }); t += piece.bpb * beat; continue;
    }
    if (seg.kind === 'gap') { t += beat; continue; }
    const t0 = t, judgedKind = seg.kind === 'play' || seg.kind === 'echo';
    for (let p = 0; p < PARTS.length; p++) {
      for (let k = 0; k < 4; k++) {
        const phraseEnd = (k + 1) * bpp;
        for (const n of P[p][k]) {
          if (n.beat < seg.b0 - 1e-9 || n.beat >= seg.b1 - 1e-9) continue;
          if (n.deg === null) { if (n.dur >= 1 && judgedKind && parts[p]) rests.push({ part: p, t: t0 + (n.beat - seg.b0) * beat, dur: n.dur * beat, ph: k }); continue; }
          notes.push({
            part: p, t: t0 + (n.beat - seg.b0) * beat, dur: n.dur * beat, c: centsOf(piece, n.deg), deg: n.deg, syl: n.syl, beat: n.beat, ph: k,
            who: judgedKind && parts[p] ? 'note' : 'ens', mine: !!parts[p], cad: Math.abs(n.beat + n.dur - phraseEnd) < 1e-9,
          });
        }
      }
    }
    for (let b = Math.ceil(seg.b0 / piece.bpb) * piece.bpb; b < seg.b1 - 1e-9; b += piece.bpb) bars.push({ t: t0 + (b - seg.b0) * beat, n: b / piece.bpb });
    t += (seg.b1 - seg.b0) * beat;
    segs.push({ kind: seg.kind, t0, t1: t, b0: seg.b0, b1: seg.b1 });
  }
  notes.sort((a, b) => a.t - b.t || a.part - b.part);
  return { notes, clicks, bars, segs, rests, T0, end: t };
}

// ---- teacher captions (Watch and Learn): derived from the notes themselves -------------------------------------------------------------
const ORD = ['the home note', 'a second', 'a third', 'a fourth', 'a fifth', 'a sixth', 'a seventh'];
const ordinal = (deg) => ORD[((deg % 7) + 7) % 7];
export function describePhrase(piece, k) {
  const P = parsePiece(piece), scale = scaleFor(piece), lines = [];
  const first = (p) => P[p][k].find((n) => n.deg !== null), last = (p) => [...P[p][k]].reverse().find((n) => n.deg !== null);
  const b0 = first(0), m0 = first(1), t0 = first(2), bl = last(0), ml = last(1), tl = last(2);
  const rel = (n) => ordinal(n.deg);
  const bassMoves = new Set(P[0][k].filter((n) => n.deg !== null).map((n) => n.deg)).size;
  lines.push({ part: 0, text: bassMoves <= 1 ? `Bass holds ${rel(b0)} of the key like a drone.` : b0.deg === bl.deg ? `Bass leaves ${rel(b0)} and comes back to it.` : `Bass starts on ${rel(b0)} and moves to ${rel(bl)}.` });
  const mn = P[1][k].filter((n) => n.deg !== null), up = ml.deg - m0.deg;
  lines.push({ part: 1, text: m0.deg === ml.deg ? `Middle starts and ends on ${rel(m0)}${mn.length > 7 ? ', moving quickly in between' : ''}.` : `Middle starts on ${rel(m0)} and ${up > 0 ? 'climbs' : 'falls'} to ${rel(ml)}${mn.length > 7 ? ', moving quickly' : ''}.` });
  const tn = P[2][k].filter((n) => n.deg !== null), rests = P[2][k].some((n) => n.deg === null && n.dur >= 1);
  lines.push({ part: 2, text: `Top ${rests ? 'waits, then answers in the gaps' : 'sings above the middle voice'}, from ${rel(t0)} to ${rel(tl)}${tn.length > 7 ? ' with quick turns' : ''}.` });
  // a rubbing second between middle and top (listen for the beating), and the closing chord
  let rub = false;
  for (const a of P[1][k]) {
    if (a.deg === null) continue;
    for (const b of P[2][k]) if (b.deg !== null && b.beat <= a.beat + 1e-9 && b.beat + b.dur > a.beat + 1e-9 && Math.abs(b.deg - a.deg) === 1) rub = true;
  }
  const end = nearestInterval(centsOf(piece, tl.deg) - centsOf(piece, bl.deg));
  const midEnd = nearestInterval(centsOf(piece, ml.deg) - centsOf(piece, bl.deg));
  lines.push({ part: -1, text: `${rub ? 'Where middle and top are a second apart they rub, a bright beating that the next note relaxes. ' : ''}The phrase ends with bass and top a ${end.name} apart and bass and middle ${midEnd.name === 'octave' ? 'an octave' : 'a ' + midEnd.name} apart.` });
  void scale;
  return lines;
}

// Which part is nearest (in time and pitch) to the touch? Used to hand a finger to a voice: ref[p] = the cents that voice is at (or about to be at).
export function nearestPart(ref, can, c) {
  let best = -1, bd = 1e9;
  for (let p = 0; p < NPART; p++) {
    if (!can[p] || ref[p] === null || ref[p] === undefined) continue;
    const d = Math.abs(ref[p] - c);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

// The ladder's lines: the scale's degrees across [lo, hi] cents with their degree numbers.
export function ladderLines(scale, lo, hi) {
  const out = [];
  for (let d = -14; d <= 21; d++) { const c = degCents(scale, d); if (c >= lo - 1 && c <= hi + 1) out.push({ d, c, tonic: ((d % 7) + 7) % 7 === 0 }); }
  return out;
}

// Assist: pull a raw pitch toward the nearest ladder line within `pull` cents (a smooth detent), leaving the middle of a gap untouched.
export function assist(raw, lines, pull) {
  if (!(pull > 0) || !lines.length) return raw;
  let best = null, bd = 1e9;
  for (const l of lines) { const d = Math.abs(l.c - raw); if (d < bd) { bd = d; best = l; } }
  if (!best || bd >= pull) return raw;
  const k = 1 - bd / pull, s = k * k * (3 - 2 * k);                       // 1 on the line, 0 at the edge of the pull
  return raw + (best.c - raw) * s * 0.85;
}

export const LAB_WIN = { lo: -1300, hi: 1500 };
export const PREFS_DEFAULT = { sound: true, parts: [false, true, false], assistIdx: 1, haptics: true, calm: false, textIdx: 0, think: THINK.def, hints: true, scale: 'bright' };

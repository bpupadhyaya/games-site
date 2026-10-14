// Santoor: scales, the zigzag layout of the strings, the six pieces and the rule constants. Pure data + pure functions (no clock, no randomness).
// The Rules page prints these same constants, so the text cannot drift from the engine.
//
// The instrument has 8 courses (rows of strings). Each course has two playing spots, one on the left of the board (left mallet) and one on
// the right (right mallet). Note number n (1..16, as written in the pieces) sits on course floor((n-1)/2); odd n is on the left, even n on
// the right, so climbing the scale zigzags: left, right, left, right, one course higher every second note.
//
// Notation of a piece: bars separated by "|", each bar is exactly 4 beats; tokens separated by spaces:
//   7/1      strike note 7 for 1 beat           r/2      rest of 2 beats
//   t7/2     tremolo (roll) on note 7: hold it for 2 beats
//   g5-12/2  run from note 5 up to 12 (or down), every note struck once, spread over 2 beats
//   3+8/1    two notes together (a chord)

export const NCOURSE = 8;
export const NNOTE = 16;
export const BASE_HZ = 138.59;                                         // note 1 of the base tuning is a C sharp
export const NOTE_NAMES = ['C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C'];
export const SCALES = [
  { id: 'bhoopali', name: 'Bhoopali', steps: [0, 2, 4, 7, 9], sargam: ['Sa', 'Re', 'Ga', 'Pa', 'Dha'], blurb: 'Five bright notes with no half steps: open and easy to sing.' },
  { id: 'pahadi', name: 'Pahadi', steps: [0, 2, 4, 5, 7, 9, 11], sargam: ['Sa', 'Re', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni'], blurb: 'The hill-country scale: seven natural notes, a folk sweetness.' },
  { id: 'kafi', name: 'Kafi', steps: [0, 2, 3, 5, 7, 9, 10], sargam: ['Sa', 'Re', 'ga', 'Ma', 'Pa', 'Dha', 'ni'], blurb: 'Seven notes with a softened third and seventh: warm and a little wistful.' },
  { id: 'yaman', name: 'Yaman', steps: [0, 2, 4, 6, 7, 9, 11], sargam: ['Sa', 'Re', 'Ga', 'Ma#', 'Pa', 'Dha', 'Ni'], blurb: 'A raised fourth gives a glowing, open sound.' },
  { id: 'malkauns', name: 'Malkauns', steps: [0, 3, 5, 8, 10], sargam: ['Sa', 'ga', 'Ma', 'dha', 'ni'], blurb: 'Five low, dark notes with wide steps: deep and still.' },
];
export const scaleById = (id) => SCALES.find((s) => s.id === id) ?? SCALES[0];
// Semitones above note 1 of note index i (0..15) in a scale.
export const semiOf = (scale, i) => 12 * Math.floor(i / scale.steps.length) + scale.steps[i % scale.steps.length];
export const hzOf = (semi) => BASE_HZ * Math.pow(2, semi / 12);
export const noteName = (semi) => NOTE_NAMES[((Math.round(semi) % 12) + 12) % 12];
export const sargamOf = (scale, i) => scale.sargam[i % scale.sargam.length] + (i >= scale.steps.length * 2 ? "''" : i >= scale.steps.length ? "'" : '');
export const courseOf = (i) => i >> 1;
export const sideOf = (i) => i & 1;                                    // 0 = left mallet, 1 = right mallet
export const HANDS = ['left', 'right'];

// ---- judging and scoring (all read by the Rules page) -------------------------------------------------------------
export const JUDGE = { perfect: 0.055, great: 0.1, good: 0.15 };      // seconds either side of the note, at the "Normal" timing setting
export const RUN_K = 1.7;                                              // run notes use windows this much wider
export const TIMING = [{ id: 'relaxed', name: 'Relaxed', k: 1.4 }, { id: 'normal', name: 'Normal', k: 1 }, { id: 'tight', name: 'Tight', k: 0.8 }];
export const SPEEDS = [{ id: 'slow', name: 'Slow', approach: 2.6 }, { id: 'normal', name: 'Normal', approach: 2.0 }, { id: 'fast', name: 'Fast', approach: 1.5 }];
export const ROLL = { hold: 0.7, grace: 0.12, rate: 0.075 };            // a roll counts when held for 70% of its length (less 0.12 s); the tremolo sounds every 0.075 s
export const SCORE = { perfect: 300, great: 200, good: 100, off: 40, roll: 150, comboStep: 10, comboMax: 4 };
export const WEIGHT = { perfect: 1, great: 0.85, good: 0.6, off: 0.4, miss: 0 };
export const STARS = [0.55, 0.75, 0.9];
export const ENSEMBLE = { every: 8, start: 0, max: 2 };               // +1 accompaniment layer per 8 clean notes in a row; a miss takes one away
export const LEARN = { pass: 0.5, tries: 2 };
export const THINK = { min: 2, max: 10, def: 5, reveal: 2 };
export const LOOKAHEAD = 0.12;
export const GRADES = [['S', 0.95], ['A', 0.85], ['B', 0.7], ['C', 0.5], ['D', 0]];
export const accuracyToStars = (a) => (a >= STARS[2] ? 3 : a >= STARS[1] ? 2 : a >= STARS[0] ? 1 : 0);
export const gradeOf = (a) => GRADES.find((g) => a >= g[1])[0];
export const comboMult = (combo) => Math.min(SCORE.comboMax, 1 + Math.floor(combo / SCORE.comboStep));

// ---- the six pieces -----------------------------------------------------------------------------------------------
export const PIECES = [
  {
    id: 'water', name: 'Morning Water', scale: 'bhoopali', bpm: 66, level: 1,
    blurb: 'Single slow notes, stepping up and down. Left, right, left, right: the place to begin.',
    bars: '6/1 7/1 6/1 5/1 | 6/1 7/1 8/1 r/1 | 8/1 7/1 6/1 5/1 | 6/2 r/2 | 5/1 6/1 5/1 4/1 | 5/1 6/1 7/1 r/1 | 8/2 7/1 6/1 | 6/4',
    tips: ['Climb two steps and come back: the mallets simply take turns.', 'Up to the highest note, then a short breath.', 'Walk down the zigzag, one note at a time.', 'A long note, then rest, and let it ring.'],
  },
  {
    id: 'marigold', name: 'Marigold Path', scale: 'pahadi', bpm: 76, level: 2,
    blurb: 'Leaps and quick pairs: some notes need the same mallet twice.',
    bars: '5/1 7/.5 8/.5 9/2 | 8/1 7/.5 6/.5 7/2 | 5/1 7/.5 8/.5 9/1 11/1 | 10/2 r/2 | 11/1 10/.5 9/.5 8/1 7/1 | 8/1 7/.5 6/.5 5/2 | 7/1 8/1 10/1 8/1 | 5/4',
    tips: ['A leap of two notes lands on the same side: the same mallet strikes again, one course higher.', 'Quick pairs, then a long note. Look ahead to where the mallet goes next.', 'Up in leaps, then a rest at the top.', 'Step and leap back down and finish on the low note.'],
  },
  {
    id: 'shimmer', name: 'Lake Shimmer', scale: 'kafi', bpm: 60, level: 3,
    blurb: 'Slow melody with tremolo rolls: keep a finger on the string and let it shimmer.',
    bars: 't7/2 9/1 8/1 | 7/1 6/1 t7/2 | 9/2 t11/2 | 10/1 9/1 8/2 | t6/2 8/1 7/1 | 9/1 10/1 t11/2 | 10/1 9/1 8/1 7/1 | t7/4',
    tips: ['A roll: touch the spot and hold. The mallet bounces fast and the sound stays alive.', 'Hold the roll for its full length, then move on.', 'Lift your hand a little before a held note ends if the next note is close.', 'One last long roll to close.'],
  },
  {
    id: 'rain', name: 'Mountain Rain', scale: 'yaman', bpm: 88, level: 4,
    blurb: 'Patter of quick notes and the first runs: drag across the courses in one stroke.',
    bars: '7/.5 8/.5 7/.5 8/.5 9/1 r/1 | 10/.5 9/.5 10/.5 9/.5 8/1 r/1 | 7/.5 8/.5 9/.5 10/.5 11/1 r/1 | g6-12/2 12/2 | 12/.5 11/.5 10/.5 9/.5 10/1 8/1 | 9/.5 8/.5 9/.5 8/.5 7/1 r/1 | g12-5/2 6/1 5/1 | 5/4',
    tips: ['Raindrops: pairs of quick notes on neighbouring spots.', 'Four quick notes climbing, then a beat to breathe.', 'A run: one finger zigzags up the courses in a single stroke.', 'Run back down and finish low and slow.'],
  },
  {
    id: 'caravan', name: 'Caravan Bells', scale: 'pahadi', bpm: 96, level: 4,
    blurb: 'A lively, syncopated piece with chords played by both mallets at once.',
    bars: '5/1 5/.5 7/.5 8/1 7/1 | 5/1 5/.5 7/.5 9/2 | 8/.5 9/.5 10/1 8/1 7/1 | 5+8/2 r/2 | 8/1 8/.5 9/.5 10/1 9/1 | 7/1 7/.5 8/.5 9/1 7/1 | 5+10/1 6+11/1 7+12/1 8+13/1 | 5+8/4',
    tips: ['A repeated note with a little skip: tap, tap-and-up.', 'The same figure with a long landing note.', 'A chord: touch both spots with two fingers at the same moment.', 'Chords climb the courses, then settle home.'],
  },
  {
    id: 'river', name: 'Snowmelt River', scale: 'malkauns', bpm: 104, level: 5,
    blurb: 'The flowing piece: long runs, a roll, chords and fast pairs.',
    bars: '4/1 7/1 9/1 7/1 | 5/1 8/1 10/.5 9/.5 r/1 | 6/.5 7/.5 8/.5 9/.5 t10/2 | g5-12/2 12/2 | 12/1 10/1 9/1 7/1 | 4+9/1 5+10/1 6+11/1 7+12/1 | g12-4/3 r/1 | 4/4',
    tips: ['A rolling figure on the lower courses, like water finding its way.', 'Pairs of quick notes, then a roll with the other hand free.', 'A long run to the top, then a held note.', 'Chords stepping up, a long run down, and home.'],
  },
];

// ---- compiling a piece to items ---------------------------------------------------------------------------------------
const cache = new Map();
// Items: { kind: 'note' | 'roll' | 'run' | 'rest', beat (from the start), dur (beats), n (0..15), c (course), side, sid, si, sn, chord, bar }
export function parsePiece(piece) {
  if (cache.has(piece.id)) return cache.get(piece.id);
  const items = []; let sid = 0;
  piece.bars.split('|').forEach((bar, bi) => {
    let beat = bi * 4;
    for (const tok of bar.trim().split(/\s+/)) {
      const [what, rest] = tok.split('/'), dur = parseFloat(rest);
      const mk = (o) => ({ beat, dur, bar: bi, ...o, c: courseOf(o.n), side: sideOf(o.n) });
      if (what === 'r') items.push({ kind: 'rest', beat, dur, bar: bi });
      else if (what[0] === 'g') {
        const [a, b] = what.slice(1).split('-').map((x) => Number(x) - 1), dir = b >= a ? 1 : -1, cnt = Math.abs(b - a) + 1;
        for (let k = 0; k < cnt; k++) items.push({ ...mk({ kind: 'run', n: a + dir * k, sid, si: k, sn: cnt }), beat: beat + (dur * k) / cnt, dur: dur / cnt });
        sid += 1;
      } else if (what[0] === 't') items.push(mk({ kind: 'roll', n: Number(what.slice(1)) - 1 }));
      else for (const part of what.split('+')) items.push(mk({ kind: 'note', n: Number(part) - 1, chord: what.includes('+') }));
      beat += dur;
    }
  });
  const out = { items, bars: piece.bars.split('|').length };
  cache.set(piece.id, out);
  return out;
}
export const barBeats = 4;
export const beatDur = (piece, speed = 1) => 60 / piece.bpm / speed;
export const barDur = (piece, speed = 1) => beatDur(piece, speed) * 4;
export const pieceSeconds = (piece) => Math.round(parsePiece(piece).bars * barDur(piece));
export const notesUsed = (piece, b0, b1) => [...new Set(parsePiece(piece).items.filter((i) => i.bar >= b0 && i.bar < b1 && i.n !== undefined).map((i) => i.n))].sort((a, b) => a - b);

// Why the teacher plays a note this way (Watch and Learn captions). Derived from the note and its neighbours so it is always true.
export function whyOf(piece, item) {
  const items = parsePiece(piece).items, i = items.indexOf(item);
  const prev = items.slice(0, i).reverse().find((x) => x.kind !== 'rest' && x.n !== undefined && x.beat < item.beat);
  const hand = HANDS[item.side], name = `note ${item.n + 1}`;
  if (item.kind === 'roll') return `Tremolo: touch the spot with the ${hand} mallet and hold. The mallet bounces quickly, so the note keeps sounding for as long as you hold it.`;
  if (item.kind === 'run') return item.si === 0 ? 'A run: one stroke zigzags up or down the courses so every note sounds once, the hands taking turns.' : 'Keep the stroke smooth and even; the mallets do not stop between notes.';
  if (item.chord) return 'Two notes together: strike both spots at the same moment, one with each mallet.';
  if (!prev) return `Begin on ${name}, with the ${hand} mallet. Odd notes are on the left, even notes on the right.`;
  const d = item.n - prev.n;
  if (d === 0) return `The same spot again with the ${hand} mallet: keep the two strikes even.`;
  if (Math.abs(d) === 1) return `One step ${d > 0 ? 'up' : 'down'} the scale: the other mallet takes the note, ${hand} hand now.`;
  if (Math.abs(d) % 2 === 0) return `A leap of ${Math.abs(d)} notes ${d > 0 ? 'up' : 'down'}: it lands on the same side, so the ${hand} mallet strikes again, ${Math.abs(d) / 2} course${Math.abs(d) === 2 ? '' : 's'} ${d > 0 ? 'higher' : 'lower'}.`;
  return `A leap of ${Math.abs(d)} notes ${d > 0 ? 'up' : 'down'}: the ${hand} mallet takes it, on the other side of the board.`;
}

// ---- turning segments into timed events ------------------------------------------------------------------------------
// Segments: { kind: 'count' } { kind: 'play'|'echo'|'listen'|'auto', b0, b1, blind? }.
// Events: { t, who: 'note'|'teach'|'ens'|'click', n, c, side, kind, dur (s), sw, sid, si, sn, vel, layer, cnt, ph, item, blind }
export function buildRun(piece, segments, startT, { speed = 1 } = {}) {
  const bd = beatDur(piece, speed), events = [], bars = [], segs = [], P = parsePiece(piece);
  let T = startT;
  for (const seg of segments) {
    if (seg.kind === 'count') {
      for (let i = 0; i < 4; i++) events.push({ t: T + i * bd, who: 'click', n: -1, k: i === 0 ? 'accent' : 'beat', cnt: true });
      bars.push({ t0: T, t1: T + bd * 4, idx: -1 }); segs.push({ kind: 'count', t0: T, t1: T + bd * 4 });
      T += bd * 4;
      continue;
    }
    const kind = seg.kind, who = kind === 'listen' || kind === 'auto' ? 'teach' : 'note';
    for (const it of P.items) {
      if (it.bar < seg.b0 || it.bar >= seg.b1 || it.kind === 'rest') continue;
      const t = T + (it.beat - seg.b0 * 4) * bd, dur = it.dur * bd;
      events.push({ t, who, n: it.n, c: it.c, side: it.side, kind: it.kind, dur, sw: it.kind === 'run', sid: it.sid, si: it.si, sn: it.sn, vel: 0.9, item: it, ph: it.bar >> 1, blind: !!seg.blind });
      if (it.kind === 'roll' && who === 'teach') {
        for (let k = 1; k * ROLL.rate < dur - 0.02; k++) events.push({ t: t + k * ROLL.rate, who: 'teach', n: it.n, c: it.c, side: it.side, kind: 'tr', dur: ROLL.rate, vel: 0.5, tr: true, item: it, ph: it.bar >> 1 });
      }
    }
    // accompaniment (only for whole-piece runs): layer 1 = a tanpura-like drone on each beat, layer 2 = a soft hand-drum pulse
    if (kind === 'play' || kind === 'auto') {
      const DR = [-5, 0, 0, -12], TAB = ['dha', 'na', 'tin', 'na'];
      for (let b = seg.b0; b < seg.b1; b++) {
        for (let k = 0; k < 4; k++) {
          const tt = T + ((b - seg.b0) * 4 + k) * bd;
          events.push({ t: tt, who: 'ens', n: -1, drone: DR[k], dur: bd * 2.4, vel: 0.5, layer: 1, ph: b >> 1 });
          events.push({ t: tt, who: 'ens', n: -1, tab: TAB[k], dur: bd * 0.5, vel: k === 0 ? 0.8 : 0.5, layer: 2, ph: b >> 1 });
        }
      }
    }
    for (let b = seg.b0; b < seg.b1; b++) bars.push({ t0: T + (b - seg.b0) * 4 * bd, t1: T + (b - seg.b0 + 1) * 4 * bd, idx: b });
    segs.push({ kind, t0: T, t1: T + (seg.b1 - seg.b0) * 4 * bd, b0: seg.b0, b1: seg.b1, blind: !!seg.blind });
    T += (seg.b1 - seg.b0) * 4 * bd;
  }
  events.sort((a, b) => a.t - b.t || (a.n ?? 0) - (b.n ?? 0));
  return { T0: startT, end: T, events, bars, segs };
}

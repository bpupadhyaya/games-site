// Koto: scales, string geometry, the six pieces and the rule constants. Pure data + pure functions (no clock, no randomness).
// The Rules page prints these same constants, so the text cannot drift from the engine.
//
// Notation of a piece: bars separated by "|", each bar is exactly 4 beats; tokens separated by spaces:
//   7/1      pluck string 7 for 1 beat           r/2      rest of 2 beats (a rest of 2 or more beats is a "ma")
//   7/2^     same, pressed a half step           7/2^^    pressed a whole step (oshide)
//   g5-10/2  sweep (kakizume) from string 5 up to 10 (or down) spread over 2 beats
//   3+8/1    two strings together (a chord)

export const NSTR = 13;
export const KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '斗', '為', '巾'];
export const SCALES = [
  { id: 'hirajoshi', name: 'Hirajoshi', steps: [0, 2, 3, 7, 8], blurb: 'The best-known koto tuning: wistful, with a half step that leans downward.' },
  { id: 'kumoi', name: 'Kumoi', steps: [0, 2, 3, 7, 9], blurb: 'Close to hirajoshi but brighter at the top: calm and open.' },
  { id: 'iwato', name: 'Iwato', steps: [0, 1, 5, 6, 10], blurb: 'Dark and tense, with two half steps close together.' },
  { id: 'ryukyu', name: 'Ryukyu', steps: [0, 4, 5, 7, 11], blurb: 'A sunny island scale built from wide steps.' },
  { id: 'miyako', name: 'Miyako-bushi', steps: [0, 1, 5, 7, 8], blurb: 'A delicate scale with a half step at both ends of its fourth.' },
];
export const BASE_HZ = 146.83;                                              // string 1 of the base tuning is a D
export const PRESS = [{ name: 'open', semi: 0, label: '' }, { name: 'half', semi: 1, label: '+½' }, { name: 'whole', semi: 2, label: '+1' }];
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Geometry along a string, u = 0 (far end) .. 1 (near end, towards the player). The sounding part of a string is between its
// bridge and the near end, so a bridge nearer the player means a shorter string and a higher note.
export const GEO = { uFar: 0.03, uNear: 0.95, uHit: 0.8, uStart: 0.05, L0: 0.6, k: 0.42, halfBand: 0.14, tune: [-6, 12] };
export const bridgeU = (semi) => GEO.uNear - GEO.L0 * Math.pow(2, (-semi / 12) * GEO.k);
export const semiFromU = (u) => (-12 * Math.log2(Math.max(0.02, GEO.uNear - u) / GEO.L0)) / GEO.k;
export const baseSemi = (scale, s) => 12 * Math.floor(s / 5) + scale.steps[s % 5];
export const hzOf = (semi) => BASE_HZ * Math.pow(2, semi / 12);
export const noteName = (semi) => NOTE_NAMES[(((Math.round(semi) + 2) % 12) + 12) % 12];     // semi 0 is a D
export const scaleById = (id) => SCALES.find((s) => s.id === id) ?? SCALES[0];
export const FINGERS = ['thumb', 'index finger', 'middle finger'];

// ---- judging and scoring (all read by the Rules page) -------------------------------------------------------------
export const JUDGE = { perfect: 0.055, great: 0.1, good: 0.15 };          // seconds either side of the note, at the "Normal" timing setting
export const SWEEP_K = 1.7;                                               // sweep notes use windows this much wider
export const BEND_WINDOW = 0.9;                                           // seconds after a pluck in which a press still counts as the bend
export const TIMING = [{ id: 'relaxed', name: 'Relaxed', k: 1.4 }, { id: 'normal', name: 'Normal', k: 1 }, { id: 'tight', name: 'Tight', k: 0.8 }];
export const SPEEDS = [{ id: 'slow', name: 'Slow', approach: 2.8 }, { id: 'normal', name: 'Normal', approach: 2.2 }, { id: 'fast', name: 'Fast', approach: 1.7 }];
export const SCORE = { perfect: 300, great: 200, good: 100, off: 40, bend: 150, ma: 150, comboStep: 10, comboMax: 4 };
export const WEIGHT = { perfect: 1, great: 0.85, good: 0.6, off: 0.4, miss: 0 };
export const STARS = [0.55, 0.75, 0.9];
export const ENSEMBLE = { every: 8, start: 0, max: 2 };                  // +1 accompaniment layer per 8 clean notes in a row; a miss takes one away
export const LEARN = { pass: 0.5, tries: 2 };
export const MA = { minBeats: 2, lead: 0.2, tail: 0.25 };                // a rest of at least 2 beats; touches in [start+lead, end-tail] break the stillness
export const THINK = { min: 2, max: 10, def: 5, reveal: 2 };
export const LOOKAHEAD = 0.12;
export const GRADES = [['S', 0.95], ['A', 0.85], ['B', 0.7], ['C', 0.5], ['D', 0]];
export const accuracyToStars = (a) => (a >= STARS[2] ? 3 : a >= STARS[1] ? 2 : a >= STARS[0] ? 1 : 0);
export const gradeOf = (a) => GRADES.find((g) => a >= g[1])[0];
export const comboMult = (combo) => Math.min(SCORE.comboMax, 1 + Math.floor(combo / SCORE.comboStep));

// ---- the six pieces -----------------------------------------------------------------------------------------------
const phr = (t) => t;                                                      // phrase tips are written next to the bars
export const PIECES = [
  {
    id: 'dew', name: 'Dew', kanji: '露', scale: 'hirajoshi', bpm: 60, level: 1,
    blurb: 'Single slow notes, one string at a time, with room to breathe. The place to begin.',
    bars: '6/1 7/1 6/1 r/1 | 6/1 7/1 8/1 r/1 | 9/2 8/1 7/1 | 6/2 r/2 | 7/1 8/1 7/1 6/1 | 5/1 6/1 7/1 r/1 | 9/1 8/1 7/1 6/1 | 6/4',
    tips: [phr('Two near strings, back and forth. A one-beat rest is just a short breath.'), phr('Climb three strings, then rest: the rest lets the last note ring out.'), phr('A long note, then walk back down. Let the long note sing.'), phr('Step down one string at a time and finish on a four-beat note.')],
  },
  {
    id: 'crane', name: 'Crane', kanji: '鶴', scale: 'kumoi', bpm: 66, level: 2,
    blurb: 'Pairs of quick notes between long ones, and a held silence in the middle.',
    bars: '4/1 6/.5 7/.5 9/2 | 8/1 7/.5 6/.5 7/2 | 4/1 6/.5 7/.5 9/1 10/1 | 9/2 r/2 | 10/1 9/.5 8/.5 7/1 6/1 | 7/1 6/.5 5/.5 4/2 | 6/1 7/1 9/1 7/1 | 4/4',
    tips: [phr('Quick pairs of half-beats like a bird lifting off, then a long landing.'), phr('The same shape with a bigger leap: look ahead to where your finger lands.'), phr('Two beats of ma at the end of the phrase. Keep still and listen.'), phr('Slide down in steps and rest on the lowest string.')],
  },
  {
    id: 'blossom', name: 'Cherry Blossoms', kanji: '桜', scale: 'hirajoshi', bpm: 72, level: 2,
    blurb: 'A simplified spring melody in the hirajoshi tuning, built from three neighbouring strings.',
    bars: '4/1 4/1 5/2 | 4/1 4/1 5/2 | 4/1 5/1 6/1 5/1 | 4/1 5/1 4/1 3/1 | 2/2 r/2 | 4/1 4/1 5/2 | 4/1 5/1 6/1 5/1 | 4/1 3/1 2/2',
    tips: [phr('Two repeated notes and a step up. Use a different finger for each repeat.'), phr('Up to the highest note and back, in even beats.'), phr('Two beats of ma: the melody pauses before it comes home.'), phr('The opening returns, then settles down to the low string.')],
  },
  {
    id: 'moon', name: 'Moon over Water', kanji: '月', scale: 'kumoi', bpm: 60, level: 3,
    blurb: 'Slow notes that bend: press behind the bridge to make the string sing upward.',
    bars: '5/2 7/2 | 6/2^ 5/2 | 7/2 9/1 7/1 | 8/2^ r/2 | 9/2 7/1 5/1 | 6/1 7/1 8/2^^ | 7/2 5/2 | 5/4',
    tips: [phr('Two long notes. Warm up your fingers before the bends.'), phr('The gold ring means oshide: press the string behind the bridge to lift it a half step.'), phr('A rising line, then a bend and a rest.'), phr('Press further back for a whole step on the long note, then come home.')],
  },
  {
    id: 'rain', name: 'Rain on Bamboo', kanji: '雨', scale: 'iwato', bpm: 84, level: 4,
    blurb: 'Patter of quick notes and the first sweep across the strings.',
    bars: '6/.5 7/.5 6/.5 7/.5 8/1 r/1 | 9/.5 8/.5 9/.5 8/.5 7/1 r/1 | 6/.5 7/.5 8/.5 9/.5 10/1 r/1 | g5-10/2 r/2 | 10/.5 9/.5 8/.5 7/.5 8/1 6/1 | 7/.5 6/.5 7/.5 6/.5 5/1 r/1 | g10-4/2 5/1 4/1 | 4/4',
    tips: [phr('Raindrops: pairs of quick notes on neighbouring strings.'), phr('Four quick notes climbing, then a beat of ma.'), phr('Drag one finger across the strings in a single stroke: a sweep (kakizume).'), phr('Sweep back down, finish on a low string and let it ring.')],
  },
  {
    id: 'river', name: 'River to the Sea', kanji: '川', scale: 'ryukyu', bpm: 92, level: 5,
    blurb: 'The flowing piece: runs, a bend, two-string chords and long sweeps.',
    bars: '3/1 6/1 8/1 6/1 | 4/1 7/1 9/1^ r/1 | 5/.5 6/.5 7/.5 8/.5 9/1 7/1 | g4-11/2 11/2 | 11/1 9/1 8/1^ 6/1 | 3+8/1 4+9/1 5+10/1 6+11/1 | g11-3/3 r/1 | 3/4',
    tips: [phr('A rolling figure on four strings, like a river finding its way.'), phr('A run of quick notes that ends on a held top note.'), phr('A long sweep to the top, then a held note.'), phr('Two-string chords stepping up, a long sweep down, and home.')],
  },
];

// ---- compiling a piece to items ---------------------------------------------------------------------------------------
const cache = new Map();
// Items: { kind: 'note' | 'rest' | 'sweep', beat (from the start of the piece), dur (beats), s (string index 0-12), p (press 0-2), sid, bar }
export function parsePiece(piece) {
  if (cache.has(piece.id)) return cache.get(piece.id);
  const items = []; let sid = 0;
  piece.bars.split('|').forEach((bar, bi) => {
    let beat = bi * 4;
    for (const tok of bar.trim().split(/\s+/)) {
      const [what, rest] = tok.split('/'), press = (rest.match(/\^/g) ?? []).length, dur = parseFloat(rest);
      if (what === 'r') items.push({ kind: 'rest', beat, dur, bar: bi });
      else if (what[0] === 'g') {
        const [a, b] = what.slice(1).split('-').map((x) => Number(x) - 1), dir = b >= a ? 1 : -1, n = Math.abs(b - a) + 1;
        for (let k = 0; k < n; k++) items.push({ kind: 'sweep', beat: beat + (dur * k) / n, dur: dur / n, s: a + dir * k, p: 0, sid, si: k, sn: n, bar: bi });
        sid += 1;
      } else for (const part of what.split('+')) items.push({ kind: 'note', beat, dur, s: Number(part) - 1, p: press, bar: bi, chord: what.includes('+') });
      beat += dur;
    }
  });
  const out = { items, bars: piece.bars.split('|').length };
  // fingers: thumb, index, middle in turn (sweeps use the thumb)
  let f = 0;
  for (const it of items) { if (it.kind === 'note') { it.fin = f % 3; f += 1; } else if (it.kind === 'sweep') it.fin = 0; }
  cache.set(piece.id, out);
  return out;
}
export const barBeats = 4;
export const beatDur = (piece, speed = 1) => 60 / piece.bpm / speed;
export const barDur = (piece, speed = 1) => beatDur(piece, speed) * 4;
export const pieceSeconds = (piece) => Math.round(parsePiece(piece).bars * barDur(piece));
export const stringsUsed = (piece, b0, b1) => [...new Set(parsePiece(piece).items.filter((i) => i.bar >= b0 && i.bar < b1 && i.s !== undefined).map((i) => i.s))].sort((a, b) => a - b);

// Why the teacher plays a note this way (Watch and Learn captions). Derived from the note and its neighbours so it is always true.
export function whyOf(piece, item) {
  const items = parsePiece(piece).items, i = items.indexOf(item);
  const prev = items.slice(0, i).reverse().find((x) => x.kind !== 'rest' && x.beat < item.beat);
  const name = `string ${item.s + 1}`;
  if (item.kind === 'rest') return `Ma: a rest of ${item.dur} beats. Keep still and let the last sound fade; the silence is part of the music.`;
  if (item.kind === 'sweep') return item.si === 0 ? 'Kakizume: one finger sweeps across neighbouring strings in a single stroke, so each string sounds in turn.' : 'Keep the stroke smooth; the finger does not stop between strings.';
  if (item.p > 0) return `Oshide: press ${name} behind its bridge (${item.p === 1 ? 'close to it, a half step' : 'further back, a whole step'}) and the pitch bends up like a voice.`;
  if (item.chord) return 'Two strings together: pluck both with two fingers at the same moment.';
  if (!prev) return `Begin on ${name}. Use the thumb, the pick (tsume) sits just to the right of the bridge.`;
  const d = item.s - prev.s;
  if (d === 0) return `Same string again, with the next finger (${FINGERS[item.fin]}) so the notes stay even.`;
  if (Math.abs(d) === 1) return `One string ${d > 0 ? 'up' : 'down'}: a neighbouring step in the tuning set by the bridges.`;
  return `A leap of ${Math.abs(d)} strings ${d > 0 ? 'up' : 'down'}: look ahead to where the finger will land.`;
}

// ---- turning segments into timed events ------------------------------------------------------------------------------
// Segments: { kind: 'count' } { kind: 'play'|'echo'|'listen'|'auto', b0, b1 }.
// Events: { t, who: 'note'|'teach'|'ens'|'click'|'ma', s, p, dur (s), fin, sw, sid, si, vel, layer, cnt, ph, item }
export function buildRun(piece, segments, startT, { click = false, speed = 1 } = {}) {
  const bd = beatDur(piece, speed), events = [], bars = [], segs = [], P = parsePiece(piece);
  let T = startT;
  for (const seg of segments) {
    if (seg.kind === 'count') {
      for (let i = 0; i < 4; i++) events.push({ t: T + i * bd, who: 'click', s: -1, k: i === 0 ? 'accent' : 'beat', cnt: true });
      bars.push({ t0: T, t1: T + bd * 4, idx: -1 }); segs.push({ kind: 'count', t0: T, t1: T + bd * 4 });
      T += bd * 4;
      continue;
    }
    const kind = seg.kind, who = kind === 'listen' || kind === 'auto' ? 'teach' : 'note';
    for (const it of P.items) {
      if (it.bar < seg.b0 || it.bar >= seg.b1) continue;
      const t = T + (it.beat - seg.b0 * 4) * bd, dur = it.dur * bd;
      if (it.kind === 'rest') { if (it.dur >= MA.minBeats) events.push({ t, who: kind === 'play' || kind === 'echo' ? 'ma' : 'mat', s: -1, dur, item: it, ph: it.bar >> 1 }); continue; }
      events.push({ t, who, s: it.s, p: it.p, dur, fin: it.fin, sw: it.kind === 'sweep', sid: it.sid, si: it.si, sn: it.sn, vel: 0.9, item: it, ph: it.bar >> 1 });
    }
    // accompaniment (only for whole-piece runs): layer 1 = a low string on each bar, layer 2 = a soft octave above each melody note
    if (kind === 'play' || kind === 'auto') {
      for (let b = seg.b0; b < seg.b1; b++) events.push({ t: T + (b - seg.b0) * 4 * bd, who: 'ens', s: 0, p: 0, dur: bd * 4, vel: 0.5, layer: 1, ph: b >> 1 });
      for (const it of P.items) if (it.kind === 'note' && it.bar >= seg.b0 && it.bar < seg.b1 && it.s + 5 <= 12 && !it.chord) events.push({ t: T + (it.beat - seg.b0 * 4) * bd + bd * 0.02, who: 'ens', s: it.s + 5, p: 0, dur: it.dur * bd, vel: 0.22, layer: 2, ph: it.bar >> 1 });
    }
    for (let b = seg.b0; b < seg.b1; b++) bars.push({ t0: T + (b - seg.b0) * 4 * bd, t1: T + (b - seg.b0 + 1) * 4 * bd, idx: b });
    segs.push({ kind, t0: T, t1: T + (seg.b1 - seg.b0) * 4 * bd, b0: seg.b0, b1: seg.b1 });
    T += (seg.b1 - seg.b0) * 4 * bd;
  }
  events.sort((a, b) => a.t - b.t || (a.s ?? 0) - (b.s ?? 0));
  void click;
  return { T0: startT, end: T, events, bars, segs };
}

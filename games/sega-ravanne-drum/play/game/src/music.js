// Pieces, stroke notation and the numbers that drive judging and scoring. Pure data + pure functions.
//
// Notation: one string of 12 characters per bar. 12/8 time: four beats of three slots (triplet eighths), so the bar is one turn of the beam.
//   .  rest
//   B  ravanne boom (tap the drum)           s  ravanne slap (slide across the drum)
//   t  triangle ting (tap the triangle)      m  maravanne shake (swipe across the rattle pad)
//   w  warm the skin (press and hold the fire pad); the following '-' slots are its length
// A hold ends one slot before the slot after its last '-', so there is room to let go.
// `form` has one letter per bar: p = play along, c = CALL (the band plays it, you listen), r = RESPONSE (you answer the call).

export const KINDS = {
  B: { id: 'boom', pad: 'drum', name: 'Boom', how: 'Tap the drum' },
  s: { id: 'slap', pad: 'drum', name: 'Slap', how: 'Slide across the drum' },
  t: { id: 'ting', pad: 'tri', name: 'Ting', how: 'Tap the triangle' },
  m: { id: 'shake', pad: 'shk', name: 'Shake', how: 'Swipe across the maravanne' },
  w: { id: 'warm', pad: 'fire', name: 'Warm', how: 'Press and hold the fire' },
};
export const KIND_BY_ID = Object.fromEntries(Object.values(KINDS).map((k) => [k.id, k]));
export const SLOTS = 12;

const mk = (pat, form) => ({ pat, form });
export const PIECES = [
  {
    id: 'first-beat', name: 'First Beat', sub: 'Boom and slap on the ravanne', bpm: 96, level: 1, groove: 0,
    blurb: 'Just the goat-skin drum: steady booms on the beat, then a first slap. A calm way to feel the shuffle.',
    bars: ['B..B..B..B..', 'B..B..B..B..', 'B..B..B.B.B.', 'B..B.sB..B..', 'B..B..B.B.s.', 'B..B..B.B.s.', 'B.sB.sB..B..', 'B..B..B.B.B.', 'B.sB..B.sB..', 'B.sB..B.sB..', 'B..B.sB.sB.s', 'B..B..B.....'],
    form: 'ppppcrppcrpp',
  },
  {
    id: 'triangle-ting', name: 'Triangle Ting', sub: 'Bring in the triangle', bpm: 104, level: 2, groove: 1,
    blurb: 'The bright triangle answers the drum. Hop your finger from skin to metal and back.',
    bars: ['B..B..B..B..', 'B..t..B..t..', 'B..t..B.sB.t', 'B.t.B.t.B.t.', 'B..t..B.s.t.', 'B..t..B.s.t.', 't..B.sB..t.s', 'B.tB.tB.tB.t', 'B..t.sB..t.s', 'B..t.sB..t.s', 'B.sB.sB.t.t.', 'B..t..B.....'],
    form: 'ppppcrppcrpp',
  },
  {
    id: 'maravanne-rain', name: 'Maravanne Rain', sub: 'Shake the seed rattle', bpm: 110, level: 2, groove: 2,
    blurb: 'The maravanne is a tray of seeds. Swipe across its pad for a shower of shakes between the booms.',
    bars: ['B..B..B..B..', 'B.mB.mB.mB.m', 'B..m..B.m.m.', 'B.mB.sB.mB.m', 'm.mB..m.mB..', 'm.mB..m.mB..', 'B.tm.sB.tm.s', 'B.mB.tB.mB.t', 'B.m.m.B.sB.m', 'B.m.m.B.sB.m', 'm.mt.sm.mt.s', 'B..m..B.....'],
    form: 'ppppcrppcrpp',
  },
  {
    id: 'warm-the-skin', name: 'Warm the Skin', sub: 'Tune the drum by the fire', bpm: 114, level: 3, groove: 0,
    blurb: 'The skin slackens as you play. Hold the fire pad to warm it and the drum rings brighter and scores more.',
    bars: ['B..B..B..B..', 'B..B..w-----', 'B.sB..B.t.s.', 'w-----B..B..', 'B..t.sB..t.s', 'B..t.sB..t.s', 'B.mB.sw-----', 'B.tB.mB.sB.t', 'w-----B.m.t.', 'B..B.sB.mB.s', 'B.mB.sB.tw--', 'B..B..B.....'],
    form: 'ppppcrpppppp',
  },
  {
    id: 'full-sega', name: 'Full Sega', sub: 'The whole band together', bpm: 120, level: 4, groove: 1,
    blurb: 'Drum, triangle, rattle and fire in one tune: the shuffle that fills the beach at dusk.',
    bars: ['B.tB.mB.tB.m', 'B.sB.tB.sB.t', 'm.mB.sw-----', 'B.tm.sB.tm.s', 'B.sB.tB.mB.s', 'B.sB.tB.mB.s', 'w-----B.t.s.', 'B.mB.tB.sB.m', 't.tB.mw-----', 't.tB.mw-----', 'B.mt.sB.mt.s', 'B.tB.mB.....'],
    form: 'ppppcrppcrpp',
  },
  {
    id: 'moonlit-fete', name: 'Moonlit Fête', sub: 'The longest, fastest night', bpm: 128, level: 5, groove: 2,
    blurb: 'Sixteen bars at full tempo, with quick runs and a warm-up in the middle. Keep the dancer swaying to the last stroke.',
    bars: ['B.tB.mB.tB.m', 'BsmB.sBsmB.s', 'w-----B.tm.s', 'B.mB.tB.sB.t', 'B.sB.tB.mB.s', 'B.sB.tB.mB.s', 'm.mt.sB.mt.s', 'w-----B.m.t.', 'BstB.mBstB.m', 'BstB.mBstB.m', 'B.sm.tB.sm.t', 'B.sm.tB.sm.t', 'm.sB.tw-----', 'm.sB.tw-----', 'B.tB.sB.mB.s', 'B..B..B.....'],
    form: 'ppppcrppcrppcrpp',
  },
];
// the response bar must repeat its call bar exactly (the data above does; the test file checks it)

export const slotDur = (p, speed = 1) => 20 / (p.bpm * speed);                   // 3 slots per beat
export const barDur = (p, speed = 1) => SLOTS * slotDur(p, speed);
export const HOLD_TAIL = 1;

const parsed = new Map();
export function parsePiece(p) {
  if (parsed.has(p.id)) return parsed.get(p.id);
  const cues = []; let n = 0;
  p.bars.forEach((bar, b) => {
    for (let s = 0; s < SLOTS; s++) {
      const c = bar[s];
      if (!c || c === '.' || c === '-') continue;
      const k = KINDS[c];
      if (!k) continue;
      let len = 1;
      if (c === 'w') while (s + len < SLOTS && bar[s + len] === '-') len += 1;
      cues.push({ n: n++, bar: b, slot: s, abs: b * SLOTS + s, kind: k.id, pad: k.pad, len, long: c === 'w', form: p.form[b] });
    }
  });
  parsed.set(p.id, cues);
  return cues;
}

export const JUDGE = { perfect: 0.055, great: 0.1, good: 0.16 };
export const TIMING = [{ id: 'relaxed', name: 'Relaxed', k: 1.45 }, { id: 'standard', name: 'Standard', k: 1 }, { id: 'tight', name: 'Tight', k: 0.75 }];
export const SCORE = { perfect: 300, great: 200, good: 100, off: 40, miss: 0 };
export const WEIGHT = { perfect: 1, great: 0.78, good: 0.5, off: 0.2, miss: 0 };
export const SWIPE_MIN = 46;          // virtual units of finger travel that count as a slide or a shake
export const LOOKAHEAD = 0.12;
export const APPROACH = 0.78;         // part of a bar (one turn of the beam) in which a dot drops onto the rim
export const GROOVE = { perfect: 0.045, great: 0.03, good: 0.012, off: -0.03, miss: -0.1, layers: [0.2, 0.45, 0.7] };
export const LEARN = { pass: 0.62, tries: 3 };
export const TENSION = { start: 0.8, barLoss: 0.06, strokeLoss: 0.004, warmGain: 0.4, slack: 0.35, min: 0.55, max: 1.2 };
export const tensionMult = (t) => TENSION.min + (TENSION.max - TENSION.min) * Math.max(0, Math.min(1, t));

export const comboMult = (c) => 1 + Math.min(3, Math.floor(c / 10) * 0.5);
export const accuracyToStars = (a) => (a >= 0.9 ? 3 : a >= 0.75 ? 2 : a >= 0.55 ? 1 : 0);
export const gradeOf = (a) => (a >= 0.95 ? 'S' : a >= 0.85 ? 'A' : a >= 0.72 ? 'B' : a >= 0.55 ? 'C' : 'D');

// Band accompaniment per bar: [slot, voice, velocity, layer]. Layer 0 always sounds; higher layers join as the groove builds.
// The band never plays the player's own strokes loudly: it keeps the shuffle, the bass and the colour round them.
const SHUF = [0, 2, 3, 5, 6, 8, 9, 11];
const shuffle = (v) => SHUF.map((s, i) => [s, 'shk', i % 2 ? v * 0.7 : v, 0]);
export const GROOVES = [
  [...shuffle(0.3), [0, 'bass', 0.8, 0], [6, 'bass', 0.6, 0], [5, 'bass', 0.45, 1], [9, 'bass', 0.5, 1], [3, 'knock', 0.5, 1], [8, 'knock', 0.45, 1], [0, 'clap', 0.5, 2], [6, 'clap', 0.45, 2], [9, 'clap', 0.4, 2], [0, 'bell', 0.5, 3], [6, 'bell', 0.4, 3]],
  [...shuffle(0.28), [0, 'bass', 0.8, 0], [7, 'bass', 0.55, 0], [3, 'bass', 0.4, 1], [10, 'bass', 0.4, 1], [2, 'knock', 0.5, 1], [5, 'knock', 0.4, 1], [9, 'knock', 0.45, 1], [3, 'clap', 0.5, 2], [9, 'clap', 0.5, 2], [0, 'bell', 0.5, 3], [3, 'bell', 0.4, 3], [6, 'bell', 0.5, 3]],
  [...shuffle(0.34), [0, 'bass', 0.85, 0], [5, 'bass', 0.5, 0], [8, 'bass', 0.5, 0], [2, 'knock', 0.5, 1], [6, 'knock', 0.5, 1], [11, 'knock', 0.4, 1], [3, 'clap', 0.5, 2], [6, 'clap', 0.4, 2], [9, 'clap', 0.5, 2], [0, 'bell', 0.5, 3], [4, 'bell', 0.4, 3], [8, 'bell', 0.4, 3]],
];

// Build the timeline for a list of segments starting at song time `t0`.
//   count   one bar of count-in clicks
//   watch   bars b0..b1 performed by the lead drummer (a demonstration; not judged)
//   echo    bars b0..b1 for the player, groove layer 0 only (every bar is the player's)
//   play    bars b0..b1 for the player following the piece's form (call bars are played by the band), layers follow the groove meter
//   auto    bars b0..b1 performed by the band with the full groove (Watch and Learn)
// Returns { cues, events, bars, end }. All times in seconds on the song clock.
export function buildRun(piece, segments, t0, opts = {}) {
  const speed = opts.speed ?? 1, sd = slotDur(piece, speed), all = parsePiece(piece), groove = GROOVES[piece.groove % GROOVES.length];
  const cues = [], events = [], bars = []; let t = t0;
  for (const seg of segments) {
    if (seg.kind === 'count') {
      for (let i = 0; i < 4; i++) events.push({ t: t + i * 3 * sd, who: 'click', voice: i === 0 ? 'accent' : 'beat', vel: 0.8, layer: 0, cnt: i + 1 });
      bars.push({ t0: t, t1: t + SLOTS * sd, bar: -1, count: true, role: 'count' });
      t += SLOTS * sd;
      continue;
    }
    for (let b = seg.b0; b < seg.b1; b++) {
      const bt = t + (b - seg.b0) * SLOTS * sd, f = piece.form[b];
      const role = seg.kind === 'watch' ? 'watch' : seg.kind === 'echo' ? 'echo' : seg.kind === 'auto' ? (f === 'c' ? 'call' : f === 'r' ? 'response' : 'play') : f === 'c' ? 'call' : f === 'r' ? 'response' : 'play';
      bars.push({ t0: bt, t1: bt + SLOTS * sd, bar: b, seg: seg.kind, role });
      const layered = seg.kind === 'play' || seg.kind === 'auto';
      for (const [slot, voice, vel, layer] of groove) {
        if (layer > 0 && !layered) continue;
        events.push({ t: bt + slot * sd, who: 'ens', voice, vel, layer });
      }
    }
    for (const c of all) {
      if (c.bar < seg.b0 || c.bar >= seg.b1) continue;
      const ct = t + (c.abs - seg.b0 * SLOTS) * sd;
      const dur = c.long ? (c.len - HOLD_TAIL) * sd : 0;
      const demo = seg.kind === 'watch' || seg.kind === 'auto' || (seg.kind === 'play' && c.form === 'c');
      cues.push({ id: `${seg.kind}${c.n}@${Math.round(ct * 1000)}`, n: c.n, t: ct, dur, end: ct + dur, kind: c.kind, pad: c.pad, long: c.long, slot: c.slot, len: c.len, bar: c.bar, bd: SLOTS * sd, demo, seg: seg.kind, j: null, cov: 0 });
    }
    t += (seg.b1 - seg.b0) * SLOTS * sd;
  }
  events.sort((a, b) => a.t - b.t);
  cues.sort((a, b) => a.t - b.t);
  return { cues, events, bars, end: t };
}

// A plain-words description of a phrase (bars b0..b1), used by Watch and Learn's Think card.
export function describePhrase(piece, b0, b1) {
  const cues = parsePiece(piece).filter((c) => c.bar >= b0 && c.bar < b1);
  const count = { boom: 0, slap: 0, ting: 0, shake: 0, warm: 0 };
  for (const c of cues) count[c.kind] += 1;
  const names = { boom: 'boom', slap: 'slap', ting: 'ting', shake: 'shake', warm: 'warm-up' };
  const parts = [];
  for (const k of Object.keys(count)) if (count[k]) parts.push(`${count[k]} ${names[k]}${count[k] === 1 ? '' : 's'}`);
  const first = cues[0] ? KIND_BY_ID[cues[0].kind].name.toLowerCase() : 'nothing';
  const roles = new Set(piece.form.slice(b0, b1));
  return { parts, first, n: cues.length, cues, call: roles.has('c'), response: roles.has('r') };
}

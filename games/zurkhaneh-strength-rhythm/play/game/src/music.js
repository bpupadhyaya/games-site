// Pieces, move notation and the numbers that drive judging and scoring. Pure data + pure functions.
//
// Notation: one string of 8 characters per bar (4/4, eight slots = eighth notes).
//   .  rest        t  stomp (tap)        l r u d  club swing: swipe left / right / up / down
//   h  shield lift (press and hold), the following '-' slots are its length
//   w  whirl (draw circles),          the following '-' slots are its length
// A hold or whirl ends half a slot before the slot after its last '-', so there is room to let go.

export const KINDS = {
  t: { id: 'tap', name: 'Stomp', short: 'STOMP', how: 'Tap anywhere' },
  l: { id: 'l', name: 'Club swing left', short: 'SWING', how: 'Swipe left' },
  r: { id: 'r', name: 'Club swing right', short: 'SWING', how: 'Swipe right' },
  u: { id: 'u', name: 'Club swing up', short: 'SWING', how: 'Swipe up' },
  d: { id: 'd', name: 'Club swing down', short: 'SWING', how: 'Swipe down' },
  h: { id: 'hold', name: 'Shield lift', short: 'LIFT', how: 'Press and hold' },
  w: { id: 'whirl', name: 'Whirl', short: 'WHIRL', how: 'Draw circles' },
};
export const KIND_BY_ID = { tap: KINDS.t, l: KINDS.l, r: KINDS.r, u: KINDS.u, d: KINDS.d, hold: KINDS.h, whirl: KINDS.w };

export const PIECES = [
  {
    id: 'warm-up', name: 'Warm-Up Footwork', sub: 'Stomps and gentle swings', bpm: 84, level: 1, groove: 0,
    blurb: 'Even stomps, then the first club swings. A calm way to find the beat.',
    bars: ['t.t.t.t.', 't.t.t.t.', 't.t.l.r.', 't.l.t.r.', 'l.r.l.r.', 't.t.u.d.', 'l.r.u.d.', 't.t.t.t.'],
  },
  {
    id: 'shield-lifts', name: 'Shield Lifts', sub: 'Press, hold and let go', bpm: 92, level: 2, groove: 1,
    blurb: 'Lift the wooden shield and hold it for two beats, then set it down on the ring.',
    bars: ['h---t.t.', 'h---h---', 't.l.h---', 'r.l.h---', 'u...h---', 't.t.h---', 'l.r.h-t.', 'h---t.t.'],
  },
  {
    id: 'club-swings', name: 'Club Swings', sub: 'Runs of quick swipes', bpm: 100, level: 3, groove: 0,
    blurb: 'Alternating swings in four directions, with runs of eighth notes.',
    bars: ['l.r.l.r.', 'lrlrlrlr', 'l.r.u.d.', 'u.d.u.d.', 'l.l.r.r.', 'lrlr.u.d', 't.l.r.u.', 'l.r.lrlr', 'u.d.l.r.', 'l.r.t.t.'],
  },
  {
    id: 'the-whirl', name: 'The Whirl', sub: 'Spin with the circle', bpm: 108, level: 3, groove: 2,
    blurb: 'Draw circles with one finger for the whole length of the whirl.',
    bars: ['t.t.w---', 'w---t.t.', 'l.r.w---', 'w-------', 'u.d.w---', 'h---w---', 'w---h---', 'l.r.l.r.', 'w-------', 't.t.t.t.'],
  },
  {
    id: 'full-circle', name: 'Full Circle', sub: 'Every move together', bpm: 120, level: 4, groove: 1,
    blurb: 'Stomps, swings, lifts and whirls chained into one routine.',
    bars: ['t.t.l.r.', 'h---w---', 'l.r.u.d.', 'lrlr.t.t', 'w-------', 'h---l.r.', 'u.d.t.t.', 'w---h---', 'lrlrlrlr', 'u.d.l.r.', 'h---w---', 't.t.t.t.'],
  },
  {
    id: 'champions-round', name: "Champion's Round", sub: 'The longest, fastest set', bpm: 132, level: 5, groove: 2,
    blurb: 'Sixteen bars at full tempo. Hold the circle together to the last stomp.',
    bars: ['t.t.l.r.', 'lrlr.u.d', 'h---w---', 'l.r.t.t.', 'u.d.u.d.', 'w---h---', 'lrlrlrlr', 't.l.r.u.', 'h---t.t.', 'w-------', 'ud.ud.lr', 'l.r.h---', 'w---t.t.', 'lrlrulrd', 'h---w---', 't.t.t.t.'],
  },
];

export const SLOTS = 8;
export const slotDur = (p, speed = 1) => 30 / (p.bpm * speed);
export const barDur = (p, speed = 1) => SLOTS * slotDur(p, speed);
export const PIECE_BEATS = (p) => p.bars.length * 4;
export const HOLD_TAIL = 0.5;      // a hold or whirl ends this many slots early

// Parse a piece once into its list of moves (positions in slots from the start of bar 0).
const parsed = new Map();
export function parsePiece(p) {
  if (parsed.has(p.id)) return parsed.get(p.id);
  const cues = []; let n = 0;
  p.bars.forEach((bar, b) => {
    for (let s = 0; s < SLOTS; s++) {
      const c = bar[s];
      if (!c || c === '.' || c === '-') continue;
      let len = 1;
      if (c === 'h' || c === 'w') while (s + len < SLOTS && bar[s + len] === '-') len += 1;
      const k = KINDS[c];
      if (!k) continue;
      cues.push({ n: n++, bar: b, slot: s, abs: b * SLOTS + s, kind: k.id, len, long: c === 'h' || c === 'w' });
    }
  });
  parsed.set(p.id, cues);
  return cues;
}

// Which of the eight athletes owns a move (the glyph appears in front of that athlete). Walks the circle in steps of three
// so consecutive moves are never neighbours and the eyes sweep the whole ring.
export const ownerOf = (n) => (n * 3 + 1) % 8;

export const JUDGE = { perfect: 0.055, great: 0.1, good: 0.16 };
export const TIMING = [{ id: 'relaxed', name: 'Relaxed', k: 1.45 }, { id: 'standard', name: 'Standard', k: 1 }, { id: 'tight', name: 'Tight', k: 0.75 }];
export const SCORE = { perfect: 300, great: 200, good: 100, off: 40, miss: 0 };
export const WEIGHT = { perfect: 1, great: 0.78, good: 0.5, off: 0.2, miss: 0 };
export const SWIPE_MIN = 52;          // virtual units of finger travel for a swipe
export const WHIRL_TURN = 2.4;       // radians of turning per second that count as whirling
export const LOOKAHEAD = 0.12;        // audio is scheduled this far ahead of the song clock
export const APPROACH = 1.35;         // seconds a ring takes to close
export const UNISON = { perfect: 0.045, great: 0.03, good: 0.012, off: -0.03, miss: -0.1, layers: [0.2, 0.45, 0.7] };
export const LEARN = { pass: 0.62, tries: 3 };

export const comboMult = (c) => 1 + Math.min(3, Math.floor(c / 10) * 0.5);
export const accuracyToStars = (a) => (a >= 0.9 ? 3 : a >= 0.75 ? 2 : a >= 0.55 ? 1 : 0);
export const gradeOf = (a) => (a >= 0.95 ? 'S' : a >= 0.85 ? 'A' : a >= 0.72 ? 'B' : a >= 0.55 ? 'C' : 'D');

// Drum groove per bar: [slot, voice, velocity, layer]. Layer 0 always sounds, higher layers join as the circle falls into step.
export const GROOVES = [
  [[0, 'bom', 0.95, 0], [2, 'tak', 0.7, 0], [4, 'bom', 0.8, 0], [6, 'tak', 0.7, 0], [1, 'tek', 0.35, 1], [3, 'tek', 0.35, 1], [5, 'tek', 0.35, 1], [7, 'tek', 0.4, 1], [2, 'knock', 0.55, 2], [6, 'knock', 0.55, 2], [7, 'knock', 0.4, 2], [0, 'bell', 0.6, 3], [4, 'stomp', 0.6, 3]],
  [[0, 'bom', 0.95, 0], [3, 'bom', 0.6, 0], [4, 'tak', 0.75, 0], [6, 'tak', 0.65, 0], [1, 'tek', 0.35, 1], [5, 'tek', 0.35, 1], [7, 'tek', 0.4, 1], [2, 'knock', 0.55, 2], [4, 'knock', 0.5, 2], [6, 'knock', 0.55, 2], [0, 'bell', 0.6, 3], [4, 'bell', 0.45, 3], [0, 'stomp', 0.6, 3]],
  [[0, 'bom', 0.95, 0], [2, 'tak', 0.7, 0], [3, 'tek', 0.45, 0], [4, 'bom', 0.8, 0], [6, 'tak', 0.7, 0], [7, 'tek', 0.45, 0], [1, 'tek', 0.3, 1], [5, 'tek', 0.3, 1], [2, 'knock', 0.55, 2], [5, 'knock', 0.5, 2], [6, 'knock', 0.55, 2], [0, 'bell', 0.6, 3], [4, 'stomp', 0.6, 3], [6, 'stomp', 0.5, 3]],
];

// Build the timeline for a list of segments starting at song time `t0`.
//   count          one bar of count-in clicks
//   watch          bars b0..b1 performed by the circle (demonstration; not judged)
//   echo           bars b0..b1 for the player, groove layer 0 only
//   play           bars b0..b1 for the player, groove layers follow the unison meter
//   auto           bars b0..b1 performed by the circle with the full groove (Watch and Learn)
// Returns { cues, events, bars, end }. All times in seconds on the song clock.
export function buildRun(piece, segments, t0, opts = {}) {
  const speed = opts.speed ?? 1, sd = slotDur(piece, speed), all = parsePiece(piece), groove = GROOVES[piece.groove % GROOVES.length];
  const cues = [], events = [], bars = []; let t = t0;
  for (const seg of segments) {
    if (seg.kind === 'count') {
      for (let i = 0; i < 4; i++) events.push({ t: t + i * 2 * sd, who: 'click', voice: i === 0 ? 'accent' : 'beat', vel: 0.8, layer: 0, cnt: i + 1 });
      bars.push({ t0: t, t1: t + SLOTS * sd, bar: -1, count: true });
      t += SLOTS * sd;
      continue;
    }
    for (let b = seg.b0; b < seg.b1; b++) {
      const bt = t + (b - seg.b0) * SLOTS * sd;
      bars.push({ t0: bt, t1: bt + SLOTS * sd, bar: b, seg: seg.kind });
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
      cues.push({ id: `${seg.kind}${c.n}@${Math.round(ct * 1000)}`, n: c.n, t: ct, dur, end: ct + dur, kind: c.kind, long: c.long, owner: ownerOf(c.n), demo: seg.kind === 'watch' || seg.kind === 'auto', seg: seg.kind, j: null, j2: null, cov: 0, cw: c.n % 2 ? 1 : -1 });
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
  const count = { tap: 0, swing: 0, hold: 0, whirl: 0 };
  for (const c of cues) { if (c.kind === 'tap') count.tap++; else if (c.kind === 'hold') count.hold++; else if (c.kind === 'whirl') count.whirl++; else count.swing++; }
  const parts = [];
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (count.tap) parts.push(plural(count.tap, 'stomp'));
  if (count.swing) parts.push(plural(count.swing, 'club swing'));
  if (count.hold) parts.push(plural(count.hold, 'shield lift'));
  if (count.whirl) parts.push(plural(count.whirl, 'whirl'));
  const first = cues[0] ? KIND_BY_ID[cues[0].kind].name.toLowerCase() : 'nothing';
  return { parts, first, n: cues.length, cues };
}

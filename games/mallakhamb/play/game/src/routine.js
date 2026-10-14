// Mallakhamb: the rules as data. Move library, routines (built deterministically from a fixed seed), timing windows, scoring and the
// balance model. Pure and deterministic: nothing here reads a clock or a random source other than the local seeded generator below.

// ---- the moves ---------------------------------------------------------------------------------------------------------------------
// g = the gesture that performs it; pose = which pose the performer settles into; dH = how far it moves the performer along the pole
// (in steps); spin = a full turn about the pole while moving (+1 clockwise seen from above, -1 the other way); beats = hold length.
export const MOVES = {
  salute: { name: 'Salute', g: 'tap', pose: 'salute', dH: 0, beats: 0, tip: 'Tap to salute the pole.' },
  grip: { name: 'Grip Climb', g: 'up', pose: 'grip', dH: 1, beats: 0, tip: 'Swipe up to climb on a firm grip.' },
  tuck: { name: 'Tuck Pull', g: 'up', pose: 'tuck', dH: 1, beats: 0, tip: 'Swipe up to pull the knees in and climb.' },
  wrapL: { name: 'Wrap Left', g: 'left', pose: 'wrap', dH: 0, spin: -1, beats: 0, tip: 'Swipe left to wrap round the pole to the left.' },
  wrapR: { name: 'Wrap Right', g: 'right', pose: 'wrap', dH: 0, spin: 1, beats: 0, tip: 'Swipe right to wrap round the pole to the right.' },
  slide: { name: 'Slide Down', g: 'down', pose: 'slide', dH: -1, beats: 0, tip: 'Swipe down to slide a step down the pole.' },
  flag: { name: 'Flag', g: 'hold', pose: 'flag', dH: 0, beats: 3, tip: 'Press and hold, then steer to keep the body level.' },
  split: { name: 'Straddle', g: 'hold', pose: 'split', dH: 0, beats: 3, tip: 'Press and hold, then steer to stay balanced.' },
  ulta: { name: 'Upside-Down Hang', g: 'hold', pose: 'ulta', dH: 0, beats: 4, tip: 'Press and hold, then steer through the long hang.' },
  vsplit: { name: 'Vertical Split', g: 'hold', pose: 'vsplit', dH: 0, beats: 3, tip: 'Press and hold, then steer to keep the leg high.' },
};
export const MOVE_ORDER = ['salute', 'grip', 'tuck', 'wrapL', 'wrapR', 'slide', 'flag', 'split', 'ulta', 'vsplit'];
export const GESTURE_NAMES = { tap: 'Tap', up: 'Swipe up', down: 'Swipe down', left: 'Swipe left', right: 'Swipe right', hold: 'Press and hold' };
export const MAX_H = 3;                       // steps up the pole
export const COUNT_IN = 4;                    // beats before the first move

// ---- timing, scoring, balance ------------------------------------------------------------------------------------------------------
export const JUDGE = { perfect: 0.06, great: 0.11, good: 0.17 };             // seconds either side of the beat, at "Standard"
export const TIMING = [{ name: 'Relaxed', k: 1.4 }, { name: 'Standard', k: 1 }, { name: 'Tight', k: 0.75 }];
export const LEARN_WINDOW = 1.35;             // Learn widens every window by this factor
export const LEARN_DRIFT = 0.75;              // and weakens the balance drift of a hold to this share
export const SPEEDS = [{ name: 'Slow (75%)', k: 0.75 }, { name: 'Normal', k: 1 }];
export const SWIPE_MIN = 46;                  // virtual units a finger must travel to count as a swipe
export const STEER_RANGE = 150;               // virtual units of finger travel that cancel the full balance drift
export const BAL = { safe: 0.4, fall: 1.0, fallTime: 0.45, gain: 1.1 };      // |balance| <= safe is "in line"; past fall for fallTime slips
export const SCORE = { perfect: 300, great: 200, good: 100, miss: 0 };
export const HOLD_SCORE = 500;
export const WEIGHT = { perfect: 1, great: 0.8, good: 0.55, miss: 0 };
export const FLOW = { start: 0.6, perfect: 0.045, great: 0.03, good: 0.01, miss: -0.16 };
export const COMBO_STEP = 8;                  // every 8 clean moves in a row adds one to the multiplier
export const COMBO_MAX = 4;
export const STAR_AT = [0.5, 0.75, 0.9];
export const HOLD_GRADES = [{ at: 0.85, g: 'perfect' }, { at: 0.65, g: 'great' }, { at: 0.45, g: 'good' }];
export const DEMO_RUNS = 3;
export const THINK_CHOICES = [2, 3, 5, 8, 10];   // Watch and Learn "think" seconds; 5 is the default, 10 the cap
export const REVEAL_SECONDS = 2;
export const PHRASE = 4;                      // moves per Watch and Learn phrase

// ---- routines ----------------------------------------------------------------------------------------------------------------------------
// Each routine: a name, a tempo, how many moves, which moves it may use, the beat gaps it cycles through, how often a hold appears and
// how strongly the balance drifts in a hold. The sequence is built once from `seed`, so a routine is the same every time.
export const ROUTINES = [
  { id: 'first-steps', name: 'First Steps', blurb: 'Climb, slide and hold your first flag.', bpm: 78, count: 10, pool: ['grip', 'tuck', 'slide', 'flag'], gaps: [2, 2, 3], holdEvery: 4, bal: 0.62, seed: 11 },
  { id: 'pole-flow', name: 'Pole Flow', blurb: 'Add wraps either way round the pole.', bpm: 88, count: 14, pool: ['grip', 'tuck', 'wrapL', 'wrapR', 'slide', 'flag'], gaps: [2, 1.5, 2], holdEvery: 5, bal: 0.7, seed: 23 },
  { id: 'flag-and-split', name: 'Flag and Split', blurb: 'Longer holds: the flag and the straddle.', bpm: 96, count: 16, pool: ['grip', 'tuck', 'wrapL', 'wrapR', 'slide', 'flag', 'split'], gaps: [2, 1.5, 1.5], holdEvery: 4, bal: 0.78, seed: 37 },
  { id: 'upside-down', name: 'Upside Down', blurb: 'The long inverted hang joins the set.', bpm: 104, count: 18, pool: ['grip', 'tuck', 'wrapL', 'wrapR', 'slide', 'flag', 'split', 'ulta'], gaps: [1.5, 2, 1.5], holdEvery: 4, bal: 0.84, seed: 41 },
  { id: 'festival-set', name: 'Festival Set', blurb: 'Quicker links, every move in the book.', bpm: 112, count: 22, pool: ['grip', 'tuck', 'wrapL', 'wrapR', 'slide', 'flag', 'split', 'ulta', 'vsplit'], gaps: [1.5, 1, 2, 1.5], holdEvery: 4, bal: 0.9, seed: 53 },
  { id: 'master-routine', name: 'Master Routine', blurb: 'Tight beats, long chains, a full show.', bpm: 120, count: 26, pool: ['grip', 'tuck', 'wrapL', 'wrapR', 'slide', 'flag', 'split', 'ulta', 'vsplit'], gaps: [1, 1.5, 1, 2], holdEvery: 4, bal: 0.96, seed: 67 },
];

function seeded(seed) {                       // mulberry32: a tiny local generator so a routine never changes between runs
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Build the move list of a routine: [{ i, id, beat, dur, g, pose, spin, H, H0, seed }]. `beat` counts from the end of the count-in.
export function buildRoutine(ri) {
  const cfg = ROUTINES[ri], rnd = seeded(cfg.seed * 7919 + 13), seq = [];
  let beat = 0, H = 0, last = '', run = 0, holds = 0;
  const push = (id, gap) => {
    const m = MOVES[id], H0 = H;
    H = Math.max(0, Math.min(MAX_H, H + m.dH));
    seq.push({ i: seq.length, id, beat, dur: m.beats, g: m.g, pose: m.pose, spin: m.spin ?? 0, H, H0, seed: Math.floor(rnd() * 1000) });
    beat += m.beats + gap;
    run = id === last ? run + 1 : 1; last = id;
  };
  push('salute', 2);
  push('grip', cfg.gaps[0]);
  let n = 2, gi = 1;
  const body = cfg.count - 2;
  while (n < body) {
    const gap = cfg.gaps[gi++ % cfg.gaps.length];
    const wantHold = (n % cfg.holdEvery === cfg.holdEvery - 1) && H >= 1;
    const opts = cfg.pool.filter((id) => {
      const m = MOVES[id];
      if (m.dH > 0 && H >= MAX_H) return false;
      if (m.dH < 0 && H <= 0) return false;
      if (H < 1 && (m.g === 'hold' || m.spin)) return false;
      if (wantHold !== (m.g === 'hold')) return false;
      if (id === last && run >= 2) return false;
      return true;
    });
    const pool = opts.length ? opts : cfg.pool.filter((id) => MOVES[id].dH > 0 && H < MAX_H);
    // Prefer the hold we have used least so far, then a random pick, so a long routine shows its whole pool.
    let id = pool[Math.floor(rnd() * pool.length)];
    if (wantHold) { holds += 1; id = pool[(holds + Math.floor(rnd() * 2)) % pool.length]; }
    push(id, gap);
    n += 1;
  }
  while (H > 0) push('slide', cfg.gaps[gi++ % cfg.gaps.length]);       // come back down to the ground
  push('salute', 0);
  return seq;
}

export function moveTime(m, bpm, speed) { return (COUNT_IN + m.beat) * 60 / (bpm * speed); }
export function beatSeconds(bpm, speed) { return 60 / (bpm * speed); }

// The balance drift of a hold at `u` seconds after it starts: two slow sines with phases from the move's seed.
export function drift(m, u, amp) {
  const a = (m.seed % 17) / 17 * 6.283, b = (m.seed % 29) / 29 * 6.283;
  const ramp = Math.min(1, 0.35 + u * 0.6);
  return amp * ramp * (0.62 * Math.sin(u * 1.35 + a) + 0.38 * Math.sin(u * 2.45 + b));
}

export const gradeFromErr = (err, k) => {
  const e = Math.abs(err);
  return e <= JUDGE.perfect * k ? 'perfect' : e <= JUDGE.great * k ? 'great' : e <= JUDGE.good * k ? 'good' : null;
};
export const holdGrade = (ratio) => { for (const h of HOLD_GRADES) if (ratio >= h.at) return h.g; return 'miss'; };
export const comboMult = (chain) => Math.min(COMBO_MAX, 1 + Math.floor(chain / COMBO_STEP));
export const starsOf = (acc) => (acc >= STAR_AT[2] ? 3 : acc >= STAR_AT[1] ? 2 : acc >= STAR_AT[0] ? 1 : 0);
export const gradeName = (acc) => (acc >= 0.95 ? 'Master' : acc >= 0.85 ? 'Expert' : acc >= 0.7 ? 'Performer' : acc >= 0.5 ? 'Apprentice' : 'Beginner');

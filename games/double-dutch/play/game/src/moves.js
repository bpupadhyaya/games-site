// The rule constants and the routines of Double Dutch. Everything the Rules pages print is read from here, so the text cannot drift.
//
// Two ropes turn in opposite directions, one after the other. Seen from the side, a rope touches the ground once for every beat,
// A, B, A, B ...; the jumper must be in the air each time it passes. Some beats carry a CALL (a trick to do on that hop) and some
// beats are "pepper" beats, where the ropes snap to double speed and pass twice in one beat.

export const TRICKS = [
  { id: 'tuck', key: 'u', name: 'Tuck', dir: 'up', code: 'ArrowUp', col: '#ffd23f', blurb: 'Swipe up: pull both knees up to your chest in the air.' },
  { id: 'spin', key: 'l', name: 'Spin', dir: 'left', code: 'ArrowLeft', col: '#ff4fa3', blurb: 'Swipe left: turn a full circle on the spot.' },
  { id: 'kick', key: 'r', name: 'Kick', dir: 'right', code: 'ArrowRight', col: '#35d0ff', blurb: 'Swipe right: kick one foot out to the side.' },
  { id: 'touch', key: 'd', name: 'Touch down', dir: 'down', code: 'ArrowDown', col: '#7be26a', blurb: 'Swipe down: bend and tap the ground with a hand.' },
];
export const TRICK_BY_KEY = Object.fromEntries(TRICKS.map((t) => [t.key, t.id]));
export const TRICK_BY_ID = Object.fromEntries(TRICKS.map((t) => [t.id, t]));
export const DIRS = ['up', 'left', 'right', 'down'];

// Eight blocks. A phrase is eight beats written as characters: '.' a plain beat, u l r d a beat with a call (tuck, spin, kick,
// touch down), p a pepper beat (two passes). `form` lists the phrases in order. Count-in: four beats.
export const LEVELS = [
  { id: 'stoop', name: 'The Stoop', bpm: 84, A: '....u...', B: '..u...u.', form: 'ABAB', blurb: 'Warm-up on the steps: just hop with the ropes and add a tuck when it is called.' },
  { id: 'sidewalk', name: 'Sidewalk', bpm: 90, A: '...l..u.', B: '.u..l..l', form: 'ABAB', blurb: 'The spin joins the tuck.' },
  { id: 'hydrant', name: 'The Hydrant', bpm: 96, A: '..r..l.u', B: 'r..u..l.', form: 'ABAB', blurb: 'Three calls now, one every few beats.' },
  { id: 'fire-escape', name: 'Fire Escape', bpm: 100, A: '.d..r.ul', B: 'u.d.l..r', form: 'ABAB', blurb: 'All four calls: tuck, spin, kick and touch down.' },
  { id: 'block-party', name: 'Block Party', bpm: 100, A: '..u...pp', B: 'l..r.upp', form: 'ABAB', blurb: 'Pepper! The ropes snap to double speed for two beats at a time.' },
  { id: 'rooftop', name: 'Rooftop', bpm: 104, A: 'pp.u.l.d', B: 'r.ppd.u.', C: '.l.pp.r.', form: 'ABCAB', blurb: 'Pepper between the calls, three different phrases.' },
  { id: 'showtime', name: 'Showtime', bpm: 108, A: 'u.l.pprd', B: 'ppl.u.pp', C: 'd.r.l.u.', form: 'ABCAB', blurb: 'Quick changes: call after call with pepper in between.' },
  { id: 'final-round', name: 'Final Round', bpm: 112, A: 'ulpprdpp', B: 'ppd.l.ur', C: 'pp.u.ppl', D: 'rdppu.ld', form: 'ABCDAB', blurb: 'The championship round: long, quick and full of calls.' },
];

// Timing windows in seconds around the moment the rope reaches the ground (scaled by the Timing setting).
export const JUDGE = { perfect: 0.055, good: 0.09 };
export const CLEAR_MARGIN = 0.035;                                    // the ok window is half the air time minus this
export const TIMING = [{ id: 'relaxed', name: 'Relaxed', k: 1.35 }, { id: 'normal', name: 'Normal', k: 1 }, { id: 'strict', name: 'Strict', k: 0.8 }];
export const SCORE = { perfect: 100, good: 70, ok: 40, trick: 150 };
export const WEIGHT = { perfect: 1, good: 0.8, ok: 0.55, miss: 0 };   // accuracy: weight of each judgement
export const LIVES = 3;                                               // tangles allowed in a Play round
export const STARS = [0.55, 0.78, 0.92];                              // result score (accuracy and style) for 1, 2, 3 stars
export const STYLE_SHARE = 0.3;                                       // how much the tricks count in the result score
export const COUNT_IN = 4;                                            // beats of count-in before the first scored pass
export const PRACTICE_SPEED = 0.75;
export const COMBO_STEPS = [0, 4, 8, 16];                             // streak needed for x1, x2, x3, x4
export const THINK = { min: 2, max: 10, def: 5, reveal: 2 };          // Watch and Learn: seconds to look at the routine, then the reveal
export const AIR = { min: 0.24, max: 0.4, k: 0.85 };                  // hop air time = clamp(gap to the next pass * k, min, max)
export const SWIPE = { dist: 34, window: 0.3 };                       // units a finger must travel, and seconds after the tap

export const comboMult = (c) => (c >= COMBO_STEPS[3] ? 4 : c >= COMBO_STEPS[2] ? 3 : c >= COMBO_STEPS[1] ? 2 : 1);
export const starsOf = (v) => (v >= STARS[2] ? 3 : v >= STARS[1] ? 2 : v >= STARS[0] ? 1 : 0);
export const gradeOf = (v) => (v >= 0.97 ? 'S' : v >= 0.9 ? 'A' : v >= 0.78 ? 'B' : v >= 0.55 ? 'C' : 'D');

export const beatsOf = (level) => [...level.form].flatMap((c) => [...level[c]]);
export const beatDur = (level, speed = 1) => 60 / (level.bpm * speed);

// The whole run laid out in time. Pass n touches the ground at passes[n].t; rope A takes the even passes and rope B the odd ones.
// The first COUNT_IN passes are the count-in (nobody is in the ropes yet); scored passes follow.
export function routineOf(level, speed = 1) {
  const beat = beatDur(level, speed), passes = [];
  let cursor = beat, n = 0;
  for (let b = 0; b < COUNT_IN; b++) { passes.push({ n, t: cursor, rope: n % 2 ? 'B' : 'A', scored: false, call: null, pepper: false, beatIdx: b - COUNT_IN }); cursor += beat; n += 1; }
  const T0 = cursor;
  beatsOf(level).forEach((ch, bi) => {
    if (ch === 'p') {
      for (let h = 0; h < 2; h++) { passes.push({ n, t: cursor + h * beat / 2, rope: n % 2 ? 'B' : 'A', scored: true, call: null, pepper: true, beatIdx: bi }); n += 1; }
    } else {
      passes.push({ n, t: cursor, rope: n % 2 ? 'B' : 'A', scored: true, call: TRICK_BY_KEY[ch] ?? null, pepper: false, beatIdx: bi }); n += 1;
    }
    cursor += beat;
  });
  const scored = passes.filter((p) => p.scored);
  scored.forEach((p, i) => { p.i = i; p.j = null; p.err = 0; p.callOk = null; });
  passes.forEach((p, i) => { const nx = passes[i + 1], pv = passes[i - 1]; p.gap = Math.min(nx ? nx.t - p.t : beat, pv ? p.t - pv.t : beat); });
  return { beat, T0, passes, scored, end: cursor + beat * 0.6, beats: beatsOf(level).length, calls: scored.filter((p) => p.call).length };
}

// Air time of a hop that starts for pass p.
export const airOf = (gap) => Math.max(AIR.min, Math.min(AIR.max, gap * AIR.k));
export const clearWindow = (air) => Math.max(0.05, air / 2 - CLEAR_MARGIN);

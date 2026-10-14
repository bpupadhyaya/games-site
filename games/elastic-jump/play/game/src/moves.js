// The rule constants and the routines of Elastic Jump. Everything the Rules pages print is read from here, so the text cannot drift.
//
// The elastic is a long loop held round the ankles of two friends. Its two long sides are the near strand and the far strand.
// A jumper stands beside it and lands in one of four places each time: OUT (in front of both strands), IN (between them),
// ON (one foot on each strand) or SPLIT (one foot in front of both, one behind both). A routine is a chant of such steps.

// depth: where each foot lands, in strand units (-1 far strand, +1 near strand, 0 between them, +-2.4 outside).
export const POSES = [
  { id: 'out', key: 'O', name: 'Out', label: 'OUT', col: '#2f8cff', dark: '#1459b8', depth: [2.4, 2.4], spread: 0.075, blurb: 'Both feet land in front of the elastic, on your own side.' },
  { id: 'in', key: 'I', name: 'In', label: 'IN', col: '#26c281', dark: '#12805a', depth: [0, 0], spread: 0.06, blurb: 'Both feet land together between the two strands.' },
  { id: 'on', key: 'N', name: 'On', label: 'ON', col: '#ff9a2e', dark: '#b8590c', depth: [1, -1], spread: 0.095, blurb: 'One foot lands on the near strand, the other on the far strand, pressing the elastic down.' },
  { id: 'split', key: 'S', name: 'Split', label: 'SPLIT', col: '#b266ff', dark: '#6b2bb8', depth: [2.4, -2.4], spread: 0.13, blurb: 'One foot lands in front of both strands, the other behind both: the elastic runs between your legs.' },
];
export const POSE_BY_KEY = Object.fromEntries(POSES.map((p, i) => [p.key, i]));

// Eight heights, from the ankles to the neck. hgt = height of the elastic as a fraction of a child's height.
// A = first phrase etc. Each phrase is four steps; `form` lists the phrases in order. every = beats between two steps.
export const LEVELS = [
  { id: 'ankles', name: 'Ankles', hgt: 0.05, bpm: 92, every: 2, A: 'IOIO', B: 'IIOO', form: 'AABA', blurb: 'Warm-up: in and out over the lowest band.' },
  { id: 'calves', name: 'Calves', hgt: 0.13, bpm: 100, every: 2, A: 'INIO', B: 'NINO', form: 'ABAB', blurb: 'A new step: ON, stepping on the elastic.' },
  { id: 'knees', name: 'Knees', hgt: 0.22, bpm: 88, every: 1, A: 'IONI', B: 'NOIN', form: 'AABAB', blurb: 'A step on every beat now.' },
  { id: 'thighs', name: 'Thighs', hgt: 0.31, bpm: 96, every: 1, A: 'ISIO', B: 'NSNI', form: 'ABABA', blurb: 'The SPLIT arrives: one foot each side of the band.' },
  { id: 'hips', name: 'Hips', hgt: 0.42, bpm: 104, every: 1, A: 'ISNO', B: 'IOSI', C: 'NSOI', form: 'ABACB', blurb: 'All four steps, three different phrases.' },
  { id: 'waist', name: 'Waist', hgt: 0.52, bpm: 108, every: 1, A: 'ISIN', B: 'SNOS', C: 'IONS', form: 'ABACB', blurb: 'Quick changes between the strands.' },
  { id: 'armpits', name: 'Armpits', hgt: 0.64, bpm: 112, every: 1, A: 'SISN', B: 'NSOI', C: 'OSIS', form: 'ABCAB', blurb: 'The band is high: big, tidy jumps.' },
  { id: 'neck', name: 'Neck', hgt: 0.73, bpm: 116, every: 1, A: 'SNSI', B: 'ISNS', C: 'NOSI', D: 'SIOS', form: 'ABCDAB', blurb: 'The top of the ladder. Stay smooth.' },
];

// Timing windows, in seconds either side of the beat (scaled by the Timing setting).
export const JUDGE = { perfect: 0.075, good: 0.125, ok: 0.19 };
export const TIMING = [{ id: 'relaxed', name: 'Relaxed', k: 1.35 }, { id: 'normal', name: 'Normal', k: 1 }, { id: 'strict', name: 'Strict', k: 0.8 }];
export const SCORE = { perfect: 100, good: 70, ok: 40 };
export const WEIGHT = { perfect: 1, good: 0.8, ok: 0.55, miss: 0 };   // accuracy: weight of each judgement
export const TRIES = 3;                                               // trips allowed in a career run
export const STARS = [0.55, 0.78, 0.92];                              // accuracy for 1, 2, 3 stars
export const COUNT_IN = 4;                                            // beats of count-in before the first step
export const PRACTICE_SPEED = 0.75;
export const COMBO_STEPS = [0, 4, 8, 16];                             // combo needed for x1, x2, x3, x4
export const THINK = { min: 2, max: 10, def: 5, reveal: 2 };          // Watch and Learn: seconds to look at the routine, then the reveal
export const LEAD = 1.4;                                              // seconds of steps the cue track shows ahead

export const comboMult = (c) => (c >= COMBO_STEPS[3] ? 4 : c >= COMBO_STEPS[2] ? 3 : c >= COMBO_STEPS[1] ? 2 : 1);
export const starsOf = (acc) => (acc >= STARS[2] ? 3 : acc >= STARS[1] ? 2 : acc >= STARS[0] ? 1 : 0);
export const gradeOf = (acc) => (acc >= 0.97 ? 'S' : acc >= 0.9 ? 'A' : acc >= 0.78 ? 'B' : acc >= 0.55 ? 'C' : 'D');

export const stepsOf = (level) => [...level.form].flatMap((c) => [...level[c]]);
export const beatOf = (level, speed = 1) => 60 / (level.bpm * speed);
export const stepDur = (level, speed = 1) => beatOf(level, speed) * level.every;

// The whole run laid out in time: a count-in of COUNT_IN beats, then one step every `every` beats.
export function routineOf(level, speed = 1) {
  const beat = beatOf(level, speed), step = beat * level.every, T0 = beat * COUNT_IN;
  const moves = stepsOf(level).map((ch, i) => ({ i, t: T0 + i * step, pose: POSE_BY_KEY[ch], j: null, err: 0 }));
  return { beat, step, T0, moves, end: T0 + moves.length * step + 0.35, phrases: Math.ceil(moves.length / 4) };
}

// Which pose the strands of a given depth mean for the picture of a pose (used by icons and the stage).
export const FOOT_ROWS = (poseIdx) => POSES[poseIdx].depth;

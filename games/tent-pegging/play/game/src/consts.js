// Numbers shared by the simulation, the drawing and the Rules text, so the Rules page can never disagree with the engine.
export const LANE_LEN = 92;        // metres from the start line to the end boards
export const REACH = 2.3;          // the lance point lands this far ahead of the rider when the lance is down
export const DROP = 0.30;          // seconds the lance takes to come down after the finger is released
export const SIDE = 0.95;          // the lance is carried this far to the right of the rider's line
export const EYE = 2.35;           // camera height in the saddle
export const AIM_MAX = 1.3;        // metres the lance can be slid either way
export const AIM_RATE = 3.4;       // metres per second the lance can slide
export const LIFT_T = 0.07;        // clean lift window, seconds either side of perfect (before the round factor)
export const STRIKE_T = 0.15;      // touch window, seconds
export const LIFT_X = 0.20;        // metres across for a lift
export const STRIKE_X = 0.38;      // metres across for a touch
export const PERFECT_FRAC = 0.4;   // perfect lift: inside this fraction of the lift window (both axes)
export const PTS = { lift: 4, strike: 2, perfect: 1, fast: 1, streak: 1, streakMax: 3 };
export const RUNS_PER_ROUND = 6;
export const MAX_ROUND = RUNS_PER_ROUND * (PTS.lift + PTS.perfect + PTS.fast);
export const STARS_AT = [0, 22, 32]; // 1 star: beat the rival; 2 stars: this many points; 3 stars: this many
export const CHALLENGE_LIVES = 3;

export const PACES = [
  { id: 'canter', name: 'Canter', v: 9.5, sway: 0.7 },
  { id: 'gallop', name: 'Gallop', v: 12.5, sway: 1.0 },
  { id: 'full', name: 'Full gallop', v: 16, sway: 1.3 },
];

// Rounds of the Tournament Cup. sway = metres of side-to-side rocking at a gallop; off = how far from the lane line the peg may stand;
// tol = window multiplier; skill = the rival's skill (0-1); sky = look of the day.
export const ROUNDS = [
  { id: 'village', name: 'Village Green', minPace: 0, sway: 0.14, off: 0.15, tol: 1.2, skill: 0.2, sky: 0 },
  { id: 'market', name: 'Market Fair', minPace: 0, sway: 0.22, off: 0.30, tol: 1.05, skill: 0.35, sky: 1 },
  { id: 'district', name: 'District Cup', minPace: 1, sway: 0.30, off: 0.42, tol: 0.95, skill: 0.5, sky: 2 },
  { id: 'regional', name: 'Regional Final', minPace: 1, sway: 0.38, off: 0.52, tol: 0.88, skill: 0.65, sky: 3 },
  { id: 'grand', name: 'Grand Final', minPace: 1, sway: 0.45, off: 0.60, tol: 0.8, skill: 0.8, sky: 4 },
];
export const SWAYS = [{ name: 'Calm', k: 0.4 }, { name: 'Lively', k: 1 }, { name: 'Rough', k: 1.7 }];
export const THINK_STEPS = [2, 5, 8, 10];

// Gallop Challenge: harder every three runs
export const challengeLevel = (n) => {
  const k = Math.min(10, Math.floor(n / 3));
  return { sway: 0.16 + k * 0.035, off: 0.2 + k * 0.045, tol: Math.max(0.75, 1.15 - k * 0.045), sky: k % 5, minPace: k >= 5 ? 1 : 0 };
};

export const LESSONS = [
  { id: 'aim', title: 'Aim', goal: 'Touch the peg 3 times in 5 runs', runs: 5, need: 3, need2: 'strike', cfg: { sway: 0, off: 0.45, tol: 1.7, pace: 0 }, intro: [
    'Slide your thumb left or right to move the lance ring across the lane. Put the ring on the line of the peg, then let go as the ring touches it.',
    'This drill has no rocking and wide windows. The peg stands a little off the lane line each time.'] },
  { id: 'timing', title: 'Timing', goal: 'Lift the peg 3 times in 5 runs', runs: 5, need: 3, need2: 'lift', cfg: { sway: 0.1, off: 0.1, tol: 1.3, pace: 1 }, intro: [
    'The ring on the ground shows where the lance point will land if you let go now. Let go when the ring reaches the peg, not when you see the peg.',
    'Watch the ring, not the horse. A lift needs the ring on the peg within a few hundredths of a second.'] },
  { id: 'lift', title: 'Lift and score', goal: '15 points in 5 runs', runs: 5, need: 15, need2: 'points', cfg: { sway: 0.28, off: 0.4, tol: 0.95, pace: 2 }, intro: [
    'Full gallop and a rocking horse. Steer the ring against the rocking, then time the release. A perfect lift in a full gallop scores 6.'] },
];

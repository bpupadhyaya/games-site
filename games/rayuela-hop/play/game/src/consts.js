// Every number the rules and the Rules page quote lives here, so the page can never disagree with the engine.
export const STEP = 1 / 60;

// ---- rhythm ---------------------------------------------------------------------------------------------------------------------------
export const COUNT_BEATS = 4;                 // drum count-in before the first hop
export const AIR = 0.34;                      // airtime of one hop (s): take-off AIR before the beat, landing exactly on the beat
export const RING_DUR = 0.9;                  // the closing ring on the next square starts this long before the beat
// Timing windows around the beat (seconds either side). Inside "ok" the foot lands inside the square; outside it, but not so early
// that the tap is ignored, the foot lands on a chalk line (a foul).
export const TIMING = {
  standard: { perfect: 0.05, good: 0.1, ok: 0.16, early: 0.34 },
  relaxed: { perfect: 0.07, good: 0.135, ok: 0.215, early: 0.4 },
};
export const POINTS = { perfect: 100, good: 70, ok: 40, pick: 60, toss: 50, clean: 150 };
export const POINT_NAMES = { perfect: 'PERFECT', good: 'GOOD', ok: 'OK' };

// ---- toss -----------------------------------------------------------------------------------------------------------------------------
export const TEJO_R = 0.055;                  // the marker (tejo) is a flat disc this big (m radius)
export const AIM_RANGE = { x: 0.70, z: 0.72 };   // the sweep covers this far either side of the middle of the target square (m)
export const TOSS_FLIGHT = 0.75;              // seconds in the air
export const AIM_START_DELAY = 0.45;          // pause after the sideways lock before the depth gauge starts

// ---- phases / pacing (seconds) --------------------------------------------------------------------------------------------------------
export const T_INTRO = 1.25;
export const T_LANDED = 1.1;
export const T_FOUL = 1.7;
export const T_CLEAN = 1.5;

export const LEVELS = [
  { id: 1, name: 'Primo', stars: 1, blurb: 'A cousin who is still learning the beat. Often steps on a line.' },
  { id: 2, name: 'Vecino', stars: 2, blurb: 'The neighbour from down the street. Steady, but nervous on doubles.' },
  { id: 3, name: 'Rival', stars: 3, blurb: 'The best player in the courtyard. Rarely misses a toss.' },
  { id: 4, name: 'Campeon', stars: 4, blurb: 'The street champion. Almost never wrong, so you must be perfect too.' },
];
// computer skill per level: toss spread (m), beat spread (fraction of a beat), slip chance per hop, extra spread on pick-up and doubles
export const SKILL = [
  { toss: 0.100, beat: 0.108, slip: 0.020, hard: 1.3 },
  { toss: 0.068, beat: 0.082, slip: 0.011, hard: 1.25 },
  { toss: 0.048, beat: 0.067, slip: 0.006, hard: 1.2 },
  { toss: 0.034, beat: 0.056, slip: 0.003, hard: 1.15 },
];

export const GAME_LENGTHS = [
  { id: 'short', name: 'Short game', numbers: 4 },
  { id: 'full', name: 'Whole course', numbers: 0 },
];
export const DEMO_MATCH_CAP = 3;
export const SAVE_VERSION = 1;
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];

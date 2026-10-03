// Every number the rules and the Rules page quote lives here, so the page can never disagree with the engine.
export const STEP = 1 / 60;
export const G = 9.81;

// A round is two beats: beat 1 a small ground clap-hop, beat 2 the jump, clap and foot throw (the scoring beat).
export const AIR = 0.42;                        // airtime of the big jump (s): apex on beat 2, take-off AIR/2 before it
export const JUMP_H = (G * AIR * AIR) / 8;      // about 0.22 m
export const HOP_AIR = 0.12;                    // airtime of the beat 1 clap hop
export const HOP_H = (G * HOP_AIR * HOP_AIR) / 8;  // about 2 cm (a small bounce)
export const THRUST = 0.08;                     // the foot snaps out over the last 80 ms before the apex (after every tap window has closed)
export const RING_DUR = 0.55;                   // the timing ring closes over this long

// Timing windows around the take-off (commit) moment, seconds either side.
// Early taps may be wider (relaxed); the late side always closes 120 ms after take-off, before the feet can be seen.
export const TIMING = {
  standard: { perfect: 0.035, good: 0.075, okEarly: 0.12, okLate: 0.12, early: 0.3 },
  relaxed: { perfect: 0.055, good: 0.1, okEarly: 0.2, okLate: 0.12, early: 0.4 },
};
export const LEAD_IN_BEATS = 3;                 // count-in before the first round

export const TEMPOS = [
  { id: 'slow', name: 'Slow', bpm: 84 },
  { id: 'steady', name: 'Steady', bpm: 100 },
  { id: 'quick', name: 'Quick', bpm: 116 },
  { id: 'fast', name: 'Fast', bpm: 132 },
  { id: 'practice', name: 'Practice', bpm: 72 },
  { id: 'rising', name: 'Rising', bpm: 84, to: 132, every: 3, step: 4 },
];
export const PRACTICE_BPM = 72;

export const TARGETS = [11, 21];

export const LEVELS = [
  { id: 1, name: 'Playground beginner', stars: 1, blurb: 'Plays with strong habits and loves to repeat a foot.' },
  { id: 2, name: 'School yard regular', stars: 2, blurb: 'Leans to the right foot and alternates in a simple pattern.' },
  { id: 3, name: 'Neighbourhood champion', stars: 3, blurb: 'Counts which foot you use most and plays against it.' },
  { id: 4, name: 'Pattern reader', stars: 4, blurb: 'Remembers what you did after each of your last moves.' },
  { id: 5, name: 'Mind reader', stars: 5, blurb: 'Reads many patterns at once, bluffs, and changes its own habits.' },
];

export const POINT_NAMES = { perfect: 'PERFECT', good: 'GOOD', ok: 'OK', early: 'TOO EARLY', late: 'TOO LATE', miss: 'MISSED' };
export const DEMO_MATCH_CAP = 2;
export const SAVE_VERSION = 1;
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];

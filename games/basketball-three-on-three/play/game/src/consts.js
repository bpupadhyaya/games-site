// Court, ball and player constants shared by the simulation, the AI, the camera and the HUD.
// World axes: x across the court (+x is to the right of the broadcast picture), y up, z along the court.
// The hoop centre is the origin of the floor plan: hoop = (0, 3.05, 0). The baseline is behind it at z = -1.575 and the
// half-court line is at z = +9.425, so a half court is 15 m wide and 11 m long (3x3 dimensions). The camera looks from +z.
export const G = 9.81;
// Toy scale: the ball, the ring and the backboard are drawn and simulated larger than life so they read on a phone from a camera
// that has to show a whole half court (a real size 6 ball is 0.118 m in radius). Ball x3.0, ring and board x2.3; the ratio ball / ring
// (0.65) is a little tighter than the real 0.52, the aim noise in sim.js is scaled to compensate.
export const SCALE_BALL = 3.0, SCALE_RIM = 2.3;
// The six players are drawn and simulated this much larger than life as well (a camera that shows a whole half court makes people small);
// every role's own scale, reach and body height below is multiplied by it.
export const PLAYER_SCALE = 1.24;
export const BR = 0.118 * SCALE_BALL;
export const HOOP = { x: 0, y: 3.05, z: 0 };
export const RIM_R = 0.2286 * SCALE_RIM;    // ring radius (real: 45.7 cm diameter)
export const TUBE_R = 0.0095 * SCALE_RIM;
export const BOARD_Z = -(0.15 * SCALE_RIM + RIM_R);   // backboard face
export const BOARD = { hw: 0.9 * SCALE_RIM, y0: 3.05 - 0.15 * SCALE_RIM, y1: 3.05 + 0.9 * SCALE_RIM };
export const HW = 7.5;                      // half width
export const Z_BASE = -1.575;               // baseline
export const Z_HALF = 9.425;                // half-court line
export const ARC_R = 6.75;                  // two-point line radius
export const ARC_X = 6.6;                   // the arc's straight sides
export const FT_Z = 4.225;                  // free-throw line (5.8 m from the baseline)
export const KEY_HW = 2.45;
export const CHARGE_R = 1.25;               // no-charge semicircle
export const BOUND = { x: 7.35, z0: -1.45, z1: 9.3 };   // players are kept inside the lines

export const DT = 1 / 60;
export const SHOT_CLOCK = 12;
export const GAME_LEN = { full: { points: 21, seconds: 600 }, quick: { points: 11, seconds: 300 } };

export const ROLES = [
  { id: 0, name: 'Guard', short: 'G', speed: 5.3, shoot: 0.98, layup: 1.0, pass: 1.1, handle: 1.1, reb: 0.7, reach: 2.15 * PLAYER_SCALE, scale: 0.99 * PLAYER_SCALE, steal: 1.15, block: 0.8, strong: 0.8, blurb: 'Quick ball handler. Starts with the ball at the top, runs the offence and draws the defender.' },
  { id: 1, name: 'Wing', short: 'W', speed: 5.0, shoot: 1.06, layup: 1.0, pass: 0.95, handle: 0.95, reb: 0.9, reach: 2.20 * PLAYER_SCALE, scale: 1.03 * PLAYER_SCALE, steal: 1.0, block: 1.0, strong: 1.0, blurb: 'Shooter. Spaces the floor beyond the arc and finishes on the move.' },
  { id: 2, name: 'Big', short: 'B', speed: 4.6, shoot: 0.9, layup: 1.18, pass: 0.85, handle: 0.8, reb: 1.15, reach: 2.29 * PLAYER_SCALE, scale: 1.09 * PLAYER_SCALE, steal: 0.8, block: 1.25, strong: 1.3, blurb: 'Screens, rolls to the rim, rebounds and blocks shots.' },
];

// AI strength: the opponent levels 1-5 (calibrated by simulation, see dev/calibrate.mjs). TM is the fixed level of the user's
// own AI teammates. Fields: react (decision interval s), spd (speed factor), tErr (shot-release timing error s),
// skill (shooting multiplier), iq (chance to take the best option), steal (steal attempt appetite), help (help defence),
// ctest (contest and block reflex), reb (rebound effort).
export const LEVELS = [
  null,
  { id: 1, name: 'Park Rookies', stars: 1, react: 0.55, spd: 0.88, tErr: 0.085, skill: 0.84, iq: 0.45, steal: 0.35, help: 0.3, ctest: 0.4, reb: 0.7 },
  { id: 2, name: 'Club Squad', stars: 2, react: 0.42, spd: 0.92, tErr: 0.06, skill: 0.92, iq: 0.62, steal: 0.5, help: 0.5, ctest: 0.55, reb: 0.8 },
  { id: 3, name: 'Varsity Three', stars: 3, react: 0.32, spd: 0.96, tErr: 0.045, skill: 1.0, iq: 0.78, steal: 0.65, help: 0.7, ctest: 0.7, reb: 0.9 },
  { id: 4, name: 'Pro Trio', stars: 4, react: 0.24, spd: 1.0, tErr: 0.034, skill: 1.04, iq: 0.9, steal: 0.8, help: 0.85, ctest: 0.85, reb: 1.0 },
  { id: 5, name: 'All-Star Three', stars: 5, react: 0.17, spd: 1.03, tErr: 0.022, skill: 1.15, iq: 0.97, steal: 1.0, help: 1.0, ctest: 1.0, reb: 1.1 },
];
export const TM_LEVEL = 3;

// Spots the offence uses (x, z); all beyond the arc except the blocks and elbows
export const SPOTS = {
  top: { x: 0, z: 7.7 }, wingL: { x: -5.0, z: 5.2 }, wingR: { x: 5.0, z: 5.2 }, deepL: { x: -3.0, z: 7.2 }, deepR: { x: 3.0, z: 7.2 },
  blockL: { x: -1.5, z: 1.2 }, blockR: { x: 1.5, z: 1.2 }, elbowL: { x: -2.5, z: 4.0 }, elbowR: { x: 2.5, z: 4.0 }, high: { x: 0, z: 3.2 },
};

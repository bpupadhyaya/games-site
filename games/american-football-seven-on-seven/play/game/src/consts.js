// Field, roster, timing and difficulty constants shared by the sim, the computer's coach and the screens.
// Units: yards for x, y (height) and z. x is across the field (-14..14), z runs along it from the user's end line (0) to the computer's (52).
// The user's team always attacks toward +z (away from the camera); the computer attacks toward -z.

export const FIELD = { W: 28, HALF: 14, LEN: 40, EZ: 6, TOTAL: 52, FIRST: 10, TRY_YL: 37, TRY_DIST: 3 };
export const YD = 0.9144;                        // metres per yard: the 3D scene is in metres

// ---- the 7 players of a team. Every player is two-way: the same body plays offence and defence ------------------------------------------------
// p: 0 QB / S, 1 RB / LB, 2 WR (left) / CB, 3 TE / DL, 4 WR (right) / CB, 5 C / DL, 6 G / LB
export const OFF_SLOT_OF_P = ['QB', 'RB', 'WA', 'TE', 'WB', 'C', 'G'];
export const DEF_SLOT_OF_P = ['S', 'LB1', 'CB1', 'DL1', 'CB2', 'DL2', 'LB2'];
export const ROLE_OF_SLOT = { QB: 'QB', RB: 'RB', WA: 'WR', WB: 'WR', TE: 'TE', C: 'OL', G: 'OL', S: 'S', LB1: 'LB', LB2: 'LB', CB1: 'CB', CB2: 'CB', DL1: 'DL', DL2: 'DL' };
// Base ratings per player (before the difficulty level): spd yd/s, acc yd/s^2, str (block/rush power 0..1), hands, tackle, cover, elude (as a ball carrier), qb
export const BASE = [
  { spd: 6.3, acc: 9.5, str: 0.45, hands: 0.55, tackle: 0.66, cover: 0.66, elude: 0.50, qb: 0.74 },   // 0 QB / S
  { spd: 6.9, acc: 11, str: 0.55, hands: 0.66, tackle: 0.72, cover: 0.55, elude: 0.78, qb: 0.20 },   // 1 RB / LB
  { spd: 7.3, acc: 11.5, str: 0.35, hands: 0.82, tackle: 0.55, cover: 0.82, elude: 0.74, qb: 0.20 },   // 2 WR / CB
  { spd: 5.9, acc: 9, str: 0.68, hands: 0.70, tackle: 0.64, cover: 0.38, elude: 0.46, qb: 0.20 },   // 3 TE / DL
  { spd: 7.2, acc: 11.5, str: 0.35, hands: 0.80, tackle: 0.55, cover: 0.80, elude: 0.72, qb: 0.20 },   // 4 WR / CB
  { spd: 5.4, acc: 8.5, str: 0.72, hands: 0.25, tackle: 0.62, cover: 0.30, elude: 0.38, qb: 0.20 },   // 5 C / DL
  { spd: 6.0, acc: 9, str: 0.66, hands: 0.30, tackle: 0.70, cover: 0.52, elude: 0.42, qb: 0.20 },   // 6 G / LB
];
export const NUMBERS = [[7, 22, 81, 88, 11, 54, 63], [12, 28, 84, 85, 19, 58, 66]];

// ---- the eight roles the player can pick (pairs: the same two-way player) ------------------------------------------------------------------------
export const ROLES = [
  { id: 'QB', name: 'Quarterback', p: 0, unit: 'off', pair: 'S' },
  { id: 'S', name: 'Safety', p: 0, unit: 'def', pair: 'QB' },
  { id: 'RB', name: 'Running back', p: 1, unit: 'off', pair: 'LB' },
  { id: 'LB', name: 'Linebacker', p: 1, unit: 'def', pair: 'RB' },
  { id: 'WR', name: 'Wide receiver', p: 2, unit: 'off', pair: 'CB' },
  { id: 'CB', name: 'Cornerback', p: 2, unit: 'def', pair: 'WR' },
  { id: 'TE', name: 'Tight end', p: 3, unit: 'off', pair: 'DL' },
  { id: 'DL', name: 'Defensive lineman', p: 3, unit: 'def', pair: 'TE' },
];
export const roleById = (id) => ROLES.find((r) => r.id === id) || ROLES[0];

// ---- timing --------------------------------------------------------------------------------------------------------------------------------------
export const T = {
  STEP: 1 / 60, LINEUP: 1.7, SET: 0.9, SNAP_FLIGHT: 0.4, WHISTLE: 1.2, TACKLE_DOWN: 0.95, RUNOFF: 9, MAX_PLAY: 14,
};
export const QUARTER_SECS = [60, 120, 180];
export const QUARTER_NAME = ['Short (1 min)', 'Standard (2 min)', 'Long (3 min)'];

// ---- the five computer levels ----------------------------------------------------------------------------------------------------------------------
// spd/ratings multiply the computer team's players; react is the reaction delay of its defenders (s); acc the QB's accuracy, dec how well it reads the field,
// call how well its coach picks plays. Calibrated by simulation (verify/calibrate.mjs): each level beats the one below.
export const LEVELS = [
  { id: 0, name: 'Rookie', tag: 'Slow to react, loose passes', stars: 1, spd: 0.88, rate: 0.85, react: 0.65, acc: 0.46, dec: 0.35, call: 0.0 },
  { id: 1, name: 'Club', tag: 'Plays sensibly', stars: 2, spd: 0.94, rate: 0.93, react: 0.42, acc: 0.62, dec: 0.6, call: 0.3 },
  { id: 2, name: 'Varsity', tag: 'Solid on both sides', stars: 3, spd: 1.00, rate: 1.00, react: 0.28, acc: 0.74, dec: 0.78, call: 0.55 },
  { id: 3, name: 'Pro', tag: 'Fast, reads the field', stars: 4, spd: 1.03, rate: 1.04, react: 0.20, acc: 0.80, dec: 0.86, call: 0.8 },
  { id: 4, name: 'Champion', tag: 'Sharp and relentless', stars: 5, spd: 1.13, rate: 1.18, react: 0.05, acc: 0.97, dec: 1.0, call: 1.0 },
];
export const TEAM_LEVEL = 2;                     // the user's AI teammates play at this level

// ---- ball -----------------------------------------------------------------------------------------------------------------------------------------
export const G_YD = 10.7;                        // gravity in yards per second squared
export const BALL = { carryY: 1.2, releaseY: 2.0, catchY: 1.45, bullet: 22, lob: 14.5, minFlight: 0.32 };
export const TEAM_NAME = ['You', 'Rival'];
export const TEAM_FULL = ['Home', 'Away'];

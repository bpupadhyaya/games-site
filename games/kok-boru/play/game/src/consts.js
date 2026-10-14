// Every number the simulation, the AI, the HUD and the Rules page share. Metres and seconds; the field runs along x, depth is z.
export const DT = 1 / 60;
export const HL = 32;               // half length: x in [-HL, HL]
export const HW = 17;               // half width:  z in [-HW, HW] (the near side has the larger z)
export const GOAL_X = 28.5;         // the goal circle centres sit at x = +-GOAL_X, z = 0 (team 0 attacks +x)
export const GOAL_R = 1.8;          // radius of the goal circle (the sand pit)
export const DROP_R = 3.0;          // closer than this to the circle a throw drops straight in
export const G = 9.8;
export const V_BASE = 7.0;          // m/s walking-gallop pace
export const V_SPRINT = 9.7;
export const CARRY_MUL = 0.9;       // carrying the ball slows the horse a little
export const ACCEL = 15;
export const BRAKE = 22;
export const STAM_DRAIN = 0.34;     // per second of sprint
export const STAM_REGEN = 0.15;
export const GRAB_R = 1.9;          // reach for a ball on the ground
export const LEAN_T = 0.34;         // seconds the rider is leaning down to the ball
export const TUG_R = 2.3;           // reach for the ball of a rival who is carrying it
export const RIDER_R = 0.95;
export const BALL_R = 0.3;
export const CHARGE_T = 0.9;        // seconds to charge a throw from nothing to full power
export const THROW_ANG = 0.55;      // launch elevation (rad)
export const PASS_SPEED = 15;
export const PERIOD_SECS = [60, 90, 150];
export const PERIODS = 2;
export const GOLDEN_CAP = 90;       // seconds of extra play before possession decides a tied cup match
export const SIZES = [3, 4];
export const CALLS = ['Pass play', 'Solo run'];
export const TACTICS = ['Attack', 'Balanced', 'Guard'];

// AI levels: speed multiplier, decision interval, throw power error, throw range, tug skill, willingness to pass, catch skill
export const LEVELS = [
  { name: 'Village riders', stars: 1, speed: 0.80, react: 0.36, aim: 0.30, lat: 1.7, range: 4.0, tug: 0.25, pass: 0.25, catch: 0.5 },
  { name: 'Valley team', stars: 2, speed: 0.85, react: 0.29, aim: 0.25, lat: 1.4, range: 4.4, tug: 0.35, pass: 0.32, catch: 0.6 },
  { name: 'Mountain team', stars: 3, speed: 0.90, react: 0.23, aim: 0.20, lat: 1.15, range: 4.8, tug: 0.45, pass: 0.4, catch: 0.7 },
  { name: 'Champions', stars: 4, speed: 0.94, react: 0.18, aim: 0.16, lat: 0.95, range: 5.4, tug: 0.54, pass: 0.48, catch: 0.8 },
  { name: 'Legends', stars: 5, speed: 0.98, react: 0.14, aim: 0.12, lat: 0.75, range: 6.0, tug: 0.62, pass: 0.55, catch: 0.9 },
];
export const ROLE_NAMES = ['Striker', 'Wing', 'Guard', 'Wing 2'];
// kick-off spots for team 0 (they attack +x); team 1 mirrors x
export const SPOTS = [{ x: -5, z: 0 }, { x: -11, z: -8 }, { x: -16, z: 5 }, { x: -11, z: 9 }];

// Original pennants (no real flags): shape, two colours, a motif. Team 0 is the player's side.
export const TEAMS = [
  { name: 'Grey Wolves', short: 'WOL', c1: '#d8dde6', c2: '#2b3a55', trim: '#f2c14e', motif: 'paw', shape: 'swallow', kit: '#5a6b8c', horse: '#3b2a22' },
  { name: 'Dust Riders', short: 'DUS', c1: '#d9a35b', c2: '#6b3f1d', trim: '#fff1cf', motif: 'chevron', shape: 'tri', kit: '#c9772e', horse: '#8a5a33' },
  { name: 'Snow Falcons', short: 'FAL', c1: '#f4f8ff', c2: '#2a73c8', trim: '#ffd25e', motif: 'peaks', shape: 'swallow', kit: '#2f7fd1', horse: '#d9d2c4' },
  { name: 'Red Saddles', short: 'SAD', c1: '#e04b3a', c2: '#5c1210', trim: '#ffe29a', motif: 'sun', shape: 'rect', kit: '#d23c33', horse: '#5b2f1c' },
  { name: 'Salt Road', short: 'SAL', c1: '#f6f1e4', c2: '#1f8a7a', trim: '#e8b04b', motif: 'wave', shape: 'tri', kit: '#1f9d8f', horse: '#2d2d33' },
  { name: 'Eagle Pass', short: 'EAG', c1: '#2d2a5e', c2: '#e7b54a', trim: '#ffffff', motif: 'wing', shape: 'swallow', kit: '#4b3fa0', horse: '#7a6a58' },
];
// the ladder: each rung is a rival team and an AI level
export const LADDER = [
  { team: 1, level: 0, name: 'Village Qualifier' },
  { team: 2, level: 1, name: 'Valley Quarter-final' },
  { team: 3, level: 2, name: 'Mountain Semi-final' },
  { team: 4, level: 3, name: 'Steppe Cup Final' },
  { team: 5, level: 4, name: 'Legends Challenge' },
];

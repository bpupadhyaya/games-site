// Pitch, ball and player constants. Everything the Rules page quotes comes from here.
export const STEP = 1 / 60;
export const G = 9.81;
// Pitch: an oval, 36 m wide and 60 m long (documented simplification of a much larger ground).
export const HW = 15, HL = 25;                 // half width (x), half length (z)
export const ZG = 22;                          // the goal line: the four posts stand on it
export const GHW = 2.6;                        // goal posts at x = +-3.0 (a goal is between them)
export const BHW = 6.4;                        // behind posts at x = +-7.5 (a behind is between a goal post and a behind post)
export const SQUARE = 8;                       // depth of the goal square used for kick-ins
export const BR = 0.18;                        // ball centre height when it lies on the grass
export const BALL_LEN = 0.28, BALL_W = 0.19;   // real size; the picture draws it a little larger so it reads on a phone
export const MARK_MIN = 10;                    // a kick must travel this far (m) before it can be marked
export const MARK_STAND = 4.5;                   // opponents stand this far (m) from the player who took a mark or free kick
export const QUARTER = 120;                    // seconds per quarter
export const GOAL_PTS = 6, BEHIND_PTS = 1;
export const REACH = 2.15;                     // hands overhead, standing (m)
export const HOLD_UNDER_TACKLE = 0.75;         // seconds a tackled player has to get rid of the ball
export const SLOT_ROLE = ['ruck', 'mid', 'mid', 'fwd', 'fwd', 'def'];
export const ROLE_SLOT = { ruck: 0, mid: 1, fwd: 3, def: 5 };
export const ROLE_NAME = { ruck: 'Ruck / back', mid: 'Midfielder', fwd: 'Forward', def: 'Defender' };
export const ROLES = ['fwd', 'mid', 'def', 'ruck'];
// Per slot attributes: speed multiplier, leap (m), mark skill, tackle skill.
export const BS = 1.25;                        // the players are drawn and play 1.25x life size so they read on a phone (reach, stride and contact points scale with it)
export const KP = { f: 0.52, s: 0.18, y: 0.65, yr: 1.08, yrSnap: 0.92 };   // kick contact point (forward, right, height) and drop height
export const HP = { f: 0.45, s: 0.18, y: 1.2 };                          // handball hold point
export const ARM = 0.70;                       // arm reach from the shoulder (m)
export const SHOULDER = 1.48;                  // shoulder height standing (m)
export const ATTR = [
  { speed: 0.94, leap: 0.90, mark: 0.62, tackle: 0.58 },
  { speed: 1.03, leap: 0.70, mark: 0.52, tackle: 0.55 },
  { speed: 1.03, leap: 0.70, mark: 0.52, tackle: 0.55 },
  { speed: 1.0, leap: 0.83, mark: 0.64, tackle: 0.42 },
  { speed: 1.0, leap: 0.83, mark: 0.60, tackle: 0.42 },
  { speed: 0.98, leap: 0.78, mark: 0.56, tackle: 0.62 },
];
export const JOG = 4.7, SPRINT = 6.9, ACCEL = 17;
export const KICK_WIND = 0.34, SNAP_WIND = 0.25, HB_WIND = 0.2, TACKLE_TC = 0.22, TACKLE_LEN = 0.85, JUMP_LEN = 0.7, JUMP_APEX = 0.32, GATHER_LEN = 0.22;
export const LEVELS = [
  { name: 'Rookie', stars: 1, react: 0.34, aim: 0.50, mark: 0.40, tackle: 0.32, speed: 0.92, iq: 0.20, press: 0.35 },
  { name: 'Club', stars: 2, react: 0.26, aim: 0.60, mark: 0.52, tackle: 0.44, speed: 0.96, iq: 0.42, press: 0.55 },
  { name: 'Regional', stars: 3, react: 0.19, aim: 0.70, mark: 0.64, tackle: 0.56, speed: 0.99, iq: 0.62, press: 0.70 },
  { name: 'State', stars: 4, react: 0.13, aim: 0.82, mark: 0.76, tackle: 0.68, speed: 1.02, iq: 0.82, press: 0.85 },
  { name: 'Champion', stars: 5, react: 0.08, aim: 0.92, mark: 0.88, tackle: 0.80, speed: 1.05, iq: 0.96, press: 1.0 },
];
// Formation offsets (own side, relative to the contest spot; z is "towards the opponents' goal" for that team)
export const FORM = [[0, -1.3], [-4.2, -5], [4.2, -5], [-5, 6.5], [5, 6.5], [0, -12.5]];
// a stand-in for a casual human: slow reactions, so-so aim and marking, average speed (dev/proxy.mjs calibrates the levels against it)
export const HUMANLIKE = { name: 'Casual human', stars: 0, react: 0.32, aim: 0.55, mark: 0.5, tackle: 0.42, speed: 1.0, iq: 0.5, press: 0.5 };

// Pitch, ball, player and level constants shared by the simulation, the AI, the HUD and the Rules text.
export const HW = 6.5;             // half width (m): sidelines at x = +-11
export const HL = 14;              // half length (m): end lines at z = +-20 (near goal z = -20, far goal z = +20)
export const GOAL_HW = 2.0;        // half distance between the posts (4 m)
export const BAR = 2.5;            // crossbar height (m)
export const POST_H = 7;           // post height (m)
export const NET_D = 2.4;          // net depth behind the line (m)
export const SMALL_D = 2.5;        // small rectangle depth (m)
export const LINE_13 = 6;          // the 13 m line, scaled
export const LINE_20 = 9;          // the 20 m line, scaled
export const G = 9.81;
export const BALL_R = 0.07;        // physical radius (the picture draws it larger)
export const HALF_SEC = 180;
export const TEAM_SIZE = 6;
export const REACH = 1.1;          // hurley reach from the body for a strike (m)
export const SOLO_PERIOD = 0.95;   // seconds per bounce of the ball on the hurley
export const SOLO_HOP = 0.5;       // hop height above the bas (m)
export const BAS_Y = 0.62;         // height of the ball resting on the bas (m)
export const CHARGE_SEC = 0.9;     // the strike bar fills in this time
export const SWEET = { drive: 0.28, loft: 0.76 };   // bar positions of the two sweet zones
export const POINTS = { goal: 3, point: 1 };

export const ROLES = [
  { id: 'GK', name: 'Goalkeeper', short: 'GK', blurb: 'Guard the goal: move along the line, save with the stick, puck the ball out.' },
  { id: 'BK', name: 'Back', short: 'Back', blurb: 'Stop the forwards: mark, hook, block and clear the ball.' },
  { id: 'BK2', name: 'Back', short: 'Back', blurb: '' },
  { id: 'MF', name: 'Midfielder', short: 'Mid', blurb: 'Run the whole pitch: win the ball, feed the forwards, strike for points.' },
  { id: 'HF', name: 'Half forward', short: 'Half fwd', blurb: '' },
  { id: 'FF', name: 'Full forward', short: 'Full fwd', blurb: 'Score: find space near the goal, then strike for a point or a goal.' },
];
// roles the player may choose (index into ROLES)
export const CHOICES = [5, 3, 1, 0];

// Home positions for team 0 (attacking +z), x, z. Team 1 is the point reflection.
export const HOME = [[0, -13.2], [-2.6, -9], [2.6, -9], [0, -1], [-2.2, 4.2], [1.4, 9.5]];

export const LEVELS = [
  { name: 'Parish', stars: 1, react: 0.5, skill: 0.42, speed: 0.9, aggr: 0.45, iq: 0.3 },
  { name: 'Club', stars: 2, react: 0.36, skill: 0.55, speed: 0.95, aggr: 0.55, iq: 0.45 },
  { name: 'County', stars: 3, react: 0.26, skill: 0.68, speed: 1.0, aggr: 0.65, iq: 0.6 },
  { name: 'Regional', stars: 4, react: 0.17, skill: 0.81, speed: 1.04, aggr: 0.75, iq: 0.78 },
  { name: 'Champion', stars: 5, react: 0.09, skill: 0.93, speed: 1.08, aggr: 0.85, iq: 0.92 },
];

// Rule numbers shared by the engine and the Rules text (test/rules.test.js fails when the text and these disagree)
export const HAND_MAX_SEC = 1.6;       // longest the ball stays in the hand before it settles on the hurley
export const HAND_MAX_STEPS = 4;       // or this many steps
export const HAND_STEP_M = 1.1;        // metres per step
export const EXPOSE_FROM = 0.2;        // the ball is exposed to a hook from this fraction of each bounce ...
export const EXPOSE_TO = 0.8;          // ... to this fraction
export const BURST_SEC = 0.4;
export const BURST_CD = 1.6;
export const HOOK_REACH = 0.5;         // metres between the ball and the spot the stick reaches (1.1 m in front of the player) for a hook
export const SHOULDER_REACH = 1.15;
export const FOUL_HOOK_P = 0.3;        // chance a hook at a ball that is not exposed (rival within 1.1 m) is called
export const RESTART_MAX_SEC = 7;
export const FREE_BACK_M = 3.6;        // rivals are moved back this far from a free
export const TOSS_SEC = 0.42;          // strike from the hand: toss to contact
export const GROUND_SEC = 0.34;        // strike from the ground / rising pick-up
export const PASS_SEC = 0.26;          // hand-pass
export const HOOK_SEC = 0.24;          // hook / block swing
export const ASSIST_DEG = 35;          // aim assist cone (half angle, degrees)
export const KEEPER_REACH = 0.9;       // goalkeeper stick block radius (a field player's is HOOK_REACH)
export const KEEPER_DIVE = 2.6;        // lateral reach of a dive

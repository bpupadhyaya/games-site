// Pitch, ball, roles and the five computer levels. World axes: x across (+x is the LEFT hand of a player facing +z), y up, z along the
// pitch. Team 0 (the human's side) defends the near goal at z = -HL and attacks +z; team 1 defends z = +HL. The pitch never moves.
export const STEP = 1 / 60;
export const HL = 19;               // half length (38 m)
export const HW = 12.5;             // half width (25 m)
export const GOAL_HW = 2.5;         // goal 5 m wide
export const GOAL_H = 2.0;          // 2 m high
export const GOAL_D = 1.5;          // net depth
export const POST_R = 0.06;
export const BOX_HW = 7, BOX_D = 6; // penalty area: 14 m wide, 6 m deep
export const SPOT = 6;              // penalty spot, 6 m from the goal line
export const CIRCLE_R = 3.5;
export const BR = 0.11;             // ball radius
export const G = 9.81;
export const PR = 0.42;             // player body radius

export const ROLES = ['GK', 'DL', 'DR', 'CM', 'WL', 'WR', 'ST'];
export const ROLE_NAME = { GK: 'Goalkeeper', DL: 'Defender', DR: 'Defender', CM: 'Central midfielder', WL: 'Winger', WR: 'Winger', ST: 'Striker' };
export const ROLE_SHORT = { GK: 'GK', DL: 'DEF', DR: 'DEF', CM: 'MID', WL: 'WING', WR: 'WING', ST: 'ST' };
// anchor positions: lat metres towards the team's own LEFT, depth metres from the team's own goal line
export const ANCHOR = {
  GK: { lat: 0, d: 1.2 }, DL: { lat: 4.6, d: 8.5 }, DR: { lat: -4.6, d: 8.5 }, CM: { lat: 0, d: 16 },
  WL: { lat: 8.2, d: 22 }, WR: { lat: -8.2, d: 22 }, ST: { lat: 0, d: 28 },
};
export const KICKOFF_D = { GK: 1.2, DL: 8, DR: 8, CM: 13, WL: 14, WR: 14, ST: 16.5 };   // everybody on their own half (depth < 19)

// Role picked by the human: the user-facing choices
export const CHOICES = [
  { id: 'ST', name: 'Striker', blurb: 'Find space behind the defence, hold the ball up, finish chances and head crosses in.' },
  { id: 'W', name: 'Winger', blurb: 'Hug the touchline, beat your marker, cross and cut inside to shoot. Choose your side.' },
  { id: 'CM', name: 'Central midfielder', blurb: 'The link of the team: win the ball, spread passes, join attacks and cover behind.' },
  { id: 'D', name: 'Defender', blurb: 'Protect the goal: mark the striker, tackle cleanly, clear the danger and start attacks. Choose your side.' },
  { id: 'GK', name: 'Goalkeeper', blurb: 'Last line: dive to save shots, catch crosses, then throw or kick the ball out.' },
];
export const roleOf = (choice, side) => (choice === 'ST' ? 'ST' : choice === 'CM' ? 'CM' : choice === 'GK' ? 'GK' : choice === 'W' ? (side === 'R' ? 'WR' : 'WL') : (side === 'R' ? 'DR' : 'DL'));

// Computer levels. react: seconds the decision loop lags behind the game; the stats are multipliers on player stats.
export const LEVELS = [
  { id: 1, name: 'Park Rovers', stars: 1, spd: 0.88, react: 0.70, pass: 0.30, shot: 0.28, tackle: 0.25, ctrl: 0.38, gk: 0.20, vision: 0.35, press: 0.30, line: 1.0, dec: 0.35 },
  { id: 2, name: 'Corner Shop', stars: 2, spd: 0.93, react: 0.48, pass: 0.48, shot: 0.45, tackle: 0.42, ctrl: 0.52, gk: 0.38, vision: 0.55, press: 0.50, line: 1.0, dec: 0.58 },
  { id: 3, name: 'Sunday Club', stars: 3, spd: 0.97, react: 0.30, pass: 0.64, shot: 0.60, tackle: 0.57, ctrl: 0.66, gk: 0.54, vision: 0.74, press: 0.70, line: 1.0, dec: 0.80 },
  { id: 4, name: 'Harbour Town', stars: 4, spd: 1.00, react: 0.16, pass: 0.78, shot: 0.75, tackle: 0.72, ctrl: 0.80, gk: 0.70, vision: 0.90, press: 0.85, line: 1.0, dec: 0.92 },
  { id: 5, name: 'Capital Select', stars: 5, spd: 1.03, react: 0.06, pass: 0.92, shot: 0.90, tackle: 0.86, ctrl: 0.92, gk: 0.86, vision: 1.0, press: 1.0, line: 1.0, dec: 1.0 },
];
export const MATE_LEVEL = 3;          // the human's computer teammates play at this level
export const HALF_OPTIONS = [120, 180, 300];

// body speeds (m/s)
export const SPEED = { jog: 4.2, run: 5.6, sprint: 6.9, withBall: 0.92 };
export const ACCEL = 9.5, DECEL = 11.0, TURN = 11;

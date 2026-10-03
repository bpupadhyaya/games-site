// Court, ball physics, shot kinds, equipment, rival levels. One place for every number the Rules page quotes.
// World axes: x is lateral (+x is the player's LEFT when facing the front wall: the left wall is at x = +HW), y is up,
// z runs from the back wall (z = 0) to the front wall (z = L). A player facing the front wall has yaw 0 (view3d: yaw 0 faces +z).

export const HW = 2.6;            // half width of the court (m): x from -HW (open side) to +HW (left wall)
export const L = 10.5;              // length: back wall at z = 0, front wall at z = L
export const WALL_H = 5.0;        // front wall and left wall height
export const TOP = 4.2;           // top line on the front wall: a ball striking above it is out
export const TIN = 0.7;          // the tin (chapa): a ball striking the front wall below this height is a fault
export const SERVE_LINE = 1.5;    // a serve must strike the front wall above this height
export const SHORT = 5.5;         // short line on the floor (z): a serve's first bounce must land at z <= SHORT (at least L - SHORT from the front wall)
export const BACK_H = 4.0;        // the back wall (rebote) is lower: a ball above it leaves the court
export const BR = 0.18;            // ball radius (drawn and simulated; larger than a real pelota so it can be followed on a phone)
export const G = 9.81;

// Ball physics. Coefficients are for a lively hard ball; spin matters on every bounce.
export const PHYS = {
  h: 1 / 240,                     // sub-step (4 per game tick)
  drag: 0.0085,                   // quadratic drag, 1/m
  magnus: 0.0011,                 // lift from spin
  spinDecay: 0.35,                // 1/s
  eFloor: 0.66, eFront: 0.72, eLeft: 0.7, eBack: 0.62,
  mu: 0.32, kappa: 0.62,
};

// Shot kinds. v = ball speed leaving the contact (m/s) for a hand; paddle adds PADDLE.boost. spin = topspin (+) or backspin (-) in rad/s.
export const SHOTS = {
  drive: { id: 'drive', name: 'Drive', short: 'Drive', v: 18.5, spin: 38, blurb: 'A fast, flat shot onto the front wall.' },
  drop: { id: 'drop', name: 'Drop shot', short: 'Drop', v: 8.5, spin: -95, blurb: 'A soft, backspun shot that dies low near the front wall.' },
  lob: { id: 'lob', name: 'Lob', short: 'Lob', v: 13.5, spin: 22, blurb: 'A high shot to the top of the wall that dies deep near the back wall.' },
  power: { id: 'power', name: 'Power serve', short: 'Power', v: 22.5, spin: 55, blurb: 'A harder serve with less control.' },
};
export const SHOT_IDS = ['drive', 'drop', 'lob'];
export const SERVE_SHOT_IDS = ['drive', 'power'];

export const EQUIP = {
  hand: { id: 'hand', name: 'Hand ball', short: 'Hand', reach: 0.95, boost: 1.0, power: 'a bare hand', ball: 'cream' },
  paddle: { id: 'paddle', name: 'Paddle (pala)', short: 'Paddle', reach: 1.3, boost: 1.1, power: 'a wooden paddle', ball: 'yellow' },
};
export const EQUIP_IDS = ['hand', 'paddle'];

export const SWING_DELAY = 0.3;   // s from pressing SWING to the contact
export const SWING_TAIL = 0.42;   // s of follow-through after the contact
export const WINDOW = 0.2;        // s: timing error at which timing quality reaches zero

export const MATCH_POINTS = { full: 22, quick: 11 };
export const PACE = { relaxed: 0.8, normal: 1.0, fast: 1.2 };
export const PACE_IDS = ['relaxed', 'normal', 'fast'];

// Rival levels. spd m/s, react s (extra delay before the AI starts to move), timing s (sigma of the swing timing),
// aim m (sigma of the wall aim at perfect timing), think (0 random legal shot .. 1 best of many), cover (0..1: how well it recovers to the centre),
// err (chance per swing of a bad strike), reach multiplier.
export const LEVELS = [
  { id: 1, name: 'Rookie', stars: 1, agg: 0.15, spd: 3.8, react: 0.34, timing: 0.115, aim: 0.85, think: 0.0, cover: 0.2, err: 0.16, lunge: 0.9 },
  { id: 2, name: 'Club player', stars: 2, agg: 0.3, spd: 4.3, react: 0.27, timing: 0.088, aim: 0.6, think: 0.3, cover: 0.45, err: 0.1, lunge: 1.0 },
  { id: 3, name: 'Regional', stars: 3, agg: 0.45, spd: 4.8, react: 0.2, timing: 0.065, aim: 0.42, think: 0.55, cover: 0.65, err: 0.06, lunge: 1.05 },
  { id: 4, name: 'Veteran', stars: 4, agg: 0.6, spd: 5.3, react: 0.14, timing: 0.046, aim: 0.28, think: 0.8, cover: 0.82, err: 0.03, lunge: 1.1 },
  { id: 5, name: 'Master', stars: 5, agg: 0.75, spd: 5.8, react: 0.08, timing: 0.03, aim: 0.18, think: 1.0, cover: 1.0, err: 0.012, lunge: 1.15 },
];

export const KITS = [
  { top: '#d0342c', bottoms: '#f4f4f4', socks: '#f4f4f4', name: 'Red' },
  { top: '#1f6fc4', bottoms: '#f4f4f4', socks: '#f4f4f4', name: 'Blue' },
];

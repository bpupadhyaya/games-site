// Court, ball physics, surfaces, shot kinds, rival levels, match formats. One place for every number the Rules page quotes.
// World axes: the net is the plane z = 0. The human plays the NEAR half (z < 0) and faces +z; the rival plays the far half (z > 0) and faces -z.
// x is lateral: +x is the LEFT of a player who faces +z (view3d: yaw 0 faces +z, +x is the avatar's left). y is up.
// The court is the real court at 73% of its size (a phone screen needs it), so a real 36 ft x 78 ft court becomes 6 m x 17.4 m, with the net at its real height.

export const HW = 3.0;           // half width of the singles court (real 4.115 m)
export const HL = 8.7;           // half length: the baselines are at z = +-8.7 (real 11.885 m)
export const SL = 4.7;           // service lines at z = +-4.7 (real 6.4 m from the net)
export const ALLEY = 1.0;        // doubles alley, drawn but out for singles (real 1.37 m)
export const NET_C = 0.92;       // net height at the centre strap (real 0.914 m)
export const NET_P = 1.07;       // net height at the posts (real 1.07 m)
export const NET_HW = HW + ALLEY; // the net's half width: the posts stand in the alleys' outer edge
export const IN_MARGIN = 0.07;   // a ball that touches a line is in: half the line width plus the flattened part of the ball
export const BR = 0.095;         // ball radius (drawn and simulated; larger than a real ball so that it can be followed on a phone)
export const G = 9.81;
export const RUN_X = 3.4, RUN_Z = 4.2;   // run-off space behind the baseline and beside the sidelines a player may use

export const netTop = (x) => { const u = Math.min(1, Math.abs(x) / NET_HW); return NET_C + (NET_P - NET_C) * u * u; };

// Surfaces: eFloor = bounce restitution; mu = friction coefficient (a grippy surface takes pace off the ball and kicks it up); shade = colours for 2D art.
export const SURFACES = {
  lawn: { id: 'lawn', name: 'Lawn', short: 'Lawn', eFloor: 0.69, mu: 0.19, blurb: 'The original surface: fast and low. The ball skids and stays low.', court: '#4f8f45', run: '#437a3b', line: '#f4f1e6', paint: ['#58994c', '#4a8a40'] },
  clay: { id: 'clay', name: 'Clay', short: 'Clay', eFloor: 0.77, mu: 0.52, blurb: 'Slow and high. The ball grips, loses pace and kicks up.', court: '#c4663e', run: '#a8532f', line: '#f2eadb', paint: ['#cb6c43', '#bd603a'] },
  hard: { id: 'hard', name: 'Hard court', short: 'Hard', eFloor: 0.74, mu: 0.33, blurb: 'Even and true: the ball bounces predictably at medium pace.', court: '#2f6fa8', run: '#2a5c8c', line: '#f4f4f0', paint: ['#3577b2', '#2b659c'] },
};
export const SURFACE_IDS = ['lawn', 'clay', 'hard'];

// Ball physics. Gravity, quadratic drag, lift from spin (Magnus), impacts on the floor and the net with spin exchange.
export const PHYS = {
  h: 1 / 240,                     // sub-step (4 per game tick)
  drag: 0.0125,                   // quadratic drag, 1/m
  magnus: 0.0011,                 // lift from spin
  spinDecay: 0.18,                // 1/s
  kappa: 0.66,                    // moment of inertia factor of a hollow ball
};

// Shot kinds. v = nominal speed leaving the racket (m/s); spin = topspin (+) or backspin (-) in rad/s; clear = how far above the net the ball
// aims to pass at the net (m); apex bounds the arc. 'serve1' and 'serve2' are the first and second serve.
export const SHOTS = {
  drive: { id: 'drive', name: 'Drive', short: 'Drive', v: 21.0, spin: 130, clear: 0.34, blurb: 'A fast topspin shot: it dips and kicks after it lands.' },
  slice: { id: 'slice', name: 'Slice', short: 'Slice', v: 14.5, spin: -95, clear: 0.42, blurb: 'A slower backspin shot: low, safe and skidding.' },
  drop: { id: 'drop', name: 'Drop shot', short: 'Drop', v: 9.0, spin: -150, clear: 0.28, blurb: 'A soft backspin shot that just clears the net and dies.' },
  lob: { id: 'lob', name: 'Lob', short: 'Lob', v: 12.0, spin: 70, clear: 2.6, blurb: 'A high ball over a rival who is close to the net.' },
  serve1: { id: 'serve1', name: 'First serve', short: 'First serve', v: 25.0, spin: 60, clear: 0.2, blurb: 'The fastest, flattest stroke, with little margin.' },
  serve2: { id: 'serve2', name: 'Second serve', short: 'Second serve', v: 17.0, spin: 170, clear: 0.55, blurb: 'A safer serve with heavy spin and a high kick.' },
  volley: { id: 'volley', name: 'Volley', short: 'Volley', v: 15.0, spin: -40, clear: 0.2, blurb: 'A short punch struck before the ball bounces.' },
};
export const RALLY_KINDS = ['drive', 'slice', 'drop', 'lob'];

export const SWING_DELAY = 0.3;   // s from the release to the contact
export const SWING_TAIL = 0.46;   // s of follow-through after the contact
export const WINDOW = 0.2;        // s: timing error at which timing quality reaches zero
export const TOSS_T = 0.86;       // s from the start of the toss to its top, where a serve is struck
export const TOSS_H = 2.72;       // m: height of the contact on a serve

export const FORMATS = {
  quick: { id: 'quick', name: 'Quick match', games: 3, noAd: true, tb: false, blurb: 'First to 3 games, no-ad scoring.' },
  short: { id: 'short', name: 'Short set', games: 4, noAd: false, tb: true, tbAt: 3, blurb: 'First to 4 games, tiebreak at 3-3.' },
  full: { id: 'full', name: 'Full set', games: 6, noAd: false, tb: true, tbAt: 6, blurb: 'First to 6 games (two clear), tiebreak at 6-6.' },
};
export const FORMAT_IDS = ['quick', 'short', 'full'];
export const PACE = { relaxed: 0.8, normal: 1.0, fast: 1.2 };
export const PACE_IDS = ['relaxed', 'normal', 'fast'];

// Rival levels. spd m/s, react s (delay before the rival starts to move), timing s (sigma of the swing timing), aim m (sigma of the aim at perfect timing),
// think (0 random legal shot .. 1 best of many), cover (0..1: recovery to a good spot), err (chance per swing of a bad strike), lunge (reach multiplier),
// net (0..1: chance to move to the net behind a short ball), srv (serve power 0..1).
export const LEVELS = [
  { id: 1, name: 'Rookie', stars: 1, agg: 0.15, spd: 4.2, react: 0.36, timing: 0.115, aim: 0.8, think: 0.0, cover: 0.2, err: 0.16, lunge: 0.9, net: 0.0, srv: 0.2 },
  { id: 2, name: 'Club player', stars: 2, agg: 0.3, spd: 4.8, react: 0.28, timing: 0.088, aim: 0.58, think: 0.3, cover: 0.45, err: 0.1, lunge: 1.0, net: 0.1, srv: 0.45 },
  { id: 3, name: 'Regional', stars: 3, agg: 0.45, spd: 5.3, react: 0.2, timing: 0.065, aim: 0.42, think: 0.55, cover: 0.65, err: 0.06, lunge: 1.05, net: 0.25, srv: 0.65 },
  { id: 4, name: 'Veteran', stars: 4, agg: 0.6, spd: 5.8, react: 0.14, timing: 0.046, aim: 0.28, think: 0.8, cover: 0.82, err: 0.03, lunge: 1.1, net: 0.4, srv: 0.82 },
  { id: 5, name: 'Master', stars: 5, agg: 0.75, spd: 6.3, react: 0.08, timing: 0.03, aim: 0.18, think: 1.0, cover: 1.0, err: 0.012, lunge: 1.15, net: 0.5, srv: 1.0 },
];

export const KITS = [
  { top: '#f4f4ef', bottoms: '#1d3f78', socks: '#f4f4ef', name: 'White and navy' },
  { top: '#e9edf2', bottoms: '#c8433b', socks: '#e9edf2', name: 'White and red' },
];

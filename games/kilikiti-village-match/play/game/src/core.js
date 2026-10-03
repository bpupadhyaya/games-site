// Shared constants and tiny pure helpers. No DOM, no clock, no randomness.
export const W = 720;
export const H = 1280;
export const G = 9.81;
export const DT = 1 / 60;
export const DEG = Math.PI / 180;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const ease = {
  out: (t) => 1 - (1 - t) * (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

// Field plane (metres). x = off side for the (right-handed) batter, which is to the RIGHT of the screen; z = down the pitch toward the bowler;
// y = up. The striker's stumps are at (0, 0); the bowler's stumps at (0, PITCH). The 3D world is (x, y, -z).
export const PITCH = 14;                  // stump to stump
export const CREASE = 1.0;                // the batter's ground: a batter whose feet are within this of the stumps is safe
export const END_Z = [0.05, PITCH - 0.25];   // where a batter stands at rest at each end (sim z)
export const RUN_LEN = END_Z[1] - END_Z[0];   // distance covered by one run
export const STUMP = { w: 0.34, h: 0.92, spacing: 0.115 };   // three tall stumps, no bails
export const FIELD = { cx: 0, cz: PITCH / 2, ax: 9.5, az: 22 };   // the boundary rope: an ellipse (x half-width, z half-length)
export const BAT = { len: 0.84, face: 0.032, sweet: 0.60, gripC: 0.16 };   // three-sided bat: along-the-bat position of the sweet spot; grip centre; face plane offset

export const BALL_R = 0.08;               // the visible and the physical radius of the hard rubber ball

// 0 at the middle of the field, 1 at the rope
export const fenceRatio = (x, z) => Math.hypot((x - FIELD.cx) / FIELD.ax, (z - FIELD.cz) / FIELD.az);
export const insideRope = (x, z) => fenceRatio(x, z) < 1;

// Opponent / team levels. Everything about a side scales with its level: how well it bowls, bats, fields, catches and throws.
export const LEVELS = [
  { key: 1, name: 'Level 1', who: 'Little cousins', blurb: 'Loose bowling, slow fielders, easy catches.', skill: 0.28, acc: 1.0, spd: 3.9, react: 0.65, hold: 0.66, tacc: 0.46, iq: 0.1 },
  { key: 2, name: 'Level 2', who: 'Neighbours', blurb: 'Honest bowling, sensible fielding.', skill: 0.46, acc: 0.78, spd: 4.3, react: 0.56, hold: 0.76, tacc: 0.58, iq: 0.35 },
  { key: 3, name: 'Level 3', who: 'Village regulars', blurb: 'Tidy all round; they punish loose balls.', skill: 0.62, acc: 0.6, spd: 4.7, react: 0.48, hold: 0.84, tacc: 0.7, iq: 0.6 },
  { key: 4, name: 'Level 4', who: 'Match specialists', blurb: 'Tight lines, quick hands, smart running.', skill: 0.78, acc: 0.44, spd: 5.1, react: 0.41, hold: 0.9, tacc: 0.8, iq: 0.82 },
  { key: 5, name: 'Level 5', who: 'Champions', blurb: 'Every gap closed, every chance taken.', skill: 0.94, acc: 0.3, spd: 5.5, react: 0.35, hold: 0.95, tacc: 0.9, iq: 1.0 },
];
export const MATE = 2;   // index of the level the computer's own team mates play at (competent, never the weakest link)

export const MODES = {
  quick: { key: 'quick', name: 'Quick match', balls: 12, wkts: 3, blurb: '12 balls and 3 wickets a side.' },
  match: { key: 'match', name: 'Full match', balls: 24, wkts: 5, blurb: '24 balls and 5 wickets a side.' },
};

export const ROLES = {
  bat: { key: 'bat', name: 'Batter', blurb: 'Face every ball when your side bats. Swipe to swing, then call the runs.' },
  bowl: { key: 'bowl', name: 'Bowler', blurb: 'Bowl every ball when your side fields. Flick to aim and bowl.' },
  inner: { key: 'inner', name: 'Inner fielder', blurb: 'Stand in the middle of the field. Chase, catch and throw to the wickets.' },
  deep: { key: 'deep', name: 'Deep fielder', blurb: 'Guard the rope. Run down the big hits and throw home.' },
};
export const ROLE_KEYS = ['bat', 'bowl', 'inner', 'deep'];

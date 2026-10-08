// Shared constants, parks, pitch types, levels and tiny math helpers. Pure: no DOM, no clock, no randomness.
export const W = 720;
export const H = 1280;
export const G = 9.81;
export const DT = 1 / 60;
export const DEG = Math.PI / 180;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v < 0 ? -1 : 1);
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const round1 = (v) => Math.round(v * 10) / 10;

// ---- field frame (metres) -------------------------------------------------------------------------------------------
// Sim frame: home plate at the origin, +z toward centre field, +x toward the first-base / right-field side, y up.
// The foul lines run at +-45 degrees from +z. The pitcher's rubber is PITCH_Z from the plate.
export const PITCH_Z = 18.44;
export const MOUND_H = 0.25;
export const FOUL_DEG = 45;
export const PLATE_HALF = 0.2159;
export const ZONE = { x0: -0.2159, x1: 0.2159, y0: 0.52, y1: 1.06 };
export const CONTACT_Z = 0.35;       // the ball is met this far in front of the plate's back edge
export const BALL_R = 0.0366;
export const FENCE_H = 3.0;

// Ballparks: original, no real stadium. `line` = distance to the foul poles, `mid` = straight-away centre field, `gap` = power alleys.
export const PARKS = {
  harbor: { key: 'harbor', name: 'Harbor Lights', short: 'Harbor', light: 'evening', line: 99, mid: 122, shape: 1.7, sky: ['#27437a', '#e58f6c', '#ffd98a'], blurb: 'Golden hour over the water, palms beyond the fence.' },
  lantern: { key: 'lantern', name: 'Lantern Night', short: 'Lantern', light: 'night', line: 101, mid: 124, shape: 1.6, sky: ['#070b1e', '#1a2756', '#3a2f5e'], blurb: 'Floodlights, flags and paper lanterns in the stands.' },
  prairie: { key: 'prairie', name: 'Prairie Noon', short: 'Prairie', light: 'day', line: 97, mid: 120, shape: 1.9, sky: ['#4f8fdc', '#9cc8f0', '#e9f2fb'], blurb: 'A bright day game, brick scoreboard, wheat fields beyond.' },
};
export const PARK_KEYS = ['harbor', 'lantern', 'prairie'];

/** Fence distance from the plate at field angle `a` (degrees, 0 = centre, + = right field). */
export function fenceDist(park, a) {
  const p = PARKS[park] ?? PARKS.harbor;
  const u = clamp(Math.abs(a) / FOUL_DEG, 0, 1.1);
  return p.mid + (p.line - p.mid) * Math.pow(u, p.shape);
}

// ---- pitch types ----------------------------------------------------------------------------------------------------
// T = flight time (s) from release to the contact plane. brk = late break (x, y in metres) applied with u^3, where u = t / T.
// win = timing-window multiplier (harder pitches are a little tighter), tell = what the Think card says.
export const PITCHES = {
  fastball: { key: 'fastball', name: 'Fastball', short: 'FB', T: 0.60, brk: [0, 0.02], win: 0.9, color: '#ff5d4a', tell: 'Straight and quick. Swing early and aim for the middle of the zone.' },
  sinker: { key: 'sinker', name: 'Sinker', short: 'SI', T: 0.64, brk: [-0.12, -0.22], win: 0.95, color: '#ff9f43', tell: 'Quick, then it dives and runs in. It arrives low, so flick higher.' },
  curve: { key: 'curve', name: 'Curveball', short: 'CU', T: 0.88, brk: [0.18, -0.55], win: 1.05, color: '#6ec6ff', tell: 'Slow with a big drop at the end. Wait, and expect it low.' },
  slider: { key: 'slider', name: 'Slider', short: 'SL', T: 0.72, brk: [0.30, -0.12], win: 0.95, color: '#c58bff', tell: 'Mid speed, and it snaps sideways at the last moment, away from a right-handed hitter.' },
  change: { key: 'change', name: 'Change-up', short: 'CH', T: 0.95, brk: [-0.06, -0.30], win: 1.1, color: '#6bdc8b', tell: 'Looks like a fastball but arrives late. Be patient.' },
};
export const PITCH_KEYS = ['fastball', 'sinker', 'curve', 'slider', 'change'];

// ---- levels (difficulty) ------------------------------------------------------------------------------------------------
// win = timing window scale, outs = outs per round, mix = pitch weights per bracket round (0 quarter, 1 semi, 2 final), skill = opponent scale
export const LEVELS = [
  { key: 'rookie', name: 'Rookie', blurb: 'Wide timing windows, 10 outs, friendly pitching.', win: 1.45, outs: 10, skill: 0.5, mix: [['fastball', 3], ['change', 2]] },
  { key: 'pro', name: 'Pro', blurb: 'Honest windows, 8 outs, a full mix of pitches.', win: 1.15, outs: 8, skill: 0.72, mix: [['fastball', 3], ['sinker', 1], ['change', 2], ['curve', 1], ['slider', 1]] },
  { key: 'allstar', name: 'All-Star', blurb: 'Tight windows, 7 outs, pitches that break late.', win: 1.0, outs: 7, skill: 0.92, mix: [['fastball', 2], ['sinker', 1], ['change', 2], ['curve', 2], ['slider', 2]] },
];

// Fictional bracket batters. First names only. pow = power, con = contact (timing steadiness), pull = tendency to pull.
export const FIELD = [
  { name: 'Mateo', home: 'Santo Domingo', hand: 1, pow: 0.98, con: 0.62, skin: 'brown', hair: 'black', trim: '#e8453c' },
  { name: 'Yuto', home: 'Osaka', hand: -1, pow: 0.82, con: 0.88, skin: 'peach', hair: 'black', trim: '#2f6fe0' },
  { name: 'Rafael', home: 'Havana', hand: 1, pow: 0.90, con: 0.74, skin: 'tan', hair: 'black', trim: '#f2c230' },
  { name: 'Jake', home: 'Omaha', hand: 1, pow: 0.94, con: 0.66, skin: 'ivory', hair: 'brown', trim: '#3aa56a' },
  { name: 'Haruto', home: 'Sapporo', hand: 1, pow: 0.78, con: 0.92, skin: 'peach', hair: 'black', trim: '#a35be0' },
  { name: 'Carlos', home: 'Santiago', hand: -1, pow: 1.02, con: 0.58, skin: 'deep', hair: 'black', trim: '#ff7a3d' },
  { name: 'Tommy', home: 'Tulsa', hand: -1, pow: 0.86, con: 0.78, skin: 'ivory', hair: 'ginger', trim: '#25b8c9' },
  { name: 'Diego', home: 'Matanzas', hand: 1, pow: 0.92, con: 0.70, skin: 'clay', hair: 'brown', trim: '#d9467d' },
];
export const YOU = { name: 'You', home: 'Home', hand: 1, pow: 1.0, con: 1.0, skin: 'tan', hair: 'brown', trim: '#ffcf4a' };
export const PITCHER_LOOK = { name: 'The pitcher', skin: 'ivory', hair: 'brown', top: '#f3f0e8', bottoms: '#e9e6dc', cap: '#1d2f55', trim: '#c23b3b' };

export const SECTORS = 5;                  // spotlight sectors across the fair field
export const SECTOR_DEG = (FOUL_DEG * 2) / SECTORS;
export const sectorOf = (angleDeg) => clamp(Math.floor((angleDeg + FOUL_DEG) / SECTOR_DEG), 0, SECTORS - 1);
export const sectorCentre = (i) => -FOUL_DEG + (i + 0.5) * SECTOR_DEG;

export const MOONSHOT_M = 125;

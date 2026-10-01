// Shared constants, themes and tiny math helpers. Pure: no DOM, no clock, no randomness.
export const W = 720;
export const H = 1280;
export const G = 9.81;
export const DT = 1 / 60;
export const DEG = Math.PI / 180;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v < 0 ? -1 : 1);
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const ease = {
  out: (t) => 1 - (1 - t) * (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
export const round1 = (v) => Math.round(v * 10) / 10;

// Field plane (metres): x = toward the off side as seen by a right-hander (right on screen), z = down the
// pitch toward the bowler, y = up. The striker's stumps are at (0, 0); the bowler's stumps at (0, pitchLen).
// Angles on the field ("shot angle") are measured from straight down the ground: 0 = straight back over the
// bowler, +90 = square on the off side, +/-180 = directly behind the batter, negative = leg side.
export const THEMES = {
  stadium: {
    key: 'stadium', name: 'Golden Hour Stadium', short: 'Stadium',
    pitchLen: 20, runLen: 17.7, baseR: 36, decel: 1.6, fenceH: 0, wicketBin: false, ball: 'leather',
    scale: 9.1, lawn: ['#4f9a42', '#438a39'], lawnEdge: '#2f6b2c',
  },
  backyard: {
    key: 'backyard', name: 'Suburban Backyard', short: 'Backyard',
    pitchLen: 14, runLen: 12, baseR: 24, decel: 2.1, fenceH: 1.8, wicketBin: true, ball: 'tennis',
    scale: 12.2, lawn: ['#6ba84a', '#5f9a42'], lawnEdge: '#3d7a33',
  },
  beach: {
    key: 'beach', name: 'Beach', short: 'Beach',
    pitchLen: 15, runLen: 13, baseR: 26, decel: 3.0, fenceH: 0, wicketBin: false, ball: 'tennis',
    scale: 11.8, lawn: ['#e8c98a', '#dfbf7f'], lawnEdge: '#c9a560',
  },
};

// Boundary radius around the field centre (0, pitchLen/2) at angle a (radians from +z toward +x).
export function fenceR(theme, a) {
  const t = THEMES[theme] ?? THEMES.stadium;
  const c = Math.cos(a), s = Math.sin(a);
  if (theme === 'backyard') return t.baseR * (1 + 0.16 * c * c - 0.14 * s * s + 0.05 * Math.sin(3 * a + 0.8));
  if (theme === 'beach') return t.baseR * (1 + 0.1 * c * c - 0.08 * s * s + 0.06 * Math.sin(2 * a + 2.0));
  return t.baseR * (1 + 0.07 * Math.cos(2 * a));
}
export function groundMaxR(theme) {
  let m = 0;
  for (let i = 0; i < 72; i++) m = Math.max(m, fenceR(theme, (i / 72) * Math.PI * 2));
  return m;
}
export function centreOf(theme) { return { x: 0, z: THEMES[theme].pitchLen / 2 }; }
// Where a point sits relative to the boundary: >1 means beyond the fence.
export function fenceRatio(theme, x, z) {
  const c = centreOf(theme);
  const dx = x - c.x, dz = z - c.z;
  return Math.hypot(dx, dz) / fenceR(theme, Math.atan2(dx, dz));
}

export const LEVELS = [
  { key: 'cousin', name: 'Little Cousin', blurb: 'Loose bowling, easy catches.', acc: 1.0, fieldIq: 0.2, fieldSpd: 5.2, react: 0.46, hold: 0.82, tgt: 0.93, aiSkill: 0.25, throwAcc: 0.42 },
  { key: 'neighbour', name: 'The Neighbour', blurb: 'Honest bowling, sensible field.', acc: 0.72, fieldIq: 0.5, fieldSpd: 5.7, react: 0.4, hold: 0.88, tgt: 0.90, aiSkill: 0.5, throwAcc: 0.52 },
  { key: 'brother', name: 'Big Brother', blurb: 'Tight lines, smart field.', acc: 0.5, fieldIq: 0.78, fieldSpd: 6.2, react: 0.34, hold: 0.93, tgt: 0.965, aiSkill: 0.75, throwAcc: 0.62 },
  { key: 'rod', name: 'Uncle Rod', blurb: 'Every trick, every gap closed.', acc: 0.34, fieldIq: 1.0, fieldSpd: 6.7, react: 0.28, hold: 0.96, tgt: 0.98, aiSkill: 0.95, throwAcc: 0.7 },
];

// The four hills: profile of the landing slope, the in-run curve and the scoring constants. Pure maths, metres, +X forward (down the hill), +Y up.
// The take-off lip is the origin. The landing profile is built from the slope angle along the hill: it starts shallow below the table, steepens to
// the steepest part ("P"), stays there up to about the K-point, and then eases out into the flat outrun.
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export const TABLE_ANGLE = 0.17;          // the take-off table slopes down 10 degrees

export const HILLS = [
  { id: 'valley', kl: 0.01404, name: 'Valley Hill', size: 'Small hill', k: 60, lin: 58, ptsPerM: 2.4, theta: 0.54, windMax: 2.0, blurb: 'Gentle and short. A friendly place to learn.', v0: 20.4 },
  { id: 'fjord', kl: 0.01274, name: 'Fjord Hill', size: 'Normal hill', k: 90, lin: 84, ptsPerM: 2.0, theta: 0.6, windMax: 2.3, blurb: 'The classic fjord hill. Balanced and fair.', v0: 23.6 },
  { id: 'cliff', kl: 0.01344, name: 'Cliff Hill', size: 'Large hill', k: 120, lin: 100, ptsPerM: 1.8, theta: 0.62, windMax: 2.6, blurb: 'Fast and long. Mistakes are punished.', v0: 25.4 },
  { id: 'ice', kl: 0.0142, name: 'Ice Flying Hill', size: 'Flying hill', k: 185, lin: 122, ptsPerM: 1.2, theta: 0.64, windMax: 3.0, blurb: 'The big one. Enormous distances.', v0: 28.4 },
];
export const hillById = (id) => HILLS.find((h) => h.id === id) || HILLS[1];

export const slopeAngle = (h, x) => {
  const u = x / h.k;
  const th0 = 0.2;
  if (u < 0.95) return lerp(th0, h.theta, ss(0, 0.55, u));
  return h.theta * (1 - ss(0.95, 1.45, u));
};

const cache = new Map();
const STEP = 0.25;
function table(h) {
  let t = cache.get(h.id);
  if (t) return t;
  const n = Math.ceil((h.k * 2.4) / STEP);
  const ys = new Float64Array(n + 1), th = new Float64Array(n + 1);
  let y = 0;
  for (let i = 0; i <= n; i++) {
    const x = i * STEP; th[i] = slopeAngle(h, x); ys[i] = y; y -= Math.tan(th[i]) * STEP;
  }
  t = { ys, th, n };
  cache.set(h.id, t);
  return t;
}
// height of the snow below the lip at horizontal distance x (negative number); beyond the table it stays flat.
export function groundY(h, x) {
  const t = table(h);
  if (x <= 0) return 0;
  const f = x / STEP, i = Math.floor(f);
  if (i >= t.n) return t.ys[t.n];
  return t.ys[i] + (t.ys[i + 1] - t.ys[i]) * (f - i);
}
export function groundAngle(h, x) {
  const t = table(h);
  if (x <= 0) return TABLE_ANGLE;
  const f = Math.min(t.n - 1, x / STEP), i = Math.floor(f);
  return t.th[i] + (t.th[i + 1] - t.th[i]) * (f - i);
}

// ---- the in-run: arc length s from the start gate (0) to the lip (lin). Heading steepens from the straight to the table angle.
export const inrunAngle = (h, s) => {
  const L = h.lin;
  return lerp(0.6, TABLE_ANGLE, ss(0.62 * L, 0.985 * L, s));
};
const irCache = new Map();
export function inrunPath(h) {
  let p = irCache.get(h.id);
  if (p) return p;
  const step = 0.5, n = Math.ceil(h.lin / step);
  const pts = [];
  // integrate backwards from the lip so the lip is exactly the origin
  let x = 0, y = 0;
  pts[n] = { s: h.lin, x, y, a: inrunAngle(h, h.lin) };
  for (let i = n - 1; i >= 0; i--) {
    const s = i * step, a = inrunAngle(h, s + step * 0.5);
    x -= Math.cos(a) * step; y += Math.sin(a) * step;
    pts[i] = { s, x, y, a: inrunAngle(h, s) };
  }
  p = { pts, step, n };
  irCache.set(h.id, p);
  return p;
}
export function inrunAt(h, s) {
  const p = inrunPath(h);
  const f = Math.max(0, Math.min(p.n, s / p.step)), i = Math.min(p.n - 1, Math.floor(f)), k = f - i;
  const a = p.pts[i], b = p.pts[i + 1];
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), a: lerp(a.a, b.a, k) };
}
// speed gained by the gate step: the start is moved up or down the in-run
export const GATES = [{ id: 0, name: 'Low gate', skip: 0.2 }, { id: 1, name: 'Middle gate', skip: 0.1 }, { id: 2, name: 'High gate', skip: 0 }];

// Pottery Wheel: the clay model. Pure and deterministic (no DOM, no clock).
//
// A pot is a stack of N horizontal layers sitting on the wheel head (y = 0). Each layer has an outer radius Ro, an inner radius Ri
// (0 = solid clay), a height h and a volume V = pi (Ro^2 - Ri^2) h that NEVER changes while the clay is being thrown. So thinning a wall
// makes the pot taller, pushing the wall outwards makes the layer shorter and thinner: the behaviours a thrower feels fall out of one rule.
// Trimming is the only step that removes clay (V is re-derived from the new radii).
//
// Every tool takes the fingertip in WORLD units on the vertical plane through the wheel axis: X = sideways (signed), Y = height above the
// wheel head. rX = |X| is the fingertip's distance from the axis. All tools return a small telemetry object for sound and feedback.

export const N = 48;                    // layers
export const TMIN = 0.07;               // thinnest wall the clay will hold
export const FLOOR_MIN = 0.12;          // thinnest floor
export const R_MAX = 1.55;              // widest the clay can go
export const Y_MAX = 4.2;               // the camera frames up to here
export const SPIN = 6.4;                // wheel radians per second
const PI = Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const area = (ro, ri) => PI * Math.max(ro * ro - ri * ri, 1e-4);
const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));

export function newPot(H0 = 1.2) {
  const Ro = new Array(N), Ri = new Array(N).fill(0), h = new Array(N), V = new Array(N), wob = new Array(N).fill(0);
  const R0 = 1.0;
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N;
    Ro[i] = u < 0.72 ? R0 * (0.98 + 0.02 * u) : R0 * Math.sqrt(Math.max(0.03, 1 - Math.pow((u - 0.72) / 0.29, 2)));
    h[i] = H0 / N; V[i] = area(Ro[i], 0) * h[i];
  }
  const pot = { Ro, Ri, h, V, wob, y0: new Array(N), yc: new Array(N), H: 0, ecc: 0.34, eccPh: 0.7, theta: 0, spin: SPIN, touch: 0, glazed: false };
  relayout(pot);
  return pot;
}

// How tall a lump gives about the right clay for a target outline (wall 0.2, floor 0.18, a little spare).
export function lumpHeightFor(target) {
  let v = Math.PI * Math.pow(targetR(target, 0.05), 2) * 0.2;
  const S = 40;
  for (let k = 0; k < S; k++) { const y = (k + 0.5) / S * target.H; v += 2 * Math.PI * targetR(target, y) * 0.2 * (target.H / S); }
  const ref = newPot(1.2).V.reduce((a, b) => a + b, 0);
  return Math.max(0.55, Math.min(1.45, 1.2 * v * 1.06 / ref));
}

export function relayout(pot) {
  let y = 0;
  for (let i = 0; i < N; i++) { pot.y0[i] = y; pot.yc[i] = y + pot.h[i] / 2; y += pot.h[i]; }
  pot.H = y;
}
// Volume-conserving: heights follow the radii.
export function conserve(pot) {
  for (let i = 0; i < N; i++) pot.h[i] = clamp(pot.V[i] / area(pot.Ro[i], pot.Ri[i]), 0.004, 0.45);
  relayout(pot);
}
// Clay-removing: radii changed, heights stay, volumes follow.
function recut(pot) { for (let i = 0; i < N; i++) pot.V[i] = area(pot.Ro[i], pot.Ri[i]) * pot.h[i]; }

const lerpAt = (pot, arr, y) => {
  if (y <= pot.yc[0]) return arr[0];
  if (y >= pot.yc[N - 1]) return arr[N - 1];
  let lo = 0, hi = N - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pot.yc[m] <= y) lo = m; else hi = m; }
  const f = (y - pot.yc[lo]) / (pot.yc[hi] - pot.yc[lo]);
  return arr[lo] + (arr[hi] - arr[lo]) * f;
};
export const roAt = (pot, y) => lerpAt(pot, pot.Ro, y);
export const riAt = (pot, y) => lerpAt(pot, pot.Ri, y);
export const floorTop = (pot) => { for (let i = 0; i < N; i++) if (pot.Ri[i] > 0.02) return pot.y0[i]; return 0; };   // top of the floor (0 when not opened)
export const isOpen = (pot) => pot.Ri[N - 1] > 0.02;

// ---- telemetry helper ----------------------------------------------------------------------------------------------------------------
const tel = (o = {}) => ({ contact: false, pressure: 0, effort: 0, warn: '', ...o });

// ---- 1. CENTRE ---------------------------------------------------------------------------------------------------------------------------
// Steady, moderate pressure on the side the clay swings towards shrinks the eccentricity. Too hard squashes and wobbles it.
export function centreTool(pot, rX, Y, dt, vy) {
  const t = tel();
  if (Y < 0.02 || Y > pot.H + 0.05) return t;
  const p = roAt(pot, Y) + pot.ecc * 0.8 - rX;                    // how far the fingertip is inside the swinging surface
  if (p < -0.02) return t;
  t.contact = true; t.pressure = clamp(p, 0, 1);
  const g = p < 0.08 ? Math.max(0, p / 0.08) : p <= 0.40 ? 1 : Math.max(0, 1 - (p - 0.40) / 0.25);
  pot.ecc = Math.max(0, pot.ecc - pot.ecc * 0.95 * g * dt - 0.012 * g * dt);
  if (p > 0.45) { pot.ecc += 0.30 * (p - 0.45) * dt; t.warn = 'Too hard'; }
  if (Math.abs(vy) > 1.1) { pot.ecc += 0.10 * (Math.abs(vy) - 1.1) * dt; t.warn = 'Hold steady'; }
  pot.ecc = clamp(pot.ecc, 0, 0.6);
  t.effort = g;
  return t;
}

// ---- 2. OPEN -------------------------------------------------------------------------------------------------------------------------------
// gs.tip / gs.rad: the fingertip's smoothed depth and sideways reach. Everything above the tip is hollowed out to the reach.
export function openTool(pot, gs, rX, Y, dt) {
  const t = tel();
  if (gs.tip === undefined) { gs.tip = pot.H; gs.rad = 0.06; }
  const goalY = clamp(Y, FLOOR_MIN, pot.H), goalR = clamp(rX, 0.06, R_MAX);
  const dy = clamp(goalY - gs.tip, -1.6 * dt, 1.6 * dt), dr = clamp(goalR - gs.rad, -1.2 * dt, 1.2 * dt);
  gs.tip += dy; gs.rad += dr;
  const speed = Math.hypot(dy, dr) / Math.max(dt, 1e-6);
  t.contact = true; t.pressure = 0.4; t.effort = Math.min(1, speed / 1.5);
  if (speed > 1.3) { pot.ecc = Math.min(0.5, pot.ecc + 0.02 * dt); t.warn = 'Slow down'; }
  let changed = false;
  for (let i = 0; i < N; i++) {
    if (pot.y0[i] < gs.tip - 1e-6) continue;
    const lim = Math.max(0.06, pot.Ro[i] - 0.17);
    const want = Math.min(gs.rad, lim);
    if (want > pot.Ri[i] + 1e-5) { pot.Ri[i] = want; changed = true; }
  }
  if (changed) conserve(pot);
  return t;
}

// ---- 3. PULL -------------------------------------------------------------------------------------------------------------------------------
// Fingertip pressed into the wall and carried upwards squeezes it thinner (symmetrically about its midline); volume conservation lifts the rim.
export function pullTool(pot, rX, Y, dt, vy, speed) {
  const t = tel();
  if (Y < 0 || Y > pot.H + 0.25) return t;
  const p = roAt(pot, Y) - rX;
  if (p < -0.03) return t;
  t.contact = true; t.pressure = clamp(p, 0, 1);
  const press = clamp(p, 0, 0.36), sf = clamp(vy / 1.0, 0, 1.4);
  const q = 0.4 * press * sf * dt;
  let moved = 0;
  if (q > 0) {
    const fl = floorTop(pot);
    for (let i = 0; i < N; i++) {
      if (pot.Ri[i] < 0.02 || pot.y0[i] < fl + 0.05) continue;
      const w = gauss(pot.yc[i] - Y, 0.24);
      if (w < 0.03) continue;
      const th = pot.Ro[i] - pot.Ri[i], room = Math.max(0, th - TMIN);
      const d = Math.min(q * w, room * 0.5);
      if (d < q * w * 0.5 && w > 0.5) t.warn = 'Wall is thin';
      pot.Ro[i] -= d * 0.5; pot.Ri[i] += d * 0.5; moved += d;
    }
    if (moved > 0) conserve(pot);
  }
  // wobble: pressing too hard, moving too fast, or moving down while pressing disturbs the wall
  let ex = 0;
  if (press > 0.24) ex += (press - 0.24) * 2.2;
  if (speed > 1.5) ex += (speed - 1.5) * 0.5;
  if (vy < -0.3 && press > 0.05) ex += 0.4;
  ex *= 1 + pot.ecc * 6;
  if (ex > 0) {
    for (let i = 0; i < N; i++) { const w = gauss(pot.yc[i] - Y, 0.5); if (w > 0.05) pot.wob[i] = Math.min(1.6, pot.wob[i] + ex * w * dt * 1.3 * (0.6 + 0.4 * pot.yc[i] / Math.max(1, pot.H))); }
    if (ex > 0.25) t.warn = press > 0.24 ? 'Too hard' : 'Slow down';
  }
  t.effort = clamp(moved * 20 + ex * 0.5, 0, 1);
  return t;
}

// ---- 4. SHAPE ------------------------------------------------------------------------------------------------------------------------------
// The wall near the fingertip follows it: out for a belly, in for a neck. The wall travels as one piece, so thickness and height adjust.
export function shapeTool(pot, gs, rX, Y, dt) {
  const t = tel();
  if (Y < 0.05 || Y > pot.H + 0.2) return t;
  const ref = roAt(pot, Y);
  t.contact = true; t.pressure = clamp(Math.abs(ref - rX), 0, 1);
  const fl = floorTop(pot);
  let moved = 0;
  const maxStep = 0.9 * dt;
  for (let i = 0; i < N; i++) {
    const w = gauss(pot.yc[i] - Y, 0.3);
    if (w < 0.04) continue;
    if (pot.Ri[i] < 0.02) {                       // solid clay (the floor): the outline simply follows, a little reluctantly
      const s0 = clamp(clamp(rX - pot.Ro[i], -0.6, 0.6) * Math.min(1, 4 * dt) * w * 0.7, -maxStep, maxStep);
      const r2 = clamp(pot.Ro[i] + s0, 0.3, R_MAX);
      if (Math.abs(r2 - pot.Ro[i]) > 1e-6) { moved += Math.abs(r2 - pot.Ro[i]); pot.Ro[i] = r2; }
      continue;
    }
    const off = (i === N - 1 || pot.y0[i] < fl + 0.04) ? 0.4 : 1;
    const want = clamp(rX - pot.Ro[i], -0.6, 0.6);
    let s = clamp(want * Math.min(1, 6 * dt) * w * off, -maxStep, maxStep);
    // the wall travels as one piece; stretching it round a wider circle thins it, a narrower one thickens it
    const th = pot.Ro[i] - pot.Ri[i], m = (pot.Ro[i] + pot.Ri[i]) / 2;
    let m2 = m + s, th2 = th * Math.sqrt(m / Math.max(0.05, m2));
    if (th2 < TMIN) { th2 = TMIN; if (s > 0 && th > TMIN) t.warn = 'Wall is thin'; else if (s > 0) { continue; } }
    m2 = Math.max(m2, 0.04 + th2 / 2);
    if (m2 + th2 / 2 > R_MAX) m2 = R_MAX - th2 / 2;
    if (Math.abs(m2 - m) > 1e-6 || Math.abs(th2 - th) > 1e-6) { moved += Math.abs(m2 - m); pot.Ro[i] = m2 + th2 / 2; pot.Ri[i] = m2 - th2 / 2; }
  }
  if (moved > 0) { conserve(pot); thinGuard(pot); }
  const ex = moved / Math.max(dt, 1e-6) > 1.6 ? 0.6 : 0;
  if (ex) for (let i = 0; i < N; i++) { const w = gauss(pot.yc[i] - Y, 0.5); if (w > 0.1) pot.wob[i] = Math.min(1.6, pot.wob[i] + ex * w * dt); }
  t.effort = clamp(moved * 12, 0, 1);
  return t;
}
function thinGuard(pot) { for (let i = 0; i < N; i++) if (pot.Ri[i] > 0.02 && pot.Ro[i] - pot.Ri[i] < TMIN) { const m = (pot.Ro[i] + pot.Ri[i]) / 2; pot.Ro[i] = m + TMIN / 2; pot.Ri[i] = Math.max(0.02, m - TMIN / 2); } }

// ---- 5. TRIM -------------------------------------------------------------------------------------------------------------------------------
// Leather-hard clay: a tool drawn along the outside smooths bumps; pressed in near the base it cuts a foot. Clay is removed, nothing rises.
export function trimTool(pot, rX, Y, dt, vy) {
  const t = tel();
  if (Y < 0 || Y > pot.H + 0.1) return t;
  const ref = roAt(pot, Y), p = ref - rX;
  if (p < -0.12) return t;
  t.contact = true; t.pressure = clamp(p, 0, 1);
  let work = 0;
  const Ro2 = pot.Ro.slice(), ws = wallStats(pot), fl = floorTop(pot);
  for (let i = 0; i < N; i++) {
    const w = gauss(pot.yc[i] - Y, 0.3);
    if (w < 0.05) continue;
    const a = i > 0 ? pot.Ro[i - 1] : pot.Ro[i], b = i < N - 1 ? pot.Ro[i + 1] : pot.Ro[i];
    const avg = (a + b) / 2, d = (avg - pot.Ro[i]) * Math.min(1, 7 * dt) * w;
    let nr = pot.Ro[i] + d;
    // the foot: low on the pot, pressing in cuts the wall back
    if (pot.yc[i] < 0.34 && p > 0.03) nr -= Math.min(p, 0.3) * 1.5 * dt * w * (1 - pot.yc[i] / 0.34);
    // clay that is too thick for its neighbours is shaved back towards the average wall
    const th = nr - pot.Ri[i];
    if (pot.Ri[i] > 0.02 && pot.yc[i] > fl + 0.1 && i < N - 1 && th > ws.mean * 1.08) nr -= Math.min(th - ws.mean, 0.1) * 0.9 * dt * w;
    nr = Math.max(nr, pot.Ri[i] + TMIN, 0.3);
    work += Math.abs(nr - pot.Ro[i]); Ro2[i] = nr;
    pot.wob[i] *= 1 - Math.min(0.9, 4 * dt * w);
  }
  for (let i = 0; i < N; i++) pot.Ro[i] = Ro2[i];
  recut(pot);
  t.effort = clamp(work * 30, 0, 1);
  return t;
}

// ---- per-tick physics ----------------------------------------------------------------------------------------------------------------------
export function stepPot(pot, dt, calm = 1) {
  pot.theta += pot.spin * dt;
  for (let i = 0; i < N; i++) pot.wob[i] *= Math.exp(-0.42 * dt * calm);
}

// ---- reading the pot -----------------------------------------------------------------------------------------------------------------
export function wallStats(pot) {
  const fl = floorTop(pot), ts = [];
  for (let i = 0; i < N; i++) if (pot.Ri[i] > 0.02 && pot.y0[i] >= fl + 0.05 && i < N - 1) ts.push(pot.Ro[i] - pot.Ri[i]);
  if (!ts.length) return { mean: 0, min: 0, cv: 0 };
  const mean = ts.reduce((a, b) => a + b, 0) / ts.length, sd = Math.sqrt(ts.reduce((a, b) => a + (b - mean) ** 2, 0) / ts.length);
  return { mean, min: Math.min(...ts), cv: sd / Math.max(mean, 1e-6) };
}
export function roughness(pot) {
  let s = 0, n = 0, w = 0;
  for (let i = 1; i < N - 1; i++) { s += Math.abs(pot.Ro[i] - (pot.Ro[i - 1] + pot.Ro[i + 1]) / 2); n++; w += pot.wob[i]; }
  return { bump: s / n, wob: w / (N - 2) };
}
export function profileDeviation(pot, target) {
  // mean absolute difference between the pot's outer radius and the target's over the height both share, plus a gentle penalty for
  // being taller or shorter than the outline (a ghost outline shows the height, so it is easy to stop at the right place)
  const top = Math.min(pot.H, target.H), S = 28;
  let e = 0;
  for (let k = 0; k < S; k++) { const y = (k + 0.5) / S * top; e += Math.abs(roAt(pot, y) - targetR(target, y)); }
  return e / S + 0.3 * Math.abs(pot.H - target.H);
}
export function targetR(target, y) {
  const P = target.pts, n = P.length;
  if (y > target.H) return 0;
  if (y <= P[0][0]) return P[0][1];
  for (let i = 1; i < n; i++) {
    if (y > P[i][0]) continue;
    const f = (y - P[i - 1][0]) / (P[i][0] - P[i - 1][0]);
    if (n === 2) return P[0][1] + (P[1][1] - P[0][1]) * f;
    // Catmull-Rom through the points, so outlines are smooth curves rather than polylines
    const p0 = P[Math.max(0, i - 2)][1], p1 = P[i - 1][1], p2 = P[i][1], p3 = P[Math.min(n - 1, i + 1)][1], f2 = f * f, f3 = f2 * f;
    return 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 + (-p0 + 3 * p1 - 3 * p2 + p3) * f3);
  }
  return P[n - 1][1];
}
export function scorePot(pot, ses) {
  const ws = wallStats(pot), ro = roughness(pot);
  const even = clamp(100 - ws.cv * 120, 0, 100);
  const smooth = clamp(100 - ro.bump * 900 - ro.wob * 50, 0, 100);
  const centre = clamp(100 - (ses.centreErr ?? 0) * 700 - ro.wob * 20, 0, 100);
  const out = { even: Math.round(even), smooth: Math.round(smooth), centre: Math.round(centre), shape: null, total: 0, stars: 0 };
  let total;
  if (ses.target) {
    const dev = profileDeviation(pot, ses.target);
    out.shape = Math.round(clamp(100 - dev * 170, 0, 100));
    total = out.shape * 0.5 + even * 0.2 + smooth * 0.2 + centre * 0.1;
  } else total = even * 0.4 + smooth * 0.4 + centre * 0.2;
  // a pot with no cavity or a collapsed wall is not a pot
  if (!isOpen(pot)) total *= 0.4;
  out.total = Math.round(total);
  out.stars = out.total >= 80 ? 3 : out.total >= 64 ? 2 : out.total >= 45 ? 1 : 0;
  return out;
}

// ---- snapshots, packing -----------------------------------------------------------------------------------------------------------------
export function snapshot(pot) { return { Ro: pot.Ro.slice(), Ri: pot.Ri.slice(), h: pot.h.slice(), V: pot.V.slice(), wob: pot.wob.slice(), ecc: pot.ecc }; }
export function restore(pot, s) { pot.Ro = s.Ro.slice(); pot.Ri = s.Ri.slice(); pot.h = s.h.slice(); pot.V = s.V.slice(); pot.wob = s.wob.slice(); pot.ecc = s.ecc; relayout(pot); }
const r3 = (v) => Math.round(v * 1000) / 1000;
export function pack(pot) { return { Ro: pot.Ro.map(r3), Ri: pot.Ri.map(r3), h: pot.h.map(r3) }; }
export function unpack(p) {
  const pot = newPot();
  for (let i = 0; i < N; i++) { pot.Ro[i] = p.Ro[i]; pot.Ri[i] = p.Ri[i]; pot.h[i] = p.h[i]; pot.V[i] = area(pot.Ro[i], pot.Ri[i]) * pot.h[i]; pot.wob[i] = 0; }
  pot.ecc = 0; relayout(pot);
  return pot;
}
// A finished-looking pot from an outline function (menu backdrop, shelf demo, Rules figures). wall = thickness, floor = floor thickness.
export function potFromOutline(fn, H, wall = 0.17, floor = 0.15) {
  const pot = newPot();
  for (let i = 0; i < N; i++) {
    const y = (i + 0.5) / N * H, r = Math.max(0.2, fn(y));
    pot.Ro[i] = r; pot.Ri[i] = y < floor ? 0 : Math.max(0.05, r - wall); pot.h[i] = H / N;
    pot.V[i] = area(pot.Ro[i], pot.Ri[i]) * pot.h[i]; pot.wob[i] = 0;
  }
  pot.ecc = 0; relayout(pot);
  return pot;
}

// Ddakji physics and rules: pure, deterministic, no drawing. Units: one tile is 1 x 1. x runs right, y runs away from the
// thrower, z is up. See design/GDD.md ("Physics as implemented"); the Rules pages are written from the numbers here.
export const TAU = Math.PI * 2;
export const MAT = { x0: -3.1, x1: 3.1, y0: -0.4, y1: 5.6 };          // the oiled-paper sheet the tiles may lie on
export const REST = { x0: -2.3, x1: 2.3, y0: 1.1, y1: 4.5 };          // where a resting tile is kept (so it can always be struck)
export const THROWER = { x: 0, y: -2.2 };
export const HAND = { x: 0, y: -1.9, z: 1.35 };
export const THICK = 0.14;
export const A_G = 40;                                                // pivot gravity: theta'' = -A cos(theta)
export const OMEGA_C = Math.sqrt(2 * A_G);                            // spin needed (undamped) to reach vertical
export const DAMP = 1.2;
export const WIND_T = 0.12;
export const DT_SIM = 1 / 120;
export const FLY_MIN = 0.34, FLY_MAX = 0.62;                          // flight time of the slap (strong = quick)
export const PIN_PEN = 0.65, MISS_GAP = 1.4;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const wrapPi = (a) => { let r = a % TAU; if (r > Math.PI) r -= TAU; if (r < -Math.PI) r += TAU; return r; };
export const clampRest = (x, y) => ({ x: clamp(x, REST.x0, REST.x1), y: clamp(y, REST.y0, REST.y1) });
export const clampMat = (x, y) => ({ x: clamp(x, MAT.x0 + 0.5, MAT.x1 - 0.5), y: clamp(y, MAT.y0 + 0.5, MAT.y1 - 0.2) });

export function corners(x, y, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw), h = 0.5, out = [];
  for (const [u, v] of [[-h, -h], [h, -h], [h, h], [-h, h]]) out.push({ x: x + u * c - v * s, y: y + u * s + v * c });
  return out;
}
const axesOf = (poly) => [0, 1].map((i) => { const a = poly[i], b = poly[i + 1]; const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: -dy / l, y: dx / l }; });
const project = (poly, ax) => { let lo = Infinity, hi = -Infinity; for (const p of poly) { const d = p.x * ax.x + p.y * ax.y; if (d < lo) lo = d; if (d > hi) hi = d; } return [lo, hi]; };
const segDist = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};
// Two convex squares: { sep, dist } when apart (dist = closest approach), { sep:false, pen } when they overlap (pen = least push to part them).
export function squares(pa, pb) {
  let pen = Infinity;
  for (const ax of [...axesOf(pa), ...axesOf(pb)]) {
    const [a0, a1] = project(pa, ax), [b0, b1] = project(pb, ax);
    const o = Math.min(a1, b1) - Math.max(a0, b0);
    if (o <= 0) {
      let d = Infinity;
      for (const [P, Q] of [[pa, pb], [pb, pa]]) for (const p of P) for (let i = 0; i < 4; i++) d = Math.min(d, segDist(p, Q[i], Q[(i + 1) % 4]));
      return { sep: true, dist: d, pen: 0 };
    }
    pen = Math.min(pen, o);
  }
  return { sep: false, dist: 0, pen };
}

// ---- the lift --------------------------------------------------------------------------------------
// shot: { px, py (landing centre after scatter), yaw (tile yaw at landing), s (0..1 strength), w (-1..1 twist), flat (0.85..1.1) }
// target: { x, y, yaw, mass }, mass of the thrown tile in `massA`.
export function lift(shot, target, massA) {
  const ca = corners(shot.px, shot.py, shot.yaw), ct = corners(target.x, target.y, target.yaw);
  const sq = squares(ca, ct);
  const dx = shot.px - target.x, dy = shot.py - target.y, c = Math.cos(-target.yaw), s = Math.sin(-target.yaw);
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  const side = Math.abs(lx) >= Math.abs(ly) ? 'x' : 'y';
  const nl = side === 'x' ? { x: Math.sign(lx) || 1, y: 0 } : { x: 0, y: Math.sign(ly) || 1 };         // outward normal of the struck edge, tile frame
  const lat = side === 'x' ? ly : lx;
  const cw = Math.cos(target.yaw), sw = Math.sin(target.yaw);
  const nw = { x: nl.x * cw - nl.y * sw, y: nl.x * sw + nl.y * cw };                                      // same, world frame
  const ap = Math.hypot(shot.px - THROWER.x, shot.py - THROWER.y) || 1;
  const approach = ((shot.px - THROWER.x) * -nw.x + (shot.py - THROWER.y) * -nw.y) / ap;
  const apF = 0.68 + 0.32 * Math.pow(clamp(approach, 0, 1), 0.8);
  const latF = 1 - 0.65 * Math.pow(Math.min(1, Math.abs(lat) / 0.75), 2);
  let g, kind = 'ok';
  if (!sq.sep) { if (sq.pen > PIN_PEN) { g = 0.04; kind = 'pinned'; } else g = 1 - 1.15 * sq.pen; }
  else { g = sq.dist <= 0.12 ? 1 : Math.exp(-Math.pow((sq.dist - 0.12) / 0.38, 2)); if (sq.dist > MISS_GAP) kind = 'miss'; }
  const u = 0.25 + 0.95 * shot.s;
  let pow = u * 1.5;
  if (shot.s > 0.8) pow *= 1 - 2.4 * (shot.s - 0.8);
  const spinF = 1 + 0.25 * Math.abs(shot.w);
  const massF = Math.sqrt(massA / target.mass);
  const Q = pow * g * latF * apF * spinF * massF * shot.flat;
  return { Q, kind, gap: sq.sep ? sq.dist : -sq.pen, side, nl, nw, lat, latF, apF, g, hinge: { x: -nl.x, y: -nl.y } };
}

// The pivoting tile. Returns { theta: Float32 samples every 1/60 s, peak, flipped, restTheta }.
export function hinge(Q) {
  const w0 = OMEGA_C * Q * 0.8, wk = 0.2 * OMEGA_C * Q / WIND_T;
  let th = 0, om = w0, t = 0, peak = 0;
  const out = [0];
  const per = Math.round(1 / 60 / DT_SIM);
  let bounced = false, n = 0;
  for (let i = 0; i < 480; i++) {
    const wind = wk * Math.exp(-t / WIND_T);
    om += (-A_G * Math.cos(th) - DAMP * om + wind * Math.cos(th)) * DT_SIM;
    th += om * DT_SIM; t += DT_SIM;
    if (th < 0) { th = 0; if (om < -0.6 && !bounced) { om = -om * 0.18; bounced = true; } else om = 0; }
    if (th > Math.PI) { th = Math.PI; if (om > 0.8 && !bounced) { om = -om * 0.16; bounced = true; } else om = 0; }
    if (th > peak) peak = th;
    if (++n % per === 0) out.push(th);
    if ((th === 0 || th === Math.PI) && om === 0 && t > 0.05 && (peak < Math.PI / 2 || th === Math.PI)) break;
  }
  const flipped = peak >= Math.PI / 2 + 0.02;
  out.push(flipped ? Math.PI : 0);
  return { theta: out.map((v) => Math.round(v * 1e4) / 1e4), peak, flipped };
}

export function classify(L, h) {
  if (L.kind === 'pinned') return 'pinned';
  if (L.kind === 'miss') return 'miss';
  if (h.flipped) return 'flip';
  if (h.peak >= 0.5) return 'wobble';
  return 'thud';
}

// ---- a throw ---------------------------------------------------------------------------------------
export const scatterSigma = (s, w, tremor = 0) => 0.04 + 0.17 * Math.pow(s, 1.8) + 0.12 * Math.abs(w) + tremor;
const gauss = (rng) => (rng.next() + rng.next() + rng.next() + rng.next() - 2) * 1.732;      // unit-ish normal
// Yaw the thrown tile lands with: half the swing of the approach plus the twist.
export const yawFor = (x, y, w) => wrapPi((Math.atan2(y - THROWER.y, x - THROWER.x) - Math.PI / 2) * 0.5 + w * 0.9);
export const flightTime = (s) => FLY_MAX - (FLY_MAX - FLY_MIN) * s;

// Everything about one throw is decided here, once, from the aim and the rng. The result is plain data the animation replays.
// aim: { x, y, s, w }; tilePow: mass of the thrower's tile; target tile: { x, y, yaw, mass }.
export function resolveThrow(aim, target, massA, rng, tremor = 0) {
  const sg = scatterSigma(aim.s, aim.w, tremor);
  const mx = clampMat(aim.x + gauss(rng) * sg, aim.y + gauss(rng) * sg);
  const yaw = wrapPi(yawFor(mx.x, mx.y, aim.w) + (rng.next() - 0.5) * 0.12);
  const flat = 0.9 + rng.next() * 0.2;
  const shot = { px: mx.x, py: mx.y, yaw, s: aim.s, w: aim.w, flat };
  const L = lift(shot, target, massA);
  const h = L.kind === 'pinned' || L.kind === 'miss' ? { theta: [0, 0], peak: 0, flipped: false } : hinge(L.Q);
  const kind = classify(L, h);
  const sk = 0.04 + 0.55 * Math.max(0, aim.s - 0.65);
  const dir = { x: mx.x - THROWER.x, y: mx.y - THROWER.y }; const dl = Math.hypot(dir.x, dir.y) || 1;
  const rest = clampRest(mx.x + (dir.x / dl) * sk * (kind === 'pinned' ? 0.2 : 1), mx.y + (dir.y / dl) * sk * (kind === 'pinned' ? 0.2 : 1));
  const pinnedRest = kind === 'pinned' ? { x: mx.x, y: mx.y } : null;
  return {
    aim: { x: aim.x, y: aim.y, s: aim.s, w: aim.w }, land: { x: mx.x, y: mx.y, yaw }, rest: pinnedRest ?? rest, skid: sk, flat,
    Q: L.Q, g: L.g, gap: L.gap, kind, nl: L.nl, hinge: L.hinge, theta: h.theta, peak: h.peak, flipped: h.flipped, T: flightTime(aim.s), sigma: sg,
    after: h.flipped ? clampRest(target.x - L.nw.x, target.y - L.nw.y) : { x: target.x, y: target.y },
  };
}

// Expected (noise-free) lift quality for a candidate aim, for the opponents and the hint. Cheap: no integration.
export function quickQ(aim, target, massA) {
  const yaw = yawFor(aim.x, aim.y, aim.w);
  return lift({ px: aim.x, py: aim.y, yaw, s: aim.s, w: aim.w, flat: 1 }, target, massA);
}

// ---- tiles -----------------------------------------------------------------------------------------
export const tileMass = (crisp) => 0.9 + 0.2 * clamp(crisp, 0, 1);

// Flight pose of the thrown tile at fraction u (0..1) of its flight: position, pitch (rad, 0 = flat), yaw.
export function flightPose(aimLand, s, u) {
  const e = u * u * (3 - 2 * u);
  const x = HAND.x + (aimLand.x - HAND.x) * e, y = HAND.y + (aimLand.y - HAND.y) * (0.15 * u + 0.85 * e);
  const arc = Math.sin(Math.PI * Math.min(1, u * 1.05)) * (1.25 - 0.45 * s);
  const z = THICK * 0.5 + (HAND.z - THICK * 0.5) * Math.pow(1 - u, 1.7) + arc * (1 - u * 0.2);
  const pitch = -0.6 * Math.pow(1 - u, 2);
  return { x, y, z: Math.max(0, z - THICK * 0.5), pitch, yaw: aimLand.yaw * e };
}

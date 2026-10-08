// Pure, deterministic physics for the three events. Units: metres, kilograms, seconds. Coordinates: f = forward (12 o'clock), y = up, l = left.
// The caber is a tapered pole simulated as a rigid body in the vertical plane that contains the throw direction (angle theta from straight
// up, axis pointing from the small end to the big end, positive = leaning forward). Two ground contacts matter: the first one decides whether it
// "turned" (big end first) and the second decides which way it fell.
export const G = 9.81;
export const STEP = 1 / 240;

export const CABERS = [
  { id: 'glen', name: 'Glen caber', L: 5.2, m: 52, d: 2.95, ft: '17 ft', kg: '52 kg' },
  { id: 'braemar', name: 'Braemar caber', L: 5.9, m: 79, d: 3.45, ft: '19 ft 6 in', kg: '79 kg' },
  { id: 'champion', name: 'Championship caber', L: 6.4, m: 92, d: 3.8, ft: '21 ft', kg: '92 kg' },
];
const inertia = (c) => c.m * (c.L * c.L / 12 + (c.d - c.L / 2) ** 2) * 0.92;   // tapered: a little less than a uniform pole

// Resolve a ground contact of the rod end at offset r = (rx, ry) from the centre of mass. e = bounce, mu = grass grip. Mutates b.
function impact(b, c, rx, ry, e, mu) {
  const I = inertia(c);
  const ux = b.vf + b.w * ry, uy = b.vy - b.w * rx;           // contact point velocity (clockwise-positive omega)
  if (uy >= 0) return;
  const kxx = 1 / c.m + (ry * ry) / I, kyy = 1 / c.m + (rx * rx) / I, kxy = -(rx * ry) / I;
  // try sticking: solve K J = (0 - ux, -e*uy - uy)
  const bx = -ux, by = -e * uy - uy;
  const det = kxx * kyy - kxy * kxy;
  let Jx = (bx * kyy - kxy * by) / det, Jy = (kxx * by - kxy * bx) / det;
  if (Math.abs(Jx) > mu * Jy) {
    const s = Math.sign(ux) || 1;
    Jy = by / (kyy - s * mu * kxy);
    Jx = -s * mu * Jy;
  }
  b.vf += Jx / c.m; b.vy += Jy / c.m;
  b.w += (ry * Jx - rx * Jy) / I;
}

// Whole toss from the release. p = { c (caber), fs, ys (small end position at release), th (angle), w (rad/s), vf, vy (centre of mass velocity) }.
// Returns { frames[], first: 'big'|'small'|'none', turned, fellBack, thF (rest angle), landF (position of the pivot end), tFirst, tEnd, maxY }.
export function flyCaber(p, opts = {}) {
  const c = p.c, I = inertia(c), TAU = Math.PI * 2;
  const b = { th: p.th, w: p.w, f: p.fs + c.d * Math.sin(p.th), y: p.ys + c.d * Math.cos(p.th), vf: p.vf, vy: p.vy };
  const frames = [];
  const rec = opts.record !== false;
  const out = { first: 'none', turned: false, fellBack: false, thF: p.th, landF: 0, tFirst: 0, tEnd: 0, maxY: b.y, thFirst: 0 };
  let t = 0, phase = 'air', pivot = null, nextRec = 0;
  const sR = -c.d, bR = c.L - c.d;                                  // signed distances of the small / big end from the centre of mass along the axis
  const push = () => { if (rec) frames.push({ t: +t.toFixed(4), f: +b.f.toFixed(4), y: +b.y.toFixed(4), th: +b.th.toFixed(5) }); };
  push();
  for (let n = 0; n < 240 * 14 && phase !== 'rest'; n++) {
    if (phase === 'air') {
      b.vy -= G * STEP; b.f += b.vf * STEP; b.y += b.vy * STEP; b.th += b.w * STEP; t += STEP;
      if (b.y > out.maxY) out.maxY = b.y;
      const sy = b.y + sR * Math.cos(b.th), by = b.y + bR * Math.cos(b.th);
      if (sy <= 0 || by <= 0) {
        const big = by <= sy;
        const dist = big ? bR : sR;
        out.first = big ? 'big' : 'small'; out.tFirst = t; out.thFirst = b.th;
        b.y -= big ? by : sy;                                        // put the contact end exactly on the ground, then apply the impulse
        const rx = dist * Math.sin(b.th), ry = dist * Math.cos(b.th);
        impact(b, c, rx, ry, 0.06, 0.9);
        pivot = { big, f: b.f + rx, c: -dist };                      // c = signed distance of the centre of mass from the pivot along the axis
        pivot.Ip = I + c.m * pivot.c * pivot.c;
        out.landF = pivot.f;
        phase = 'pivot';
      }
    } else {
      // rotation about the end on the ground: I_p theta'' = m g c sin(theta); the grass damps it a little
      b.w += ((c.m * G * pivot.c * Math.sin(b.th)) / pivot.Ip) * STEP; b.w *= 1 - 0.5 * STEP; b.th += b.w * STEP; t += STEP;
      b.f = pivot.f - pivot.c * Math.sin(b.th); b.y = -pivot.c * Math.cos(b.th);
      const farH = (pivot.big ? -c.L : c.L) * Math.cos(b.th);        // height of the far end above the grass
      if (farH <= 0) phase = 'rest';
    }
    if (rec) { nextRec += STEP; if (nextRec >= 1 / 60 - 1e-9) { push(); nextRec = 0; } }
  }
  push();
  const th = ((b.th % TAU) + TAU) % TAU;
  out.thF = th;
  const smallForward = Math.sin(b.th) < 0;                           // the axis (small -> big) points backwards, so the small end lies ahead
  out.turned = out.first === 'big' && smallForward;
  out.fellBack = out.first === 'big' && !smallForward;
  out.tEnd = t; out.frames = frames;
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// From the athlete's last two actions (run speed + heave timing) to the state of the caber at the moment it leaves the hands.
export const inertiaOf = inertia;
export function releaseOf(c, v, tau, bx = 0, bz = 0) {
  const I = inertia(c);
  const E = 300 + 160 * v;                                               // joules the athlete can put into the pole: a faster run gives more
  const wMax = Math.sqrt((2 * E) / I);
  const sway = Math.min(1, Math.hypot(bx, bz) / 0.5);                    // an unsteady carry loses power
  return {
    c, fs: 0.45, ys: 1.12,
    th: 0.04 + 0.22 * tau + 0.8 * bx,
    w: wMax * (0.22 + 0.78 * tau) * (1 - 0.3 * sway),
    vf: 0.75 * v + 0.5 * tau,
    vy: 1.0 + 2.6 * tau,
  };
}

// The part of the heave sweep (0..1) in which the pole turns, found by trying the physics. Returns null when this run speed cannot turn it.
export function solveZone(c, v, bx = 0, bz = 0) {
  const N = 48, ok = [];
  for (let i = 0; i <= N; i++) {
    const tau = i / N;
    ok.push(flyCaber(releaseOf(c, v, tau, bx, bz), { record: false }).turned);
  }
  let lo = -1, hi = -1;
  for (let i = 0; i <= N; i++) if (ok[i]) { if (lo < 0) lo = i; hi = i; }
  if (lo < 0) return null;
  const a = lo / N, b = hi / N;
  return { lo: a, hi: b, mid: (a + b) / 2, half: Math.max(0.02, (b - a) / 2) };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Braemar stone put (open style): a projectile released about 1.9 m up, 0.0 m from the toe board.
export const STONES = [
  { id: 'light', name: 'Light stone', kg: '7.3 kg', lb: '16 lb', k: 0.8, vMax: 9.8 },
  { id: 'heavy', name: 'Braemar stone', kg: '11.8 kg', lb: '26 lb', k: 1.0, vMax: 8.9 },
];
export function stoneFlight(stone, angleDeg, power) {
  const v = 5.1 + (stone.vMax - 5.1) * Math.max(0, Math.min(1, power));
  const a = (angleDeg * Math.PI) / 180, h = 1.9;
  const vx = v * Math.cos(a), vy = v * Math.sin(a);
  const tl = (vy + Math.sqrt(vy * vy + 2 * G * h)) / G;
  const frames = [];
  for (let t = 0; t <= tl + 1e-9; t += 1 / 60) frames.push({ t: +t.toFixed(4), f: +(0.35 + vx * t).toFixed(4), y: +(h + vy * t - 0.5 * G * t * t).toFixed(4) });
  frames.push({ t: +tl.toFixed(4), f: +(0.35 + vx * tl).toFixed(4), y: 0.11 });
  return { v, vx, vy, tl, dist: 0.35 + vx * tl, frames };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Weight over the bar: a 56 lb weight swung in a vertical circle (radius R about the hip pivot) and let go on the way up behind the thrower.
export const WT = { R: 1.25, pivotY: 1.45, barF: -2.4, g: G };
export const BAR_HEIGHTS = [3.6, 3.9, 4.2, 4.5, 4.8, 5.1, 5.4, 5.7];
// angle a: from straight down, positive = swung back. Position and velocity (per unit angular speed) of the weight on the circle.
export const wtPos = (a) => ({ f: -WT.R * Math.sin(a), y: WT.pivotY - WT.R * Math.cos(a) });
export function weightFlight(vb, a, barH) {
  // vb: speed at the lowest point. Energy: v^2 = vb^2 - 2 g R (1 - cos a). Direction: tangent, up and back for a in (0, pi).
  const v2 = vb * vb - 2 * G * WT.R * (1 - Math.cos(a));
  const v = Math.sqrt(Math.max(0, v2));
  const p = wtPos(a);
  const vf = -v * Math.cos(a), vy = v * Math.sin(a);
  const tApex = Math.max(0, vy / G), yApex = p.y + (vy > 0 ? (vy * vy) / (2 * G) : 0), fApex = p.f + vf * tApex;
  const frames = [];
  const tEnd = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * G * p.y))) / G;
  for (let t = 0; t <= tEnd + 1e-9; t += 1 / 60) frames.push({ t: +t.toFixed(4), f: +(p.f + vf * t).toFixed(4), y: +Math.max(0.12, p.y + vy * t - 0.5 * G * t * t).toFixed(4) });
  // bar test: the weight must be above the bar while it passes from the thrower's side to the far side
  let side = null, cleared = false, hit = false;
  for (let i = 1; i < frames.length; i++) {
    const A = frames[i - 1], B = frames[i];
    if ((A.f - WT.barF) * (B.f - WT.barF) <= 0 && A.f !== B.f) {
      const k = (WT.barF - A.f) / (B.f - A.f), yy = A.y + (B.y - A.y) * k;
      side = { y: yy, t: A.t + (B.t - A.t) * k };
      if (yy >= barH + 0.1) cleared = true; else if (yy >= barH - 0.55) hit = true;
    }
  }
  return { v, vf, vy, tApex, yApex, fApex, frames, tEnd, barY: side ? side.y : null, cleared, hit, release: p };
}

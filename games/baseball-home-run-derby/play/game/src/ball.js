// Pitch paths, swing resolution and batted-ball flight. Pure functions of their arguments (the caller passes the rng).
import { G, DEG, clamp, lerp, PITCHES, ZONE, PITCH_Z, MOUND_H, CONTACT_Z, FENCE_H, FOUL_DEG, fenceDist, sectorOf, MOONSHOT_M } from './core.js';

export const LEAD = 0.11;            // seconds from the swing trigger (finger lifted) to the bat meeting the ball
export const WINDOWS = { perfect: 0.022, good: 0.046, ok: 0.074, weak: 0.102 };   // seconds either side of the ideal moment, before scaling

/** A pitch: type, where it crosses the contact plane (x, y) and the release point. Positions are sim metres. */
export function makePitch(type, target, rel) {
  const T = PITCHES[type];
  const R = { x: rel.x, y: rel.y, z: PITCH_Z - 1.75 };
  const P = { x: target.x, y: target.y, z: CONTACT_Z };
  const brk = { x: T.brk[0] * (rel.hand ?? 1), y: T.brk[1] };
  const P0 = { x: P.x - brk.x, y: P.y - brk.y, z: P.z };
  return { type, T: T.T, R, P, P0, brk, h: P.y };
}

/** Ball position at time t after release (continues past the plate under gravity if nobody hits it). */
export function pitchPos(p, t, out = [0, 0, 0]) {
  if (t <= p.T) {
    const u = clamp(t / p.T, 0, 1), u3 = u * u * u;
    out[0] = lerp(p.R.x, p.P0.x, u) + p.brk.x * u3;
    out[1] = lerp(p.R.y, p.P0.y, u) + p.brk.y * u3 + 0.5 * G * t * (p.T - t);
    out[2] = lerp(p.R.z, p.P0.z, u);
    return out;
  }
  const a = pitchPos(p, p.T - 0.01, [0, 0, 0]), b = pitchPos(p, p.T, [0, 0, 0]);
  const s = t - p.T;
  out[0] = b[0] + (b[0] - a[0]) * 100 * s; out[2] = b[2] + (b[2] - a[2]) * 100 * s;
  out[1] = Math.max(0.0, b[1] + (b[1] - a[1]) * 100 * s - 0.5 * G * s * s);
  return out;
}

/** Where the bat can meet the ball: the pitch path point nearest the swing's moment, kept within the bat's reach (z from -0.8 to 2.0 m of the plate). */
export function contactPoint(pitch, tc) {
  const zr = pitchPos(pitch, tc, [0, 0, 0])[2];
  const zc = clamp(zr, -0.8, 2.0);
  const tz = pitch.T * (pitch.R.z - zc) / (pitch.R.z - CONTACT_Z);
  return pitchPos(pitch, tz, [0, 0, 0]);
}

/** Natural launch angle for a ball at height h (low pitches are easier to lift). */
export const reqLoft = (h) => clamp(26 + (0.78 - h) * 40, 14, 38);

/** Map a drag vector (virtual units, screen y down) to an aim: spray in [-1, 1] (+ = right field) and launch angle in degrees. */
export function aimFromDrag(dx, dy) {
  const s = clamp(dx / 130, -1, 1);
  const up = -dy;                                  // screen up is positive
  const loft = clamp(12 + (up / 150) * 28, 6, 44);
  return { s, loft };
}
export const DEFAULT_AIM = { s: 0, loft: 26 };

/**
 * Resolve a swing. `ts` = trigger time since the pitch was released. Returns the contact verdict (before the flight is simulated).
 * ctx: { hand (1 right-hander, -1 left), win (window scale), pow (0.7..1.1), con (0..1 steadiness, only used by the computer: scales nothing here) }
 */
export function resolveSwing(pitch, ts, aim, ctx, rng) {
  const tc = ts + LEAD;
  const dt = tc - pitch.T;                                   // + late, - early
  const sc = ctx.win * PITCHES[pitch.type].win;
  const W = { perfect: WINDOWS.perfect * sc, good: WINDOWS.good * sc, ok: WINDOWS.ok * sc, weak: WINDOWS.weak * sc };
  const ad = Math.abs(dt);
  let grade, qt;
  if (ad <= W.perfect) { grade = 'perfect'; qt = 1 - 0.08 * (ad / W.perfect); }
  else if (ad <= W.good) { grade = 'good'; qt = lerp(0.92, 0.74, (ad - W.perfect) / (W.good - W.perfect)); }
  else if (ad <= W.ok) { grade = 'ok'; qt = lerp(0.74, 0.40, (ad - W.good) / (W.ok - W.good)); }
  else if (ad <= W.weak) { grade = 'weak'; qt = lerp(0.40, 0.14, (ad - W.ok) / (W.weak - W.ok)); }
  else return { kind: 'whiff', why: dt < 0 ? 'early' : 'late', dt, tc, ts, grade: dt < 0 ? 'early' : 'late', qt: 0, bp: contactPoint(pitch, tc) };
  const req = reqLoft(pitch.h);
  const dev = Math.abs(aim.loft - req);
  const ql = clamp(1 - (dev / 24) * (dev / 24), 0.5, 1);
  const q = qt * (0.62 + 0.38 * ql);
  // where the ball is met (it is wherever the pitch is at tc)
  const bp = contactPoint(pitch, tc);
  const inside = -ctx.hand * bp[0];                          // metres toward the batter
  const pullSign = ctx.hand > 0 ? -1 : 1;                    // a right-hander pulls to the left side of the field (-x)
  const bias = pullSign * (-dt * 300 + inside * 38);        // early pulls, late pushes; inside pitches pull
  let spray = aim.s * 42 + bias;
  const speedBonus = PITCHES[pitch.type].T < 0.7 ? 1.5 : 0;
  let v = (14 + 36 * q + speedBonus) * (0.88 + 0.12 * ctx.pow) * (1 + 0.012 * (rng.next() - 0.5) * 2);
  let launch = aim.loft + (req - aim.loft) * 0.28 + (rng.next() * 2 - 1) * (1 - qt) * 26 - (qt < 0.45 ? 9 * (0.45 - qt) / 0.45 : 0) - (pitch.type === 'sinker' ? 3 : 0);
  launch = clamp(launch, -8, 62);
  if (q < 0.18) { v *= 0.7; }
  return { kind: 'hit', grade, dt, tc, ts, qt, ql, q, v, launch, spray, bp, dev, req, inside };
}

// ---- batted ball flight ----------------------------------------------------------------------------------------------------
export const PHYS = { KD: 0.0063, KL: 0.0028 };   // drag and lift (Magnus) per metre; calibrated so ~46 m/s at 28 degrees carries about 120 m

/**
 * Fly the ball. Returns a flat sample array (x, y, z every 1/60 s), the verdict and landing facts.
 * park: key; the ball is a home run when it crosses the fence line in the air above FENCE_H and is fair.
 */
export function flyBall(hit, park, opts = {}) {
  const KD = opts.KD ?? PHYS.KD, KL = opts.KL ?? PHYS.KL;
  const L = hit.launch * DEG, S = hit.spray * DEG;
  const sp = Math.max(1, hit.v);
  let vx = sp * Math.cos(L) * Math.sin(S), vy = sp * Math.sin(L), vz = sp * Math.cos(L) * Math.cos(S);
  let x = hit.bp[0], y = Math.max(0.3, hit.bp[1]), z = hit.bp[2];
  // backspin lift: more for lifted, squarely-hit balls; topped balls have none
  const back = clamp(0.5 + 0.035 * hit.launch, 0.1, 1.15) * (0.55 + 0.45 * (hit.qt ?? 1));
  const traj = [x, y, z];
  const step = 1 / 240;
  let t = 0, bounces = 0, apex = y, firstGround = null, fence = null, wall = false, hr = false, foul = false, ended = false;
  let nextSample = 1 / 60, stopT = 0;
  const hv = (a, b) => Math.sqrt(a * a + b * b);
  while (t < 12 && !ended) {
    const sp2 = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
    // lift perpendicular to velocity, in the vertical plane
    const hs = hv(vx, vz) || 1e-6;
    let lx = -vy * vx / hs, ly = hs, lz = -vy * vz / hs;
    const ln = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1; lx /= ln; ly /= ln; lz /= ln;
    const lift = KL * back * sp2 * sp2 * (y < 0.05 ? 0 : 1);
    const ax = -KD * sp2 * vx + lift * lx, ay = -G - KD * sp2 * vy + lift * ly, az = -KD * sp2 * vz + lift * lz;
    vx += ax * step; vy += ay * step; vz += az * step;
    x += vx * step; y += vy * step; z += vz * step; t += step;
    if (y > apex) apex = y;
    // fence line
    const r = Math.hypot(x, z), ang = Math.atan2(x, z) / DEG;
    if (!fence && z > 1 && !opts.noFence && r >= fenceDist(park, ang)) {
      fence = { x, y, z, t, ang, r };
      foul = Math.abs(ang) > FOUL_DEG;
      if (!foul && y > FENCE_H && bounces === 0) hr = true;
      else if (!foul) { wall = true; vx = -vx * 0.05; vz = -vz * 0.12; vy = Math.min(vy, 0); x -= (x / r) * 0.15; z -= (z / r) * 0.15; }
    }
    if (y <= 0) {
      y = 0;
      if (!firstGround) {
        firstGround = { x, z, t, ang: Math.atan2(x, z) / DEG, r: Math.hypot(x, z) };
        if (!fence && (Math.abs(firstGround.ang) > FOUL_DEG || z < 0)) foul = true;
      }
      if (hr || (fence && foul)) { /* keep flying past the fence to the stands: stop at the ground */ if (hr) { ended = true; } }
      bounces += 1;
      vy = -vy * 0.42; vx *= 0.8; vz *= 0.8;
      if (bounces > 4 || Math.abs(vy) < 1.2) { vy = 0; }
      if (hv(vx, vz) < 1.2 && vy === 0) ended = true;
    }
    if (vy === 0 && y === 0) { const f = Math.max(0, 1 - 2.2 * step / Math.max(0.5, hv(vx, vz))); vx *= f; vz *= f; if (hv(vx, vz) < 0.6) ended = true; }
    if (t >= nextSample) { traj.push(x, y, z); nextSample += 1 / 60; stopT = t; }
    if (wall && t - fence.t > 1.4) ended = true;
    if (foul && firstGround && t - firstGround.t > 1.2) ended = true;
  }
  const land = firstGround ?? { x, z, t, ang: Math.atan2(x, z) / DEG, r: Math.hypot(x, z) };
  const dist = hr ? land.r : (wall && fence ? fence.r : land.r);
  const angle = hr ? fence.ang : land.ang;
  let kind;
  if (hr) kind = 'homerun';
  else if (foul) kind = 'foul';
  else if (wall) kind = 'wall';
  else if (hit.launch >= 55) kind = 'popup';
  else if (apex < 4.5 || hit.launch < 9) kind = 'grounder';
  else if (hit.launch < 22 && apex < 16) kind = 'liner';
  else kind = 'fly';
  const fl = Math.round(t * 60) / 60;
  const out = traj.map((v) => Math.round(v * 100) / 100);
  return {
    traj: out, n: out.length / 3, kind, hr, foul, wall, dist: Math.round(dist * 10) / 10, angle: Math.round(angle * 10) / 10,
    apex: Math.round(apex * 10) / 10, hang: Math.round((firstGround ? firstGround.t : t) * 100) / 100,
    fenceT: fence ? Math.round(fence.t * 1000) / 1000 : null, landT: firstGround ? Math.round(firstGround.t * 1000) / 1000 : null,
    spot: hr ? sectorOf(fence.ang) : -1, moonshot: hr && dist >= MOONSHOT_M, flightT: fl, stopT,
  };
}

export function describeOutcome(f) {
  switch (f.kind) {
    case 'homerun': return 'HOME RUN';
    case 'foul': return 'FOUL BALL';
    case 'wall': return 'OFF THE WALL';
    case 'popup': return 'POP-UP';
    case 'grounder': return 'GROUND OUT';
    case 'liner': return 'LINE OUT';
    default: return 'FLY OUT';
  }
}
export { MOUND_H, ZONE };

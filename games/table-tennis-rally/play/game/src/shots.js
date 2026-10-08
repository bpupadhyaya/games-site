// The shot solver. A stroke is described by an INTENT (where to land the ball, how fast, how much spin); the solver
// finds the launch direction that really lands the simulated ball there (it flies the same physics the game uses),
// then an ERROR model nudges the launch by how well the stroke was made (timing, position, reading the incoming spin).
// The player and the computer opponents both hit through this one path.
import { BALL_R, TABLE, NET, sign, other, stepBall, spinVector } from './physics.js';

const H = 1 / 240;
const NET_TOP = TABLE.H + NET.H;

// Stroke kinds: base speed range (m/s), spin (rad/s about the travel axis, + topspin), depth of the landing spot from the net (m),
// and the incoming spin the stroke handles best (-1 heavy backspin ... +1 heavy topspin, in units of 450 rad/s).
export const KINDS = {
  touch: { v: [5.2, 6.6], top: 40, depth: 0.7, ideal: -0.3, risk: 0.6, label: 'Touch' },
  push: { v: [5.8, 7.4], top: -260, depth: 0.85, ideal: -0.8, risk: 0.7, label: 'Push' },
  chop: { v: [6.4, 8.2], top: -430, depth: 1.0, ideal: 0.5, risk: 0.8, label: 'Chop' },
  loop: { v: [7.4, 10.4], top: 430, depth: 0.98, ideal: -0.5, risk: 1.0, label: 'Loop' },
  drive: { v: [10.0, 14.0], top: 150, depth: 1.08, ideal: 0.2, risk: 1.25, label: 'Drive' },
  smash: { v: [14.0, 19.0], top: 80, depth: 1.1, ideal: 0.2, risk: 1.5, label: 'Smash' },
  block: { v: [5.4, 9.0], top: 20, depth: 0.9, ideal: 0.6, risk: 0.7, label: 'Block' },
  lob: { v: [5.6, 6.8], top: 320, depth: 1.15, ideal: 0.3, risk: 0.9, label: 'Lob', maxPitch: 1.2 },
  flick: { v: [8.0, 11.0], top: 380, depth: 0.9, ideal: -0.3, risk: 1.2, label: 'Flick' },
  serveShort: { v: [3.6, 4.8], top: -330, depth: 0.55, ideal: 0, risk: 1.0, label: 'Short serve', maxPitch: 0.1 },
  serveLong: { v: [8.0, 10.5], top: 160, depth: 1.18, ideal: 0, risk: 1.2, label: 'Long serve', maxPitch: 0.1 },
  serveSpin: { v: [5.0, 6.8], top: 260, depth: 1.0, ideal: 0, risk: 1.0, label: 'Spin serve', maxPitch: 0.1 },
};

// Fly one candidate stroke; report where it first bounces on the far half, the clearance over the net, and the flight time.
function flyShot(from, side, az, pitch, speed, top, sideS, serve) {
  const s = sign(side);
  const dx = Math.sin(az), dz = -s * Math.cos(az);
  const cp = Math.cos(pitch);
  const b = { p: [from[0], from[1], from[2]], v: [dx * cp * speed, Math.sin(pitch) * speed, dz * cp * speed], w: spinVector(dx, dz, top, sideS) };
  const ev = [];
  let crossed = false, clear = 9, bounces = 0, t = 0;
  for (let i = 0; i < 360; i++) {
    const z0 = b.p[2];
    ev.length = 0;
    stepBall(b, H, ev);
    t += H;
    for (const e of ev) {
      if (e.type === 'net') return { valid: false, why: 'net' };
      if (e.type === 'floor') return { valid: false, why: 'floor' };
      if (e.type === 'bounce') {
        bounces++;
        if (serve && bounces === 1) { if (e.side === side && !crossed) continue; return { valid: false, why: 'direct' }; }   // a serve bounces on the server's own half first
        if (e.side === other(side) && crossed) return { valid: clear > 0.004, clear, x: b.p[0], z: b.p[2], t, why: clear > 0.004 ? 'ok' : 'low', vOut: b.v.slice() };
        return { valid: false, why: 'own' };
      }
    }
    if ((z0 > 0) !== (b.p[2] > 0) && !crossed) { crossed = true; clear = b.p[1] - (NET_TOP + BALL_R); }
    if (crossed && !serve && Math.abs(b.p[2]) > TABLE.hl + 0.4) return { valid: false, why: 'long' };
    if (b.p[1] < TABLE.H - 0.25) return { valid: false, why: 'under' };
  }
  return { valid: false, why: 'time' };
}

// Find the launch (azimuth, pitch) that lands the ball on (tx, depth) for this speed and spin. Returns null if the speed cannot do it.
function solveFixedSpeed(from, side, tx, depth, speed, top, sideS, serve, maxPitch) {
  let az = Math.atan2(tx - from[0], Math.max(0.5, Math.abs(from[2]) + depth));
  let best = null;
  let lo = -0.25, hi = 0.95, step = 0.06;
  for (let it = 0; it < 4; it++) {
    best = null;
    let prev = null;
    for (let p = lo; p <= hi + 1e-9; p += step) {
      const r = flyShot(from, side, az, p, speed, top, sideS, serve);
      if (r.valid) {
        const err = Math.abs(Math.abs(r.z) - depth) + Math.max(0, p - maxPitch) * 0.6;
        if (!best || err < best.err) best = { p, err, r };
        // refine between two valid neighbours that bracket the depth
        if (prev && prev.r.valid && (Math.abs(prev.r.z) - depth) * (Math.abs(r.z) - depth) < 0) {
          let a = prev.p, c = p, ra = prev.r;
          for (let k = 0; k < 5; k++) {
            const m = (a + c) / 2, rm = flyShot(from, side, az, m, speed, top, sideS, serve);
            if (!rm.valid) break;
            if ((Math.abs(rm.z) - depth) * (Math.abs(ra.z) - depth) > 0) { a = m; ra = rm; } else c = m;
            const e2 = Math.abs(Math.abs(rm.z) - depth) + Math.max(0, m - maxPitch) * 0.6;
            if (e2 < best.err) best = { p: m, err: e2, r: rm };
          }
        }
      }
      prev = { p, r };
    }
    if (!best) return null;
    // correct the azimuth from the lateral miss, then search again around the pitch that worked
    const miss = tx - best.r.x;
    if (Math.abs(miss) < 0.012 && best.err < 0.03) break;
    az += Math.atan2(miss, Math.max(0.6, Math.abs(from[2]) + Math.abs(best.r.z)));
    lo = best.p - 0.1; hi = best.p + 0.1; step = 0.025;
  }
  if (best.err > 0.3) return null;
  return { az, pitch: best.p, land: best.r, err: best.err };
}

// intent: { tx, depth, speed, top, side, serve } -> { az, pitch, speed, top, side, land } (tries lower speeds if the first cannot clear the net).
const SPEED_TRY = [1, 1.09, 0.92, 1.18, 0.85, 1.3, 0.78, 1.45];
export function solveShot(from, side, intent) {
  const maxPitch = intent.maxPitch ?? 0.42;
  let best = null;
  for (const f of SPEED_TRY) {
    const sp = intent.speed * f;
    const r = solveFixedSpeed(from, side, intent.tx, intent.depth, sp, intent.top, intent.side, !!intent.serve, maxPitch);
    if (r && (!best || r.err < best.err)) best = { ...r, speed: sp, top: intent.top, sideS: intent.side };
    if (best && best.err < 0.05) break;
  }
  if (best) return best;
  // last resort: a lob over the net
  const r = solveFixedSpeed(from, side, 0, Math.min(intent.depth, 0.9), 6.0, 200, 0, !!intent.serve, 1.2);
  return r ? { ...r, speed: 6.0, top: 200, sideS: 0 } : null;
}

// Launch the ball: ideal solution plus the stroke's mistakes. `q` in 0..1 is the stroke quality (1 = perfect),
// `mismatch` is how wrong the stroke is for the incoming spin (units of ~4.5 degrees), `rnd` returns numbers in [-1, 1].
export function launch(ball, from, side, intent, q, mismatch, rnd, riskScale = 1) {
  const sol = solveShot(from, side, intent);
  if (!sol) return null;
  const bad = Math.pow(1 - q, 1.35);
  const k = (intent.risk ?? 1) * riskScale;
  const dAz = rnd() * (0.008 + 0.06 * bad) * k;
  const dPitch = rnd() * (0.004 + 0.052 * bad) * k + mismatch * 0.078;
  const dSpeed = 1 + rnd() * (0.01 + 0.07 * bad) * k;
  const sg = sign(side);
  const az = sol.az + dAz, pitch = sol.pitch + dPitch, sp = sol.speed * dSpeed;
  const dx = Math.sin(az), dz = -sg * Math.cos(az), cp = Math.cos(pitch);
  const top = sol.top * (1 - 0.4 * bad), sideS = sol.sideS * (1 - 0.4 * bad);
  ball.p = [...from];
  ball.v = [dx * cp * sp, Math.sin(pitch) * sp, dz * cp * sp];
  ball.w = spinVector(dx, dz, top, sideS);
  return { sol, az, pitch, speed: sp, land: sol.land, err: { dAz, dPitch, dSpeed, bad } };
}

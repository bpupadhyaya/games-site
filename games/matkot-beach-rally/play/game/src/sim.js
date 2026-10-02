// Matkot physics and rules. Pure and deterministic: no clock, no DOM; randomness only from the rng it is given.
// Units: metres, seconds. x across the court, y along it (side 0 = near player at small y, side 1 = far player),
// z up. Every number the Rules page quotes lives here.
import { COURT, clamp, lerp } from './cam.js';

export const G = 7.0;              // gravity used for the ball (m/s^2), a little floaty so rallies are readable
export const HW = COURT.hw;        // half width of the court
export const LEN = COURT.len;      // length of the court
export const MID = COURT.mid;      // the line in the middle (there is no net)
export const ZLO = 0.35;           // lowest paddle height
export const ZHI = 2.0;            // highest paddle height
export const Z_ARR = 1.0;          // every hit aims to arrive at the other side at this height
export const SWEET_LO = 0.95;      // contact heights in this band are "sweet"
export const SWEET_HI = 1.4;
export const REACH = 1.15;         // paddle reach (m); calm mode widens it
export const SWING = { windup: 0.05, impact: 0.26, total: 0.55 };
export const SPEED = 4.4;          // the player's top running speed (m/s)
export const AIM_SPAN = 3.8;       // full left/right contact offset sends the ball this far from the centre line

// Where each side may stand.
export const LIM = [{ x0: -4.7, x1: 4.7, y0: -1.0, y1: 5.6 }, { x0: -4.7, x1: 4.7, y0: 6.4, y1: 13.0 }];

export const gauss = (rng) => {
  const u = Math.max(1e-9, rng.next()), v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Flight time of a return as a function of contact height: high contact is fast and flat, low contact is a slow lob.
export const flightTime = (h) => (h >= 1.15 ? 1.05 - ((h - 1.15) / 0.85) * 0.43 : 1.05 + ((1.15 - h) / 0.8) * 0.5);
// How far past the middle line the ball is aimed (m), before the front/back adjustment.
export const depthFor = (h) => (h >= 1.15 ? 3.4 - ((h - 1.15) / 0.85) * 1.6 : 3.4 + ((1.15 - h) / 0.8) * 1.5);
// Aim error (metres, one sigma) from contact height alone.
export const heightSigma = (h) => (h < SWEET_LO ? (SWEET_LO - h) * 0.9 : h > SWEET_HI ? (h - SWEET_HI) * 1.0 : 0);
export const styleOf = (h) => (h > 1.55 ? 'smash' : h < 0.8 ? 'lob' : 'drive');

export function newPlayer(side, o = {}) {
  return {
    side, face: side === 0 ? 1 : -1, x: 0, y: side === 0 ? 2.6 : 9.4, vx: 0, vy: 0,
    speed: o.speed ?? SPEED, accel: o.accel ?? 26, reach: o.reach ?? REACH,
    swingT: -1, swingHit: false, swingAim: null, run: 0, tx: 0, ty: side === 0 ? 2.6 : 9.4, hitFlash: 0, lastQ: 0,
  };
}

export function newWorld(o = {}) {
  return {
    t: 0, rng: o.rng, wind: o.wind ?? 0, pace: o.pace ?? 1, phase: 'idle', verdict: null, hits: 0,
    p: [newPlayer(0, o.p0), newPlayer(1, o.p1)],
    b: { x: 0, y: 0, z: 1.5, vx: 0, vy: 0, vz: 0, live: false, last: -1, spin: 0, rest: false },
  };
}

// ---- ballistics ---------------------------------------------------------------------------------
export const ballAt = (b, wind, t) => ({ x: b.x + b.vx * t + 0.5 * wind * t * t, y: b.y + b.vy * t, z: b.z + b.vz * t - 0.5 * G * t * t, vx: b.vx + wind * t, vy: b.vy, vz: b.vz - G * t });
// Time until the ball (falling) reaches height zt; null when it never does.
export function timeToZ(b, zt) {
  const disc = b.vz * b.vz - 2 * G * (zt - b.z);
  if (disc < 0) return null;
  const t = (b.vz + Math.sqrt(disc)) / G;
  return t >= 0 ? t : null;
}
export const velFor = (from, tx, ty, T, wind) => ({
  vx: (tx - from.x - 0.5 * wind * T * T) / T,
  vy: (ty - from.y) / T,
  vz: (Z_ARR - from.z + 0.5 * G * T * T) / T,
});

// What a swing made now at contact height h with the ball at (bx, by) would do: used by the real hit and by the aim guide.
export function shotFor(p, ball, h, opt = {}) {
  const fy = p.y + p.face * 0.3;
  const dx = ball.x - p.x, dy = (ball.y - fy) * p.face;
  const d = Math.hypot(dx, dy);
  const dxn = clamp(dx / p.reach, -1, 1), dyn = clamp(dy / p.reach, -1, 1);
  const aim = opt.aim ?? null;
  let tx = aim ? aim.tx : dxn * AIM_SPAN;
  const adj = aim ? aim.depth : dyn * 1.0;
  let sigma = heightSigma(h) + Math.max(0, d / p.reach - 0.8) * 1.5 + (aim?.sigma ?? 0);
  const T = flightTime(h) * (opt.pace ?? 1);
  let dep = clamp(depthFor(h) + adj * 0.9, 0.8, 5.6);
  tx = clamp(tx, -HW + 0.1, HW - 0.1);
  return { tx, ty: MID + p.face * dep, T, h, d, sigma, sweet: h >= SWEET_LO && h <= SWEET_HI && d <= 0.9 * p.reach, style: styleOf(h) };
}

// ---- serve ----------------------------------------------------------------------------------------
export function toss(w, side, xOff = 0) {
  const p = w.p[side];
  w.b = { x: p.x + xOff, y: p.y + p.face * 0.3, z: 2.0, vx: 0, vy: 0, vz: 0.8, live: true, last: -1, spin: 0, rest: false };
  w.phase = 'rally'; w.verdict = null; w.hits = 0; w.server = side;
}

// ---- one tick --------------------------------------------------------------------------------------
function movePlayer(p, c, dt) {
  const L = LIM[p.side];
  if (c.tx !== undefined) { p.tx = clamp(c.tx, L.x0, L.x1); p.ty = clamp(c.ty, L.y0, L.y1); }
  const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy);
  const slow = p.swingT >= SWING.windup + SWING.impact ? 0.7 : 1;
  const vmax = p.speed * slow;
  const want = Math.min(vmax, dist * 9);
  const wx = dist > 1e-6 ? (dx / dist) * want : 0, wy = dist > 1e-6 ? (dy / dist) * want : 0;
  const ax = wx - p.vx, ay = wy - p.vy, am = Math.hypot(ax, ay), lim = p.accel * dt;
  if (am > lim) { p.vx += (ax / am) * lim; p.vy += (ay / am) * lim; } else { p.vx = wx; p.vy = wy; }
  p.x = clamp(p.x + p.vx * dt, L.x0, L.x1);
  p.y = clamp(p.y + p.vy * dt, L.y0, L.y1);
  p.run += Math.hypot(p.vx, p.vy) * dt;
}

// Whose ball is it? After a hit, the other side's; before the serve is struck, the server's.
export const canHit = (w, side) => (w.b.last >= 0 ? w.b.last !== side : w.server === side);

function contact(w, p, ev) {
  const b = w.b;
  const fy = p.y + p.face * 0.3;
  const d = Math.hypot(b.x - p.x, b.y - fy);
  if (d > p.reach || b.z < ZLO || b.z > ZHI) return false;
  const h = clamp(b.z, ZLO, ZHI);
  const aim = p.swingAim;
  const sh = shotFor(p, b, h, { aim, pace: w.pace });
  let { tx, ty } = sh;
  if (sh.sigma > 0) {
    tx = clamp(tx + gauss(w.rng) * sh.sigma, -HW - 1.5, HW + 1.5);
    ty += gauss(w.rng) * sh.sigma * 0.8;
  }
  const v = velFor(b, tx, ty, sh.T, w.wind);
  b.vx = v.vx; b.vy = v.vy; b.vz = v.vz; b.last = p.side; b.live = true;
  w.hits += 1;
  p.swingHit = true; p.hitFlash = 0.25; p.lastQ = sh.sweet ? 1 : 0.5;
  ev.push({ t: 'hit', side: p.side, h, d: sh.d, sweet: sh.sweet, style: sh.style, T: sh.T, tx, ty, x: b.x, y: b.y, z: b.z, speed: Math.hypot(v.vx, v.vy), hits: w.hits, sigma: sh.sigma });
  return true;
}

function judge(w, ev) {
  const b = w.b, out = Math.abs(b.x) > HW || b.y < 0 || b.y > LEN;
  const side = b.y > MID ? 1 : 0;
  const last = b.last;
  let winner, reason;
  if (last < 0) { winner = 1 - w.server; reason = 'serve'; }
  else if (out) { winner = 1 - last; reason = 'out'; }
  else if (side === last) { winner = 1 - last; reason = 'short'; }
  else { winner = last; reason = 'unreturned'; }
  w.verdict = { winner, reason, last, x: b.x, y: b.y, landSide: side, out };
  w.phase = 'dead';
  b.live = false;
  ev.push({ t: 'land', x: b.x, y: b.y, vz: b.vz, out, side });
  ev.push({ t: 'point', ...w.verdict });
}

export function step(w, dt, ctrl) {
  const ev = [];
  w.t += dt;
  for (let s = 0; s < 2; s++) {
    const p = w.p[s], c = ctrl[s] ?? {};
    movePlayer(p, c, dt);
    if (p.hitFlash > 0) p.hitFlash -= dt;
    if (c.swing && p.swingT < 0 && w.phase !== 'dead') { p.swingT = 0; p.swingHit = false; p.swingAim = c.aim ?? null; ev.push({ t: 'swing', side: s }); }
    if (p.swingT >= 0) {
      const t0 = p.swingT; p.swingT += dt;
      if (p.swingT >= SWING.windup && t0 <= SWING.windup + SWING.impact && !p.swingHit && w.phase === 'rally' && w.b.live && canHit(w, s)) contact(w, p, ev);
      if (p.swingT >= SWING.total) { if (!p.swingHit) ev.push({ t: 'whiff', side: s }); p.swingT = -1; }
    }
  }
  const b = w.b;
  if (b.live) {
    b.vx += w.wind * dt;
    const px = b.x, py = b.y, pz = b.z;
    b.x += b.vx * dt; b.y += b.vy * dt; b.vz -= G * dt; b.z += b.vz * dt;
    if (b.z <= 0) {
      const k = pz / Math.max(1e-6, pz - b.z);
      b.x = px + (b.x - px) * k; b.y = py + (b.y - py) * k; b.z = 0;
      judge(w, ev);
      b.vx *= 0.3; b.vy *= 0.3; b.vz = Math.abs(b.vz) * 0.3;
    }
  } else if (w.phase === 'dead' && !b.rest) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.vz -= G * dt; b.z += b.vz * dt;
    if (b.z <= 0) { b.z = 0; b.vz = Math.abs(b.vz) * 0.35; b.vx *= 0.6; b.vy *= 0.6; if (b.vz < 0.6) { b.vz = 0; b.vx = 0; b.vy = 0; b.rest = true; } }
  }
  return ev;
}

// Sample the ball's path (for the AI and for the guides): [{t,x,y,z}] every dt seconds until it lands.
export function trajectory(b, wind, dt = 0.03, tMax = 3.2) {
  const out = [];
  for (let t = 0; t <= tMax; t += dt) {
    const q = ballAt(b, wind, t);
    out.push({ t, x: q.x, y: q.y, z: q.z });
    if (q.z <= 0) break;
  }
  return out;
}

export const inBounds = (x, y) => Math.abs(x) <= HW && y >= 0 && y <= LEN;
export { lerp };

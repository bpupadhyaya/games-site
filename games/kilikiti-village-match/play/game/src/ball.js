// Ball physics + batting resolution. Pure and deterministic: fixed 1/120 s sub-steps, randomness only via the rng passed in.
// Frame: see core.js (x = off side, z = down the pitch toward the bowler, y = up).
import { G, DEG, PITCH, STUMP, FIELD, BALL_R, clamp, lerp } from './core.js';

// A hard rubber ball: bouncy, a little draggy, rolls a long way on grass.
const B = { kd: 0.026, e: 0.7, tang: 0.8, decel: 8.5, power: 0.95 };

export const DELIVERIES = {
  straight: { name: 'Straight', cue: 'Comes on straight at the bounce spot.', swing: 0 },
  swerveIn: { name: 'Swerve in', cue: 'Drifts toward the batter\'s legs in the air.', swing: -2.6 },
  swerveOut: { name: 'Swerve out', cue: 'Drifts away toward the off side in the air.', swing: 2.6 },
};
export const DELIVERY_KEYS = Object.keys(DELIVERIES);

export const SPEED = { min: 11.5, max: 19.5 };
export const BOUNCE = { zMin: 0.9, zMax: 10.5, xMax: 1.5 };
export const REL_Z = PITCH - 0.8;   // where the ball leaves the bowler's hand (z)
export const REL_Y = 2.0;

const r3 = (v) => Math.round(v * 1000) / 1000;

// spec: { type, speed, bx, bz, relX }  bx / bz = where the ball first pitches (x, z). acc = error scale (0 = perfect).
export function makeSpec(type, aim, rng, acc = 0.5) {
  const sxn = 0.05 + 0.42 * acc, szn = 0.15 + 1.0 * acc;
  return {
    type,
    speed: clamp(aim.speed, SPEED.min, SPEED.max),
    bx: clamp(aim.bx + rng.range(-1, 1) * sxn, -2.1, 2.1),
    bz: clamp(aim.bz + rng.range(-1, 1) * szn, 0.3, 11.2),
    relX: aim.relX ?? rng.range(-0.2, 0.2),
    swing: DELIVERIES[type].swing,
  };
}

// Flies a delivery from the bowler's hand to past the batter. Track samples every 1/60 s from the release.
export function flyDelivery(spec) {
  const zr = REL_Z;
  const t1 = (zr - spec.bz) / spec.speed;
  const vy0 = (0.5 * G * t1 * t1 - REL_Y) / t1;
  const vx0 = (spec.bx - spec.relX - 0.5 * spec.swing * t1 * t1) / t1;
  const pts = [r3(spec.relX), r3(REL_Y), r3(zr)];   // sample 0 is the release itself (t = 0)
  let x = spec.relX, y = REL_Y, z = zr, vx = vx0, vy = vy0, vz = -spec.speed;
  let t = 0, bounced = false, bounceT = -1;
  const h = 1 / 120;
  let n = 1;
  while (t < 4 && z > -2.5 && n < 400) {
    if (!bounced && t < t1) vx += spec.swing * h;
    vy -= G * h;
    x += vx * h; y += vy * h; z += vz * h;
    t += h;
    if (!bounced && y <= 0 && vy < 0) { bounced = true; y = 0; vy = -vy * B.e * 1.05; vz *= 0.84; bounceT = t; }
    else if (bounced && y <= 0 && vy < 0) { y = 0; vy = -vy * B.e; }
    if (Math.round(t / h) % 2 === 0) { pts.push(r3(x), r3(y), r3(z)); n++; }
  }
  const N = pts.length / 3;
  const at = (i) => [pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]];
  const cross = (zc) => {
    for (let i = 1; i < N; i++) {
      const a = at(i - 1), c = at(i);
      if (a[2] >= zc && c[2] < zc) {
        const f = (a[2] - zc) / (a[2] - c[2] || 1);
        return { t: (i - 1 + f) / 60, x: lerp(a[0], c[0], f), y: lerp(a[1], c[1], f), i: i - 1 + f };
      }
    }
    return null;
  };
  const cC = cross(0.4) ?? { t: 1, x: 0, y: 0.5, i: 60 };
  const c0 = cross(0) ?? cC;
  const bowled = Math.abs(c0.x) <= STUMP.w / 2 + BALL_R * 0.6 && c0.y <= STUMP.h + BALL_R * 0.5 && c0.y > -0.05;
  const bouncedBeforeBat = bounceT >= 0 && bounceT < cC.t;
  const speedC = (() => { const i = Math.max(1, Math.floor(cC.i)); const a = at(i - 1), c = at(i); return Math.hypot((c[0] - a[0]) * 60, (c[1] - a[1]) * 60, (c[2] - a[2]) * 60); })();
  return {
    spec, p: pts, n: N, tC: cC.t, xc: cC.x, yc: cC.y, speedC, t0: c0.t, x0: c0.x, y0: c0.y, bowled, bounced: bouncedBeforeBat, bounceT,
    wide: Math.abs(c0.x) > 1.6 || c0.y > 2.3,
    lengthClass: lengthClassOf(cC.y, bouncedBeforeBat),
  };
}

export function lengthClassOf(yc, bounced) {
  if (!bounced) return yc > 0.9 ? 'fulltoss' : 'full';
  if (yc < 0.3) return 'yorker';
  if (yc < 0.6) return 'full';
  if (yc < 1.05) return 'good';
  if (yc < 1.6) return 'short';
  return 'bouncer';
}

export function deliveryPos(d, t) {
  const f = clamp(t * 60, 0, d.n - 1.0001);
  const i = Math.floor(f), u = f - i, p = d.p;
  return [lerp(p[i * 3], p[i * 3 + 3], u), lerp(p[i * 3 + 1], p[i * 3 + 4], u), lerp(p[i * 3 + 2], p[i * 3 + 5], u)];
}

// ---- batting resolution ------------------------------------------------------------------------------------
// The sim accepts a swipe this long after the player's finger commits, so the bat can meet the ball exactly then.
export const SWING_LEAD = 0.05;
export const WINDOWS = { perfect: 0.04, good: 0.07, ok: 0.095, poor: 0.115 };

export function idealAngle(xc, yc, bounced) {
  if (!bounced && yc < 0.9) return clamp(xc * 46, -55, 60);
  if (yc < 0.35) return clamp(xc * 40, -45, 45);
  if (yc < 1.05) return clamp(xc * 58, -62, 72);
  if (yc < 1.6) return xc > 0.5 ? 72 : clamp(-52 + xc * 70, -62, 30);
  return xc > 0.55 ? 78 : -66;
}

export function timingLabel(e) {
  const m = Math.abs(e);
  if (m <= WINDOWS.perfect) return 'PERFECT';
  if (m <= WINDOWS.good) return e < 0 ? 'GOOD, a touch early' : 'GOOD, a touch late';
  if (m <= WINDOWS.ok) return e < 0 ? 'EARLY' : 'LATE';
  return e < 0 ? 'WAY EARLY' : 'WAY LATE';
}

// Resolves one swing against one delivery. sw = { t (ball-flight time the finger committed), angle (deg: 0 straight, + off side), power 0..1 }.
// A swing with power 0 and kind 'block' is a defensive prod.
export function resolveSwing(d, sw, rng, assist = 1) {
  const block = sw.kind === 'block';
  const e = sw.t + (block ? 0 : SWING_LEAD) - d.tC;
  const a = assist * (block ? 1 : 1.15 - 0.55 * clamp(sw.power, 0, 1));
  const m = Math.abs(e) / a;
  const out = { e, label: timingLabel(e / a), kind: 'miss', contact: false, Q: 0, power: sw.power, angle: sw.angle };
  const xc = d.xc, yc = d.yc;
  const win = (block ? WINDOWS.ok * 1.2 : WINDOWS.poor) * a;
  const reachOff = sw.angle > 20 ? 1.25 : 1.1, reachLeg = sw.angle < -20 ? -1.0 : -0.85;
  const reach = xc <= reachOff && xc >= reachLeg && yc <= 2.2;
  if (Math.abs(e) > win || !reach) { out.why = !reach ? 'out of reach' : e < 0 ? 'early' : 'late'; return out; }
  const qt = m <= WINDOWS.perfect ? 1 : m <= WINDOWS.good ? lerp(1, 0.84, (m - WINDOWS.perfect) / (WINDOWS.good - WINDOWS.perfect))
    : m <= WINDOWS.ok ? lerp(0.84, 0.58, (m - WINDOWS.good) / (WINDOWS.ok - WINDOWS.good)) : lerp(0.58, 0.34, (m - WINDOWS.ok) / (WINDOWS.poor - WINDOWS.ok));
  const phi = idealAngle(xc, yc, d.bounced);
  const mis = Math.abs(sw.angle - phi);
  const qa = clamp(1.05 - Math.max(0, mis - 32) / 75, 0.3, 1);
  const Q = block ? clamp(qt, 0.3, 1) : qt * (0.55 + 0.45 * qa);
  out.Q = Q; out.qt = qt; out.qa = qa; out.ideal = phi;
  const pw = clamp(sw.power, 0, 1);
  let ang, el, spd;
  if (block) {
    if (yc > 1.6) { out.kind = 'edge'; ang = rng.range(-35, 35) + 150 * (rng.chance(0.5) ? 1 : -1); el = rng.range(35, 60); spd = rng.range(3, 6); }
    else { out.kind = 'block'; ang = rng.range(-45, 45); el = rng.range(0, 3); spd = rng.range(1.2, 3.6) * (0.6 + 0.4 * Q); }
  } else {
    const edgeish = m > WINDOWS.ok || Q < 0.43;
    if (edgeish && rng.chance(m > WINDOWS.ok ? 0.6 : 0.35)) {
      out.kind = 'edge';
      const late = e > 0;
      ang = (late ? 1 : -1) * rng.range(105, 168);
      el = rng.chance(0.5) ? rng.range(8, 28) : rng.range(40, 66);
      spd = rng.range(4, 9) * B.power;
    } else {
      out.kind = 'hit';
      const shift = clamp(e * 240, -28, 28);
      ang = sw.angle + shift + rng.range(-3, 3);
      let base = 2 + 24 * Math.pow(clamp((pw - 0.7) / 0.3, 0, 1), 1.4);
      if (d.lengthClass === 'yorker' || d.lengthClass === 'full') base = Math.min(base, 17);
      if (d.lengthClass === 'yorker') base = Math.min(base, 9);
      el = base + (1 - Q) * 24 * (pw > 0.4 ? 1 : 0.25) + rng.range(-1.5, 1.5);
      spd = (2.5 + 12 * Math.pow(pw, 0.8)) * (0.35 + 0.65 * Q) * (0.9 + 0.012 * d.speedC) * B.power;
      spd *= 1 - rng.next() * 0.3 * pw * pw;
      if (Math.abs(ang) > 105) spd *= 0.8;
      if (d.lengthClass === 'bouncer') { spd *= 0.92; el = Math.max(el, 6); }
    }
  }
  ang = clamp(ang, -178, 178);
  el = clamp(el, 0, 72);
  const hs = spd * Math.cos(el * DEG);
  out.init = { x: xc, y: Math.max(0.05, yc), z: 0.4, vx: Math.sin(ang * DEG) * hs, vy: Math.sin(el * DEG) * spd, vz: Math.cos(ang * DEG) * hs };
  out.contact = true; out.angle = ang; out.elev = el; out.speed = spd;
  return out;
}

// ---- ball in the field ------------------------------------------------------------------------------------------
// Flies a struck / dropped ball until it stops or crosses the rope. init = { x, y, z, vx, vy, vz }. Samples every 1/60 s.
// Returns { p (flat xyz), n, bounces (sample indexes), boundary ({ idx, kind 4|6 }), stopIdx, touched }.
export function flyBall(init, opts = {}) {
  const pts = [r3(init.x), r3(init.y), r3(init.z)], bounces = [];   // sample 0 is the starting point (t = 0)
  let { x, y, z, vx, vy, vz } = init;
  let touched = !!opts.touched, t = 0, n = 1, boundary = null, stopIdx = -1;
  const h = 1 / 120;
  const maxN = opts.maxN ?? 700;
  while (n < maxN) {
    const sp = Math.hypot(vx, vy, vz);
    const kd = B.kd * (y < 0.02 ? 0.35 : 1);
    vx -= kd * sp * vx * h; vy -= kd * sp * vy * h; vz -= kd * sp * vz * h;
    vy -= G * h;
    x += vx * h; y += vy * h; z += vz * h;
    t += h;
    if (y <= 0) {
      y = 0;
      if (vy < -1.4) { vy = -vy * B.e; vx *= B.tang; vz *= B.tang; touched = true; bounces.push(pts.length / 3); }
      else {
        vy = 0; touched = true;
        const hsp = Math.hypot(vx, vz);
        if (hsp > 0.01) { const ns = Math.max(0, hsp - B.decel * h); vx *= ns / hsp; vz *= ns / hsp; }
      }
    }
    if (Math.round(t / h) % 2 === 0) {
      pts.push(r3(x), r3(y), r3(z));
      n++;
      const idx = n - 1;
      if (!boundary) {
        const rr = Math.hypot((x - FIELD.cx) / FIELD.ax, (z - FIELD.cz) / FIELD.az);
        if (rr >= 1) boundary = { idx, kind: !touched && y > 0.2 ? 6 : 4 };
      }
      if (y === 0 && Math.hypot(vx, vz) < 0.45 && Math.abs(vy) < 0.01) { stopIdx = idx; break; }
      if (boundary && idx > boundary.idx + 6) break;
    }
  }
  return { p: pts, n: pts.length / 3, bounces, boundary, stopIdx, touched };
}

export function trackPos(tr, i) { const k = clamp(i, 0, tr.n - 1); return [tr.p[k * 3], tr.p[k * 3 + 1], tr.p[k * 3 + 2]]; }
export function trackSpeed(tr, i) {
  if (i < 1) return 0;
  const a = trackPos(tr, i - 1), c = trackPos(tr, Math.min(i, tr.n - 1));
  return Math.hypot((c[0] - a[0]) * 60, (c[1] - a[1]) * 60, (c[2] - a[2]) * 60);
}

// ---- throws ---------------------------------------------------------------------------------------------------------
export const THROW_SPEED = 25;   // horizontal m/s of a throw at the wickets
// A flat, fast throw from `from` (x,y,z) to `to` (x,y,z). Returns { T, p0, v } for analytic positions; no drag.
export function throwFlight(from, to, speed = THROW_SPEED) {
  const d = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const T = Math.max(0.18, d / speed);
  return { T, p0: [...from], v: [(to[0] - from[0]) / T, (to[1] - from[1] + 0.5 * G * T * T) / T, (to[2] - from[2]) / T] };
}
export function throwPos(f, t) {
  const tt = clamp(t, 0, f.T * 1.6);
  return [f.p0[0] + f.v[0] * tt, Math.max(BALL_R, f.p0[1] + f.v[1] * tt - 0.5 * G * tt * tt), f.p0[2] + f.v[2] * tt];
}
export const throwTime = (fx, fz, tx, tz) => 0.3 + Math.max(0.18, Math.hypot(fx - tx, fz - tz) / THROW_SPEED);

// Name for the shot, from direction, elevation and the ball it met.
export function shotName(angle, elev, d, kind) {
  const a = angle, aerial = elev > 17;
  if (kind === 'block') return 'a defensive prod';
  if (kind === 'edge') return Math.abs(a) > 140 ? 'a thin edge' : 'an edge';
  const lc = d.lengthClass;
  if (lc === 'bouncer' || lc === 'short') {
    if (a < -35) return aerial ? 'a pull in the air' : 'a pull';
    if (a > 55) return aerial ? 'an upper cut' : 'a cut';
    return aerial ? 'a swat' : 'a punch';
  }
  if (a > 118) return 'a late cut';
  if (a > 62) return aerial ? 'a cut over point' : 'a square cut';
  if (a > 22) return aerial ? 'a lofted cover drive' : 'a cover drive';
  if (a > -22) return aerial ? 'a lofted straight drive' : 'a straight drive';
  if (a > -62) return aerial ? 'a lofted on-drive' : 'an on-drive';
  if (a > -118) return aerial ? 'a slog over midwicket' : 'a flick through midwicket';
  return 'a fine glance';
}

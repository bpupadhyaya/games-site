// Ball physics + batting resolution. Pure and deterministic: fixed 1/120 s sub-steps, randomness only via
// the rng passed in. Frame: batter's frame (off side = +x), see core.js.
import { G, DEG, THEMES, clamp, lerp, sign, centreOf, fenceR } from './core.js';

export const TYPES = {
  pace: { name: 'Pace', cue: 'Long run-up, straight seam', speed: [17, 20.5], bz: [3.3, 4.6], line: [-0.05, 0.32], swing: [-0.5, 0.5], turn: [-0.3, 0.3], rel: 2.15 },
  inswing: { name: 'Inswinger', cue: 'Seam angled in, ball curves toward leg', speed: [16.5, 19.5], bz: [2.4, 3.6], line: [0.3, 0.7], swing: [-3.4, -2.2], turn: [-0.2, 0.2], rel: 2.15 },
  outswing: { name: 'Outswinger', cue: 'Seam angled out, ball curves toward off', speed: [16.5, 19.5], bz: [2.4, 3.6], line: [0.0, 0.3], swing: [2.2, 3.4], turn: [-0.2, 0.2], rel: 2.15 },
  offspin: { name: 'Off-spin', cue: 'Short skip, ball turns into the right-hander', speed: [11.5, 14], bz: [2.8, 4.2], line: [0.25, 0.7], swing: [-0.2, 0.2], turn: [-3.6, -2.4], rel: 1.95 },
  legspin: { name: 'Leg-spin', cue: 'Short skip, ball turns away from the right-hander', speed: [11.5, 14], bz: [2.8, 4.2], line: [-0.1, 0.4], swing: [-0.2, 0.2], turn: [2.6, 3.8], rel: 1.95 },
  bouncer: { name: 'Bouncer', cue: 'Hard length, climbs at the body', speed: [19.5, 22.5], bz: [6.8, 8.2], line: [-0.15, 0.3], swing: [-0.4, 0.4], turn: [-0.3, 0.3], rel: 2.2 },
  yorker: { name: 'Yorker', cue: 'Full and fast at the toes', speed: [18.5, 21.5], bz: [0.5, 1.1], line: [-0.1, 0.25], swing: [-0.8, 0.8], turn: [-0.2, 0.2], rel: 2.1 },
  slower: { name: 'Slower ball', cue: 'Same action, much slower', speed: [10.5, 13], bz: [3.2, 4.4], line: [-0.05, 0.45], swing: [-0.6, 0.6], turn: [-0.4, 0.4], rel: 2.1 },
  fulltoss: { name: 'Full toss', cue: 'Arrives without bouncing', speed: [15, 19], bz: [-2.6, -1.4], line: [0.0, 0.5], swing: [-0.8, 0.8], turn: [0, 0], rel: 2.1 },
  wide: { name: 'Wide', cue: 'Well outside off', speed: [16, 19], bz: [3, 4.5], line: [1.3, 1.9], swing: [0, 0.8], turn: [0, 0], rel: 2.15 },
};
export const TYPE_KEYS = Object.keys(TYPES);

const BALL = {
  leather: { kd: 0.0069, e: 0.55, tang: 0.8, power: 1.0 },
  tennis: { kd: 0.0105, e: 0.64, tang: 0.74, power: 0.86 },
};
export const STUMP = { w: 0.114, h: 0.71 };
export const BIN = { w: 0.31, h: 0.95 };

// Builds a delivery spec from a type, with level-scaled accuracy noise. `hand`=+1 right-hander, -1 left.
export function makeSpec(type, rng, acc = 0.7, hand = 1, over = {}) {
  const T = TYPES[type];
  const sxn = 0.1 + 0.3 * acc, szn = 0.3 + 0.65 * acc;
  const noiseX = rng.range(-1, 1) * sxn, noiseZ = rng.range(-1, 1) * szn;
  const spec = {
    type,
    speed: rng.range(T.speed[0], T.speed[1]),
    bx: rng.range(T.line[0], T.line[1]) + noiseX,
    bz: rng.range(T.bz[0], T.bz[1]) + noiseZ,
    swing: rng.range(T.swing[0], T.swing[1]) * hand,
    turn: rng.range(T.turn[0], T.turn[1]) * hand,
    relX: rng.range(-0.25, 0.25),
    relY: T.rel,
    ...over,
  };
  if (type === 'wide') spec.bx = Math.abs(spec.bx);
  return spec;
}

const r3 = (v) => Math.round(v * 1000) / 1000;

// Flies a delivery from the bowler's hand to past the batter. Track samples are every 1/60 s from release.
export function flyDelivery(spec, themeKey, wicket = 'stumps') {
  const th = THEMES[themeKey];
  const b = BALL[th.ball];
  const L = th.pitchLen;
  const zr = L - 0.8;
  const t1 = (zr - spec.bz) / spec.speed;
  const vy0 = (0.5 * G * t1 * t1 - spec.relY) / t1;
  const vx0 = (spec.bx - spec.relX - 0.5 * spec.swing * t1 * t1) / t1;
  const pts = [];
  let x = spec.relX, y = spec.relY, z = zr, vx = vx0, vy = vy0, vz = -spec.speed;
  let t = 0, bounced = false, bounceIdx = -1, bounceT = -1;
  const h = 1 / 120;
  let n = 0;
  while (t < 4 && z > -2.5 && n < 400) {
    if (!bounced && t < t1) {
      vx += spec.swing * h;
    }
    vy -= G * h;
    x += vx * h; y += vy * h; z += vz * h;
    t += h;
    if (!bounced && y <= 0 && vy < 0) {
      bounced = true;
      y = 0;
      vy = -vy * b.e * 1.05;
      vz *= 0.82;
      vx = vx + spec.turn;
      bounceT = t;
    } else if (bounced && y <= 0 && vy < 0) {
      y = 0; vy = -vy * b.e;
    }
    if (Math.round(t / h) % 2 === 0) { pts.push(r3(x), r3(y), r3(z)); if (bounceT >= 0 && bounceIdx < 0) bounceIdx = pts.length / 3 - 1; n++; }
  }
  const N = pts.length / 3;
  const at = (i) => [pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]];
  // crossing times
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
  const half = wicket === 'bin' ? BIN.w : STUMP.w, top = wicket === 'bin' ? BIN.h : STUMP.h;
  const bowled = Math.abs(c0.x) <= half + 0.035 && c0.y <= top + 0.03 && c0.y > -0.05;
  const bouncedBeforeCrease = bounceT >= 0 && bounceT < cC.t;
  const speedC = (() => { const i = Math.max(1, Math.floor(cC.i)); const a = at(i - 1), c = at(i); return Math.hypot((c[0] - a[0]) * 60, (c[1] - a[1]) * 60, (c[2] - a[2]) * 60); })();
  return {
    spec, p: pts, n: N, tC: cC.t, xc: cC.x, yc: cC.y, speedC, t0: c0.t, x0: c0.x, y0: c0.y,
    bowled, bounced: bouncedBeforeCrease, bounceT,
    wide: Math.abs(c0.x) > 1.05 || c0.y > 2.05,
    noBall: !bouncedBeforeCrease && cC.y > 1.12,
    lengthClass: lengthClassOf(cC.y, bouncedBeforeCrease),
  };
}

export function lengthClassOf(yc, bounced) {
  if (!bounced) return yc > 0.9 ? 'fulltoss' : 'full';
  if (yc < 0.3) return 'yorker';
  if (yc < 0.55) return 'full';
  if (yc < 1.0) return 'good';
  if (yc < 1.55) return 'short';
  return 'bouncer';
}

export function deliveryPos(d, t) {
  const f = clamp(t * 60, 0, d.n - 1.0001);
  const i = Math.floor(f), u = f - i, p = d.p;
  return [lerp(p[i * 3], p[i * 3 + 3], u), lerp(p[i * 3 + 1], p[i * 3 + 4], u), lerp(p[i * 3 + 2], p[i * 3 + 5], u)];
}

// ---- batting resolution -----------------------------------------------------------------------------------
export const WINDOWS = { perfect: 0.032, good: 0.07, ok: 0.115, poor: 0.165 };
export const ASSIST = [1.4, 1.0, 0.82];

export function idealAngle(xc, yc, bounced) {
  if (!bounced && yc < 0.9) return clamp(xc * 46, -55, 60);
  if (yc < 0.35) return clamp(xc * 40, -45, 45);
  if (yc < 1.05) return clamp(xc * 58, -62, 72);
  if (yc < 1.6) return xc > 0.5 ? 72 : clamp(-52 + xc * 70, -62, 30);
  return xc > 0.55 ? 78 : -66;
}

export function timingLabel(e, a = 1) {
  const m = Math.abs(e);
  if (m <= WINDOWS.perfect * a) return 'PERFECT';
  if (m <= WINDOWS.good * a) return e < 0 ? 'GOOD, a touch early' : 'GOOD, a touch late';
  if (m <= WINDOWS.ok * a) return e < 0 ? 'EARLY' : 'LATE';
  return e < 0 ? 'WAY EARLY' : 'WAY LATE';
}

// Resolves one swing against one delivery. `sw` = { kind: 'swing'|'block', t, angle (deg), power 0..1 }.
// `bonus` loosens or tightens windows (assist) and `forgive` is the AI's own skill noise (already in t).
export function resolveSwing(d, sw, themeKey, rng, assist = 1) {
  const th = THEMES[themeKey];
  const bp = BALL[th.ball];
  const block = sw.kind === 'block';
  const e = sw.t + (block ? 0.0 : 0.05) - d.tC;
  assist *= block ? 1 : 1.12 - 0.34 * clamp(sw.power, 0, 1);
  const out = { e, label: timingLabel(e, assist), kind: 'miss', contact: false, Q: 0, power: sw.power, angle: sw.angle };
  const xc = d.xc, yc = d.yc;
  const win = (block ? WINDOWS.ok * 1.25 : WINDOWS.poor) * assist;
  const reachOff = sw.angle > 20 ? 1.4 : 1.22, reachLeg = sw.angle < -20 ? -1.05 : -0.8;
  const reach = xc <= reachOff && xc >= reachLeg && yc <= 2.2;
  if (Math.abs(e) > win || !reach) { out.kind = 'miss'; out.why = !reach ? 'out of reach' : e < 0 ? 'early' : 'late'; return out; }
  // quality
  const m = Math.abs(e) / assist;
  const qt = m <= WINDOWS.perfect ? 1 : m <= WINDOWS.good ? lerp(1, 0.84, (m - WINDOWS.perfect) / (WINDOWS.good - WINDOWS.perfect))
    : m <= WINDOWS.ok ? lerp(0.84, 0.58, (m - WINDOWS.good) / (WINDOWS.ok - WINDOWS.good)) : lerp(0.58, 0.34, (m - WINDOWS.ok) / (WINDOWS.poor - WINDOWS.ok));
  const phi = idealAngle(xc, yc, d.bounced);
  const mis = Math.abs(sw.angle - phi);
  const qa = clamp(1.05 - Math.max(0, mis - 30) / 75, 0.3, 1);
  const Q = block ? clamp(qt, 0.3, 1) : qt * (0.55 + 0.45 * qa);
  out.Q = Q; out.qa = qa; out.qt = qt; out.ideal = phi;
  const pw = clamp(sw.power, 0, 1);
  const pos = deliveryPosAtContact(d);
  let ang, el, spd;
  if (block) {
    if (yc > 1.6) { out.kind = 'edge'; ang = rng.range(-35, 35) + 150 * sign(rng.range(-1, 1)); el = rng.range(35, 60); spd = rng.range(4, 8); }
    else { out.kind = 'block'; ang = rng.range(-50, 50); el = rng.range(0, 3); spd = rng.range(1.2, 3.6) * (0.6 + 0.4 * Q); }
  } else {
    const edgeish = m > WINDOWS.ok || Q < 0.43;
    if (edgeish && rng.chance(m > WINDOWS.ok ? 0.65 : 0.4)) {
      out.kind = 'edge';
      const late = e > 0;
      ang = (late ? 1 : -1) * rng.range(105, 168);
      el = rng.chance(0.5) ? rng.range(8, 28) : rng.range(40, 66);
      spd = rng.range(7, 15) * bp.power;
    } else {
      out.kind = 'hit';
      const shift = clamp(e * 240, -28, 28);
      ang = sw.angle + shift + rng.range(-3, 3);
      let base = 2 + 34 * Math.pow(clamp((pw - 0.5) / 0.5, 0, 1), 1.5);
      if (d.lengthClass === 'yorker' || d.lengthClass === 'full') base = Math.min(base, 17);
      if (d.lengthClass === 'yorker') base = Math.min(base, 9);
      el = base + (1 - Q) * 32 * (pw > 0.4 ? 1 : 0.25) + rng.range(-1.5, 1.5);
      spd = (2 + 23 * pw) * (0.35 + 0.65 * Q) * (0.9 + 0.012 * d.speedC) * bp.power;
      spd *= 1 - rng.next() * 0.32 * pw * pw;
      out.sweet = 1;
      if (Math.abs(ang) > 105) spd *= 0.8;
      if (d.spec.type === 'bouncer' || d.lengthClass === 'bouncer') { spd *= 0.92; el = Math.max(el, 6); }
    }
  }
  ang = clamp(ang, -178, 178);
  el = clamp(el, 0, 72);
  const hs = spd * Math.cos(el * DEG);
  out.init = { x: pos[0], y: Math.max(0.05, pos[1]), z: pos[2], vx: Math.sin(ang * DEG) * hs, vy: Math.sin(el * DEG) * spd, vz: Math.cos(ang * DEG) * hs };
  out.contact = true; out.angle = ang; out.elev = el; out.speed = spd;
  return out;
}

function deliveryPosAtContact(d) { return [d.xc, d.yc, 0.4]; }

// ---- ball in the field ----------------------------------------------------------------------------------
// Flies a struck / thrown / dropped ball until it stops, then returns a track + events.
// init = { x, y, z, vx, vy, vz }. Samples every 1/60 s.
export function flyBall(init, themeKey, opts = {}) {
  const th = THEMES[themeKey];
  const b = BALL[th.ball];
  const cen = centreOf(themeKey);
  const e = b.e * (themeKey === 'beach' ? 0.62 : 1);
  const pts = [];
  const bounces = [];
  let { x, y, z, vx, vy, vz } = init;
  let touched = !!opts.touched, nb = opts.bounces ?? 0, t = 0, n = 0;
  let boundary = null;
  const h = 1 / 120;
  let stopIdx = -1;
  const maxN = opts.maxN ?? 600;
  while (n < maxN) {
    // drag + gravity
    const sp = Math.hypot(vx, vy, vz);
    const kd = b.kd * (y < 0.02 ? 0.0 : 1);
    vx -= kd * sp * vx * h; vy -= kd * sp * vy * h - 0; vz -= kd * sp * vz * h;
    vy -= G * h;
    x += vx * h; y += vy * h; z += vz * h;
    t += h;
    if (y <= 0) {
      y = 0;
      if (vy < -1.4) {
        vy = -vy * e; vx *= b.tang; vz *= b.tang;
        nb++; touched = true;
        bounces.push(pts.length / 3);
      } else {
        vy = 0;
        touched = true;
        const hsp = Math.hypot(vx, vz);
        if (hsp > 0.01) {
          const ns = Math.max(0, hsp - th.decel * h);
          vx *= ns / hsp; vz *= ns / hsp;
        }
      }
    }
    if (Math.round(t / h) % 2 === 0) {
      pts.push(r3(x), r3(y), r3(z));
      n++;
      const idx = n - 1;
      if (!boundary) {
        const dx = x - cen.x, dz = z - cen.z;
        const r = Math.hypot(dx, dz), R = fenceR(themeKey, Math.atan2(dx, dz));
        if (r >= R) {
          let kind = 4;
          if (!touched && y > 0.25 && (th.fenceH === 0 || y >= th.fenceH)) kind = 6;
          boundary = { idx, kind, y };
        }
      }
      if (y === 0 && Math.hypot(vx, vz) < 0.45 && Math.abs(vy) < 0.01) { stopIdx = idx; break; }
      if (boundary && idx > boundary.idx + 12) break;
    }
  }
  return { p: pts, n: pts.length / 3, bounces, boundary, stopIdx, touched };
}

export function trackPos(tr, i) { const k = clamp(i, 0, tr.n - 1); return [tr.p[k * 3], tr.p[k * 3 + 1], tr.p[k * 3 + 2]]; }
export function trackVel(tr, i) {
  const a = trackPos(tr, Math.max(0, i - 1)), c = trackPos(tr, Math.min(tr.n - 1, i + 1));
  const dt = (Math.min(tr.n - 1, i + 1) - Math.max(0, i - 1)) / 60 || 1 / 60;
  return [(c[0] - a[0]) / dt, (c[1] - a[1]) / dt, (c[2] - a[2]) / dt];
}

// Name for the shot, from direction, elevation and the ball it met.
export function shotName(angle, elev, d, kind) {
  const a = angle, aerial = elev > 17;
  if (kind === 'block') return 'forward defence';
  if (kind === 'edge') return Math.abs(a) > 140 ? 'thin edge' : 'edge';
  const lc = d.lengthClass;
  if (lc === 'bouncer' || lc === 'short') {
    if (a < -35) return aerial ? 'pulled in the air' : 'pull';
    if (a > 55) return aerial ? 'upper cut' : 'cut';
    return aerial ? 'swat' : 'punch';
  }
  if (a > 118) return 'late cut';
  if (a > 62) return aerial ? 'cut over point' : 'square cut';
  if (a > 22) return aerial ? 'lofted cover drive' : 'cover drive';
  if (a > -22) return aerial ? 'lofted straight drive' : 'straight drive';
  if (a > -62) return aerial ? 'lofted on-drive' : 'on-drive';
  if (a > -118) return aerial ? 'slog over midwicket' : 'flick through midwicket';
  return 'glance fine';
}

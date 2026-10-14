// Pirogue sea and boat physics: pure, deterministic, no drawing, no DOM. Units: metres, seconds, radians. Fixed step H.
//
// Sea coordinates: s = distance from the beach (0 at the launch line, D at the turning buoy), y = lateral. Swell crests travel
// toward the beach at CW. The boat state keeps y in sea coordinates; heading, roll and stroke sides are in the VIEW frame
// (the screen always has "ahead" up), so `flip` is +1 on the outward leg and -1 on the way home (the picture turns round).
export const H = 1 / 60;
export const CW = 4.8;          // swell speed toward the beach, m/s
export const BOW = 2.6;         // bow tip ahead of the boat centre, m
export const STERN = 2.2;
export const BRK = 28;          // inside this distance from the beach the swells break
export const LANE_GAP = 7;
export const LANES = [-10.5, -3.5, 3.5, 10.5];
export const GAP = 0.64;        // the in-time stroke interval
export const PERFECT = [0.55, 0.74];
export const HULL = { len: 7.0, beam: 1.15 };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const COURSE_IDS = ['morning', 'surf', 'current', 'bigset', 'daily'];

// A tiny seeded generator (mulberry32). All randomness in the sim comes from seeds handed in by game.js (from env.rng).
export function rngFrom(seed) {
  let a = (seed | 0) >>> 0 || 0x9e3779b9;
  const f = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.int = (n) => Math.floor(f() * n);
  return f;
}

export const COURSES = {
  morning: { id: 'morning', name: 'Morning Swell', D: 104, swell: 0.62, cur: 0.12, gap: [34, 52], note: 'Small, friendly sets and a gentle current.' },
  surf: { id: 'surf', name: 'Surf Break', D: 120, swell: 0.95, cur: 0.25, gap: [30, 48], note: 'Steeper sets: punch each crest and catch the way home.' },
  current: { id: 'current', name: 'Cross Current', D: 116, swell: 0.72, cur: 0.85, gap: [32, 50], note: 'A strong current pushes you sideways: steer into it.' },
  bigset: { id: 'bigset', name: 'Big Set Day', D: 136, swell: 1.25, cur: 0.3, gap: [38, 60], note: 'Long course, big sets, long lulls between them.' },
  daily: { id: 'daily', name: 'Daily Sea', D: 118, swell: 0.8, cur: 0.4, gap: [32, 52], note: 'A new sea every day, the same for everyone.' },
};

// Build a sea: the list of swell crests (position at time 0, height, crest tilt) and the current profile.
export function makeSea(courseId, seed, day = 0) {
  const C = { ...(COURSES[courseId] || COURSES.morning) };
  const r = rngFrom(courseId === 'daily' ? (day * 7919 + 13) | 0 : seed);
  if (courseId === 'daily') { C.swell = 0.6 + r() * 0.6; C.cur = 0.1 + r() * 0.75; C.D = 104 + Math.round(r() * 30); }
  const waves = [], env = [0.7, 0.92, 1.0, 0.88, 0.7];
  let pos = 30 + r() * 8, k = 0;
  const last = C.D + CW * 320;
  while (pos < last) {
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const e = env[Math.min(4, Math.round(i * (4 / Math.max(1, n - 1))))];
      const h = clamp(C.swell * e * (0.82 + 0.36 * r()), 0.25, 1.55);
      const skew = (0.05 + 0.12 * r()) * (r() < 0.5 ? -1 : 1);
      waves.push({ k: k++, c0: pos, h, skew, ph: r() * 6.283 });
      pos += 15 + r() * 4.5;
    }
    pos += (C.gap[0] + r() * (C.gap[1] - C.gap[0])) * 0.6;
  }
  const p1 = r() * 6.28, p2 = r() * 6.28;
  return { id: C.id, name: C.name, D: C.D, swell: C.swell, curAmp: C.cur, waves, p1, p2, seed, day, note: C.note };
}
export const crestAt = (w, t) => w.c0 - CW * t;
export const currentAt = (sea, s) => sea.curAmp * (0.62 * Math.sin(0.05 * s + sea.p1) + 0.38 * Math.sin(0.13 * s + sea.p2));
// the (sea) lateral coordinate of the lane centre `lc` is just lc; buoy and finish gate sit there.

export function newBoat(sea, lane, id = 0) {
  return {
    id, lane, lc: LANES[lane], s: 0, y: LANES[lane], hd: 0, v: 0, roll: 0, dir: 1, flip: 1, leg: 'out', turnT: 0, turnDur: 1.4, turnPhase: 0,
    tSince: 0.5, lastSide: 1, lastQ: 0, strokeT: -9, strokes: 0, perfectStreak: 0, prevPerfect: false,
    swamp: 0, ride: null, caught: [], imp: [], seen: 0, penalty: 0, done: false, finishT: 0, turnT0: 0, turnE: 0, rideCount: 0, punches: 0,
    swamps: 0, broaches: 0, lastLabel: '', pow: 1,
  };
}

// Stroke quality: 0.15 (flailing) .. 1.2 (in time, at 0.64 s).
export function strokeQuality(dt) {
  if (dt < 0.5) { const f = Math.max(0, dt) / 0.6; return 0.15 + 0.85 * f * f; }
  if (dt <= 0.78) return 1.0 + 0.2 * (1 - Math.abs(dt - 0.64) / 0.14);
  return Math.max(0.8, 1.0 - 0.3 * (dt - 0.78));
}
export const strokeLabel = (dt) => (dt < 0.5 ? 'early' : dt > 0.78 ? 'late' : dt >= PERFECT[0] && dt <= PERFECT[1] ? 'perfect' : 'in time');

function nearWaves(sea, t, s, lo, hi, f) {
  const ws = sea.waves;
  for (let i = 0; i < ws.length; i++) {
    const c = ws[i].c0 - CW * t;
    if (c < s + lo) { continue; }
    if (c > s + hi) break;
    f(ws[i], c);
  }
}
const waveByK = (sea, k) => sea.waves[k];

// Next crest the bow will meet (outward leg): { w, eta, rel } or null. eta in seconds.
export function nextImpact(sea, b, t) {
  if (b.dir < 0 || b.leg !== 'out') return null;
  const sb = b.s + BOW;
  let best = null;
  const ws = sea.waves;
  for (let i = 0; i < ws.length; i++) {
    const c = ws[i].c0 - CW * t, rel = c - sb;
    if (rel <= 0) continue;
    if (rel > 120) break;
    best = { w: ws[i], rel, eta: rel / (CW + Math.max(0.5, b.v * Math.cos(b.hd))) };
    break;
  }
  return best;
}
// Upcoming crests for the HUD: [{ w, eta, rel, home }]
export function upcoming(sea, b, t, n = 3) {
  const out = [], ws = sea.waves;
  if (b.leg === 'done') return out;
  for (let i = 0; i < ws.length && out.length < n; i++) {
    const c = ws[i].c0 - CW * t;
    if (b.dir > 0) {
      const rel = c - (b.s + BOW);
      if (rel <= 0) continue;
      if (rel > 110 || c > sea.D + BOW) break;
      out.push({ w: ws[i], rel, eta: rel / (CW + Math.max(0.5, b.v * Math.cos(b.hd))), home: false });
    } else {
      const rel = c - b.s;
      if (rel < -1) continue;
      if (rel > 60) break;
      if (b.caught.includes(ws[i].k)) continue;
      out.push({ w: ws[i], rel, eta: Math.max(0, (rel - 1.8) / Math.max(0.6, CW - Math.max(0, b.v))), home: true });
    }
  }
  return out;
}

const spray = (ev, kind, b, big = 1) => ev.push({ t: kind, id: b.id, s: b.s, y: b.y, big });

// One fixed step for one boat. stroke: -1 (left side), 0, +1 (right side). ev collects events for sound / particles / toasts.
export function stepBoat(sea, b, t, stroke, ev) {
  if (b.done) { b.v = Math.max(0, b.v - 2.2 * H); b.s += b.dir * b.v * H * 0.4; b.hd *= 0.97; b.roll *= 0.97; return; }
  b.tSince += H;
  const fwd = b.dir;

  // ---- turn at the buoy
  if (b.leg === 'turn') {
    b.turnT -= H;
    b.v = Math.max(0.6, b.v - 0.9 * H);
    b.hd *= 0.96; b.roll *= 0.98;
    b.s = sea.D + 0.0;
    b.y += clamp(b.lc - b.y, -1, 1) * 0.0;
    if (b.turnT <= 0) {
      b.leg = 'home'; b.dir = -1; b.flip = -1; b.hd = 0;
      const e = Math.abs(b.y - b.lc);
      b.v = clamp(b.v + (e < 2.5 ? 0.5 : e > 6 ? -0.3 : 0.1), 0.9, 3.2);
      b.s = sea.D - 0.01;
      ev.push({ t: 'turned', id: b.id, e });
    }
    return;
  }

  // ---- stroke
  if (stroke && b.swamp <= 0) {
    const dt = b.tSince, q = strokeQuality(dt), lab = strokeLabel(dt);
    b.tSince = 0; b.lastSide = stroke; b.lastQ = q; b.strokeT = t; b.strokes++;
    const perfect = lab === 'perfect';
    b.perfectStreak = perfect ? b.perfectStreak + 1 : 0;
    // a left-side stroke swings the bow right
    b.hd = clamp(b.hd - stroke * 0.085 * (0.55 + 0.45 * Math.min(q, 1.2)), -1.1, 1.1);
    let braced = false;
    if (stroke * b.roll > 0.12) { b.roll *= 0.35; braced = true; }
    if (!b.ride) b.v += 1.25 * q * b.pow * (1 - b.v / 4.6);
    ev.push({ t: 'stroke', id: b.id, side: stroke, q, label: lab, braced, s: b.s, y: b.y });
    // catch a swell from behind: two perfect strokes while a crest lifts the stern
    if (b.dir < 0 && !b.ride && b.perfectStreak >= 2 && Math.abs(b.hd) < 0.34 && Math.abs(b.roll) < 0.6 && b.v > 1.8) {
      let hit = null;
      nearWaves(sea, t, b.s, 0.3, 3.6, (w) => { if (!hit && w.h >= 0.4 && !b.caught.includes(w.k)) hit = w; });
      if (hit) {
        b.caught.push(hit.k);
        b.ride = { k: hit.k, t: 0, dur: 2.6 + 3.8 * hit.h, h: hit.h, drift: hit.skew * -0.7 * b.flip * -1 };
        b.rideCount++;
        ev.push({ t: 'catch', id: b.id, h: hit.h, s: b.s, y: b.y });
      }
    }
  }

  // ---- swamp
  if (b.swamp > 0) {
    b.swamp -= H;
    b.v = Math.max(0, b.v - 3.5 * H);
    b.roll *= 0.96;
    if (b.swamp <= 0) { b.roll = 0; ev.push({ t: 'bailed', id: b.id }); }
  } else {
    // ---- water drag, keel, heel
    if (b.ride) {
      const r = b.ride;
      r.t += H;
      const vr = CW * (1 + 0.1 * r.h);
      b.v += clamp(vr - b.v, -8 * H, 8 * H);
      b.hd += (r.drift + 0.16 * Math.sin(1.9 * r.t + r.k)) * H;
      b.roll += 0.9 * Math.sin(2.3 * r.t + r.k * 1.7) * H;
      if (Math.abs(b.hd) > 0.6) {
        b.ride = null; b.broaches++; b.v *= 0.35; b.roll += (b.hd > 0 ? 0.75 : -0.75) * 1.0;
        ev.push({ t: 'broach', id: b.id, s: b.s, y: b.y });
      } else if (r.t >= r.dur) { b.ride = null; ev.push({ t: 'rideEnd', id: b.id }); }
    } else {
      b.v -= (0.25 * b.v + 0.04 * b.v * b.v + 0.5 * b.roll * b.roll * b.v) * H;
    }
    b.hd *= 1 - 0.35 * H;
    b.roll -= b.roll * 1.1 * H;
    if (b.v < 0) b.v = 0;
  }

  // ---- motion
  const cur = currentAt(sea, b.s);
  const prevS = b.s;
  const off = Math.abs(b.y - b.lc) > 16 ? 0.55 : 1;
  b.s += fwd * b.v * Math.cos(b.hd) * H * off;
  b.y += (b.flip * b.v * Math.sin(b.hd) + cur) * H;
  b.y = clamp(b.y, b.lc - 40, b.lc + 40);

  // ---- swell impacts on the outward leg
  if (b.dir > 0) {
    const sb0 = prevS + BOW, sb1 = b.s + BOW;
    nearWaves(sea, t - H, sb0, -2, 6, (w, c0) => {
      const c1 = w.c0 - CW * t;
      if (c0 - sb0 > 0 && c1 - sb1 <= 0 && !b.imp.some((m) => m.k === w.k) && b.seen !== w.k + 1) {
        b.imp.push({ k: w.k, t, sev: w.h * (c1 < BRK ? 1.25 : 1.0), skew: w.skew * b.flip, hd: b.hd });
        b.seen = w.k + 1;
      }
    });
  }
  for (let i = b.imp.length - 1; i >= 0; i--) {
    const m = b.imp[i];
    if (t - m.t < 0.12) continue;
    b.imp.splice(i, 1);
    if (b.swamp > 0) continue;
    const align = 1 - Math.min(1, Math.abs(m.hd) / 0.55);
    const drive = b.strokeT >= m.t - 0.3 && b.strokeT <= m.t + 0.12 ? Math.min(1.2, b.lastQ) : 0;
    const eff = 0.45 * Math.min(1.1, b.v / 2.6) + 0.5 * drive + 0.25 * align;
    const need = 0.45 + 0.6 * m.sev;
    const ratio = eff / need, sgn = m.skew >= 0 ? 1 : -1;
    if (ratio >= 1) { b.v *= 0.92; b.punches++; ev.push({ t: 'punch', id: b.id, sev: m.sev, ratio, drive: drive > 0, s: b.s, y: b.y }); }
    else if (ratio >= 0.7) { b.v *= 0.62; b.roll += sgn * (0.25 + 0.3 * m.sev); ev.push({ t: 'slap', id: b.id, sev: m.sev, ratio, s: b.s, y: b.y }); }
    else {
      b.v *= 0.3; b.roll += sgn * (0.5 + 0.4 * m.sev);
      ev.push({ t: 'stuffed', id: b.id, sev: m.sev, ratio, s: b.s, y: b.y });
      if (ratio < 0.45) { b.swamp = 2.4; b.swamps++; ev.push({ t: 'swamp', id: b.id, s: b.s, y: b.y }); }
    }
  }
  if (Math.abs(b.roll) > 1 && b.swamp <= 0) {
    b.swamp = 2.4; b.swamps++; b.ride = null; b.v *= 0.2;
    ev.push({ t: 'swamp', id: b.id, s: b.s, y: b.y });
  }
  b.roll = clamp(b.roll, -1.3, 1.3);

  // ---- turn / finish
  if (b.dir > 0 && b.s >= sea.D) {
    b.leg = 'turn'; b.s = sea.D;
    const e = Math.abs(b.y - b.lc);
    b.turnE = e; b.turnDur = 1.2 + 0.07 * e; b.turnT = b.turnDur;
    b.ride = null; b.imp.length = 0;
    ev.push({ t: 'turn', id: b.id, e });
  } else if (b.dir < 0 && b.s <= 0) {
    const miss = Math.max(0, Math.abs(b.y - b.lc) - 6);
    b.penalty += miss * 0.8;
    b.done = true; b.leg = 'done'; b.s = 0; b.finishT = t + b.penalty;
    ev.push({ t: 'finish', id: b.id, time: b.finishT, miss });
  }
}

export const progress = (sea, b) => (b.leg === 'out' || b.leg === 'turn' ? b.s : sea.D + (sea.D - b.s)) / (2 * sea.D);

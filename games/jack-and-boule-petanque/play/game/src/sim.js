// Physics: a deterministic fixed-timestep simulation of boules and the jack on a gravel pitch.
// Pure data in, pure data out (JSON-serialisable world). No DOM, no randomness inside the step:
// all randomness is spent when a pitch is generated and when the AI perturbs a throw.
//
// Units: 1 world unit ~ 1.7 cm; 60 units = "1 metre" on the Rules page. x: across the lane,
// y: down the lane away from the throwing circle (y = 0), z: height of a ball's centre above rest.
export const G = 520;            // gravity, units/s^2
export const R_B = 6.5;          // boule radius
export const R_J = 2.8;          // jack (cochonnet) radius
export const M_J = 0.12;         // boule mass is 1, the jack is much lighter
export const LANE = { halfW: 100, yMin: -50, yMax: 640 };
export const JACK_ZONE = { min: 300, max: 480 };   // 5 to 8 metres
export const HAND_Z = 14;        // release height
const K0 = 130, K1 = 0.5;         // rolling resistance: constant + speed-proportional
const TAU = Math.PI * 2;

// Loft choices. `d` = the landing distance the pull length maps to (rest distance for a roll).
export const LOFTS = [
  { id: 'roll', name: 'Roll', fr: 'Rouler', th: 0, dmin: 40, dmax: 600 },
  { id: 'half', name: 'Half-lob', fr: 'Demi-portée', th: (26 * Math.PI) / 180, dmin: 100, dmax: 560 },
  { id: 'lob', name: 'Lob', fr: 'Portée', th: (62 * Math.PI) / 180, dmin: 100, dmax: 560 },
  { id: 'shoot', name: 'Shoot', fr: 'Tir', th: (5 * Math.PI) / 180, dmin: 140, dmax: 620 },
];
export const SPINS = [
  { id: 0, name: 'Neutral', v: 0 },
  { id: 1, name: 'Retro', v: 1 },     // backspin: bites, stops short
  { id: 2, name: 'Forward', v: -0.6 }, // topspin: runs on
];
export const MAX_ANG = (36 * Math.PI) / 180;

// ---------------------------------------------------------------------------------------------
// terrain
const PRESETS = {
  village: { name: 'Place du Village', bumps: [4, 1.0, 1.6, 30, 55], slope: [0.006, 0.004], loose: 1, hard: 1, stones: 0, base: 1.0, pal: 'village' },
  port: { name: 'Le Port', bumps: [5, 1.0, 1.7, 28, 50], slope: [0.045, 0.004], loose: 4, hard: 1, stones: 0, base: 1.05, pal: 'port' },
  oliviers: { name: 'Les Oliviers', bumps: [10, 2.2, 3.8, 24, 46], slope: [0.018, 0.012], loose: 2, hard: 1, stones: 2, base: 1.0, pal: 'oliviers' },
  colline: { name: 'La Colline', bumps: [7, 1.8, 3.0, 26, 48], slope: [0.05, 0.022], loose: 1, hard: 2, stones: 4, base: 0.8, pal: 'colline' },
};
export const PRESET_IDS = ['village', 'port', 'oliviers', 'colline', 'daily'];
export const presetName = (id) => (id === 'daily' ? 'Daily Pitch' : (PRESETS[id] ?? PRESETS.village).name);

export function makeTerrain(id, rnd) {
  let P = PRESETS[id];
  if (!P) {
    // daily: a seeded mix of the presets
    const pick = (a) => a[Math.floor(rnd.next() * a.length)];
    P = {
      bumps: [3 + Math.floor(rnd.next() * 8), 1.0, 1.8 + rnd.next() * 2, 26, 52],
      slope: [(rnd.next() - 0.5) * 0.09, (rnd.next() - 0.3) * 0.03],
      loose: Math.floor(rnd.next() * 4), hard: 1 + Math.floor(rnd.next() * 2), stones: Math.floor(rnd.next() * 4),
      base: 0.85 + rnd.next() * 0.25, pal: pick(['village', 'port', 'oliviers', 'colline']),
    };
  }
  const R = (a, b) => a + rnd.next() * (b - a);
  const bumps = [];
  for (let i = 0; i < P.bumps[0]; i++) {
    const a = R(P.bumps[1], P.bumps[2]) * (rnd.next() < 0.5 ? -1 : 1);
    bumps.push([R(-LANE.halfW, LANE.halfW), R(60, 600), R(P.bumps[3], P.bumps[4]), a]);
  }
  const patches = [];
  const addPatch = (kind, n, rx0, rx1) => {
    for (let i = 0; i < n; i++) patches.push({ x: R(-70, 70), y: R(110, 560), rx: R(rx0, rx1), ry: R(rx0 * 0.9, rx1 * 1.3), k: kind });
  };
  addPatch(0, P.loose, 26, 44);
  addPatch(1, P.hard, 30, 55);
  const stones = [];
  for (let i = 0; i < P.stones; i++) {
    const side = rnd.next() < 0.5 ? -1 : 1;
    stones.push({ x: side * R(52, 92), y: R(100, 560), r: R(2.6, 4.2) });
  }
  return {
    id, name: presetName(id), pal: P.pal, base: P.base, sx: P.slope[0], sy: P.slope[1],
    bumps, patches, stones, ph: [R(0, TAU), R(0, TAU), R(0, TAU), R(0, TAU)], seed: Math.floor(rnd.next() * 1e9),
  };
}

export function heightAt(t, x, y) {
  let h = t.sx * x + t.sy * y;
  for (const b of t.bumps) {
    const dx = x - b[0], dy = y - b[1];
    h += b[3] * Math.exp(-(dx * dx + dy * dy) / (2 * b[2] * b[2]));
  }
  return h;
}
const SURF = { drag: 1, bounce: 1, soft: 0, hx: 0, hy: 0 };
// large-scale slope only (no fine wobble), for hill shading
export function slopeAt(t, x, y, out) {
  let hx = t.sx, hy = t.sy;
  for (const b of t.bumps) {
    const dx = x - b[0], dy = y - b[1];
    const e = (b[3] * Math.exp(-(dx * dx + dy * dy) / (2 * b[2] * b[2]))) / (b[2] * b[2]);
    hx -= e * dx; hy -= e * dy;
  }
  out.hx = hx; out.hy = hy;
  return out;
}
const smooth = (w) => w * w * (3 - 2 * w);
// Writes gravel properties and the slope gradient at (x,y) into the shared SURF object.
export function surfaceAt(t, x, y) {
  let hx = t.sx, hy = t.sy;
  for (const b of t.bumps) {
    const dx = x - b[0], dy = y - b[1];
    const e = (b[3] * Math.exp(-(dx * dx + dy * dy) / (2 * b[2] * b[2]))) / (b[2] * b[2]);
    hx -= e * dx; hy -= e * dy;
  }
  // fine gravel: a gentle, fixed wobble so slow boules wander a little
  const p = t.ph;
  hx += 0.12 * 0.33 * Math.cos(x * 0.33 + p[0]) * Math.sin(y * 0.29 + p[1]);
  hy += 0.12 * 0.29 * Math.sin(x * 0.33 + p[0]) * Math.cos(y * 0.29 + p[1]);
  let drag = t.base, bounce = 1, soft = 0.1;
  for (const q of t.patches) {
    const dx = (x - q.x) / q.rx, dy = (y - q.y) / q.ry;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= 1) continue;
    const w = smooth(1 - d);
    if (q.k === 0) { drag += 1.5 * w; bounce *= 1 - 0.8 * w; soft += 0.85 * w; } // loose sand
    else { drag -= 0.38 * w; bounce *= 1 + 0.9 * w; soft -= 0.1 * w; }              // packed clay
  }
  if (Math.abs(x) > LANE.halfW) { drag += 2.2; soft += 0.5; }
  SURF.drag = Math.max(0.35, drag); SURF.bounce = Math.max(0.05, bounce); SURF.soft = Math.min(1, Math.max(0, soft));
  SURF.hx = hx; SURF.hy = hy;
  return SURF;
}

// ---------------------------------------------------------------------------------------------
// world
export function createWorld(terrain) {
  return { terrain, balls: [], scars: [], t: 0, settled: true };
}
export function newBall(id, kind, team, x, y) {
  return {
    id, k: kind, team, x, y, z: 0, vx: 0, vy: 0, vz: 0, S: 0, air: 0, rest: 0, out: 0, fade: 0,
    n: [0.3 + (id % 3) * 0.2, 0.2, 0.93], r: kind ? R_J : R_B, m: kind ? M_J : 1,
  };
}
export function cloneWorld(w) {
  return { terrain: w.terrain, balls: w.balls.map((b) => ({ ...b, n: b.n.slice() })), scars: [], t: w.t, settled: w.settled };
}
export const dist2D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------------------------------------------------------------------------------------------
// throwing
const AIR = 0.1;
const flightRange = (v, th, z0) => {
  const vx = v * Math.cos(th), vz = v * Math.sin(th);
  const t = (vz + Math.sqrt(vz * vz + 2 * G * z0)) / G;
  return (vx * (1 - Math.exp(-AIR * t))) / AIR;
};
function speedForLanding(d, th, z0) {
  let lo = 20, hi = 3000;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (flightRange(mid, th, z0) < d) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
// distance a rolled ball travels on flat ordinary gravel (analytic, speed-proportional drag)
const rollDist = (v) => v / K1 - (K0 / (K1 * K1)) * Math.log(1 + (K1 * v) / K0);
function speedForRoll(d) {
  let lo = 5, hi = 2000;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (rollDist(mid) < d) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// The landing distance (rest distance for a roll) a pull maps to.
export function reachFor(loft, power) {
  const L = LOFTS[loft];
  return L.dmin + clamp(power, 0, 1) * (L.dmax - L.dmin);
}
export function powerFor(loft, dist) {
  const L = LOFTS[loft];
  return clamp((dist - L.dmin) / (L.dmax - L.dmin), 0, 1);
}
// launch velocity components for a throw
export function throwVelocity(p) {
  const L = LOFTS[p.loft], d = reachFor(p.loft, p.power);
  const sa = Math.sin(p.ang), ca = Math.cos(p.ang);
  let v, vz;
  if (p.loft === 0) { v = speedForRoll(d); vz = 0; return { vx: v * sa, vy: v * ca, vz, z: 8 }; }
  v = speedForLanding(d, L.th, HAND_Z);
  vz = v * Math.sin(L.th);
  const vh = v * Math.cos(L.th);
  return { vx: vh * sa, vy: vh * ca, vz, z: HAND_Z };
}
// Throw ball `b` (already created) from the circle.
export function launch(w, b, p) {
  const tv = throwVelocity(p);
  b.x = 0; b.y = 0; b.z = tv.z; b.vx = tv.vx; b.vy = tv.vy; b.vz = tv.vz; b.air = 1; b.rest = 0;
  b.S = SPINS[p.spin]?.v ?? 0;
  w.settled = false;
}
// Rough roll-out after landing on flat gravel, as a fraction of the landing distance. Used only to
// draw the "it will run on" chevrons; the real run is simulated.
export function rollOutEstimate(p) {
  const L = LOFTS[p.loft];
  if (p.loft === 0 || p.loft === 3) return 0;
  const d = reachFor(p.loft, p.power);
  const v = speedForLanding(d, L.th, HAND_Z);
  const vh = v * Math.cos(L.th), vzn = Math.sqrt(Math.pow(v * Math.sin(L.th), 2) + 2 * G * HAND_Z);
  const s = SPINS[p.spin]?.v ?? 0;
  let nv = vh - (0.3 + 0.1) * 1.2 * vzn - s * 0.42 * 1.2 * vzn;
  nv = Math.max(nv, 0);
  return rollDist(nv);
}

// ---------------------------------------------------------------------------------------------
// stepping
function land(b, T, ev) {
  const sf = surfaceAt(T, b.x, b.y);
  const vzn = -b.vz;
  const e = Math.min(0.5, 0.28 * sf.bounce * (1 - 0.7 * sf.soft));
  const imp = (1 + e) * vzn;
  const vh = Math.hypot(b.vx, b.vy);
  if (vh > 1e-6) {
    let dv = (0.46 + 0.3 * sf.soft) * imp;
    dv += b.S * 0.42 * imp * (1 + 0.6 * sf.soft);
    let nv = vh - dv;
    const floor = b.S > 0 ? -0.3 * vh * Math.min(1, b.S) : 0;
    if (nv < floor) nv = floor;
    const f = nv / vh;
    b.vx *= f; b.vy *= f;
  }
  b.vz = vzn * e;
  b.z = 0;
  if (b.vz < 22) { b.vz = 0; b.air = 0; }
  ev.push({ t: 'land', x: b.x, y: b.y, v: vzn, id: b.id, soft: sf.soft });
}

function spinNormal(n, ax, ay, az, ang) {
  // rotate n about unit axis (ax,ay,az) by ang (Rodrigues)
  const c = Math.cos(ang), s = Math.sin(ang), d = ax * n[0] + ay * n[1] + az * n[2];
  const cx = ay * n[2] - az * n[1], cy = az * n[0] - ax * n[2], cz = ax * n[1] - ay * n[0];
  const x = n[0] * c + cx * s + ax * d * (1 - c), y = n[1] * c + cy * s + ay * d * (1 - c), z = n[2] * c + cz * s + az * d * (1 - c);
  const l = Math.hypot(x, y, z) || 1;
  n[0] = x / l; n[1] = y / l; n[2] = z / l;
}

function stepBall(b, T, h, ev) {
  if (b.out) {
    b.fade += h;
    b.vx *= 1 - 3 * h; b.vy *= 1 - 3 * h;
    b.x += b.vx * h; b.y += b.vy * h;
    return;
  }
  if (b.air) {
    b.vz -= G * h;
    const k = 1 - AIR * h;
    b.vx *= k; b.vy *= k;
    b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
    if (b.S) spinNormal(b.n, 1, 0, 0, b.S * 22 * h);
    if (b.z <= 0 && b.vz < 0) { b.z = 0; land(b, T, ev); }
    return;
  }
  const sf = surfaceAt(T, b.x, b.y);
  const ax = -0.7 * G * sf.hx, ay = -0.7 * G * sf.hy;
  let sp = Math.hypot(b.vx, b.vy);
  if (sp > 0) {
    let fr = K0 * sf.drag + K1 * sp + (b.S > 0 ? 150 * b.S : -60 * -b.S);
    fr = Math.max(fr, 0.35 * K0 * sf.drag);
    const dv = fr * h;
    if (dv >= sp) { b.vx = 0; b.vy = 0; sp = 0; } else { const f = (sp - dv) / sp; b.vx *= f; b.vy *= f; sp -= dv; }
  }
  const am = Math.hypot(ax, ay);
  if (sp === 0 && am < 0.85 * K0 * sf.drag) { b.rest++; return; }
  b.vx += ax * h; b.vy += ay * h;
  sp = Math.hypot(b.vx, b.vy);
  if (sp < 1.5 && am < 0.9 * K0 * sf.drag) { b.vx = 0; b.vy = 0; b.rest++; return; }
  b.rest = 0;
  b.x += b.vx * h; b.y += b.vy * h;
  if (b.S) b.S *= Math.exp(-2.4 * h);
  if (Math.abs(b.S) < 0.02) b.S = 0;
  if (sp > 0) spinNormal(b.n, -b.vy / sp, b.vx / sp, 0, (sp * h) / b.r);
}

function collide(a, b, ev) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const rr = a.r + b.r;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 >= rr * rr || d2 === 0) return;
  const d = Math.sqrt(d2);
  const nx = dx / d, ny = dy / d, nz = dz / d;
  const rvx = a.vx - b.vx, rvy = a.vy - b.vy, rvz = a.vz - b.vz;
  const vn = rvx * nx + rvy * ny + rvz * nz;
  const ia = 1 / a.m, ib = 1 / b.m;
  // separate
  const pen = rr - d;
  const sa = (pen * ia) / (ia + ib), sb = (pen * ib) / (ia + ib);
  a.x -= nx * sa; a.y -= ny * sa; b.x += nx * sb; b.y += ny * sb;
  if (a.air || b.air) { a.z -= nz * sa; b.z += nz * sb; }
  if (a.z < 0) a.z = 0;
  if (b.z < 0) b.z = 0;
  if (vn <= 0) return;
  const e = a.k || b.k ? 0.66 : 0.78;
  const j = ((1 + e) * vn) / (ia + ib);
  a.vx -= j * ia * nx; a.vy -= j * ia * ny; a.vz -= j * ia * nz;
  b.vx += j * ib * nx; b.vy += j * ib * ny; b.vz += j * ib * nz;
  for (const q of [a, b]) {
    q.rest = 0;
    if (q.vz > 20 || q.z > 0.01) q.air = 1;
    else { q.vz = 0; q.air = 0; }
    q.S *= 0.5;
  }
  ev.push({ t: 'hit', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: vn, a: a.id, b: b.id, jack: a.k || b.k ? 1 : 0 });
}

function stoneHit(b, s, ev) {
  if (b.out || b.z > 5) return;
  const dx = b.x - s.x, dy = b.y - s.y, rr = b.r + s.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr || d2 === 0) return;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  b.x = s.x + nx * rr; b.y = s.y + ny * rr;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= 1.45 * vn * nx; b.vy -= 1.45 * vn * ny;
    b.rest = 0;
    ev.push({ t: 'stone', x: s.x, y: s.y, v: -vn });
  }
}

// Advance the world by `dt` seconds (subdivided for fast shots). Returns the events that happened.
export function stepWorld(w, dt, ev = []) {
  const bl = w.balls;
  let vmax = 0;
  for (const b of bl) { if (!b.out) vmax = Math.max(vmax, Math.hypot(b.vx, b.vy, b.vz)); }
  const n = clamp(Math.ceil((vmax * dt) / 2.5), 1, 24), h = dt / n;
  for (let s = 0; s < n; s++) {
    for (const b of bl) stepBall(b, w.terrain, h, ev);
    for (let i = 0; i < bl.length; i++) {
      const a = bl[i];
      if (a.out) continue;
      for (let j = i + 1; j < bl.length; j++) {
        const c = bl[j];
        if (c.out) continue;
        if (a.rest > 2 && c.rest > 2 && !a.air && !c.air) continue;
        collide(a, c, ev);
      }
      for (const st of w.terrain.stones) stoneHit(a, st, ev);
    }
    for (const b of bl) {
      if (b.out || b.air) continue;
      if (b.x < -LANE.halfW || b.x > LANE.halfW || b.y > LANE.yMax || b.y < LANE.yMin) {
        b.out = 1; b.fade = 0; b.vx *= 0.5; b.vy *= 0.5;
        ev.push({ t: 'out', x: b.x, y: b.y, id: b.id });
      }
    }
  }
  w.t += dt;
  let settled = true;
  for (const b of bl) { if (!b.out && (b.air || b.vx !== 0 || b.vy !== 0)) { settled = false; break; } }
  w.settled = settled;
  return ev;
}

// run the world until it settles (or `maxT` seconds), no events kept
export function settle(w, maxT = 12, dt = 1 / 60) {
  const ev = [];
  for (let t = 0; t < maxT; t += dt) { stepWorld(w, dt, ev); if (w.settled) break; ev.length = 0; }
  return w.settled;
}

// ---------------------------------------------------------------------------------------------
// scoring helpers (shared by the match flow and the AI)
export function liveBoules(w, team) { return w.balls.filter((b) => !b.k && !b.out && (team === undefined || b.team === team)); }
export function theJack(w) { return w.balls.find((b) => b.k && !b.out) ?? null; }
export function ranking(w) {
  const j = theJack(w);
  if (!j) return [];
  return liveBoules(w).map((b) => ({ b, d: Math.max(0, dist2D(b, j) - b.r - j.r) })).sort((p, q) => p.d - q.d);
}
export const TIE_EPS = 0.6;
// Points for the end if play stopped now: { team: -1|0|1, pts, tie }
export function endScore(w) {
  const rk = ranking(w);
  if (!rk.length) return { team: -1, pts: 0, tie: false };
  const lead = rk[0].b.team;
  const other = rk.find((r) => r.b.team !== lead);
  if (other && Math.abs(other.d - rk[0].d) < TIE_EPS) return { team: -1, pts: 0, tie: true };
  let pts = 0;
  for (const r of rk) { if (r.b.team !== lead) break; if (other && r.d >= other.d - TIE_EPS) break; pts++; }
  return { team: lead, pts, tie: false };
}

// ---------------------------------------------------------------------------------------------
// previews: the flight arc (terrain-free) and a full simulated run (Calm mode, the AI, hints)
export function flightPath(p, step = 1 / 30) {
  const tv = throwVelocity(p), pts = [];
  const tl = (tv.vz + Math.sqrt(tv.vz * tv.vz + 2 * G * tv.z)) / G;
  const at = (t, land) => {
    const f = (1 - Math.exp(-AIR * t)) / AIR;
    return { x: tv.vx * f, y: tv.vy * f, z: Math.max(0, tv.z + tv.vz * t - 0.5 * G * t * t), t, land };
  };
  for (let t = 0; t < tl; t += step) pts.push(at(t, false));
  pts.push(at(tl, true));
  return pts;
}
export function previewThrow(w, p, { jack = false, team = 0, every = 3, maxT = 8 } = {}) {
  const c = cloneWorld(w);
  const b = newBall(99, jack ? 1 : 0, jack ? -1 : team, 0, 0);
  c.balls.push(b);
  launch(c, b, p);
  const path = [], ev = [];
  let land = null, hits = 0, i = 0;
  for (let t = 0; t < maxT; t += 1 / 60, i++) {
    stepWorld(c, 1 / 60, ev);
    for (const e of ev) { if (e.t === 'land' && e.id === 99 && !land) land = { x: e.x, y: e.y }; if (e.t === 'hit' && (e.a === 99 || e.b === 99)) hits++; }
    ev.length = 0;
    if (i % every === 0) path.push({ x: b.x, y: b.y, z: b.z });
    if (c.settled) break;
  }
  return { path, rest: { x: b.x, y: b.y }, land, hits, world: c, ball: b };
}

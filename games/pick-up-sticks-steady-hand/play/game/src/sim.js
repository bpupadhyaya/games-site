// The heap and the pull: pure, deterministic, no clock. Everything is in table units, origin at the table centre.
//
// MODEL. Each stick is a capsule (a line segment with radius R). A heap is built by dropping sticks one by one: a stick that lands
// across others sits one level above the highest of them (`z`, 1 = on the table). A stick is FREE when no stick lies across it from
// a higher level. Lifting a free stick means dragging it out of the heap by the point you grab:
//   - it moves like a rod pulled by one point (it slides along its length easily, sideways it pivots), see moveRod;
//   - sticks on the same level, or one above, that it touches are pushed (a quasi-static solve, no velocities), and so are the sticks
//     they touch in turn;
//   - sticks it rides over on a lower level are dragged along if you pull faster than they grip (V0);
//   - when any other stick has moved further than `tol` (end-point distance) from where it lay at the start, that is a FAULT.
// The pull succeeds when the stick has travelled a little and touches nothing: it is lifted out and scores its value.
// The same stepPull drives a human finger, the rivals and the hint, so what the planner predicts is what the physics does.

export const LH = 148;            // half length of a stick
export const SR = 9;              // stick radius
export const TABLE = 350;         // half size of the playing mat
export const TOOL_LH = 120;       // half length of the lever
export const VMAX = 520;          // the grab point never moves faster than this (units per second)
export const V0 = 105;            // pulling slower than this does not disturb the sticks you ride over
const DRAGK = 0.42;
export const CLEAR_GAP = 3;       // clear of everything by this much counts as lifted out
export const LIFT_DIST = 24;      // and you must have moved this far

export const KINDS = ['gold', 'red', 'jade', 'indigo', 'bamboo'];
export const VALUE = { gold: 20, red: 10, jade: 5, indigo: 3, bamboo: 1 };
export const KIND_NAME = { gold: 'Golden master', red: 'Red lacquer', jade: 'Jade', indigo: 'Indigo', bamboo: 'Bamboo' };
export const valueOf = (s) => VALUE[s.kind];

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

// Seeded stream used for heaps (so a daily heap is the same for everybody and a rematch can rebuild the same heap).
export function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- geometry --------------------------------------------------------------------------------------------------------
const HIT = { d: 0, px: 0, py: 0, qx: 0, qy: 0 };
// Closest points between segments p1-q1 and p2-q2 (Ericson). Writes into the shared HIT and returns it.
function closest(p1x, p1y, q1x, q1y, p2x, p2y, q2x, q2y) {
  const d1x = q1x - p1x, d1y = q1y - p1y, d2x = q2x - p2x, d2y = q2y - p2y, rx = p1x - p2x, ry = p1y - p2y;
  const a = d1x * d1x + d1y * d1y, e = d2x * d2x + d2y * d2y, f = d2x * rx + d2y * ry;
  const c = d1x * rx + d1y * ry, b = d1x * d2x + d1y * d2y, den = a * e - b * b;
  let s = den > 1e-9 ? clamp((b * f - c * e) / den, 0, 1) : 0;
  let t = (b * s + f) / e;
  if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
  HIT.px = p1x + d1x * s; HIT.py = p1y + d1y * s; HIT.qx = p2x + d2x * t; HIT.qy = p2y + d2y * t;
  HIT.d = Math.hypot(HIT.px - HIT.qx, HIT.py - HIT.qy);
  return HIT;
}
export const ends = (s) => { const c = Math.cos(s.a) * s.lh, n = Math.sin(s.a) * s.lh; return [s.x - c, s.y - n, s.x + c, s.y + n]; };
// Distance between the centre lines of two sticks (0 when they cross). Also leaves the closest points in HIT.
function sdist(A, B) {
  const ca = Math.cos(A.a) * A.lh, sa = Math.sin(A.a) * A.lh, cb = Math.cos(B.a) * B.lh, sb = Math.sin(B.a) * B.lh;
  return closest(A.x - ca, A.y - sa, A.x + ca, A.y + sa, B.x - cb, B.y - sb, B.x + cb, B.y + sb).d;
}
export const gapBetween = (A, B) => sdist(A, B) - 2 * SR;
export function distToStick(s, x, y) {
  const c = Math.cos(s.a), n = Math.sin(s.a), t = clamp((x - s.x) * c + (y - s.y) * n, -s.lh, s.lh);
  return Math.hypot(x - (s.x + c * t), y - (s.y + n * t));
}

// ---- the world -------------------------------------------------------------------------------------------------------
// w = { sticks: [live sticks], tol, seed, nextId, pull, tool }  (JSON-serialisable)
export const countsFor = (n) => {
  const red = Math.max(1, Math.round(n * 0.09)), jade = Math.max(1, Math.round(n * 0.16)), indigo = Math.max(1, Math.round(n * 0.25));
  return { gold: 1, red, jade, indigo, bamboo: Math.max(1, n - 1 - red - jade - indigo) };
};

export function createWorld(seed, o = {}) {
  const n = o.n ?? 24, spread = o.spread ?? 172, tol = o.tol ?? 7, rnd = seeded(seed), maxZ = o.maxZ ?? 4;
  const cnt = countsFor(n), kinds = [];
  for (const k of KINDS) for (let i = 0; i < cnt[k]; i++) kinds.push(k);
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const w = { sticks: [], tol, seed, nextId: 1, pull: null, tool: null, n: kinds.length };
  const lim = TABLE - 14 - LH;
  for (const kind of kinds) {
    let placed = null;
    for (let tries = 0, sp = spread; tries < 400 && !placed; tries++) {
      if (tries % 60 === 59) sp = Math.min(lim, sp + 14);
      const r = sp * Math.sqrt(rnd()), th = rnd() * TAU, a = rnd() * Math.PI - Math.PI / 2;
      const c = { id: w.nextId, kind, x: Math.cos(th) * r, y: Math.sin(th) * r, a, z: 1, lh: LH, tilt: rnd() };
      let z = 1, bad = false;
      for (const t of w.sticks) {
        const d = sdist(c, t);
        if (d < 2 * SR) z = Math.max(z, t.z + 1); else if (d < 2 * SR + 1.2) { bad = true; break; }
      }
      if (bad || z > maxZ) continue;
      c.z = z; placed = c;
    }
    if (!placed) placed = { id: w.nextId, kind, x: 0, y: 0, a: 0, z: maxZ + 1, lh: LH, tilt: 0.5 };
    w.nextId++;
    w.sticks.push(placed);
  }
  return w;
}
export const cloneWorld = (w) => JSON.parse(JSON.stringify(w));
export const byId = (w, id) => { for (const s of w.sticks) if (s.id === id) return s; return null; };
export const totalValue = (w) => w.sticks.reduce((a, s) => a + valueOf(s), 0);

// Ids of sticks with another stick lying across them from a higher level.
export function coveredSet(w) {
  const cov = new Set(), S = w.sticks;
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
    if (S[i].z === S[j].z) continue;
    if (sdist(S[i], S[j]) < 2 * SR) cov.add(S[i].z < S[j].z ? S[i].id : S[j].id);
  }
  return cov;
}
export const freeSticks = (w) => { const cov = coveredSet(w); return w.sticks.filter((s) => !cov.has(s.id)); };
// The top-most stick under a point (touch padding `pad`), or null.
export function hitStick(w, x, y, pad = 14) {
  let best = null, bd = 0;
  for (const s of w.sticks) {
    const d = distToStick(s, x, y);
    if (d > SR + pad) continue;
    if (!best || d < bd - 3 || (Math.abs(d - bd) <= 3 && s.z > best.z)) { best = s; bd = d; }
  }
  return best;
}
// Put a stick back down where it is: one level above the highest stick it lies across.
export function settleStick(w, s) {
  let z = 1;
  for (const t of w.sticks) if (t !== s && sdist(s, t) < 2 * SR) z = Math.max(z, t.z + 1);
  s.z = z;
}

// Level numbers for a hand-placed list of sticks, dropped in order (used by the Rules pictures).
export function stackUp(list) {
  const out = [];
  for (const q of list) {
    const c = { lh: LH, ...q, z: 1 };
    for (const t of out) if (sdist(c, t) < 2 * SR) c.z = Math.max(c.z, t.z + 1);
    out.push(c);
  }
  return out;
}

// ---- the pull --------------------------------------------------------------------------------------------------------
const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
function overlapPairs(w) {
  const out = [], S = w.sticks;
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) if (sdist(S[i], S[j]) < 2 * SR) out.push(pairKey(S[i].id, S[j].id));
  return out;
}

// Start lifting stick `id`, grabbed at the world point (gx, gy). Returns false when it cannot be lifted (covered).
export function startPull(w, id, gx, gy) {
  const s = byId(w, id);
  if (!s || w.pull) return false;
  if (coveredSet(w).has(id)) return false;
  const c = Math.cos(s.a), n = Math.sin(s.a), k = clamp(((gx - s.x) * c + (gy - s.y) * n) / s.lh, -0.92, 0.92);
  const g = { x: s.x + c * k * s.lh, y: s.y + n * k * s.lh };
  w.pull = {
    id, tool: false, k, gx: g.x, gy: g.y, g0x: g.x, g0y: g.y, tx: g.x, ty: g.y, t: 0, dist: 0, speed: 0, maxRatio: 0, culprit: null, done: null,
    base: w.sticks.map((t) => [t.id, t.x, t.y, t.a]), ov: overlapPairs(w), free: null, moved: {},
  };
  return true;
}
// Start the lever: a short golden stick held by its end at (gx, gy), pointing at the middle of the table.
export function startTool(w, gx, gy) {
  if (w.pull) return false;
  const a = Math.atan2(-gy, -gx), k = -0.9, c = Math.cos(a), n = Math.sin(a);
  w.tool = { id: 0, kind: 'tool', x: gx - c * k * TOOL_LH, y: gy - n * k * TOOL_LH, a, z: 99, lh: TOOL_LH };
  const cov = coveredSet(w);
  w.pull = {
    id: 0, tool: true, k, gx, gy, g0x: gx, g0y: gy, tx: gx, ty: gy, t: 0, dist: 0, speed: 0, maxRatio: 0, culprit: null, done: null,
    base: w.sticks.map((t) => [t.id, t.x, t.y, t.a]), ov: overlapPairs(w), free: w.sticks.filter((t) => !cov.has(t.id)).map((t) => t.id), moved: {},
  };
  return true;
}
export function setTarget(w, x, y) {
  const p = w.pull;
  if (!p || p.done) return;
  const lim = TABLE + 100;
  p.tx = clamp(x, -lim, lim); p.ty = clamp(y, -lim, lim);
}

// Move rod S (half length S.lh) so the point at axis offset k*lh moves by (mx, my); sideways it pivots about the point where
// a sliding rod would turn (uniform sideways grip): a pull at the very end swings the stick, a pull at the middle shifts it.
function moveRod(S, k, mx, my) {
  const c = Math.cos(S.a), n = Math.sin(S.a), ma = mx * c + my * n, mp = -mx * n + my * c, s = k * S.lh;
  if (Math.abs(s) < 6) { S.x += mx; S.y += my; return; }
  const pv = -(S.lh * S.lh) / (3 * s), dth = mp / (s - pv), lat = -dth * pv;
  S.x += c * ma - n * lat; S.y += n * ma + c * lat; S.a += dth;
}

const interacts = (p, S, T) => {
  if (pairKeyIn(p, S, T)) return false;
  if (p.tool) return p.free.includes(T.id);
  return T.z === S.z || T.z === S.z + 1;
};
function pairKeyIn(p, A, B) { return A.id !== 0 && B.id !== 0 && p.ov.includes(pairKey(A.id, B.id)); }
// Quasi-static push of dynamic stick T out of contact with the (kinematic) A: translation plus rotation from the lever arm.
function pushOut(T, hit, A, share) {
  const pen = 2 * SR - hit.d;
  if (pen <= 0) return;
  let nx = hit.qx - hit.px, ny = hit.qy - hit.py;
  const d = Math.hypot(nx, ny);
  if (d > 1e-4) { nx /= d; ny /= d; } else { const c = Math.cos(A.a), s = Math.sin(A.a); nx = -s; ny = c; if (nx * (T.x - A.x) + ny * (T.y - A.y) < 0) { nx = -nx; ny = -ny; } }
  const rx = hit.qx - T.x, ry = hit.qy - T.y, cr = rx * ny - ry * nx, invI = 3 / (T.lh * T.lh);
  const lam = (pen * share) / (1 + cr * cr * invI);
  T.x += nx * lam; T.y += ny * lam; T.a += cr * lam * invI;
}

// One tick of the pull. Returns events: { t: 'hit'|'lift'|'fault', ... } for sound and particles.
export function stepPull(w, dt) {
  const p = w.pull, ev = [];
  if (!p || p.done) return ev;
  const S = p.tool ? w.tool : byId(w, p.id), others = w.sticks.filter((t) => t !== S);
  p.t += dt;
  // 1. the grab point follows the target, never faster than VMAX, and eases in (a shaky finger is filtered a little)
  const dx = p.tx - p.gx, dy = p.ty - p.gy, d = Math.hypot(dx, dy);
  let mx = 0, my = 0, step = 0;
  if (d > 1e-6) { step = Math.min(d * Math.min(1, 16 * dt), VMAX * dt); mx = (dx / d) * step; my = (dy / d) * step; }
  p.speed = step / dt;
  moveRod(S, p.k, mx, my);
  S.x = clamp(S.x, -TABLE - 100, TABLE + 100); S.y = clamp(S.y, -TABLE - 100, TABLE + 100);
  p.gx = S.x + Math.cos(S.a) * p.k * S.lh; p.gy = S.y + Math.sin(S.a) * p.k * S.lh;
  p.dist = Math.hypot(p.gx - p.g0x, p.gy - p.g0y);
  // 2. contacts: push what is in the way, drag what we ride over
  const active = new Set();
  for (const T of others) {
    const dd = sdist(S, T);
    if (!p.tool && T.z < S.z && dd < 2 * SR) {
      if (p.speed > V0) { const f = ((p.speed - V0) / V0) * DRAGK; T.x += mx * f; T.y += my * f; active.add(T); }
      continue;
    }
    if (dd < 2 * SR && interacts(p, S, T)) {
      const h = { ...HIT }; pushOut(T, h, S, 1); active.add(T);
      ev.push({ t: 'hit', x: (h.px + h.qx) / 2, y: (h.py + h.qy) / 2, v: p.speed });
    }
  }
  // 3. what we pushed may push others (S itself never moves for them)
  for (let pass = 0; pass < 5 && active.size; pass++) {
    const next = new Set();
    for (const A of active) {
      for (const B of others) {
        if (B === A) continue;
        if (A.id === B.id) continue;
        if (!(Math.abs(A.z - B.z) <= 1) || pairKeyIn(p, A, B)) continue;
        if (p.tool && !p.free.includes(B.id)) continue;
        const dd = sdist(A, B);
        if (dd < 2 * SR) { const h = { ...HIT }; pushOut(B, h, A, 0.5); const h2 = { ...h }; pushOut(A, { d: h2.d, px: h2.qx, py: h2.qy, qx: h2.px, qy: h2.py }, B, 0.5); next.add(B); }
      }
      A.x = clamp(A.x, -TABLE + 6, TABLE - 6); A.y = clamp(A.y, -TABLE + 6, TABLE - 6);
    }
    active.clear(); for (const b of next) active.add(b);
  }
  // 4. how far has anything else moved since the pull began?
  let maxR = 0, culprit = null;
  for (const b of p.base) {
    const T = others.find((t) => t.id === b[0]);
    if (!T) continue;
    const c0 = Math.cos(b[3]) * T.lh, s0 = Math.sin(b[3]) * T.lh, c1 = Math.cos(T.a) * T.lh, s1 = Math.sin(T.a) * T.lh;
    const e1 = Math.hypot(T.x - c1 - (b[1] - c0), T.y - s1 - (b[2] - s0)), e2 = Math.hypot(T.x + c1 - (b[1] + c0), T.y + s1 - (b[2] + s0));
    const disp = Math.max(e1, e2);
    p.moved[T.id] = disp / w.tol;
    if (disp / w.tol > maxR) { maxR = disp / w.tol; culprit = T.id; }
  }
  p.maxRatio = Math.max(p.maxRatio, maxR); p.nowRatio = maxR;
  if (!p.tool && maxR >= 1) { p.done = 'fault'; p.culprit = culprit; ev.push({ t: 'fault', id: culprit }); return ev; }
  // 5. lifted clear of the heap?
  if (!p.tool && p.dist >= LIFT_DIST) {
    let clear = true;
    for (const T of others) if (sdist(S, T) < 2 * SR + CLEAR_GAP) { clear = false; break; }
    if (clear) { p.done = 'lifted'; ev.push({ t: 'lift', id: S.id }); }
  }
  return ev;
}

// The finger came up: close the pull. Returns { outcome: 'lifted'|'fault'|'dropped'|'tool', stick, ratio, culprit }.
export function endPull(w) {
  const p = w.pull;
  if (!p) return null;
  let outcome = p.done;
  const res = { outcome: p.tool ? 'tool' : outcome ?? 'dropped', stick: null, ratio: p.maxRatio, culprit: p.culprit, id: p.id };
  if (p.tool) { w.tool = null; for (const s of w.sticks) settleStick(w, s); }
  else {
    const S = byId(w, p.id);
    res.stick = S ? { ...S } : null;
    if (res.outcome === 'lifted') w.sticks = w.sticks.filter((t) => t.id !== p.id);
    else if (S) settleStick(w, S);
  }
  w.pull = null;
  return res;
}
export const isActive = (w) => !!(w.pull && !w.pull.done);

// A plan is { id, k, ang, dist, speed }: grab stick `id` at axis fraction k, then drag the target along `ang` at `speed`.
export function planStart(w, plan) {
  const s = byId(w, plan.id);
  if (!s) return false;
  const c = Math.cos(s.a), n = Math.sin(s.a);
  return startPull(w, plan.id, s.x + c * plan.k * s.lh, s.y + n * plan.k * s.lh);
}
// Play a plan out on world w (mutates it) with optional target jitter; returns the closed pull result.
export function playPlan(w, plan, jitter = null, maxSteps = 900) {
  if (!planStart(w, plan)) return { outcome: 'dropped', ratio: 1, stick: null };
  const p = w.pull, dt = 1 / 60;
  let jx = 0, jy = 0;
  for (let i = 0; i < maxSteps && !p.done; i++) {
    const t = (i + 1) * dt, L = Math.min(plan.dist, plan.speed * t);
    if (jitter) { jx = jx * 0.9 + jitter() * 0.45; jy = jy * 0.9 + jitter() * 0.45; }
    setTarget(w, p.g0x + Math.cos(plan.ang) * L + jx, p.g0y + Math.sin(plan.ang) * L + jy);
    stepPull(w, dt);
    if (L >= plan.dist && Math.hypot(p.tx - p.gx, p.ty - p.gy) < 1) break;
  }
  return endPull(w);
}

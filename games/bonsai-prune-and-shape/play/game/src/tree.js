// The living tree: a side-view skeleton of limbs made of segments, grown in real time. Pure and deterministic:
// randomness is the tree's own seeded stream (T.rs); time is the dt handed in. Everything here is JSON-serializable except the
// derived geometry cache (geo), which is recomputed from the tree.
//
// Heading convention: absolute angle a, direction (cos a, sin a), y grows DOWN the screen, so straight up is -PI/2.
// Segment angle `a` is relative to the previous segment's direction (the trunk's first segment is absolute).
import { SPECIES, GROW, SEASON, YEAR, commissionById } from './species.js';

export const TAU = Math.PI * 2, UP = -Math.PI / 2;
export const SET_T = 6, BITE_T = 16, MAX_WIRES = 4, MAX_LIMBS = 84;
export const wrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const seasonIdx = (T) => Math.min(3, Math.floor(T.t / SEASON));
export const seasonProg = (T) => (T.t % SEASON) / SEASON;

export function rnd(T) {
  T.rs = (T.rs + 0x6d2b79f5) | 0;
  let t = Math.imul(T.rs ^ (T.rs >>> 15), 1 | T.rs);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function newTree(com) {
  const sp = SPECIES[com.species];
  const T = { v: 0, nid: 1, rs: com.seed | 0, t: 0, year: 1, shock: 0, health: 100, limbs: [], potId: null, cuts: 0, pinches: 0, bites: 0, shocks: 0, wiresPut: 0, ev: [] };
  const side0 = rnd(T) < 0.5 ? -1 : 1;
  const trunk = { id: T.nid++, par: -1, at: 0, side: 0, ord: 0, segs: [], tip: 1, pin: 0, short: 1, wire: null, scar: 0 };
  const n = 9, lean = (com.sap.lean * side0 * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const a = i === 0 ? UP + lean : (rnd(T) - 0.5) * 2 * com.sap.wob;
    trunk.segs.push({ l: i === n - 1 ? 7 : sp.int * 0.95, a, th: 4.6 - i * 0.25, age: 0, b: 0, bs: 1 });
  }
  T.limbs.push(trunk);
  let side = rnd(T) < 0.5 ? -1 : 1;
  for (let k = 0; k < com.sap.nb; k++) {
    const at = 2 + Math.floor((k * 5) / com.sap.nb) + (k % 2), L = { id: T.nid++, par: trunk.id, at: Math.min(at, n - 3), side, ord: 1, segs: [], tip: 1, pin: 0, short: 1, wire: null, scar: 0 };
    const ns = 2 + (k % 2);
    for (let i = 0; i < ns; i++) L.segs.push({ l: sp.int * (i === ns - 1 ? 0.5 : 0.85), a: i === 0 ? side * (0.75 + rnd(T) * 0.35) : (rnd(T) - 0.5) * 0.3, th: 1.8 - i * 0.2, age: 0, b: 0, bs: 1 });
    T.limbs.push(L); side = -side;
  }
  for (const L of T.limbs) for (const s of L.segs) if (rnd(T) < 0.4) { s.b = 1; s.bs = rnd(T) < 0.5 ? -1 : 1; }
  T.v++;
  return T;
}

export const limbLen = (L) => L.segs.reduce((s, q) => s + q.l, 0);
const limbMax = (sp, L) => (L.ord === 0 ? sp.maxTrunk : sp.maxBr * Math.pow(0.86, L.ord - 1));

// ---- derived geometry ---------------------------------------------------------------------------------------------------
const cache = new WeakMap();
export function geo(T) {
  let c = cache.get(T);
  if (c && c.v === T.v) return c;
  const by = new Map(); for (const L of T.limbs) by.set(L.id, L);
  const sp = SPECIES[T.species ?? 'juniper'];
  const pads = [], bounds = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
  for (const L of T.limbs) {
    let x = 0, y = 0, dir = 0;
    if (L.par >= 0) { const P = by.get(L.par), pp = P.g.pts[Math.min(L.at + 1, P.g.pts.length - 1)]; x = pp.x; y = pp.y; dir = P.g.ang[Math.min(L.at, P.g.ang.length - 1)]; }
    const pts = [{ x, y }], ang = [];
    for (const s of L.segs) { dir += s.a; ang.push(dir); x += Math.cos(dir) * s.l; y += Math.sin(dir) * s.l; pts.push({ x, y }); }
    L.g = { pts, ang };
  }
  for (const L of T.limbs) {
    const n = L.segs.length, boost = 1 + Math.min(3, L.pin) * 0.22, base = sp.pad * boost * (0.82 + 0.07 * Math.min(6, n));
    const ks = L.ord === 0 ? [0] : [0, 1, 2];
    ks.forEach((k) => {
      const i = n - 1 - k; if (i < 0 || (k > 0 && n < 3 + k)) return;
      if (L.ord === 0 && n < 3) return;
      const p = L.g.pts[i + 1], r = base * (k === 0 ? 1 : k === 1 ? 0.8 : 0.58) * (L.ord === 0 ? 0.92 : 1);
      pads.push({ x: p.x, y: p.y - r * 0.12, r, limb: L.id, seg: i, soft: k === 0 && L.segs[i].l < 4 ? 1 : 0 });
    });
    for (const p of L.g.pts) { bounds.x0 = Math.min(bounds.x0, p.x); bounds.x1 = Math.max(bounds.x1, p.x); bounds.y0 = Math.min(bounds.y0, p.y); bounds.y1 = Math.max(bounds.y1, p.y); }
  }
  for (const p of pads) { bounds.x0 = Math.min(bounds.x0, p.x - p.r); bounds.x1 = Math.max(bounds.x1, p.x + p.r); bounds.y0 = Math.min(bounds.y0, p.y - p.r); bounds.y1 = Math.max(bounds.y1, p.y + p.r); }
  c = { v: T.v, by, pads, bounds };
  cache.set(T, c);
  return c;
}
export const padArea = (G) => G.pads.reduce((s, p) => s + p.r * p.r, 0);
export const tipsTotal = (T) => T.limbs.filter((L) => L.tip).length;

// tips at or beyond each segment (pipe model); also total per limb subtree
function tipCounts(T) {
  const attach = new Map(); for (const L of T.limbs) attach.set(L.id, new Array(L.segs.length).fill(0));
  const cnt = new Map();
  for (let k = T.limbs.length - 1; k >= 0; k--) {
    const L = T.limbs[k], a = attach.get(L.id), n = L.segs.length, c = new Array(n);
    let run = L.tip ? 1 : 0.55 + Math.min(1.5, L.pin * 0.5);
    for (let i = n - 1; i >= 0; i--) { run += a[i]; c[i] = run; }
    cnt.set(L.id, c);
    if (L.par >= 0) { const pa = attach.get(L.par); if (pa) pa[Math.min(L.at, pa.length - 1)] += c[0]; }
  }
  return cnt;
}

// ---- growth -------------------------------------------------------------------------------------------------------------
function sprout(T, sp, P, i, seg) {
  const L = { id: T.nid++, par: P.id, at: i, side: seg.bs, ord: P.ord + 1, segs: [{ l: 2, a: seg.bs * (0.55 + rnd(T) * 0.6), th: 1.1, age: 0, b: 0, bs: 1 }], tip: 1, pin: 0, short: 1, wire: null, scar: 0 };
  seg.b = 0; T.limbs.push(L); T.ev.push({ k: 'bud', limb: L.id });
}

function springBreak(T, sp) {
  const parents = T.limbs.slice();
  for (const P of parents) {
    if (P.pin > 0 && !P.tip) { P.tip = 1; P.short = 0.7; const n = P.segs.length; for (let k = 0; k < 2; k++) { const s = P.segs[n - 1 - k]; if (s && !s.b) { s.b = 1; s.bs = k % 2 ? 1 : -1; } } }
    P.segs.forEach((seg, i) => {
      if (!seg.b || T.limbs.length >= MAX_LIMBS) return;
      if (rnd(T) < sp.lat * Math.pow(0.88, P.ord)) sprout(T, sp, P, i, seg);
    });
  }
}

export function stepTree(T, dt) {
  const sp = SPECIES[T.species];
  geo(T);
  const prevSeason = seasonIdx(T);
  T.t += dt;
  if (T.t >= YEAR) { T.t -= YEAR; T.year += 1; }
  const si = seasonIdx(T);
  if (si === 0 && prevSeason === 3) springBreak(T, sp);
  if (T.shock > 0) T.shock = Math.max(0, T.shock - dt);
  const tips = tipsTotal(T), res = 1 / Math.pow(1 + tips / 20, 0.55), f = GROW[si] * res * (T.shock > 0 ? 0.25 : 1), dg = dt * GROW[si];
  for (const L of T.limbs) {
    if (L.tip) {
      const n = L.segs.length, s = L.segs[n - 1], maxL = limbMax(sp, L);
      if (limbLen(L) < maxL) {
        s.l += sp.rate * f * (L.ord === 0 ? 1 : Math.max(0.55, 0.85 ** (L.ord - 1))) * dt;
        const int = sp.int * L.short * (L.ord ? 0.92 : 1);
        if (s.l >= int && n < 40) {
          s.l = int; if (!s.b && rnd(T) < sp.budP) { s.b = 1; s.bs = (L.alt = -(L.alt ?? 1)); }
          const diff = wrap((L.ord === 0 ? UP : UP + L.side * 0.95) - L.g.ang[n - 1]);
          L.cm = 0; L.segs.push({ l: 1, a: diff * (L.ord === 0 ? sp.up * 0.18 : 0.14) + (rnd(T) - 0.5) * 0.22, th: s.th * 0.9, age: 0, b: 0, bs: 1 });
        }
      }
    }
    if (L.wire) stepWire(T, L, dt, dg);
    for (const s of L.segs) s.age += dg;
  }
  // thickening: pipe model with a girth that builds over the years, never thinning
  const cnt = tipCounts(T), girth = 0.55 + 0.45 * Math.min(1, (T.year - 1 + T.t / YEAR) / 4);
  for (const L of T.limbs) { const c = cnt.get(L.id); L.segs.forEach((s, i) => { const want = (1.2 + 2.3 * Math.sqrt(c[i])) * girth; if (want > s.th) s.th += Math.min(want - s.th, dg * 0.22); }); }
  T.v++;
}

// ---- wire ---------------------------------------------------------------------------------------------------------------
const WW = [0.55, 0.3, 0.15];
export function maxBend(th) { return clamp((112 - 11 * th) * Math.PI / 180, 0.3, 1.9); }
export const wireCount = (T) => T.limbs.filter((L) => L.wire && !L.wire.end).length;
function applyDelta(L, w, d) { for (let k = 0; k < w.n; k++) { const sg = L.segs[w.s + k]; if (sg) sg.a += WW[k] * d; } }
function stepWire(T, L, dt, dg) {
  const w = L.wire;
  if (!w.drag && !w.end) { w.age += dg; if (!w.set && w.age >= SET_T) { w.set = true; T.ev.push({ k: 'set', limb: L.id }); } if (!w.bite && w.age >= BITE_T) { w.bite = true; L.scar += 1; T.bites += 1; T.health = Math.max(0, T.health - 7); T.ev.push({ k: 'bite', limb: L.id }); } }
  const d = w.tgt - w.cur;
  if (Math.abs(d) > 1e-4) { const m = Math.sign(d) * Math.min(Math.abs(d), Math.max(0.9 * dt, Math.abs(d) * Math.min(1, dt * 9))); w.cur += m; applyDelta(L, w, m); }
  else if (w.end) L.wire = null;
}
export function wireStart(T, L, seg) {
  if (wireCount(T) >= MAX_WIRES && !L.wire) return false;
  if (L.wire && L.wire.end) return false;
  if (!L.wire) L.wire = { s: clamp(seg, 0, L.segs.length - 1), n: 3, tgt: 0, cur: 0, base: 0, age: 0, set: false, bite: false, drag: true, end: false };
  else { L.wire.drag = true; L.wire.age = Math.min(L.wire.age, 2); L.wire.set = false; L.wire.base = L.wire.cur; }
  L.wire.n = Math.min(3, L.segs.length - L.wire.s);
  return true;
}
export function wireDrag(L, delta) { const w = L.wire; if (!w) return; const th = L.segs[w.s].th, m = maxBend(th); w.tgt = clamp(w.base + delta, Math.min(w.base, -m), Math.max(w.base, m)); }
export function wireRelease(L) { if (!L.wire) return; L.wire.drag = false; if (Math.abs(L.wire.tgt) < 0.05) { L.wire.end = true; L.wire.tgt = L.wire.cur; } }
export function wireRemove(T, L) {
  const w = L.wire; if (!w || w.end) return false;
  const frac = clamp(w.age / SET_T, 0, 1);     // a wire taken off too early lets the bend spring back
  w.end = true; w.drag = false; w.tgt = w.cur * (w.age >= SET_T ? 1 : 0.25 + 0.75 * frac * frac);
  T.ev.push({ k: w.age >= SET_T ? 'unwire-ok' : 'unwire-early', limb: L.id });
  return true;
}

// ---- cutting ------------------------------------------------------------------------------------------------------------
function dropLimb(T, id, out) {
  const kids = T.limbs.filter((q) => q.par === id).map((q) => q.id);
  const L = T.limbs.find((q) => q.id === id), G = L && L.g;
  if (G) out.push({ pts: G.pts.map((p) => ({ x: p.x, y: p.y })), th: L.segs.map((s) => s.th), pad: 1 });
  T.limbs = T.limbs.filter((q) => q.id !== id);
  for (const k of kids) dropLimb(T, k, out);
}
// Cut limb `id` at segment i, fraction t of that segment. Returns { removed: [polylines], lost: foliage fraction, shock: bool }.
export function snip(T, id, i, t) {
  const L = T.limbs.find((q) => q.id === id); if (!L) return null;
  const G0 = geo(T), a0 = padArea(G0), out = [];
  if (L.ord === 0 && i < 1) { i = 1; t = 0.5; }
  const flush = i === 0 && t < 0.25;
  // collect what falls: the part of this limb beyond the cut (for the animation) plus all its children beyond
  const pts = L.g.pts, cut = { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t };
  if (flush) { dropLimb(T, id, out); const P = T.limbs.find((q) => q.id === L.par); if (P) P.scar += 1; }
  else {
    const fall = [cut, ...pts.slice(i + 1)];
    out.push({ pts: fall.map((p) => ({ x: p.x, y: p.y })), th: L.segs.slice(i).map((s) => s.th), pad: 1 });
    for (const k of T.limbs.filter((q) => q.par === id && q.at >= i)) dropLimb(T, k.id, out);
    L.segs.length = i + 1; L.segs[i].l = Math.max(2.5, L.segs[i].l * t); L.segs[i].b = 1; L.segs[i].bs = L.alt = -(L.alt ?? 1);
    L.tip = 1; L.pin = 0; L.scar += 1; L.short = 0.85; L.cm = 1;
    if (L.wire && L.wire.s >= L.segs.length) L.wire = null; else if (L.wire) L.wire.n = Math.min(L.wire.n, L.segs.length - L.wire.s);
  }
  T.v++;
  const a1 = padArea(geo(T)), lost = a0 > 0 ? 1 - a1 / a0 : 0;
  T.cuts += 1;
  let shock = false;
  if (lost > 0.35) { shock = true; T.shock = 8; T.shocks += 1; T.health = Math.max(0, T.health - Math.round(4 + (22 * (lost - 0.35)) / 0.65)); T.ev.push({ k: 'shock' }); }
  return { removed: out, lost, shock, at: cut };
}
export function pinch(T, id) {
  const L = T.limbs.find((q) => q.id === id); if (!L || !L.tip || L.ord === 0) return false;
  const s = L.segs[L.segs.length - 1]; s.l = Math.max(1.5, s.l * 0.55); L.tip = 0; L.pin += 1; T.pinches += 1; T.v++;
  return true;
}
export function rubBud(T, id, i) { const L = T.limbs.find((q) => q.id === id); if (!L || !L.segs[i] || !L.segs[i].b) return false; L.segs[i].b = 0; T.v++; return true; }

// ---- picking ------------------------------------------------------------------------------------------------------------
// bias: world units of preference per branch order, so a fine branch next to its thick parent wins when the finger lands between them
export function nearestLimb(T, x, y, maxD, bias = 0) {
  const G = geo(T); let best = null;
  for (const L of T.limbs) {
    const p = L.g.pts;
    for (let i = 0; i < L.segs.length; i++) {
      const ax = p[i].x, ay = p[i].y, bx = p[i + 1].x, by = p[i + 1].y, dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1), px = ax + dx * t, py = ay + dy * t, d = Math.hypot(x - px, y - py) - L.segs[i].th * 0.5;
      const rk = d - bias * Math.min(L.ord, 3);
      if (d < maxD && (!best || rk < best.rk - 0.01 || (Math.abs(rk - best.rk) <= 0.01 && L.ord > best.limb.ord))) best = { limb: L, seg: i, t, d, rk, x: px, y: py };
    }
  }
  void G;
  return best;
}
export function nearestTip(T, x, y, maxD) {
  let best = null;
  for (const L of T.limbs) {
    if (!L.tip || L.ord === 0) continue;
    const p = L.g.pts[L.g.pts.length - 1], d = Math.hypot(x - p.x, y - p.y);
    if (d < maxD && (!best || d < best.d)) best = { limb: L, d, x: p.x, y: p.y };
  }
  return best;
}
export function nearestBud(T, x, y, maxD) {
  let best = null;
  for (const L of T.limbs) L.segs.forEach((s, i) => {
    if (!s.b) return;
    const p = L.g.pts[i + 1], bx = p.x + Math.cos(L.g.ang[i] + s.bs * 1.2) * 4, by = p.y + Math.sin(L.g.ang[i] + s.bs * 1.2) * 4, d = Math.hypot(x - bx, y - by);
    if (d < maxD && (!best || d < best.d)) best = { limb: L, seg: i, d, x: bx, y: by };
  });
  return best;
}
export const descendants = (T, id) => { const out = new Set([id]); let grew = true; while (grew) { grew = false; for (const L of T.limbs) if (!out.has(L.id) && out.has(L.par)) { out.add(L.id); grew = true; } } return out; };

export function makeTree(commissionId) {
  const com = commissionById(commissionId), T = newTree(com);
  T.species = com.species; T.comId = com.id; T.potId = null;
  return T;
}

// One mending session: shards (move, rotate, snap) then gilding (brush along the cracks). Plain data + pure functions.
import { buildVessel, maskHit, WORLD } from './geom.js';

const TAU = Math.PI * 2;
export const normA = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function newSession(def, rng, kind = 'free', rect = { x0: 0, y0: 0, x1: WORLD, y1: WORLD }) {
  const V = buildVessel(def), pcs = V.pieces, b = V.bounds;
  const order = pcs.map((_, i) => i).sort((i, j) => pcs[j].r - pcs[i].r);
  const placed = [], pieces = new Array(pcs.length);
  const rot = (def.rot * Math.PI) / 180;
  for (const i of order) {
    const r = pcs[i].r + 6;
    let best = null;
    for (let tier = 0; tier < 3 && !best; tier++) {
      for (let tries = 0; tries < 80 && !best; tries++) {
        const x = rect.x0 + r + rng.next() * (rect.x1 - rect.x0 - 2 * r), y = rect.y0 + r + rng.next() * (rect.y1 - rect.y0 - 2 * r);
        if (tier < 2) {
          const k = tier === 0 ? 0.92 : 0.55;
          if (x + r > b.cx - (b.w / 2) * k && x - r < b.cx + (b.w / 2) * k && y + r > b.cy - (b.h / 2) * k && y - r < b.cy + (b.h / 2) * k) continue;
        }
        if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < (p.r + r) * 0.78)) continue;
        best = { x, y, r };
      }
    }
    if (!best) best = { x: rect.x0 + r + rng.next() * (rect.x1 - rect.x0 - 2 * r), y: rect.y0 + r + rng.next() * (rect.y1 - rect.y0 - 2 * r), r };
    placed.push(best);
    pieces[i] = { x: best.x, y: best.y, a: rot ? (rng.next() * 2 - 1) * rot : 0, placed: false, z: 0 };
  }
  pieces.forEach((p, i) => { p.z = i; });
  return {
    vid: def.id, kind, phase: 'assemble', t: 0, moves: 0, hints: 0, sel: -1, zc: pieces.length, pieces, placedN: 0,
    seamQ: V.seams.map((s) => s.pts.map(() => 0)), seamDone: V.seams.map(() => false), brush: null, mend: 0, stars: 0, done: false, tip: null,
  };
}

export const home = (V, i) => ({ x: V.pieces[i].hx, y: V.pieces[i].hy });
export function snapInfo(V, def, P, i) {
  const pc = P.pieces[i], h = home(V, i), d = Math.hypot(pc.x - h.x, pc.y - h.y), da = Math.abs(normA(pc.a)) * (180 / Math.PI);
  return { d, da, ok: d <= def.snap && da <= def.snapA, warm: clamp(1 - d / (def.snap * 3.2), 0, 1) * clamp(1.15 - da / (def.snapA * 4), 0, 1) };
}
export function trySnap(V, def, P, i) {
  if (P.pieces[i].placed) return false;
  if (!snapInfo(V, def, P, i).ok) return false;
  const pc = P.pieces[i], h = home(V, i);
  pc.x = h.x; pc.y = h.y; pc.a = 0; pc.placed = true; pc.z = -1;
  P.placedN += 1; if (P.sel === i) P.sel = -1;
  if (P.placedN >= P.pieces.length) { P.phase = 'gild'; P.sel = -1; P.brush = null; }
  return true;
}

export function pickPiece(V, P, x, y) {
  let best = -1, bz = -1e9;
  P.pieces.forEach((pc, i) => {
    if (pc.placed || pc.z <= bz) return;
    const dx = x - pc.x, dy = y - pc.y, r = V.pieces[i].r + 4;
    if (dx * dx + dy * dy > r * r) return;
    const c = Math.cos(-pc.a), s = Math.sin(-pc.a);
    if (maskHit(V.pieces[i], dx * c - dy * s, dx * s + dy * c)) { best = i; bz = pc.z; }
  });
  return best;
}
export const knobPos = (V, P, i, u = 1) => { const pc = P.pieces[i], R = V.pieces[i].r + 14 * u, a = pc.a - Math.PI / 2; return { x: pc.x + Math.cos(a) * R, y: pc.y + Math.sin(a) * R, R }; };
export const raise = (P, i) => { P.pieces[i].z = ++P.zc; };
// A shard's centre may go as far out as 0.65 of its radius past the edge of the visible bench: always mostly visible and grabbable.
export const edgeOf = (V, i, rect) => { const m = Math.max(20, V.pieces[i].r * 0.35); return { x0: rect.x0 + m, y0: rect.y0 + m, x1: rect.x1 - m, y1: rect.y1 - m }; };
export function moveBy(V, P, i, dx, dy, rect) {
  const pc = P.pieces[i], e = edgeOf(V, i, rect); pc.x = clamp(pc.x + dx, e.x0, e.x1); pc.y = clamp(pc.y + dy, e.y0, e.y1);
}
// Keep every loose shard reachable inside the visible bench (after a rotation or resize). Returns true when something moved.
export function reclamp(V, P, rect, skip = -1) {
  let moved = false;
  P.pieces.forEach((pc, i) => {
    if (pc.placed || i === skip) return;
    const e = edgeOf(V, i, rect), x = clamp(pc.x, e.x0, e.x1), y = clamp(pc.y, e.y0, e.y1);
    if (x !== pc.x || y !== pc.y) { pc.x = x; pc.y = y; moved = true; }
  });
  return moved;
}

export function pickHint(V, P) {
  let best = -1, bs = -1;
  P.pieces.forEach((pc, i) => {
    if (pc.placed) return;
    const s = V.pieces[i].nbrs.filter((j) => P.pieces[j].placed).length * 100000 + V.pieces[i].area;
    if (s > bs) { bs = s; best = i; }
  });
  return best;
}

// ---- gilding -------------------------------------------------------------------------------------------------------------------
export const SPACING = 3.5;
export const DONE_FRAC = 0.93;
export function seamsLeft(P) { return P.seamDone.filter((d) => !d).length; }
function markSeam(P, s) {
  const q = P.seamQ[s]; let n = 0; for (const v of q) if (v >= 0.15) n++;
  if (!P.seamDone[s] && n >= q.length * DONE_FRAC) { P.seamDone[s] = true; for (let k = 0; k < q.length; k++) if (q[k] < 0.2) q[k] = 0.2; return true; }
  return false;
}
// o: { dt, rate (world units / s), full, zero, catchR } ; full/zero = distances (world units) for full and zero quality.
export function brushStep(V, P, fx, fy, o) {
  const ev = { done: [], moved: false, x: 0, y: 0, q: 0, lift: false };
  const quality = (d, spd) => clamp(1 - (d - o.full) / (o.zero - o.full), 0, 1) * clamp(1 - ((spd / o.rate - 0.55) / 0.45) * 0.5, 0.5, 1);
  if (!P.brush) {
    let best = null, bs = 1e9;
    V.seams.forEach((s, si) => { const q = P.seamQ[si]; for (let k = 0; k < s.pts.length; k++) { const d = Math.hypot(s.pts[k][0] - fx, s.pts[k][1] - fy); if (d > o.catchR) continue; const sc = d + q[k] * 10; if (sc < bs) { bs = sc; best = { s: si, i: k, d }; } } });
    if (!best) return ev;
    P.brush = { s: best.s, i: best.i, spd: 0 };
    const q = quality(best.d, 0); P.seamQ[best.s][best.i] = Math.max(P.seamQ[best.s][best.i], q);
    const p = V.seams[best.s].pts[best.i]; ev.moved = true; ev.x = p[0]; ev.y = p[1]; ev.q = q;
    return ev;
  }
  const b = P.brush, sp = V.seams[b.s].pts[b.i], link = o.rate * o.dt + 5;
  // how far is the finger from the nearest crack anywhere? (quality follows this; far away lifts the brush)
  let dn = 1e9;
  for (const s of V.seams) for (const p of s.pts) { const dx = p[0] - fx; if (dx > dn || -dx > dn) continue; const dd = Math.hypot(dx, p[1] - fy); if (dd < dn) dn = dd; }
  if (dn > o.zero * 1.25) { P.brush = null; ev.lift = true; return ev; }
  let best = null, bd = 1e9;
  V.seams.forEach((s, si) => {
    const n = s.pts.length;
    let lo = 0, hi = n - 1;
    if (si === b.s) { const span = Math.ceil(link / SPACING) + 2; lo = Math.max(0, b.i - span); hi = Math.min(n - 1, b.i + span); }
    for (let k = lo; k <= hi; k++) {
      const p = s.pts[k]; if (Math.abs(p[0] - sp[0]) > link || Math.abs(p[1] - sp[1]) > link) continue;
      if (Math.hypot(p[0] - sp[0], p[1] - sp[1]) > link) continue;
      const d = Math.hypot(p[0] - fx, p[1] - fy);
      if (d < bd) { bd = d; best = { s: si, i: k }; }
    }
  });
  if (!best) { P.brush = null; ev.lift = true; return ev; }
  const np = V.seams[best.s].pts[best.i], spd = Math.hypot(np[0] - sp[0], np[1] - sp[1]) / o.dt;
  b.spd = b.spd * 0.7 + spd * 0.3;
  const qNow = quality(dn, b.spd);
  if (best.s === b.s) {
    const step = best.i > b.i ? 1 : -1;
    for (let k = b.i; k !== best.i + step; k += step) P.seamQ[b.s][k] = Math.max(P.seamQ[b.s][k], qNow);
  } else P.seamQ[best.s][best.i] = Math.max(P.seamQ[best.s][best.i], qNow);
  ev.q = qNow;
  ev.moved = best.s !== b.s || best.i !== b.i; ev.x = np[0]; ev.y = np[1];
  for (const s of new Set([b.s, best.s])) if (markSeam(P, s)) ev.done.push(s);
  b.s = best.s; b.i = best.i;
  if (P.seamDone.every(Boolean)) finish(V, P);
  return ev;
}
export function brushUp(P) { P.brush = null; }

export function finish(V, P) {
  let sum = 0, n = 0; for (const q of P.seamQ) for (const v of q) { sum += Math.min(1, v); n++; }
  P.mend = n ? sum / n : 1;
  P.stars = P.mend >= 0.8 ? 3 : P.mend >= 0.6 ? 2 : 1;
  P.phase = 'done'; P.done = true; P.brush = null;
}
export const mendPct = (P) => Math.round(P.mend * 100);
export const fmtTime = (t) => { const s = Math.floor(t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export function gildProgress(P) { let n = 0, d = 0; for (const q of P.seamQ) for (const v of q) { n++; if (v >= 0.15) d++; } return n ? d / n : 0; }

// For saving: quantised copy of the session.
export const pack = (P) => ({ ...P, seamQ: P.seamQ.map((q) => q.map((v) => Math.round(v * 100))), brush: null, tip: null });
export const unpack = (v) => ({ ...v, seamQ: v.seamQ.map((q) => q.map((n) => n / 100)), brush: null, tip: null });

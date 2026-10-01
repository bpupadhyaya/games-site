// Pure geometry for the seven tangram pieces: shapes, transforms, exact convex clipping, outlines,
// snapping, completion checks, level validation and the edge-to-edge assembler. No DOM, no clock,
// no randomness of its own (callers pass an rng-like object with next()).
//
// Units: the small triangle has legs of length 1. Every vertex of every piece in every legal pose
// has coordinates of the form (a + b*sqrt(2)) / 2 with integers a, b, which is why level solutions
// are stored as integers and stay exact (see decodeSolution).

export const R2 = Math.SQRT2;
const H = R2 / 2;
export const EPS = 1e-7;
export const TOTAL_AREA = 8;

// kind index -> shape. Order is the canonical piece order used everywhere.
export const KINDS = [
  { id: 'L1', type: 'L', verts: [[0, 0], [2, 0], [0, 2]] },
  { id: 'L2', type: 'L', verts: [[0, 0], [2, 0], [0, 2]] },
  { id: 'M', type: 'M', verts: [[0, 0], [R2, 0], [0, R2]] },
  { id: 'S1', type: 'S', verts: [[0, 0], [1, 0], [0, 1]] },
  { id: 'S2', type: 'S', verts: [[0, 0], [1, 0], [0, 1]] },
  { id: 'SQ', type: 'SQ', verts: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { id: 'PA', type: 'PA', verts: [[0, 0], [R2, 0], [R2 + H, H], [H, H]] },
];
export const KIND_COUNT = KINDS.length;
// two pieces of the same type are interchangeable in any solution
export const sameType = (a, b) => KINDS[a].type === KINDS[b].type;

export const polyArea = (p) => {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
};
KINDS.forEach((k) => { k.area = polyArea(k.verts); });

export const centroid = (p) => {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    const c = x1 * y2 - x2 * y1;
    a += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c;
  }
  a /= 2;
  return [cx / (6 * a), cy / (6 * a)];
};
KINDS.forEach((k) => { k.centroid = centroid(k.verts); });

const COS = [1, H, 0, -H, -1, -H, 0, H];
const SIN = [0, H, 1, H, 0, -H, -1, -H];

// A pose is { r: 0..7 (45 degree steps, counter-clockwise), f: 0|1 (mirror), x, y } where (x, y) is
// where the piece's local origin lands after mirroring and rotating.
export function polyOf(kind, r, f, x, y) {
  let pts = KINDS[kind].verts;
  if (f) pts = pts.map(([px, py]) => [-px, py]).reverse();
  const c = COS[r & 7], s = SIN[r & 7];
  return pts.map(([px, py]) => [px * c - py * s + x, px * s + py * c + y]);
}

// Pose keeping the piece's centroid at (cx, cy) for a given orientation.
export function poseAround(kind, r, f, cx, cy) {
  const zero = polyOf(kind, r, f, 0, 0);
  const [gx, gy] = centroid(zero);
  return { kind, r: r & 7, f: f ? 1 : 0, x: cx - gx, y: cy - gy };
}
export const polyOfPose = (p) => polyOf(p.kind, p.r, p.f, p.x, p.y);

// Display polygon for any (float) rotation: rotates about the centroid, which sits at (cx, cy).
// rot is in 45 degree steps; positive turns clockwise on screen (y points down).
export function polyFree(kind, f, rot, cx, cy) {
  const k = KINDS[kind];
  let pts = k.verts.map(([x, y]) => [x - k.centroid[0], y - k.centroid[1]]);
  if (f) pts = pts.map(([x, y]) => [-x, y]).reverse();
  const a = (rot * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => [x * c - y * s + cx, x * s + y * c + cy]);
}
const mod8 = (n) => ((Math.round(n) % 8) + 8) % 8;
// Exact pose of a logical piece { kind, f, rot (integer), cx, cy }
export const poseOfPiece = (p) => poseAround(p.kind, mod8(p.rot), p.f, p.cx, p.cy);
export const polyOfPiece = (p) => polyOfPose(poseOfPiece(p));
export { mod8 };
export const centroidOfPose = (p) => centroid(polyOfPose(p));

export const ring = (a, b) => (a + b * R2) / 2;
// Level solution entry: [kind, r, f, ax, bx, ay, by] -> pose
export const decodeEntry = (e) => ({ kind: e[0], r: e[1], f: e[2], x: ring(e[3], e[4]), y: ring(e[5], e[6]) });
export const decodeSolution = (sol) => sol.map(decodeEntry);

// Find integers (a, b) with (a + b*sqrt2)/2 ~= v, or null.
export function toRing(v) {
  let best = null, bestErr = 1e-5;
  for (let b = -60; b <= 60; b++) {
    const a = Math.round(2 * v - b * R2);
    const err = Math.abs((a + b * R2) / 2 - v);
    if (err < bestErr) { bestErr = err; best = [a, b]; }
  }
  return best;
}
export function encodePose(p) {
  const rx = toRing(p.x), ry = toRing(p.y);
  if (!rx || !ry) return null;
  return [p.kind, p.r, p.f, rx[0], rx[1], ry[0], ry[1]];
}

export const bbox = (polys) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
};

// ---- exact convex clipping -------------------------------------------------------------------
function clip(subject, clipper) {
  let out = subject;
  for (let i = 0; i < clipper.length && out.length; i++) {
    const [ax, ay] = clipper[i];
    const [bx, by] = clipper[(i + 1) % clipper.length];
    const inp = out;
    out = [];
    const side = (p) => (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax);
    for (let j = 0; j < inp.length; j++) {
      const cur = inp[j], prev = inp[(j + inp.length - 1) % inp.length];
      const sc = side(cur), sp = side(prev);
      if (sc >= -1e-12) {
        if (sp < -1e-12) out.push(cross(prev, cur, sp, sc));
        out.push(cur);
      } else if (sp >= -1e-12) out.push(cross(prev, cur, sp, sc));
    }
  }
  return out;
}
const cross = (p, q, sp, sq) => {
  const t = sp / (sp - sq);
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
};
export const overlapArea = (a, b) => {
  const r = clip(a, b);
  return r.length < 3 ? 0 : Math.abs(polyArea(r));
};

export function pointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---- outline of a union of non-overlapping convex polygons ---------------------------------------
const key = (p) => `${Math.round(p[0] * 2000)},${Math.round(p[1] * 2000)}`;

// Returns { loops: [[ [x,y]... ]], pinch: boolean }. Loops are counter-clockwise outer boundaries
// (clockwise for holes). Corners only (collinear points merged).
export function outlineOf(polys) {
  const verts = new Map();
  for (const p of polys) for (const v of p) verts.set(key(v), v);
  const all = [...verts.values()];
  const edges = new Map(); // "a>b" -> [a, b]
  for (const p of polys) {
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy;
      const mids = [];
      for (const v of all) {
        const t = ((v[0] - a[0]) * dx + (v[1] - a[1]) * dy) / len2;
        if (t <= 1e-6 || t >= 1 - 1e-6) continue;
        const px = a[0] + dx * t, py = a[1] + dy * t;
        if (Math.abs(px - v[0]) < 1e-5 && Math.abs(py - v[1]) < 1e-5) mids.push([t, v]);
      }
      mids.sort((m, n) => m[0] - n[0]);
      const chain = [a, ...mids.map((m) => m[1]), b];
      for (let k = 0; k + 1 < chain.length; k++) {
        const s = chain[k], e = chain[k + 1];
        const fwd = `${key(s)}>${key(e)}`, back = `${key(e)}>${key(s)}`;
        if (edges.has(back)) edges.delete(back);
        else edges.set(fwd, [s, e]);
      }
    }
  }
  const out = new Map();
  let pinch = false;
  for (const [s, e] of edges.values()) {
    const k = key(s);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push([s, e]);
  }
  for (const list of out.values()) if (list.length > 1) pinch = true;
  const used = new Set();
  const loops = [];
  for (const [s0, e0] of edges.values()) {
    const id0 = `${key(s0)}>${key(e0)}`;
    if (used.has(id0)) continue;
    const loop = [s0];
    let cur = [s0, e0];
    let guard = 0;
    while (guard++ < 500) {
      used.add(`${key(cur[0])}>${key(cur[1])}`);
      const nextKey = key(cur[1]);
      if (nextKey === key(s0)) break;
      loop.push(cur[1]);
      const options = (out.get(nextKey) ?? []).filter((c) => !used.has(`${key(c[0])}>${key(c[1])}`));
      if (!options.length) { pinch = true; break; }
      cur = options[0];
    }
    loops.push(loop);
  }
  // drop collinear points
  const simple = loops.map((loop) => loop.filter((p, i) => {
    const a = loop[(i + loop.length - 1) % loop.length], b = loop[(i + 1) % loop.length];
    const cr = (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]);
    return Math.abs(cr) > 1e-6;
  }));
  return { loops: simple, pinch };
}

export function sharedEdgeLength(a, b) {
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    const p = a[i], q = a[(i + 1) % a.length];
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    for (let j = 0; j < b.length; j++) {
      const r = b[j], s = b[(j + 1) % b.length];
      const ex = s[0] - r[0], ey = s[1] - r[1];
      const el = Math.hypot(ex, ey);
      if (Math.abs(ex / el + ux) > 1e-6 || Math.abs(ey / el + uy) > 1e-6) continue; // must be antiparallel
      const off = (r[0] - p[0]) * uy - (r[1] - p[1]) * ux;
      if (Math.abs(off) > 1e-6) continue;
      const t0 = (s[0] - p[0]) * ux + (s[1] - p[1]) * uy; // s lies "first" along p->q since antiparallel
      const t1 = (r[0] - p[0]) * ux + (r[1] - p[1]) * uy;
      const lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(len, Math.max(t0, t1));
      if (hi - lo > 1e-6) total += hi - lo;
    }
  }
  return total;
}

function segDist(a, b, c, d) {
  const pd = (p, q, r) => {
    const dx = r[0] - q[0], dy = r[1] - q[1];
    const t = Math.max(0, Math.min(1, ((p[0] - q[0]) * dx + (p[1] - q[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p[0] - (q[0] + dx * t), p[1] - (q[1] + dy * t));
  };
  const ccw = (p, q, r) => (r[1] - p[1]) * (q[0] - p[0]) > (q[1] - p[1]) * (r[0] - p[0]);
  if (ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d)) return 0;
  return Math.min(pd(a, c, d), pd(b, c, d), pd(c, a, b), pd(d, a, b));
}
// smallest distance between two outline edges that are not neighbours: finds slits and pinches
export function minGap(loop) {
  const n = loop.length;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      best = Math.min(best, segDist(loop[i], loop[(i + 1) % n], loop[j], loop[(j + 1) % n]));
    }
  }
  return best;
}

// ---- level validation -----------------------------------------------------------------------------
export const BOARD_LIMIT = { w: 5.75, h: 6.05 };

export function validateSolution(sol) {
  const errors = [];
  if (!Array.isArray(sol) || sol.length !== KIND_COUNT) return { ok: false, errors: ['need 7 placements'] };
  const seen = new Set(sol.map((e) => e[0]));
  if (seen.size !== KIND_COUNT) errors.push('every piece must appear exactly once');
  const polys = sol.map((e) => polyOfPose(decodeEntry(e)));
  for (let i = 0; i < polys.length; i++) {
    for (let j = i + 1; j < polys.length; j++) {
      const o = overlapArea(polys[i], polys[j]);
      if (o > 1e-6) errors.push(`pieces ${i} and ${j} overlap`);
    }
  }
  // edge-connected
  const parent = polys.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < polys.length; i++) {
    for (let j = i + 1; j < polys.length; j++) if (sharedEdgeLength(polys[i], polys[j]) > 1e-6) parent[find(i)] = find(j);
  }
  if (new Set(polys.map((_, i) => find(i))).size !== 1) errors.push('pieces are not joined edge to edge');
  const { loops, pinch } = outlineOf(polys);
  if (pinch) errors.push('outline pinches or touches itself');
  if (loops.length !== 1) errors.push(`outline has ${loops.length} loops (holes)`);
  if (loops.length === 1 && minGap(loops[0]) < 0.15) errors.push('outline has a slit or near-touch');
  const box = bbox(polys);
  if (box.w > BOARD_LIMIT.w || box.h > BOARD_LIMIT.h) errors.push('too big for the board');
  return { ok: errors.length === 0, errors, polys, loops, box };
}

// ---- play-time evaluation ---------------------------------------------------------------------------
// slots: polygons of the solution (union = target). poses: placed piece poses.
export function evaluate(slots, polys, ids) {
  // inside[i] = area of piece i that lies within the target
  const inside = polys.map((p) => slots.reduce((s, q) => s + overlapArea(p, q), 0));
  const overlaps = polys.map(() => 0);
  let overlapTotal = 0;
  for (let i = 0; i < polys.length; i++) {
    for (let j = i + 1; j < polys.length; j++) {
      const o = overlapArea(polys[i], polys[j]);
      if (o > 1e-9) { overlaps[i] += o; overlaps[j] += o; overlapTotal += o; }
    }
  }
  const fits = polys.map((p, i) => {
    const a = Math.abs(polyArea(p));
    return a - inside[i] < 0.02 && overlaps[i] < 0.02;
  });
  let outside = 0;
  polys.forEach((p, i) => { outside += Math.abs(polyArea(p)) - inside[i]; });
  const complete = polys.length === KIND_COUNT && outside < 0.04 && overlapTotal < 0.04;
  return { inside, overlaps, fits, complete, outside, overlapTotal };
}

// Snap a dropped piece. others: polygons of other placed pieces. anchors: [[x,y]...] points.
// Returns the adjusted pose (or the input pose unchanged when nothing is close enough).
export function snapPose(pose, slots, others, anchors, radius) {
  const poly = polyOfPose(pose);
  const score = (pl) => {
    let inside = 0;
    for (const q of slots) inside += overlapArea(pl, q);
    let over = 0;
    for (const o of others) over += overlapArea(pl, o);
    return inside - 2.5 * over;
  };
  const base = score(poly);
  let best = null, bestScore = base - 1e-9;
  const cand = [];
  for (const v of poly) {
    for (const a of anchors) {
      const dx = a[0] - v[0], dy = a[1] - v[1];
      const d = Math.hypot(dx, dy);
      if (d <= radius) cand.push([dx, dy, d]);
    }
  }
  cand.sort((m, n) => m[2] - n[2]);
  const tried = new Set();
  for (const [dx, dy, d] of cand) {
    const k = `${Math.round(dx * 500)},${Math.round(dy * 500)}`;
    if (tried.has(k)) continue;
    tried.add(k);
    if (tried.size > 60) break;
    const moved = poly.map(([x, y]) => [x + dx, y + dy]);
    const s = score(moved) - 0.02 * d;
    if (s > bestScore + 1e-9) { bestScore = s; best = [dx, dy]; }
  }
  if (!best) return pose;
  return { ...pose, x: pose.x + best[0], y: pose.y + best[1] };
}

export function anchorsFor(slots, loops, otherPolys) {
  const seen = new Set();
  const out = [];
  const add = (v) => { const k = key(v); if (!seen.has(k)) { seen.add(k); out.push(v); } };
  for (const l of loops) for (const v of l) add(v);
  for (const p of slots) for (const v of p) add(v);
  for (const p of otherPolys) for (const v of p) add(v);
  return out;
}

// ---- edge-to-edge assembler (daily puzzle + offline level search) --------------------------------------
// All attachment poses that put one edge of (kind, r, f) flush against an exposed edge of the current
// union, sharing an endpoint, without overlapping anything already placed.
export function attachments(placedPolys, kind, r, f) {
  const base = polyOf(kind, r, f, 0, 0);
  if (!placedPolys.length) return [{ kind, r, f, x: 0, y: 0 }];
  const { loops } = outlineOf(placedPolys);
  const res = [];
  const seen = new Set();
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length];
      const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ux = (b[0] - a[0]) / l1, uy = (b[1] - a[1]) / l1;
      for (let j = 0; j < base.length; j++) {
        const p = base[j], q = base[(j + 1) % base.length];
        const l2 = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const vx = (q[0] - p[0]) / l2, vy = (q[1] - p[1]) / l2;
        if (Math.abs(vx + ux) > 1e-6 || Math.abs(vy + uy) > 1e-6) continue;
        const targets = [[b[0] - p[0], b[1] - p[1]], [a[0] + ux * l2 - p[0], a[1] + uy * l2 - p[1]]];
        for (const [tx, ty] of targets) {
          const k = `${Math.round(tx * 500)},${Math.round(ty * 500)}`;
          if (seen.has(k)) continue;
          seen.add(k);
          const moved = base.map(([x, y]) => [x + tx, y + ty]);
          let ok = true;
          for (const o of placedPolys) if (overlapArea(moved, o) > 1e-6) { ok = false; break; }
          if (ok) res.push({ kind, r, f, x: tx, y: ty });
        }
      }
    }
  }
  return res;
}

// Random valid assembly using rng.next(). Returns { sol, polys } or null. Pieces are placed in a
// random order with random orientation; retries bounded.
export function randomAssembly(rng, tries = 40) {
  for (let t = 0; t < tries; t++) {
    const order = [0, 1, 2, 3, 4, 5, 6];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const placed = [], polys = [];
    let ok = true;
    for (const kind of order) {
      let opts = [];
      for (let a = 0; a < 6 && !opts.length; a++) {
        const r = Math.floor(rng.next() * 8), f = (kind === 6 || kind === 5) && rng.next() < 0.5 ? 1 : 0;
        opts = attachments(polys, kind, r, f);
      }
      if (!opts.length) { ok = false; break; }
      const pose = opts[Math.floor(rng.next() * opts.length)];
      placed.push(pose);
      polys.push(polyOfPose(pose));
    }
    if (!ok) continue;
    const sol = [];
    let enc = true;
    for (const p of placed) { const e = encodePose(p); if (!e) { enc = false; break; } sol.push(e); }
    if (!enc) continue;
    const v = validateSolution(sol);
    if (v.ok) return { sol, polys: v.polys, loops: v.loops, box: v.box };
  }
  return null;
}

// Normalise a solution so its bounding box starts near the origin (ring-exact shift by whole units).
export function normalizeSolution(sol) {
  const polys = sol.map((e) => polyOfPose(decodeEntry(e)));
  const box = bbox(polys);
  const sx = Math.round(box.x0), sy = Math.round(box.y0);
  return sol.map((e) => [e[0], e[1], e[2], e[3] - 2 * sx, e[4], e[5] - 2 * sy, e[6]]);
}

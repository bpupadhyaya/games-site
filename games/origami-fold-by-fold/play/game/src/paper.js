// Flat-folding engine for one sheet of paper. Pure geometry, deterministic, no drawing.
//
// The paper is a set of CONVEX layer polygons lying in the table plane (y down), each with
//   pts  the corners now (flat plane)         m  affine map sheet(u,v) -> flat (x,y); det < 0 means the back shows
//   z    stacking order (bigger = on top)     tags  names given by earlier folds (used to pick layers)
// The sheet is the square [-0.5, 0.5]^2 in its own (u, v) space; creases live in that space so they follow the paper.
// A fold line is (a, n): a point on the line and the unit normal pointing at the side that MOVES. Folding splits the picked
// layers on the line, reflects the moving halves and restacks them on top (valley) or underneath (mountain).
export const EPS = 1e-7;
const AMIN = 1e-6;

// ---- affine maps [a, b, c, d, e, f]: x = a*u + c*v + e, y = b*u + d*v + f ----------------------------------------------------
export const mApply = (m, u, v) => [m[0] * u + m[2] * v + m[4], m[1] * u + m[3] * v + m[5]];
export const mCompose = (R, m) => [
  R[0] * m[0] + R[2] * m[1], R[1] * m[0] + R[3] * m[1], R[0] * m[2] + R[2] * m[3], R[1] * m[2] + R[3] * m[3],
  R[0] * m[4] + R[2] * m[5] + R[4], R[1] * m[4] + R[3] * m[5] + R[5],
];
export const mDet = (m) => m[0] * m[3] - m[1] * m[2];
export function mInv(m) {
  const d = mDet(m) || 1e-12;
  const a = m[3] / d, b = -m[1] / d, c = -m[2] / d, dd = m[0] / d;
  return [a, b, c, dd, -(a * m[4] + c * m[5]), -(b * m[4] + dd * m[5])];
}
export const reflectMatrix = (a, n) => {
  const an = a[0] * n[0] + a[1] * n[1];
  return [1 - 2 * n[0] * n[0], -2 * n[0] * n[1], -2 * n[0] * n[1], 1 - 2 * n[1] * n[1], 2 * an * n[0], 2 * an * n[1]];
};
export const reflectPt = (p, a, n) => { const s = (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1]; return [p[0] - 2 * s * n[0], p[1] - 2 * s * n[1]]; };
export const side = (p, a, n) => (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1];

export function area(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; }
  return s / 2;
}
export const centroid = (pts) => {
  let x = 0, y = 0;
  for (const p of pts) { x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
};

// Sutherland-Hodgman against a half plane: keep = +1 keeps side >= 0, -1 keeps side <= 0. Returns null when nothing is left.
export function clipHalf(pts, a, n, keep) {
  const out = [];
  const k = pts.length;
  for (let i = 0; i < k; i++) {
    const p = pts[i], q = pts[(i + 1) % k];
    const sp = keep * side(p, a, n), sq = keep * side(q, a, n);
    if (sp >= -EPS) out.push(p);
    if ((sp > EPS && sq < -EPS) || (sp < -EPS && sq > EPS)) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  const clean = out.filter((p, i) => { const q = out[(i + 1) % out.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9; });
  return clean.length >= 3 && Math.abs(area(clean)) > AMIN ? clean : null;
}

// ---- state --------------------------------------------------------------------------------------------------------------------
// rot spins the whole sheet in the table plane (a diamond start is rot = PI/4).
export function newSheet(rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot), m = [c, s, -s, c, 0, 0];
  const pts = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([u, v]) => mApply(m, u, v));
  return { polys: [{ id: 0, pts, m, z: 0, tags: [] }], creases: [], nid: 1, hist: [], turned: false };
}
const body = (st) => ({ polys: st.polys, creases: st.creases, nid: st.nid, turned: st.turned });
export const snapshot = (st) => JSON.parse(JSON.stringify(body(st)));
export const cloneState = (st) => ({ ...JSON.parse(JSON.stringify(body(st))), hist: st.hist.map((h) => ({ ...h, before: h.before })) });

const sortedDesc = (arr) => [...arr].sort((p, q) => q.z - p.z || q.id - p.id);

function pickSet(cands, pick) {
  if (!pick || pick === 'all') return new Set(cands);
  const list = sortedDesc(cands);
  if (pick.top != null) return new Set(list.slice(0, pick.top));
  if (pick.bottom != null) return new Set(list.slice(-pick.bottom));
  if (pick.ids != null) return new Set(list.filter((p) => pick.ids.includes(p.id)));
  if (pick.tag != null) return new Set(list.filter((p) => p.tags.includes(pick.tag)));
  if (pick.not != null) return new Set(list.filter((p) => !p.tags.includes(pick.not)));
  return new Set(cands);
}

// A fold spec: { a:[x,y], n:[nx,ny] (unit, towards the moving side), kind:'valley'|'mountain', pick, tag }.
// planFold splits the picked layers and says what stays and what moves; nothing is changed yet.
export function planFold(state, spec) {
  const { a, n } = spec;
  const cands = state.polys.filter((P) => clipHalf(P.pts, a, n, 1));
  const chosen = pickSet(cands, spec.pick);
  const fixed = [], moving = [];
  let nid = state.nid;
  for (const P of state.polys) {
    if (!chosen.has(P)) { fixed.push(P); continue; }
    const pos = clipHalf(P.pts, a, n, 1), neg = clipHalf(P.pts, a, n, -1);
    if (neg) { fixed.push({ ...P, pts: neg, tags: [...P.tags] }); moving.push({ ...P, id: nid++, pts: pos, tags: [...P.tags], chord: chordOf(pos, a, n) }); }
    else moving.push({ ...P, pts: pos, tags: [...P.tags] });
  }
  let handle = null, D = 0;
  for (const P of moving) for (const p of P.pts) { const s = side(p, a, n); if (s > D + 1e-9) { D = s; handle = p; } }
  return { spec, fixed, moving, nid, D, handle, target: handle ? reflectPt(handle, a, n) : null, ok: moving.length > 0 && D > 0.02 };
}

// the part of the fold line that lies on a polygon (its two end points), found from the vertices that sit on the line
function chordOf(pos, a, n) {
  const t = [-n[1], n[0]];
  const on = pos.filter((p) => Math.abs(side(p, a, n)) < 1e-6);
  if (on.length < 2) return null;
  on.sort((p, q) => (p[0] - a[0]) * t[0] + (p[1] - a[1]) * t[1] - ((q[0] - a[0]) * t[0] + (q[1] - a[1]) * t[1]));
  return [on[0], on[on.length - 1]];
}

// Commit a plan: moving layers are reflected and restacked. Returns a new state (the old one is untouched).
export function commitFold(state, plan, { keepHist = true } = {}) {
  const { spec } = plan;
  const R = reflectMatrix(spec.a, spec.n);
  const maxZ = Math.max(0, ...plan.fixed.map((p) => p.z)), minZ = Math.min(0, ...plan.fixed.map((p) => p.z));
  const order = sortedDesc(plan.moving);
  const valley = spec.kind !== 'mountain';
  const moved = order.map((P, i) => ({
    ...P, chord: undefined, pts: P.pts.map((p) => reflectPt(p, spec.a, spec.n)), m: mCompose(R, P.m),
    z: valley ? maxZ + 1 + i : minZ - order.length + i, tags: spec.tag ? [...P.tags, spec.tag] : [...P.tags],
  }));
  const creases = withCreases(state.creases, plan);
  const next = { polys: [...plan.fixed.map((P) => ({ ...P, chord: undefined })), ...moved], creases, nid: plan.nid, turned: state.turned, hist: keepHist ? state.hist.slice() : [] };
  if (keepHist) next.hist.push({ type: 'fold', before: snapshot(state), spec });
  return next;
}
const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-5;
// the creases a plan adds (in sheet space), merged into an existing list
export function withCreases(list, plan) {
  const creases = list.slice();
  for (const P of plan.moving) {
    if (!P.chord) continue;
    const inv = mInv(P.m), p = mApply(inv, P.chord[0][0], P.chord[0][1]), q = mApply(inv, P.chord[1][0], P.chord[1][1]);
    const dup = creases.some((c) => (near(c.p, p) && near(c.q, q)) || (near(c.p, q) && near(c.q, p)));
    if (!dup) creases.push({ p, q });
  }
  return creases;
}

// Undo the last fold or turn (the crease goes with it). `keepCreases` is for the Unfold step, which leaves the crease in the paper.
export function revert(state, { keepCreases = false } = {}) {
  const h = state.hist[state.hist.length - 1];
  if (!h) return state;
  const hist = state.hist.slice(0, -1);
  if (h.type === 'turn') return { ...turnSheet(state), hist };
  const b = JSON.parse(JSON.stringify(h.before));
  return { ...b, creases: keepCreases ? state.creases.slice() : b.creases, hist };
}

export function turnSheet(state, { keepHist = true } = {}) {
  const a = [0, 0], n = [1, 0], R = reflectMatrix(a, n);
  const polys = state.polys.map((P) => ({ ...P, pts: P.pts.map((p) => reflectPt(p, a, n)), m: mCompose(R, P.m), z: -P.z, chord: undefined }));
  const next = { ...body(state), polys, turned: !state.turned, hist: keepHist ? state.hist.slice() : [] };
  if (keepHist) next.hist.push({ type: 'turn', before: null });
  return next;
}

export const lastFold = (state) => { for (let i = state.hist.length - 1; i >= 0; i--) if (state.hist[i].type === 'fold') return state.hist[i]; return null; };

// ---- helpers for authoring fold lines ---------------------------------------------------------------------------------------------
// Fold point p onto point q: the crease is their perpendicular bisector and p's side moves.
export function toward(p, q, opts = {}) {
  const dx = p[0] - q[0], dy = p[1] - q[1], l = Math.hypot(dx, dy);
  return { a: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], n: [dx / l, dy / l], kind: 'valley', pick: 'all', ...opts };
}
// Fold along the line through p0 and p1; the side that holds point `moving` moves.
export function along(p0, p1, moving, opts = {}) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy);
  let n = [-dy / l, dx / l];
  if (side(moving, p0, n) < 0) n = [-n[0], -n[1]];
  return { a: p0, n, kind: 'valley', pick: 'all', ...opts };
}

export function bounds(polys) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const P of polys) for (const p of P.pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

// The silhouette of the layers (as polygons), used for the "result" thumbnails and size fitting.
export const layerCount = (state) => state.polys.length;

// ---- 3D faces for drawing -----------------------------------------------------------------------------------------------------------
// A face is one convex piece of paper in space: pts3 (corners), c3 (a point inside), Eu/Ev (the sheet's u and v axes as 3D
// vectors there) and uv (the sheet coordinates of c3). Drawing needs only these, so folds, turns and poses all become faces.
export function flatFace(P, extra = {}) {
  const c = centroid(P.pts), uv = mApply(mInv(P.m), c[0], c[1]);
  return { id: P.id, z: P.z, tags: P.tags, pts3: P.pts.map((p) => [p[0], p[1], 0]), c3: [c[0], c[1], 0], Eu: [P.m[0], P.m[1], 0], Ev: [P.m[2], P.m[3], 0], uv, sgn: Math.sign(mDet(P.m)) || 1, ...extra };
}

export function faceXform(F, f) {
  // f maps a 3D point to a 3D point; vectors are mapped through finite differences (exact for rigid motions)
  const o = f(F.c3), eu = f([F.c3[0] + F.Eu[0], F.c3[1] + F.Eu[1], F.c3[2] + F.Eu[2]]), ev = f([F.c3[0] + F.Ev[0], F.c3[1] + F.Ev[1], F.c3[2] + F.Ev[2]]);
  return { ...F, pts3: F.pts3.map(f), c3: o, Eu: [eu[0] - o[0], eu[1] - o[1], eu[2] - o[2]], Ev: [ev[0] - o[0], ev[1] - o[1], ev[2] - o[2]] };
}

// rotate about the table-plane axis through a with direction t by angle phi (Rodrigues)
export function rotAxis(a, t, phi) {
  const c = Math.cos(phi), s = Math.sin(phi);
  return (p) => {
    const x = p[0] - a[0], y = p[1] - a[1], z = p[2];
    const dot = t[0] * x + t[1] * y;
    const cx = t[1] * z, cy = -t[0] * z, cz = t[0] * y - t[1] * x;
    return [a[0] + x * c + cx * s + t[0] * dot * (1 - c), a[1] + y * c + cy * s + t[1] * dot * (1 - c), z * c + cz * s];
  };
}

// The bent flap while folding: how far along the table (X) and how high (Z) the paper is at distance s from the crease.
export function bendProfile(D, theta, sigma) {
  const N = 40, ds = Math.max(D, 1e-6) / N, X = [0], Z = [0];
  const lag = 0.2 * Math.sin(theta);
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N, phi = theta * (1 - lag * u * u * (3 - 2 * u));
    X.push(X[i] + Math.cos(phi) * ds); Z.push(Z[i] + sigma * Math.sin(phi) * ds);
  }
  const endPhi = theta * (1 - lag), cE = Math.cos(endPhi), sE = Math.sin(endPhi);
  return (s) => {
    if (s <= 0) return [s, 0];
    const f = s / ds, i = Math.floor(f);
    if (i >= N) { const e = s - D; return [X[N] + cE * e, Z[N] + sigma * sE * e]; }
    const w = f - i;
    return [X[i] + (X[i + 1] - X[i]) * w, Z[i] + (Z[i + 1] - Z[i]) * w];
  };
}

const STRIPS = 7;
// Faces of the sheet while a fold is at angle theta (0 flat, PI folded). Fixed layers stay flat; the moving ones are cut into strips
// parallel to the crease so they can curl.
export function foldMapper(plan, theta) {
  const { spec } = plan, { a, n } = spec;
  const sigma = spec.kind === 'mountain' ? -1 : 1;
  const bend = bendProfile(plan.D, theta, sigma);
  return (p) => {
    const s = side(p, a, n);
    if (s <= 0) return [p[0], p[1], 0];
    const q = [p[0] - s * n[0], p[1] - s * n[1]], [x, z] = bend(s);
    return [q[0] + x * n[0], q[1] + x * n[1], z];
  };
}
export function foldFaces(state, plan, theta) {
  const { spec } = plan, { a, n } = spec;
  const map = foldMapper(plan, theta);
  const faces = [];
  for (const P of plan.fixed) faces.push(flatFace(P, { moving: false }));
  const dl = 0.012;
  for (const P of plan.moving) {
    const inv = mInv(P.m);
    const smax = Math.max(...P.pts.map((p) => side(p, a, n)));
    const k = Math.max(1, Math.round(STRIPS * smax / Math.max(plan.D, 1e-6) + 0.49));
    for (let i = 0; i < k; i++) {
      const lo = (smax * i) / k, hi = (smax * (i + 1)) / k;
      let pts = P.pts;
      if (i > 0) pts = clipHalf(pts, [a[0] + n[0] * lo, a[1] + n[1] * lo], n, 1);
      if (pts && i < k - 1) pts = clipHalf(pts, [a[0] + n[0] * hi, a[1] + n[1] * hi], n, -1);
      if (!pts) continue;
      const skip = pts.map((p, j) => { const q = pts[(j + 1) % pts.length], sp = side(p, a, n), sq = side(q, a, n); return (i > 0 && Math.abs(sp - lo) < 1e-6 && Math.abs(sq - lo) < 1e-6) || (i < k - 1 && Math.abs(sp - hi) < 1e-6 && Math.abs(sq - hi) < 1e-6); });
      const c = centroid(pts), pc = map(c);
      const pu = map([c[0] + P.m[0] * dl, c[1] + P.m[1] * dl]), pv = map([c[0] + P.m[2] * dl, c[1] + P.m[3] * dl]);
      faces.push({
        id: P.id, z: P.z, tags: P.tags, pts3: pts.map(map), c3: pc, uv: mApply(inv, c[0], c[1]), sgn: Math.sign(mDet(P.m)) || 1, moving: true, skip,
        Eu: [(pu[0] - pc[0]) / dl, (pu[1] - pc[1]) / dl, (pu[2] - pc[2]) / dl], Ev: [(pv[0] - pc[0]) / dl, (pv[1] - pc[1]) / dl, (pv[2] - pc[2]) / dl],
        lift: Math.abs(pc[2]),
      });
    }
  }
  return faces;
}

export function flatFaces(state) { return state.polys.map((P) => flatFace(P, { moving: false })); }

// Faces for a pose (the finished model standing up): `hinges` = [{ a, n, tag, angle, kind }], innermost first. Each hinge rigidly swings the
// layers carrying `tag` about the fold line (a, n: n points at the side those layers came from) from flat-folded (angle PI) to `angle`.
export function poseFaces(state, hinges, k = 1) {
  let faces = flatFaces(state);
  for (const h of hinges) {
    const sigma = h.kind === 'mountain' ? -1 : 1, t = [-h.n[1], h.n[0]];
    const open = Math.PI - (Math.PI - h.angle) * k;
    const rot = rotAxis(h.a, t, sigma * (Math.PI - open));
    faces = faces.map((F) => (F.tags.includes(h.tag) ? { ...faceXform(F, rot), posed: true } : F));
  }
  return faces.map((F) => ({ ...F, posed: true }));
}

// Faces for the whole sheet turning over (psi 0..PI) around the vertical axis through x = 0.
export function turnFaces(state, psi) {
  const rot = (p) => [p[0] * Math.cos(psi) - p[2] * Math.sin(psi), p[1], p[0] * Math.sin(psi) + p[2] * Math.cos(psi)];
  return flatFaces(state).map((F) => faceXform(F, rot));
}

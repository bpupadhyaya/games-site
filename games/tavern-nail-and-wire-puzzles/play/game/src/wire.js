// Tavern Nail and Wire Puzzles: the rigid-wire engine. Pure and deterministic; no drawing here.
//
// Every piece is bent wire on a cubic lattice (straight runs between corner points). The FRAME is held still; each LOOSE piece
// can slide one lattice step along x, y or z, or turn a quarter about its grip point. A move is legal when the wires would
// not touch: exactly (lattice points) at the end of a slide or turn, and by sampled geometry (every 15 degrees) during a turn.
// The puzzle is solved when every loose piece has been carried clear of the frame (the boxes round them no longer overlap).

export const SLIDES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
// turn index: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z (quarter turns about the world axes through the grip point)
const TURN_MATS = [
  [1, 0, 0, 0, 0, -1, 0, 1, 0], [1, 0, 0, 0, 0, 1, 0, -1, 0],
  [0, 0, 1, 0, 1, 0, -1, 0, 0], [0, 0, -1, 0, 1, 0, 1, 0, 0],
  [0, -1, 0, 1, 0, 0, 0, 0, 1], [0, 1, 0, -1, 0, 0, 0, 0, 1],
];
const mul = (A, B) => {
  const o = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  return o;
};
export const ROT = [[1, 0, 0, 0, 1, 0, 0, 0, 1]];
{
  const seen = new Set([ROT[0].join()]);
  for (let i = 0; i < ROT.length; i++) for (const T of TURN_MATS) {
    const m = mul(T, ROT[i]), k = m.join();
    if (!seen.has(k)) { seen.add(k); ROT.push(m); }
  }
}
const ROT_AT = new Map(ROT.map((m, i) => [m.join(), i]));
// TURN_TO[o * 6 + k] = orientation after turn k from orientation o
export const TURN_TO = new Int8Array(ROT.length * 6);
ROT.forEach((m, o) => TURN_MATS.forEach((T, k) => { TURN_TO[o * 6 + k] = ROT_AT.get(mul(T, m).join()); }));
export const TURN_NAMES = ['+x', '-x', '+y', '-y', '+z', '-z'];

const OFF = 40, SPAN = 96;
export const key3 = (x, y, z) => ((x + OFF) * SPAN + (y + OFF)) * SPAN + (z + OFF);

// A shape def: { paths: [ { pts: [[x,y,z], ...], closed?: bool } ] } in the piece's own frame, grip point = origin.
// Corner points must differ along exactly one axis between neighbours.
const stepsOf = (p, q) => {
  const d = [Math.sign(q[0] - p[0]), Math.sign(q[1] - p[1]), Math.sign(q[2] - p[2])], n = Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2]);
  return { d, n };
};
export function prepare(def) {
  if (def._p) return def._p;
  const segs = [], pts = new Map(), units = [], joints = new Map();
  for (const path of def.paths) {
    for (const c of path.pts) joints.set(c.join(), c);
    const P = path.pts, n = P.length, last = path.closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = P[i], b = P[(i + 1) % n], { d, n: len } = stepsOf(a, b);
      if (len === 0) continue;
      segs.push([a[0], a[1], a[2], b[0], b[1], b[2]]);
      for (let k = 0; k <= len; k++) { const v = [a[0] + d[0] * k, a[1] + d[1] * k, a[2] + d[2] * k]; pts.set(v.join(), v); if (k < len) units.push([v[0], v[1], v[2], v[0] + d[0], v[1] + d[1], v[2] + d[2]]); }
    }
    if (n === 1) pts.set(P[0].join(), P[0]);
  }
  const verts = [...pts.values()];
  let R = 0;
  for (const v of verts) R = Math.max(R, Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]));
  // per-orientation rotated copies (lazy)
  const byO = new Array(ROT.length).fill(null);
  const at = (o) => {
    let c = byO[o];
    if (c) return c;
    const m = ROT[o], rv = verts.map((v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]);
    const rs = segs.map((s) => [m[0] * s[0] + m[1] * s[1] + m[2] * s[2], m[3] * s[0] + m[4] * s[1] + m[5] * s[2], m[6] * s[0] + m[7] * s[1] + m[8] * s[2],
      m[0] * s[3] + m[1] * s[4] + m[2] * s[5], m[3] * s[3] + m[4] * s[4] + m[5] * s[5], m[6] * s[3] + m[7] * s[4] + m[8] * s[5]]);
    const ru = units.map((s) => [m[0] * s[0] + m[1] * s[1] + m[2] * s[2], m[3] * s[0] + m[4] * s[1] + m[5] * s[2], m[6] * s[0] + m[7] * s[1] + m[8] * s[2],
      m[0] * s[3] + m[1] * s[4] + m[2] * s[5], m[3] * s[3] + m[4] * s[4] + m[5] * s[5], m[6] * s[3] + m[7] * s[4] + m[8] * s[5]]);
    const rj = [...joints.values()].map((v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]);
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const v of rv) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], v[a]); hi[a] = Math.max(hi[a], v[a]); }
    c = { verts: rv, segs: rs, units: ru, joints: rj, lo, hi };
    byO[o] = c;
    return c;
  };
  def._p = { verts, segs, R, at };
  return def._p;
}

// ---- world geometry of a posed piece ---------------------------------------------------------------------------------------
export const worldVerts = (def, pose) => { const c = prepare(def).at(pose.o); return c.verts.map((v) => [v[0] + pose.x, v[1] + pose.y, v[2] + pose.z]); };
export const worldSegs = (def, pose) => prepare(def).at(pose.o).segs.map((s) => [s[0] + pose.x, s[1] + pose.y, s[2] + pose.z, s[3] + pose.x, s[4] + pose.y, s[5] + pose.z]);
export function worldBox(def, pose) {
  const c = prepare(def).at(pose.o);
  return { lo: [c.lo[0] + pose.x, c.lo[1] + pose.y, c.lo[2] + pose.z], hi: [c.hi[0] + pose.x, c.hi[1] + pose.y, c.hi[2] + pose.z] };
}
export const boxesClear = (a, b) => { for (let i = 0; i < 3; i++) if (a.hi[i] < b.lo[i] || b.hi[i] < a.lo[i]) return true; return false; };

// ---- segment distance (float) ------------------------------------------------------------------------------------------------
function segDist(a, b) {
  const px = a[0], py = a[1], pz = a[2], ux = a[3] - px, uy = a[4] - py, uz = a[5] - pz;
  const qx = b[0], qy = b[1], qz = b[2], vx = b[3] - qx, vy = b[4] - qy, vz = b[5] - qz;
  const wx = px - qx, wy = py - qy, wz = pz - qz;
  const A = ux * ux + uy * uy + uz * uz, B = ux * vx + uy * vy + uz * vz, C = vx * vx + vy * vy + vz * vz, D = ux * wx + uy * wy + uz * wz, E = vx * wx + vy * wy + vz * wz;
  const den = A * C - B * B;
  let s, t, sN, tN, sD = den, tD = den;
  if (den < 1e-9) { sN = 0; sD = 1; tN = E; tD = C; }
  else {
    sN = B * E - C * D; tN = A * E - B * D;
    if (sN < 0) { sN = 0; tN = E; tD = C; } else if (sN > sD) { sN = sD; tN = E + B; tD = C; }
  }
  if (tN < 0) { tN = 0; if (-D < 0) sN = 0; else if (-D > A) sN = sD; else { sN = -D; sD = A; } }
  else if (tN > tD) { tN = tD; if (-D + B < 0) sN = 0; else if (-D + B > A) sN = sD; else { sN = -D + B; sD = A; } }
  s = Math.abs(sN) < 1e-12 ? 0 : sN / sD; t = Math.abs(tN) < 1e-12 ? 0 : tN / tD;
  const dx = wx + s * ux - t * vx, dy = wy + s * uy - t * vy, dz = wz + s * uz - t * vz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
export const WIRE_GAP = 0.36;   // wires closer than this (centre to centre) count as touching while a piece turns

// ---- the puzzle model ---------------------------------------------------------------------------------------------------------
// A puzzle: { frame: shapeDef (fixed at the origin), loose: [ { shape, pose: {o,x,y,z} } ] }.
// `Rules` holds the derived tables for one puzzle so slides/turns are cheap to test.
export function makeRules(puzzle) {
  const frame = puzzle.frame, fp = prepare(frame);
  const frameVerts = fp.verts;
  const frameKeys = new Set(frameVerts.map((v) => key3(v[0], v[1], v[2])));
  const frameSegs = fp.segs;
  const fb = worldBox(frame, { o: 0, x: 0, y: 0, z: 0 });
  const R = Math.max(...puzzle.loose.map((l) => prepare(l.shape).R));
  const lo = fb.lo.map((v) => v - R - 1), hi = fb.hi.map((v) => v + R + 1);
  return { puzzle, frameKeys, frameSegs, frameBox: fb, lo, hi, R };
}

// Lattice test: does `def` at `pose` touch anything in `blockKeys` (a Set) ?
function hitsKeys(def, pose, blockKeys) {
  const c = prepare(def).at(pose.o).verts;
  for (let i = 0; i < c.length; i++) if (blockKeys.has(key3(c[i][0] + pose.x, c[i][1] + pose.y, c[i][2] + pose.z))) return true;
  return false;
}
export function otherKeys(rules, poses, skip) {
  // keys of the frame plus every loose piece except `skip`
  const s = new Set(rules.frameKeys);
  rules.puzzle.loose.forEach((l, i) => {
    if (i === skip) return;
    for (const v of worldVerts(l.shape, poses[i])) s.add(key3(v[0], v[1], v[2]));
  });
  return s;
}
export function otherSegs(rules, poses, skip) {
  const out = rules.frameSegs.slice();
  rules.puzzle.loose.forEach((l, i) => { if (i !== skip) for (const s of worldSegs(l.shape, poses[i])) out.push(s); });
  return out;
}

export const inWindow = (rules, p) => p.x >= rules.lo[0] && p.x <= rules.hi[0] && p.y >= rules.lo[1] && p.y <= rules.hi[1] && p.z >= rules.lo[2] && p.z <= rules.hi[2];
export const poseKey = (p) => `${p.o}:${p.x},${p.y},${p.z}`;

// Slide: returns the new pose, or null when blocked. `blockKeys` from otherKeys().
export function trySlide(rules, shape, pose, dir, blockKeys) {
  const d = SLIDES[dir], np = { o: pose.o, x: pose.x + d[0], y: pose.y + d[1], z: pose.z + d[2] };
  if (!inWindow(rules, np)) return null;
  if (hitsKeys(shape, np, blockKeys)) return null;
  return np;
}

// Turn: quarter turn about the grip point. Checks the end pose (lattice) and the sweep (every 15 degrees, float).
// `segs` are the obstacle segments (otherSegs()).
const COS = [], SIN = [];
for (let k = 1; k < 6; k++) { COS.push(Math.cos((k * Math.PI) / 12)); SIN.push(Math.sin((k * Math.PI) / 12)); }
export function tryTurn(rules, shape, pose, turn, blockKeys, segs) {
  const no = TURN_TO[pose.o * 6 + turn], np = { o: no, x: pose.x, y: pose.y, z: pose.z };
  if (hitsKeys(shape, np, blockKeys)) return null;
  // sampled sweep: rotate the start-orientation segments about the world axis by k*15 degrees
  const cur = prepare(shape).at(pose.o).segs, ax = turn >> 1, sg = turn & 1 ? -1 : 1;
  const mv = new Array(cur.length);
  for (let k = 0; k < 5; k++) {
    const c = COS[k], s = SIN[k] * sg;
    for (let i = 0; i < cur.length; i++) {
      const q = cur[i], o = new Array(6);
      for (let e = 0; e < 6; e += 3) {
        const x = q[e], y = q[e + 1], z = q[e + 2];
        let X = x, Y = y, Z = z;
        if (ax === 0) { Y = y * c - z * s; Z = y * s + z * c; } else if (ax === 1) { X = x * c + z * s; Z = -x * s + z * c; } else { X = x * c - y * s; Y = x * s + y * c; }
        o[e] = X + pose.x; o[e + 1] = Y + pose.y; o[e + 2] = Z + pose.z;
      }
      mv[i] = o;
    }
    for (let i = 0; i < mv.length; i++) {
      const a = mv[i];
      const alo0 = Math.min(a[0], a[3]) - WIRE_GAP, ahi0 = Math.max(a[0], a[3]) + WIRE_GAP, alo1 = Math.min(a[1], a[4]) - WIRE_GAP, ahi1 = Math.max(a[1], a[4]) + WIRE_GAP, alo2 = Math.min(a[2], a[5]) - WIRE_GAP, ahi2 = Math.max(a[2], a[5]) + WIRE_GAP;
      for (let j = 0; j < segs.length; j++) {
        const b = segs[j];
        if (Math.max(b[0], b[3]) < alo0 || Math.min(b[0], b[3]) > ahi0 || Math.max(b[1], b[4]) < alo1 || Math.min(b[1], b[4]) > ahi1 || Math.max(b[2], b[5]) < alo2 || Math.min(b[2], b[5]) > ahi2) continue;
        if (segDist(a, b) < WIRE_GAP) return null;
      }
    }
  }
  return np;
}

// Is a loose piece clear of the frame (the boxes no longer overlap)?
export const isClear = (rules, shape, pose) => boxesClear(worldBox(shape, pose), rules.frameBox);

// ---- search (used by the level builder, the tests, and Think) -------------------------------------------------------------
// Breadth-first over one loose piece's poses with the rest held still. Returns the shortest move list to a clear pose, or null.
// A move is { k: 's'|'t', i: 0..5 }.
export function solveOne(rules, idx, poses, { limit = 400000, goal = null } = {}) {
  const shape = rules.puzzle.loose[idx].shape;
  const blockKeys = otherKeys(rules, poses, idx), segs = otherSegs(rules, poses, idx);
  const W0 = rules.lo, nx = rules.hi[0] - W0[0] + 1, ny = rules.hi[1] - W0[1] + 1, nz = rules.hi[2] - W0[2] + 1;
  const enc = (p) => (((p.o * nx + (p.x - W0[0])) * ny + (p.y - W0[1])) * nz + (p.z - W0[2]));
  const total = ROT.length * nx * ny * nz;
  const par = new Int32Array(total).fill(-2), how = new Int8Array(total);
  const dec = (e) => { const z = e % nz; e = (e - z) / nz; const y = e % ny; e = (e - y) / ny; const x = e % nx; const o = (e - x) / nx; return { o, x: x + W0[0], y: y + W0[1], z: z + W0[2] }; };
  const start = enc(poses[idx]);
  par[start] = -1;
  const q = [start];
  let head = 0, seen = 1;
  while (head < q.length) {
    const e = q[head++], p = dec(e);
    if (goal ? goal(p) : isClear(rules, shape, p)) {
      const out = [];
      for (let c = e; par[c] >= 0; c = par[c]) out.push(how[c]);
      out.reverse();
      return { moves: out.map((h) => (h < 6 ? { k: 's', i: h } : { k: 't', i: h - 6 })), states: seen, end: p };
    }
    for (let h = 0; h < 12; h++) {
      const np = h < 6 ? trySlide(rules, shape, p, h, blockKeys) : tryTurn(rules, shape, p, h - 6, blockKeys, segs);
      if (!np) continue;
      const ne = enc(np);
      if (par[ne] !== -2) continue;
      par[ne] = e; how[ne] = h; q.push(ne); seen += 1;
      if (seen > limit) return null;
    }
  }
  return null;
}

// Every pose reachable from the start (for the level builder's statistics).
export function reachable(rules, idx, poses, limit = 600000) {
  const shape = rules.puzzle.loose[idx].shape;
  const blockKeys = otherKeys(rules, poses, idx), segs = otherSegs(rules, poses, idx), seen = new Map();
  const dist = new Map(), q = [poses[idx]];
  dist.set(poseKey(poses[idx]), 0);
  let head = 0;
  while (head < q.length) {
    const p = q[head++], d = dist.get(poseKey(p));
    for (let h = 0; h < 12; h++) {
      const np = h < 6 ? trySlide(rules, shape, p, h, blockKeys) : tryTurn(rules, shape, p, h - 6, blockKeys, segs);
      if (!np) continue;
      const k = poseKey(np);
      if (dist.has(k)) continue;
      dist.set(k, d + 1); q.push(np);
      if (q.length > limit) return { dist, capped: true };
    }
  }
  void seen;
  return { dist, capped: false };
}

// Distance-to-clear for every pose connected to `from` (used by the level builder to find the hardest starting pose).
export function depthField(rules, idx, poses, from, limit = 900000) {
  const shape = rules.puzzle.loose[idx].shape;
  const blockKeys = otherKeys(rules, poses, idx), segs = otherSegs(rules, poses, idx);
  const comp = new Map(), q = [from];
  comp.set(poseKey(from), from);
  for (let head = 0; head < q.length; head++) {
    const p = q[head];
    for (let h = 0; h < 12; h++) {
      const np = h < 6 ? trySlide(rules, shape, p, h, blockKeys) : tryTurn(rules, shape, p, h - 6, blockKeys, segs);
      if (!np) continue;
      const k = poseKey(np);
      if (comp.has(k)) continue;
      comp.set(k, np); q.push(np);
      if (q.length > limit) return null;
    }
  }
  const dist = new Map(), q2 = [];
  for (const [k, p] of comp) if (isClear(rules, shape, p)) { dist.set(k, 0); q2.push(p); }
  for (let head = 0; head < q2.length; head++) {
    const p = q2[head], d = dist.get(poseKey(p));
    for (let h = 0; h < 12; h++) {
      const np = h < 6 ? trySlide(rules, shape, p, h, blockKeys) : tryTurn(rules, shape, p, h - 6, blockKeys, segs);
      if (!np) continue;
      const k = poseKey(np);
      if (dist.has(k)) continue;
      dist.set(k, d + 1); q2.push(np);
    }
  }
  return { dist, comp };
}

export const applyMove = (rules, shape, pose, mv, blockKeys, segs) => (mv.k === 's' ? trySlide(rules, shape, pose, mv.i, blockKeys) : tryTurn(rules, shape, pose, mv.i, blockKeys, segs));

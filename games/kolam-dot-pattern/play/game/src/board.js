// The Kolam board model: a set of dots (pulli) on a lattice, the arcs that wrap each dot, and the gates between neighbouring dots.
// Pure data and maths (no drawing). The solver, the trail and the views are all built on this.
//
// Each dot has D gates around it (4 on square and diamond lattices, 6 on the staggered lattice), one toward each neighbour position;
// a gate sits halfway to the neighbour. A dot's gates are joined by D arcs (arc k runs from gate k to gate k+1, counter-clockwise
// on the screen); every arc must be part of the line, so every dot ends up wrapped. A gate between two dots has four arc ends (two
// from each dot) and the line joins them in pairs. There are three ways to do it:
//   state 0 "hug":   each line bends round its own dot (the two lines just kiss),
//   state 1 "cross": the lines pass between the two dots and cross each other diagonally,
//   state 2 "cup":   each line dips into the gap and turns back up on its own side, like a U.
// A gate on the outside edge has only one dot and is always "hug". The shape of an arc depends on the states of the gates at its two
// ends (arcCurve), so every solution is a different smooth pattern.

export const LATTICES = {
  sq: { D: 4, dirs: [[1, 0], [0, 1], [-1, 0], [0, -1]], pos: (u, v) => [u, v], rot: 0 },
  di: { D: 4, dirs: [[1, 0], [0, 1], [-1, 0], [0, -1]], pos: (u, v) => [u, v], rot: Math.PI / 4 },
  hx: { D: 6, dirs: [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]], pos: (u, v) => [u + v / 2, v * 0.8660254037844386], rot: 0 },
};

const cache = new Map();

export function specKey(spec) { return `${spec.lat}:${spec.dots.map((d) => d.join(',')).join(';')}`; }

// spec = { lat: 'sq'|'di'|'hx', dots: [[u, v], ...] }  (dots sorted by v then u)
export function buildBoard(spec) {
  const key = specKey(spec);
  const hit = cache.get(key);
  if (hit) return hit;
  const L = LATTICES[spec.lat];
  const D = L.D;
  const dots = spec.dots.map(([u, v]) => ({ u, v, x: 0, y: 0 }));
  const cs = Math.cos(L.rot), sn = Math.sin(L.rot);
  for (const d of dots) {
    const [px, py] = L.pos(d.u, d.v);
    d.x = px * cs - py * sn; d.y = px * sn + py * cs;
  }
  const index = new Map(dots.map((d, i) => [`${d.u},${d.v}`, i]));
  const ang = L.dirs.map(([du, dv]) => {
    const [px, py] = L.pos(du, dv);
    return Math.atan2(px * sn + py * cs, px * cs - py * sn);
  });
  const nArc = dots.length * D;
  const arcs = new Array(nArc);
  const gates = [];
  const gateIndex = new Map();
  const gateAt = new Array(dots.length * D);
  dots.forEach((d, i) => {
    for (let k = 0; k < D; k++) {
      const [du, dv] = L.dirs[k];
      const j = index.get(`${d.u + du},${d.v + dv}`);
      let gid;
      if (j === undefined) {
        gid = gates.length;
        gates.push({ i, k, j: -1, kj: -1, x: d.x + 0.5 * Math.cos(ang[k]), y: d.y + 0.5 * Math.sin(ang[k]), ghost: true });
      } else {
        const kj = (k + D / 2) % D;
        const key2 = i < j ? `${i}|${j}` : `${j}|${i}`;
        if (gateIndex.has(key2)) gid = gateIndex.get(key2);
        else {
          gid = gates.length;
          gateIndex.set(key2, gid);
          const a = i < j ? { i, k, j, kj } : { i: j, k: kj, j: i, kj: k };
          gates.push({ ...a, x: (dots[a.i].x + dots[a.j].x) / 2, y: (dots[a.i].y + dots[a.j].y) / 2, ghost: false });
        }
      }
      gateAt[i * D + k] = gid;
    }
  });
  // nodes: node = arc * 2 + end (0 = the gate the arc starts at, 1 = the gate it ends at)
  dots.forEach((d, i) => {
    for (let k = 0; k < D; k++) {
      const a0 = ang[k];
      arcs[i * D + k] = { dot: i, k, cx: d.x, cy: d.y, a0, a1: a0 + (Math.PI * 2) / D, g0: gateAt[i * D + k], g1: gateAt[i * D + ((k + 1) % D)] };
    }
  });
  for (const g of gates) {
    const ai = g.i * D + g.k, mi = g.i * D + ((g.k - 1 + D) % D);
    g.pi = ai * 2; g.mi = mi * 2 + 1; // P: the arc of dot i that starts here; M: the arc of dot i that ends here
    if (g.ghost) { g.pj = -1; g.mj = -1; } else { g.pj = (g.j * D + g.kj) * 2; g.mj = (g.j * D + ((g.kj - 1 + D) % D)) * 2 + 1; }
    g.nodes = g.ghost ? [g.pi, g.mi] : [g.pi, g.mi, g.pj, g.mj];
    // u points from dot i out through the gate; n is u turned a quarter. The +n side holds P(i) and M(j).
    const di = dots[g.i];
    let ux = g.x - di.x, uy = g.y - di.y;
    const ul = Math.hypot(ux, uy); ux /= ul; uy /= ul;
    g.ux = ux; g.uy = uy; g.nx = -uy; g.ny = ux;
  }
  for (const a of arcs) {
    const g0 = gates[a.g0], g1 = gates[a.g1];
    a.r0 = a.dot === g0.i ? 0 : 2; // role at the start gate: 0 = P(i), 2 = P(j)
    a.r1 = a.dot === g1.i ? 1 : 3; // role at the end gate: 1 = M(i), 3 = M(j)
    const m = (a.a0 + a.a1) / 2; a.mx = a.cx + 0.5 * Math.cos(m); a.my = a.cy + 0.5 * Math.sin(m);
  }
  const gateOfNode = new Array(nArc * 2);
  gates.forEach((g, gi) => { for (const n of g.nodes) gateOfNode[n] = gi; });
  const free = [];
  gates.forEach((g, gi) => { if (!g.ghost) free.push(gi); });
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const d of dots) { minX = Math.min(minX, d.x - 0.5); maxX = Math.max(maxX, d.x + 0.5); minY = Math.min(minY, d.y - 0.5); maxY = Math.max(maxY, d.y + 0.5); }
  const B = { spec, lat: spec.lat, D, dots, arcs, gates, gateOfNode, free, nArc, bounds: { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  if (cache.size > 80) cache.clear();
  cache.set(key, B);
  return B;
}

// roles: 0 P(i), 1 M(i), 2 P(j), 3 M(j). What each role is joined to under hug, cross and cup.
const JOIN = [[1, 0, 3, 2], [2, 3, 0, 1], [3, 2, 1, 0]];
export const PAIRS = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
export const STATE_NAMES = ['hug', 'cross', 'cup'];

// The node a line is joined to inside a gate, for a gate state. -1 when the node is not at this gate.
export function partnerNode(g, node, state) {
  const r = node === g.pi ? 0 : node === g.mi ? 1 : node === g.pj ? 2 : node === g.mj ? 3 : -1;
  if (r < 0) return -1;
  const q = JOIN[g.ghost ? 0 : state][r];
  return q === 0 ? g.pi : q === 1 ? g.mi : q === 2 ? g.pj : g.mj;
}

// Direction a line leaves a gate along an arc end, in the gate's (u, n) frame, by role and state.
const R2 = Math.SQRT1_2;
const LEAVE = [
  [[0, 1], [-R2, R2], [-1, 0]], // P(i)
  [[0, -1], [-R2, -R2], [-1, 0]], // M(i)
  [[0, -1], [R2, -R2], [1, 0]], // P(j)
  [[0, 1], [R2, R2], [1, 0]], // M(j)
];
export function leaveDir(g, role, state) {
  const v = LEAVE[role][g.ghost ? 0 : state];
  return [g.ux * v[0] + g.nx * v[1], g.uy * v[0] + g.ny * v[1]];
}

export const HANDLE = 0.42;
// The cubic Bezier [x0,y0,c1x,c1y,c2x,c2y,x1,y1] (unit coordinates) of arc `a` for the states of the gates at its two ends.
export function arcCurve(B, a, s0, s1) {
  const g0 = B.gates[a.g0], g1 = B.gates[a.g1];
  const d0 = leaveDir(g0, a.r0, s0), d1 = leaveDir(g1, a.r1, s1);
  const h = Math.hypot(g1.x - g0.x, g1.y - g0.y) * HANDLE;
  return [g0.x, g0.y, g0.x + d0[0] * h, g0.y + d0[1] * h, g1.x + d1[0] * h, g1.y + d1[1] * h, g1.x, g1.y];
}
export function bezPoint(c, t) {
  const m = 1 - t, a = m * m * m, b = 3 * m * m * t, d = 3 * m * t * t, e = t * t * t;
  return [a * c[0] + b * c[2] + d * c[4] + e * c[6], a * c[1] + b * c[3] + d * c[5] + e * c[7]];
}

// Follows the closed lines for a full set of gate states (states[g] in {0, 1, 2}); returns the loops as arrays of arc ids.
export function loopsOf(B, states) {
  const seen = new Uint8Array(B.nArc);
  const loops = [];
  for (let s = 0; s < B.nArc; s++) {
    if (seen[s]) continue;
    const loop = [];
    let arc = s, end = 1;
    for (;;) {
      seen[arc] = 1; loop.push(arc);
      const node = arc * 2 + end;
      const gi = B.gateOfNode[node], g = B.gates[gi];
      const p = partnerNode(g, node, g.ghost ? 0 : states[gi]);
      arc = p >> 1; end = 1 - (p & 1);
      if (arc === s || seen[arc]) break;
    }
    loops.push(loop);
  }
  return loops;
}

// The first closed line as an ordered walk: [{ arc, dir }] (dir 0 runs from the arc's start gate to its end gate, 1 the other way).
export function loopSeq(B, states) {
  const out = [];
  let arc = 0, dir = 0;
  for (let guard = 0; guard <= B.nArc; guard++) {
    out.push({ arc, dir });
    const node = arc * 2 + (1 - dir);
    const gi = B.gateOfNode[node], g = B.gates[gi];
    const p = partnerNode(g, node, g.ghost ? 0 : states[gi]);
    arc = p >> 1; dir = (p & 1) === 0 ? 0 : 1;
    if (arc === 0 && dir === 0) break;
    if (out.length >= B.nArc) break;
  }
  return out;
}

export const isOneLoop = (B, states) => loopsOf(B, states).length === 1;

export function rectDots(w, h) { const d = []; for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) d.push([u, v]); return d; }
export function hexDots(r) {
  const d = [];
  for (let v = -r + 1; v <= r - 1; v++) for (let u = -r + 1; u <= r - 1; u++) if (Math.abs(u + v) <= r - 1) d.push([u, v]);
  return sortDots(d);
}
export function sortDots(d) { return d.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]); }
export function triDots(n) { const d = []; for (let v = 0; v < n; v++) for (let u = 0; u < n - v; u++) d.push([u, v]); return d; }

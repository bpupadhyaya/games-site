// handmesh.js: the menko player's right hand + forearm as ONE smooth, anatomically measured surface, modelled in this file (no downloaded
// mesh), posed for the two moments of a menko throw, then meshed once at load (surface nets over a signed-distance model, refined onto
// the surface, normals from the field gradient), so there are no facets, seams, holes or loose finger tips.
// Adapted from the Morra modeller (games/mo/morra/design/bake/handmodel.js, itself from the Kantha hand): same measured anatomy (cm: hand
// 17.6 long, palm 9.4 x 7.6, index 3.9/2.25/1.55, middle 4.3/2.65/1.65, ring 4.0/2.5/1.6, little 3.15/1.85/1.45, thumb metacarpal 4.4 +
// 3.1/2.4, thenar pad, thumb-index web, oval forearm tapering inside the palm), skin shading (darker back, lighter palm, warm tips, full-
// field occlusion, wrapped red-shifted diffuse), skin-toned nails laid on the exact field, and Morra's four fixes (no shading steps, no
// buried nails, no floating nail corners, no wrist ridge).
// Menko poses:
//   GRIP  the overhand hold: the hand hangs over the disc's near edge, the thumb pad presses on its top face and the curled index pad
//         holds it from underneath (thumb and index curl SOLVED together so the pads meet across the disc's thickness); the other fingers
//         fold in a relaxed cascade, the forearm rises steeply behind (ready for the downward snap).
//   FLAT  the release / slap: an open, relaxed palm (fingers long with a touch of natural flex, slightly fanned, thumb relaxed out).
//
// Frame (the hand's own, cm while modelling, metres in the geometry): origin at the wrist centre, +X toward the fingers (along the
// middle metacarpal), +Y the back of the hand, +Z the little-finger side. A right hand.
import * as THREE from '../vendor3d/three.js';

// ---- small vector helpers on [x, y, z] arrays -------------------------------------------------------------------------------------------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / (len(a) || 1));
const mad = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
function rot(v, axis, ang) {   // Rodrigues, axis unit
  const c = Math.cos(ang), s = Math.sin(ang), k = axis, kv = cross(k, v), kd = dot(k, v);
  return [v[0] * c + kv[0] * s + k[0] * kd * (1 - c), v[1] * c + kv[1] * s + k[1] * kd * (1 - c), v[2] * c + kv[2] * s + k[2] * kd * (1 - c)];
}
const D = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function smin(a, b, k) { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }

// ---- primitives -------------------------------------------------------------------------------------------------------------------------
// round cone (two spheres joined by their tangent cone), after Inigo Quilez
function roundCone(a, b, r1, r2, info = {}) {
  const ba = sub(b, a), l2 = dot(ba, ba), rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pr = Math.max(r1, r2);
  return {
    ...info, a, b, r1, r2, axis: norm(ba), L: Math.sqrt(l2),
    box: [Math.min(a[0], b[0]) - pr, Math.min(a[1], b[1]) - pr, Math.min(a[2], b[2]) - pr, Math.max(a[0], b[0]) + pr, Math.max(a[1], b[1]) + pr, Math.max(a[2], b[2]) + pr],
    d(px, py, pz) {
      const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
      const y = pax * ba[0] + pay * ba[1] + paz * ba[2], z = y - l2;
      const xx = pax * l2 - ba[0] * y, xy = pay * l2 - ba[1] * y, xz = paz * l2 - ba[2] * y;
      const x2 = xx * xx + xy * xy + xz * xz, y2 = y * y * l2, z2 = z * z * l2;
      const k = Math.sign(rr) * rr * rr * x2;
      if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
      if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
      return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
    },
  };
}
// ellipsoid with its own axes u, v, w (unit, orthogonal) and radii
function ellipsoid(c, u, v, w, rx, ry, rz, info = {}) {
  const m = Math.max(rx, ry, rz);
  return {
    ...info, c, u, v, w, box: [c[0] - m, c[1] - m, c[2] - m, c[0] + m, c[1] + m, c[2] + m],
    d(px, py, pz) {
      const qx = px - c[0], qy = py - c[1], qz = pz - c[2];
      const a = (qx * u[0] + qy * u[1] + qz * u[2]), b = (qx * v[0] + qy * v[1] + qz * v[2]), e = (qx * w[0] + qy * w[1] + qz * w[2]);
      const k0 = Math.hypot(a / rx, b / ry, e / rz), k1 = Math.hypot(a / (rx * rx), b / (ry * ry), e / (rz * rz));
      return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
    },
  };
}
const sphere = (c, r, info) => roundCone(c, add(c, [1e-4, 0, 0]), r, r, info);
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

// ---- the model ----------------------------------------------------------------------------------------------------------------------------
// Same adult anatomy as the Kantha / Morra hands (cm). Each pose gives every finger its three flexion angles; a finger with `out` false is
// modelled as curled (rolled-out joint knuckles, tighter blend). The thumb is either fixed (relaxed, open) or SOLVED (5 joint angles) so its
// pad presses up under the disc right below the finger pads, with skin-contact and disc-penetration terms.
const FINGERS = [   // MCP head (cm), splay (deg, + toward the little finger), segment lengths, radii at MCP / PIP / DIP / tip
  { name: 'index', mcp: [9.0, 0.15, -2.5], splay: -5, L: [3.9, 2.25, 1.55], r: [0.9, 0.79, 0.69, 0.6] },
  { name: 'middle', mcp: [9.45, 0.25, -0.72], splay: 1, L: [4.3, 2.65, 1.65], r: [0.93, 0.81, 0.71, 0.61] },
  { name: 'ring', mcp: [9.05, 0.1, 1.02], splay: 6, L: [4.0, 2.5, 1.6], r: [0.88, 0.77, 0.67, 0.57] },
  { name: 'little', mcp: [8.15, -0.2, 2.6], splay: 12, L: [3.15, 1.85, 1.45], r: [0.77, 0.67, 0.59, 0.51] },
];
const WRIST_DEV = 0;

function fingerChain(F, flex, splay) {
  const a = splay * D, dir0 = [Math.cos(a), 0, Math.sin(a)];
  const L = norm(cross(Y, dir0));   // flexion axis: +angle bends toward the palm
  const joints = [F.mcp], dirs = [], dorsals = [];
  let ang = 0, p = F.mcp;
  for (let s = 0; s < 3; s++) {
    ang += flex[s] * D;
    const d = rot(dir0, L, ang), dor = rot(Y, L, ang);
    dirs.push(d); dorsals.push(dor);
    p = add(p, mul(d, s === 2 ? F.L[2] * 0.8 : F.L[s])); joints.push(p);
  }
  return { joints, dirs, dorsals, L, radial: mul(L, 1) };
}

function thumbChain(t) {
  const B = [3.0, -1.3, -2.1], Lm = 4.4, Lp = 3.1, Ld = 2.4;
  const dm = norm(add(mul(X, Math.cos(t.a)), mul(add(mul(Z, -Math.cos(t.b)), mul(Y, -Math.sin(t.b))), Math.sin(t.a))));
  const yp = norm(sub(Y, mul(dm, dot(Y, dm))));
  const Dt = rot(yp, dm, t.c), Lt = norm(cross(Dt, dm));
  const d1 = rot(dm, Lt, t.f1), d2 = rot(dm, Lt, t.f1 + t.f2);
  const P1 = mad(B, dm, Lm), P2 = mad(P1, d1, Lp), P3 = mad(P2, d2, Ld * 0.8);
  const dor2 = rot(Dt, Lt, t.f1 + t.f2), dor1 = rot(Dt, Lt, t.f1);
  return { joints: [B, P1, P2, P3], dirs: [dm, d1, d2], dorsals: [Dt, dor1, dor2], L: Lt, Ld };
}
const padPoint = (ch, Ld, r) => mad(mad(ch.joints[2], ch.dirs[2], Ld * 0.5), ch.dorsals[2], -r * 0.98);
const THUMB_R = [[1.22, 0.96], [0.93, 0.85], [0.85, 0.74]];

// flex: per finger [MCP, PIP, DIP] (deg); spread: per finger splay offset (deg); wrist: palmar flexion (deg); out[0] thumb open, out[1..4] straight
export const POSES = {
  grip: {
    name: 'grip', out: [false, true, true, true, false], wrist: 16,
    flex: [[30, 36, 14], [34, 44, 16], [46, 60, 28], [56, 72, 38]], spread: [-2, 0, 3, 8],
  },
  flat: {
    name: 'flat', out: [true, true, true, true, true], wrist: 22,
    flex: [[7, 9, 5], [6, 9, 4], [8, 11, 6], [11, 14, 8]], spread: [-5, 1, 5, 11],
    thumb: { a: 0.5, b: 0.55, c: -0.95, f1: 0.14, f2: 0.04 },
  },
};
// the forearm's proximal direction (unit, hand frame) for a pose: what a sleeve is fitted along
export const forearmAxis = (pose) => new THREE.Vector3(...norm(rot(rot([-1, 0, 0], Z, -(pose.wrist || 0) * D), Y, -WRIST_DEV)));
// GRIP: solve the thumb (5 angles) and the index curl (MCP, PIP) together so the thumb pad meets the index pad ACROSS THE DISC (gap = the
// disc's thickness), pads facing each other, every angle near a relaxed pinch (after the Kantha needle pinch). The disc lies between the
// pads: its normal is the index pad's normal, it runs out from the pinch along the fingers.
function solvePinch(gap) {
  const F0 = FINGERS[0], iLd = F0.L[2], ir = F0.r[2];
  const prior = { a: 0.8, b: 0.9, c: -1.0, f1: 0.3, f2: 0.25, i1: 30 * D, i2: 36 * D };
  const range = { a: [0.25, 1.35], b: [0.1, 1.5], c: [-2.2, 0.4], f1: [-0.1, 0.95], f2: [-0.35, 1.0], i1: [12 * D, 62 * D], i2: [16 * D, 70 * D] };
  const idx = (q) => fingerChain(F0, [q.i1 / D, q.i2 / D, q.i2 / D * 0.38], F0.splay * 0.5 - 2);
  const padOf = (ch) => {
    const palmar = mul(ch.dorsals[2], -1), n = norm(add(mul(palmar, 0.85), mul(ch.L, 0.5)));
    return { n, Pi: mad(mad(ch.joints[2], ch.dirs[2], iLd * 0.55), n, ir * 0.97) };
  };
  const t = { ...prior };
  const E = (q) => {
    const ic = idx(q), { n, Pi } = padOf(ic), T = mad(Pi, n, gap);
    const ch = thumbChain(q), Pt = padPoint(ch, 2.4, 0.86), tp = mul(ch.dorsals[2], -1);
    let e = 60 * dot(sub(Pt, T), sub(Pt, T)) + 6 * dot(add(tp, n), add(tp, n));
    for (const k of Object.keys(prior)) e += 0.6 * ((q[k] - prior[k]) / (range[k][1] - range[k][0])) ** 2;
    const dd = len(sub(ch.joints[2], ic.joints[2]));   // keep the thumb's IP joint clear of the index DIP
    if (dd < 2.0) e += 10 * (2.0 - dd) ** 2;
    return e;
  };
  let best = E(t), step = 0.25;
  for (let it = 0; it < 900 && step > 1e-4; it++) {
    let moved = false;
    for (const k of Object.keys(prior)) for (const s of [1, -1]) {
      const q = { ...t, [k]: clamp(t[k] + s * step, range[k][0], range[k][1]) }, e = E(q);
      if (e < best) { best = e; Object.assign(t, q); moved = true; }
    }
    if (!moved) step *= 0.5;
  }
  const ch = thumbChain(t), ic = idx(t), { Pi, n } = padOf(ic), Pt = padPoint(ch, 2.4, 0.86);
  const up = n, dirI = ic.dirs[1];   // the thumb presses on the disc's top face, the index pad holds it from underneath
  const f = norm(sub(dirI, mul(up, dot(dirI, up))));
  return { t, flex: [t.i1 / D, t.i2 / D, t.i2 / D * 0.38], err: len(sub(Pt, mad(Pi, n, gap))),
    card: { n: up, point: mad(Pi, n, gap / 2), f, cardCm: gap, top: Pi } };
}

// thumb angles for a pose: fixed for an open thumb, else solved against the field of the rest of the hand
function solveThumb(pose, chains, fieldNoThumb, opts) {
  return pose.out[0] ? { t: { ...pose.thumb, ...(opts.thumbOpen || {}) }, err: 0 } : pose.pinch;
}

function buildModel(pose, opts = {}) {
  const core = [], fingers = [], distal = [];
  // forearm frame: the forearm leaves the wrist backward, nearly straight (a thrown hand)
  const fa = norm(rot(rot([-1, 0, 0], Z, -(pose.wrist || 0) * D), Y, -WRIST_DEV));   // proximal direction
  const fy = norm(sub(Y, mul(fa, dot(Y, fa)))), fz = norm(cross(fa, fy));
  const forearm = {
    tag: 'arm', dorsal: fy, box: [-17, -5, -5, 2, 9, 5],
    d(px, py, pz) {
      const s = px * fa[0] + py * fa[1] + pz * fa[2];   // distance up the arm
      const qy = px * fy[0] + py * fy[1] + pz * fy[2], qz = px * fz[0] + py * fz[1] + pz * fz[2];
      const t = sstep(0.5, 13, s), pinch = sstep(0.6, -4.6, s), ry = (1.72 + 1.2 * t) * (1 - 0.5 * pinch), rz = (2.5 + 1.05 * t) * (1 - 0.42 * pinch);
      const yo = 0.15 * t;
      const k0 = Math.hypot(qy - yo, qz) > 0 ? Math.hypot((qy - yo) / ry, qz / rz) : 0, k1 = Math.hypot((qy - yo) / (ry * ry), qz / (rz * rz));
      const de = k1 < 1e-9 ? -Math.min(ry, rz) : (k0 * (k0 - 1)) / k1;
      // the arm tapers away inside the palm, and its wrist end is rounded (smooth max), not a flat cap: with the wrist flexed the cap's
      // sharp edge showed as a torn crease across the heel of the palm
      return Math.max(-smin(-de, s + 4.6, 1.2), s - 16.5);
    },
  };
  core.push({ p: forearm, k: 0 });
  core.push({ p: sphere(add(mul(fa, 1.3), add(mul(fy, 0.75), mul(fz, 1.95))), 0.5, { tag: 'arm', dorsal: fy }), k: 0.9 });   // ulna head
  core.push({ p: ellipsoid([1.0, -0.05, 0.05], X, Y, Z, 2.0, 1.5, 2.6, { tag: 'palm', dorsal: Y }), k: 1.6 });
  core.push({ p: ellipsoid([5.0, -0.1, 0.05], X, Y, Z, 4.3, 1.12, 3.25, { tag: 'palm', dorsal: Y }), k: 1.0 });
  core.push({ p: ellipsoid([4.0, -0.82, 2.15], X, Y, Z, 3.3, 1.05, 1.15, { tag: 'palm', dorsal: Y }), k: 1.0 });   // hypothenar
  core.push({ p: ellipsoid([8.0, -0.72, -0.05], X, Y, Z, 1.35, 0.92, 3.45, { tag: 'palm', dorsal: Y }), k: 0.9 });   // pads under the knuckles
  const bases = [[1.7, 0.45, -1.3], [1.7, 0.55, -0.35], [1.7, 0.45, 0.55], [1.6, 0.3, 1.4]];
  if (!pose.out[0]) { pose = { ...pose, pinch: solvePinch(opts.cardCm ?? 0.9) }; pose.flex = [pose.pinch.flex, ...pose.flex.slice(1)]; }
  const chains = FINGERS.map((F, i) => fingerChain(F, pose.flex[i], F.splay * (pose.out[i + 1] ? 0.5 : 0.4) + pose.spread[i]));
  FINGERS.forEach((F, i) => {
    core.push({ p: roundCone(bases[i], F.mcp, 0.72, F.r[0] * 0.98, { tag: 'palm', dorsal: Y }), k: 0.9 });
    // knuckle heads: more prominent when the finger is curled (the metacarpal head rolls out on the back of the fist)
    core.push({ p: sphere(add(F.mcp, pose.out[i + 1] ? [0.05, 0.42, 0] : [0.25, 0.5, 0]), F.r[0] * (pose.out[i + 1] ? 0.66 : 0.8), { tag: 'knuckle', dorsal: Y }), k: 0.5 });
  });
  FINGERS.forEach((F, i) => {
    const ch = chains[i], J = ch.joints, list = [];
    const segR = [[F.r[0], F.r[1] * 0.99], [F.r[1] * 0.98, F.r[2] * 0.98], [F.r[2] * 0.98, F.r[3]]];
    const out = pose.out[i + 1];
    for (let s = 0; s < 3; s++) list.push({ p: roundCone(J[s], J[s + 1], segR[s][0], segR[s][1], { tag: s === 2 ? 'tip' : 'finger', seg: s, finger: i, dorsal: ch.dorsals[s], axis: ch.dirs[s], start: J[s], L: s === 2 ? F.L[2] : F.L[s] }), k: out ? 0.1 : 0.28 });
    // joint knuckles only on curled fingers (there the joint rolls out on the back); a straight finger's joints are just the shaft's own
    // gentle swell, and an extra sphere blended into it read as beads
    if (!out) {
      list.push({ p: sphere(mad(J[1], ch.dorsals[0], 0.06), F.r[1] * 0.86, { tag: 'knuckle', finger: i, dorsal: ch.dorsals[1] }), k: 0.3 });
      list.push({ p: sphere(mad(J[2], ch.dorsals[1], 0.04), F.r[2] * 0.86, { tag: 'knuckle', finger: i, dorsal: ch.dorsals[2] }), k: 0.28 });
    }
    const d2 = ch.dirs[2], o2 = ch.dorsals[2], s2 = norm(cross(d2, o2));
    distal[i] = { J: J[2], d: d2, o: o2, s: s2, L: F.L[2], r: F.r[3] };
    list.push({ p: ellipsoid(mad(mad(J[2], d2, F.L[2] * 0.48), o2, -F.r[2] * 0.22), d2, o2, s2, F.L[2] * 0.56, F.r[2] * 0.82, F.r[2] * 0.95, { tag: 'tip', finger: i, dorsal: o2, axis: d2, start: J[2], L: F.L[2] }), k: out ? 0.2 : 0.3 });
    // curled fingers press together (smaller blend so the grooves between them stay crisp)
    fingers.push({ list, k: pose.out[i + 1] ? 0.55 : 0.45 });
  });
  // thumb, solved against everything else
  const pre = makeField({ core, fingers }, 0.5);
  const sol = solveThumb(pose, chains, pre.f, opts);
  {
    const ch = thumbChain(sol.t), J = ch.joints, list = [];
    for (let s = 0; s < 3; s++) list.push({ p: roundCone(J[s], J[s + 1], THUMB_R[s][0], THUMB_R[s][1], { tag: s === 2 ? 'tip' : s === 0 ? 'palm' : 'finger', seg: s, finger: 4, dorsal: ch.dorsals[s], axis: ch.dirs[s], start: J[s], L: s === 2 ? 2.4 : 3 }), k: 0.3 });
    const mm = mad(J[0], ch.dirs[0], 2.0), o0 = ch.dorsals[0];
    list.push({ p: ellipsoid(mad(mm, o0, -0.55), ch.dirs[0], o0, norm(cross(ch.dirs[0], o0)), 2.6, 1.0, 1.1, { tag: 'palm', dorsal: Y }), k: 1.0 });   // thenar
    list.push({ p: sphere(mad(J[2], ch.dorsals[1], 0.08), 0.86, { tag: 'knuckle', finger: 4, dorsal: ch.dorsals[2] }), k: 0.25 });
    // the web of skin between thumb and index (first dorsal interosseous): fills the angle so the thumb grows out of the hand
    list.push({ p: roundCone(mad(J[0], ch.dirs[0], 2.2), [6.2, -0.2, -2.35], 1.05, 0.75, { tag: 'palm', dorsal: Y }), k: 0.9 });
    list.push({ p: roundCone(mad(J[0], ch.dirs[0], 3.6), [7.6, -0.35, -2.45], 0.62, 0.55, { tag: 'palm', dorsal: Y }), k: 0.8 });
    const d2 = ch.dirs[2], o2 = ch.dorsals[2], s2 = norm(cross(d2, o2));
    distal[4] = { J: J[2], d: d2, o: o2, s: s2, L: 2.4, r: 0.76 };
    list.push({ p: ellipsoid(mad(mad(J[2], d2, 1.1), o2, -0.2), d2, o2, s2, 1.2, 0.6, 0.76, { tag: 'tip', finger: 4, dorsal: o2, axis: d2, start: J[2], L: 2.4 }), k: 0.3 });
    fingers.push({ list, k: 1.3 });
    chains.push(ch);
  }
  return { core, fingers, thumb: sol, chains, fa, fy, fz, distal };
}



// field evaluation with per-primitive bounding-box culling
function makeField(model, margin) {
  const all = [];
  // grown by the blend radius that reaches it: its own, or its finger group's (the thumb group blends over 1.3 cm), so culling never
  // cuts a primitive while it still shapes the surface (a cut showed as a dotted seam across the heel of the palm)
  const prep = (e, gk = 0) => { const b = e.p.box, m = margin + Math.max(e.k, gk); e.bx = [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m]; all.push(e.p); };
  model.core.forEach((e) => prep(e)); model.fingers.forEach((f) => f.list.forEach((e) => prep(e, f.k)));
  const inBox = (e, x, y, z) => x >= e.bx[0] && y >= e.bx[1] && z >= e.bx[2] && x <= e.bx[3] && y <= e.bx[4] && z <= e.bx[5];
  const FAR = 1e3;
  function f(x, y, z) {
    let c = FAR;
    for (const e of model.core) if (e.k === 0 || inBox(e, x, y, z)) c = c === FAR ? e.p.d(x, y, z) : smin(c, e.p.d(x, y, z), e.k);
    let best = c;
    for (const g of model.fingers) {
      let fd = FAR;
      for (const e of g.list) if (inBox(e, x, y, z)) fd = fd === FAR ? e.p.d(x, y, z) : smin(fd, e.p.d(x, y, z), e.k);
      if (fd < FAR) best = Math.min(best, smin(c, fd, g.k));
    }
    return best;
  }
  // the same field with no box culling: far from the hand the culled field only bounds the distance to the forearm, so a ray marched
  // from above a finger tip could step straight through the finger (that buried the nails)
  function exact(x, y, z) {
    let c = FAR;
    for (const e of model.core) c = c === FAR ? e.p.d(x, y, z) : smin(c, e.p.d(x, y, z), e.k);
    let best = c;
    for (const g of model.fingers) { let fd = FAR; for (const e of g.list) fd = fd === FAR ? e.p.d(x, y, z) : smin(fd, e.p.d(x, y, z), e.k); best = Math.min(best, smin(c, fd, g.k)); }
    return best;
  }
  // the same field restricted to the primitives whose (grown) boxes touch a box: evaluated without per-point box tests
  function subset(b) {
    const hit = (e) => e.k === 0 || !(e.bx[3] < b[0] || e.bx[4] < b[1] || e.bx[5] < b[2] || e.bx[0] > b[3] || e.bx[1] > b[4] || e.bx[2] > b[5]);
    const core = model.core.filter(hit), fl = model.fingers.map((g) => ({ list: g.list.filter(hit), k: g.k })).filter((g) => g.list.length);
    const fn = (x, y, z) => {
      let c = FAR;
      for (let i = 0; i < core.length; i++) { const e = core[i], d = e.p.d(x, y, z); c = c === FAR ? d : smin(c, d, e.k); }
      let best = c;
      for (let j = 0; j < fl.length; j++) {
        const g = fl[j]; let fd = FAR;
        for (let i = 0; i < g.list.length; i++) { const e = g.list[i], d = e.p.d(x, y, z); fd = fd === FAR ? d : smin(fd, d, e.k); }
        best = Math.min(best, smin(c, fd, g.k));
      }
      return best;
    };
    fn.prims = [...core, ...fl.flatMap((g) => g.list)].map((e) => e.p);
    return fn;
  }
  // the nearest primitive, plus smooth blends of the back-of-hand direction and the knuckle weight over the nearby primitives
  // (weights fall off with distance), so colours never step where one primitive hands over to the next
  function nearest(x, y, z, out, prims = all) {
    let bd = Infinity, bp = null;
    const ds = prims.map((p) => p.d(x, y, z));
    ds.forEach((d, i) => { if (d < bd) { bd = d; bp = prims[i]; } });
    let wx = 0, wy = 0, wz = 0, wk = 0, ws = 0;
    ds.forEach((d, i) => {
      const w = Math.exp(-(d - bd) / 0.22), o = prims[i].dorsal || Y;
      wx += o[0] * w; wy += o[1] * w; wz += o[2] * w; ws += w; if (prims[i].tag === 'knuckle') wk += w;
    });
    const l = Math.hypot(wx, wy, wz) || 1;
    out.dorsal = [wx / l, wy / l, wz / l]; out.knuckle = wk / ws; out.p = bp;
    return out;
  }
  return { f, nearest, subset, exact };
}

const srgb = (r, g, b) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);

/**
 * Build the hand. Async: the meshing yields to the browser between slabs so the page never hitches.
 * Returns { geometry (metres, hand frame), pinch: { point, axis } (metres), forearm: { axis, y, z } (unit), wristRadius(s) }.
 */
export async function buildHandGeometry({ pose, voxel = 0.17, skin = '#8c5b40', yieldMs = 5, ...opts } = {}) {
  const t0 = performance.now();
  const model = buildModel(pose, opts);
  const field = makeField(model, voxel * 3);
  const F = field.f;
  // bounds
  const lo = [-16.5, -7.5, -10.5], hi = [20.5, 5.0, 7.5];
  const h = voxel, nx = Math.ceil((hi[0] - lo[0]) / h) + 1, ny = Math.ceil((hi[1] - lo[1]) / h) + 1, nz = Math.ceil((hi[2] - lo[2]) / h) + 1;
  const val = new Float32Array(nx * ny * nz).fill(NaN);
  const B = 4, bh = B * h, halfDiag = Math.sqrt(3) * bh * 0.5;
  const nbx = Math.ceil(nx / B), nby = Math.ceil(ny / B), nbz = Math.ceil(nz / B);
  const nearB = [];   // blocks the surface may cross: [bi, bj, bk]
  let last = performance.now();
  const breathe = async () => { if (yieldMs && performance.now() - last > yieldMs) { await new Promise((r) => setTimeout(r, 0)); last = performance.now(); } };
  // sample the field: a block whose centre is far from the surface is one sign throughout (the field is 1-Lipschitz), so it gets
  // the centre value without per-point work (and never overwrites a point an accurate neighbour block already sampled)
  for (let bk = 0; bk < nz; bk += B) {
    for (let bj = 0; bj < ny; bj += B) for (let bi = 0; bi < nx; bi += B) {
      const cx = lo[0] + (bi + B / 2) * h, cy = lo[1] + (bj + B / 2) * h, cz = lo[2] + (bk + B / 2) * h;
      const dc = F(cx, cy, cz);
      const far = Math.abs(dc) > halfDiag * 1.6 + 0.1;
      const ie = Math.min(nx, bi + B + 1), je = Math.min(ny, bj + B + 1), ke = Math.min(nz, bk + B + 1);
      if (far) { for (let k = bk; k < ke; k++) for (let j = bj; j < je; j++) for (let i = bi; i < ie; i++) { const id = i + nx * (j + ny * k); if (val[id] !== val[id]) val[id] = dc; } continue; }
      nearB.push([bi, bj, bk]);
      const Fs = field.subset([lo[0] + bi * h, lo[1] + bj * h, lo[2] + bk * h, lo[0] + ie * h, lo[1] + je * h, lo[2] + ke * h]);
      for (let k = bk; k < ke; k++) for (let j = bj; j < je; j++) for (let i = bi; i < ie; i++) val[i + nx * (j + ny * k)] = Fs(lo[0] + i * h, lo[1] + j * h, lo[2] + k * h);
    }
    await breathe();
  }
  // surface nets: one vertex per cell that the surface crosses (only cells in near blocks can be crossed)
  const cnx = nx - 1, cny = ny - 1, cnz = nz - 1;
  const cellV = new Int32Array(cnx * cny * cnz).fill(-1);
  const pos = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const co = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const cv = new Float32Array(8);
  for (const [bi, bj, bk] of nearB) {
    for (let k = bk; k < Math.min(cnz, bk + B); k++) for (let j = bj; j < Math.min(cny, bj + B); j++) for (let i = bi; i < Math.min(cnx, bi + B); i++) {
      let mask = 0;
      for (let c = 0; c < 8; c++) { const v = val[(i + co[c][0]) + nx * ((j + co[c][1]) + ny * (k + co[c][2]))]; cv[c] = v; if (v < 0) mask |= 1 << c; }
      if (mask === 0 || mask === 255) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, b] of E) {
        const va = cv[a], vb = cv[b];
        if ((va < 0) === (vb < 0)) continue;
        const t = va / (va - vb);
        sx += co[a][0] + (co[b][0] - co[a][0]) * t; sy += co[a][1] + (co[b][1] - co[a][1]) * t; sz += co[a][2] + (co[b][2] - co[a][2]) * t; n++;
      }
      cellV[i + cnx * (j + cny * k)] = pos.length / 3;
      pos.push(lo[0] + (i + sx / n) * h, lo[1] + (j + sy / n) * h, lo[2] + (k + sz / n) * h);
    }
  }
  await breathe();
  const idx = [];
  const C = (i, j, k) => cellV[i + cnx * (j + cny * k)];
  for (const [bi, bj, bk] of nearB) {
    for (let k = bk; k < Math.min(nz, bk + B); k++) for (let j = bj; j < Math.min(ny, bj + B); j++) for (let i = bi; i < Math.min(nx, bi + B); i++) {
      const v0 = val[i + nx * (j + ny * k)];
      if (i < nx - 1 && j > 0 && k > 0 && j < cny && k < cnz) {
        const v1 = val[i + 1 + nx * (j + ny * k)];
        if ((v0 < 0) !== (v1 < 0)) quad(C(i, j - 1, k - 1), C(i, j, k - 1), C(i, j, k), C(i, j - 1, k), v0 < 0);
      }
      if (j < ny - 1 && i > 0 && k > 0 && i < cnx && k < cnz) {
        const v1 = val[i + nx * (j + 1 + ny * k)];
        if ((v0 < 0) !== (v1 < 0)) quad(C(i - 1, j, k - 1), C(i - 1, j, k), C(i, j, k), C(i, j, k - 1), v0 < 0);
      }
      if (k < nz - 1 && i > 0 && j > 0 && i < cnx && j < cny) {
        const v1 = val[i + nx * (j + ny * (k + 1))];
        if ((v0 < 0) !== (v1 < 0)) quad(C(i - 1, j - 1, k), C(i, j - 1, k), C(i, j, k), C(i - 1, j, k), v0 < 0);
      }
    }
  }
  // per-block restricted fields for the vertex pass (box grown by 1 cm for the occlusion probes)
  const vSub = new Map();
  const FV = (x, y, z) => {
    const bi = Math.floor((x - lo[0]) / bh), bj = Math.floor((y - lo[1]) / bh), bk = Math.floor((z - lo[2]) / bh), key = bi + nbx * (bj + nby * bk);
    let f = vSub.get(key);
    if (!f) { f = field.subset([lo[0] + bi * bh - 1, lo[1] + bj * bh - 1, lo[2] + bk * bh - 1, lo[0] + (bi + 1) * bh + 1, lo[1] + (bj + 1) * bh + 1, lo[2] + (bk + 1) * bh + 1]); vSub.set(key, f); }
    return f;
  };
  void nbz;
  function quad(a, b, c, d, inside) {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (inside) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
  }
  await breathe();
  // refine onto the surface, normals from the field gradient, then skin attributes
  const nv = pos.length / 3;
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), COL = new Float32Array(nv * 3), RO = new Float32Array(nv);
  const e = 0.03;
  const grad = (Fv, x, y, z, out) => {
    const a = Fv(x + e, y - e, z - e), b = Fv(x - e, y - e, z + e), c = Fv(x - e, y + e, z - e), d = Fv(x + e, y + e, z + e);
    out[0] = a - b - c + d; out[1] = -a - b + c + d; out[2] = -a + b - c + d;
    const l = Math.hypot(out[0], out[1], out[2]) || 1; out[0] /= l; out[1] /= l; out[2] /= l; return out;
  };
  const g = [0, 0, 0];
  const base = new THREE.Color(skin), cBack = base.clone(), cPalm = base.clone().lerp(srgb(214, 156, 124), 0.55), cWarm = base.clone().lerp(srgb(196, 104, 86), 0.35);
  const cKnuckle = base.clone().multiplyScalar(0.8), cNail = srgb(206, 150, 128), cNailEdge = srgb(226, 196, 176), cLunula = srgb(214, 168, 148);
  const tmp = new THREE.Color();
  const distal = model.distal, near = {};
  for (let v = 0; v < nv; v++) {
    let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const Fv = opts.fastField ? FV(x, y, z) : F;   // the full field: per-block subsets disagree by a hair at block edges, which the occlusion turned into steps
    { const d = Fv(x, y, z); grad(Fv, x, y, z, g); x -= g[0] * d; y -= g[1] * d; z -= g[2] * d; }
    grad(Fv, x, y, z, g);
    P[v * 3] = x * 0.01; P[v * 3 + 1] = y * 0.01; P[v * 3 + 2] = z * 0.01;
    N[v * 3] = g[0]; N[v * 3 + 1] = g[1]; N[v * 3 + 2] = g[2];
    // ambient occlusion from the field: how much the surface is crowded by other skin along the normal
    let ao = 0, w = 1;
    for (let s = 1; s <= 3; s++) { const st = 0.2 * s, dd = F(x + g[0] * st, y + g[1] * st, z + g[2] * st); ao += w * Math.max(0, st - dd); w *= 0.6; }   // short probes: only the tight creases between fingers darken, not the broad hollow of the wrist
    ao = clamp(1 - ao * 1.5, 0.5, 1);
    const nr = field.nearest(x, y, z, near), p = nr.p;
    const back = dot(g, nr.dorsal);
    tmp.copy(cPalm).lerp(cBack, sstep(-0.55, 0.25, back));
    let rough = 0.58 + 0.08 * (1 - sstep(-0.5, 0.3, back));
    tmp.lerp(cKnuckle, 0.5 * nr.knuckle * sstep(0.2, 0.8, back));
    if (p.finger !== undefined) {
      const ds = distal[p.finger], rel = [x - ds.J[0], y - ds.J[1], z - ds.J[2]];
      const along = dot(rel, ds.d) / ds.L, lat = Math.abs(dot(rel, ds.s)), up = dot(rel, ds.o), bk = dot(g, ds.o);
      if (along > 0) {
        tmp.lerp(cWarm, 0.3 * sstep(0.1, 0.9, along) * (1 - sstep(0.2, 0.7, bk)));
      }
    }
    // a soft, low-frequency mottle so the skin is not plastic-even
    const mot = 1 + 0.05 * Math.sin(x * 2.1 + Math.sin(z * 1.7) * 1.3) * Math.sin(y * 2.7 + z * 0.9);
    tmp.multiplyScalar(ao * mot);
    COL[v * 3] = tmp.r; COL[v * 3 + 1] = tmp.g; COL[v * 3 + 2] = tmp.b; RO[v] = rough;
    if ((v & 511) === 0) await breathe();
  }
  // nails: thin curved plates laid on the back of each last phalanx (found by marching onto the skin), slightly proud of it in the
  // middle and tucked under the folds at the sides and the base: crisp edges at any size, a pale lunula, a white free edge
  const nailGeo = nailGeometry(field.exact, distal, base);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(COL, 3));
  geo.setAttribute('aRough', new THREE.BufferAttribute(RO, 1));
  geo.setIndex(new THREE.BufferAttribute(nv > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
  geo.computeBoundingSphere();
  const C3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  return {
    geometry: geo, nailGeometry: nailGeo, thumb: model.thumb,
    // GRIP only: where the disc is pinched (mid-thickness, metres), its normal and the direction from the pinch toward the disc centre
    card: model.thumb.card ? { point: C3(mul(model.thumb.card.point, 0.01)), n: C3(model.thumb.card.n), f: C3(model.thumb.card.f), thickness: model.thumb.card.cardCm * 0.01 } : null,
    joints: model.chains.map((c) => c.joints.map((j) => C3(mul(j, 0.01)))),
    stats: { verts: nv, tris: idx.length / 3, ms: Math.round(performance.now() - t0), grid: [nx, ny, nz] },
  };
}

function nailGeometry(F, distal, skinC) {
  const U = 12, V = 9, pos = [], nor = [], col = [], idx = [];
  // nails take the skin's own tone: a pinker, lighter plate over the nail bed, a paler lunula and a slightly translucent free edge
  const lum = skinC.r * 0.3 + skinC.g * 0.55 + skinC.b * 0.15;
  const cBody = skinC.clone().lerp(srgb(214, 156, 146), 0.22 + 0.2 * lum), cLun = cBody.clone().lerp(srgb(232, 210, 200), 0.18 + 0.15 * lum);
  const cEdge = cBody.clone().lerp(srgb(236, 224, 208), 0.2 + 0.25 * lum), cFold = skinC.clone().multiplyScalar(0.72);
  const e = 0.02, grad = (x, y, z) => { const a = F(x + e, y - e, z - e), b = F(x - e, y - e, z + e), c = F(x - e, y + e, z - e), d = F(x + e, y + e, z + e); return norm([a - b - c + d, -a - b + c + d, -a + b - c + d]); };
  const hit = (Q, o, maxT) => { let t = 0; for (let k = 0; k < 64 && t < maxT; k++) { const p = mad(Q, o, -t), d = F(p[0], p[1], p[2]); if (d < 0.002) return p; t += Math.max(d, 0.004); } return null; };   // sphere tracing
  distal.forEach((ds, f) => {
    const w = ds.r * (f === 4 ? 0.62 : 0.57), up = ds.r * 2.6;
    // a hit on the back of the phalanx: one that lands on a neighbouring finger or low on the rounded front of the tip is not where a nail lies
    const top = (a, lat) => { const p = hit(mad(mad(mad(ds.J, ds.d, a), ds.s, lat), ds.o, up), ds.o, up * 1.6); return p && dot(sub(p, ds.J), ds.o) > ds.r * 0.35 && dot(sub(p, ds.J), ds.o) < ds.r * 1.6 ? p : null; };
    // how far along the phalanx the skin is still under the centre line
    let aMax = ds.L * 0.6;
    for (let a = ds.L * 0.6; a < ds.L * 1.6; a += 0.03) { if (!top(a, 0)) break; aMax = a; }
    const a0 = ds.L * 0.36, a1 = aMax - 0.04, base = pos.length / 3, prev = [];
    for (let i = 0; i <= U; i++) {
      const u = i / U, a = a0 + (a1 - a0) * u;
      const round = u < 0.22 ? Math.sqrt(Math.max(0, 1 - ((0.22 - u) / 0.22) ** 2)) : 1, ww = w * (0.35 + 0.65 * round) * (1 - 0.06 * u);
      for (let j = 0; j <= V; j++) {
        const v = (j / V) * 2 - 1;
        // past the skin's edge the corner moves in toward the centre line until it is on the skin (an extrapolated corner floated in the
        // air), so the free edge follows the round of the finger tip
        let p = null;
        for (let k = 0; k <= 6 && !p; k++) p = top(a, v * ww * (1 - k / 6));
        p = p || (prev[j] ? prev[j].slice() : mad(mad(ds.J, ds.d, a), ds.o, ds.r * 0.9));
        prev[j] = p;
        const n = grad(p[0], p[1], p[2]);
        const lift = 0.004 + 0.034 * (1 - Math.abs(v) ** 4) * (u < 0.14 ? u / 0.14 : 1);   // edges tucked under the nail folds
        p = mad(p, n, lift);
        pos.push(p[0] * 0.01, p[1] * 0.01, p[2] * 0.01); nor.push(n[0], n[1], n[2]);
        const c = cBody.clone();
        if (u < 0.2) c.lerp(cLun, (1 - u / 0.2) * 0.7 * (1 - Math.abs(v) ** 2));
        if (u > 0.9) c.lerp(cEdge, 0.85 * sstep(0.9, 0.97, u));
        c.lerp(cFold, 0.55 * Math.max(sstep(0.7, 1, Math.abs(v)) * (u < 0.9 ? 1 : 0.3), 1 - sstep(0, 0.12, u)));
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) {
      const a = base + i * (V + 1) + j, b = a + V + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  // winding: make the faces point along the stored normals
  { const P = g.attributes.position.array, N = g.attributes.normal.array, I = g.index.array;
    const a = I[0] * 3, b = I[1] * 3, c = I[2] * 3;
    const fn = cross(sub([P[b], P[b + 1], P[b + 2]], [P[a], P[a + 1], P[a + 2]]), sub([P[c], P[c + 1], P[c + 2]], [P[a], P[a + 1], P[a + 2]]));
    if (dot(fn, [N[a], N[a + 1], N[a + 2]]) < 0) for (let k = 0; k < I.length; k += 3) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; } }
  return g;
}

export function nailMaterial() {
  return new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, vertexColors: true, roughness: 0.34, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.3, specularIntensity: 0.45, envMapIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
}

// Skin material: physical, vertex colours, per-vertex roughness, and a wrapped red-shifted diffuse (light scattering under the skin).
export function skinMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, metalness: 0, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.5, 0.34, 0.28), specularIntensity: 0.42, clearcoat: 0.04, clearcoatRoughness: 0.5, envMapIntensity: 0.5 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aRough;\nvarying float vRough;\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRough = aRough;\nvObj = position;');
    // light that scatters under the skin: a wrapped, red-shifted diffuse added on top of the standard term near the shadow line
    const SSS = `
      #if NUM_DIR_LIGHTS > 0
      for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
        float ndlS = dot( normal, directionalLights[ i ].direction );
        vec3 wrapW = vec3( 0.5, 0.24, 0.16 );
        vec3 extra = clamp( ( vec3( ndlS ) + wrapW ) / ( 1.0 + wrapW ), 0.0, 1.0 ) - vec3( clamp( ndlS, 0.0, 1.0 ) );
        reflectedLight.directDiffuse += 0.55 * extra * directionalLights[ i ].color * BRDF_Lambert( material.diffuseContribution );
      }
      #endif
      #include <lights_fragment_end>`;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRough;\nvarying vec3 vObj;')
      // fine skin relief (pores and creases at about a millimetre), faded out where it would only shimmer on a small screen
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 q = vObj * 1150.0, q2 = vObj * 2900.0;
          vec3 nz = vec3( sin( q.x + sin( q.y * 0.7 ) ) * sin( q.z * 1.3 + 1.1 ), sin( q.y * 1.2 + 2.0 ) * sin( q.x * 0.8 + q.z ), sin( q.z + 0.4 ) * sin( q.y * 0.9 + q.x * 0.5 ) )
                  + 0.6 * vec3( sin( q2.y + 1.3 ) * sin( q2.z ), sin( q2.z * 1.1 ) * sin( q2.x + 0.6 ), sin( q2.x * 0.9 ) * sin( q2.y + 2.1 ) );
          float fade = 1.0 - clamp( length( fwidth( vObj ) ) * 2600.0 - 0.5, 0.0, 1.0 );
          normal = normalize( normal + 0.045 * fade * nz ); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vRough;')
      .replace('#include <lights_fragment_end>', SSS);
  };
  m.customProgramCacheKey = () => 'morra-skin-1';
  return m;
}

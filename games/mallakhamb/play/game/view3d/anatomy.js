// Anatomy pass for the performer's body mesh (presentation only; works on THIS game's copy of the geometry, never on the vendored files).
//
// The shipped athlete body is a low-poly sports mannequin dressed in a tank top: a boxy vest yoke with a stick arm pushed into the armhole.
// Bare-chested on a pole, that reads as "shoulders made of boxes". This file rebuilds the shoulder girdle in four steps, all at load:
//   1. subdivide(): one midpoint subdivision (positions, UVs and skin weights interpolated), so curves can be curves;
//   2. sculptShoulders(): in the rest pose, the trunk/arm junction is re-shaped against an anatomical model of the girdle (trapezius slope from
//      the neck, rounded deltoid over the head of the humerus, armpit fold, pectoral and lat insertions) built from smooth-union capsules
//      and ellipsoids at the skeleton's own joints;
//   3. smoothWeights(): the skin weights around the shoulder joint are diffused over the surface, so a raised arm stretches the deltoid
//      and the armpit like skin instead of folding a slab out of the trunk;
//   4. relax(): a Taubin (non-shrinking) smoothing of the welded surface removes the faceting the low-poly source shows in silhouette.
// At run time scapulaRhythm() lifts and rotates the clavicle with the arm (the shoulder blade turns up about 1 degree for every 2 the arm
// rises), which is what makes a real overhead grip look like shoulders, not a hinge.
import { THREE } from '../vendor3d/index.js';

const { Vector3 } = THREE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };

// --- geometry helpers ------------------------------------------------------------------------------------------------------------
function weld(pos, n) {
  const key = new Map(), id = new Int32Array(n);
  let g = 0;
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos[i * 3] * 2e4)},${Math.round(pos[i * 3 + 1] * 2e4)},${Math.round(pos[i * 3 + 2] * 2e4)}`;
    let v = key.get(k); if (v === undefined) { v = g++; key.set(k, v); }
    id[i] = v;
  }
  return { id, count: g };
}

/** One 1->4 midpoint subdivision of an indexed skinned geometry (in place: replaces the attributes and the index). */
export function subdivide(geo) {
  const P = geo.attributes.position, UV = geo.attributes.uv, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
  const n0 = P.count, idx = geo.index.array;
  const pos = Array.from(P.array), uv = UV ? Array.from(UV.array) : null, si = Array.from(SI.array), sw = Array.from(SW.array);
  const edge = new Map();
  const mid = (a, b) => {
    if (a === b) return a;
    const k = a < b ? a * 1e6 + b : b * 1e6 + a;
    let m = edge.get(k); if (m !== undefined) return m;
    m = pos.length / 3;
    for (let c = 0; c < 3; c++) pos.push((pos[a * 3 + c] + pos[b * 3 + c]) / 2);
    if (uv) for (let c = 0; c < 2; c++) uv.push((uv[a * 2 + c] + uv[b * 2 + c]) / 2);
    const w = new Map();
    for (const v of [a, b]) for (let c = 0; c < 4; c++) { const j = si[v * 4 + c], x = sw[v * 4 + c] / 2; if (x > 0) w.set(j, (w.get(j) || 0) + x); }
    const top = [...w.entries()].sort((p, q) => q[1] - p[1]).slice(0, 4); const s = top.reduce((t, e) => t + e[1], 0) || 1;
    for (let c = 0; c < 4; c++) { si.push(top[c] ? top[c][0] : 0); sw.push(top[c] ? top[c][1] / s : 0); }
    edge.set(k, m); return m;
  };
  const out = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    if (a === b && b === c) continue;              // collapsed triangles (the removed trainers) stay removed
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    out.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(si), 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(sw), 4));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(out), 1));
  geo.deleteAttribute('normal');
  void n0;
}

/** Welded neighbour lists + boundary flags (an edge used by one triangle only). */
function topology(geo) {
  const P = geo.attributes.position.array, n = geo.attributes.position.count, idx = geo.index.array;
  const W = weld(P, n);
  const nb = Array.from({ length: W.count }, () => new Set());
  const ec = new Map();
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = W.id[idx[t + e]], b = W.id[idx[t + (e + 1) % 3]]; if (a === b) continue;
    nb[a].add(b); nb[b].add(a);
    const k = a < b ? a * 1e6 + b : b * 1e6 + a; ec.set(k, (ec.get(k) || 0) + 1);
  }
  const border = new Uint8Array(W.count);
  for (const [k, c] of ec) if (c === 1) { border[Math.floor(k / 1e6)] = 1; border[k % 1e6] = 1; }
  return { W, nb: nb.map((s) => Int32Array.from(s)), border };
}

/** Normals averaged over welded vertices (no shading seam where the UV islands meet, e.g. round the armhole). */
export function weldedNormals(geo) {
  geo.computeVertexNormals();
  const P = geo.attributes.position.array, N = geo.attributes.normal, n = N.count;
  const W = weld(P, n), acc = new Float32Array(W.count * 3);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) acc[W.id[i] * 3 + c] += N.array[i * 3 + c];
  for (let i = 0; i < n; i++) {
    const g = W.id[i], x = acc[g * 3], y = acc[g * 3 + 1], z = acc[g * 3 + 2], l = Math.hypot(x, y, z) || 1;
    N.array[i * 3] = x / l; N.array[i * 3 + 1] = y / l; N.array[i * 3 + 2] = z / l;
  }
  N.needsUpdate = true;
}

// --- the anatomical girdle model (rest pose, world metres) ----------------------------------------------------------------------
const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b * (1 - h) + a * h - k * h * (1 - h); };
function capsule(p, a, b, r) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z, l2 = abx * abx + aby * aby + abz * abz;
  const t = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l2, 0, 1);
  const r0 = typeof r === 'function' ? r(t) : r;
  return Math.hypot(p.x - a.x - abx * t, p.y - a.y - aby * t, p.z - a.z - abz * t) - r0;
}
function ellipsoid(p, c, rx, ry, rz) {                // approximate distance (good near the surface)
  const x = (p.x - c.x) / rx, y = (p.y - c.y) / ry, z = (p.z - c.z) / rz;
  const k0 = Math.hypot(x, y, z), k1 = Math.hypot(x / rx, y / ry, z / rz);
  return k1 > 0 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
}

/**
 * Re-shape the trunk/arm junction in the rest pose. `J` = world rest positions of Neck, Spine2, Clavicle and UpperArm/Forearm per side.
 * Every vertex near a shoulder is moved onto the anatomical surface along the field gradient, blended out with distance so the chest,
 * back and arm keep their own shape further away.
 */
export function sculptShoulders(geo, toWorld, toLocal, J) {
  const P = geo.attributes.position, n = P.count;
  const sides = ['L', 'R'].map((s) => {
    const S = J[`${s}_UpperArm`], E = J[`${s}_Forearm`], o = Math.sign(S.x - J.Neck.x) || 1;
    const dir = E.clone().sub(S).normalize();
    // humeral head sits a little below and in front of the shoulder bone origin; the acromion is the outer tip of the girdle above it
    const head = S.clone().add(new Vector3(o * 0.004, -0.012, 0.006));
    const elbowEnd = S.clone().addScaledVector(dir, S.distanceTo(E) * 0.55);
    // deltoid: a thick, slightly lifted cap whose centre is outside and in front of the joint, tapering to its insertion mid-arm
    const delC = S.clone().addScaledVector(dir, 0.045).add(new Vector3(o * 0.022, 0.004, 0.004));
    const delI = S.clone().addScaledVector(dir, S.distanceTo(E) * 0.48).add(new Vector3(o * 0.012, 0, 0.004));
    const neckBase = new Vector3(J.Neck.x + o * 0.035, J.Neck.y - 0.03, J.Neck.z - 0.012);
    const acro = new Vector3(S.x - o * 0.008, S.y + 0.014, S.z - 0.01);
    const axilla = new Vector3(S.x - o * 0.075, S.y - 0.1, S.z - 0.01);
    return { s, o, S, E, dir, head, elbowEnd, delC, delI, neckBase, acro, axilla };
  });
  // trunk: an upper-chest ellipsoid (rib cage under pecs and lats) carried down by a waist capsule
  const sp2 = J.Spine2, neck = J.Neck;
  const chestC = new Vector3(sp2.x, sp2.y + 0.004, sp2.z + 0.012);
  const field = (p, sd) => {
    let d = ellipsoid(p, chestC, 0.158, 0.15, 0.112);
    d = smin(d, capsule(p, new Vector3(neck.x, neck.y - 0.07, neck.z - 0.005), new Vector3(neck.x, neck.y + 0.05, neck.z), 0.058), 0.03);
    // trapezius: from the base of the neck down to the acromion, thick at the neck
    d = smin(d, capsule(p, sd.neckBase, sd.acro, (t) => 0.036 - 0.022 * t), 0.04);
    // upper arm + deltoid
    d = smin(d, capsule(p, sd.head, sd.elbowEnd, (t) => 0.045 - 0.006 * t), 0.03);
    d = smin(d, capsule(p, sd.delC, sd.delI, (t) => 0.047 * (1 - 0.55 * t * t)), 0.03);
    // armpit: the front (pectoral) and back (lat) folds meet the arm
    d = smin(d, capsule(p, sd.axilla.clone().add(new Vector3(0, 0.02, 0.05)), sd.head.clone().add(new Vector3(-sd.o * 0.02, -0.02, 0.035)), 0.03), 0.045);
    d = smin(d, capsule(p, sd.axilla.clone().add(new Vector3(0, -0.02, -0.05)), sd.head.clone().add(new Vector3(-sd.o * 0.02, -0.03, -0.035)), 0.032), 0.045);
    return d;
  };
  const v = new Vector3(), q = new Vector3(), g = new Vector3();
  const moved = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    toWorld(v.set(P.getX(i), P.getY(i), P.getZ(i)));
    // region weight: a ball round the shoulder that reaches up to the neck, out to the deltoid insertion and down into the armpit
    let best = null, wr = 0;
    for (const sd of sides) {
      const dS = v.distanceTo(sd.S.clone().add(new Vector3(-sd.o * 0.02, 0.0, 0)));
      const along = v.clone().sub(sd.S).dot(sd.dir);
      // the slope between the neck and the shoulder point is part of the girdle too (that is where the vest's flat yoke was)
      const sl = sd.neckBase.clone().lerp(sd.acro, 0.5), dT = v.distanceTo(sl);
      const w = Math.max((1 - sstep(0.095, 0.16, dS)) * (1 - sstep(0.09, 0.15, along)), (1 - sstep(0.05, 0.09, dT)) * (v.z < sl.z + 0.06 && v.y > sl.y - 0.06 ? 1 : 0));
      if (w > wr) { wr = w; best = sd; }
    }
    if (!best || wr < 0.002) continue;
    // do not drag the neck or the lower chest into the model
    if (v.y > neck.y + 0.01) continue;
    q.copy(v);
    for (let it = 0; it < 4; it++) {
      const d = field(q, best), e = 0.0015;
      g.set(field(q.clone().setX(q.x + e), best) - field(q.clone().setX(q.x - e), best), field(q.clone().setY(q.y + e), best) - field(q.clone().setY(q.y - e), best), field(q.clone().setZ(q.z + e), best) - field(q.clone().setZ(q.z - e), best)).multiplyScalar(1 / (2 * e));
      const gl = g.lengthSq(); if (gl < 1e-8) break;
      q.addScaledVector(g, -d / gl);
    }
    const dd = q.distanceTo(v); if (dd > 0.06) continue;          // a vertex the model does not describe (far inside): leave it
    v.lerp(q, wr);
    moved[i] = wr;
    toLocal(v); P.setXYZ(i, v.x, v.y, v.z);
  }
  P.needsUpdate = true;
  return moved;
}

/** Diffuse the skin weights of the girdle bones across the surface near the shoulders (welded graph, a few Jacobi steps). */
export function smoothWeights(geo, boneNames, toWorld, J, iters = 12) {
  const T = topology(geo);
  const SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, P = geo.attributes.position, n = P.count;
  const girdle = new Set(['Spine1', 'Spine2', 'Neck', 'L_Clavicle', 'R_Clavicle', 'L_UpperArm', 'R_UpperArm'].map((x) => boneNames.indexOf(`Bip01_${x}`)).filter((i) => i >= 0));
  // welded weight maps
  const G = T.W.count, wmap = Array.from({ length: G }, () => new Map()), cnt = new Uint16Array(G), region = new Float32Array(G);
  const v = new Vector3();
  for (let i = 0; i < n; i++) {
    const g = T.W.id[i]; cnt[g]++;
    if (cnt[g] === 1) {
      for (let c = 0; c < 4; c++) { const w = SW.getComponent(i, c); if (w > 0) wmap[g].set(SI.getComponent(i, c), (wmap[g].get(SI.getComponent(i, c)) || 0) + w); }
      toWorld(v.set(P.getX(i), P.getY(i), P.getZ(i)));
      let r = 0;
      for (const s of ['L', 'R']) r = Math.max(r, 1 - sstep(0.08, 0.17, v.distanceTo(J[`${s}_UpperArm`])));
      region[g] = r;
    }
  }
  for (let it = 0; it < iters; it++) {
    const next = wmap.map((m) => new Map(m));
    for (let g = 0; g < G; g++) {
      const r = region[g]; if (r <= 0) continue;
      // only girdle weights move; anything else (hand, head...) is kept
      const acc = new Map(); let k = 0;
      for (const h of T.nb[g]) { k++; for (const [b, w] of wmap[h]) if (girdle.has(b)) acc.set(b, (acc.get(b) || 0) + w); }
      if (!k) continue;
      let own = 0; for (const [b, w] of wmap[g]) if (girdle.has(b)) own += w;
      const m = next[g];
      let tot = 0; for (const [, w] of acc) tot += w / k;
      if (tot <= 0) continue;
      for (const b of [...m.keys()]) if (girdle.has(b)) m.set(b, m.get(b) * (1 - 0.5 * r));
      for (const [b, w] of acc) m.set(b, (m.get(b) || 0) + 0.5 * r * (w / k) * (own / tot));
    }
    for (let g = 0; g < G; g++) wmap[g] = next[g];
  }
  for (let i = 0; i < n; i++) {
    const g = T.W.id[i]; if (region[g] <= 0) continue;
    const top = [...wmap[g].entries()].filter((e) => e[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4), s = top.reduce((t, e) => t + e[1], 0) || 1;
    for (let c = 0; c < 4; c++) { SI.setComponent(i, c, top[c] ? top[c][0] : 0); SW.setComponent(i, c, top[c] ? top[c][1] / s : 0); }
  }
  SI.needsUpdate = true; SW.needsUpdate = true;
}

/** Taubin smoothing of the welded surface, skipping open borders and `keep(i)` vertices (hands, toes). */
export function relax(geo, keep, iters = 4, lambda = 0.5, mu = -0.53) {
  const T = topology(geo), P = geo.attributes.position, n = P.count, G = T.W.count;
  const p = new Float64Array(G * 3), fixed = new Uint8Array(G);
  for (let i = 0; i < n; i++) { const g = T.W.id[i]; p[g * 3] = P.getX(i); p[g * 3 + 1] = P.getY(i); p[g * 3 + 2] = P.getZ(i); if (keep(i)) fixed[g] = 1; }
  const step = (f) => {
    const q = new Float64Array(p);
    for (let g = 0; g < G; g++) {
      if (fixed[g] || T.border[g]) continue;
      const nb = T.nb[g]; if (nb.length < 3) continue;
      let x = 0, y = 0, z = 0; for (const h of nb) { x += p[h * 3]; y += p[h * 3 + 1]; z += p[h * 3 + 2]; }
      x /= nb.length; y /= nb.length; z /= nb.length;
      q[g * 3] += f * (x - p[g * 3]); q[g * 3 + 1] += f * (y - p[g * 3 + 1]); q[g * 3 + 2] += f * (z - p[g * 3 + 2]);
    }
    p.set(q);
  };
  for (let k = 0; k < iters; k++) { step(lambda); step(mu); }
  for (let i = 0; i < n; i++) { const g = T.W.id[i]; P.setXYZ(i, p[g * 3], p[g * 3 + 1], p[g * 3 + 2]); }
  P.needsUpdate = true;
}

/**
 * Scapulohumeral rhythm: how far the clavicle lifts (degrees) for an arm raised `elev` degrees from hanging (0 = by the side, 180 = straight
 * overhead). Real shoulders: little until about 30 degrees, then roughly 1 degree of shoulder-blade turn for every 2 of arm, up to ~30.
 */
export function clavicleLift(elev) {
  return clamp((elev - 30) * 0.22, 0, 30);
}

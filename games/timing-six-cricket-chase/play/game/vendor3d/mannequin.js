// Procedural stylised mannequin athlete: smooth rounded body parts generated from primitives (swept elliptical tubes, an egg head, mitten hands with a separate thumb, rounded shoes),
// skinned with soft weights to the SAME Rocketbox "Bip01" skeleton the realistic athletes use, so every clip, IK helper, finger preset, LOD switch, time warp, contact helper and
// equipment piece works unchanged. ONE merged geometry + ONE material per detail level (1 draw call per person). Our own geometry code: no third-party assets, no licence issue.
//
// Vertex data baked into the mesh (same layout as the athletes' light level, so the same tint shader is used):
//   color  : linear base colour (cloth 0.8 grey, skin 0.5 grey, hair dark, shoes 0.8 grey) with small hand-placed shading (creases, brow line, soles)
//   aMask  : (top, bottoms, socks, skin) tint masks
//   aHair  : > 0 hair, < 0 shoes (tinted by setHair / setKit({ shoes }))
import * as THREE from './three.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export const MANNEQUIN_DETAIL = {
  full: { torso: 8, limb: 6, head: 10, headRings: 8, fr: [0.5, 1], torsoFr: [0.5, 1], hand: 5 },
  medium: { torso: 7, limb: 5, head: 8, headRings: 6, fr: [1], torsoFr: [1], hand: 4 },
  light: { torso: 6, limb: 4, head: 6, headRings: 5, fr: [1], torsoFr: [1], hand: 4 },
};

// ----------------------------------------------------------------- builder
class Builder {
  constructor(boneIndex) { this.bi = boneIndex; this.pos = []; this.col = []; this.mask = []; this.hair = []; this.trim = []; this.si = []; this.sw = []; this.idx = []; }
  // st: { p, a, b, w:[[bone, weight]], color:[r,g,b], mask:[t,b,s,k], hair }
  sweep(stations, hintA, sides, { capStart = false, capEnd = false, shade = null } = {}) {
    const n = stations.length, rings = [];
    for (let i = 0; i < n; i++) {
      const s = stations[i];
      const t = stations[Math.min(n - 1, i + 1)].p.clone().sub(stations[Math.max(0, i - 1)].p).normalize();
      let A = hintA.clone().addScaledVector(t, -hintA.dot(t));
      if (A.lengthSq() < 1e-6) A = V(1, 0, 0).addScaledVector(t, -t.x);
      A.normalize();
      const B = new THREE.Vector3().crossVectors(t, A).normalize();
      const ring = [];
      for (let k = 0; k < sides; k++) {
        const th = (k / sides) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
        const p = s.p.clone().addScaledVector(A, s.a * c).addScaledVector(B, s.b * sn);
        const sh = shade ? shade(th, s, p) : 1; const shk = typeof sh === 'object' ? sh.k : sh; const vi = this.vertex(p, s, shk); if (typeof sh === 'object' && sh.trim !== undefined) this.trim[vi] = sh.trim; ring.push(vi);
      }
      rings.push({ ring, t, s });
    }
    for (let i = 0; i + 1 < n; i++) for (let k = 0; k < sides; k++) {
      const a0 = rings[i].ring[k], a1 = rings[i].ring[(k + 1) % sides], b0 = rings[i + 1].ring[k], b1 = rings[i + 1].ring[(k + 1) % sides];
      this.idx.push(a0, b0, a1, a1, b0, b1);
    }
    const cap = (r, dir, sgn) => {
      const s = r.s, apexP = s.p.clone().addScaledVector(r.t, sgn * Math.min(s.a, s.b) * 0.55);
      const ap = this.vertex(apexP, s, 1);
      for (let k = 0; k < sides; k++) { const q0 = r.ring[k], q1 = r.ring[(k + 1) % sides]; if (sgn > 0) this.idx.push(q0, q1, ap); else this.idx.push(q0, ap, q1); }
    };
    if (capStart) cap(rings[0], 0, -1);
    if (capEnd) cap(rings[n - 1], 0, 1);
  }
  vertex(p, s, shade) {
    const id = this.pos.length / 3;
    this.pos.push(p.x, p.y, p.z);
    this.col.push(s.color[0] * shade, s.color[1] * shade, s.color[2] * shade);
    this.mask.push(...s.mask); this.hair.push(s.hair || 0); this.trim[id] = s.trim || 0;
    // two or three strongest bones, normalised
    const w = s.w.slice().sort((a, b) => b[1] - a[1]).slice(0, 4); const tot = w.reduce((a, e) => a + e[1], 0) || 1;
    for (let k = 0; k < 4; k++) { const e = w[k]; this.si.push(e ? this.bi[e[0]] : 0); this.sw.push(e ? e[1] / tot : 0); }
    return id;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aMask', new THREE.Float32BufferAttribute(this.mask, 4));
    g.setAttribute('aHair', new THREE.Float32BufferAttribute(this.hair, 1));
    g.setAttribute('aTrim', new THREE.Float32BufferAttribute(this.trim, 1));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(this.si), 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(new THREE.BufferAttribute(this.pos.length / 3 > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx), 1));
    g.computeVertexNormals();
    // baked form shading: surfaces facing down (under chest, armpits, behind knees, under chin) are darker
    const nr = g.attributes.normal, cl = g.attributes.color;
    for (let i = 0; i < nr.count; i++) { const ao = 0.62 + 0.38 * (0.5 + 0.5 * nr.getY(i)); cl.setXYZ(i, cl.getX(i) * ao, cl.getY(i) * ao, cl.getZ(i) * ao); }
    g.computeBoundingSphere();
    return g;
  }
}

const CLOTH = 0.8, SKIN = 0.5, HAIR = 0.06, SHOE = 0.8;
export const MANNEQUIN_BASE = { skinLum: SKIN, hairLum: HAIR, clothRef: CLOTH };
const clothCol = [CLOTH, CLOTH, CLOTH], skinCol = [SKIN, SKIN, SKIN], hairCol = [HAIR, HAIR, HAIR], shoeCol = [SHOE, SHOE, SHOE];
const M = { top: [1, 0, 0, 0], bottoms: [0, 1, 0, 0], socks: [0, 0, 1, 0], skin: [0, 0, 0, 1], none: [0, 0, 0, 0] };

/**
 * rest: name -> Vector3 (rest-pose world positions of the Bip01 bones). spec: { sex: 'm'|'f', legs: 'shorts'|'long', height, hair: bool }. detail: one of MANNEQUIN_DETAIL.
 * Returns a BufferGeometry (positions in the rest pose, skinned to the skeleton by bone name -> index map).
 */
export function buildMannequinGeometry(rest, boneIndex, spec, detail) {
  const B = new Builder(boneIndex), D = detail;
  const f = spec.sex === 'f', H = (spec.height || 1.8) / 1.8, long = spec.legs === 'long';
  const P = (n) => rest[`Bip01_${n}`].clone();
  const N = (n) => `Bip01_${n}`;
  const st = (p, a, b, w, color, mask, hair = 0, trim = 0) => ({ p, a: a * H, b: b * H, w, color, mask, hair, trim });
  const X = V(1, 0, 0), Z = V(0, 0, 1), Y = V(0, 1, 0);

  // generic limb: joints = [{ n: boneName, a, b, bulge }], per-segment fractions, appearance fn (k, f) -> { color, mask, hair }
  const limb = (joints, appear, hint, o = {}) => {
    const stations = [];
    const nseg = joints.length - 1;
    const pushS = (k, fr, pos, a, b) => {
      let wn = 0, wp = 0;
      if (k + 1 <= nseg - 1 + (o.extend ? 1 : 0) && k < nseg) wn = 0.5 * sstep(0.55, 1, fr);
      if (k > 0) wp = 0.5 * (1 - sstep(0, 0.45, fr));
      const w = [[N(joints[k].n), 1 - wn - wp]]; if (wn > 0 && joints[k + 1]) w.push([N(joints[k + 1].n), wn]); if (wp > 0) w.push([N(joints[k - 1].n), wp]);
      const ap = appear(k, fr);
      stations.push(st(pos, a, b, w, ap.color, ap.mask, ap.hair, ap.trim || 0));
    };
    if (o.extendStart) { const d = P(joints[0].n).sub(P(joints[1].n)).normalize(); const j0 = joints[0]; const ap = appear(0, 0); stations.push(st(P(j0.n).addScaledVector(d, o.extendStart), j0.a * (o.startTaper || 0.9), j0.b * (o.startTaper || 0.9), [[N(j0.n), 1]], ap.color, ap.mask, ap.hair)); }
    for (let k = 0; k < nseg; k++) {
      const p0 = P(joints[k].n), p1 = P(joints[k + 1].n);
      const fr = (k === 0 ? [0] : []).concat((o.fracs && o.fracs[k]) || D.fr);
      for (const fv of fr) {
        const pos = p0.clone().lerp(p1, fv);
        const bulge = 1 + ((joints[k].bulge || 0) * Math.sin(Math.PI * fv));
        pushS(k, fv, pos, lerp(joints[k].a, joints[k + 1].a, fv) * bulge, lerp(joints[k].b, joints[k + 1].b, fv) * bulge);
      }
    }
    if (o.extend) {
      const a = P(joints[nseg - 1].n), b = P(joints[nseg].n), d = b.clone().sub(a);
      const jl = joints[nseg]; const ap = appear(nseg - 1, 1);
      stations.push(st(b.clone().addScaledVector(d, o.extend), jl.a * (o.endTaper ?? 0.8), jl.b * (o.endTaper ?? 0.8), [[N(jl.n), 1]], ap.color, ap.mask, ap.hair));
    }
    B.sweep(stations, hint, o.sides || D.limb, { capStart: !!o.capStart, capEnd: !!o.capEnd, shade: o.shade });
  };
  const A = (color, mask, hair = 0, trim = 0) => ({ color, mask, hair, trim });
  const skinA = A(skinCol, M.skin), topA = A(clothCol, M.top), topT = A(clothCol, M.top, 0, 1), botT = A(clothCol, M.bottoms, 0, 1), botA = A(clothCol, M.bottoms), sockA = A(clothCol, M.socks);

  // ------------------------------------------------------------------ torso: waist-band (bottoms) -> sporty top -> neck
  {
    const wid = f ? [0.188, 0.130, 0.148, 0.170, 0.100] : [0.176, 0.142, 0.178, 0.214, 0.108];   // half widths at Pelvis, Spine, Spine1, Spine2, Neck
    const dep = f ? [0.108, 0.092, 0.104, 0.112, 0.072] : [0.112, 0.100, 0.114, 0.120, 0.078];
    const joints = [{ n: 'Pelvis', a: wid[0], b: dep[0] }, { n: 'Spine', a: wid[1], b: dep[1] }, { n: 'Spine1', a: wid[2], b: dep[2] }, { n: 'Spine2', a: wid[3], b: dep[3], bulge: 0.2 }, { n: 'Neck', a: wid[4], b: dep[4] }];
    limb(joints, (k, fr) => (k === 0 && fr <= 0.72 ? botA : (k === 3 && fr >= 0.9001 ? topT : topA)), X, { sides: D.torso, fracs: [[0.72, 0.7201, 1], D.torsoFr, D.torsoFr, [0.6, 0.9, 0.9001, 1]], extendStart: 0.075, startTaper: 1.06, capStart: false, capEnd: false });
    // sharp waistband edge: handled by the appear function switching at f = 0.72 of the first segment (rings are close to it for the full level)
    // neck
    { // neck: two stations, straight up into the head
      const nk = P('Neck'), hd0 = P('Head'), top = nk.clone().lerp(hd0, 0.8);
      B.sweep([st(nk.clone().add(V(0, -0.035 * H, 0)), 0.082, 0.07, [['Bip01_Neck', 1]], skinCol, M.skin), st(nk.clone().add(V(0, 0.0, 0)), 0.056, 0.056, [['Bip01_Neck', 1]], skinCol, M.skin), st(nk.clone().lerp(top, 0.5), 0.046, 0.048, [['Bip01_Neck', 0.5], ['Bip01_Head', 0.5]], skinCol, M.skin), st(top, 0.044, 0.046, [['Bip01_Head', 1]], skinCol, M.skin)], X, D.head, {});
    }
  }
  // ------------------------------------------------------------------ head: egg, subtle nose and brow shadow, optional hair cap
  {
    const hp = P('Head'), c = hp.clone().add(V(0, 0.092 * H, 0.014 * H)), hh = 0.124 * H, hw = 0.094 * H, hd = 0.104 * H;
    const stations = []; const R = D.headRings, hairy = spec.hair !== false;
    const mk = (phi, hairFlag) => {
      const y = -Math.cos(phi) * hh * (Math.cos(phi) < 0 ? 1 : 0.93), taper = 1 - 0.1 * Math.max(0, -y / hh), rr = Math.sin(phi) * taper;
      return { p: c.clone().add(V(0, y, 0)), a: hw * rr, b: hd * rr, w: [[N('Head'), 1]], color: hairFlag ? hairCol : skinCol, mask: hairFlag ? M.none : M.skin, hair: hairFlag ? 1 : 0, y };
    };
    const phiHair = Math.acos(-0.2 / 0.93 * 0 - 0.2);                  // hairline where y = +0.2 hh
    for (let i = 0; i < R; i++) {
      const phi = ((i + 0.5) / R) * Math.PI;
      if (hairy && phi > phiHair - 1e-6 && !stations.some((q) => q.hairEdge)) { const lo = mk(phiHair + 0.0005, false), hi = mk(phiHair, true); lo.hairEdge = hi.hairEdge = true; stations.push(lo, hi); }
      const y = -Math.cos(phi) * hh;
      stations.push(mk(phi, hairy && y > hh * 0.2));
    }
    stations.sort((p, q) => p.y - q.y || (p.hair || 0) - (q.hair || 0));
    B.sweep(stations, X, D.head, {
      capStart: false, capEnd: true,
      shade: (th, s) => {
        const front = Math.sin(th) > 0.25, r = s.y / hh;
        if (s.hair) return 1 + 2.4 * Math.max(0, r - 0.35) * (0.55 + 0.45 * Math.sin(th));            // soft highlight on top-front of the hair
        if (front && r > -0.1 && r < 0.2) return 0.6;                                                  // darker face plane / visor band: the facing cue
        if (front && r >= 0.2 && r < 0.3) return 0.88;
        if (r < -0.55) return 0.84;                                                                     // under the jaw
        return 1;
      },
    });
    // nose bump, ears, ponytail
    const lite = skinCol.map((v) => v * 1.06);
    B.sweep([st(c.clone().add(V(0, -0.012 * H, hd * 0.86)), 0.011, 0.012, [[N('Head'), 1]], lite, M.skin), st(c.clone().add(V(0, -0.024 * H, hd * 1.03)), 0.008, 0.009, [[N('Head'), 1]], lite, M.skin)], X, 5, { capEnd: false });
    for (const sg of [1, -1]) B.sweep([st(c.clone().add(V(sg * hw * 0.88, -0.012 * H, -0.004 * H)), 0.021, 0.027, [[N('Head'), 1]], skinCol.map((v) => v * 0.92), M.skin), st(c.clone().add(V(sg * (hw * 0.88 + 0.022 * H), -0.012 * H, -0.004 * H)), 0.010, 0.016, [[N('Head'), 1]], skinCol.map((v) => v * 0.9), M.skin)], Y, 5, { capEnd: false });
    if (f && spec.ponytail !== false && spec.hair !== false) {
      const ph = hairCol;
      B.sweep([st(c.clone().add(V(0, 0.03 * H, -hd * 0.88)), 0.03, 0.03, [[N('Head'), 1]], ph, M.none, 1), st(c.clone().add(V(0, -0.02 * H, -hd * 1.25)), 0.032, 0.032, [[N('Head'), 0.7], [N('Neck'), 0.3]], ph, M.none, 1), st(c.clone().add(V(0, -0.12 * H, -hd * 1.35)), 0.024, 0.024, [[N('Head'), 0.4], [N('Neck'), 0.6]], ph, M.none, 1), st(c.clone().add(V(0, -0.2 * H, -hd * 1.3)), 0.012, 0.012, [[N('Neck'), 1]], ph, M.none, 1)], X, 5, { capStart: true, capEnd: true, shade: (th, s2) => 1 });
    }
  }
  // ------------------------------------------------------------------ arms: shoulder yoke, sleeve, forearm, mitten hand with separate thumb
  for (const s of ['L', 'R']) {
    const sg = s === 'L' ? 1 : -1;
    const upper = f ? 0.052 : 0.058, fore = f ? 0.041 : 0.045, wr = f ? 0.029 : 0.033;
    // deltoid: a soft rounded cap over the shoulder joint, blended into clavicle and upper arm
    {
      const sh = P(`${s}_UpperArm`), el = P(`${s}_Forearm`), ax = el.clone().sub(sh).normalize(), cl = P(`${s}_Clavicle`);
      const ctr = sh.clone().lerp(cl, 0.18);
      const dw = (a2) => [[N(`${s}_UpperArm`), 1 - a2], [N(`${s}_Clavicle`), a2]];
      B.sweep([st(ctr.clone().addScaledVector(ax, -0.035), 0.040, 0.044, dw(0.6), clothCol, M.top), st(ctr.clone().addScaledVector(ax, 0.0), 0.074, 0.078, dw(0.35), clothCol, M.top), st(ctr.clone().addScaledVector(ax, 0.06), 0.070, 0.072, dw(0.1), clothCol, M.top)], Z, D.limb, { capStart: true });
    }
    limb([{ n: `${s}_UpperArm`, a: upper * 1.28, b: upper * 1.28 }, { n: `${s}_Forearm`, a: fore * 1.12, b: fore * 1.1, bulge: 0.0 }, { n: `${s}_Hand`, a: wr, b: wr * 0.88 }],
      (k, fr) => (k === 0 && fr <= 0.4 ? (fr >= 0.3401 ? topT : topA) : skinA), Z, { sides: D.limb, fracs: [D.fr.length > 1 ? [0.15, 0.34, 0.3401, 0.4, 0.4001, 0.7, 1] : [0.34, 0.3401, 0.4, 0.4001, 1], D.fr.length > 1 ? [0.45, 1] : [1]], capStart: false });
    // hand: palm + four fingers merged into one slightly curved slab (with two subtle crease lines), thumb as a separate tapered tube
    const across = P(`${s}_Finger4`).sub(P(`${s}_Finger1`)).normalize();
    const hw = f ? 0.036 : 0.041, hth = f ? 0.0155 : 0.0175;
    const pj = [{ n: `${s}_Hand`, a: hw * 0.82, b: hth * 1.1 }, { n: `${s}_Finger2`, a: hw, b: hth }, { n: `${s}_Finger21`, a: hw * 0.92, b: hth * 0.86 }, { n: `${s}_Finger22`, a: hw * 0.78, b: hth * 0.72 }];
    limb(pj, (k, fr) => ({ color: skinCol.map((v) => v * ((k === 1 && fr > 0.45 && fr < 0.99) || (k === 2 && fr > 0.45 && fr < 0.99) ? 0.84 : 1)), mask: M.skin, hair: 0 }), across,
      { sides: D.hand, fracs: [[0.5, 1], [0.5, 1], [0.5, 1]], extend: 0.85, endTaper: 0.62, capEnd: true, shade: (th) => (Math.sin(th) < -0.4 ? 0.9 : 1) });
    const tj = [{ n: `${s}_Finger0`, a: 0.0185, b: 0.0185 }, { n: `${s}_Finger01`, a: 0.0165, b: 0.0165 }, { n: `${s}_Finger02`, a: 0.0145, b: 0.0145 }];
    limb(tj, () => skinA, across, { sides: Math.max(4, D.hand - 1), fracs: [[0.5, 1], [0.5, 1]], extend: 0.9, endTaper: 0.65, capEnd: true });
    void sg;
  }
  // ------------------------------------------------------------------ legs (+ shoes)
  for (const s of ['L', 'R']) {
    const th = f ? 0.104 : 0.106, kn = f ? 0.066 : 0.07, an = f ? 0.044 : 0.047;
    const hemT = long ? 2 : 0.62;               // fraction of the thigh covered by the shorts (2 = all)
    limb([{ n: `${s}_Thigh`, a: th, b: th * 1.02 }, { n: `${s}_Calf`, a: kn, b: kn * 1.05 }, { n: `${s}_Foot`, a: an, b: an * 1.05 }],
      (k, fr) => {
        if (long) return k === 1 && fr > 0.9 ? sockA : botA;
        if (k === 0) return fr <= hemT + 1e-9 ? (fr >= 0.5501 ? botT : botA) : skinA;
        return fr >= 0.58 ? sockA : skinA;
      },
      Z, { extendStart: 0.05, startTaper: 1.0, sides: D.limb, fracs: [D.fr.length > 1 ? [0.3, 0.55, 0.5501, 0.62, 0.6201, 1] : [0.55, 0.5501, 0.62, 0.6201, 1], D.fr.length > 1 ? [0.3, 0.5799, 0.58, 1] : [0.5799, 0.58, 1]], capStart: false });
    // shoe: rounded upper in the shoe colour, white sole line, accent toe cap and ankle collar; tinted by setKit({ shoes, trim })
    const ank = P(`${s}_Foot`), toe = P(`${s}_Toe0`), fs = f ? 0.94 : 1;
    const heel = V(ank.x, 0.05 * H, ank.z - 0.075 * H), mid = V(ank.x, 0.062 * H, ank.z + 0.04 * H), ball = V(toe.x, 0.046 * H, toe.z), tip = V(toe.x, 0.036 * H, toe.z + 0.072 * H);
    const sw = (fv) => [[N(`${s}_Foot`), 1 - fv], [N(`${s}_Toe0`), fv]];
    const shoeSt = [[heel, 0.040, 0.046, 0, 0], [mid, 0.048, 0.054, 0, 0], [ball, 0.050, 0.044, 0.7, 0], [tip, 0.038, 0.034, 1, 1]].map(([p2, a2, b2, w2, tr]) => st(p2, a2 * fs, b2 * fs, sw(w2), shoeCol, M.none, -1, tr));
    B.sweep(shoeSt, X, D.limb, { capStart: true, capEnd: true, shade: (th, s2, p2) => (p2.y < 0.022 * H ? { k: 1, trim: 2 } : 1) });
    B.sweep([st(ank.clone().add(V(0, 0.012 * H, -0.004)), 0.048 * fs, 0.052 * fs, [[N(`${s}_Foot`), 1]], shoeCol, M.none, -1, 1), st(ank.clone().add(V(0, 0.042 * H, -0.004)), 0.044 * fs, 0.047 * fs, [[N(`${s}_Foot`), 0.5], [N(`${s}_Calf`), 0.5]], shoeCol, M.none, -1, 1)], X, D.limb, { capEnd: false });
  }
  return B.geometry();
}

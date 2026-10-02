// Cricket clothing and equipment as ONE skinned mesh per person (cloth, plus the hard gear: helmet, grille,
// pads, gloves), bound to the athlete's own skeleton: trouser legs bend at the knee, sleeves follow the arms,
// pads and gloves ride the shin and the hand. All geometry is generated in the rest pose (A-pose, root at identity).
// Three.js here is the vendored subset, so BufferGeometry/SkinnedMesh/BufferAttribute are reached through instances.
import { THREE } from '../vendor3d/index.js';

const BoxG = THREE.BoxGeometry;
const BufferGeometry = Object.getPrototypeOf(BoxG.prototype).constructor;
const Attr = new BoxG().attributes.position.constructor; // Float32BufferAttribute
const Attr16 = new BoxG().index.constructor; // Uint16BufferAttribute (counts stay below 65k per accumulator)

const SRGB = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const V = THREE.Vector3;

class Acc {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.si = []; this.sw = []; this.idx = []; }
  get count() { return this.pos.length / 3; }
}

export class GearBuilder {
  constructor(h) {
    this.h = h;
    h.model.updateMatrixWorld(true);
    let sm = null;
    h.model.traverse((o) => { if (o.isSkinnedMesh && !sm) sm = o; });
    this.sm = sm;
    this.skeleton = sm.skeleton;
    this.cloth = new Acc(); this.hard = new Acc();
    this.bidx = {};
    this.skeleton.bones.forEach((b, i) => { this.bidx[b.name] = i; });
    this.rest = (name) => h.bones[`Bip01_${name}`].getWorldPosition(new V());
    this.restM = (name) => h.bones[`Bip01_${name}`].matrixWorld;
  }

  bi(name) { return this.bidx[`Bip01_${name}`]; }

  /** Parametric surface f(u,v)->[x,y,z] sampled (nu+1)x(nv+1); u wraps when closed. w(u,v,p) -> [[boneIdx, weight],...]; orient(p)->outward ref */
  surface(acc, nu, nv, f, color, w, { outward = null, flip = false, rough = null } = {}) {
    const base = acc.count;
    const P = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) P.push(f(i / nu, j / nv));
    const eps = 1e-3;
    const nrm = (i, j) => {
      const u = i / nu, v = j / nv;
      const p = f(u, v), pu = f(Math.min(1, u + eps), v), pv = f(u, Math.min(1, v + eps));
      const pu0 = f(Math.max(0, u - eps), v), pv0 = f(u, Math.max(0, v - eps));
      const du = new V(pu[0] - pu0[0], pu[1] - pu0[1], pu[2] - pu0[2]), dv = new V(pv[0] - pv0[0], pv[1] - pv0[1], pv[2] - pv0[2]);
      const n = du.cross(dv);
      if (n.lengthSq() < 1e-14) return new V(0, 1, 0);
      n.normalize();
      if (outward) { const o = outward(p, u, v); if (n.x * o[0] + n.y * o[1] + n.z * o[2] < 0) n.negate(); } else if (flip) n.negate();
      return n;
    };
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const p = P[j * (nu + 1) + i];
        const n = nrm(i, j);
        acc.pos.push(p[0], p[1], p[2]); acc.nor.push(n.x, n.y, n.z);
        const c = typeof color === 'function' ? color(i / nu, j / nv) : color;
        acc.col.push(c[0], c[1], c[2]);
        const ws = w(i / nu, j / nv, p);
        let tot = 0; for (const x of ws) tot += x[1];
        for (let k = 0; k < 4; k++) { const x = ws[k]; acc.si.push(x ? x[0] : 0); acc.sw.push(x ? x[1] / tot : 0); }
      }
    }
    // the u/v orientation is arbitrary; the vertex normal sign is fixed by `outward`, so wind the triangles to agree with it
    const mj = Math.floor(nv / 2), mi = Math.floor(nu / 2);
    const ia = base + mj * (nu + 1) + mi;
    const pa = new V(acc.pos[ia * 3], acc.pos[ia * 3 + 1], acc.pos[ia * 3 + 2]);
    const pb = new V(acc.pos[(ia + 1) * 3], acc.pos[(ia + 1) * 3 + 1], acc.pos[(ia + 1) * 3 + 2]);
    const pc = new V(acc.pos[(ia + nu + 1) * 3], acc.pos[(ia + nu + 1) * 3 + 1], acc.pos[(ia + nu + 1) * 3 + 2]);
    const geo = pc.clone().sub(pa).cross(pb.clone().sub(pa));
    const vn = new V(acc.nor[ia * 3], acc.nor[ia * 3 + 1], acc.nor[ia * 3 + 2]);
    const ccw = geo.dot(vn) > 0;
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = base + j * (nu + 1) + i, b = a + 1, c = a + (nu + 1), d = c + 1;
        if (ccw) acc.idx.push(a, c, b, b, c, d); else acc.idx.push(a, b, c, b, d, c);
      }
    }
  }

  /** Ellipsoid: centre c (world rest), basis axes a,b,d (vectors including radii). Optionally only the upper cap (t0..t1 of polar angle). */
  ellipsoid(acc, c, ax, ay, az, color, weights, { nu = 18, nv = 10, v0 = 0, v1 = 1 } = {}) {
    const f = (u, v) => {
      const th = (v0 + (v1 - v0) * v) * Math.PI, ph = u * Math.PI * 2;
      const s = Math.sin(th), x = s * Math.cos(ph), z = s * Math.sin(ph), y = Math.cos(th);
      return [c.x + ax.x * x + ay.x * y + az.x * z, c.y + ax.y * x + ay.y * y + az.y * z, c.z + ax.z * x + ay.z * y + az.z * z];
    };
    this.surface(acc, nu, nv, f, color, typeof weights === 'function' ? weights : () => weights, { outward: (p) => [p[0] - c.x, p[1] - c.y, p[2] - c.z] });
  }

  /** Tube along pts[i] = { p: V3, rx, rz, w: [[bone,w]], c: color } ; ring axes: z = zref (forward), x = side */
  tube(acc, pts, { nu = 14, color = [1, 1, 1], zref = new V(0, 0, 1), closeEnds = false, segSub = 1 } = {}) {
    const n = pts.length;
    const ctr = (v) => {
      const s = v * (n - 1), i = Math.min(n - 2, Math.floor(s)), t = s - i;
      const A = pts[i], B = pts[i + 1];
      return { p: new V().lerpVectors(A.p, B.p, t), rx: A.rx + (B.rx - A.rx) * t, rz: A.rz + (B.rz - A.rz) * t, i, t };
    };
    const tan = (v) => { const e = 1 / (n * 50); const a = ctr(Math.max(0, v - e)).p, b = ctr(Math.min(1, v + e)).p; return b.sub(a).normalize(); };
    const f = (u, v) => {
      const c = ctr(v), tg = tan(v);
      const zr = zref.clone().addScaledVector(tg, -zref.dot(tg)).normalize();
      const xr = new V().crossVectors(tg, zr).normalize();
      const th = u * Math.PI * 2;
      return [c.p.x + zr.x * c.rz * Math.cos(th) + xr.x * c.rx * Math.sin(th), c.p.y + zr.y * c.rz * Math.cos(th) + xr.y * c.rx * Math.sin(th), c.p.z + zr.z * c.rz * Math.cos(th) + xr.z * c.rx * Math.sin(th)];
    };
    const wf = (u, v) => {
      const s = v * (n - 1), i = Math.min(n - 2, Math.floor(s)), t = s - i;
      const m = new Map();
      for (const [b, w] of pts[i].w) m.set(b, (m.get(b) || 0) + w * (1 - t));
      for (const [b, w] of pts[i + 1].w) m.set(b, (m.get(b) || 0) + w * t);
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    };
    const colf = (u, v) => { const s = v * (n - 1), i = Math.min(n - 2, Math.floor(s)); return pts[i].c || color; };
    const outw = (p, u, v) => { const c = ctr(v).p; return [p[0] - c.x, p[1] - c.y, p[2] - c.z]; };
    this.surface(acc, nu, n * segSub, f, colf, wf, { outward: outw });
    return { f, ctr };
  }

  /** Thin cylinder (a bar) between two world rest points, rigid to a bone. */
  bar(acc, a, b, rad, color, bone, nu = 6) {
    const tg = b.clone().sub(a);
    const ref = Math.abs(tg.clone().normalize().y) > 0.9 ? new V(1, 0, 0) : new V(0, 1, 0);
    this.tube(acc, [{ p: a, rx: rad, rz: rad, w: [[this.bi(bone), 1]] }, { p: b, rx: rad, rz: rad, w: [[this.bi(bone), 1]] }], { nu, color, zref: ref });
  }

  build(accumulator, { rough = 0.8, metal = 0, name = 'gear' } = {}) {
    const a = accumulator;
    if (!a.pos.length) return null;
    const g = new BufferGeometry();
    g.setAttribute('position', new Attr(new Float32Array(a.pos), 3));
    g.setAttribute('normal', new Attr(new Float32Array(a.nor), 3));
    g.setAttribute('color', new Attr(new Float32Array(a.col), 3));
    g.setAttribute('skinIndex', new Attr16(new Uint16Array(a.si), 4));
    g.setAttribute('skinWeight', new Attr(new Float32Array(a.sw), 4));
    if (a.count > 65000) throw new Error('gear: too many vertices');
    g.setIndex(new Attr16(new Uint16Array(a.idx), 1));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal, side: 2 });
    const SM = this.sm.constructor;
    const mesh = new SM(g, mat);
    mesh.name = name;
    mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.bind(this.skeleton, this.sm.bindMatrix.clone());
    this.sm.parent.add(mesh);
    return mesh;
  }
}

// ------------------------------------------------------------------------------------------------------------------
// Garments and equipment. All sizes are for the 1.80 m athlete (rest pose, A-pose, facing +Z).
export function buildPerson(h, rig, spec) {
  const gb = new GearBuilder(h);
  const { cloth, hard } = gb;
  const bi = (n) => gb.bi(n);
  const R = (n) => gb.rest(n);
  const col = {};
  for (const k of ['shirt', 'trousers', 'trim', 'helmet', 'cap', 'pad', 'strap', 'glove', 'gloveTrim', 'grille', 'sleeve', 'skin', 'boot']) if (spec[k]) col[k] = SRGB(spec[k]);
  h.root.position.set(0, 0, 0); h.root.rotation.y = 0;
  h._writePose(h.restPose, true); h.root.updateMatrixWorld(true);

  const side = ['L', 'R'];
  // ---- trousers (long) -------------------------------------------------------------------------------------------------
  if (spec.trousers) {
    for (const s of side) {
      const hip = R(`${s}_Thigh`), knee = R(`${s}_Calf`), ank = R(`${s}_Foot`);
      const T = bi(`${s}_Thigh`), C = bi(`${s}_Calf`), F = bi(`${s}_Foot`), P = bi('Pelvis');
      const mid1 = hip.clone().lerp(knee, 0.5), mid2 = knee.clone().lerp(ank, 0.5);
      const pts = [
        { p: hip.clone().add(new V(0.0, 0.07, 0)), rx: 0.108, rz: 0.115, w: [[P, 0.6], [T, 0.4]] },
        { p: hip.clone().add(new V(0, -0.02, 0)), rx: 0.104, rz: 0.108, w: [[T, 0.9], [P, 0.1]] },
        { p: mid1, rx: 0.104, rz: 0.106, w: [[T, 1]] },
        { p: knee.clone().add(new V(0, 0.09, 0)), rx: 0.104, rz: 0.110, w: [[T, 0.85], [C, 0.15]] },
        { p: knee.clone(), rx: 0.106, rz: 0.114, w: [[T, 0.5], [C, 0.5]] },
        { p: knee.clone().add(new V(0, -0.09, 0)), rx: 0.096, rz: 0.104, w: [[C, 0.85], [T, 0.15]] },
        { p: mid2, rx: 0.072, rz: 0.076, w: [[C, 1]] },
        { p: ank.clone().add(new V(0, 0.06, 0.005)), rx: 0.058, rz: 0.062, w: [[C, 0.8], [F, 0.2]] },
        { p: ank.clone().add(new V(0, 0.0, 0.01)), rx: 0.060, rz: 0.066, w: [[C, 0.3], [F, 0.7]] },
      ];
      gb.tube(cloth, pts, { nu: 12, color: col.trousers, segSub: 1 });
    }
    // waist band
    const pel = R('Pelvis');
    gb.tube(cloth, [
      { p: pel.clone().add(new V(0, 0.08, -0.004)), rx: 0.172, rz: 0.12, w: [[bi('Pelvis'), 1]] },
      { p: pel.clone().add(new V(0, 0.145, -0.006)), rx: 0.166, rz: 0.118, w: [[bi('Pelvis'), 0.6], [bi('Spine'), 0.4]] },
    ], { nu: 20, color: col.trousers });
  }
  // ---- sleeves ------------------------------------------------------------------------------------------------------------
  if (spec.sleeves) {
    for (const s of side) {
      const sh = R(`${s}_UpperArm`), el = R(`${s}_Forearm`), wr = R(`${s}_Hand`);
      const U = bi(`${s}_UpperArm`), Fo = bi(`${s}_Forearm`), Cl = bi(`${s}_Clavicle`);
      const long = spec.sleeves === 'long';
      const sx = s === 'L' ? 1 : -1;
      const pts = [
        { p: sh.clone().add(new V(-0.012 * sx, 0.012, -0.004)), rx: 0.074, rz: 0.076, w: [[Cl, 0.35], [U, 0.65]] },
        { p: sh.clone().lerp(el, 0.35), rx: 0.066, rz: 0.068, w: [[U, 1]] },
        { p: sh.clone().lerp(el, 0.75), rx: 0.060, rz: 0.062, w: [[U, 1]] },
      ];
      if (long) { pts.push({ p: el.clone(), rx: 0.056, rz: 0.058, w: [[U, 0.5], [Fo, 0.5]] }); pts.push({ p: el.clone().lerp(wr, 0.55), rx: 0.050, rz: 0.052, w: [[Fo, 1]] }); pts.push({ p: el.clone().lerp(wr, 0.88), rx: 0.044, rz: 0.046, w: [[Fo, 1]] }); }
      else { pts.push({ p: sh.clone().lerp(el, 0.80), rx: 0.060, rz: 0.062, w: [[U, 1]], c: col.gloveTrim || col.sleeve }); pts.push({ p: sh.clone().lerp(el, 0.86), rx: 0.060, rz: 0.062, w: [[U, 1]], c: col.gloveTrim || col.sleeve }); pts.push({ p: sh.clone().lerp(el, 0.90), rx: 0.060, rz: 0.062, w: [[U, 1]] }); }
      gb.tube(cloth, pts, { nu: 14, color: col.sleeve || col.shirt, zref: new V(0, 0, 1) });
    }
  }
  // ---- batting pads ---------------------------------------------------------------------------------------------------------
  if (spec.pads) {
    for (const s of side) {
      const knee = R(`${s}_Calf`), ank = R(`${s}_Foot`);
      const T = bi(`${s}_Thigh`), C = bi(`${s}_Calf`), F = bi(`${s}_Foot`);
      const fwd = new V(0, 0, 0.085);
      const top = knee.clone().add(new V(0, 0.19, 0.0)).add(fwd), bot = ank.clone().add(new V(0, 0.07, 0.0)).add(fwd);
      const lens = [];
      const N = 7;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const p = top.clone().lerp(bot, t);
        const kneeBlend = Math.max(0, 1 - t * 4);
        const w = t < 0.25 ? [[T, 0.55 * (1 - t * 4) + 0.1], [C, 1 - (0.55 * (1 - t * 4) + 0.1)]] : [[C, 1]];
        const wid = 0.066 + 0.012 * (1 - t) + (t > 0.9 ? -0.014 : 0);
        lens.push({ p, rx: wid + 0.012, rz: 0.052 + 0.012 * kneeBlend, w, c: (i === 2 || i === 4 || i === 6) ? col.strap : col.pad });
      }
      gb.tube(hard, lens, { nu: 10, color: col.pad, segSub: 1 });
    }
  }
  // ---- helmet / cap ----------------------------------------------------------------------------------------------------------
  const headIdx = bi('Head');
  const head = R('Head');
  if (spec.helmet) {
    const c = head.clone().add(new V(0, 0.105, 0.012));
    // shell: ellipsoid, upper two thirds, then a skirt down the sides and back
    gb.ellipsoid(hard, c, new V(0.118, 0, 0), new V(0, 0.118, 0), new V(0, 0, 0.138), col.helmet, [[headIdx, 1]], { nu: 40, nv: 16, v0: 0, v1: 0.60 });
    // peak
    gb.ellipsoid(hard, head.clone().add(new V(0, 0.150, 0.125)), new V(0.092, 0, 0), new V(0, 0.012, 0), new V(0, 0, 0.056), col.helmet, [[headIdx, 1]], { nu: 14, nv: 8 });
    // grille: vertical bars from the peak down to the chin line plus three horizontal rings
    const zf = 0.158;
    for (let k = -3; k <= 3; k++) {
      const x = k * 0.026;
      const a = head.clone().add(new V(x, 0.128, zf - Math.abs(x) * 0.55 + 0.01)), b = head.clone().add(new V(x * 0.92, 0.02, zf - Math.abs(x) * 0.75 + 0.02));
      gb.bar(hard, a, b, 0.0045, col.grille, 'Head', 5);
    }
    for (const yy of [0.115, 0.08, 0.045]) {
      const pts = [];
      for (let k = -4; k <= 4; k++) { const x = k * 0.0255; pts.push({ p: head.clone().add(new V(x, yy, zf - Math.abs(x) * 0.62 + 0.012 - (0.13 - yy) * 0.07)), rx: 0.0045, rz: 0.0045, w: [[headIdx, 1]] }); }
      gb.tube(hard, pts, { nu: 5, color: col.grille });
    }
  }
  if (spec.cap) {
    const c = head.clone().add(new V(0, 0.150, 0.004));
    gb.ellipsoid(hard, c, new V(0.113, 0, 0), new V(0, 0.082, 0), new V(0, 0, 0.126), col.cap, [[headIdx, 1]], { nu: 20, nv: 10, v0: 0, v1: 0.55 });
    gb.ellipsoid(hard, head.clone().add(new V(0, 0.138, 0.120)), new V(0.078, 0, 0), new V(0, 0.008, 0), new V(0, 0, 0.058), col.cap, [[headIdx, 1]], { nu: 14, nv: 8 });
  }
  if (spec.hat) { // umpire's wide-brim hat
    gb.ellipsoid(hard, head.clone().add(new V(0, 0.150, 0.004)), new V(0.112, 0, 0), new V(0, 0.082, 0), new V(0, 0, 0.122), col.cap, [[headIdx, 1]], { nu: 18, nv: 8, v0: 0, v1: 0.55 });
    gb.ellipsoid(hard, head.clone().add(new V(0, 0.128, 0.004)), new V(0.19, 0, 0), new V(0, 0.010, 0), new V(0, 0, 0.19), col.cap, [[headIdx, 1]], { nu: 20, nv: 6 });
  }
  // ---- gloves: the library mannequin's mitt hands already carry a wrist cuff in the kit's `trim` colour (cast.js sets it to the glove colour), so no cuff is added here
  // cloth and hard gear are drawn as ONE skinned mesh (one draw call per dressed person): the hard parts are appended to the cloth accumulator
  const base = cloth.count;
  cloth.pos.push(...hard.pos); cloth.nor.push(...hard.nor); cloth.col.push(...hard.col); cloth.si.push(...hard.si); cloth.sw.push(...hard.sw);
  for (const i of hard.idx) cloth.idx.push(i + base);
  return { cloth: gb.build(cloth, { rough: 0.7, metal: 0.03, name: 'gear' }), hard: null };
}

// ------------------------------------------------------------------------------------------------------------------
// Props that are not skinned: the bat (origin at the butt, +Y along the handle and blade, face towards +Z) and the ball.

export function buildBat({ blade = '#e3c690', grip = '#23272e', accent = '#1f6f78' } = {}) {
  const S = THREE;
  const acc = new Acc();
  const w = () => [[0, 1]];
  const col = (hex) => SRGB(hex);
  // handle (rubber grip with a coloured band) -> shoulders -> blade with a rounded back (spine) and a flat face (+Z)
  const mk = (y, rx, rz, zc, c) => ({ p: new V(0, y, zc), rx, rz, w: w(), c });
  const pts = [
    mk(0.000, 0.0125, 0.0125, 0, col(grip)), mk(0.020, 0.0150, 0.0150, 0, col(grip)), mk(0.130, 0.0150, 0.0150, 0, col(accent)), mk(0.145, 0.0150, 0.0150, 0, col(grip)),
    mk(0.270, 0.0150, 0.0150, 0, col(grip)), mk(0.300, 0.0190, 0.0170, 0, col('#d9b27a')),
    mk(0.360, 0.045, 0.026, -0.004, col(blade)), mk(0.420, 0.054, 0.032, -0.008, col(blade)),
    mk(0.600, 0.054, 0.036, -0.010, col(blade)), mk(0.760, 0.054, 0.034, -0.009, col(blade)), mk(0.835, 0.050, 0.028, -0.006, col('#caa56d')), mk(0.850, 0.040, 0.018, -0.003, col('#b8935c')),
  ];
  const ctx = Object.create(GearBuilder.prototype);
  ctx.bidx = {}; ctx.sm = null;
  ctx.tube(acc, pts, { nu: 16, zref: new V(0, 0, 1), color: col(blade) });
  // end caps are not needed (the toe is covered by the next tube section); a small cap on the butt
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Attr(new Float32Array(acc.pos), 3));
  geo.setAttribute('normal', new Attr(new Float32Array(acc.nor), 3));
  geo.setAttribute('color', new Attr(new Float32Array(acc.col), 3));
  geo.setIndex(new Attr16(new Uint16Array(acc.idx), 1));
  const mesh = new S.Mesh(geo, new S.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }));
  mesh.castShadow = true;
  const g = new S.Group(); g.add(mesh); g.name = 'bat';
  return g;
}

export function buildBall(kind = 'leather') {
  const S = THREE;
  const tennis = kind === 'tennis';
  const r = tennis ? 0.034 : 0.0365;
  const g = new S.Group(); g.name = 'ball';
  // ONE mesh (one draw call): the seam is a pale band painted into the vertex colours around the equator (leather) or a wider band (tennis)
  const geo = new S.SphereGeometry(r, 20, 16);
  const base = SRGB(tennis ? 0xcfe63a : 0xb3121b), seam = SRGB(tennis ? 0xf4f4e6 : 0xe9dcc0);
  const P = geo.attributes.position, col = new Float32Array(P.count * 3), band = r * (tennis ? 0.2 : 0.14);
  for (let i = 0; i < P.count; i++) { const k = Math.max(0, 1 - Math.abs(P.getY(i)) / band); const c = k > 0 ? seam : base; col.set(c, i * 3); }
  geo.setAttribute('color', new Attr(col, 3));
  const body = new S.Mesh(geo, new S.MeshStandardMaterial({ vertexColors: true, roughness: tennis ? 0.9 : 0.5 }));
  body.castShadow = true; g.add(body);
  g.userData.radius = r;
  return g;
}

// Real 3D girls in hanbok on the seesaw (presentation only: reads the same parameters the 2D picture is drawn from, never writes back).
//
// The shared view3d layer supplies the person (athlete_f), the stage and the foot IK. This file dresses her (a flared chima skirt that follows the
// hips and flares as she lands, jeogori sleeves with cuffs, a collar and a long ribbon, a braid with a ribbon) and poses her procedurally on
// the skeleton: feet planted on the board end, knees bent as she loads it, arms swinging, a tucked jump. The picture is rendered into an
// off-screen WebGL canvas with an exact orthographic camera (1 metre = the 2D picture's pixels per metre) and composited by the 2D scene.
import { createStage, loadHuman, Clip, CLIP_BONES, semanticRot, THREE } from '../vendor3d/index.js';

const { Vector3, Quaternion, Euler } = THREE;
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const bi = (n) => CLIP_BONES.indexOf(`Bip01_${n}`);

// the shipped athlete is 1.74 m; the 2D girls are about 1.55 m
const BODY_SCALE = 0.9;
const YAW_TURN = 0.5;         // radians each girl turns towards the camera so the face reads (0 = pure profile)


// ---- arms: a real counter-balance cycle -------------------------------------------------------------------------------------------
// Keys are [shoulder flex (forward/up), shoulder abduct (out to the side), elbow bend, wrist] in degrees over the flight (u = 0 take-off,
// 0.5 apex, 1 touch-down). The arms swing up and OUT through the launch, hang spread and only a little forward at the apex with soft
// elbows and loose wrists, then come down and in to cushion the landing. Everything is a pure function of the phase (no integrator),
// so a still, a replay and a strip all show the same pose; per-person phase and amplitude make every girl a little different.
const AIR_KEYS = [
  [22, 70, 28], [8, 80, 24], [0, 70, 26], [2, 42, 36], [3, 16, 46],
];
const cr = (a, b, c, d, t) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
function airArm(u) {
  const x = clamp(u, 0, 1) * 4, i = Math.min(3, Math.floor(x)), t = x - i, K = AIR_KEYS;
  const k = (j) => K[clamp(j, 0, 4)];
  return [0, 1, 2].map((c) => cr(k(i - 1)[c], k(i)[c], k(i + 1)[c], k(i + 2)[c], t));
}
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const backOut = (x, k = 1.5) => { x = clamp(x, 0, 1) - 1; return 1 + (k + 1) * x * x * x + k * x * x; };
// ground arms (the owner-approved crouch pose is this exact formula)
function groundArm(armRad, open) {
  const adeg = clamp(armRad * 180 / Math.PI, -60, 175);
  return [adeg, 8 + open * 14 + (adeg > 120 ? 4 : 0), clamp(18 + Math.abs(adeg - 70) * 0.12, 8, 52)];
}
// one arm: ph = { k: 'ground'|'swing'|'air'|'land', p }, returns [flex, abduct, elbow, wrist]
function armPose(it, side, t, seed) {
  const ph = it.ph || { k: 'ground', p: 0 };
  const sd = side === 'R' ? 1 : 0;
  const amp = 0.9 + 0.16 * Math.sin(seed * 12.9898) ;           // per-person amplitude
  const lag = 0.022 * sd + 0.012 * Math.sin(seed * 3.1);         // the second arm follows a hair later
  const crouch = clamp(it.crouch, 0, 1);
  const gArm = it.armG !== undefined ? it.armG : it.arm;
  const idle = (1 - crouch) * (side === 'L' ? 1 : -1);
  const sway = 1.6 * Math.sin(t * 1.3 + seed * 5 + sd * 1.1) * (1 - crouch);   // breathing sway of the loose arms on the ground
  let G = groundArm(gArm, it.open ?? 0);
  G = [G[0] + sway, G[1] + 0.8 * idle * Math.sin(t * 0.9 + seed), G[2] + (side === 'R' ? 4 : 0) + (crouch > 0.4 ? 10 : 0)];
  const hgt = clamp(0.55 + (it.H ?? 1.2) * 0.3, 0.6, 1.1);    // low hops: smaller arm swing
  const scale = (a) => [a[0] * hgt * amp, Math.max(6, a[1] * (0.7 + 0.3 * hgt) * amp), a[2]];
  let a;
  if (ph.k === 'swing') {
    // the board loads: arms sweep up and out from the crouch, overshooting a little
    const e = backOut(smooth((ph.p - lag * 3)), 1.2);
    const tgt = scale(airArm(0));
    a = [G[0] + (tgt[0] - G[0]) * e, G[1] + (tgt[1] - G[1]) * e, G[2] + (tgt[2] - G[2]) * e];
  } else if (ph.k === 'air') {
    a = scale(airArm(ph.u + lag));
  } else if (ph.k === 'land') {
    // cushion: the arms are in and low, springing out to the relaxed stance with a small bounce
    const e = smooth(ph.p * 1.2), bounce = Math.sin(clamp(ph.p, 0, 1) * Math.PI) * 6;
    const from = scale(airArm(1));
    a = [from[0] + (G[0] - from[0]) * e + bounce * 0.4, from[1] + (G[1] - from[1]) * e, from[2] + (G[2] - from[2]) * e + bounce];
  } else a = G;
  // wrist: trails the motion of the arm (a finite difference of the same curve), relaxed fingers
  let wr = 0;
  if (ph.k === 'air' || ph.k === 'swing') {
    const prev = ph.k === 'air' ? scale(airArm(ph.u + lag - 0.06)) : scale(airArm(0));
    wr = clamp((prev[0] - a[0]) * 0.7 + (prev[1] - a[1]) * 0.25, -32, 32);
  }
  return [a[0], a[1], a[2], wr];
}

// ---------------------------------------------------------------------------------------------------------------------------------
class Girl {
  constructor(human, look) {
    this.h = human; this.look = look;
    this.clip = new Clip({ name: 'pose', frames: 1, dur: 1 / 30, fps: 30, loop: true, quats: new Float32Array(CLIP_BONES.length * 4), pelvis: new Float32Array(3), grounded: false, fingers: 'relaxed' });
    human.addClip(this.clip);
    human.groundClamp = 'off'; human.footPlanting = false;
    this.restQ = new Float32Array(human.restPose.q);
    this.e = new Euler(); this.qa = new Quaternion(); this.qb = new Quaternion();
    this.ph = human.pelvisHeight;
    human.play(this.clip, { fade: 0 });
    this.vel = 0;             // smoothed vertical speed, drives the cloth
    this.sw = 0;              // braid sway
    this.swV = 0;
  }

  // offs: { Bone: { flex, side, twist, abduct, rot } } on top of the rest pose; pel = [left, up, forward] metres
  writePose(offs, pel) {
    const q = this.clip.quats;
    q.set(this.restQ);
    for (const n in offs) {
      const i = bi(n); if (i < 0) continue;
      const r = semanticRot(`Bip01_${n}`, offs[n]);
      this.qa.set(q[i * 4], q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3]);
      this.qb.setFromEuler(this.e.set(r[0] * D2R, r[1] * D2R, r[2] * D2R, 'XYZ'));
      this.qa.multiply(this.qb);
      q[i * 4] = this.qa.x; q[i * 4 + 1] = this.qa.y; q[i * 4 + 2] = this.qa.z; q[i * 4 + 3] = this.qa.w;
    }
    this.clip.pelvis[0] = pel[0] / this.ph; this.clip.pelvis[1] = pel[1] / this.ph; this.clip.pelvis[2] = pel[2] / this.ph;
  }
}

// ---- clothes ----------------------------------------------------------------------------------------------------------------------
// A limb piece parented to a bone, spanning from `a` to `b` of the bone->child distance (a, b in 0..1), radii r0 -> r1.
function limbPiece(human, bone, child, r0, r1, mat, a = 0, b = 1, flat = 1) {
  const bb = human.bones[`Bip01_${bone}`], cb = human.bones[`Bip01_${child}`];
  const p0 = bb.getWorldPosition(new Vector3()), p1 = cb.getWorldPosition(new Vector3());
  const dir = p1.clone().sub(p0), len = dir.length();
  const inv = bb.getWorldQuaternion(new Quaternion()).invert();
  const dl = dir.clone().normalize().applyQuaternion(inv);
  const geo = new THREE.CylinderGeometry(r1, r0, len * (b - a), 16, 1, true);       // top (+Y) is the far end
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(1, 1, flat);
  const mid = p0.clone().lerp(p1, (a + b) / 2).sub(p0).applyQuaternion(inv);
  m.position.copy(mid);
  m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dl);
  bb.add(m);
  return m;
}
function ring(human, bone, child, r, at, thick, mat) {
  const m = limbPiece(human, bone, child, r, r, mat, at - thick / 2, at + thick / 2);
  return m;
}

// Sleeves, cuffs, collar and a ribbon on the chest, parented to bones. Colours come from the outfit.
function dress(human, o) {
  human._applyRest(); human.root.updateMatrixWorld(true);
  const std = (hex, rough = 0.62) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0, side: THREE.DoubleSide });
  const jeo = std(o.jeo), cuff = std(o.collar), trim = std(o.trim), skin = o.skinMat;
  const out = { mats: { jeo, cuff, trim }, parts: [] };
  for (const s of ['L', 'R']) {
    // sleeve: a little wider than the arm, bell towards the wrist (the jeogori sleeve), a white cuff band and a coloured stripe above it
    out.parts.push(limbPiece(human, `${s}_UpperArm`, `${s}_Forearm`, 0.066, 0.064, jeo, -0.02, 1.02));
    out.parts.push(limbPiece(human, `${s}_Forearm`, `${s}_Hand`, 0.064, 0.074, jeo, -0.02, 0.7));
    out.parts.push(limbPiece(human, `${s}_Forearm`, `${s}_Hand`, 0.075, 0.076, trim, 0.7, 0.8));
    out.parts.push(limbPiece(human, `${s}_Forearm`, `${s}_Hand`, 0.075, 0.07, cuff, 0.8, 0.98));
    // the sleeve cap over the shoulder
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 10), jeo);
    const ub = human.bones[`Bip01_${s}_UpperArm`];
    sh.position.set(0, 0, 0); sh.scale.set(1, 1, 1);
    ub.add(sh); out.parts.push(sh);
  }
  void skin;
  // collar (dongjeong): two crossing white bands from the neck down the chest
  const sp2 = human.bones.Bip01_Spine2, nk = human.bones.Bip01_Neck;
  const pS = sp2.getWorldPosition(new Vector3()), pN = nk.getWorldPosition(new Vector3());
  const inv = sp2.getWorldQuaternion(new Quaternion()).invert();
  const loc = (v) => v.clone().sub(pS).applyQuaternion(inv);
  const band = (a, b, w, mat) => {
    const A = loc(a), B = loc(b), d = B.clone().sub(A), len = d.length();
    const g = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.012), mat);
    g.position.copy(A.clone().add(B).multiplyScalar(0.5));
    g.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
    // keep the box's thin axis facing forward-ish by rotating about its length towards +Z (character front)
    sp2.add(g); out.parts.push(g);
  };
  const front = 0.098, top = pN.y - 0.035, low = pS.y - 0.19;
  band(new Vector3(0.062, top, front - 0.01), new Vector3(-0.045, low, front + 0.01), 0.032, cuff);
  band(new Vector3(-0.062, top, front - 0.01), new Vector3(0.045, low, front + 0.012), 0.032, cuff);
  return out;
}

// ---- the chima: a bell skirt rebuilt every frame so that it follows the hips, swells on landing and trails in the air ---------------
const RINGS = 9, SEGS = 24;
class Skirt {
  constructor(o) {
    this.o = o;
    const n = (RINGS + 1) * SEGS;                       // + one extra band ring at the hem (trim colour)
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    const idx = [];
    for (let k = 0; k < RINGS; k++) for (let j = 0; j < SEGS; j++) {
      const a = k * SEGS + j, b = k * SEGS + (j + 1) % SEGS, c = (k + 1) * SEGS + j, d = (k + 1) * SEGS + (j + 1) % SEGS;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setIndex(idx);
    this.geo = g;
    const base = new THREE.Color(o.chima), dk = new THREE.Color(o.chimaDk), hi = new THREE.Color(o.chimaHi), tr = new THREE.Color(o.trim);
    for (let k = 0; k <= RINGS; k++) for (let j = 0; j < SEGS; j++) {
      const c = new THREE.Color();
      if (k === RINGS) c.copy(tr);
      else { c.copy(hi).lerp(base, clamp(k / 2.5, 0, 1)).lerp(dk, clamp((k - 4) / (RINGS - 4), 0, 1) * 0.55); }
      const pleat = 0.93 + 0.07 * Math.cos(j / SEGS * Math.PI * 2 * 12);
      c.multiplyScalar(pleat);
      this.col.set([c.r, c.g, c.b], (k * SEGS + j) * 3);
    }
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    // the ribbon (otgoreum): two long tails from the chest knot, hanging over the skirt front
    this.rib = { n: 8, pos: new Float32Array(2 * 8 * 2 * 3) };
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rib.pos, 3));
    const ri = [];
    for (let t = 0; t < 2; t++) for (let k = 0; k < 7; k++) { const a = t * 16 + k * 2; ri.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    rg.setIndex(ri);
    this.ribMat = new THREE.MeshStandardMaterial({ color: o.ribbon, roughness: 0.55, metalness: 0, side: THREE.DoubleSide });
    this.ribMesh = new THREE.Mesh(rg, this.ribMat);
    this.ribMesh.frustumCulled = false;
    this.pts = new Array(RINGS + 1).fill(0).map(() => ({ c: new Vector3(), rx: 0, rz: 0, fr: new Vector3(), side: new Vector3() }));
  }

  // top: world point at the waist (centre), yaw: the girl's facing (radians), hemY: world y of the hem; s: scale; ev: { crouch, vy, air, land, t }
  update(top, yaw, hemY, under, s, ev) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw);        // forward (horizontal)
    const sx = Math.cos(yaw), sz = -Math.sin(yaw);       // character left
    const topR = 0.16 * s, topD = 0.125 * s;            // half width / half depth of the waist ellipse
    const hemR = 0.34 * s * ev.flare, hemD = 0.31 * s * ev.flare * (1 + 0.5 * Math.min(1, ev.fwd / (0.16 * s)));
    const W = ev.t, fl = ev.flutter || 0, drag = (ev.drag || 0) * s;
    for (let k = 0; k <= RINGS; k++) {
      const u = Math.min(1, k / RINGS), p = this.pts[k];
      const prof = Math.pow(u, 1.05);
      const wave = (0.012 * s * Math.sin(W * 2.1 + u * 5) + 0.026 * s * fl * Math.sin(W * 11 - u * 7)) * u;   // travelling ripples run down the cloth when she moves fast
      p.c.set(
        lerp(top.x, under.x, u * 0.85) + fx * ev.fwd * Math.sin(Math.min(1, u * 1.6) * Math.PI / 2),
        lerp(top.y, hemY, u) - drag * u * u,       // the hem lags below her on the way up
        lerp(top.z, under.z, u * 0.85) + fz * ev.fwd * Math.sin(Math.min(1, u * 1.6) * Math.PI / 2),
      );
      p.rx = lerp(topR, hemR, prof) + wave + 0.035 * s * Math.sin(Math.PI * Math.min(1, u * 1.1));   // a little room at the knees so they never show through the cloth
      p.rz = lerp(topD, hemD, prof) + wave + (0.085 * ev.bulge + 0.03) * s * Math.sin(Math.PI * Math.min(1, u * 1.15));
      p.fr.set(fx, 0, fz); p.side.set(sx, 0, sz);
    }
    const P = this.pos;
    for (let k = 0; k <= RINGS; k++) {
      const p = this.pts[k], kk = Math.min(k, RINGS);
      const drop = k === RINGS ? -0.05 * s : 0;
      for (let j = 0; j < SEGS; j++) {
        const a = (j / SEGS) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const pl = 1 + (k > 1 ? (0.045 + 0.05 * fl) * Math.cos(a * 12 + W * 0.7 * 0) * ev.pleat * (kk / RINGS) : 0);
        const o3 = (k * SEGS + j) * 3;
        P[o3] = p.c.x + (p.side.x * ca * p.rx + p.fr.x * sa * p.rz) * pl;
        P[o3 + 1] = p.c.y + drop + (k > 4 ? 0.035 * s * fl * Math.sin(a * 5 + W * 9) * (kk / RINGS) : 0);   // the hem whips
        P[o3 + 2] = p.c.z + (p.side.z * ca * p.rx + p.fr.z * sa * p.rz) * pl;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    // ribbon: front of the skirt (angle pi/2 => forward), two tails slightly apart
    const R = this.rib.pos;
    for (let t = 0; t < 2; t++) {
      const off = t === 0 ? 0.035 : -0.04;
      for (let k = 0; k < 8; k++) {
        const u = k / 7 * 0.62;
        const rk = Math.min(RINGS, u * RINGS), k0 = Math.floor(rk), k1 = Math.min(RINGS, k0 + 1), f = rk - k0;
        const a = this.pts[k0], b = this.pts[k1];
        const cx = lerp(a.c.x, b.c.x, f), cy = lerp(a.c.y, b.c.y, f), cz = lerp(a.c.z, b.c.z, f);
        const rz = lerp(a.rz, b.rz, f) + 0.012 * s;
        const kk7 = k / 7, whip = 0.05 * s * fl * Math.sin(W * 10 - k * 0.9 + t) * kk7;
        const wob = 0.02 * s * Math.sin(W * 2.6 + k * 0.7 + t) * kk7 + ev.swing * 0.05 * kk7 + whip;
        const x = cx + fx * (rz + 0.0) + sx * (off * s + wob);
        const z = cz + fz * (rz + 0.0) + sz * (off * s + wob);
        const w = 0.021 * s;
        const i0 = ((t * 8 + k) * 2) * 3;
        const lift = (ev.vy || 0) * 0.045 * s * kk7 * kk7;     // the ribbon tails float up on the way down and trail on the way up
        const fwd = fx * 0.03 * s * fl * Math.sin(W * 10 - k * 0.9 + t + 1.2) * kk7, fwz = fz * 0.03 * s * fl * Math.sin(W * 10 - k * 0.9 + t + 1.2) * kk7;
        R[i0] = x + sx * w + fwd; R[i0 + 1] = cy + lift; R[i0 + 2] = z + sz * w + fwz;
        R[i0 + 3] = x - sx * w + fwd; R[i0 + 4] = cy + lift; R[i0 + 5] = z - sz * w + fwz;
      }
    }
    this.ribMesh.geometry.attributes.position.needsUpdate = true;
    this.ribMesh.geometry.computeVertexNormals();
  }
}

// ---- the braid: six lobes hanging from the back of the head, swinging with the jump --------------------------------------------------
class Braid {
  constructor(hairHex, ribbonHex) {
    this.g = new THREE.Group();
    this.m = new THREE.MeshStandardMaterial({ color: hairHex, roughness: 0.5, metalness: 0.05 });
    this.rb = new THREE.MeshStandardMaterial({ color: ribbonHex, roughness: 0.5, metalness: 0 });
    const sph = new THREE.SphereGeometry(1, 12, 9);
    this.lobes = [];
    for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(sph, i >= 7 ? this.rb : this.m); this.g.add(m); this.lobes.push(m); }
    this.hist = [];
  }
  lagged(t, dtLag) {
    const tt = t - dtLag, h = this.hist; if (!h.length) return 0;
    for (let i = h.length - 1; i >= 0; i--) if (h[i].t <= tt) return h[i].v;
    return h[0].v;
  }
  update(anchor, back, s, swing, vyNow, t) {
    this.hist.push({ t, v: vyNow }); while (this.hist.length > 40 || (this.hist.length > 2 && this.hist[0].t < t - 0.6)) this.hist.shift();
    // anchor: world point at the back of the head; back: unit vector pointing behind her (horizontal)
    const L = 0.056 * s;
    let prev = anchor.clone();
    for (let i = 0; i < this.lobes.length; i++) {
      const m = this.lobes[i], k = i / (this.lobes.length - 1);
      const sw = swing * (0.2 + k * 0.9) + 0.03 * Math.sin(t * 1.7 + i * 0.5) * k;
      // each lobe answers the vertical speed a few frames late: the braid whips (floats on the way down, hangs on the way up)
      const lift = clamp(this.lagged(t, 0.03 * (i + 1)) * 0.07, -0.25, 0.6);
      const dir = new Vector3(back.x * (0.35 + 0.9 * k * (1 - lift)) + sw * 0.6, -1 + lift * 1.2 * (0.4 + k), back.z * (0.35 + 0.9 * k * (1 - lift)));
      // swing is applied across the screen x
      dir.x += sw * 0.9; dir.normalize();
      const p = prev.clone().addScaledVector(dir, L);
      m.position.copy(p);
      const r = (0.036 - k * 0.012) * s;
      m.scale.set(r, r * (i >= 7 ? 1.6 : 1.5), r);
      prev = p;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
export async function createGirls({ quality = 'medium', base, outfits } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: true, shadows: false, lighting: 'day', fov: 12 });
  if (!stage.supported) return null;
  stage.setSky(null, null);
  stage.setLighting('day', { hemi: 0.62, keyI: 2.5, rimI: 1.4 }); stage.setSky(null, null);
  const specs = outfits.map((o) => ({ character: 'athlete_f', base, kit: { top: o.jeo, bottoms: o.chima, socks: '#ffffff', shoes: '#f4efe4', trim: o.trim }, skin: '#edc6a2', hair: 'black' }));
  const humans = await Promise.all(specs.map((sp) => loadHuman(sp)));
  const girls = humans.map((h, i) => {
    const g = new Girl(h, outfits[i]);
    g.dress = dress(h, { ...outfits[i], skinMat: null });
    g.skirt = new Skirt(outfits[i]);
    g.braid = new Braid(outfits[i].hair, outfits[i].ribbon);
    stage.add(h); stage.track(h);
    stage.scene.add(g.skirt.mesh); stage.scene.add(g.skirt.ribMesh); stage.scene.add(g.braid.g);
    return g;
  });
  const api = { stage, girls, quality, ok: true, lost: false, fitted: { w: 0, h: 0 } };
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { api.lost = false; api.fitted.w = 0; });
  return Object.assign(api, makeApi(api));
}

const NEAR = 1, FAR = 60, CAM_Z = 20;

function makeApi(api) {
  const { stage, girls } = api;
  const cam = stage.camera, renderer = stage.renderer;
  const v = new Vector3(), up = new Vector3(0, 1, 0), qy = new Quaternion(), qz = new Quaternion();
  let ortho = null;

  // exact orthographic frame: world x/y in metres relative to (ox, oy), region of w x h metres
  function frame(devW, devH, wm, hm, cxm, cym) {
    renderer.setPixelRatio(1); renderer.setSize(devW, devH, false);
    cam.position.set(cxm, cym, CAM_Z); cam.rotation.set(0, 0, 0); cam.updateMatrixWorld(true);
    const l = -wm / 2, r = wm / 2, t = hm / 2, b = -hm / 2, n = NEAR, f = FAR;
    cam.projectionMatrix.set(2 / (r - l), 0, 0, -(r + l) / (r - l), 0, 2 / (t - b), 0, -(t + b) / (t - b), 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.near = n; cam.far = f; cam.aspect = devW / devH;
  }

  // One girl for this frame. it: { x (m), y (m, her feet's ground point), face, crouch, arm (rad), air, vy (m/s), land, open, slope (rad), s (scale) }
  function pose(g, it, t, dt) {
    const h = g.h, S = (it.scale ?? 1) * BODY_SCALE, f = it.face;
    const c = clamp(it.crouch, 0, 1), landK = clamp(it.land ?? 0, 0, 1), air = !!it.air, vy = it.vy ?? 0;
    g.vel += (vy - g.vel) * (dt > 0.0005 ? Math.min(1, dt * 14) : 1);
    const breath = Math.sin(t * 2.3 + (f > 0 ? 0 : 1.6));
    const yaw = f > 0 ? Math.PI / 2 - YAW_TURN : -Math.PI / 2 + YAW_TURN;
    h.root.position.set(it.x, it.y, 0);
    h.root.rotation.y = yaw; h.facing = yaw; h.root.scale.setScalar(S);

    // trunk, legs
    const loadK = Math.max(c, landK * 0.8);
    const tuck = air ? clamp(0.55 + Math.max(0, -g.vel) * 0.04 + (g.vel > 0 ? 0.0 : 0.15), 0, 1) : 0;
    const drop = (air ? 0.02 + tuck * 0.05 : loadK * 0.2) * 1 + breath * 0.004;
    const flex = air ? 6 + tuck * 10 : 6 + loadK * 26;
    const o = {};
    o.Pelvis = { flex: flex * 0.2, side: 0 };
    o.Spine = { flex: flex * 0.24 };
    o.Spine1 = { flex: flex * 0.24 };
    o.Spine2 = { flex: flex * 0.2, twist: 0 };
    o.Neck = { flex: -flex * 0.42 + 4 };
    o.Head = { flex: -flex * 0.38 + 2 };
    const th = air ? 3 + tuck * 6 : 12 + loadK * 40, ca = air ? 2 + tuck * 6 : 18 + loadK * 56;
    o.L_Thigh = { flex: th, abduct: 4 }; o.R_Thigh = { flex: th, abduct: 4 };
    o.L_Calf = { flex: ca }; o.R_Calf = { flex: ca };
    // arms: counter-balance cycle (see armPose); the crouch pose on the ground is unchanged
    const open = clamp(it.open ?? 0, 0, 1);
    const seed = (it.seed ?? 0) + (it.who ?? 0) * 1.7;
    const dbg = globalThis.__armDbg;
    const aL = dbg ? [dbg[0], dbg[1], dbg[2], dbg[3] || 0] : armPose(it, 'L', t, seed), aR = dbg ? aL : armPose(it, 'R', t, seed);
    o.L_UpperArm = { flex: aL[0], abduct: aL[1] }; o.R_UpperArm = { flex: aR[0] * 0.97, abduct: aR[1] };
    o.L_Forearm = { flex: aL[2] }; o.R_Forearm = { flex: aR[2] };
    o.L_Hand = { flex: aL[3] }; o.R_Hand = { flex: aR[3] };
    const adeg = aL[0];
    const shift = Math.sin(t * 1.1 + seed * 4) * 0.012 * (1 - c) * (air ? 0 : 1);   // she shifts her weight from foot to foot while she waits
    g.writePose(o, [shift, -drop, air ? 0 : -0.028 * loadK + shift * 0.5]);   // and sits back into her heels as the board loads

    // feet: planted across the board (front foot towards the pivot) or tucked in the air
    const wdx = (side) => { const b = side === 'R' ? -1 : 1; return b; };
    void wdx;
    const stand = 0.095;                    // half the stance along the board (metres, unscaled)
    const feet = { L: null, R: null };
    for (const side of ['L', 'R']) {
      const sgn = side === 'L' ? 1 : -1;     // L is avatar-left
      let along, lift, lateral = sgn * 0.085;
      if (!air) { along = (side === 'L' ? 1 : -1) * 0.08 * 0 + (side === 'L' ? stand : -stand * 0.8); lift = 0; }
      else { along = (side === 'L' ? 0.05 : -0.06) + tuck * 0.03; lift = 0.0 + tuck * 0.06 + (side === 'L' ? 0.015 : 0); }
      // face-forward axis in the picture is the horizontal; the stance runs along the board
      const dx = f * along;
      const wy = -Math.tan(it.slope) * dx;   // the board surface height change over dx (world up)
      v.set(it.x + dx * S, it.y + (wy + lift + h._ankleRest) * S, lateral * 0.0);
      // lateral (depth) offset: the avatar's left is towards the camera for a girl facing +X turned towards the camera
      v.z = sgn * (f > 0 ? 1 : -1) * 0.0 + sgn * 0.0;
      const rq = h._restQ[`${side}_Foot`];
      qy.setFromAxisAngle(up, yaw); qz.setFromAxisAngle(new Vector3(0, 0, 1), -it.slope);
      const fq = qz.clone().multiply(qy).multiply(rq);
      h.setReachFoot(side, v, 1, fq);
      feet[side] = v.clone();
    }
    h.setReach('L', null); h.setReach('R', null);
    h.setFingers('L', 'relaxed'); h.setFingers('R', 'relaxed');
    return { S, yaw, feet, c, loadK, air, tuck, landK };
  }

  function cloth(g, P, t, dt, it) {
    const h = g.h, S = P.S, f = it.face;
    h.root.updateMatrixWorld(true);
    const sp1 = h.bones.Bip01_Spine1.getWorldPosition(new Vector3());
    const pel = h.bones.Bip01_Pelvis.getWorldPosition(new Vector3());
    const top = sp1.clone(); top.y += 0.015 * S;
    const footMin = Math.min(P.feet.L.y, P.feet.R.y) - h._ankleRest * S;
    const hemY = Math.max(footMin + 0.045 * S, top.y - 1.06 * S);
    const under = new Vector3((pel.x + (P.feet.L.x + P.feet.R.x) / 2) / 2, 0, (pel.z + (P.feet.L.z + P.feet.R.z) / 2) / 2);
    // skirt shape: swells when she loads or lands, streams and clings on the way up, inflates (air caught under it) on the way down
    const vy = g.vel;
    const prevBal = g.bal || 0;
    const wantBal = P.air ? clamp(-vy * 0.32, 0, 1) : 0;
    g.bal = prevBal + (wantBal - prevBal) * Math.min(1, dt * (wantBal > prevBal ? 7 : 16));   // fills a little behind the fall, empties quickly
    const rise = P.air ? clamp(vy * 0.3, 0, 1) : 0;
    const flare = 1 + 0.12 * P.loadK + (P.air ? 0.04 - 0.1 * rise + 0.3 * g.bal : 0) + 0.14 * P.landK;
    const compress = (top.y - hemY) / (1.06 * S);     // < 1 when the skirt is shortened against the board
    const flutter = P.air ? clamp(Math.abs(vy) * 0.33 + 0.15, 0, 1) : 0.1 * P.landK;
    g.skirt.update(top, P.yaw - (f > 0 ? 0 : 0), hemY, under, S, { flare: flare * (1 + (1 - clamp(compress, 0.4, 1)) * 0.5), t, fwd: (0.015 + 0.1 * P.loadK) * S, pleat: 0.8, bulge: P.air ? 1 + 1.1 * g.bal : 0.35 + P.loadK, swing: g.sw, flutter, drag: rise * 0.07, vy });
    // braid anchor: back of the head; the braid swings like a pendulum, kicked by take-off and touch-down
    const hb = h.bones.Bip01_Head.getWorldPosition(new Vector3());
    const back = new Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
    const anchor = hb.clone().addScaledVector(back, 0.085 * S); anchor.y += -0.02 * S;
    if (P.landK > (g.prevLand || 0) + 0.25) g.swV += 3.2 * f;
    if (P.air && !g.wasAir) g.swV -= 2.0 * f;
    g.prevLand = P.landK; g.wasAir = P.air;
    for (let n = Math.max(1, Math.ceil(dt / 0.008)), i = 0; i < n; i++) { const h2 = Math.min(dt, 0.1) / n; g.swV += (-g.sw * 110 - g.swV * 6.5) * h2; g.sw += g.swV * h2; }
    g.sw = clamp(g.sw, -1, 1);
    g.braid.update(anchor, back, S, g.sw * 0.55, P.air ? vy : 0, t);
  }

  api.drawItems = function (items, t, dt) {
    const used = new Set();
    items.forEach((it, i) => {
      const k = it.who ?? i, g = girls[k]; if (!g) return;
      used.add(k); g.h.root.visible = true; g.skirt.mesh.visible = g.skirt.ribMesh.visible = g.braid.g.visible = true;
      g._P = pose(g, it, t, dt); g._it = it;
    });
    girls.forEach((g, k) => { if (!used.has(k)) { g.h.root.visible = false; g.skirt.mesh.visible = g.skirt.ribMesh.visible = g.braid.g.visible = false; } });
    girls.forEach((g, k) => { if (used.has(k)) g.h.update(dt); });
    girls.forEach((g, k) => { if (used.has(k)) cloth(g, g._P, t, dt, g._it); });
  };

  let lastT = null, lastQuality = quality0();
  function quality0() { return api.quality; }
  void lastQuality;
  const cost = { ema: 0, n: 0, low: false };

  /**
   * Draw the girls into ctx. region: { x, y, w, h } in the 2D picture's units (the rectangle that is covered); items give x, y in the same
   * units (her feet's ground point), s: pixels per metre, face, crouch, arm, air, vy, land, open, tilt (board angle, +right end down).
   */
  api.draw = function (ctx, region, items, t) {
    if (api.lost || stage.contextLost) return false;
    const t0 = globalThis.performance.now();
    const m = ctx.getTransform();
    const ppu = Math.hypot(m.a, m.b);
    const devW = clamp(Math.round(region.w * ppu), 120, globalThis.__girls3dCap || 1100), devH = Math.max(1, Math.round(devW * region.h / region.w));
    const s = items[0].s;                     // all items share the scale of the scene
    const wm = region.w / s, hm = region.h / s;
    const ox = region.x + region.w / 2, oy = region.y + region.h / 2;
    if (renderer.domElement.width !== devW || renderer.domElement.height !== devH || api._last !== `${wm.toFixed(3)}/${hm.toFixed(3)}`) { api._last = `${wm.toFixed(3)}/${hm.toFixed(3)}`; }
    frame(devW, devH, wm, hm, 0, 0);
    // world metres relative to the region centre (up positive)
    const world = items.map((it, ix) => ({
      who: it.who ?? ix, x: (it.x - ox) / s, y: (oy - it.y) / s, face: it.face, crouch: it.crouch ?? 0, arm: it.arm ?? 0.2, air: it.air, vy: it.vy ?? 0, land: it.land ?? 0,
      open: it.open ?? 0, slope: it.tilt ?? 0, scale: it.scale ?? 1, ph: it.ph, armG: it.armG, H: it.H, seed: it.seed,
    }));
    api.lastItems = items.map((i) => ({ x: i.x, y: i.y, s: i.s, air: i.air }));
    const dt = lastT === null ? 0 : clamp(t - lastT, 0, 0.1); lastT = t;
    api.drawItems(world, t, dt);
    stage.render();
    ctx.drawImage(renderer.domElement, region.x, region.y, region.w, region.h);
    const ms = globalThis.performance.now() - t0;
    cost.ema = cost.n ? cost.ema * 0.95 + ms * 0.05 : ms; cost.n++;
    if (!cost.low && cost.n > 90 && cost.ema > 11 && api.quality !== 'low') { cost.low = true; api.quality = 'low'; stage.setQuality('low'); }
    return true;
  };
  void ortho;
  return {};
}

// The 3D charro (presentation only: reads the pose numbers of the sim, never writes back).
// The shared view3d layer supplies the person (athlete_m), the IK and the stage; this file dresses him as a charro and poses him procedurally:
// a skinned wool jacket with long sleeves (no seams at the elbow) with a gold braid and silver buttons, a red sash, skinned fitted trousers with
// a row of silver buttons, pointed boots with a heel and spurs, a moustache, a bow tie and a wide embroidered straw sombrero. The rope hand
// is driven by an IK target; the arena (arena.js) reads the hand position back for the rope.
import { loadHuman, Clip, CLIP_BONES, semanticRot, THREE } from '../vendor3d/index.js';
import { loft, canvasTex, rng, clamp, TAU } from './geo.js';

const { Vector3, Quaternion, Euler, Mesh, MeshStandardMaterial, SphereGeometry, CylinderGeometry, TorusGeometry, BufferGeometry, Float32BufferAttribute, Group } = THREE;
const D2R = Math.PI / 180;
const bi = (n) => CLIP_BONES.indexOf(`Bip01_${n}`);
const UP = new Vector3(0, 1, 0);
export const PX_PER_M_PER_K = 150 / 1.8 * 1.18;       // the 2D art draws a charro ~150 units tall, k px per unit

class Body {
  constructor(human) {
    this.h = human;
    this.clip = new Clip({ name: 'pose', frames: 1, dur: 1 / 30, fps: 30, loop: true, quats: new Float32Array(CLIP_BONES.length * 4), pelvis: new Float32Array(3), grounded: false, fingers: 'relaxed' });
    human.addClip(this.clip);
    human.groundClamp = 'off'; human.footPlanting = false;
    this.restQ = new Float32Array(human.restPose.q);
    this.e = new Euler(); this.qa = new Quaternion(); this.qb = new Quaternion();
    this.ph = human.pelvisHeight;
    human.play(this.clip, { fade: 0 });
  }
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

// drop the trainer triangles (boots are added instead)
function dropTrainers(human) {
  human.root.traverse((o) => {
    if (!o.isSkinnedMesh || o.geometry.userData.noshoes) return;
    const geo = o.geometry, ix = geo.index, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    if (!ix || !si) return;
    const foot = new Set(o.skeleton.bones.map((bn, i) => (/_(Foot|Toe0)$/.test(bn.name) ? i : -1)).filter((i) => i >= 0));
    const w = new Float32Array(geo.attributes.position.count);
    for (let i = 0; i < w.length; i++) for (let k = 0; k < 4; k++) if (foot.has(si.getComponent(i, k))) w[i] += sw.getComponent(i, k);
    const a = ix.array;
    for (let t = 0; t < a.length; t += 3) if (w[a[t]] > 0.55 && w[a[t + 1]] > 0.55 && w[a[t + 2]] > 0.55) { a[t + 1] = a[t]; a[t + 2] = a[t]; }
    ix.needsUpdate = true; geo.userData.noshoes = true;
  });
}

function lathe(points, seg = 36) {
  const pos = [], idx = [], uv = [], n = points.length;
  for (let j = 0; j <= seg; j++) { const a = (j / seg) * TAU, c = Math.cos(a), sn = Math.sin(a); points.forEach(([r, y], i) => { pos.push(r * c, y, -r * sn); uv.push(j / seg, i / (n - 1)); }); }
  for (let j = 0; j < seg; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = (j + 1) * n + i; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ---- textures --------------------------------------------------------------------------------------------------------------------
function woolTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#17998c'; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.16; g.strokeStyle = '#04403a';
    for (let i = 0; i < w; i += 2) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); }
    g.globalAlpha = 0.09; for (let i = 0; i < h; i += 2) { g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    g.globalAlpha = 1;
  }, { repeat: [3, 3] });
}
function strawTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e1c783'; g.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let i = 0; i < 700; i++) { g.strokeStyle = r() > 0.5 ? 'rgba(130,95,40,0.35)' : 'rgba(255,240,190,0.4)'; g.lineWidth = 1; const y = r() * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (r() - 0.5) * 6); g.stroke(); }
    g.globalAlpha = 0.25; g.strokeStyle = '#6b4a1c'; for (let x = 0; x < w; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  }, { repeat: [4, 2] });
}
function bandTexture() {
  return canvasTex(256, 32, (g, w, h) => {
    g.fillStyle = '#1b1b3a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4b324';
    for (let i = 0; i < 16; i++) { const x = i * 16 + 8; g.beginPath(); g.moveTo(x, 4); g.lineTo(x + 6, 16); g.lineTo(x, 28); g.lineTo(x - 6, 16); g.fill(); }
    g.fillStyle = '#e4eaf0'; for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(i * 16, 16, 2.4, 0, TAU); g.fill(); }
  }, { repeat: [3, 1] });
}
function bootTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#5a3118'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,220,150,0.55)'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0, 20 + i * 26); g.bezierCurveTo(w * 0.3, 8 + i * 26, w * 0.7, 32 + i * 26, w, 20 + i * 26); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 300; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 1);
  }, { repeat: [2, 2] });
}

// ---- skinned cloth ---------------------------------------------------------------------------------------------------------------
// A loft through rest-pose stations, skinned to the person's own skeleton: it bends with the joints, so there is no seam at the elbow or knee.
function skinnedLoft(ctx, stations, weightsAt, material, o = {}) {
  const { skel, bindInv, boneIndex, parent, bindMatrix } = ctx;
  const g = loft(stations, { rings: o.rings ?? 18, seg: o.seg ?? 16, side: o.side || [0, 0, 1], caps: o.caps ?? 2 });
  const pos = g.attributes.position, rings = g.userData.rings, seg = o.seg ?? 16, n = stations.length;
  const si = new Uint16Array(pos.count * 4), sw = new Float32Array(pos.count * 4), v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(bindInv); pos.setXYZ(i, v.x, v.y, v.z);
    const ring = rings[Math.floor(i / seg)], ws = weightsAt(ring.u01 * (n - 1));
    ws.slice(0, 4).forEach(([name, w], k) => { si[i * 4 + k] = boneIndex[name] ?? 0; sw[i * 4 + k] = w; });
  }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.computeVertexNormals();
  const m = new THREE.SkinnedMesh(g, material); m.bind(skel, bindMatrix); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
const blend = (u, a, b, c0, c1, nameA, nameB) => { const t = clamp((u - c0) / (c1 - c0), 0, 1), s = t * t * (3 - 2 * t); return [[nameA, 1 - s], [nameB, s]]; };

// ---- the costume -----------------------------------------------------------------------------------------------------------------
function costume(human) {
  human._applyRest(); human.root.updateMatrixWorld(true);
  const mat = (o) => new MeshStandardMaterial({ roughness: 0.7, metalness: 0, side: THREE.DoubleSide, ...o });
  const M = {
    wool: mat({ map: woolTexture(), roughness: 0.85 }), woolDark: mat({ color: '#0b6a62', roughness: 0.85 }),
    indigo: mat({ color: '#1d1d3d', roughness: 0.8 }), boot: mat({ map: bootTexture(), roughness: 0.5 }), sole: mat({ color: '#1e100a', roughness: 0.8 }),
    silver: mat({ color: '#e8edf2', roughness: 0.22, metalness: 0.95 }), gold: mat({ color: '#f2b829', roughness: 0.3, metalness: 0.85 }),
    red: mat({ color: '#c9301f', roughness: 0.75 }), straw: mat({ map: strawTexture(), roughness: 0.9 }), band: mat({ map: bandTexture(), roughness: 0.7 }),
    rope: mat({ color: '#d99a35', roughness: 0.85 }), hair: mat({ color: '#15100c', roughness: 0.7 }), skin: mat({ color: '#c98f66', roughness: 0.75 }),
  };
  const wp = (n) => human.bones[`Bip01_${n}`].getWorldPosition(new Vector3());
  const attach = (boneName, obj, worldPos, worldQuat) => {
    const b = human.bones[`Bip01_${boneName}`], bq = b.getWorldQuaternion(new Quaternion()), inv = bq.clone().invert();
    obj.quaternion.copy(worldQuat ? inv.clone().multiply(worldQuat) : inv);
    obj.position.copy(worldPos.clone().sub(b.getWorldPosition(new Vector3())).applyQuaternion(inv));
    b.add(obj);
  };
  const ball = (bone, P, r, m, sc = [1, 1, 1]) => { const o = new Mesh(new SphereGeometry(r, 14, 10), m); o.scale.set(sc[0], sc[1], sc[2]); attach(bone, o, P); o.castShadow = true; return o; };
  const out = { M };

  // skeleton + bind data for the skinned cloth
  let mesh0 = null; human.model.traverse((o) => { if (o.isSkinnedMesh && !mesh0) mesh0 = o; });
  const skel = mesh0.skeleton, boneIndex = {}; skel.bones.forEach((b, i) => { boneIndex[b.name.replace(/^Bip01_/, '')] = i; });
  const ctx = { skel, bindMatrix: mesh0.bindMatrix, bindInv: mesh0.bindMatrixInverse.clone(), boneIndex, parent: mesh0.parent };
  const P = (n) => wp(n);

  // torso measurements from the person's own mesh: half-width (x) and depth (z) per height, so the jacket sits right over the shirt
  const slices = [];
  {
    const torso = new Set(['Pelvis', 'Spine', 'Spine1', 'Spine2'].map((n) => boneIndex[n]));
    const geo = mesh0.geometry, p = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, v = new Vector3();
    const pel = P('Pelvis'), neck = P('Neck'), n = 8;
    for (let k = 0; k <= n; k++) {
      const y = pel.y - 0.02 + (neck.y - pel.y + 0.0) * (k / n), band = 0.03;
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, c = 0;
      for (let i = 0; i < p.count; i++) {
        let w = 0; for (let q = 0; q < 4; q++) if (torso.has(si.getComponent(i, q))) w += sw.getComponent(i, q);
        if (w < 0.9) continue;
        v.fromBufferAttribute(p, i).applyMatrix4(mesh0.bindMatrix);
        if (Math.abs(v.y - y) > band || Math.abs(v.x) > 0.3) continue;
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); c++;
      }
      if (c > 3) slices.push({ y, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, rx: (x1 - x0) / 2, rz: (z1 - z0) / 2 });
    }
  }
  out.slices = slices;

  // trousers: fitted, skinned, with silver buttons down the outer seam
  for (const s of ['L', 'R']) {
    const th = P(`${s}_Thigh`), ca = P(`${s}_Calf`), fo = P(`${s}_Foot`), pe = P('Pelvis');
    const hipTop = th.clone().lerp(pe, 0.0); hipTop.y = pe.y + 0.1;
    const hem = fo.clone(); hem.y = fo.y - 0.045;
    const st = [
      { x: hipTop.x, y: hipTop.y, z: hipTop.z + 0.0, ry: 0.125, rz: 0.115 },
      { x: th.x, y: th.y - 0.01, z: th.z, ry: 0.122, rz: 0.113 },
      { x: (th.x + ca.x) / 2, y: (th.y + ca.y) / 2, z: (th.z + ca.z) / 2, ry: 0.098, rz: 0.092 },
      { x: ca.x, y: ca.y, z: ca.z, ry: 0.078, rz: 0.075 },
      { x: (ca.x + hem.x) / 2, y: (ca.y + hem.y) / 2, z: (ca.z + hem.z) / 2 + 0.005, ry: 0.07, rz: 0.066 },
      { x: hem.x, y: hem.y, z: hem.z + 0.01, ry: 0.083, rz: 0.075 },
    ];
    skinnedLoft(ctx, st, (u) => {
      if (u < 1.4) return blend(u, 0, 0, 0, 1, 'Pelvis', 'Pelvis').length ? [['Pelvis', 1 - clamp((u - 0.3) / 1.0, 0, 1)], [`${s}_Thigh`, clamp((u - 0.3) / 1.0, 0, 1)]] : [];
      if (u < 2.6) { const t = clamp((u - 2.0) / 0.7, 0, 1); return [[`${s}_Thigh`, 1 - t], [`${s}_Calf`, t]]; }
      if (u < 4.2) { const t = clamp((u - 3.5) / 0.8, 0, 1); return [[`${s}_Calf`, 1 - t], [`${s}_Foot`, t * 0.6], [`${s}_Calf`, t * 0.4]]; }
      return [[`${s}_Calf`, 0.5], [`${s}_Foot`, 0.5]];
    }, M.indigo, { rings: 22, seg: 14, side: [1, 0, 0], caps: 0 });
    // buttons
    const out_ = s === 'L' ? 1 : -1;
    for (let j = 0; j < 7; j++) {
      const f = j / 6, upper = f < 0.5, a = upper ? th : ca, b = upper ? ca : fo, t = upper ? f * 2 : (f - 0.5) * 2;
      const p = a.clone().lerp(b, t * (upper ? 0.9 : 0.85) + 0.05); p.x += out_ * (upper ? 0.108 : 0.081);
      ball(upper ? `${s}_Thigh` : `${s}_Calf`, p, 0.0125, M.silver);
    }
    // boot: shaft, foot with a pointed toe, a Cuban heel and a spur
    const fr = human._sole[s], upV = fr.up.clone().normalize(), fwdV = fr.fwd.clone().normalize();
    fwdV.addScaledVector(upV, -fwdV.dot(upV)).normalize();
    const leftV = upV.clone().cross(fwdV).normalize();
    const g = new Group(); g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(leftV, upV, fwdV));
    const sph = new SphereGeometry(1, 18, 14);
    const add = (m, p, sc, rx = 0) => { const o = new Mesh(sph, m); o.position.set(p[0], p[1], p[2]); o.scale.set(sc[0], sc[1], sc[2]); o.rotation.x = rx; o.castShadow = true; g.add(o); return o; };
    add(M.boot, [0, 0.0, -0.004], [0.066, 0.112, 0.072]);                // shaft over the ankle
    add(M.boot, [0, -0.075, 0.075], [0.058, 0.045, 0.12]);               // foot
    add(M.boot, [0, -0.082, 0.17], [0.047, 0.034, 0.085], -0.08);       // toe box, long and pointed
    add(M.boot, [0, -0.08, 0.235], [0.026, 0.026, 0.05], -0.1);          // the point
    add(M.sole, [0, -0.108, 0.07], [0.06, 0.012, 0.17]);                 // sole
    add(M.sole, [0, -0.1, -0.042], [0.052, 0.034, 0.055]);               // heel
    add(M.silver, [0, -0.04, 0.13], [0.043, 0.007, 0.05]);              // silver toe-cap trim
    const spurBand = new Mesh(new TorusGeometry(0.058, 0.006, 6, 18), M.silver); spurBand.rotation.x = Math.PI / 2; spurBand.position.set(0, -0.055, -0.01); g.add(spurBand);
    const spur = new Mesh(new SphereGeometry(0.013, 8, 6), M.silver); spur.position.set(0, -0.055, -0.07); g.add(spur);
    const star = new Mesh(new TorusGeometry(0.018, 0.004, 5, 10), M.silver); star.position.set(0, -0.055, -0.088); star.rotation.y = Math.PI / 2; g.add(star);
    human.bones[`Bip01_${s}_Foot`].add(g); g.position.set(0, 0, 0);
  }

  // jacket: a short skinned wool jacket from the waist to the collar, with a gold braid and silver buttons
  {
    const pel = P('Pelvis'), nk = P('Neck');
    const pick = (y) => { let best = slices[0]; for (const s of slices) if (Math.abs(s.y - y) < Math.abs(best.y - y)) best = s; return best; };
    const ys = [pel.y - 0.012, pel.y + 0.1, pel.y + 0.26, pel.y + 0.4, nk.y - 0.1, nk.y - 0.02];
    const st = ys.map((y, i) => { const s = pick(y); return { x: s.cx, y, z: s.cz, ry: Math.max(0.1, s.rz + 0.016 + (i === 0 ? 0.012 : 0)), rz: Math.max(0.15, s.rx + 0.012) }; });
    st[st.length - 1].rz *= 0.78; st[st.length - 1].ry *= 0.9;
    skinnedLoft(ctx, st, (u) => {
      if (u < 1.2) return [['Pelvis', 0.4], ['Spine', 0.6]];
      if (u < 2.4) { const t = (u - 1.2) / 1.2; return [['Spine', 1 - t], ['Spine1', t]]; }
      if (u < 3.6) { const t = (u - 2.4) / 1.2; return [['Spine1', 1 - t], ['Spine2', t]]; }
      return [['Spine2', 1.0]];
    }, M.wool, { rings: 20, seg: 22, side: [1, 0, 0], caps: 0 });
    // buttons and the braid down the front, braid at the hem
    const front = (y) => { const s = pick(y); return new Vector3(s.cx, y, s.cz + s.rz + 0.02); };
    for (let j = 0; j < 5; j++) { const y = pel.y + 0.1 + j * 0.095; ball(j < 2 ? 'Spine' : j < 4 ? 'Spine1' : 'Spine2', front(y).add(new Vector3(0, 0, 0.004)), 0.0125, M.silver); }
    for (let j = 0; j < 5; j++) { const y = pel.y + 0.1 + j * 0.095, p = front(y); for (const sx of [-1, 1]) ball(j < 2 ? 'Spine' : j < 4 ? 'Spine1' : 'Spine2', p.clone().add(new Vector3(sx * 0.052, 0, -0.012)), 0.008, M.gold); }
    // collar: a gold band and a red bow tie
    const collar = new Mesh(new CylinderGeometry(0.062, 0.07, 0.04, 20, 1, true), M.woolDark); collar.scale.set(1, 1, 1.0);
    attach('Neck', collar, nk.clone().add(new Vector3(0, 0.0, 0.0)));
    const bowL = new Mesh(new SphereGeometry(0.036, 10, 8), M.red); bowL.scale.set(1.5, 0.9, 0.55);
    const bowR = bowL.clone(); bowL.position.set(-0.04, 0, 0); bowR.position.set(0.04, 0, 0);
    const bow = new Group(); bow.add(bowL, bowR, new Mesh(new SphereGeometry(0.018, 8, 6), M.red));
    attach('Neck', bow, nk.clone().add(new Vector3(0, -0.05, 0.075)));
  }

  // red sash (faja) knotted at the waist: covers the jacket hem / trouser line and gives the costume its real charro read
  {
    const pel = P('Pelvis'), pick = (y) => { let best = slices[0]; for (const q of slices) if (Math.abs(q.y - y) < Math.abs(best.y - y)) best = q; return best; };
    const sl = pick(pel.y + 0.06), y = pel.y + 0.06;
    const ring = new Mesh(new TorusGeometry(1, 0.036, 10, 40), M.red);
    ring.rotation.x = Math.PI / 2; ring.scale.set(Math.max(0.15, sl.rx + 0.034), Math.max(0.12, sl.rz + 0.034), 1.15);
    const sash = new Group(); sash.add(ring);
    ring.castShadow = true;
    const knot = new Mesh(new SphereGeometry(0.045, 10, 8), M.red); knot.position.set(Math.max(0.15, sl.rx + 0.034) * 0.82, 0, Math.max(0.12, sl.rz + 0.034) * 0.6); sash.add(knot);
    for (const k of [0, 1]) { const tail = new Mesh(new CylinderGeometry(0.03, 0.044, 0.2, 8), M.red); tail.position.set(knot.position.x + 0.02, -0.12, knot.position.z + 0.02 + k * 0.03); tail.rotation.z = 0.12 + k * 0.1; sash.add(tail); }
    attach('Spine', sash, new Vector3(sl.cx, y, sl.cz));
  }

  // long skinned sleeves with a gold cuff
  for (const s of ['L', 'R']) {
    const sh = P(`${s}_UpperArm`), el = P(`${s}_Forearm`), ha = P(`${s}_Hand`);
    const sho = sh.clone(); sho.y += 0.02; sho.x += (s === 'L' ? 1 : -1) * -0.01;
    const m1 = sh.clone().lerp(el, 0.5), m2 = el.clone().lerp(ha, 0.5), wr = el.clone().lerp(ha, 0.86);
    const st = [
      { x: sho.x, y: sho.y, z: sho.z, ry: 0.11, rz: 0.11 },
      { x: m1.x, y: m1.y, z: m1.z, ry: 0.092, rz: 0.092 },
      { x: el.x, y: el.y, z: el.z, ry: 0.077, rz: 0.077 },
      { x: m2.x, y: m2.y, z: m2.z, ry: 0.066, rz: 0.066 },
      { x: wr.x, y: wr.y, z: wr.z, ry: 0.056, rz: 0.056 },
    ];
    skinnedLoft(ctx, st, (u) => {
      if (u < 0.5) return [[`${s}_UpperArm`, 0.8], ['Spine2', 0.2]];
      if (u < 1.6) return [[`${s}_UpperArm`, 1]];
      if (u < 2.4) { const t = (u - 1.6) / 0.8; return [[`${s}_UpperArm`, 1 - t], [`${s}_Forearm`, t]]; }
      return [[`${s}_Forearm`, 1]];
    }, M.wool, { rings: 16, seg: 14, side: [0, 0, 1], caps: 2 });
    // cuff (rigid on the forearm) and a silver button
    const cu = el.clone().lerp(ha, 0.74), cu2 = el.clone().lerp(ha, 0.93), len = cu.distanceTo(cu2);
    const cuff = new Mesh(new CylinderGeometry(0.06, 0.06, len, 16, 1, true), M.gold);
    attach(`${s}_Forearm`, cuff, cu.clone().lerp(cu2, 0.5), new Quaternion().setFromUnitVectors(UP, cu2.clone().sub(cu).normalize()));
  }

  // moustache and head details, located from the head mesh itself
  {
    const head = P('Head'), geo = mesh0.geometry, p = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, v = new Vector3();
    const hi = boneIndex.Head;
    let nose = null;
    const heads = []; human.model.traverse((o) => { if (o.isSkinnedMesh) heads.push(o); });
    for (const o of heads) {
      const g2 = o.geometry, p2 = g2.attributes.position, s2 = g2.attributes.skinIndex, w2 = g2.attributes.skinWeight;
      for (let i = 0; i < p2.count; i++) {
        let w = 0; for (let q = 0; q < 4; q++) if (s2.getComponent(i, q) === hi) w += w2.getComponent(i, q);
        if (w < 0.8) continue;
        v.fromBufferAttribute(p2, i).applyMatrix4(o.bindMatrix);
        if (Math.abs(v.x) > 0.02 || v.y < head.y - 0.06 || v.y > head.y + 0.1) continue;
        if (!nose || v.z > nose.z) nose = v.clone();
      }
    }
    void p; void si; void sw;
    out.nose = nose;
    const nz = nose ? nose.z : head.z + 0.1, ny = nose ? nose.y : head.y + 0.0;
    const must = new Group();
    for (const sx of [-1, 1]) {
      const m = new Mesh(new SphereGeometry(1, 10, 8), M.hair); m.scale.set(0.034, 0.011, 0.016); m.position.set(sx * 0.032, 0, 0); m.rotation.z = sx * -0.28; must.add(m);
      const tip = new Mesh(new SphereGeometry(1, 8, 6), M.hair); tip.scale.set(0.014, 0.012, 0.012); tip.position.set(sx * 0.066, -0.012, -0.004); must.add(tip);
    }
    attach('Head', must, new Vector3(0, ny - 0.034, nz - 0.004));
    out.must = must;
  }

  // sombrero: wide upturned brim, tapered crown, embroidered band, silver conchos and a gold cord
  {
    const head = P('Head');
    const prof = [[0, 0.0], [0.092, 0.0], [0.1, 0.04], [0.092, 0.14], [0.072, 0.175], [0.03, 0.185], [0, 0.186]];
    const crown = new Mesh(lathe(prof, 40), M.straw);
    const brimProf = [[0.07, 0.0], [0.17, -0.006], [0.26, -0.004], [0.33, 0.012], [0.372, 0.052], [0.37, 0.06], [0.33, 0.026], [0.26, 0.008], [0.17, 0.006], [0.07, 0.01]];
    const brim = new Mesh(lathe(brimProf, 48), M.straw);
    const hb = new Mesh(new CylinderGeometry(0.0975, 0.1025, 0.05, 40, 1, true), M.band); hb.position.y = 0.032;
    const trim = new Mesh(new TorusGeometry(0.368, 0.006, 6, 56), M.gold); trim.rotation.x = Math.PI / 2; trim.position.y = 0.055;
    const hat = new Group(); hat.add(crown, brim, hb, trim);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const c = new Mesh(new SphereGeometry(0.014, 8, 6), M.silver); c.scale.set(1, 1, 0.5); c.position.set(Math.cos(a) * 0.1, 0.032, -Math.sin(a) * 0.1); c.rotation.y = a; hat.add(c); }
    hat.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    hat.rotation.x = -0.05;
    attach('Head', hat, new Vector3(head.x, head.y + 0.126, head.z + 0.012));
    out.hat = hat;
  }
  // the rope coil hanging from the left hand
  {
    const coil = new Group();
    for (let i = 0; i < 5; i++) { const t = new Mesh(new TorusGeometry(0.095 - i * 0.008, 0.013, 8, 28), M.rope); t.position.z = i * 0.02 - 0.04; coil.add(t); }
    coil.rotation.y = Math.PI / 2; coil.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const lh = P('L_Hand');
    attach('L_Hand', coil, new Vector3(lh.x, lh.y - 0.09, lh.z));
  }
  return out;
}

/** Load and dress the charro. Returns { human, pose(o, t, dt), hand(out), place(x, z, yaw) }. */
export async function createCharroRig({ base } = {}) {
  const h = await loadHuman({ character: 'athlete_m', base, kit: { top: '#12958a', bottoms: '#1d1d3d', socks: '#1d1d3d' }, skin: '#c68e63', hair: 'black' });
  dropTrainers(h);
  const cos = costume(h);
  const body = new Body(h);
  const v = new Vector3(), qy = new Quaternion();
  const grip = { curl: [[0.8, 0.9, 0.5], [1.05, 1.3, 0.85], [1.1, 1.35, 0.9], [1.1, 1.35, 0.9], [1.1, 1.35, 0.9]], spread: [0, 0, 0, 0, 0] };
  const rig = { human: h, cos, x: 0, z: 0, yaw: Math.PI / 2 };
  const handBone = h.bones.Bip01_R_Hand;
  // the world space positions the rope needs; valid right after pose()
  rig.hand = (out = new Vector3()) => handBone.getWorldPosition(out);
  rig.head = (out = new Vector3()) => h.bones.Bip01_Head.getWorldPosition(out);
  rig.place = (x, z, yaw) => { rig.x = x; rig.z = z; rig.yaw = yaw; };
  /** o: { arm (rad, 0 forward, negative up), lean, step (art units), crouch, circle } */
  rig.pose = (o, t, dt) => {
    const arm = o.arm ?? -1.2, lean = o.lean ?? 0, step = o.step ?? 0, crouch = o.crouch ?? 0;
    const YAW = rig.yaw, fx = Math.sin(YAW), fz = Math.cos(YAW), UPv = UP;
    const breath = Math.sin(t * 2.2), drop = 0.035 + crouch * 0.24 + breath * 0.004, flex = 7 + lean * 20 + crouch * 14;
    h.root.position.set(rig.x + fx * step / PX_PER_M_PER_K, 0, rig.z + fz * step / PX_PER_M_PER_K);
    h.root.rotation.y = YAW; h.facing = YAW;
    const th = 10 + drop * 217, ca = 14 + drop * 260;
    const offs = {
      Pelvis: { flex: flex * 0.2, twist: -4 }, Spine: { flex: flex * 0.28, twist: -4 }, Spine1: { flex: flex * 0.28, twist: -3 }, Spine2: { flex: flex * 0.24 },
      Neck: { flex: -flex * 0.35 + 4 }, Head: { flex: -flex * 0.3 },
      R_Thigh: { flex: th + 5, abduct: 6 }, L_Thigh: { flex: th - 4, abduct: 6 }, R_Calf: { flex: ca + 3 }, L_Calf: { flex: ca - 3 },
    };
    body.writePose(offs, [0, -drop, 0.02 + lean * 0.03 + crouch * 0.04]);
    const toWorld = (l, u, f, out) => out.set(l, u, f).applyAxisAngle(UPv, YAW).add(h.root.position);
    const sp = 0.17, feet = { R: [-sp, 0, 0.1 + step * 0.012], L: [sp, 0, -0.08] };
    for (const side of ['L', 'R']) {
      const f = feet[side];
      toWorld(f[0], f[1] + h._ankleRest, f[2], v);
      qy.setFromAxisAngle(UPv, YAW);
      h.setReachFoot(side, v, 1, qy.clone().multiply(h._restQ[`${side}_Foot`]));
    }
    h.setReach('L', null); h.setReach('R', null);
    h.update(dt);
    const sh = h.bones.Bip01_R_UpperArm.getWorldPosition(new Vector3());
    const circ = o.circle ?? 1, wob = t * 7.5, reach = 0.56;
    const fwd = Math.cos(arm) * reach + Math.sin(wob) * 0.035 * circ, upv = -Math.sin(arm) * reach + Math.cos(wob) * 0.035 * circ;
    const target = new Vector3(sh.x + fx * fwd - fz * 0.1 * 0 + fz * 0.0, sh.y + upv - 0.02, sh.z + fz * fwd);
    // a little toward the camera side of the body so the arm clears the head
    target.x += -fz * -0.0; target.z += 0.1 * Math.abs(fx);
    h.setReach('R', target, 1);
    h.setFingers('R', grip);
    const lt = new Vector3(); toWorld(0.3, 0.86 - drop, 0.1, lt);
    h.setReach('L', lt, 1);
    h.setFingers('L', 'relaxed');
    h.update(0);
  };
  return rig;
}

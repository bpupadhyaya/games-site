// The limbo dancer as a real 3D person (presentation only: reads the engine pose, never writes back to the simulation).
//
// The shared view3d layer supplies the person (athlete_m / athlete_f), the IK and the finger rig; this file poses the skeleton from the engine's
// side-view joints (engine.pose): the trunk arches back over lumbar and thoracic spine, the knees flex, the pelvis sways to the beat, the arms
// balance in three dimensions, the bare feet roll heel to toe, and the wrap, sash and headband tails follow with their own cloth physics.
import { loadHuman, Clip, CLIP_BONES, semanticRot, THREE } from '../vendor3d/index.js';
import { Cloth } from './cloth.js';

const { Vector3, Quaternion, Euler } = THREE;
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const bi = (n) => CLIP_BONES.indexOf(`Bip01_${n}`);

// Barefoot on the sand: drop the trainer triangles, repaint the shoe and sock texture area in skin colour (a canvas copy of THIS person's
// texture: the shared vendored textures stay untouched).
function bareFeet(human) {
  const N = 1024;
  human._applyRest(); human.root.updateMatrixWorld(true);
  const ank = { L: human.bones.Bip01_L_Foot.getWorldPosition(new THREE.Vector3()), R: human.bones.Bip01_R_Foot.getWorldPosition(new THREE.Vector3()) };
  const v3 = new THREE.Vector3();
  human.root.traverse((o) => {
    if (!o.isSkinnedMesh || o.geometry.userData.barefoot) return;
    const geo = o.geometry, ix = geo.index, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, ps = geo.attributes.position;
    if (!ix || !si) return;
    o.updateMatrixWorld(true);
    const foot = new Set(o.skeleton.bones.map((bn, i) => (/_(Foot|Toe0)$/.test(bn.name) ? i : -1)).filter((i) => i >= 0));
    const calf = new Set(o.skeleton.bones.map((bn, i) => (/_Calf$/.test(bn.name) ? i : -1)).filter((i) => i >= 0));
    const n = ps.count, w = new Float32Array(n), wc = new Float32Array(n), low = new Uint8Array(n);
    const secs = { L: [], R: [] };
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 4; k++) { const b = si.getComponent(i, k), s = sw.getComponent(i, k); if (foot.has(b)) w[i] += s; if (calf.has(b)) wc[i] += s; }
      v3.fromBufferAttribute(ps, i).applyMatrix4(o.matrixWorld);
      const ay = Math.min(ank.L.y, ank.R.y);
      if (v3.y < ay + 0.115 && (w[i] + wc[i]) > 0.6) low[i] = 1;      // the sock cuff and the lowest bit of the shin: replaced by our own ankle
      if (v3.y >= ay + 0.118 && v3.y < ay + 0.16 && wc[i] > 0.6) secs[v3.distanceTo(ank.L) < v3.distanceTo(ank.R) ? 'L' : 'R'].push(v3.clone());
    }
    const a = ix.array;
    for (let t = 0; t < a.length; t += 3) {
      const g = (j) => a[t + j];
      if ((w[g(0)] > 0.55 && w[g(1)] > 0.55 && w[g(2)] > 0.55) || (low[g(0)] && low[g(1)] && low[g(2)])) { a[t + 1] = a[t]; a[t + 2] = a[t]; }
    }
    ix.needsUpdate = true; geo.userData.barefoot = true;
    human._legSec = secs;
  });
  const cv = () => { const c = globalThis.document.createElement('canvas'); c.width = c.height = N; return c; };
  const read = (img) => { const c = cv(); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, N, N); return { c, g, d: g.getImageData(0, 0, N, N) }; };
  for (const m of human.mats) {
    if (m.userData.kind !== 'body' || !m.map || !m.userData.tint) continue;
    const u = m.userData.tint;
    const A = read(m.map.image), M = read(u.tMask.value.image), S = read(u.tSkin.value.image);
    const a = A.d.data, mk = M.d.data, sk = S.d.data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 540; y < 760; y += 2) for (let x = 40; x < 270; x += 2) { const i = (y * N + x) * 4; r += a[i]; g += a[i + 1]; b += a[i + 2]; n++; }
    r /= n; g /= n; b /= n;
    const paint = (x0, y0, x1, y1, test) => {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * N + x) * 4;
        if (test && !test(i)) continue;
        const L = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
        const sh = Math.pow(clamp(L / 215, 0.55, 1.12), 0.55);
        a[i] = clamp(r * sh, 0, 255); a[i + 1] = clamp(g * sh, 0, 255); a[i + 2] = clamp(b * sh, 0, 255); a[i + 3] = 255;
        sk[i] = 255; mk[i] = 0; mk[i + 1] = 0; mk[i + 2] = 0;
      }
    };
    paint(225, 868, 400, 1024);                                              // trainers -> bare feet
    paint(630, 868, 805, 1024);
    paint(0, 436, 330, 500, (i) => mk[i + 2] > 100 || (a[i] > 200 && a[i + 1] > 200));   // sock tops
    paint(700, 436, 1024, 500, (i) => mk[i + 2] > 100 || (a[i] > 200 && a[i + 1] > 200));
    A.g.putImageData(A.d, 0, 0); M.g.putImageData(M.d, 0, 0); S.g.putImageData(S.d, 0, 0);
    const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t; };
    m.map = tex(A.c, true); u.tMask.value = tex(M.c, false); u.tSkin.value = tex(S.c, false);
    m.needsUpdate = true;
  }
}

// Bare feet: a lofted foot (heel, arch, ball, instep sloping to the toes) with five toes and nails, plus a skin sleeve over the ankle that
// hides the painted sock line. Parented to the foot bones in the foot's own rest frame, so it follows the IK and the heel-toe roll.
const FOOT_SECTIONS = [   // z (forward from the ankle), half width, top y, bottom y   (y = 0 at the ankle; the floor is at about -0.085)
  [-0.050, 0.030, -0.040, -0.072], [-0.036, 0.038, -0.012, -0.084], [-0.010, 0.040, 0.006, -0.085], [0.020, 0.039, 0.000, -0.080],
  [0.055, 0.042, -0.030, -0.076], [0.095, 0.047, -0.056, -0.084], [0.130, 0.047, -0.067, -0.085], [0.158, 0.043, -0.071, -0.085],
];
function footGeometry(med) {
  const M = 14, pos = [], idx = [];
  const ring = (z, hw, top, bot) => {
    const cy = (top + bot) / 2, hh = (top - bot) / 2;
    for (let j = 0; j < M; j++) {
      const a = (j / M) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), e = 0.62;
      const px = Math.sign(c) * Math.pow(Math.abs(c), e) * hw, py = Math.sign(s) * Math.pow(Math.abs(s), e) * hh;
      pos.push(px, cy + py, z);
    }
  };
  for (const s of FOOT_SECTIONS) ring(...s);
  const N = FOOT_SECTIONS.length;
  for (let i = 0; i < N - 1; i++) for (let j = 0; j < M; j++) { const a = i * M + j, b = i * M + (j + 1) % M, c = a + M, d2 = b + M; idx.push(a, c, b, b, c, d2); }
  // end caps (heel back, toe front)
  const cb = pos.length / 3; pos.push(0, (FOOT_SECTIONS[0][2] + FOOT_SECTIONS[0][3]) / 2, FOOT_SECTIONS[0][0] - 0.004);
  const cf = pos.length / 3; pos.push(0, (FOOT_SECTIONS[N - 1][2] + FOOT_SECTIONS[N - 1][3]) / 2, FOOT_SECTIONS[N - 1][0] + 0.01);
  for (let j = 0; j < M; j++) { idx.push(cb, j, (j + 1) % M); const o = (N - 1) * M; idx.push(cf, o + (j + 1) % M, o + j); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  void med; return g;
}
function addFeet(human, hex) {
  human._applyRest(); human.root.updateMatrixWorld(true);
  const mat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.72, metalness: 0 });
  const toeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).multiplyScalar(0.97), roughness: 0.72, metalness: 0 });
  const nailMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).lerp(new THREE.Color('#f2d6c8'), 0.45), roughness: 0.4, metalness: 0 });
  const geo = footGeometry();
  const toeG = new THREE.CapsuleGeometry(1, 1, 3, 8);
  for (const side of ['L', 'R']) {
    const fb = human.bones[`Bip01_${side}_Foot`];
    const fr = human._sole[side];
    const upV = fr.up.clone().normalize(), fwdV = fr.fwd.clone().normalize();
    fwdV.addScaledVector(upV, -fwdV.dot(upV)).normalize();
    const leftV = upV.clone().cross(fwdV).normalize();
    const g = new THREE.Group(); g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(leftV, upV, fwdV));
    const foot = new THREE.Mesh(geo, mat); foot.castShadow = true; g.add(foot);
    const medial = side === 'L' ? -1 : 1;
    // toes: big toe first (medial side), then four smaller ones curving away
    const R = [0.0145, 0.0105, 0.0098, 0.0088, 0.0078], X = [0.027, 0.0095, -0.0065, -0.0215, -0.0335], Lg = [0.030, 0.026, 0.022, 0.019, 0.015], Z = [0.17, 0.176, 0.174, 0.166, 0.156];
    R.forEach((r, i) => {
      const t = new THREE.Mesh(toeG, toeMat);
      t.scale.set(r, Lg[i] * 0.5, r * 0.82); t.rotation.x = Math.PI / 2; t.rotation.z = (i - 0) * 0.06 * medial;
      t.position.set(medial * X[i], -0.073 + (i === 0 ? 0.004 : 0), Z[i] + Lg[i] * 0.25);
      g.add(t);
      const nail = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), nailMat); nail.scale.set(r * 0.62, 0.0022, r * 0.5);
      nail.position.set(medial * X[i], -0.073 + (i === 0 ? 0.004 : 0) + r * 0.82, Z[i] + Lg[i] * 0.55); g.add(nail);
    });
    fb.add(g);
    // lower shin and ankle in skin colour, from the ankle up into the leg over the removed sock cuff (radius measured from the leg itself);
    // attached to the calf bone with its rest transform
    const calfB = human.bones[`Bip01_${side}_Calf`];
    const A = fb.getWorldPosition(new THREE.Vector3());
    const sec = (human._legSec && human._legSec[side]) || [];
    const top = new THREE.Vector3(A.x, A.y + 0.14, A.z); let rTop = 0.036;
    if (sec.length > 4) {
      top.set(0, 0, 0); sec.forEach((p) => top.add(p)); top.multiplyScalar(1 / sec.length);
      rTop = sec.reduce((s, p) => s + Math.hypot(p.x - top.x, p.z - top.z), 0) / sec.length;
    }
    const bot = new THREE.Vector3(A.x, A.y + 0.012, A.z);
    const axis = top.clone().sub(bot), len = axis.length() + 0.03; axis.normalize();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(rTop * 0.97, rTop * 0.72, len, 16, 1, false), mat);
    tube.position.copy(bot).addScaledVector(axis, len / 2 - 0.0);
    tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    tube.castShadow = true;
    calfB.attach(tube);
  }
  return [mat, toeMat];
}

// One skeleton "pose clip" rewritten every frame (the same trick as the wrestlers): rest pose + semantic bone offsets.
class Pose {
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
  write(offs, pel) {
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


// A thin head band (the dancer wears one) as a ring around the head bone, parented so it follows the head.
function addBand(human, hex) {
  human._applyRest(); human.root.updateMatrixWorld(true);
  const head = human.bones.Bip01_Head;
  const mat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.6, metalness: 0, side: THREE.DoubleSide });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.03, 28, 1, true), mat);
  band.scale.set(0.088, 1, 0.1);
  const g = new THREE.Group(); g.add(band);
  const hp = head.getWorldPosition(new Vector3()), inv = head.getWorldQuaternion(new Quaternion()).invert();
  g.quaternion.copy(inv);
  const world = hp.clone().add(new Vector3(0, 0.152, 0.0));
  g.position.copy(world.sub(hp).applyQuaternion(inv));
  head.add(g);
  return mat;
}

const K = 1.74;                                  // metres per body-height unit of the engine's pose
const THIGH = 0.255, SHIN = 0.25;                // the engine's leg bones (body heights)
// two-bone leg IK in the engine's side view (knee bends forward)
function legIK(hx, hy, ax, ay) {
  let dx = ax - hx, dy = ay - hy, d = Math.hypot(dx, dy);
  const reach = THIGH + SHIN - 0.002;
  if (d > reach) { dx *= reach / d; dy *= reach / d; d = reach; ax = hx + dx; ay = hy + dy; }
  if (d < 0.05) d = 0.05;
  const a = (THIGH * THIGH - SHIN * SHIN + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, THIGH * THIGH - a * a));
  const ux = dx / d, uy = dy / d;
  return { knee: { x: hx + ux * a - uy * h, y: hy + uy * a + ux * h }, ankle: { x: ax, y: ay } };
}
const YAW = Math.PI / 2;                         // the dancer walks towards +x

/**
 * One dancer. `group` is a world-space parent for the cloth; the person's root is `human.root` (added to the scene by the caller via add()).
 */
export async function createDancer({ base, character = 'athlete_m', kit, skin = '#8a5a3c', hair = '#1b1210', quality = 'medium' } = {}) {
  const human = await loadHuman({ character, base, kit: kit || { top: '#ff6a4d', bottoms: '#18b7a6', socks: '#ffffff' }, skin, hair });
  bareFeet(human);
  const footMats = addFeet(human, skin);
  const bandMat = addBand(human, '#ffd873');
  const cloth = new Cloth(human, {});
  const pose = new Pose(human);
  human.root.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = quality !== 'low'; o.frustumCulled = false; } });

  const D = { human, cloth, root: human.root, footMats, bandMat, group: cloth.group, lookKey: '', quality, rootX: 0 };
  const v = new Vector3(), up = new Vector3(0, 1, 0), zax = new Vector3(0, 0, 1), qy = new Quaternion(), qz = new Quaternion(), qt = new Quaternion();
  const deg = (r) => r / D2R;
  const gait = { init: false, reset: false, f: [null, null], lastHip: 0, w: 1 };
  const tmpArm = new Vector3();
  const armSpring = { R: { p: new Vector3(), v: new Vector3(), init: false }, L: { p: new Vector3(), v: new Vector3(), init: false } };
  D.resetGait = () => { gait.reset = true; armSpring.R.init = armSpring.L.init = false; };
  D.gait = gait;
  const spring = (cur, vel, target, k, dt) => { const a = (target - cur) * k * k - vel * 2 * k; vel += a * dt; return [cur + vel * dt, vel]; };

  D.setLook = (lk) => {
    if (D.lookKey === lk.name) return;
    D.lookKey = lk.name;
    human.setKit({ top: lk.top, bottoms: lk.bottom, socks: '#ffffff' });
    human.setSkin(lk.skin); human.setHair(lk.hair);
    for (const m of footMats) m.color.set(lk.skin).multiplyScalar(m === footMats[1] ? 0.96 : 1);
    bandMat.color.set(lk.band);
    cloth.setColors({ wrap: lk.wrap || lk.band, trim: lk.top, sash: lk.top, band: lk.band });
  };

  // pose offsets accumulated here then written once
  D.apply = ({ p, att, ang = 0, sit = 0, cheer = 0, dt = 1 / 60, rootX = 0, phase = 0, beat = 0, wind = 0, J: Jin = null, fall = 0 }) => {
    const J = Jin;
    D.rootX = rootX;
    human.root.position.set(rootX, 0, 0);
    human.root.rotation.y = YAW; human.facing = YAW;
    const l = p.lean;
    // ---- trunk: arch spread over pelvis, lumbar, thoracic; the head keeps looking at the bar
    const tx = J.sh.x - J.hip.x, ty = J.sh.y - J.hip.y;
    const trunk = deg(Math.atan2(tx, ty));                       // + forward, - back
    const hx = J.head.x - J.neck.x, hy = J.head.y - J.neck.y;
    const headAbs = deg(Math.atan2(hx, hy));
    const breathe = Math.sin(D.t * 1.6) * 0.8;
    const swayPh = Math.sin(phase);
    const offs = {};
    offs.Pelvis = { flex: trunk * 0.16, side: -swayPh * 3.2 * (1 - 0.5 * l), twist: swayPh * 5.0 * (1 - 0.4 * l) };
    offs.Spine = { flex: trunk * 0.28 + breathe * 0.3, twist: -swayPh * 2.0, side: swayPh * 1.5 };
    offs.Spine1 = { flex: trunk * 0.26 + breathe * 0.4, twist: -swayPh * 2.5, side: swayPh * 1.0 };
    offs.Spine2 = { flex: trunk * 0.2 + breathe * 0.5, twist: -swayPh * 2.5 };
    const headWant = headAbs * 0.55 + 6;                         // gaze a little up
    const headRel = headWant - trunk * 0.9;
    offs.Neck = { flex: headRel * 0.45 };
    offs.Head = { flex: headRel * 0.55, side: swayPh * 1.5 };
    // ---- gait: feet are PLANTED in the world and only leave the sand to step. The stance foot never slides; a step is triggered when the
    // foot is far enough behind the hips and lands ahead of them, so the stride follows the distance actually travelled.
    const sink = 0.03 + 0.07 * l;                                       // the real back is thick: the spine line sits below the bar the sim measures
    const hipW = rootX + J.hip.x * K;
    if (!gait.init || Math.abs(hipW - gait.lastHip) > 1.2 || gait.reset) {
      gait.init = true; gait.reset = false;
      gait.f[0] = { x: hipW + 0.07, lift: 0, sw: false, t: 0, from: 0, to: 0, dur: 0.3, vx: 0, pitch: 0, pv: 0 };
      gait.f[1] = { x: hipW - 0.07, lift: 0, sw: false, t: 0, from: 0, to: 0, dur: 0.3, vx: 0, pitch: 0, pv: 0 };
      gait.lastHip = hipW;
    }
    const vH = dt > 0 ? (hipW - gait.lastHip) / dt : 0; gait.lastHip = hipW;
    const walking = att && (att.phase === 'run' || att.phase === 'clear');
    for (const f of gait.f) {
      const x0 = f.x;
      if (f.sw) { f.t += dt; const u = Math.min(1, f.t / f.dur); const e = u * u * (3 - 2 * u); f.x = f.from + (f.to - f.from) * e; f.lift = Math.sin(Math.PI * Math.min(1, u)) * (0.045 + 0.025 * (1 - l)); if (u >= 1) { f.sw = false; f.lift = 0; } }
      f.vx = dt > 0 ? (f.x - x0) / dt : 0;
    }
    if (walking) {
      const rear = gait.f[0].x < gait.f[1].x ? 0 : 1, f = gait.f[rear], o = gait.f[1 - rear];
      if (!f.sw && !o.sw && hipW - f.x > 0.15 + 0.07 * l) {
        f.sw = true; f.t = 0; f.from = f.x; f.to = hipW + 0.15 + clamp(vH * 0.14, 0, 0.14); f.dur = clamp(0.44 - 0.16 * clamp(vH / 1.0, 0, 1), 0.26, 0.46);
      }
    }
    const wPlant = (att && att.phase === 'fall') || sit > 0.02 ? 0 : 1;
    gait.w += (wPlant - gait.w) * Math.min(1, dt / 0.12);
    const hipY = J.hip.y - sink / K;
    const mkAnkle = (f, simA) => {
      const px = (f.x - rootX) / K, py = 0.025 + f.lift / K;
      return { x: simA.x + (px - simA.x) * gait.w, y: simA.y + (py - simA.y) * gait.w };
    };
    const A = [mkAnkle(gait.f[0], J.nA), mkAnkle(gait.f[1], J.fA)];
    const kneeOf = (an, simK) => {
      const ik = legIK(J.hip.x, hipY, an.x, an.y);
      return { x: simK.x + (ik.knee.x - simK.x) * gait.w, y: simK.y + (ik.knee.y - simK.y) * gait.w };
    };
    const Kn = [kneeOf(A[0], J.nK), kneeOf(A[1], J.fK)];
    const leg = (hip, knee, ank) => {
      const tAng = deg(Math.atan2(knee.x - hip.x, hip.y - knee.y));
      const sAng = deg(Math.atan2(ank.x - knee.x, knee.y - ank.y));
      return { thigh: tAng, bend: clamp(tAng - sAng, 0, 150) };
    };
    const hipE = { x: J.hip.x, y: hipY };
    const nl = leg(hipE, Kn[0], A[0]), fl = leg(hipE, Kn[1], A[1]);
    const pelAbs = trunk * 0.16;
    const toeOut = 7 + 6 * l;
    offs.R_Thigh = { flex: nl.thigh + pelAbs, abduct: 3 + 4 * l, twist: toeOut * 0.5 }; offs.R_Calf = { flex: nl.bend };
    offs.L_Thigh = { flex: fl.thigh + pelAbs, abduct: 3 + 4 * l, twist: -toeOut * 0.5 }; offs.L_Calf = { flex: fl.bend };
    const latSway = Math.sin(phase + 0.4) * 0.022 * (1 - 0.5 * l);
    pose.write(offs, [latSway, J.hip.y * K - pose.ph - sink, J.hip.x * K]);

    // ---- feet: ankle targets from the gait; toe-off, flat swing and heel strike set the pitch
    const ft = (a, side, z, f) => {
      const ay = Math.max(a.y * K, 0);
      v.set(rootX + a.x * K, ay + human._ankleRest - 0.05, z);
      const lift = clamp(f.lift / 0.05, 0, 1);
      let pt = 0;
      if (f.sw) { const u = clamp(f.t / f.dur, 0, 1); pt = -0.32 * Math.sin(Math.PI * Math.min(1, u / 0.45)) + 0.18 * Math.sin(Math.PI * clamp((u - 0.6) / 0.4, 0, 1)); }
      // critically damped follower: the foot rolls instead of snapping between toe-off, swing and heel strike
      const kk = 15, acc = ((pt - f.pitch) * kk * kk - f.pv * 2 * kk); f.pv += acc * dt; f.pitch += f.pv * dt;
      const pitch = f.pitch;
      const rq = human._restQ[`${side}_Foot`];
      qy.setFromAxisAngle(up, YAW + (side === 'L' ? 1 : -1) * toeOut * D2R * 0.25);
      qz.setFromAxisAngle(zax, -(J.ang || 0) + pitch * gait.w);
      human.setReachFoot(side, v, 1, qt.copy(qz).multiply(qy).multiply(rq));
      return { lift, vx: f.vx / K, x: v.x, y: v.y, z, lifted: lift > 0.12 };
    };
    const zS = 0.105 + 0.04 * l;
    const fN = ft(A[0], 'R', zS, gait.f[0]), fF = ft(A[1], 'L', -zS, gait.f[1]);
    human.setReach('L', null); human.setReach('R', null);
    human.update(dt);
    // ---- hands: relative to the solved shoulders, spread out sideways for balance as the lean deepens
    const shR = human.bones.Bip01_R_UpperArm.getWorldPosition(new Vector3()), shL = human.bones.Bip01_L_UpperArm.getWorldPosition(new Vector3());
    const wob = clamp(att ? att.wobble : 0, -1.2, 1.2);
    const hand = (side, shoulder, H, s) => {
      const dx = (H.x - J.sh.x) * K, dy = (H.y - J.sh.y) * K, r = Math.hypot(dx, dy);
      const phi = clamp(0.2 + 0.85 * l + 0.25 * Math.abs(wob) + (cheer > 0 ? 0.35 * cheer : 0), 0.15, 1.35);
      const cph = Math.cos(phi), sph = Math.sin(phi);
      v.set(shoulder.x + dx * cph, shoulder.y + dy * cph, shoulder.z + s * r * sph);
      // a critically damped follower on the hand target: arms ease into poses instead of snapping with the engine's joints
      const st = armSpring[side];
      if (!st.init) { st.p.copy(v); st.v.set(0, 0, 0); st.init = true; }
      const kk = 20, ax = (v.x - st.p.x) * kk * kk - st.v.x * 2 * kk, ay = (v.y - st.p.y) * kk * kk - st.v.y * 2 * kk, az = (v.z - st.p.z) * kk * kk - st.v.z * 2 * kk;
      st.v.x += ax * dt; st.v.y += ay * dt; st.v.z += az * dt; st.p.x += st.v.x * dt; st.p.y += st.v.y * dt; st.p.z += st.v.z * dt;
      if (st.p.distanceToSquared(v) > 0.6) { st.p.copy(v); st.v.set(0, 0, 0); }
      const pole = new Vector3(shoulder.x + dx * 0.4 - 0.25, shoulder.y + dy * 0.4 - 0.05, shoulder.z + s * (0.22 + r * sph * 0.45));
      const tgt = shoulder.clone().add(tmpArm.copy(st.p).sub(shoulder).clampLength(0, 0.5));   // never fully straight: no elbow snap
      human.setReach(side, tgt, { weight: 1, pole });
    };
    hand('R', shR, J.nH, 1); hand('L', shL, J.fH, -1);
    const open = l > 0.5 || Math.abs(wob) > 0.5 || cheer > 0.2 || fall > 0;
    human.setFingers('R', open ? 'open' : 'relaxed'); human.setFingers('L', open ? 'open' : 'relaxed');
    human.update(0);
    // ---- cloth: wind gust pushes the free ends, the body does the rest
    cloth.update(dt, new Vector3(-wind * 0.6, 0.0, wind * 0.25));
    return { feet: [fN, fF], trunk, headBone: human.bones.Bip01_Head };
  };
  D.t = 0;
  return D;
}

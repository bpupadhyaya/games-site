// Real 3D horo dancers (presentation only: it READS the same dance numbers the painted chain uses and never writes back).
//
// platform/view3d supplies the people (athlete_m / athlete_f), the stage and the skeleton. This file dresses them in generic Bulgarian
// folk clothes (white shirt with long sleeves, dark trousers, sash and cap for the men; white blouse, long skirt, apron and headscarf for
// the women), links their hands to the neighbours' belts with two-bone IK (actor.js), steps and hops them on the groove, and renders the
// whole chain in ONE off-screen WebGL pass that the 2D scene composites with drawImage. Pads, sash, HUD and particles stay 2D.
// When WebGL2 is missing, the context is lost, the models are still loading or the device is too slow, art.js paints the chain instead.
import { createStage, loadHuman, THREE } from '../vendor3d/index.js';
import { Actor } from './actor.js';
import { COSTUMES } from '../src/art.js';

const { Vector3, Quaternion } = THREE;
const V = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const TAU = Math.PI * 2;
const D2R = Math.PI / 180;
const mat = (c, rough = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0, ...extra });

const SKIN = ['light', 'tan', 'light', 'tan', 'light', 'tan', 'light', 'tan', 'light', 'tan'];
const HAIR = ['brown', 'black', 'black', 'brown', 'black', 'brown', 'ginger', 'black', 'brown', 'black'];
export const MAX_DANCERS = 10;

// ---- textures ---------------------------------------------------------------------------------------------------------------------------
const texCache = new Map();
function skirtTex(C) {
  const key = `skirt|${C.skirt}|${C.trim}`;
  if (texCache.has(key)) return texCache.get(key);
  const cv = globalThis.document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d'), W = 512, H = 256;
  g.fillStyle = C.skirt; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)'; g.fillRect((i * W) / 40, 0, W / 40, H); }
  g.fillStyle = C.trim; g.fillRect(0, H * 0.78, W, H * 0.045); g.fillRect(0, H * 0.9, W, H * 0.03);
  g.fillStyle = 'rgba(255,244,222,0.7)';
  for (let i = 0; i < 24; i++) { g.beginPath(); g.arc((i + 0.5) * (W / 24), H * 0.67, 3.2, 0, TAU); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 2;
  texCache.set(key, t); return t;
}

// ---- dressing: rigid pieces parented to bones ---------------------------------------------------------------------------------------------
const wscale = (bone) => bone.getWorldScale(V()).x || 1;
function attachTube(bone, child, r0, r1, m, ext = 0) {
  const ws = wscale(bone);
  const a = bone.getWorldPosition(V()), b = child.getWorldPosition(V());
  const dir = b.clone().sub(a), len = dir.length() / ws; dir.normalize();
  const inv = bone.getWorldQuaternion(new Quaternion()).invert();
  const ld = dir.clone().applyQuaternion(inv);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1 / ws, r0 / ws, len * (1 + ext), 16, 1), m);
  mesh.quaternion.setFromUnitVectors(V(0, 1, 0), ld);
  mesh.position.copy(ld).multiplyScalar((len * (1 + ext)) / 2);
  bone.add(mesh);
  return mesh;
}
function attachSeg(bone, child, r0, r1, m, k0, k1) {      // a tube covering only the k0..k1 part of the way from bone to child
  const ws = wscale(bone);
  const a = bone.getWorldPosition(V()), b = child.getWorldPosition(V());
  const dir = b.clone().sub(a), len = dir.length() / ws; dir.normalize();
  const inv = bone.getWorldQuaternion(new Quaternion()).invert();
  const ld = dir.clone().applyQuaternion(inv);
  const l = len * (k1 - k0);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1 / ws, r0 / ws, l, 16, 1), m);
  mesh.quaternion.setFromUnitVectors(V(0, 1, 0), ld);
  mesh.position.copy(ld).multiplyScalar(len * (k0 + k1) / 2);
  bone.add(mesh);
  return mesh;
}
function attachBall(bone, r, m, off = V()) {
  const ws = wscale(bone);
  const inv = bone.getWorldQuaternion(new Quaternion()).invert();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r / ws, 18, 12), m);
  mesh.position.copy(off.clone().applyQuaternion(inv)).divideScalar(ws);
  bone.add(mesh);
  return mesh;
}
function attachWorld(bone, mesh, worldOff) {
  const ws = wscale(bone);
  const inv = bone.getWorldQuaternion(new Quaternion()).invert();
  mesh.position.copy(worldOff.clone().applyQuaternion(inv)).divideScalar(ws);
  mesh.quaternion.copy(inv);
  mesh.scale.setScalar(1 / ws);
  bone.add(mesh);
  return mesh;
}
function attachShoe(foot, toe, m, w = 0.058, hgt = 0.055, half = 0.16, ahead = 0.065) {
  const ws = wscale(foot);
  const a = foot.getWorldPosition(V()), b = toe.getWorldPosition(V());
  const dir = b.clone().sub(a); dir.y = 0; dir.normalize();
  const inv = foot.getWorldQuaternion(new Quaternion()).invert();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), m);
  const qw = new Quaternion().setFromAxisAngle(V(0, 1, 0), Math.atan2(dir.x, dir.z));
  mesh.scale.set(w / ws, hgt / ws, half / ws);
  mesh.quaternion.copy(inv.clone().multiply(qw));
  const off = dir.clone().multiplyScalar(ahead); off.y = -0.05;
  mesh.position.copy(off.applyQuaternion(inv)).divideScalar(ws);
  foot.add(mesh);
  return mesh;
}
const SEG = 32, RING = 10;
function lathe() {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((SEG + 1) * (RING + 1) * 3), uv = new Float32Array((SEG + 1) * (RING + 1) * 2), idx = [];
  for (let j = 0; j <= RING; j++) for (let i = 0; i <= SEG; i++) { const k = j * (SEG + 1) + i; uv[k * 2] = i / SEG; uv[k * 2 + 1] = 1 - j / RING; }
  for (let j = 0; j < RING; j++) for (let i = 0; i < SEG; i++) { const a = j * (SEG + 1) + i, b = a + 1, c = a + SEG + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

async function makePerson(stage, idx) {
  const C = COSTUMES[idx % COSTUMES.length], fem = C.f;
  const h = await loadHuman({
    character: fem ? 'athlete_f' : 'athlete_m',
    kit: { top: C.top, bottoms: fem ? '#efe2c6' : C.trousers, socks: fem ? '#efe2c6' : C.trousers },
    skin: SKIN[idx % SKIN.length], hair: HAIR[idx % HAIR.length],
  });
  h.groundClamp = 'off'; h.footPlanting = false;
  h.play('idle', { fade: 0 });
  const B = (n) => h.bones[`Bip01_${n}`];
  h.root.updateMatrixWorld(true);
  const actor = new Actor(h);
  const D = { human: h, actor, idx, C, fem };
  const wp = (n) => B(n).getWorldPosition(V());
  D.pelvisY = wp('Pelvis').y;
  D.sh = { L: wp('L_UpperArm').sub(wp('Pelvis')), R: wp('R_UpperArm').sub(wp('Pelvis')) };
  D.armU = wp('L_UpperArm').distanceTo(wp('L_Forearm'));
  D.armF = wp('L_Forearm').distanceTo(wp('L_Hand'));
  D.stand = D.pelvisY - 0.03;
  D.height = fem ? 1.74 : 1.8;

  const stock = mat('#efe2c6', 0.8), shirt = mat(C.top, 0.72), dark = mat(C.f ? '#efe2c6' : C.trousers, 0.8), shoe = mat('#4a2814', 0.5);
  for (const s of ['L', 'R']) {
    const up = B(`${s}_UpperArm`), fo = B(`${s}_Forearm`), hd = B(`${s}_Hand`);
    // long sleeves: shoulder cap, upper-arm and forearm tubes, elbow ball; a cuff stripe at the wrist
    attachBall(up, fem ? 0.05 : 0.074, shirt);
    attachTube(up, fo, fem ? 0.05 : 0.07, fem ? 0.046 : 0.06, shirt, 0.1);
    attachBall(fo, fem ? 0.043 : 0.056, shirt);
    attachTube(fo, hd, fem ? 0.048 : 0.058, fem ? 0.042 : 0.05, shirt, -0.08);
    const th = B(`${s}_Thigh`), ca = B(`${s}_Calf`), ft = B(`${s}_Foot`);
    if (!fem) {
      attachTube(th, ca, 0.125, 0.085, dark, 0.02);
      attachBall(ca, 0.08, dark);
      attachTube(ca, ft, 0.075, 0.056, dark, 0.0);
    }
    if (fem) {  }
    attachShoe(ft, B(`${s}_Toe0`), shoe, 0.058, 0.055, fem ? 0.15 : 0.165);
  }
  if (!fem) {
    // flat cap with a red band
    const hat = new THREE.Group();
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 12, 0, TAU, 0, Math.PI * 0.5), mat(C.hat, 0.8));
    cap.scale.set(1, 0.8, 1.05);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.119, 0.012, 8, 24), mat('#c3202c', 0.6)); band.rotation.x = Math.PI / 2;
    hat.add(cap, band);
    attachWorld(B('Head'), hat, V(0, 0.115, -0.01));
    D.sash = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.028, 8, 28), mat(C.sash, 0.55)); D.sash.frustumCulled = false; stage.add(D.sash);
    D.vestL = null;
  } else {
    // headscarf over the hair with a knot at the nape
    const sc = new THREE.Group();
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.122, 20, 12, 0, TAU, 0, Math.PI * 0.62), mat(C.scarf, 0.7));
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.012, 8, 24), mat(C.trim, 0.5)); hem.rotation.x = Math.PI / 2; hem.position.y = 0.045;
    sc.add(cap, hem);
    attachWorld(B('Head'), sc, V(0, 0.115, -0.015));
    D.apron = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.48, 0.02), mat(C.apron, 0.7)); D.apron.frustumCulled = false; stage.add(D.apron);
    D.apronTrim = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.026), mat(C.trim, 0.45)); D.apronTrim.frustumCulled = false; stage.add(D.apronTrim);
  }
  D.skirtGeo = lathe();
  D.skirt = new THREE.Mesh(D.skirtGeo, mat('#ffffff', 0.8, { map: fem ? skirtTex(C) : null, color: fem ? '#ffffff' : C.trousers, side: THREE.DoubleSide }));
  D.skirt.frustumCulled = false; stage.add(D.skirt);
  if (!fem) D.skirt.visible = false;                       // trousers are the leg tubes
  h.root.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = true; });
  for (const o of [D.skirt, D.sash, D.apron, D.apronTrim]) if (o) o.castShadow = true;
  stage.add(h); stage.track(h);
  D.setVisible = (v) => {
    h.root.visible = v;
    D.skirt.visible = v && fem;
    if (D.sash) D.sash.visible = v;
    if (D.apron) { D.apron.visible = v; D.apronTrim.visible = v; }
  };
  D.setVisible(false);
  return D;
}

// ---- the pose --------------------------------------------------------------------------------------------------------------------------
// st: { bounce, lift, foot, sway, t }. `i` index in the chain, `wx` the world x of this dancer, `nb` neighbour hand points (world),
// `free` 'left'|'right'|null (an end dancer waves the loose arm).
function pose(D, st, i, wx, wy, nb, free, lookAt) {
  const A = D.actor;
  const bounce = clamp((st.bounce ?? 0) - 0.04 * i, 0, 1), lift = clamp(st.lift ?? 0, 0, 1);
  const foot = (st.foot ?? 1) * (i % 2 ? -1 : 1);
  const sway = (st.sway ?? 0) * (1 + 0.15 * Math.sin(0.5 * i));
  const dip = 0.015 + 0.05 * bounce;
  const lead = foot > 0 ? 'R' : 'L';                          // the stepping leg
  const pel = V(wx + sway * 0.03, wy + D.stand - dip, 0);
  const yaw = sway * 0.08;
  const legs = {};
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1, l = s === lead ? lift : lift * 0.1;
    const lf = D.fem ? 0.1 : 1;                      // a long skirt: the step stays low so the knee never pokes through
    const x = sx * (0.105 - 0.03 * l * lf);
    const y = A.groundAnkle + 0.27 * l * lf;
    const z = 0.02 + 0.2 * l * lf;
    const n = [0, -0.93 + 0.4 * l, -0.36], f = [0, 0.36 - 0.9 * l, 0.93 - 0.2 * l];
    legs[s] = { p: [x, y, z], f: 'g', w: 1, pole: [sx * 0.1, 0.2 + 0.4 * l, 1], pf: 'g', aim: { n, face: 'sole', fwd: f, w: 1 } };
  }
  // arms
  const reach = D.armU + D.armF;
  const arms = {};
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1;
    const S = D.sh[s];
    const sh = V(pel.x + S.x, pel.y + S.y, pel.z + S.z);
    let tgt, pole;
    const isFree = (free === 'left' && s === 'R') || (free === 'right' && s === 'L');
    if (isFree) {
      // loose arm up, waving a handkerchief
      const w = Math.sin((st.t ?? 0) * 5 + i);
      tgt = V(sh.x + sx * (0.2 + 0.05 * w), sh.y + 0.42 + 0.03 * Math.abs(sway), sh.z + 0.08);
      pole = [sx * 1, -0.2, -0.35];
    } else {
      // hold the neighbour: both hands meet at the point between the two belts
      tgt = nb[s].clone();
      pole = [sx * 0.7, -0.5, -0.4];
    }
    const d = tgt.clone().sub(sh), l = d.length();
    if (l > reach * 0.98) d.multiplyScalar((reach * 0.98) / l);
    const t2 = sh.clone().add(d);
    arms[s] = { p: [t2.x, t2.y, t2.z], f: 'w', w: 1, pole, pf: 'b' };
  }
  const head = V(0, 0, 0);
  void head;
  return {
    pelvis: pel, yaw, pitch: 0, roll: 0, groundY: wy,
    torso: { bend: 2 + 5 * bounce, side: -sway * 3, twist: sway * 2 },
    pelvisTilt: { bend: 0, side: (foot > 0 ? 1 : -1) * 2 * lift, twist: 0 },
    legs, arms,
    look: { target: lookAt, w: 0.7 },
    headAdd: { pitch: 0, yaw: 0 },
  };
}

// ---- skirt, apron, sash (rebuilt from the live bones) ----------------------------------------------------------------------------------
function updateCloth(D, pose, st, wy) {
  const h = D.human, B = (n) => h.bones[`Bip01_${n}`];
  h.root.updateMatrixWorld(true);
  const pel = B('Pelvis').getWorldPosition(V()), sp = B('Spine').getWorldPosition(V());
  const waistY = lerp(pel.y, sp.y, 0.55) + 0.04, waistX = lerp(pel.x, sp.x, 0.55), waistZ = lerp(pel.z, sp.z, 0.55);
  const yawC = Math.cos(pose.yaw), yawS = Math.sin(pose.yaw);
  if (D.sash) {
    D.sash.position.set(waistX, waistY - 0.03, waistZ + 0.02);
    D.sash.rotation.set(Math.PI / 2, 0, -pose.yaw);
    D.sash.scale.set(1, 0.85, 1);
  }
  if (!D.fem) return;
  const hemY = wy + 0.3, pos = D.skirtGeo.attributes.position;
  const sw = st.sway ?? 0, bn = clamp(st.bounce ?? 0, 0, 1);
  const r0x = 0.17, r0z = 0.17, r1x = 0.31 + 0.03 * bn, r1z = 0.30 + 0.03 * bn;
  for (let j = 0; j <= RING; j++) {
    const s = j / RING;
    const y = waistY + (hemY - waistY) * s;
    const hk = Math.min(1, s * 2.6), hipK = hk * hk * (3 - 2 * hk), fl = Math.pow(s, 1.5);
    const rx = r0x + 0.07 * hipK + (r1x - r0x - 0.07) * fl, rz = r0z + 0.1 * hipK + (r1z - r0z - 0.1) * fl;
    const cx = lerp(waistX, pel.x, s) - sw * 0.03 * s, cz = lerp(waistZ, pel.z, s) + 0.03 * Math.min(1, s * 3);
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * TAU, wave = 1 + s * (0.02 + 0.04 * bn) * Math.sin(a * 5 + (st.t ?? 0) * 5);
      const lx = Math.cos(a) * rx * wave, lz = Math.sin(a) * rz * wave;
      pos.setXYZ(j * (SEG + 1) + i, cx + lx * yawC + lz * yawS, y, cz - lx * yawS + lz * yawC);
    }
  }
  pos.needsUpdate = true; D.skirtGeo.computeVertexNormals();
  // apron: a panel hung on the front of the skirt
  const ay = lerp(waistY, hemY, 0.5) - 0.02, rf = lerp(r0z, r1z, 0.5) * 1.0 + 0.1 * 0.8 + 0.035;
  D.apron.position.set(waistX + Math.sin(pose.yaw) * rf, ay, waistZ + 0.03 + Math.cos(pose.yaw) * rf);
  D.apron.rotation.set(0.1, pose.yaw, 0);
  D.apronTrim.position.set(waistX + Math.sin(pose.yaw) * (rf + 0.01), hemY + 0.03, waistZ + 0.03 + Math.cos(pose.yaw) * (rf + 0.03));
  D.apronTrim.rotation.set(0.12, pose.yaw, 0);
}


// ---- the village square: a lit 3D set behind the chain (ground, houses with lit windows, poplars, bunting, lantern posts) ---------------
function canvasTex(w, h, paint, repeat) {
  const cv = globalThis.document.createElement('canvas'); cv.width = w; cv.height = h; paint(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function rnd(i) { const a = Math.sin(i * 127.1 + 311.7) * 43758.5453; return a - Math.floor(a); }
function buildVillage(quality) {
  const g = new THREE.Group(); g.frustumCulled = false;
  // sky + hills backdrop (opaque: it replaces the painted village inside the 3D window)
  const skyTex = canvasTex(512, 512, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#2a1230'); gr.addColorStop(0.4, '#5a2a52'); gr.addColorStop(0.72, '#a8483c'); gr.addColorStop(1, '#e88a4a');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(255,240,220,${0.2 + 0.5 * rnd(i + 5)})`; c.fillRect(rnd(i) * w, rnd(i + 99) * h * 0.5, 2, 2); }
    c.fillStyle = '#3a1822'; c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) c.lineTo(x, h * 0.7 - 26 * Math.sin(x * 0.011 + 1) - 14 * Math.sin(x * 0.031));
    c.lineTo(w, h); c.closePath(); c.fill();
    c.fillStyle = '#26101a'; c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) c.lineTo(x, h * 0.8 - 18 * Math.sin(x * 0.017 + 3) - 8 * Math.sin(x * 0.05));
    c.lineTo(w, h); c.closePath(); c.fill();
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(150, 60), new THREE.MeshBasicMaterial({ map: skyTex, fog: false }));
  sky.position.set(0, 20, -45); g.add(sky);
  // cobbled square
  const cobTex = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#4a2c20'; c.fillRect(0, 0, w, h);
    for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) {
      const x = (i + (j % 2) * 0.5) * (w / 12), y = j * (h / 12), k = rnd(i * 31 + j * 7);
      c.fillStyle = `rgb(${70 + k * 40},${52 + k * 28},${44 + k * 22})`;
      c.beginPath(); c.roundRect(x + 2, y + 2, w / 12 - 4, h / 12 - 4, 7); c.fill();
    }
  }, [14, 5]);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 36), new THREE.MeshStandardMaterial({ map: cobTex, roughness: 0.92, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -14); ground.receiveShadow = true; g.add(ground);
  // houses
  const wall = ['#8c6f58', '#7e6350', '#97785e', '#846a54'], roofC = ['#9a3a22', '#7a2a1c', '#b04a2a'];
  const winMat = new THREE.MeshBasicMaterial({ color: '#ffc562' }), winOff = new THREE.MeshBasicMaterial({ color: '#3a2428' });
  const houses = [];
  let x = -30, i = 0;
  while (x < 30) {
    const w = 2.3 + rnd(i) * 1.6, h = 2.5 + rnd(i + 40) * 1.7, d = 3, z = -9.5 - (i % 2) * 1.6;
    const wm = new THREE.MeshStandardMaterial({ color: wall[i % wall.length], roughness: 0.95 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wm); b.position.set(x + w / 2, h / 2, z); b.castShadow = false; b.receiveShadow = true; g.add(b);
    const rs = new THREE.Shape(); rs.moveTo(-w / 2 - 0.2, 0); rs.lineTo(0, h * 0.34); rs.lineTo(w / 2 + 0.2, 0); rs.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: d + 0.4, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: roofC[i % 3], roughness: 0.8 }));
    roof.position.set(x + w / 2, h, z - d / 2 - 0.2); g.add(roof);
    for (let k = 0; k < 2; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.2, h * 0.26), winOff);
      m.position.set(x + w * (0.27 + k * 0.46), h * 0.58, z + d / 2 + 0.02); g.add(m);
      houses.push({ m, on: (i + k) % 3 !== 0, base: i * 0.7 + k });
      const sill = new THREE.Mesh(new THREE.BoxGeometry(w * 0.26, 0.05, 0.12), new THREE.MeshStandardMaterial({ color: '#7a4a2a', roughness: 0.9 }));
      sill.position.set(x + w * (0.27 + k * 0.46), h * 0.58 - h * 0.15, z + d / 2 + 0.06); g.add(sill);
    }
    x += w + 0.15 + rnd(i + 7) * 0.6; i++;
  }
  // poplars
  const popM = new THREE.MeshStandardMaterial({ color: '#16241a', roughness: 1 });
  for (let k = -5; k <= 5; k++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.55, 5.2 + rnd(k + 30) * 1.2, 10), popM);
    t.position.set(k * 5.4 + rnd(k) * 2, 2.6, -12.5); g.add(t);
  }
  // bunting between two posts, swaying
  const cols = ['#c3202c', '#f2b632', '#f6e8c9', '#2f9e55'];
  const bunt = [];
  const mk = (x0, x1, y0, sag, z) => {
    const n = 16;
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n, bx = x0 + (x1 - x0) * u, by = y0 - sag * 4 * u * (1 - u);
      const tri = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.17, 0.4, 3), new THREE.MeshStandardMaterial({ color: cols[k % 4], roughness: 0.8, side: THREE.DoubleSide }));
      tri.rotation.x = Math.PI; tri.position.set(bx, by - 0.22, z); g.add(tri); bunt.push({ tri, k, y: by - 0.22 });
    }
    const line = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.018, 0.018), new THREE.MeshStandardMaterial({ color: '#2a1410' })); line.position.set((x0 + x1) / 2, y0 - sag * 0.8, z); g.add(line);
  };
  mk(-13, 13, 4.6, 0.7, -4.8);
  // lantern posts with warm lights
  const lamps = [];
  const lampX = [-3.6, 3.7];
  for (const lx of lampX) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 8), new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.8 })); post.position.set(lx, 1.3, -1.6); g.add(post);
    const lan = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.26), new THREE.MeshBasicMaterial({ color: '#ffd68a' })); lan.position.set(lx, 2.72, -1.6); g.add(lan);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.26, 0.2, 4), new THREE.MeshStandardMaterial({ color: '#2a1a12' })); cap.position.set(lx, 2.98, -1.6); cap.rotation.y = Math.PI / 4; g.add(cap);
    const pl = new THREE.PointLight(0xffa24a, quality === 'low' ? 3 : 5, 11, 1.6); pl.position.set(lx, 2.6, -1.0); g.add(pl);
    lamps.push({ pl, lan, base: quality === 'low' ? 3 : 5, ph: lx });
  }
  g.userData = { houses, winMat, winOff, bunt, lamps };
  return g;
}

// ---- the renderer ----------------------------------------------------------------------------------------------------------------------
export async function createHoro({ quality = 'medium' } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: true, shadows: quality !== 'low', shadowSize: 9, lighting: 'evening', fov: 10 });
  if (!stage.supported) return null;
  stage.setSky(null, null);
  const cam = stage.camera;
  const vil = buildVillage(quality); stage.scene.add(vil);
  const LT = stage.lights; if (LT) { LT.key.intensity *= 0.55; LT.hemi.intensity *= 0.5; LT.rim.intensity *= 0.7; }
  stage.renderer.toneMappingExposure = 0.9;
  const tmp = globalThis.document.createElement('canvas'), tctx = tmp.getContext('2d');
  const TILT = 11 * D2R;
  const api = { stage, ok: true, lost: false, quality, people: [], ready: 0, off: false, err: null };
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { api.lost = false; fitKey = ''; });
  // everybody loads in parallel; a screen uses 3D only when ALL its dancers are ready (never a mix of 3D and painted people)
  const list = await Promise.all(Array.from({ length: MAX_DANCERS }, (_, i) => makePerson(stage, i).catch((e) => { api.err = String(e); return null; })));
  for (const p of list) if (p) api.people.push(p);
  api.people.sort((a, b) => a.idx - b.idx);
  api.ready = api.people.length;
  let fitKey = '', costAvg = 0, costN = 0;
  const fov = 10, tanH = Math.tan((fov / 2) * D2R);

  /** r = the horo rectangle (2D units); st = { count, bounce, lift, foot, sway, t }. Returns true when the chain was drawn in 3D. */
  api.draw = function (ctx, r, st) {
    if (api.off || api.lost || stage.contextLost || !api.ready) return false;
    const cnt = Math.max(1, st.count ?? 6), n = Math.min(MAX_DANCERS, Math.ceil(cnt - 0.35));
    if (api.people.length < n || api.people.slice(0, n).some((p) => p.idx >= MAX_DANCERS)) return false;
    const t0 = globalThis.performance.now();
    const sp = r.w / (cnt + 0.6);
    const ppm = Math.max(20, Math.min((r.h - 8) / 2.0, sp / 0.72));            // 2D units per metre: a person plus a raised hand fits r.h, neighbours 0.72 m apart
    const yb = r.y + r.h - 8;
    const x0c = r.x + r.w / 2 - sp * (cnt - 1) / 2;
    // the 3D window: from the dancers' feet up to the top the layout allows (houses, bunting and sky are part of the lit set)
    const topLim = st.top ?? (yb - 2.1 * ppm);
    const rx0 = r.x, rx1 = r.x + r.w, ry0 = Math.min(yb - 2.1 * ppm, Math.max(topLim, yb - 3.7 * ppm)), ry1 = yb + 0.12 * ppm;
    const rw = rx1 - rx0, rh = ry1 - ry0, rcx = (rx0 + rx1) / 2, rcy = (ry0 + ry1) / 2;
    const m = ctx.getTransform(), pxu = Math.hypot(m.a, m.b);
    const cap = api.quality === 'low' ? 900 : 1500;
    const devW = clamp(Math.round(rw * pxu), 200, cap), devH = Math.max(100, Math.round((devW * rh) / rw));
    const key = `${devW}x${devH}|${rw.toFixed(1)}|${rh.toFixed(1)}`;
    if (key !== fitKey) {
      const rr = stage.renderer; rr.setPixelRatio(1); rr.setSize(devW, devH, false);
      cam.aspect = devW / devH; cam.fov = fov; cam.near = 1; cam.far = 220; cam.updateProjectionMatrix();
      tmp.width = devW; tmp.height = devH;
      fitKey = key;
    }
    const Dm = rh / ppm / (2 * tanH);
    const wyFeet = -(yb - rcy) / ppm;
    // a slight downward look so the cobbled square and the houses behind show; the feet stay on the same screen line
    const ty = wyFeet * (1 - 1 / Math.cos(TILT));
    cam.position.set(0, ty + Dm * Math.sin(TILT), Dm * Math.cos(TILT)); cam.lookAt(0, ty, 0); cam.updateMatrixWorld(true);
    vil.position.set(0, wyFeet, 0);
    const U = vil.userData, tt = st.t ?? 0;
    for (const w of U.houses) { const lit = w.on && (0.5 + 0.5 * Math.sin(tt * 1.7 + w.base) > -0.6); w.m.material = lit ? U.winMat : U.winOff; }
    for (const b of U.bunt) { b.tri.rotation.z = Math.sin(tt * 1.3 + b.k * 0.7) * 0.18; }
    for (const l of U.lamps) { l.pl.intensity = l.base * (0.88 + 0.12 * Math.sin(tt * 7.1 + l.ph) * Math.sin(tt * 3.3 + l.ph * 2)); }
    stage.setShadowTarget(0, wyFeet, 0);
    const xs = [];
    for (let i = 0; i < n; i++) xs.push((x0c + sp * i - rcx) / ppm);
    for (const p of api.people) p.setVisible(false);
    const poses = [];
    const look = V(0, wyFeet + 1.55, Dm + 4);
    for (let i = 0; i < n; i++) {
      const D = api.people[i];
      const wx = xs[i];
      const waistY = wyFeet + D.pelvisY + 0.1;
      const left = i + 1 < n ? V((wx + xs[i + 1]) / 2, waistY, 0.03) : null;   // character's left hand is on the +x side
      const right = i > 0 ? V((wx + xs[i - 1]) / 2, waistY, 0.03) : null;
      const free = n === 1 ? null : i === 0 ? 'left' : i === n - 1 ? 'right' : null;
      const nb = { L: left || V(wx + 0.3, waistY, 0.03), R: right || V(wx - 0.3, waistY, 0.03) };
      D.setVisible(true);
      D.human.root.position.set(wx, 0, 0); D.human.root.quaternion.identity();
      const P = pose(D, st, i, wx, wyFeet, nb, free, V(wx, look.y, look.z));
      poses.push(P);
    }
    stage.update(0, { renderNow: false });
    for (let i = 0; i < n; i++) {
      const D = api.people[i], P = poses[i];
      D.actor.apply(P, 0);
      D.human.setFingers('L', 'relaxed'); D.human.setFingers('R', 'relaxed');
      D.human.root.updateMatrixWorld(true);
      updateCloth(D, P, st, wyFeet);
    }
    stage.render();
    // composite through a soft top / bottom / side edge so the lit set melts into the painted sky around it
    tctx.globalCompositeOperation = 'copy'; tctx.drawImage(stage.renderer.domElement, 0, 0, devW, devH);
    tctx.globalCompositeOperation = 'destination-in';
    const fy = clamp(0.2 * devH / devH, 0.1, 0.3), fb = 0.05;
    const gv = tctx.createLinearGradient(0, 0, 0, devH);
    gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(fy, 'rgba(0,0,0,1)'); gv.addColorStop(1 - fb, 'rgba(0,0,0,1)'); gv.addColorStop(1, 'rgba(0,0,0,0)');
    tctx.fillStyle = gv; tctx.fillRect(0, 0, devW, devH);
    if (rw < ctx.canvas.width / Math.max(0.01, pxu) - 4) {
      const gh = tctx.createLinearGradient(0, 0, devW, 0);
      gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(0.04, 'rgba(0,0,0,1)'); gh.addColorStop(0.96, 'rgba(0,0,0,1)'); gh.addColorStop(1, 'rgba(0,0,0,0)');
      tctx.fillStyle = gh; tctx.fillRect(0, 0, devW, devH);
    }
    ctx.drawImage(tmp, rx0, ry0, rw, rh);
    const ms = globalThis.performance.now() - t0;
    costAvg = costN ? costAvg * 0.95 + ms * 0.05 : ms; costN++;
    if (costN > 90 && costAvg > 14 && api.quality !== 'low') { api.quality = 'low'; stage.setQuality('low'); fitKey = ''; costN = 0; }
    else if (costN > 150 && costAvg > 24) api.off = true;          // too slow here: the painted chain takes over
    return true;
  };
  return api;
}

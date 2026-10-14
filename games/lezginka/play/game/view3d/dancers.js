// Real 3D dancers for Lezginka (presentation only: it READS the same pose numbers the 2D rig uses and never writes back).
//
// platform/view3d supplies the people (athlete_m / athlete_f), the stage and the skeleton; this file dresses them in Caucasus-style
// festival clothes (a long coat with braid and a fur hat for the men, a long dress with a veil for the women), poses them with two-bone IK
// (actor.js) from poseAt() numbers, and renders ALL dancers of a screen in ONE off-screen WebGL pass that the 2D scene composites with
// drawImage. Pads, rings, particles, HUD stay 2D. When WebGL2 is missing or the context is lost the 2D rig in art.js draws instead.
import { createStage, loadHuman, THREE } from '../vendor3d/index.js';
import { Actor } from './actor.js';
import { LOOKS } from '../src/art.js';

const { Vector3, Quaternion } = THREE;
const V = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const TAU = Math.PI * 2;
const D2R = Math.PI / 180;

// which athlete wears which costume (colours come from LOOKS in art.js so 2D and 3D agree)
const CAST = {
  man: { char: 'athlete_m', skin: 'tan', hair: 'black' },
  man2: { char: 'athlete_m', skin: 'brown', hair: 'black' },
  man3: { char: 'athlete_m', skin: 'light', hair: 'brown' },
  woman: { char: 'athlete_f', skin: 'light', hair: 'black' },
  woman2: { char: 'athlete_f', skin: 'tan', hair: 'brown' },
};
export const LOAD_ORDER = ['man', 'woman', 'man2', 'woman2', 'man3', 'woman', 'man2'];   // lead first, then the chorus slots in the order they join

const mat = (c, rough = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0, ...extra });

// ---- textures ---------------------------------------------------------------------------------------------------------------------------------
const texCache = new Map();
function canvasTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const cv = globalThis.document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  texCache.set(key, t); return t;
}
// coat / dress cloth: v = 0 at the waist, 1 at the hem. u wraps around (u = 0.25 is the front, facing the camera).
function clothTex(look, fem) {
  return canvasTex(`cloth|${look.coat[0]}|${look.trim}|${fem}`, 1024, 512, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, look.coat[0]); gr.addColorStop(1, look.coat[1]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 48; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.05)'; g.fillRect(i * W / 48, 0, W / 48, H); }
    g.fillStyle = look.trim;
    if (!fem) {
      // centre front seam with braid, a trimmed hem, two chest rows are on the kit top
      g.fillRect(W * 0.25 - 4, 0, 8, H);
      g.fillRect(0, H * 0.9, W, H * 0.06);
      g.globalAlpha = 0.6; g.fillRect(0, H * 0.82, W, H * 0.015); g.globalAlpha = 1;
    } else {
      g.fillRect(0, H * 0.86, W, H * 0.05);
      g.fillRect(0, H * 0.94, W, H * 0.02);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 24; i++) { g.beginPath(); g.arc((i + (r % 2) * 0.5) * W / 24 + 8, H * (0.56 + r * 0.07), 5, 0, TAU); g.fill(); }
    }
  });
}
function furTex(look) {
  return canvasTex(`fur|${look.hat}`, 256, 128, (g, W, H) => {
    g.fillStyle = look.hat; g.fillRect(0, 0, W, H);
    let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 1100; i++) { g.strokeStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.14)'; g.lineWidth = 1 + rnd() * 1.6; const x = rnd() * W, y = rnd() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y + 6 + rnd() * 8); g.stroke(); }
  });
}

// ---- dressing: rigid pieces parented to bones (they follow every rotation for free) --------------------------------------------------------
const wscale = (bone) => bone.getWorldScale(V()).x || 1;     // the rig may be scaled; geometry sizes are given in metres
function attachTube(bone, child, r0, r1, m, ext = 0, off = null) {
  const ws = wscale(bone);
  const a = bone.getWorldPosition(V()), b = child.getWorldPosition(V());
  const dir = b.clone().sub(a), len = dir.length() / ws; dir.normalize();
  const inv = bone.getWorldQuaternion(new Quaternion()).invert();
  const ld = dir.clone().applyQuaternion(inv);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1 / ws, r0 / ws, len * (1 + ext), 16, 1), m);
  mesh.quaternion.setFromUnitVectors(V(0, 1, 0), ld);
  mesh.position.copy(ld).multiplyScalar((len * (1 + ext)) / 2);
  if (off) mesh.position.add(off.clone().applyQuaternion(inv).divideScalar(ws));
  bone.add(mesh);
  return mesh;
}
function attachBall(bone, r, m, sx = 1, sy = 1, sz = 1, off = V()) {
  const ws = wscale(bone);
  const inv = bone.getWorldQuaternion(new Quaternion()).invert();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r / ws, 18, 12), m);
  mesh.scale.set(sx, sy, sz);
  mesh.position.copy(off.clone().applyQuaternion(inv)).divideScalar(ws);
  mesh.quaternion.copy(inv);
  bone.add(mesh);
  return mesh;
}
function attachWorld(bone, mesh, worldOff) {      // a mesh built in world axes (y up, metres) placed at a rest-world offset from the bone
  const ws = wscale(bone);
  const inv = bone.getWorldQuaternion(new Quaternion()).invert();
  mesh.position.copy(worldOff.clone().applyQuaternion(inv)).divideScalar(ws);
  mesh.quaternion.copy(inv);
  mesh.scale.setScalar(1 / ws);
  bone.add(mesh);
  return mesh;
}
function attachRing(bone, child, at, r, tube, m) {  // a torus around the bone axis `at` (0..1) of the way to the child
  const ws = wscale(bone);
  const a = bone.getWorldPosition(V()), b = child.getWorldPosition(V());
  const dir = b.clone().sub(a).normalize();
  const inv = bone.getWorldQuaternion(new Quaternion()).invert();
  const ld = dir.clone().applyQuaternion(inv);
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(r / ws, tube / ws, 8, 24), m);
  mesh.quaternion.setFromUnitVectors(V(0, 0, 1), ld);
  mesh.position.copy(b.clone().sub(a).multiplyScalar(at).applyQuaternion(inv)).divideScalar(ws);
  bone.add(mesh);
  return mesh;
}

// a shoe cover along the foot: centred a little ahead of the ankle, long axis along ankle -> toe (flattened to the ground), covers the trainer
function attachShoe(foot, toe, m, w = 0.062, hgt = 0.06, half = 0.165, ahead = 0.07) {
  const ws = wscale(foot);
  const a = foot.getWorldPosition(V()), b = toe.getWorldPosition(V());
  const dir = b.clone().sub(a); dir.y = 0; dir.normalize();
  const inv = foot.getWorldQuaternion(new Quaternion()).invert();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), m);
  // world-aligned ellipsoid: x side, y up, z along `dir`
  const yaw = Math.atan2(dir.x, dir.z);
  const qw = new Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
  mesh.scale.set(w / ws, hgt / ws, half / ws);
  mesh.quaternion.copy(inv.clone().multiply(qw));
  const off = dir.clone().multiplyScalar(ahead); off.y = -0.05;
  mesh.position.copy(off.applyQuaternion(inv)).divideScalar(ws);
  foot.add(mesh);
  return mesh;
}

const SEG = 40, RING = 12;
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

async function makePerson(stage, key, base) {
  const look = LOOKS[key], cast = CAST[key], fem = look.female;
  const h = await loadHuman({ character: cast.char, base, kit: { top: look.coat[0], bottoms: look.trouser, socks: look.boot }, skin: cast.skin, hair: cast.hair });
  h.groundClamp = 'off'; h.footPlanting = false;
  h.play('idle', { fade: 0 });
  const B = (n) => h.bones[`Bip01_${n}`];
  h.root.updateMatrixWorld(true);
  const actor = new Actor(h);
  const D = { human: h, actor, key, look, fem, parts: [] };
  // measurements at the rest pose (root at the origin)
  const wp = (n) => B(n).getWorldPosition(V());
  D.pelvisY = wp('Pelvis').y;
  D.sh = { L: wp('L_UpperArm').sub(wp('Pelvis')), R: wp('R_UpperArm').sub(wp('Pelvis')) };
  D.armU = wp('L_UpperArm').distanceTo(wp('L_Forearm'));
  D.armF = wp('L_Forearm').distanceTo(wp('L_Hand'));
  D.hip = { L: wp('L_Thigh').sub(wp('Pelvis')), R: wp('R_Thigh').sub(wp('Pelvis')) };
  D.stand = D.pelvisY - 0.03;
  D.height = fem ? 1.74 : 1.8;

  const cloth = mat('#ffffff', 0.78, { map: clothTex(look, fem), side: THREE.DoubleSide });
  const sleeve = mat(look.coat[0], 0.74);
  const trim = mat(look.trim, 0.35, { metalness: 0.35 });
  const dark = mat(fem ? look.trouser : look.trouser, 0.8);
  const bootM = mat(look.boot, 0.45);
  const skinSleeve = sleeve;

  for (const s of ['L', 'R']) {
    // sleeves (rigid tubes between the arm bones, a round shoulder cap and an elbow ball so bends stay closed)
    const up = B(`${s}_UpperArm`), fo = B(`${s}_Forearm`), hd = B(`${s}_Hand`);
    attachBall(up, fem ? 0.056 : 0.098, sleeve);
    attachTube(up, fo, fem ? 0.054 : 0.088, fem ? 0.047 : 0.074, sleeve, 0.07);
    attachBall(fo, fem ? 0.047 : 0.073, sleeve);
    const fore = attachTube(fo, hd, fem ? 0.047 : 0.062, fem ? 0.07 : 0.055, skinSleeve, -0.1);
    attachRing(fo, hd, 0.86, fem ? 0.066 : 0.052, 0.011, trim);
    if (fem) attachRing(fo, hd, 0.7, 0.062, 0.008, trim);
    D.parts.push(fore);
    // legs: trousers to the knee, a tall boot below
    const th = B(`${s}_Thigh`), ca = B(`${s}_Calf`), ft = B(`${s}_Foot`);
    if (!fem) {
      attachTube(th, ca, 0.125, 0.085, dark, 0.02);
      attachBall(ca, 0.08, dark);
      attachTube(ca, ft, 0.075, 0.056, bootM, 0.0);
      // the boot foot: a dark rounded shoe slightly larger than the trainer inside
      attachShoe(ft, B(`${s}_Toe0`), bootM);
    } else {
      attachShoe(ft, B(`${s}_Toe0`), bootM, 0.055, 0.05, 0.15, 0.06);
    }
  }
  if (!fem) {
    // collar and belt
    attachRing(B('Spine2'), B('Neck'), 0.95, 0.075, 0.016, trim);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.024, 8, 32), mat('#1a0f12', 0.5));
    belt.scale.set(1, 0.8, 1); belt.rotation.x = Math.PI / 2;
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.05, 0.02), trim); buckle.position.set(0, 0, -0.125); buckle.rotation.x = 0;
    const bg = new THREE.Group(); bg.add(belt);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.05, 0.022), trim); bl.position.set(0, 0.0, 0.0);
    D.belt = { belt, buckle: bl, group: bg };
    // fur hat (papakha)
    const hat = new THREE.Group();
    const fur = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.104, 0.17, 24), mat('#ffffff', 1.0, { map: furTex(look) }));
    const topCap = new THREE.Mesh(new THREE.CircleGeometry(0.114, 24), mat(look.hatTop, 0.7)); topCap.rotation.x = -Math.PI / 2; topCap.position.y = 0.086;
    const topRing = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.006, 6, 24), trim); topRing.rotation.x = Math.PI / 2; topRing.position.y = 0.085;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.02, 8, 24), mat('#ffffff', 1.0, { map: furTex(look) })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.075;
    const rimB = rim.clone(); rimB.position.y = -0.075; rimB.scale.set(0.98, 0.98, 1);
    hat.add(fur, topCap, topRing);
    attachWorld(B('Head'), hat, V(0, 0.185, -0.015));
  } else {
    // small embroidered cap and a plait
    const cap = new THREE.Group();
    const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.118, 20, 14, 0, TAU, 0, Math.PI * 0.55), mat(look.hatTop, 0.6));
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.114, 0.011, 8, 24), trim); band.rotation.x = Math.PI / 2; band.position.y = 0.012;
    cap.add(c1, band);
    attachWorld(B('Head'), cap, V(0, 0.115, -0.02));
  }

  // dynamic cloth (rebuilt every frame from the live bone positions)
  D.skirtGeo = lathe();
  D.skirt = new THREE.Mesh(D.skirtGeo, cloth); D.skirt.frustumCulled = false;
  stage.add(D.skirt);
  if (fem) {
    const VW = 8, VH = 10;
    const g = new THREE.BufferGeometry(), pos = new Float32Array((VW + 1) * (VH + 1) * 3), idx = [];
    for (let j = 0; j < VH; j++) for (let i = 0; i < VW; i++) { const a = j * (VW + 1) + i, b = a + 1, c = a + VW + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    D.veilGeo = g; D.VW = VW; D.VH = VH;
    D.veil = new THREE.Mesh(g, mat(look.hat, 0.6, { side: THREE.DoubleSide, transparent: true, opacity: 0.82 }));
    D.veil.frustumCulled = false; stage.add(D.veil);
    // wrist ribbons
    D.rib = {};
    for (const s of ['L', 'R']) {
      const rg = new THREE.BufferGeometry(), rp = new Float32Array(2 * 8 * 3), ri = [];
      for (let j = 0; j < 7; j++) { const a = j * 2, b = a + 1, c = a + 2, d = a + 3; ri.push(a, c, b, b, c, d); }
      rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); rg.setIndex(ri);
      const m = new THREE.Mesh(rg, mat(look.hatTop, 0.5, { side: THREE.DoubleSide })); m.frustumCulled = false; stage.add(m);
      D.rib[s] = { geo: rg, mesh: m };
    }
    // plait
    D.plait = new THREE.Mesh(new THREE.BufferGeometry(), mat('#1a0e0c', 0.5)); D.plait.frustumCulled = false; stage.add(D.plait);
  } else {
    stage.add(D.belt.group); stage.add(D.belt.buckle);
  }
  stage.add(h); stage.track(h);
  D.setVisible = (v) => {
    h.root.visible = v; D.skirt.visible = v;
    if (D.veil) { D.veil.visible = v; D.plait.visible = v; D.rib.L.mesh.visible = v; D.rib.R.mesh.visible = v; }
    if (D.belt) { D.belt.group.visible = v; D.belt.buckle.visible = v; }
  };
  D.setVisible(false);
  return D;
}

// ---- the pose --------------------------------------------------------------------------------------------------------------------------------
const SPIN_SIDE = [0, 0];
// poseAt() numbers -> an actor pose. `P` is the 2D rig's pose (screen-left = character's right), `o.t` display time, `o.ph` per-dancer phase.
function dancerPose(D, P, o, wy) {
  const A = D.actor, fem = D.fem;
  const sq = clamp(P.squash, 0, 1.2);
  const t = o.t, ph = o.ph || 0;
  const breath = Math.sin(t * 1.9 + ph * 1.7);
  const calm = fem ? 0.3 : 1;
  const lift = { R: P.liftL * calm, L: P.liftR * calm };       // 2D 'L' pad = the dancer's right leg (seen from the front it is on the viewer's left)
  const liftMax = Math.max(lift.L, lift.R);
  const stand = D.stand - 0.07 * sq - 0.012 * (1 + breath) * 0.5;
  const dyM = P.dy * D.height * 0.9;
  const pel = V(0.012 * Math.sin(t * 2.4 + ph) + (lift.L - lift.R) * -0.03, wy + stand + dyM, 0);
  const yaw = clamp(P.spin, 0, TAU * 1.05) * 1.0 + 0.0;
  // legs: targets in the ground frame under the pelvis (yaw only)
  const legs = {}, tip = P.tip;
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1, l = lift[s];
    const x = sx * (0.115 - 0.055 * l + 0.02 * (s === 'L' ? P.hipR : P.hipL) * 0 + (fem ? 0.0 : 0.012));
    const y = A.groundAnkle + 0.035 * tip + 0.36 * l;
    const z = 0.02 + 0.20 * l - 0.015 * (1 - l);
    const nStand = [0, -0.93, -0.36 * tip], fStand = [0, 0.36 * tip, 0.93];
    const nUp = [0, -0.55, -0.83], fUp = [0, -0.7, 0.7];
    const n = [lerp(nStand[0], nUp[0], l), lerp(nStand[1], nUp[1], l), lerp(nStand[2], nUp[2], l)];
    const f = [lerp(fStand[0], fUp[0], l), lerp(fStand[1], fUp[1], l), lerp(fStand[2], fUp[2], l)];
    legs[s] = { p: [x, y, z], f: 'g', w: 1, pole: [sx * (0.1 + 0.15 * l), 0.15 + 0.4 * l, 1], pf: 'g', aim: { n, face: 'sole', fwd: f, w: 1 } };
  }
  // arms: shoulder angle a1 (0 = hanging, PI/2 = straight out, ~2.5 = up) and elbow bend a2, in the frontal plane, as the 2D rig does
  const arms = {};
  const U = D.armU, F = D.armF;
  const aLook = { R: [P.a1L, P.a2L], L: [P.a1R, P.a2R] };
  let armUp = 0;
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1, [a1, a2] = aLook[s];
    const S = D.sh[s];
    const ex = sx * U * Math.sin(a1), ey = -U * Math.cos(a1);
    const hx = ex + sx * F * Math.sin(a1 + a2), hy = ey - F * Math.cos(a1 + a2);
    const zf = 0.06 + 0.08 * Math.max(0, Math.cos(a1)) ;                 // hands hang a little in front of the coat, not through it
    const hand = [S.x + hx, S.y + hy, zf + 0.02];
    const ex3 = [S.x + ex, S.y + ey, S.z - 0.1];
    const mid = [(S.x + hand[0]) / 2, (S.y + hand[1]) / 2, (S.z + hand[2]) / 2];
    let pole = [ex3[0] - mid[0], ex3[1] - mid[1], ex3[2] - mid[2]];
    const pl = Math.hypot(pole[0], pole[1], pole[2]);
    if (pl < 0.03) pole = [sx * 0.3, -1, -0.35]; else pole = pole.map((v) => v / pl);
    arms[s] = { p: hand, f: 'b', w: 1, pole, pf: 'b' };
    armUp = Math.max(armUp, a1 > 1.9 ? 1 : 0);
  }
  const bend = 2 + 7 * sq + 1.2 * breath - 6 * clamp((P.a1L + P.a1R) / 2 - 1.2, 0, 1.5);
  const side = (P.lean * 57.3) * 1.0;
  const twist = (lift.R - lift.L) * 7 + 2 * Math.sin(t * 0.9 + ph);
  const head = V(0, 0, 0);
  return {
    pelvis: pel, yaw: yaw + (o.yaw || 0), pitch: 0, roll: 0, groundY: wy,
    torso: { bend, side, twist },
    pelvisTilt: { bend: 0, side: (lift.L - lift.R) * 3, twist: 0 },
    legs, arms,
    look: { target: o.lookAt, w: 0.7 },
    headAdd: { pitch: P.head * 40, yaw: 0 },
    out: { liftMax, armUp },
  };
}

// ---- the cloth --------------------------------------------------------------------------------------------------------------------------------
function updateSkirt(D, pose, P, t, wy) {
  const h = D.human, B = (n) => h.bones[`Bip01_${n}`];
  const fem = D.fem, pos = D.skirtGeo.attributes.position;
  h.root.updateMatrixWorld(true);
  const pel = B('Pelvis').getWorldPosition(V()), sp = B('Spine').getWorldPosition(V());
  const waistY = lerp(pel.y, sp.y, 0.55) + 0.045, waistX = lerp(pel.x, sp.x, 0.55), waistZ = lerp(pel.z, sp.z, 0.55);
  const hemY = fem ? wy + 0.035 : wy + 0.36 + (pel.y - (wy + D.stand)) * 0.5;
  const spinK = P.flare;
  const r0x = fem ? 0.165 : 0.17, r0z = fem ? 0.14 : 0.16;
  const r1x = (fem ? 0.34 : 0.28) * (1 + 0.5 * spinK), r1z = (fem ? 0.3 : 0.27) * (1 + 0.5 * spinK);
  // leg samples (body space, relative to the pelvis): the cloth is pushed out around them, so a lifted knee tents the coat
  const yawC = Math.cos(pose.yaw), yawS = Math.sin(pose.yaw);
  const inBody = (v) => { const dx = v.x - pel.x, dz = v.z - pel.z; return { x: dx * yawC - dz * yawS, y: v.y, z: dx * yawS + dz * yawC }; };
  const legPts = [];
  const knees = [];
  for (const s of ['L', 'R']) {
    const th = inBody(B(`${s}_Thigh`).getWorldPosition(V())), kn = inBody(B(`${s}_Calf`).getWorldPosition(V())), an = inBody(B(`${s}_Foot`).getWorldPosition(V()));
    knees.push({ ...kn, up: Math.max(0, kn.y - (wy + 0.5)) });
    for (const u of [0.35, 0.7, 1]) legPts.push({ x: lerp(th.x, kn.x, u), y: lerp(th.y, kn.y, u), z: lerp(th.z, kn.z, u), r: lerp(0.1, 0.085, u) });
    for (const u of [0.3, 0.65]) legPts.push({ x: lerp(kn.x, an.x, u), y: lerp(kn.y, an.y, u), z: lerp(kn.z, an.z, u), r: lerp(0.08, 0.065, u) });
  }
  for (let j = 0; j <= RING; j++) {
    const s = j / RING;
    const y0 = waistY + (hemY - waistY) * s;
    const flareS = Math.pow(s, fem ? 1.6 : 1.9);
    const hk = Math.min(1, s * 2.6), hipK = hk * hk * (3 - 2 * hk);
    const rx = r0x + 0.075 * hipK + (r1x - r0x - 0.075) * flareS, rz = r0z + 0.07 * hipK + (r1z - r0z - 0.07) * flareS;
    const cx = lerp(waistX, pel.x, s), cz = lerp(waistZ, pel.z, s) + 0.035 * Math.min(1, s * 3);
    for (let i = 0; i <= SEG; i++) {
      // vertex angle in body space; the body is turned by the yaw, so the knees are looked up in the same turned frame
      const a = (i / SEG) * TAU;
      const wave = 1 + s * (0.03 + 0.05 * spinK) * Math.sin(a * 5 + t * 5 + P.impact) + s * 0.015 * Math.cos(a * 9 - t * 3);
      let lx = Math.cos(a) * rx * wave, lz = Math.sin(a) * rz * wave;
      let y = y0;
      if (s > 0.12) {
        for (const k of knees) {
          if (k.up <= 0.01 || fem) continue;
          const d = Math.hypot(lx - k.x, lz - k.z);
          y += k.up * 0.7 * Math.exp(-(d * d) / 0.05) * s;      // the hem rides up over a lifted knee
        }
        for (const p of legPts) {
          if (Math.abs(y - p.y) > 0.11) continue;
          const dx = lx - p.x, dz = lz - p.z, d = Math.hypot(dx, dz), need = p.r + 0.035;
          if (d < need) { const k = d > 1e-4 ? need / d : 0; if (k) { lx = p.x + dx * k; lz = p.z + dz * k; } else lz = p.z + need; }
        }
      }
      const wx = cx + lx * yawC + lz * yawS, wz = cz - lx * yawS + lz * yawC;
      pos.setXYZ(j * (SEG + 1) + i, wx, y, wz);
    }
  }
  pos.needsUpdate = true; D.skirtGeo.computeVertexNormals();
  if (D.belt) {
    D.belt.group.position.set(waistX, waistY - 0.03, waistZ + 0.035);
    D.belt.group.rotation.set(0, pose.yaw, 0);
    D.belt.group.scale.set(1, 1, 1.12);
    D.belt.buckle.position.set(waistX + Math.sin(pose.yaw) * 0.17, waistY - 0.03, waistZ + 0.035 + Math.cos(pose.yaw) * 0.2);
    D.belt.buckle.rotation.set(0, pose.yaw, 0);
  }
}

function updateFem(D, pose, P, t) {
  const h = D.human, B = (n) => h.bones[`Bip01_${n}`];
  const head = B('Head').getWorldPosition(V()), neck = B('Neck').getWorldPosition(V()), sp = B('Spine1').getWorldPosition(V());
  const sway = clamp(P.lean * 2.2, -0.3, 0.3), spin = clamp(P.flare, 0, 1);
  // veil: from the crown, over the shoulders, down the back
  const vp = D.veilGeo.attributes.position, VW = D.VW, VH = D.VH;
  const yc = Math.cos(pose.yaw), ys = Math.sin(pose.yaw);
  for (let j = 0; j <= VH; j++) {
    const s = j / VH;
    const y = head.y + 0.1 - s * (head.y + 0.1 - (sp.y - 0.26));
    const w = (0.11 + 0.12 * Math.min(1, s * 1.5) + 0.09 * spin * s) * (1 + 0.05 * Math.sin(t * 2.3 + s * 5));
    const zb = -0.1 - 0.1 * Math.sin(Math.min(1, s * 1.3) * Math.PI * 0.5) - 0.05 * s - 0.2 * spin * s;
    const cx = head.x + (neck.x - head.x) * s - sway * 0.4 * s;
    for (let i = 0; i <= VW; i++) {
      const u = i / VW * 2 - 1;
      const lx = u * w, lz = zb + 0.025 * Math.sin(t * 2.6 + i * 0.8 + s * 4) * s;
      vp.setXYZ(j * (VW + 1) + i, cx + lx * yc + lz * ys, y + 0.02 * Math.sin(t * 3 + i * 0.9) * s, head.z + (-lx * ys + lz * yc));
    }
  }
  vp.needsUpdate = true; D.veilGeo.computeVertexNormals();
  // wrist ribbons trail behind each hand
  for (const s of ['L', 'R']) {
    const hand = B(`${s}_Hand`).getWorldPosition(V()), fore = B(`${s}_Forearm`).getWorldPosition(V());
    const dir = hand.clone().sub(fore).normalize();
    const rp = D.rib[s].geo.attributes.position;
    for (let j = 0; j < 8; j++) {
      const q = j / 7, wob = Math.sin(t * 5 + j * 0.9 + (s === 'L' ? 0 : 2)) * 0.05 * q;
      const cx = hand.x + dir.x * 0.05 * q + (s === 'L' ? 1 : -1) * 0.06 * q + wob, cy = hand.y - 0.2 * q * q - 0.04 * q + wob * 0.6, cz = hand.z - 0.1 * q - 0.04 * q;
      rp.setXYZ(j * 2, cx, cy, cz); rp.setXYZ(j * 2 + 1, cx + 0.03 * (1 - q * 0.4), cy + 0.012, cz + 0.01);
    }
    rp.needsUpdate = true; D.rib[s].geo.computeVertexNormals();
  }
  // plait
  const bs = sway + 0.04 * Math.sin(t * 3);
  const pts = [V(head.x, head.y - 0.02, head.z - 0.1), V(neck.x - bs * 0.1, neck.y - 0.04, neck.z - 0.12), V(neck.x - bs * 0.3, neck.y - 0.22, neck.z - 0.14), V(neck.x - bs * 0.7, neck.y - 0.42, neck.z - 0.15), V(neck.x - bs, neck.y - 0.6, neck.z - 0.14)];
  D.plait.geometry.dispose();
  D.plait.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.028, 8, false);
}

// ---- the renderer ----------------------------------------------------------------------------------------------------------------------------
export async function createDancers({ quality = 'medium', base } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: true, shadows: false, lighting: 'evening', fov: 10 });
  if (!stage.supported) return null;
  stage.setSky(null, null);
  const cam = stage.camera;
  const api = { stage, ok: true, lost: false, quality, people: [], ready: 0, maxPeople: 7, err: null };
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { api.lost = false; fitKey = ''; });
  // load the lead first (the screen is playable after this), the chorus in the background
  api.people.push(await makePerson(stage, LOAD_ORDER[0], base));
  api.ready = 1;
  // the chorus loads in parallel in the background; a screen only uses 3D when ALL of its people are ready (never a mix of 3D and flat)
  api.all = Promise.all(LOAD_ORDER.slice(1).map((k) => makePerson(stage, k, base).catch((e) => { api.err = String(e); return null; })))
    .then((list) => { for (const p of list) if (p) api.people.push(p); api.ready = api.people.length; return api; });
  let fitKey = '', lastT = null, costAvg = 0, costN = 0;
  const fov = 10, tanH = Math.tan((fov / 2) * D2R);

  /**
   * entries: [{ x, footY, H, k, look, P, ph, yaw }], drawn in ONE pass. x / footY / H are 2D units (the lead's H is its pixel height).
   * k = size relative to the lead (a smaller chorus dancer stands farther back). Returns the Set of entries drawn by 3D (null = use 2D for all).
   */
  api.draw = function (ctx, entries, t, calm) {
    if (api.lost || stage.contextLost || !api.ready) return null;
    const t0 = globalThis.performance.now();
    const list = [];
    const used = new Set();
    for (const e of entries) {
      // a person of the right costume that is not in use yet
      const D = api.people.find((p) => p.key === e.look && !used.has(p));
      if (!D) return null;                   // somebody is still loading: the whole screen stays 2D (no mixed look)
      used.add(D); list.push({ e, D });
    }
    if (!list.length) return null;
    const lead = entries[0];
    const ppm = lead.H / 1.9;                              // 2D units per metre (the 2D person is ~0.95 H tall incl. the hat)
    // the off-screen rectangle that holds every dancer
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const { e } of list) {
      x0 = Math.min(x0, e.x - e.H * 0.62); x1 = Math.max(x1, e.x + e.H * 0.62);
      y0 = Math.min(y0, e.footY - e.H * 1.12); y1 = Math.max(y1, e.footY + e.H * 0.06);
    }
    const rw = x1 - x0, rh = y1 - y0, rcx = (x0 + x1) / 2, rcy = (y0 + y1) / 2;
    const m = ctx.getTransform(), pxu = Math.hypot(m.a, m.b);
    const cap = api.quality === 'low' ? 900 : 1500;
    const devW = clamp(Math.round(rw * pxu), 200, cap), devH = Math.max(100, Math.round(devW * rh / rw));
    const key = `${devW}x${devH}|${rw.toFixed(1)}|${rh.toFixed(1)}`;
    if (key !== fitKey) {
      const r = stage.renderer; r.setPixelRatio(1); r.setSize(devW, devH, false);
      cam.aspect = devW / devH; cam.fov = fov; cam.near = 1; cam.far = 200; cam.updateProjectionMatrix();
      fitKey = key;
    }
    // camera distance so that the lead (k = 1) has exactly `ppm` units per metre
    const Dm = (rh / ppm) / (2 * tanH);
    cam.position.set(0, 0, Dm); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
    const dt = lastT === null ? 0 : clamp(t - lastT, 0, 0.1); lastT = t;
    for (const p of api.people) p.setVisible(false);
    for (const { e, D } of list) {
      const k = clamp(e.k || 1, 0.3, 1.2);
      const dist = Dm / k, hh = tanH * dist, asp = devW / devH;
      const wx = ((e.x - rcx) / (rw / 2)) * hh * asp, wy = (-(e.footY - rcy) / (rh / 2)) * hh, wz = Dm - dist;
      D.setVisible(true);
      const h = D.human;
      h.root.position.set(wx, 0, wz); h.root.quaternion.identity();
      const look = V(wx, wy + 1.55, Dm + 4);
      const pose = dancerPose(D, e.P, { t, ph: e.ph, lookAt: look, yaw: 0 }, wy);
      // the actor places the pelvis in WORLD space; shift the target to this dancer's (x, z)
      pose.pelvis.x += wx; pose.pelvis.z += wz;
      D.last = pose;
    }
    stage.update(dt, { renderNow: false });             // advances the base idle clip (one render below, after the IK)
    for (const { e, D } of list) {
      const pose = D.last, h = D.human, up = e.P.a1L > 1.9 || e.P.a1R > 1.9;
      D.actor.apply(pose, dt);
      h.setFingers('L', up ? 'flat' : 'relaxed'); h.setFingers('R', up ? 'flat' : 'relaxed');
      h.root.updateMatrixWorld(true);
      updateSkirt(D, pose, e.P, t, pose.groundY);
      if (D.fem) updateFem(D, pose, e.P, t);
    }
    stage.render();
    ctx.drawImage(stage.renderer.domElement, x0, y0, rw, rh);
    const ms = globalThis.performance.now() - t0;
    costAvg = costN ? costAvg * 0.95 + ms * 0.05 : ms; costN++;
    if (costN > 90 && costAvg > 14 && api.quality !== 'low') { api.quality = 'low'; stage.setQuality('low'); fitKey = ''; }
    if (costN > 240 && costAvg > 22 && api.maxPeople > 3) { api.maxPeople = 3; }
    return new Set(list.map((l) => l.e));
  };
  return api;
}

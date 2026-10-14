// One mounted player: a real 3D man (view3d athlete_m) seated on the 3D horse (horse.js), dressed as a steppe rider: felt hat, belted coat
// with sleeves, dark trousers, riding boots. The pose is authored procedurally on the skeleton from the sim's presentation state (lean,
// action, charge, throw progress, carry): seat on the saddle, feet in the stirrups (IK), left hand on the reins, right hand does the work.
import { loadHuman, Clip, CLIP_BONES, semanticRot, THREE } from '../vendor3d/index.js';
import { createHorse } from './horse.js';

const { Vector3, Quaternion, Euler, Group, Mesh, MeshStandardMaterial, CylinderGeometry, SphereGeometry, TorusGeometry, BoxGeometry, Matrix4, CanvasTexture, SRGBColorSpace, LinearMipmapLinearFilter, NoColorSpace, DoubleSide } = THREE;
const D2R = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const bi = (n) => CLIP_BONES.indexOf(`Bip01_${n}`);

// seat geometry (horse space, metres)
const SEAT = { y: 1.5, z: 0.1 };            // top of the saddle under the rider
const STIRRUP = { x: 0.3, y: 0.95, z: 0.13 };
const REIN_HAND = { x: 0.07, y: 1.62, z: 0.58 };

// ---------------------------------------------------------------------------------------------------------------------------------
// Clothes as tapered tubes riding on the bones (they follow every pose and never show skin or trainers): sleeves with trim cuffs, trousers,
// riding boots. The shirt texture itself is only tinted by the kit colour (it is the coat body).
const Yax = new Vector3(0, 1, 0);
function tubeOn(bone, child, rParent, rChild, mat, { overlap = 0, from = 0, to = 1 } = {}) {
  const dir = child.position.clone(); const len = dir.length(); dir.normalize();
  const L = len * (to - from) + overlap;
  const geo = new CylinderGeometry(rChild, rParent, L, 18, 1, true);
  const mesh = new Mesh(geo, mat);
  mesh.quaternion.setFromUnitVectors(Yax, dir);
  mesh.position.copy(dir).multiplyScalar(len * (from + to) / 2);
  bone.add(mesh);
  return mesh;
}
export function dressLimbs(human, { sleeve, trim, trousers, boot, legs = true }) {
  const m = (c, r = 0.85) => { const x = new MeshStandardMaterial({ color: c, roughness: r }); x.side = DoubleSide; return x; };
  const sleeveM = m(sleeve), trimM = m(trim, 0.7), trouserM = m(trousers), bootM = m(boot, 0.5);
  human.userData = human.userData || {}; human.userData.sleeveM = sleeveM; human.userData.trimM = trimM;
  const parts = [];
  for (const s of ['L', 'R']) {
    const b = (n) => human.bones[`Bip01_${s}_${n}`];
    const up = b('UpperArm'), fo = b('Forearm'), ha = b('Hand'), th = b('Thigh'), ca = b('Calf'), ft = b('Foot'), to = b('Toe0');
    if (!up || !fo || !ha || !th || !ca || !ft) continue;
    tubeOn(up, fo, 0.066, 0.05, sleeveM, { overlap: 0.03, from: -0.07 });
    tubeOn(fo, ha, 0.05, 0.04, sleeveM, { overlap: 0.0 });
    const cuff = new Mesh(new CylinderGeometry(0.043, 0.043, 0.035, 14, 1, true), trimM); cuff.material.side = DoubleSide;
    cuff.quaternion.setFromUnitVectors(Yax, ha.position.clone().normalize()); cuff.position.copy(ha.position).multiplyScalar(-0.02);
    fo.add(cuff);
    const cap = new Mesh(new SphereGeometry(0.074, 16, 12), sleeveM); cap.position.set(0, 0.012, 0); up.add(cap);
    if (!legs) { parts.push(up); continue; }
    tubeOn(th, ca, 0.104, 0.078, trouserM, { overlap: 0.0 });
    tubeOn(ca, ft, 0.074, 0.056, trouserM, { overlap: 0.0, from: 0, to: 0.5 });
    const knee = new Mesh(new SphereGeometry(0.079, 14, 10), trouserM); ca.add(knee);
    // boots: the shaft up to the knee, then the foot
    tubeOn(ca, ft, 0.07, 0.058, bootM, { overlap: 0.0, from: 0.3, to: 1.0 });
    const cuffB = new Mesh(new CylinderGeometry(0.076, 0.072, 0.04, 16, 1, true), bootM); cuffB.quaternion.setFromUnitVectors(Yax, ft.position.clone().normalize()); cuffB.position.copy(ft.position).multiplyScalar(0.3);
    ca.add(cuffB);
    if (to) {
      const foot = new Mesh(new SphereGeometry(0.058, 14, 10), bootM); foot.scale.set(1, 1, 1);
      ft.add(foot);
      tubeOn(ft, to, 0.055, 0.045, bootM, { overlap: 0.07 });
      const toe = new Mesh(new SphereGeometry(0.046, 12, 8), bootM); toe.position.copy(to.position).multiplyScalar(1.15); ft.add(toe);
    }
    parts.push(up);
  }
  return parts;
}

// the tall white felt hat with a black band and a turned-up brim
export function headFrame(human) {
  const f = human.boneFrame('Head');
  const m = new Matrix4().makeBasis(f.left.clone().normalize(), f.up.clone().normalize(), f.fwd.clone().normalize());
  const q = new Quaternion().setFromRotationMatrix(m);
  const box = human.headBox;
  const c = box ? box.getCenter(new Vector3()) : new Vector3(0.07, 0, 0);
  const upExt = box ? Math.max(box.max.dot(f.up), box.min.dot(f.up)) : 0.2;
  const topPt = c.clone().addScaledVector(f.up, upExt - c.dot(f.up));
  return { q, f, topPt };
}
function addKalpak(human, trimHex) {
  const { q, f, topPt } = headFrame(human);
  const g = new Group();
  g.quaternion.copy(q);
  g.position.copy(topPt).addScaledVector(f.up, -0.04);
  const felt = new MeshStandardMaterial({ color: 0xf4efe2, roughness: 0.95 });
  const black = new MeshStandardMaterial({ color: 0x14161c, roughness: 0.8 });
  const crown = new Mesh(new CylinderGeometry(0.083, 0.108, 0.17, 20, 1, true), felt); crown.position.y = 0.1; crown.material.side = DoubleSide;
  const dome = new Mesh(new SphereGeometry(0.083, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), felt); dome.position.y = 0.185; dome.scale.y = 0.8;
  const brim = new Mesh(new CylinderGeometry(0.118, 0.108, 0.07, 22, 1, true), black); brim.position.y = 0.0; brim.material = black.clone(); brim.material.side = DoubleSide;
  const top = new Mesh(new TorusGeometry(0.113, 0.011, 8, 24), black); top.rotation.x = Math.PI / 2; top.position.y = 0.035;
  const knob = new Mesh(new SphereGeometry(0.012, 8, 6), new MeshStandardMaterial({ color: trimHex, roughness: 0.6 })); knob.position.y = 0.25;
  g.add(crown, dome, brim, top, knob);
  g.userData.knobM = knob.material;
  human.bones.Bip01_Head.add(g);
  return g;
}
// coat skirt hanging from the waist, a belt in the trim colour
function addCoat(human, coatHex, trimHex) {
  human.root.updateMatrixWorld(true);
  const rq = human.bones.Bip01_Pelvis.getWorldQuaternion(new Quaternion()).invert();
  const f = { up: new Vector3(0, 1, 0).applyQuaternion(rq), fwd: new Vector3(0, 0, 1).applyQuaternion(rq), left: new Vector3(1, 0, 0).applyQuaternion(rq) };
  const m = new Matrix4().makeBasis(f.left.clone().normalize(), f.up.clone().normalize(), f.fwd.clone().normalize());
  const q = new Quaternion().setFromRotationMatrix(m);
  const g = new Group(); g.quaternion.copy(q);
  const coat = new MeshStandardMaterial({ color: coatHex, roughness: 0.85, side: DoubleSide });
  const skirt = new Mesh(new CylinderGeometry(0.168, 0.22, 0.26, 22, 1, true), coat); skirt.position.set(0, -0.08, 0); skirt.scale.set(1, 1, 0.82); skirt.scale.set(1.0, 1, 1.0);
  const trimM = new MeshStandardMaterial({ color: trimHex, roughness: 0.7 });
  const hem = new Mesh(new TorusGeometry(0.22, 0.011, 6, 28), trimM); hem.rotation.x = Math.PI / 2; hem.position.set(0, -0.21, 0); hem.scale.set(1, 0.82, 1);
  const belt = new Mesh(new TorusGeometry(0.168, 0.02, 8, 26), trimM); belt.rotation.x = Math.PI / 2; belt.position.set(0, 0.06, 0.0); belt.scale.set(1, 0.78, 1);
  g.add(skirt, hem, belt);
  g.userData.coatM = coat; g.userData.trimM = trimM;
  human.bones.Bip01_Pelvis.add(g);
  return g;
}

function ballTexture() {
  const c = globalThis.document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#b97f4b'); gr.addColorStop(0.5, '#9a6234'); gr.addColorStop(1, '#6e4222');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = 'rgba(35,18,8,0.8)'; g.lineWidth = 3;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(i * 64 + 8, 0); g.lineTo(i * 64 + 8, 128); g.stroke(); }
  g.beginPath(); g.moveTo(0, 64); g.lineTo(256, 64); g.stroke();
  g.strokeStyle = 'rgba(240,215,170,0.5)'; g.setLineDash([4, 5]);
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(i * 64 + 13, 0); g.lineTo(i * 64 + 13, 128); g.stroke(); }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}
let ballTex = null;

// ---------------------------------------------------------------------------------------------------------------------------------
const SKINS = ['#d9a47c', '#c98f66', '#e2b28c', '#b87f58'];
const HAIRS = ['black', 'black', 'brown', 'black'];
export async function createRider({ base, trim, horse: horseHex, kit, blanket, mane, variant = 0 }) {
  const human = await loadHuman({ character: 'athlete_m', base, kit: { top: kit, bottoms: '#2a2f45', socks: '#2a1c14' }, skin: SKINS[variant % 4], hair: HAIRS[variant % 4] });
  // bare the feet: the riding boots (dressLimbs) replace the trainers, so drop every triangle that sits on the foot / toe bones
  human.root.traverse((o) => {
    if (!o.isSkinnedMesh || o.geometry.userData.barefoot) return;
    const geo = o.geometry, ix = geo.index, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    if (!ix || !si) return;
    const foot = new Set(o.skeleton.bones.map((bn, i) => (/_(Foot|Toe0)$/.test(bn.name) ? i : -1)).filter((i) => i >= 0));
    const w = new Float32Array(geo.attributes.position.count);
    for (let i = 0; i < w.length; i++) for (let k = 0; k < 4; k++) if (foot.has(si.getComponent(i, k))) w[i] += sw.getComponent(i, k);
    const a2 = ix.array;
    for (let t = 0; t < a2.length; t += 3) if (w[a2[t]] > 0.5 || w[a2[t + 1]] > 0.5 || w[a2[t + 2]] > 0.5) { a2[t + 1] = a2[t]; a2[t + 2] = a2[t]; }
    ix.needsUpdate = true; geo.userData.barefoot = true;
  });
  dressLimbs(human, { sleeve: new THREE.Color(kit).multiplyScalar(0.96).getHex(), trim: new THREE.Color(trim).getHex(), trousers: 0x2a2f45, boot: 0x2a1a10 });
  const horse = createHorse({ coat: horseHex, blanket: blanket || kit, trim, mane });
  const group = new Group();
  group.add(horse.root);
  group.add(human.root);
  human.root.position.set(0, 0, 0);
  const hat = addKalpak(human, new THREE.Color(trim).getHex());
  const skirt = addCoat(human, new THREE.Color(kit).multiplyScalar(0.92).getHex(), new THREE.Color(trim).getHex());
  const look = { key: '' };
  function setLook(l) {
    const key = [l.kit, l.trim, l.horse].join('|');
    if (key === look.key) return;
    look.key = key;
    const C = (h) => new THREE.Color(h);
    human.setKit({ top: l.kit });
    human.userData.sleeveM.color.copy(C(l.kit).multiplyScalar(0.96));
    human.userData.trimM.color.copy(C(l.trim));
    skirt.userData.coatM.color.copy(C(l.kit).multiplyScalar(0.92));
    skirt.userData.trimM.color.copy(C(l.trim));
    hat.userData.knobM.color.copy(C(l.trim));
    // markings follow the coat colour (stable per team): white socks on the lighter bays, a blaze on some
    let hs = 0; for (const ch of String(l.horse)) hs = (hs * 31 + ch.charCodeAt(0)) >>> 0;
    horse.setLook({ coat: l.horse, blanket: l.kit, trim: l.trim, mane: l.mane, socks: hs % 3 === 1 ? '#efe7d6' : null, blaze: hs % 2 === 0 });
  }
  // the ball (carried in the right hand when the sim says so)
  if (!ballTex) ballTex = ballTexture();
  const ball = new Mesh(new SphereGeometry(0.3, 20, 14), new MeshStandardMaterial({ map: ballTex, roughness: 0.75 }));
  ball.visible = false; group.add(ball);

  // pose clip rewritten every frame
  const clip = new Clip({ name: 'pose', frames: 1, dur: 1 / 30, fps: 30, loop: true, quats: new Float32Array(CLIP_BONES.length * 4), pelvis: new Float32Array(3), grounded: false, fingers: 'relaxed' });
  human.addClip(clip);
  human.groundClamp = 'off'; human.footPlanting = false;
  const restQ = new Float32Array(human.restPose.q);
  const e = new Euler(), qa = new Quaternion(), qb = new Quaternion();
  const ph0 = human.pelvisHeight;
  human.play(clip, { fade: 0 });
  human.setFingers('L', 'relaxed'); human.setFingers('R', 'relaxed');

  function writePose(offs, pel) {
    const q = clip.quats;
    q.set(restQ);
    for (const n in offs) {
      const i = bi(n); if (i < 0) continue;
      const r = semanticRot(`Bip01_${n}`, offs[n]);
      qa.set(q[i * 4], q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3]);
      qb.setFromEuler(e.set(r[0] * D2R, r[1] * D2R, r[2] * D2R, 'XYZ'));
      qa.multiply(qb);
      q[i * 4] = qa.x; q[i * 4 + 1] = qa.y; q[i * 4 + 2] = qa.z; q[i * 4 + 3] = qa.w;
    }
    clip.pelvis[0] = pel[0] / ph0; clip.pelvis[1] = pel[1] / ph0; clip.pelvis[2] = pel[2] / ph0;
  }

  const w = new Vector3(), w2 = new Vector3(), tmp = new Vector3();
  const toWorld = (x, y, z) => { w.set(x, y, z); return group.localToWorld(w); };

  /**
   * s: { ph, spd, t, f (facing -1..1), lean, kind, reachX, tugKick, throwP, charge, carry, stun, cheer, dt }
   */
  let prevF = null;
  function pose(s) {
    const dt = s.dt ?? 1 / 60;
    // the camera always sees the near (camera-side) flank. Facing right that is the man's RIGHT side, facing left (the model turned by
    // 180 degrees) it is his LEFT: `mir` mirrors the whole action to the near side, so the working arm is always the one in view.
    const mir = s.f >= 0 ? 1 : -1;
    const actSide = mir > 0 ? 'R' : 'L', reinSide = mir > 0 ? 'L' : 'R';
    group.rotation.y = (Math.PI / 2) * (1 - s.f);
    group.updateMatrixWorld(true);
    const turn = prevF === null ? 0 : (s.f - prevF) / Math.max(dt, 1e-3); prevF = s.f;
    const h = horse.pose({ ph: s.ph, spd: s.spd, t: s.t, stun: s.stun, dt: s.dt, turn });
    const g = h.g, bob = h.bob;
    const fwd = clamp(0.1 + g * 0.2 + s.lean * 0.95 - (s.charge || 0) * 0.15, -0.2, 1.25);
    const side = (s.kind === 'grab' ? -s.lean * 1.1 : s.kind === 'tug' ? -s.lean * 0.6 : 0) * mir;
    const rock = Math.sin(6.283 * s.ph * 2 + 0.3) * 0.02 * g;
    // hanging off the near side to reach the ground / a rival's ball: the whole man rolls about the saddle (his feet stay in the stirrups)
    const roll = (s.kind === 'grab' ? s.lean * 0.78 : s.kind === 'tug' ? s.lean * 0.5 : 0) * mir;
    human.root.rotation.z = roll;
    human.root.position.set(SEAT.y * Math.sin(roll), SEAT.y * (1 - Math.cos(roll)), 0);
    group.updateMatrixWorld(true);
    const thighFlex = 62, thighOut = 14;
    const flexs = (fwd * 180 / Math.PI);
    const twistAct = s.throwP >= 0 ? lerp(-20, 25, clamp(s.throwP, 0, 1)) : (s.charge > 0.05 ? -18 * s.charge : 0);
    writePose({
      Pelvis: { flex: 10 + flexs * 0.12, side: side * 8, twist: 0 },
      Spine: { flex: flexs * 0.22, side: side * 8, twist: (s.kind === 'tug' ? -10 : 0) * mir },
      Spine1: { flex: flexs * 0.32, side: side * 14 },
      Spine2: { flex: flexs * 0.34, side: side * 14, twist: twistAct * mir },
      Neck: { flex: -flexs * 0.25 - 4 },
      Head: { flex: -flexs * 0.1 },
      L_Thigh: { flex: thighFlex, abduct: thighOut }, R_Thigh: { flex: thighFlex, abduct: thighOut },
      L_Calf: { flex: 78 }, R_Calf: { flex: 78 },
    }, [side * -0.12, SEAT.y + 0.1 - ph0 + bob + rock, SEAT.z]);
    // shoulder predictions in horse space (near side = negative x of the unmirrored layout; mx() flips it for a left-facing rider)
    const mx = (x) => x * mir;
    const sh = { x: -0.2 + Math.abs(side) * -0.28, y: SEAT.y + 0.1 + bob + 0.5 * Math.cos(fwd) - Math.abs(side) * 0.15, z: SEAT.z + 0.5 * Math.sin(fwd) };
    for (const [sd, sx] of [['L', 1], ['R', -1]]) human.setReachFoot(sd, toWorld(sx * STIRRUP.x, STIRRUP.y + bob * 0.5, STIRRUP.z), 1);
    // far hand: the reins
    human.setReach(reinSide, toWorld(mx(-REIN_HAND.x), REIN_HAND.y + bob, REIN_HAND.z + fwd * 0.12), { weight: 1 });
    // near hand: depends on what the rider is doing
    let tx = -0.06, ty = REIN_HAND.y - 0.02 + bob, tz = REIN_HAND.z - 0.02;
    let fingers = 'relaxed';
    if (s.throwP >= 0) {
      const t = clamp(s.throwP, 0, 1), a = lerp(-2.7, 0.2, t);
      tx = sh.x - 0.12; ty = sh.y - Math.sin(a) * 0.62; tz = sh.z + Math.cos(a) * 0.62; fingers = 'ballGrip';
    } else if (s.charge > 0.02) {
      const c = clamp(s.charge, 0, 1);
      tx = sh.x - 0.2; ty = sh.y + 0.2 + 0.3 * c; tz = sh.z - 0.25 - 0.3 * c; fingers = 'ballGrip';
    } else if (s.kind === 'grab') {
      tx = -0.66; ty = 0.46; tz = clamp(s.reachX, 0.35, 1.5) - 0.1; fingers = 'open';
    } else if (s.kind === 'tug') {
      tx = -0.5; ty = 1.15; tz = clamp(s.reachX, 0.5, 1.4) + (s.tugKick || 0) * 0.15; fingers = 'fist';
    } else if (s.carry) {
      tx = -0.42; ty = 1.42; tz = 0.46; fingers = 'ballGrip';
    } else if (s.cheer) {
      tx = sh.x - 0.1 + Math.sin(s.t * 12) * 0.08; ty = sh.y + 0.7; tz = sh.z + 0.05; fingers = 'open';
    }
    tx = mx(tx);
    api.lastReach.set(tx, ty, tz);
    human.setReach(actSide, toWorld(tx, ty, tz), { weight: 1 });
    human.setFingers(actSide, fingers);
    human.setFingers(reinSide, 'relaxed');
    human.update(dt);
    // the ball in the working hand
    const carried = s.carry || s.charge > 0.02 || s.throwP >= 0;
    ball.visible = !!carried;
    if (carried) {
      human.handPosition(actSide, tmp);
      group.worldToLocal(tmp);
      ball.position.set(tmp.x - mx(0.02), tmp.y - 0.25, tmp.z + 0.06);
      ball.rotation.y = s.t * 2;
    }
    // reins and stirrup leathers follow the hands / feet (horse space)
    group.updateMatrixWorld(true);
    horse.mouthPoint(w2); group.worldToLocal(w2);
    human.handPosition(reinSide, tmp); group.worldToLocal(tmp);
    horse.placeBetween(horse.reins[0], w2.clone().add(new Vector3(0.05 * mir, 0, 0)), tmp.clone());
    human.handPosition(actSide, tmp); group.worldToLocal(tmp);
    horse.placeBetween(horse.reins[1], w2.clone().add(new Vector3(-0.05 * mir, 0, 0)), s.kind || s.carry || s.charge > 0.02 || s.throwP >= 0 ? new Vector3(mx(-0.07), REIN_HAND.y + bob, REIN_HAND.z - 0.02) : tmp.clone());
    for (const [i, sx] of [[0, 1], [1, -1]]) {
      horse.placeBetween(horse.straps[i], new Vector3(sx * 0.25, 1.38 + bob, STIRRUP.z), new Vector3(sx * STIRRUP.x, STIRRUP.y + 0.06 + bob * 0.5, STIRRUP.z));
      horse.irons[i].position.set(sx * STIRRUP.x, STIRRUP.y - 0.03 + bob * 0.5, STIRRUP.z + 0.02);
    }
  }
  const api = { group, human, horse, pose, ball, hat, skirt, setLook, lastReach: new Vector3(), detail: true };
  api.setDetail = (on) => { api.detail = !!on; horse.setDetail(on); };
  return api;
}

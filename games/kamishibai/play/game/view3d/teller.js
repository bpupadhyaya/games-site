// The storyteller: a real 3D man (view3d athlete_m) dressed in Showa-era street-performer clothes (flat cap, cream shirt with rolled sleeves,
// braces, dark trousers, a cloth round the neck) who pulls the picture cards out of the box with his left hand, strikes the hyoshigi
// clappers with his right, nods and gestures while he tells, leans in for the quiet cards and bows at the end.
// Presentation only: it is told what the show is doing (speaking, pulling, grade) and animates; it never writes back.
import { THREE } from '../vendor3d/index.js';
import { GY } from './world.js';
import { buildHyoshigi } from './butai.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, target, dt, tau) => cur + (target - cur) * (1 - Math.exp(-dt / tau));
const smoothS = (t) => t * t * (3 - 2 * t);
const D2R = Math.PI / 180;

// bone-parented clothing, measured in the current pose (call once after the first update)
function dress(V3, human) {
  const { THREE: T } = V3;
  const parts = [];
  const Y = new T.Vector3(0, 1, 0);
  const add = (bone, obj) => { bone.add(obj); parts.push({ bone, obj }); return obj; };
  const cloth = (c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.92, metalness: 0, side: T.DoubleSide, ...o });
  const shirt = cloth('#e9e3d0'), cuff = cloth('#d9d2bc'), trouser = cloth('#2c3038'), brace = cloth('#2a1d16'), towel = cloth('#f1efe6');
  const tube = (bone, child, r0, r1, mat, extra = 0, from = 0) => {
    const d = child.position.clone(), len = d.length(); d.normalize();
    const L = len * (1 - from) + extra;
    const m = new T.Mesh(new T.CylinderGeometry(r1, r0, L, 20, 1, true), mat);
    m.quaternion.setFromUnitVectors(Y, d); m.position.copy(d).multiplyScalar(len * from + L * 0.5);
    m.castShadow = true;
    return add(bone, m);
  };
  const B = (n) => human.bones[`Bip01_${n}`];
  // shirt sleeves: upper arm and a short rolled cuff above the elbow
  for (const s of ['L', 'R']) {
    const up = B(`${s}_UpperArm`), fo = B(`${s}_Forearm`), ha = B(`${s}_Hand`);
    if (!up || !fo || !ha) continue;
    tube(up, fo, 0.056, 0.05, shirt, 0.012);
    add(up, new T.Mesh(new T.SphereGeometry(0.058, 16, 12), shirt));
    const ring = new T.Mesh(new T.TorusGeometry(0.05, 0.011, 8, 22), cuff);
    ring.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), fo.position.clone().normalize());
    ring.position.copy(fo.position).multiplyScalar(0.02);
    add(up, ring);
    // forearm sleeve rolled to mid-forearm
    tube(fo, ha, 0.047, 0.043, shirt, 0, 0);
    const d = ha.position.clone().normalize();
    const roll = new T.Mesh(new T.TorusGeometry(0.044, 0.011, 8, 22), cuff);
    roll.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), d); roll.position.copy(d).multiplyScalar(ha.position.length() * 0.28);
    add(fo, roll);
  }
  // trousers: thigh and calf tubes, hem over the ankle
  for (const s of ['L', 'R']) {
    const th = B(`${s}_Thigh`), ca = B(`${s}_Calf`), fo = B(`${s}_Foot`);
    if (!th || !ca || !fo) continue;
    tube(th, ca, 0.098, 0.075, trouser, 0.01);
    add(th, new T.Mesh(new T.SphereGeometry(0.098, 16, 12), trouser));
    add(ca, new T.Mesh(new T.SphereGeometry(0.076, 14, 10), trouser));
    tube(ca, fo, 0.075, 0.066, trouser, 0.0);
  }
  // braces over the shoulders (front straps) on Spine2; positions measured in the current world pose
  const sp = B('Spine2') || B('Spine1');
  if (sp) {
    human.root.updateMatrixWorld(true);
    const W = (x, y, z) => sp.worldToLocal(new T.Vector3(x, y, z));
    const hp = human.bonePosition('Pelvis');
    const strap = (a, b) => {
      const A = W(...a), Bv = W(...b), d = Bv.clone().sub(A), len = d.length(); d.normalize();
      const fwd = sp.worldToLocal(new T.Vector3(0, 0, 1)).sub(sp.worldToLocal(new T.Vector3(0, 0, 0))).normalize();
      const x = new T.Vector3().crossVectors(d, fwd).normalize(), z = new T.Vector3().crossVectors(x, d).normalize();
      const m = new T.Mesh(new T.BoxGeometry(0.03, len, 0.008), brace);
      m.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x, d, z));
      m.position.copy(A).add(Bv).multiplyScalar(0.5);
      return add(sp, m);
    };
    const top = human.bonePosition('Neck');
    for (const sx of [-1, 1]) { strap([sx * 0.085, top.y - 0.03, 0.085], [sx * 0.075, hp.y + 0.12, 0.125]); }
    // a cloth round the neck
    const neck = new T.Mesh(new T.TorusGeometry(0.075, 0.026, 10, 24), towel);
    neck.rotation.x = Math.PI / 2 - 0.25; neck.position.copy(W(top.x, top.y - 0.045, top.z + 0.005));
    const q = new T.Quaternion(); sp.getWorldQuaternion(q); neck.quaternion.premultiply(q.invert());
    add(sp, neck);
    const tail = new T.Mesh(new T.BoxGeometry(0.06, 0.2, 0.012), towel);
    tail.position.copy(W(top.x + 0.03, top.y - 0.17, top.z + 0.115));
    tail.quaternion.copy(q);
    add(sp, tail);
  }
  // flat cap on the head bone
  const head = B('Head');
  if (head) {
    human.root.updateMatrixWorld(true);
    const hw = human.bonePosition('Head');
    const q = new T.Quaternion(); head.getWorldQuaternion(q); const qi = q.clone().invert();
    const cap = new T.Group();
    const wool = new T.MeshStandardMaterial({ color: '#3b3f4a', roughness: 0.95, metalness: 0 });
    const dome = new T.Mesh(new T.SphereGeometry(0.1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), wool);
    dome.scale.set(1.12, 0.9, 1.2); dome.position.set(0, -0.012, -0.014);
    const band = new T.Mesh(new T.CylinderGeometry(0.103, 0.105, 0.03, 26, 1, true), wool);
    band.scale.set(1.04, 1, 1.12); band.position.set(0, 0.002, -0.012);
    const peak = new T.Mesh(new T.CylinderGeometry(0.095, 0.095, 0.008, 22, 1, false, -Math.PI * 0.42, Math.PI * 0.84), new T.MeshStandardMaterial({ color: '#2a2d36', roughness: 0.8 }));
    peak.scale.set(1.0, 1, 0.95); peak.position.set(0, -0.012, 0.085); peak.rotation.x = 0.06;
    cap.add(dome, band, peak);
    cap.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    // headPoint: where the crown of the head is, in world space; the cap sits on it
    const crown = new T.Vector3(hw.x, hw.y + 0.15, hw.z + 0.012);
    cap.position.copy(head.worldToLocal(crown.clone()));
    cap.quaternion.copy(qi);
    add(head, cap);
  }
  return { parts, remove() { parts.forEach((p) => p.bone.remove(p.obj)); } };
}

export async function createTeller(V3, stage, { quality = 'high' } = {}) {
  const { loadHuman, buildClip } = V3;
  const human = await loadHuman({ character: 'athlete_m', kit: { top: '#e7e1cf', bottoms: '#2c3038', socks: '#1c1c20', shoes: '#241a14' }, skin: '#e0b48c', hair: 'black' });
  stage.add(human); stage.track(human);
  human.groundClamp = 'off'; human.footPlanting = false;
  human.setPosition(0, GY, 0); human.setFacing(0);
  human.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  human.setFingers('L', 'relaxed'); human.setFingers('R', 'relaxed');

  // ---- clips -----------------------------------------------------------------------------------------------------------------------
  // a relaxed stance with the weight on one leg, chest slightly forward, head up to the children
  // standing at the side of the bicycle: weight on one leg, chest a little forward, head up to the children, left hand free for the cards
  const STAND = {
    Spine: { flex: 3 }, Spine1: { flex: 4 }, Spine2: { flex: 2 }, Neck: { flex: -4 }, Head: { flex: -1 },
    L_UpperArm: { flex: 10, abduct: 6 }, R_UpperArm: { flex: 18, abduct: 5 }, L_Forearm: { flex: 34 }, R_Forearm: { flex: 52 },
  };
  const stance = buildClip(human, {
    name: 'tell_idle', duration: 4, base: 'idle_relaxed',
    keys: [{ t: 0, pose: STAND }, { t: 2, pose: { ...STAND, Spine1: { flex: 5 }, Head: { flex: -2 } }, ease: 'inOut' }, { t: 4, pose: STAND, ease: 'inOut' }],
  });
  human.addClip(stance);
  // gestures: arm/palm accents on the upper body layer
  const gesture = buildClip(human, {
    name: 'tell_open', duration: 1.5, base: 'idle_relaxed',
    keys: [
      { t: 0 },
      { t: 0.4, pose: { R_UpperArm: { flex: 38, abduct: 26 }, R_Forearm: { flex: 70 }, Spine1: { twist: -6, flex: 4 }, Head: { twist: -8 } }, ease: 'out' },
      { t: 1.0, pose: { R_UpperArm: { flex: 34, abduct: 30 }, R_Forearm: { flex: 52 }, Spine1: { twist: -4 }, Head: { twist: -4 } }, ease: 'inOut' },
      { t: 1.5, pose: { R_UpperArm: { flex: 12, abduct: 4 }, R_Forearm: { flex: 36 } }, ease: 'inOut' },
    ],
    fingers: 'open',
  });
  human.addClip(gesture);
  const strike = buildClip(human, {
    name: 'tell_strike', duration: 0.9, base: 'idle_relaxed',
    keys: [
      { t: 0, pose: { R_UpperArm: { flex: 20 }, R_Forearm: { flex: 60 } } },
      { t: 0.25, pose: { R_UpperArm: { flex: 55, abduct: 14 }, R_Forearm: { flex: 100 }, Spine1: { flex: -2 } }, ease: 'inOut' },
      { t: 0.45, pose: { R_UpperArm: { flex: 28, abduct: 10 }, R_Forearm: { flex: 70 }, Spine1: { flex: 6 } }, ease: 'out' },
      { t: 0.9, pose: { R_UpperArm: { flex: 20 }, R_Forearm: { flex: 60 } }, ease: 'inOut' },
    ],
    events: { hit: 0.45 },
  });
  human.addClip(strike);
  const bow = buildClip(human, {
    name: 'tell_bow', duration: 2.2, base: 'idle_relaxed',
    keys: [
      { t: 0 },
      { t: 0.7, pose: { Spine: { flex: 14 }, Spine1: { flex: 22 }, Spine2: { flex: 12 }, Neck: { flex: 10 }, Head: { flex: 6 }, L_UpperArm: { flex: 6 }, R_UpperArm: { flex: 6 } }, ease: 'inOut' },
      { t: 1.4, pose: { Spine: { flex: 14 }, Spine1: { flex: 22 }, Spine2: { flex: 12 }, Neck: { flex: 10 }, Head: { flex: 6 } }, ease: 'inOut' },
      { t: 2.2 },
    ],
  });
  human.addClip(bow);
  human.addLayer('upper', { mask: 'upper' });
  human.play('tell_idle', { fade: 0, loop: true });
  human.update(0);
  let suit = null;
  try { suit = dress(V3, human); } catch (e) { console.warn('storyteller clothes failed', e); }

  // hyoshigi in the right hand (the blocks hang from the cord, held at the top end)
  const clap = buildHyoshigi();
  const rHand = human.bones.Bip01_R_Hand;
  clap.scale.setScalar(1);
  if (rHand) { rHand.add(clap); clap.position.set(0.0, 0.0, 0.0); }

  const S = {
    human, suit, clap,
    pos: new THREE.Vector3(), yaw: 0, tPos: new THREE.Vector3(), tYaw: 0,
    lean: 0, nodT: 0, strikeT: -1, gestureAt: 1.0, speakPhase: 0, bowing: 0,
    look: new THREE.Vector3(0, GY + 1.5, 3), lookW: 0.8,
    handL: { w: 0, p: new THREE.Vector3(0.3, 0, -0.1), cur: new THREE.Vector3(0.3, 0, -0.1) },
    handR: { w: 0, cur: new THREE.Vector3(0.0, 0.0, -0.36) }, gestT: -1, hit: false,
    hitCb: null,
    ready: true,
  };
  S.onHit = (f) => { S.hitCb = f; };
  human.on && human.on('hit', () => { if (S.hitCb) S.hitCb(); });

  // ---- per-frame --------------------------------------------------------------------------------------------------------------------
  // ctx: { dt, pos:[x,z], yaw, speaking (0..1), pull: { x, y, z } | null (world point of the card's edge the left hand holds),
  //        restL: { x, y, z } (where the left hand waits), lookAt: {x,y,z}, lean (0..1 towards the card), strike (bool edge), bow (bool) }
  S.update = (c) => {
    const dt = c.dt;
    // position / heading (eased so a camera change never teleports him)
    const k = dt > 0 ? 1 - Math.exp(-dt / 0.35) : 1;
    S.pos.x += (c.pos[0] - S.pos.x) * k; S.pos.z += (c.pos[1] - S.pos.z) * k;
    let dy = c.yaw - S.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); S.yaw += dy * k;
    if (S.first === undefined) { S.pos.x = c.pos[0]; S.pos.z = c.pos[1]; S.yaw = c.yaw; S.first = false; }
    human.setPosition(S.pos.x, GY, S.pos.z); human.setFacing(S.yaw, { snap: true });

    // right hand: waits near the top corner of the box holding the hyoshigi; while he speaks it makes an open gesture now and then;
    // a strike lifts the clappers and brings them down together (the hit event fires at the bottom of the stroke)
    const RH = S.handR;
    if (c.speaking > 0.05 && dt > 0 && S.gestT < 0 && S.strikeT < 0) {
      S.gestureAt -= dt;
      if (S.gestureAt <= 0) { S.gestT = 0; S.gestureAt = 2.8 + Math.random() * 2.2; }
    }
    if (c.strike && S.strikeT < 0) { S.strikeT = 0; S.gestT = -1; S.hit = false; }
    let rx = c.restR.x, ry = c.restR.y, rz = c.restR.z, rw = 0.85;
    if (S.gestT >= 0) {
      S.gestT += dt; const u = clamp(S.gestT / 1.5, 0, 1), e = Math.sin(Math.PI * u);
      rx -= 0.12 * e; ry += 0.13 * e; rz += 0.1 * e; rw = 1;
      if (u >= 1) S.gestT = -1;
    }
    if (S.strikeT >= 0) {
      S.strikeT += dt; const t2 = S.strikeT;
      const up = clamp(t2 / 0.3, 0, 1), down = clamp((t2 - 0.3) / 0.14, 0, 1), back = clamp((t2 - 0.5) / 0.4, 0, 1);
      const lift = smoothS(up) * (1 - down) + (1 - back) * down * 0;
      ry += 0.2 * lift - 0.04 * down * (1 - back); rx += 0.0; rz += 0.1 * lift; rw = 1;
      clap.userData.setOpen(t2 > 0.3 && t2 < 0.48 ? 0.0 : 0.55 - 0.1 * smoothS(up));
      if (t2 >= 0.44 && !S.hit) { S.hit = true; if (S.hitCb) S.hitCb(); }
      if (t2 > 0.95) { S.strikeT = -1; clap.userData.setOpen(0.4); }
    }
    RH.w = damp(RH.w, rw, dt || 1, 0.12);
    RH.cur.x = damp(RH.cur.x, rx, dt || 1, 0.09); RH.cur.y = damp(RH.cur.y, ry, dt || 1, 0.09); RH.cur.z = damp(RH.cur.z, rz, dt || 1, 0.09);
    human.setReach('R', RH.cur, { weight: RH.w, pole: { x: RH.cur.x - 0.3, y: RH.cur.y - 0.25, z: RH.cur.z - 0.3 } });
    if (c.bow && !S.bowing) { S.bowing = 1; human.play('tell_bow', { fade: 0.25, loop: false }); }
    if (!c.bow && S.bowing) { S.bowing = 0; human.play('tell_idle', { fade: 0.4, loop: true }); }

    // look at the children, or at the card when he pulls it
    const lw = damp(S.lookW, c.lookW ?? 0.8, dt || 1, 0.25); S.lookW = lw;
    S.look.x = damp(S.look.x, c.lookAt.x, dt || 1, 0.18); S.look.y = damp(S.look.y, c.lookAt.y, dt || 1, 0.18); S.look.z = damp(S.look.z, c.lookAt.z, dt || 1, 0.18);
    human.lookAt(S.look, { weight: lw, maxYaw: 0.9, maxPitch: 0.5 });

    // left hand: waits at the side of the box, goes to the card's edge when it is pulled
    const H = S.handL;
    const want = c.pull ? c.pull : c.restL;
    const tw = c.pull ? 1 : 0.9;
    H.w = damp(H.w, tw, dt || 1, c.pull ? 0.1 : 0.3);
    H.cur.x = damp(H.cur.x, want.x, dt || 1, c.pull ? 0.08 : 0.22); H.cur.y = damp(H.cur.y, want.y, dt || 1, c.pull ? 0.08 : 0.22); H.cur.z = damp(H.cur.z, want.z, dt || 1, c.pull ? 0.08 : 0.22);
    human.setReach('L', H.cur, { weight: H.w, pole: { x: H.cur.x + 0.25, y: H.cur.y - 0.2, z: H.cur.z - 0.25 } });
  };
  return S;
}

// A real 3D stilt fisherman (presentation only: reads the pose numbers the 2D picture hands over, never writes back).
//
// The shared view3d layer supplies the person (athlete_m), the stage and the IK; this file authors the seated pose on its skeleton:
// sitting on the crossbar, near foot on the foot rest, far leg hooked round the pole, one hand forward and one at the reel on a bent
// bamboo rod. The result is drawn into an off-screen WebGL canvas and composited by src/art.js drawFisherman().
import { createStage, loadHuman, Clip, CLIP_BONES, semanticRot, solvePalmBall, THREE } from '../vendor3d/index.js';

const { Vector3, Quaternion, Euler } = THREE;
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const bi = (n) => CLIP_BONES.indexOf(`Bip01_${n}`);

// Local frame of the 2D picture: origin = the seat on the crossbar, x toward the sea, y down, 95 px per metre.
export const PPM = 95;
export const REGION = { x: -64, y: -172, w: 272, h: 262 };
const YS = 0.62;                       // world height of the seat (the figure floats; there is no ground in this picture)
const ROD_Z = 0.13;                    // the rod runs a hand's width in front of the body centre line (towards the camera)

class Fisher {
  constructor(human) {
    this.h = human;
    this.yaw = Math.PI / 2;            // faces +X (the sea)
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

// A head cloth (wrapped, with a knot at the back) parented to the head bone.
function addHeadCloth(human, hex) {
  human._applyRest(); human.root.updateMatrixWorld(true);
  const hb = human.bones.Bip01_Head;
  const mat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).multiplyScalar(0.8), roughness: 0.85, metalness: 0 });
  const g = new THREE.Group();
  // head-bone frame at rest: +x is up the skull, +y/-z are sideways/forward depending on the rig; the group is oriented from the world rest frame
  const inv = hb.getWorldQuaternion(new Quaternion()).invert();
  g.quaternion.copy(inv);
  const head = hb.getWorldPosition(new Vector3());
  const top = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), mat);
  top.scale.set(0.114, 0.118, 0.124); top.position.set(0, 0.148, 0.004);
  const band = new THREE.Mesh(new THREE.TorusGeometry(1, 0.11, 8, 28), dark);
  band.rotation.x = Math.PI / 2; band.scale.set(0.108, 0.118, 0.1); band.position.set(0, 0.152, 0.0);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), mat); knot.position.set(0, 0.165, -0.115);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.022, 0.12, 8), mat); tail.position.set(0.0, 0.11, -0.14); tail.rotation.x = 0.35;
  g.add(top, band, knot, tail);
  g.position.copy(new Vector3(0, 0, 0));
  hb.add(g);
  void head;
  return g;
}

// ---------------------------------------------------------------------------------------------------------------------------------
export async function createFisher({ quality = 'medium', base } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: true, shadows: false, lighting: 'day', fov: 12 });
  if (!stage.supported) return null;
  stage.setSky(null, null);
  const spec = { character: 'athlete_m', base, kit: { top: '#efe7d4', bottoms: '#27457e', socks: '#ffffff' }, skin: '#a8714a', hair: 'black' };
  const human = await loadHuman(spec);
  const feet = { mats: [], toes: null, groups: null };   // the athlete's own skinned shoes: no add-on foot meshes, so no ankle seam
  const footMats = feet.mats;
  const cloth = addHeadCloth(human, '#d9e6ee');
  const fisher = new Fisher(human);
  stage.add(human); stage.track(human);
  // the bamboo rod: a tapered tube along a quadratic curve, rebuilt every frame (butt, control point, tip in world metres)
  const SEG = 16, SIDES = 6;
  const rodGeo = new THREE.BufferGeometry();
  const pos = new Float32Array((SEG + 1) * SIDES * 3), idx = [];
  for (let i = 0; i < SEG; i++) for (let j = 0; j < SIDES; j++) {
    const a = i * SIDES + j, b = i * SIDES + (j + 1) % SIDES, c = a + SIDES, d = b + SIDES;
    idx.push(a, c, b, b, c, d);
  }
  rodGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); rodGeo.setIndex(idx);
  const rod = new THREE.Mesh(rodGeo, new THREE.MeshStandardMaterial({ color: '#5a3d22', roughness: 0.55, metalness: 0.05 }));
  rod.frustumCulled = false;
  stage.scene.add(rod);
  // reel seat / handle: a short darker wrap on the butt end
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 10), new THREE.MeshStandardMaterial({ color: '#241a12', roughness: 0.8 }));
  grip.frustumCulled = false; stage.scene.add(grip);
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16), new THREE.MeshStandardMaterial({ color: '#b8a070', roughness: 0.35, metalness: 0.6 }));
  reel.frustumCulled = false; stage.scene.add(reel);
  const cam = stage.camera;
  cam.fov = 12; cam.near = 1; cam.far = 80;
  const api = { stage, fisher, human, quality, footMats, toes: feet.toes, groups: feet.groups, cloth, fitted: { w: 0, h: 0 }, ok: true, lost: false, light: '' };
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { api.lost = false; api.fitted.w = 0; });
  return Object.assign(api, makeApi(api, { rod, grip, reel, pos, SEG, SIDES, rodGeo }));
}

const CAM = { dist: 14, yaw: 8 * D2R, pitch: 4 * D2R };

function makeApi(api, R) {
  const { stage, fisher: F, human: H } = api;
  const cam = stage.camera, renderer = stage.renderer;
  const v = new Vector3(), v2 = new Vector3(), qy = new Quaternion(), up = new Vector3(0, 1, 0);
  const GRIP = { curl: [[0.8, 0.9, 0.5], [1.05, 1.3, 0.85], [1.1, 1.35, 0.9], [1.1, 1.35, 0.9], [1.15, 1.4, 0.95]], spread: [0, 0, 0, 0, 0] };

  function frameCamera(devW, devH) {
    renderer.setPixelRatio(1); renderer.setSize(devW, devH, false);
    cam.aspect = devW / devH;
    const hM = REGION.h / PPM, D = CAM.dist;
    cam.fov = 2 * Math.atan(hM / 2 / D) / D2R;
    const cx = (REGION.x + REGION.w / 2) / PPM, cy = YS - (REGION.y + REGION.h / 2) / PPM;
    const tgt = new Vector3(cx, cy, 0);
    cam.position.set(tgt.x + D * Math.sin(CAM.yaw) * Math.cos(CAM.pitch), tgt.y + D * Math.sin(CAM.pitch), tgt.z + D * Math.cos(CAM.yaw) * Math.cos(CAM.pitch));
    cam.lookAt(tgt);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    // the seat point (local 0,0) must land on its pixel
    const p = new Vector3(0, YS, 0).project(cam);
    const wantX = 2 * (0 - REGION.x) / REGION.w - 1, wantY = 1 - 2 * (0 - REGION.y) / REGION.h;
    const e = cam.projectionMatrix.elements;
    e[8] -= (wantX - p.x); e[9] -= (wantY - p.y);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  // local 2D point (px, y down) rotated by the body lean about the seat -> world metres
  const W = (lx, ly, lean, z, out) => {
    const c = Math.cos(lean), s = Math.sin(lean);
    return out.set((lx * c - ly * s) / PPM, YS - (lx * s + ly * c) / PPM, z);
  };

  /**
   * p: { t, lean (rad, torso lean about the seat), tug 0..1 (fish pulling), cast 0..1, panic 0..1 (falling),
   *      hand: [x,y], rod: { bx, by, cx, cy, tx, ty } (local px, before the lean) }
   */
  function pose(p, dt) {
    const lean = clamp(p.lean, -0.9, 0.9), ld = lean / D2R;
    const t = p.t, breath = Math.sin(t * 1.9), tug = p.tug || 0, panic = p.panic || 0, cast = p.cast || 0;
    const flex = 8 + ld * 0.95 + tug * 6 - cast * 8 - panic * 10;
    const sideSway = Math.sin(t * 0.7) * 1.5;
    const pelU = YS + 0.095;
    // a fall is real body motion: slip (hands grab the bar, body drops, legs scrabble), drop (let go, arms up), climb (hugs the pole, hand over hand)
    const fall = p.fall || null, slip = fall && fall.mode === 'slip', dropM = fall && fall.mode === 'drop', climb = fall && fall.mode === 'climb';
    const yawU = climb ? -Math.PI / 2 : F.yaw;
    F.h.root.position.set(climb ? 0.13 : 0, 0, 0);
    F.h.root.rotation.y = yawU; F.h.facing = yawU;
    const ft = fall ? fall.t : 0, cph = climb ? fall.c * 16 : 0;
    const offs = {
      Pelvis: { flex: flex * 0.1 + 6, side: sideSway * 0.3 },
      Spine: { flex: flex * 0.3, side: sideSway * 0.3, twist: -4 },
      Spine1: { flex: flex * 0.3, side: sideSway * 0.3, twist: -4 },
      Spine2: { flex: flex * 0.3, twist: -3 },
      Neck: { flex: -flex * 0.25 - 4 },
      Head: { flex: -flex * 0.25 + 4 - tug * 4 },
      R_Thigh: { flex: 84, abduct: 4 }, L_Thigh: { flex: 70, abduct: 14 },
      R_Calf: { flex: 80 }, L_Calf: { flex: 96 },
    };
    if (slip || dropM) {
      const sc = slip ? Math.sin(ft * 17) : 0;
      Object.assign(offs, { Pelvis: { flex: -4 }, Spine: { flex: -6 }, Spine1: { flex: -4 }, Spine2: { flex: -4 }, Neck: { flex: 6 }, Head: { flex: 6 },
        R_Thigh: { flex: 22 + sc * 14, abduct: 4 }, L_Thigh: { flex: 22 - sc * 14, abduct: 8 }, R_Calf: { flex: 30 - sc * 14 }, L_Calf: { flex: 30 + sc * 14 } });
    }
    if (climb) {
      const a = Math.sin(cph);
      Object.assign(offs, { Pelvis: { flex: 4 }, Spine: { flex: 2 }, Spine1: { flex: 4 }, Spine2: { flex: 4 }, Neck: { flex: -8 }, Head: { flex: -10 },
        R_Thigh: { flex: 38 + a * 24, abduct: 6 }, L_Thigh: { flex: 38 - a * 24, abduct: 10 }, R_Calf: { flex: 60 + a * 24 }, L_Calf: { flex: 60 - a * 24 } });
    }
    F.writePose(offs, [0, pelU - F.ph, -0.045]);
    // legs. The near foot rests on the lower rung (ball of the foot on the bar, heel a little raised, toes pointing forward-down); the far
    // leg hangs relaxed from the knee and swings as a damped pendulum, kicked by the body sway when a swell hits. All targets are smoothed.
    const toWorld = (l, u, f, out) => out.set(l, u, f).applyAxisAngle(up, yawU).add(F.h.root.position);
    const lat = new Vector3(-1, 0, 0).applyAxisAngle(up, yawU);       // avatar-left axis in world (pitch of the foot is about this)
    const leg = F.leg || (F.leg = { a: 0.2, w: 0, prevLean: lean, lf: undefined, nearL: 0, nearZ: 0, curl: 0, toePhase: 0 });
    const sdt = clamp(dt, 0, 0.05);
    if (sdt > 0) {
      // the drive is the body's sway speed, low-passed (tau ~0.12 s) so a hard swell kick reads as a push, not a snap
      leg.lf = leg.lf === undefined ? lean : leg.lf + (lean - leg.lf) * (1 - Math.exp(-sdt / 0.12));
      const leanV = (leg.lf - leg.prevLean) / sdt; leg.prevLean = leg.lf;
      // damped pendulum: stiffness 20 (about 0.7 Hz), damping 2.4; body sway and a faint tide drive it
      const acc = -20 * (leg.a - 0.2) - 3.2 * leg.w - clamp(leanV, -3, 3) * 3.2 + Math.sin(t * 0.8 + 1.3) * 0.5 + tug * 1.2 * Math.sin(t * 9);
      leg.w += acc * sdt; leg.a += leg.w * sdt;
      leg.a = clamp(leg.a, -0.45, 0.7);
    }
    const footU = YS - 0.545;                      // sole height on the lower rung
    const kneeF = 0.40, kneeU = YS + 0.0, shin = 0.335;
    // far (left) leg: relaxed hang
    const aL = leg.a, fF = kneeF - 0.02 + Math.sin(aL) * shin, fU = kneeU - Math.cos(aL) * shin - 0.01 + panic * 0.05;
    const plantarFar = (30 + aL * 24 + panic * 20) * D2R;
    qy.setFromAxisAngle(up, yawU);
    const footQ = (plantar, yaw, roll) => {
      const q = new Quaternion().setFromAxisAngle(lat, -plantar);                     // toes down
      const qr = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0).applyAxisAngle(up, yawU), roll || 0);
      const qyaw = new Quaternion().setFromAxisAngle(up, yaw || 0);
      return q.multiply(qr).multiply(qyaw).multiply(qy).multiply(F.h._restQ.L_Foot);
    };
    const placeFoot = (side, l, u, f, q) => {
      toWorld(l, u, f, v);
      F.h.setReachFoot(side, v, 1, q);
    };
    if (fall) {
      // legs under the body: scrabbling against the pole (slip), straight and trailing (drop), or stepping up the pole (climb)
      const q1 = footQ(40 * D2R, 0, 0).clone(), q2 = footQ(40 * D2R, 0, 0).clone();
      if (climb) {
        const a = Math.sin(cph);
        placeFoot('R', -0.1, pelU - 0.64 + Math.max(0, a) * 0.2, -0.18, q1); placeFoot('L', 0.1, pelU - 0.64 + Math.max(0, -a) * 0.2, -0.18, q2);
      } else if (slip) {
        const sc = Math.sin(ft * 17);
        placeFoot('R', -0.1, pelU - 0.7 + sc * 0.06, 0.02 - Math.max(0, sc) * 0.08, q1); placeFoot('L', 0.1, pelU - 0.7 - sc * 0.06, 0.02 - Math.max(0, -sc) * 0.08, q2);
      } else { placeFoot('R', -0.1, pelU - 0.78, -0.02, footQ(60 * D2R, 0, 0).clone()); placeFoot('L', 0.1, pelU - 0.76, 0.02, footQ(60 * D2R, 0, 0).clone()); }
    } else {
    placeFoot('L', 0.10, fU, fF, footQ(plantarFar, -0.26, 0).clone());
    // near (right) foot on the rung: ball of the foot lands on the bar, ankle sits behind and above it
    const plantarNear = 14 * D2R;
    const nearAnkleU = footU + F.h._ankleRest * Math.cos(plantarNear) + 0.004 + Math.sin(plantarNear) * 0.05;
    placeFoot('R', -0.11, nearAnkleU + Math.sin(t * 0.5) * 0.002, 0.25 + panic * 0.04, footQ(plantarNear, -0.26, 0).clone());
    }
    // toes: a slow curl on the resting foot, the hanging foot grips a little more
    leg.toePhase += sdt;
    const curlR = 0.12 + 0.1 * (0.5 + 0.5 * Math.sin(leg.toePhase * 0.9)) + tug * 0.35;
    const curlL = 0.25 + 0.15 * (0.5 + 0.5 * Math.sin(leg.toePhase * 0.7 + 1)) + Math.abs(leg.w) * 0.2;
    if (api.toes) { api.toes.R.rotation.x = clamp(curlR, 0, 0.8); api.toes.L.rotation.x = clamp(curlL, 0, 0.8); }
    F.h.setReach('L', null); F.h.setReach('R', null);
    F.h.update(dt);
    // hands: the near hand (right) forward on the rod, the other (left) at the reel; both on the rod line
    const r = p.rod;
    const hand = p.hand, nearPt = nearestOn(r, hand[0], hand[1]);
    const back = pointOn(r, Math.max(0, nearPt.u - 0.19));
    if (slip || climb) {
      const grip = (side, C, n, fx, rad) => { const sol = solvePalmBall(F.h, side, C, n, fx, rad); F.h.setReach(side, sol.wrist, { weight: 1, quat: sol.quat }); };
      if (slip) {
        const by = YS + (fall.drop || 0) / PPM - 0.04;            // centre of the crossbar (it stays put while the body drops)
        grip('R', new Vector3(0.16, by, 0.1), new Vector3(0, -1, 0), new Vector3(0, 0, 1), 0.04);
        grip('L', new Vector3(0.0, by, 0.1), new Vector3(0, -1, 0), new Vector3(0, 0, 1), 0.04);
      } else {
        const a = Math.sin(cph);
        const base = pelU + 0.82;
        grip('R', new Vector3(-0.021, base + 0.1 + a * 0.1, 0.0), new Vector3(-1, 0, 0), new Vector3(0, 1, 0), 0.047);
        grip('L', new Vector3(-0.021, base + 0.1 - a * 0.1, 0.0), new Vector3(-1, 0, 0), new Vector3(0, 1, 0), 0.047);
      }
      F.h.setFingers('R', GRIP); F.h.setFingers('L', GRIP);
    } else if (dropM) {
      const k = clamp(fall.q || 1, 0, 1);
      v.set(0.3, pelU + 0.85, 0.3); F.h.setReach('R', v, { weight: k });
      v2.set(-0.1, pelU + 0.9, -0.3); F.h.setReach('L', v2, { weight: k });
      F.h.setFingers('R', 'open'); F.h.setFingers('L', 'open');
    } else if (panic < 0.15) {
      // palm over the rod, fingers wrapped round it (the rod runs along the camera-plane tangent; the fingers go across it)
      const grab = (side, ptL, fx) => {
        const a = pointOn(r, clamp(nearestOn(r, ptL.x, ptL.y).u, 0, 1)), b = pointOn(r, clamp(nearestOn(r, ptL.x, ptL.y).u + 0.03, 0, 1));
        const C = W(a.x, a.y, lean, ROD_Z, new Vector3()), D = W(b.x, b.y, lean, ROD_Z, new Vector3());
        const tn = D.sub(C).normalize();
        const n = new Vector3(tn.y, -tn.x, 0); if (n.y > 0) n.negate();
        const sol = solvePalmBall(F.h, side, C, n, fx, 0.016);
        F.h.setReach(side, sol.wrist, { weight: 1, quat: sol.quat });
      };
      grab('R', { x: hand[0], y: hand[1] }, new Vector3(0, 0, 1));
      grab('L', back, new Vector3(0, 0, 1));
      F.h.setFingers('R', GRIP); F.h.setFingers('L', GRIP);
    } else {
      // falling: arms thrown out and up
      const k = clamp(panic, 0, 1);
      v.set(0.45, YS + 0.25 + 0.2 * k, 0.28); F.h.setReach('R', v, { weight: k });
      v2.set(0.1, YS + 0.5, -0.2); F.h.setReach('L', v2, { weight: k });
      F.h.setFingers('R', 'open'); F.h.setFingers('L', 'open');
    }
    F.h.update(0);
    // the rod follows the (leaning) torso: butt behind the hip, bowed under the fish
    const B = W(r.bx, r.by, lean, ROD_Z, new Vector3()), C = W(r.cx, r.cy, lean, ROD_Z + 0.01, new Vector3()), T = W(r.tx, r.ty, lean, ROD_Z, new Vector3());
    const pa = R.pos;
    const rb = 0.0155, rt = 0.0045;
    const nrm = new Vector3(), tan = new Vector3(), bin = new Vector3(0, 0, 1), side = new Vector3();
    for (let i = 0; i <= R.SEG; i++) {
      const u = i / R.SEG, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
      const px = a * B.x + b * C.x + c * T.x, py = a * B.y + b * C.y + c * T.y, pz = a * B.z + b * C.z + c * T.z;
      tan.set(2 * (1 - u) * (C.x - B.x) + 2 * u * (T.x - C.x), 2 * (1 - u) * (C.y - B.y) + 2 * u * (T.y - C.y), 0).normalize();
      nrm.set(-tan.y, tan.x, 0);
      const rad = lerp(rb, rt, Math.pow(u, 0.7));
      for (let j = 0; j < R.SIDES; j++) {
        const ang = j / R.SIDES * Math.PI * 2;
        side.copy(nrm).multiplyScalar(Math.cos(ang) * rad).addScaledVector(bin, Math.sin(ang) * rad);
        const o = (i * R.SIDES + j) * 3;
        pa[o] = px + side.x; pa[o + 1] = py + side.y; pa[o + 2] = pz + side.z;
      }
    }
    R.rodGeo.attributes.position.needsUpdate = true;
    R.rodGeo.computeVertexNormals();
    // handle wrap and reel along the butt
    const g = pointAt(B, C, T, 0.07), g2 = pointAt(B, C, T, 0.2), g1 = pointAt(B, C, T, 0.0);
    R.grip.position.copy(g1.clone().lerp(g2, 0.5));
    R.grip.quaternion.setFromUnitVectors(up, g2.clone().sub(g1).normalize());
    R.grip.scale.set(1, g2.distanceTo(g1) / 0.2, 1);
    R.reel.position.copy(g).add(new Vector3(0, -0.035, ROD_Z * 0 + 0.045));
    R.reel.rotation.set(Math.PI / 2, 0, 0);
  }

  function pointAt(B, C, T, u) {
    const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
    return new Vector3(a * B.x + b * C.x + c * T.x, a * B.y + b * C.y + c * T.y, a * B.z + b * C.z + c * T.z);
  }
  function pointOn(r, u) {
    const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
    return { x: a * r.bx + b * r.cx + c * r.tx, y: a * r.by + b * r.cy + c * r.ty };
  }
  function nearestOn(r, x, y) {
    let best = 0, bd = 1e9;
    for (let i = 0; i <= 40; i++) { const u = i / 40, p = pointOn(r, u), d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = u; } }
    return { u: best };
  }

  let curLight = '', lastT = null;
  const cost = { ema: 0, n: 0, low: false };
  api.setLight = (amb, storm) => {
    const name = storm ? 'storm' : amb >= 0.95 ? 'day' : amb >= 0.8 ? 'evening' : 'night';
    if (name === curLight) return;
    curLight = name;
    const tune = name === 'storm' ? { hemi: 0.75, keyI: 1.5, rimI: 0.6 } : name === 'day' ? { hemi: 0.5, keyI: 2.9, rimI: 1.5 } : name === 'evening' ? { hemi: 0.62, keyI: 2.5, rimI: 1.2 } : { hemi: 0.7, keyI: 1.9, rimI: 1.2 };
    stage.setLighting(name === 'storm' ? 'day' : name, tune); stage.setSky(null, null);
  };
  /** Draw into ctx (already translated to the seat, rotated for a fall, scaled by k so 1 unit = 1 local px). Returns false when not available. */
  api.draw = function (ctx, p) {
    if (api.lost || stage.contextLost) return false;
    const t0 = globalThis.performance.now();
    const m = ctx.getTransform();
    const pxPerUnit = Math.hypot(m.a, m.b);
    const devW = clamp(Math.round(REGION.w * pxPerUnit), 120, p.maxW || 900), devH = Math.round(devW * REGION.h / REGION.w);
    api.setLight(p.amb, p.storm);
    const dt = lastT === null ? 0 : clamp(p.t - lastT, 0, 0.1); lastT = p.t;
    pose(p, dt);
    if (renderer.domElement.width !== devW || renderer.domElement.height !== devH || api.fitted.w !== devW) { frameCamera(devW, devH); api.fitted.w = devW; api.fitted.h = devH; }
    stage.render();
    ctx.drawImage(renderer.domElement, REGION.x, REGION.y, REGION.w, REGION.h);
    const ms = globalThis.performance.now() - t0;
    cost.ema = cost.n ? cost.ema * 0.95 + ms * 0.05 : ms; cost.n++;
    if (!cost.low && cost.n > 90 && cost.ema > 11 && api.quality !== 'low') { cost.low = true; api.quality = 'low'; stage.setQuality('low'); }
    return true;
  };
  api.frameCamera = frameCamera;
  // joint log for the anatomy gate: knee flexion, ankle plantar flexion (0 = foot at 90 degrees to the shin), foot yaw vs shin
  api.joints = () => {
    H.root.updateMatrixWorld(true);
    const P = (n) => H.bones[`Bip01_${n}`].getWorldPosition(new Vector3());
    const out = {};
    for (const s of ['L', 'R']) {
      const hip = P(`${s}_Thigh`), kn = P(`${s}_Calf`), an = P(`${s}_Foot`), toe = P(`${s}_Toe0`);
      const th = kn.clone().sub(hip), sh = an.clone().sub(kn), ft = toe.clone().sub(an);
      const ang = (a, b) => Math.acos(clamp(a.clone().normalize().dot(b.clone().normalize()), -1, 1)) / D2R;
      const gq = new THREE.Quaternion(), mf = new Vector3(0, 0, 1), mu = new Vector3(0, 1, 0);
      out[s] = { meshToeDown: +(Math.atan2(-mf.y, Math.hypot(mf.x, mf.z)) / D2R).toFixed(4), meshYaw: +(Math.atan2(mf.z, mf.x) / D2R).toFixed(1), soleUpY: +mu.y.toFixed(2), kneeFlex: +ang(th, sh).toFixed(4), shinLen: +sh.length().toFixed(3), thighLen: +th.length().toFixed(3), footVsShin: +ang(sh, ft).toFixed(1), footDownDeg: +(Math.atan2(-ft.y, Math.hypot(ft.x, ft.z)) / D2R).toFixed(1),
        shinYaw: +(Math.atan2(sh.z, sh.x) / D2R).toFixed(1), footYaw: +(Math.atan2(ft.z, ft.x) / D2R).toFixed(1), ankle: [an.x, an.y, an.z].map((x) => +x.toFixed(5)), knee: [kn.x, kn.y, kn.z].map((x) => +x.toFixed(3)) };
    }
    return out;
  };
  return api;
}

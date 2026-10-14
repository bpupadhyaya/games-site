// Beach Flags: real 3D people for the picture (presentation only: it reads runner fields of the sim, never writes back).
//
// platform/view3d supplies the person (athlete_m / athlete_f), the stage and the IK. This file authors the beach-sprint motion on the
// skeleton: face-down start with the head towards the camera, the caution flinch, the spin-up, the mocap sprint (speed matched to the
// sim), the dive and belly slide for the baton, the get-up with the baton held high, and the beaten walk-off. Everything is drawn into an
// off-screen WebGL canvas with a camera that matches src/art.js's pinhole exactly, then composited onto the 2D picture.
import { createStage, loadHuman, Clip, CLIP_BONES, semanticRot, THREE } from '../vendor3d/index.js';

const { Vector3, Quaternion, Euler } = THREE;
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const easeOut = (u) => 1 - (1 - u) * (1 - u);
const bi = (n) => CLIP_BONES.indexOf(`Bip01_${n}`);
const FLAG_COLS = ['#ff7a1a', '#e8503a', '#ffd23d', '#2fb67a', '#2f8fd6', '#a05cf0', '#ff5fa8'];
const UP = new Vector3(0, 1, 0), RIGHT = new Vector3(1, 0, 0);

export const RISE_T = 0.42, DIVE_T = 0.5, SLIDE_T = 0.45, FLINCH_T = 0.55;
const PELVIS = 0.9;               // pelvis height of the shipped athlete (m)
const BODY_HALF = 0.13;           // half the chest depth: how far the pelvis sits above the sand when lying down

// ---- the baton ------------------------------------------------------------------------------------------------------------------------
function makeBaton() {
  const g = new THREE.Group();
  const L = 0.62, r = 0.021;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 14), new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.45 }));
  body.position.y = L / 2 - 0.2;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.04, 0.1, 14), new THREE.MeshStandardMaterial({ color: 0xfff6e0, roughness: 0.5 }));
  band.position.y = L * 0.72 - 0.2;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 1.15, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfff6e0, roughness: 0.5 }));
  cap.position.y = L - 0.2;
  g.add(body, band, cap);
  return g;
}

// ---- one person with a hand-posed clip ------------------------------------------------------------------------------------------------
class Person {
  constructor(human, idx) {
    this.h = human; this.idx = idx;
    this.clip = new Clip({ name: 'pose', frames: 1, dur: 1 / 30, fps: 30, loop: true, quats: new Float32Array(CLIP_BONES.length * 4), pelvis: new Float32Array(3), grounded: false, fingers: 'relaxed' });
    human.addClip(this.clip);
    this.restQ = new Float32Array(human.restPose.q);
    this.e = new Euler(); this.qa = new Quaternion(); this.qb = new Quaternion();
    this.ph = human.pelvisHeight;
    this.mode = '';
    this.lastLook = ''; this.lod = -1; this.seen = false;
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
  usePose() { if (this.mode !== 'pose') { this.mode = 'pose'; this.h.groundClamp = 'off'; this.h.footPlanting = false; this.h.play(this.clip, { fade: 0.08 }); } }
  useClip() { if (this.mode !== 'clip') { this.mode = 'clip'; this.h.groundClamp = 'auto'; this.h.footPlanting = true; } }
}

// ---- swim cap on the head bone --------------------------------------------------------------------------------------------------------
// The shipped heads carry no skinned extents we can read, so the dome is sized to the athlete head by hand (half width, height, depth in
// metres) and expressed in the head bone's own axes through boneFrame (the rig's local +X runs up the head).
function addSwimCap(human) {
  const head = human.bones.Bip01_Head;
  const f = human.boneFrame('Head');
  const m = new THREE.Matrix4().makeBasis(f.left.clone().normalize(), f.up.clone().normalize(), f.fwd.clone().normalize());
  const q = new Quaternion().setFromRotationMatrix(m);
  const g = new THREE.Group(); g.quaternion.copy(q);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffc83d, roughness: 0.32, metalness: 0.0 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.64), mat);
  dome.scale.set(CAP.w, CAP.h, CAP.d); dome.rotation.x = CAP.tilt;
  g.add(dome);
  g.position.copy(f.up).multiplyScalar(CAP.up).addScaledVector(f.fwd, CAP.fwd);
  head.add(g);
  return mat;
}
const CAP = { w: 0.094, h: 0.128, d: 0.124, up: 0.12, fwd: -0.012, tilt: 0.34 };

// Bare feet: this is a barefoot sport and the shipped athlete wears running shoes, so each foot gets a skin-coloured foot that covers the shoe
// (an ellipsoid from the ankle to the toes, plus a heel), sized from the foot bone's own frame.
function addBareFeet(human) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xc68b5a, roughness: 0.62 });
  for (const s of ['L', 'R']) {
    const foot = human.bones[`Bip01_${s}_Foot`], toe = human.bones[`Bip01_${s}_Toe0`];
    human.root.updateMatrixWorld(true);
    // built in WORLD terms at the rest pose (ankle position, direction to the toe, level), then expressed in the foot bone's space with the
    // inverse of its world matrix, so mirrored or rolled bone axes cannot flip it
    const ankW = foot.getWorldPosition(new Vector3()), toeW = toe.getWorldPosition(new Vector3());
    const fwW = toeW.sub(ankW); fwW.y = 0; fwW.normalize();
    const worldQ = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), fwW);
    const desired = new THREE.Matrix4().compose(ankW, worldQ, new Vector3(1, 1, 1));
    const g = new THREE.Group();
    g.matrixAutoUpdate = false;
    g.matrix.copy(foot.matrixWorld).invert().multiply(desired);
    const top = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mat); top.scale.set(0.054, 0.068, 0.13); top.position.set(0, -0.054, 0.035);
    const heel = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat); heel.scale.set(0.044, 0.042, 0.075); heel.position.set(0, -0.082, 0.16);
    const back = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat); back.scale.set(0.044, 0.056, 0.06); back.position.set(0, -0.062, -0.065);
    const sole = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), mat); sole.scale.set(0.05, 0.036, 0.13); sole.position.set(0, -0.092, 0.045);
    g.add(top, heel, back, sole);
    foot.add(g);
  }
  return mat;
}

// ---------------------------------------------------------------------------------------------------------------------------------------
export async function createRacers({ quality = 'medium', runners = 8, crowd = 10 } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: true, shadows: false, lighting: 'day' });
  if (!stage.supported) return null;
  stage.setSky(null, null);
  stage._shadowOffset.set(6, 10, 6);
  stage.setShadowTarget(0, 0, -8);
  const base = { character: 'athlete_m', kit: { top: '#f4f1e6', bottoms: '#1c3d73', socks: '#c68b5a' }, skin: '#c68b5a', hair: 'black', lod: 'auto' };
  const people = [];
  for (let i = 0; i < runners; i++) {
    // alternate the two shipped athletes so the field is not eight clones; the look (skin, hair, kit) is applied per round
    const h = await loadHuman({ ...base, character: i % 3 === 1 ? 'athlete_f' : 'athlete_m' });
    const p = new Person(h, i);
    p.cap = addSwimCap(h); p.feet = addBareFeet(h);
    p.baton = makeBaton(); h.attach(p.baton, 'R', 'bat'); p.baton.visible = false; h.setFingers('R', 'auto');
    stage.add(h); stage.track(h); h.root.visible = false;
    people.push(p);
  }
  const specs = [];
  for (let i = 0; i < crowd; i++) {
    const h = await loadHuman({ ...base, character: i % 2 ? 'athlete_f' : 'athlete_m', kit: { top: '#e9eef2', bottoms: '#2a2f3a', socks: '#c68b5a' } });
    const p = new Person(h, i); p.spec = true;
    stage.add(h); stage.track(h); h.root.visible = false;
    p.feet = addBareFeet(h);
    h.play(['idle_relaxed', 'clap', 'cheer', 'idle'][i % 4], { fade: 0 });
    specs.push(p);
  }
  const api = { stage, people, specs, quality, ok: true, lost: false, fitted: { w: 0, h: 0, key: '' } };
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { api.lost = false; api.fitted.w = 0; });
  return Object.assign(api, makeApi(api));
}

function makeApi(api) {
  const { stage, people, specs } = api;
  const cam3 = stage.camera, renderer = stage.renderer;
  const v = new Vector3(), v2 = new Vector3(), v3 = new Vector3();
  const qHand = new Quaternion(), qWant = new Quaternion();
  const qYaw = new Quaternion(), qPitch = new Quaternion(), qRoot = new Quaternion();
  const cost = { ema: 0, n: 0 };

  // The 2D picture's pinhole (src/art.js proj): x_px = cx + (X - camX) * F / zr, y_px = yh + (camH - Y) * F / zr, zr = z - camZ.
  // The 3D camera sits at (0, camH, 0) looking down -Z; sim (x, y, z) maps to three (x - camX, y, -(z - camZ)).
  function fitCamera(rc, c) {
    const w = rc.w, h = rc.h, F = c.F, ox = (2 * (c.cx - rc.x)) / w - 1, oy = 1 - (2 * (c.yh - rc.y)) / h, n = 0.25, f = 140;
    cam3.projectionMatrix.set(
      (2 * F) / w, 0, -ox, 0,
      0, (2 * F) / h, -oy, 0,
      0, 0, -(f + n) / (f - n), (-2 * f * n) / (f - n),
      0, 0, -1, 0);
    cam3.projectionMatrixInverse.copy(cam3.projectionMatrix).invert();
    cam3.position.set(0, c.camH, 0); cam3.rotation.set(0, 0, 0); cam3.near = n; cam3.far = f;
    cam3.updateMatrixWorld(true);
  }

  // place a person by its pelvis anchor (world three coords), yaw (three), pitch (rad, + = face down)
  function place(p, ax, ay, az, yaw, pitch) {
    const h = p.h;
    qYaw.setFromAxisAngle(UP, yaw); qPitch.setFromAxisAngle(RIGHT, pitch);
    qRoot.copy(qYaw).multiply(qPitch);
    v.set(0, PELVIS, 0).applyQuaternion(qRoot);
    h.root.position.set(ax - v.x, ay - v.y, az - v.z);
    h.root.quaternion.copy(qRoot); h.facing = yaw;
  }
  // a point in the person's frame (right-handed: +x = its left, +y up, +z the way it faces when upright) relative to the pelvis anchor, yawed only
  const yawPt = (ax, ay, az, yaw, lx, ly, lz, out) => out.set(lx, ly, lz).applyAxisAngle(UP, yaw).add(v3.set(ax, ay, az));

  // ---- the posing of one runner --------------------------------------------------------------------------------------------------
  // r = { x, y, z (three coords), yaw, q: the sim runner, dt, t, nearest: { x, z } | null (flag the hands are heading for) }
  function poseRunner(p, r) {
    const h = p.h, q = r.q, dt = r.dt, t = r.t, yawOff = r.yawOff || 0;
    const ph = q.phase;
    const hold = q.flag >= 0;
    let ax = r.x, az = r.z, yaw = Math.PI, pitch = 0, ay = PELVIS;
    const off = {};
    let reachR = null, reachL = null, poleR = null, poleL = null;
    const breath = Math.sin(t * 2.6 + p.idx * 1.7);
    p.baton.visible = hold;
    if (hold && p.batonId !== q.flag) { p.batonId = q.flag; p.baton.children[0].material.color.set(FLAG_COLS[q.flag % FLAG_COLS.length]); }
    p.vs = lerp(p.vs ?? q.v ?? 0, q.v || 0, 1 - Math.exp(-dt * 10));     // smoothed ground speed for the stride cadence
    const lean = (p.lean = lerp(p.lean || 0, clamp((q.lat || 0) / 3, -1, 1), 1 - Math.exp(-dt * 8)));

    if (ph === 'prone' || ph === 'flinch' || ph === 'down' || ph === 'slide' || ph === 'dive' || ph === 'spin' || (ph === 'hold' && q.diveGrab && q.pt < 0.58)) {
      p.usePose();
      // base lying pose; head towards three yaw (towards the camera at the start line; towards the flags after a dive)
      let lie = 1, chest = 0, air = 0, tuck = 0, stretch = 0;
      if (ph === 'prone' || ph === 'flinch') yaw = 0;
      if (ph === 'prone') { chest = 0.1 + 0.05 * breath; }
      else if (ph === 'flinch') { const k = Math.sin(Math.min(1, q.pt / 0.35) * Math.PI); chest = 0.1 + 0.9 * k; }
      else if (ph === 'down') { chest = 0.5 + 0.3 * Math.min(1, q.pt / 0.3) + 0.05 * breath; }
      else if (ph === 'slide') { chest = 0.45 + 0.25 * easeOut(Math.min(1, q.pt / SLIDE_T)); stretch = 1; }
      else if (ph === 'dive') {
        const u = clamp(q.pt / DIVE_T, 0, 1);
        const takeoff = ease(clamp(u / 0.4, 0, 1));
        lie = 0.1 + 0.9 * takeoff;                    // run lean -> horizontal
        air = Math.sin(Math.PI * clamp(u * 0.95 + 0.02, 0, 1));
        stretch = 1; chest = 0.3;
      } else if (ph === 'hold') {
        lie = 1 - ease(clamp((q.pt - 0.05) / 0.5, 0, 1)); stretch = 1 - ease(clamp(q.pt / 0.4, 0, 1)); chest = 0.7;
      } else if (ph === 'spin') {
        const u = clamp(q.pt / RISE_T, 0, 1);
        // three beats, as in the real start: (1) hands press the sand and the chest lifts (push-up), (2) the hips pivot round to a low
        // crouch with the knees drawn in, (3) the drive up out of the crouch into the sprint lean
        const b1 = ease(clamp(u / 0.28, 0, 1)), b2 = ease(clamp((u - 0.2) / 0.5, 0, 1)), b3 = ease(clamp((u - 0.62) / 0.38, 0, 1));
        lie = 1 - 0.12 * b1 - 0.5 * b2 - 0.38 * b3;
        tuck = clamp(b1 * 0.5 + b2 * 0.6, 0, 1) * (1 - b3 * 0.7); chest = 0.4 + 0.5 * b1;
        // turn on the spot (the pivot belongs to beat 2), unless the runner was already facing the flags (after a dive)
        if (!q.stand) yaw = Math.PI * b2;
      }
      const runLean = 18 * D2R;
      pitch = lerp(runLean, 90 * D2R, lie);
      // pelvis height: feet stay on the sand while rising; in the air a dive floats
      ay = PELVIS * Math.cos(pitch) + BODY_HALF * Math.sin(pitch) * (1 - 0.0);
      if (ph === 'dive') ay += 0.12 + 0.62 * air;
      if (ph === 'slide') ay = BODY_HALF + 0.02;
      if (ph === 'hold' && lie > 0.02) ay = PELVIS * Math.cos(pitch) + BODY_HALF * Math.sin(pitch);
      // body posture offsets
      const arch = chest * (ph === 'flinch' || ph === 'down' || ph === 'slide' ? 1 : 0.7);
      off.Spine = { flex: -10 * arch }; off.Spine1 = { flex: -12 * arch }; off.Spine2 = { flex: -10 * arch };
      off.Neck = { flex: -14 - 10 * arch }; off.Head = { flex: -10 - 6 * arch };
      const knee = 8 + 62 * tuck + (ph === 'dive' ? 30 : 0) + (ph === 'prone' ? 6 + 2 * breath : 0);
      off.R_Calf = { flex: knee }; off.L_Calf = { flex: knee };
      off.R_Thigh = { flex: -4 + 38 * tuck + (ph === 'dive' ? -14 : 0), abduct: ph === 'prone' || ph === 'flinch' ? -2 : 4 }; off.L_Thigh = { flex: -4 + 38 * tuck + (ph === 'dive' ? -14 : 0), abduct: ph === 'prone' || ph === 'flinch' ? -2 : 4 };
      // hands: beside the shoulders on the sand, or stretched forward to the baton
      const sh = PELVIS * 0.62;                        // shoulder distance from the pelvis along the body when lying (m)
      const fwd = (d) => d;                            // distance along the body axis (head direction)
      const lieDir = Math.sin(pitch), upDir = Math.cos(pitch);
      const along = (d, side, hgt) => yawPt(ax, 0, az, yaw, side, hgt, d, v2).clone();
      void fwd; void lieDir; void upDir; void sh;
      if (ph === 'dive' || ph === 'slide' || (ph === 'hold' && lie > 0.02)) {
        const tx = r.nearest ? r.nearest.x : r.x, tz = r.nearest ? r.nearest.z : r.z - 1.2;
        const ext = Math.hypot(tx - r.x, tz - r.z);
        const dir = ext > 0.25 ? Math.atan2(tx - r.x, tz - r.z) : Math.PI;
        // hands at the baton (or at full stretch past the pelvis), low, shoulder width apart
        const reach = clamp(ext, 0.7, 1.25);
        const hy = hold ? 0.32 : 0.28 + 0.1 * air;
        reachR = new Vector3(r.x, 0, r.z).add(new Vector3(0.11 * Math.cos(dir), hy + 0.45 * air * lie, -0.11 * Math.sin(dir))).add(new Vector3(Math.sin(dir), 0, Math.cos(dir)).multiplyScalar(reach));
        reachL = reachR.clone().add(new Vector3(-0.22 * Math.cos(dir), 0, 0.22 * Math.sin(dir)));
        if (hold && ph === 'hold') {
          // after the catch the baton comes up with the get-up
          const k = ease(1 - clamp(lie / 0.6, 0, 1)); reachR.y = lerp(reachR.y, 1.95, k); reachR.x = lerp(reachR.x, r.x + 0.26, k); reachR.z = lerp(reachR.z, r.z - 0.1, k);
        }
        poleR = new Vector3(r.x + 0.5, hy + 0.5, r.z + 0.15); poleL = new Vector3(r.x - 0.5, hy + 0.5, r.z + 0.15);
      } else if (ph !== 'spin') {
        const lift = 0.04 + 0.22 * chest;
        if (ph === 'prone' || ph === 'flinch') {
          // the real waiting position: face down, forehead resting on the stacked hands, elbows tucked, legs together
          reachR = along(0.8, -0.07, 0.06 + 0.2 * chest); reachL = along(0.8, 0.07, 0.09 + 0.2 * chest);
          poleR = along(0.52, -0.36, 0.12 + 0.2 * chest); poleL = along(0.52, 0.36, 0.12 + 0.2 * chest);
        } else {
          const s0 = 0.62, s1 = s0 + 0.16;
          reachR = along(s1, -0.22, lift); reachL = along(s1, 0.22, lift);
          poleR = along(s0 - 0.05, -0.5, 0.28 + 0.15 * chest); poleL = along(s0 - 0.05, 0.5, 0.28 + 0.15 * chest);
        }
      } else {
        // spin: hands push off beside the chest and swing through
        const u = clamp(q.pt / RISE_T, 0, 1);
        const k = 1 - ease(clamp(u * 1.6, 0, 1));
        if (k > 0.02) {
          // palms flat on the sand beside the chest, pressing, then lifting off as the body comes round
          reachR = along(0.62 + 0.1 * (1 - k), -0.3, 0.03 + 0.35 * (1 - k)); reachL = along(0.62 + 0.1 * (1 - k), 0.3, 0.03 + 0.35 * (1 - k));
          poleR = along(0.5, -0.5, 0.3); poleL = along(0.5, 0.5, 0.3);
        }
      }
      place(p, ax, ay, az, yaw + yawOff, pitch);
      p.writePose(off, [0, 0, 0]);
      // running arms for the second half of the spin-up, with the sprint clip crossfaded in at the very end
      if (ph === 'spin' && q.pt > RISE_T * 0.62) { /* the lean has gone: the next phase starts the sprint clip */ }
    } else {
      // upright: run, hold, beaten, idle
      const moving = (q.v || 0) > 1.5 || (ph === 'run');
      p.useClip();
      if (moving) {
        const sp = Math.max(p.vs, 0.8);
        h.locomote(sp, { fade: 0.18 });
        // lean into the run a little more at pace and bank into a steering stride
        pitch = clamp((sp - 2) / 9, 0, 1) * 8 * D2R;
        yaw = Math.PI - Math.atan2(q.lat || 0, Math.max(3, sp)) * 0.9;
      } else {
        h.ensure(ph === 'beaten' ? 'idle_relaxed' : 'idle', { fade: 0.25 });
      }
      place(p, ax, PELVIS * Math.cos(pitch), az, yaw + yawOff, pitch);
      void lean;
      // the baton arm: held up high (run with a flag, standing with it)
      if (hold) {
        const hi = moving ? 1.62 + 0.03 * Math.sin(t * 9) : 1.98 + 0.04 * Math.sin(t * 5 + p.idx);
        reachR = yawPt(ax, 0, az, yaw, -0.26, hi, 0.12, new Vector3());
        poleR = yawPt(ax, 0, az, yaw, -0.58, hi - 0.35, -0.05, new Vector3());
        if (!moving) {
          // a fist pumped on the other side
          reachL = yawPt(ax, 0, az, yaw, 0.30 + 0.04 * Math.sin(t * 6), 1.55 + 0.1 * Math.sin(t * 6 + 1), 0.1, new Vector3());
          poleL = yawPt(ax, 0, az, yaw, 0.6, 1.2, -0.05, new Vector3());
        }
      } else if (ph === 'beaten' && !moving) {
        // out of the round: hands on the hips, head down
        reachR = yawPt(ax, 0, az, yaw, -0.22, 0.96, -0.02, new Vector3()); poleR = yawPt(ax, 0, az, yaw, -0.62, 1.1, -0.1, new Vector3());
        reachL = yawPt(ax, 0, az, yaw, 0.22, 0.96, -0.02, new Vector3()); poleL = yawPt(ax, 0, az, yaw, 0.62, 1.1, -0.1, new Vector3());
      }
    }
    if (yawOff) for (const vv of [reachR, poleR, reachL, poleL]) if (vv) { vv.x -= ax; vv.z -= az; vv.applyAxisAngle(UP, yawOff); vv.x += ax; vv.z += az; }
    p.dbg = { reachR: reachR && reachR.toArray(), pole: poleR && poleR.toArray(), pel: [ax, ay, az] };
    if (reachR) h.setReach('R', reachR, { weight: 1, pole: poleR }); else h.setReach('R', null);
    if (reachL) h.setReach('L', reachL, { weight: 1, pole: poleL }); else h.setReach('L', null);
    if (hold) h.setFingers('R', 'batGrip');
  }

  // a spectator on the side: it = { x, y, z, face (three yaw), mood 0..3, phase, scale, top, bottoms, skin, hair }
  function poseSpec(sp, it, t) {
    const h = sp.h;
    h.groundClamp = 'auto'; h.footPlanting = false;
    const want = ['idle_relaxed', 'clap', 'cheer', 'celebrate_2'][it.mood % 4];
    if (sp.want !== want) { sp.want = want; h.play(want, { fade: 0.25, startTime: (it.phase * 0.37) % 1.5 }); }
    h.root.position.set(it.x, it.y, it.z); h.root.rotation.set(0, it.face, 0); h.facing = it.face;
    h.root.scale.setScalar(it.scale || 1);
    void t;
  }

  const LIGHT_DAY = { hemi: 0.7, keyI: 2.6, rimI: 1.2 };
  stage.setLighting('day', LIGHT_DAY); stage.setSky(null, null);

  /**
   * Draw people into the 2D picture. c: the sim camera ({ rect, cx, yh, F, camH, camX, camZ, pm }), rc: the pixel rect to cover (usually c.rect),
   * runners: [{ id, q, x, z, yaw, look, nearest }], crowd: [{ x, z, face, mood, phase, top, bottoms, skin, hair }], t: seconds.
   * Returns the set of runner ids drawn in 3D (null when the 3D layer cannot draw: the caller paints its 2D figures).
   */
  api.draw = function (ctx, c, rc, runners, crowd, t) {
    if (api.lost || stage.contextLost || !stage.supported) return null;
    const t0 = globalThis.performance.now();
    const m = ctx.getTransform();
    const pxPerUnit = Math.hypot(m.a, m.b) || 1;
    const devW = clamp(Math.round(rc.w * pxPerUnit), 120, 1100), devH = Math.max(60, Math.round((devW * rc.h) / rc.w));
    if (api.fitted.w !== devW || api.fitted.h !== devH) { renderer.setPixelRatio(1); renderer.setSize(devW, devH, false); api.fitted.w = devW; api.fitted.h = devH; }
    fitCamera(rc, c);
    const heightPx = 1.75 * (c.F / 8) * (devW / rc.w);
    const lod = c.hq ? 0 : heightPx < 105 ? 2 : heightPx < 240 ? 1 : 0;
    const drawn = new Set();
    for (const p of people) p.h.root.visible = false;
    for (const s of specs) s.h.root.visible = false;
    const tx = (x) => x - c.camX, tz = (z) => -(z - c.camZ);
    runners.forEach((r, i) => {
      const p = people[r.slot ?? i];
      if (!p) return;
      const dt = p.t0 === undefined ? 0 : clamp(t - p.t0, 0, 0.1); p.dt = dt; p.t0 = t;
      p.h.root.visible = true;
      const look = r.look;
      if (p.lastLook !== look.key) {
        p.lastLook = look.key;
        p.h.setKit({ top: look.top, bottoms: look.bot, socks: look.socks ?? look.skin, shoes: look.shoes ?? look.skin });
        p.h.setSkin(look.skin); p.h.setHair(look.hair);
        p.cap.color.set(look.cap); p.feet.color.set(look.skin);
      }
      if (p.lod !== lod) { p.lod = lod; p.h.setLOD(lod); }
      const sx = tx(r.x), sz = tz(r.z);
      poseRunner(p, {
        x: sx, z: sz, q: r.q, dt: p.dt, t, yawOff: r.yawOff,
        nearest: r.nearest ? { x: tx(r.nearest.x), z: tz(r.nearest.z) } : null,
      });
      drawn.add(r.id);
    });
    crowd.forEach((s, i) => {
      const sp = specs[i];
      if (!sp) return;
      sp.h.root.visible = true;
      if (sp.lastLook !== s.key) { sp.lastLook = s.key; sp.h.setKit({ top: s.top, bottoms: s.bottoms, socks: s.skin, shoes: s.skin }); sp.h.setSkin(s.skin); sp.h.setHair(s.hair); sp.feet.color.set(s.skin); }
      if (sp.lod !== lod) { sp.lod = lod; sp.h.setLOD(lod); }
      poseSpec(sp, { x: tx(s.x), y: 0, z: tz(s.z), face: s.face, mood: s.mood, phase: s.phase, scale: s.scale || 1 }, t);
    });
    for (const p of people) if (p.h.root.visible) p.h.update(p.dt || 0);
    const sdt = specs.length && specs[0].t0 !== undefined ? clamp(t - specs[0].t0, 0, 0.1) : 0;
    for (const s of specs) { if (s.h.root.visible) s.h.update(sdt); s.t0 = t; }
    // second pass: hands and feet were targeted with the pre-update skeleton; settle again with zero time
    for (const p of people) if (p.h.root.visible) p.h.update(0);
    // the baton always stands up in the fist (the grip frame alone would lay it across the forearm): set its world orientation, then
    // express it in the hand's space
    for (const p of people) {
      if (!p.h.root.visible || !p.baton.visible) continue;
      const hand = p.h.bones.Bip01_R_Hand;
      hand.updateWorldMatrix(true, false);
      hand.getWorldQuaternion(qHand);
      qWant.setFromUnitVectors(UP, v.set(0, 0.94, -0.34).normalize());
      p.baton.quaternion.copy(qHand.invert().multiply(qWant));
      p.baton.updateMatrixWorld(true);
    }
    stage.render();
    ctx.drawImage(renderer.domElement, rc.x, rc.y, rc.w, rc.h);
    const ms = globalThis.performance.now() - t0;
    cost.ema = cost.n ? cost.ema * 0.95 + ms * 0.05 : ms; cost.n++;
    if (cost.n > 90 && cost.ema > 14 && api.quality !== 'low') { api.quality = 'low'; stage.setQuality('low'); }
    return drawn;
  };
  return {};
}

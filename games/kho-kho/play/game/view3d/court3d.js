// Kho-Kho in real 3D (presentation only: reads the batch the simulation owns, never writes back).
//
// World: METRES, real size. The court is the engine court scaled by PW court units per metre (people are 1.75 m tall, the poles 1.2 m, the
// court is drawn K times smaller than a real one so the players read on a phone). x is right, z is down the screen in portrait.
// Camera: an OBLIQUE projection keeps the ground's exact top-down mapping (taps, 2D markers and layout are unchanged) while everything that
// stands up is drawn with its real height. A true perspective camera is used for the title hero and for the store icon.
// Order each frame: advance the figures, THEN pose / reach overrides, THEN render (no prop is held, but the rule is kept).
import { createStage, loadHuman, Clip, CLIP_BONES, semanticRot, createCrowd3d, THREE } from '../vendor3d/index.js';
import { COURT, SEAT_Y, POLE_Y } from '../src/engine.js';
import { courtTexture, puffSprite, skyTexture, CW, CH } from './ground.js';
import { buildVillage } from './village.js';

const { Vector3, Quaternion, Euler } = THREE;
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const PXM = 38;                 // engine court units per real metre
export const K = 1.7;                  // the court is drawn this much smaller than a real one (players stay real size)
export const PW = PXM * K;             // court units per world metre
const COS = 0.8;                       // an oblique metre of height is this many ground metres on screen
const SP = COURT.spine;
const bi = (n) => CLIP_BONES.indexOf(`Bip01_${n}`);

const KIT_CHASE = { top: '#17b3a8', bottoms: '#0d3f5c', socks: '#f2f2f2' };
const KIT_RUN = { top: '#f2703a', bottoms: '#f4efe4', socks: '#f2f2f2' };
const SKINS = ['#d99a6c', '#c58a5c', '#a96f45', '#e3ad80', '#8d5a36', '#f0be92'];
const HAIRS = ['#15100c', '#1f1510', '#2b1b12', '#15100c', '#3a2616', '#15100c'];
// gaits: the shipped clips and the ground speed (m/s) each one covers per cycle; thresholds have hysteresis so the clip never flaps
const GAITS = [{ n: 'ready_stance', v: 0 }, { n: 'walk', v: 1.33 }, { n: 'jog', v: 2.6 }, { n: 'sprint', v: 4.95 }];   // v = measured stance-foot speed of the shipped clips on our athletes (dev/gait.html), not the metadata
const UP = [0.3, 2.0, 3.8], DOWN = [0.12, 1.7, 3.3];
const SIT = { Pelvis: [10, 0], Spine: [4, 0], Spine1: [4, 0], Spine2: [2, 0], Head: [-4, 0], L_Thigh: [104, 8], R_Thigh: [104, 8], L_Calf: [128, 0], R_Calf: [128, 0], L_UpperArm: [38, 6], R_UpperArm: [38, 6], L_Forearm: [30, 0], R_Forearm: [30, 0] };

// ---------------------------------------------------------------------------------------------------------------------------------
// One person: a seated chaser, the standing chaser or a runner. The same figure can sit, rise and run, so a Kho is a real hand-over.
class Player {
  constructor(human, o = {}) {
    this.h = human; this.id = o.id ?? 0; this.role = o.role ?? 'chase';
    human.turnRate = 9;
    // a procedural pose clip (squat, rise): its quaternions are rewritten every frame
    this.clip = new Clip({ name: 'sitpose', frames: 1, dur: 1 / 30, fps: 30, loop: true, quats: new Float32Array(CLIP_BONES.length * 4), pelvis: new Float32Array(3), grounded: false, fingers: 'relaxed' });
    human.addClip(this.clip);
    this.restQ = new Float32Array(human.restPose.q);
    this.e = new Euler(); this.qa = new Quaternion(); this.qb = new Quaternion();
    this.ph = human.pelvisHeight;
    this.mode = 'free'; this.s = 0; this.seatIdx = -1; this.tt = 0;
    this.first = true; this.px = 0; this.pz = 0; this.vx = 0; this.vz = 0; this.speed = 0; this.heading = 0;
    this.gait = 0; this.rate = 1; this.clipName = ''; this.puffT = 0; this.divingT = 0; this.touch = 0; this.hitT = 0;
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

// ---------------------------------------------------------------------------------------------------------------------------------
export async function createCourt3D({ quality = 'medium', base } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: false, shadows: quality !== 'low', lighting: 'evening', shadowSize: 12 });
  if (!stage.supported) return null;
  const renderer = stage.renderer, cam = stage.camera, scene = stage.scene;
  cam.position.set(0, 0, 0); cam.rotation.set(0, 0, 0); cam.updateMatrixWorld(true);
  const api = { stage, ok: true, lost: false, quality, ready: false, tune: { footPlant: false, turnRate: 22, velTau: 0.03, maxFootDrag: 0.3, heroP: { pos: [2.0, 1.5, 6.2], tgt: [-0.2, 1.2, -2.2], fov: 50, drift: 1.0 }, heroL: { pos: [-4.6, 3.0, 7.0], tgt: [0.6, 1.0, 0.2], fov: 38, drift: 1.2 } } };
  let sized = { w: 0, h: 0 };
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { api.lost = false; sized = { w: 0, h: 0 }; });

  // ---- light: a floodlit dusk. Key low from the far upper left so shadows fall towards the viewer; cool rim from the right.
  stage.setLighting('evening', { hemi: 0.62, hemiSky: '#ffe3c0', hemiGround: '#5a3e30', key: '#ffcf96', keyI: 3.1, rim: '#8fb0ff', rimI: 1.35, exposure: 1.05 });
  stage.setSky('#1a1d40', null);
  stage._shadowOffset.set(-7.5, 12, -5.5);
  stage.setShadowTarget(0, 0, 0);
  stage.lights.key.shadow.camera.far = 50; stage.lights.key.shadow.camera.updateProjectionMatrix();
  scene.fog = null;

  // ---- a dusk sky ring, shown only in the perspective views (title hero, icon)
  const skyTex = new THREE.CanvasTexture(skyTexture()); skyTex.colorSpace = THREE.SRGBColorSpace; skyTex.wrapS = THREE.RepeatWrapping;
  const sky = new THREE.Mesh(new THREE.CylinderGeometry(78, 78, 70, 48, 1, true), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, toneMapped: false, fog: false, depthWrite: false }));
  sky.position.y = 24; sky.visible = false; sky.renderOrder = -10; scene.add(sky);

  // ---- ground + village
  const half = { x: (COURT.x1 - COURT.x0) / 2 / PW, z: (COURT.y1 - COURT.y0) / 2 / PW };
  const village = buildVillage({ half, quality });
  scene.add(village.group);
  const mkTex = (img) => { const t = new THREE.CanvasTexture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  const courtTex = mkTex(courtTexture(quality === 'low' ? 1.4 : 2));
  const gw = CW / PW, gh = CH / PW;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), new THREE.MeshLambertMaterial({ map: courtTex, transparent: true, alphaTest: 0.01, color: '#ffe9d6' }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0.003; ground.receiveShadow = true; scene.add(ground);
  const OV = 0.8;
  const ovCanvas = globalThis.document.createElement('canvas'); ovCanvas.width = Math.round(CW * OV); ovCanvas.height = Math.round(CH * OV);
  const ovCtx = ovCanvas.getContext('2d');
  const ovTex = new THREE.CanvasTexture(ovCanvas); ovTex.colorSpace = THREE.SRGBColorSpace; ovTex.generateMipmaps = false; ovTex.minFilter = THREE.LinearFilter;
  const ovMesh = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), new THREE.MeshBasicMaterial({ map: ovTex, transparent: true, depthWrite: false, toneMapped: false }));
  ovMesh.rotation.x = -Math.PI / 2; ovMesh.position.y = 0.012; scene.add(ovMesh);
  api.overlay = () => { ovCtx.setTransform(OV, 0, 0, OV, 0, 0); ovCtx.clearRect(0, 0, CW, CH); return ovCtx; };

  const wx = (X) => (X - CW / 2) / PW, wz = (Y) => (Y - CH / 2) / PW;

  // ---- the two end poles: seasoned timber, 1.2 m, a hand's breadth across (9 cm), chalk-white bands
  const woodMat = new THREE.MeshStandardMaterial({ color: '#b97a3c', roughness: 0.58, metalness: 0 });
  const bandMat = new THREE.MeshStandardMaterial({ color: '#f4efe0', roughness: 0.7 });
  const poles = [];
  for (const py of POLE_Y) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 1.2, 20), woodMat); post.position.y = 0.6;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 10), woodMat); cap.position.y = 1.2; cap.scale.y = 0.65;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0535, 0.0535, 0.07, 20), bandMat); band.position.y = 0.86;
    const band2 = band.clone(); band2.position.y = 0.5;
    const polish = new THREE.Mesh(new THREE.CylinderGeometry(0.0545, 0.0545, 0.22, 20), new THREE.MeshStandardMaterial({ color: '#8a5528', roughness: 0.3 })); polish.position.y = 1.02;
    g.add(post, cap, band, band2, polish);
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    g.position.set(wx(SP), 0, wz(py));
    scene.add(g); poles.push(g);
  }

  // ---- people
  const specFor = (kit, i, ch = 'athlete_m') => ({ character: ch, top: 'long', base, lod: 'auto', kit, skin: SKINS[((i % 6) + 6) % 6], hair: HAIRS[((i % 6) + 6) % 6] });
  const mk = async (kit, i, o = {}) => {
    const h = await loadHuman(specFor(kit, i, o.ch));
    h.setLOD(quality === 'low' ? 2 : 1); h.lodAuto = false;
    scene.add(h.root);
    h.root.traverse((m) => { if (m.isMesh || m.isSkinnedMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } });
    return new Player(h, o);
  };
  const SEATS = SEAT_Y.length;
  const seatP = await Promise.all(SEAT_Y.map((_, i) => mk(KIT_CHASE, i + 2, { id: i, role: 'chase', ch: i % 3 === 1 ? 'athlete_f' : 'athlete_m' })));
  const runners = await Promise.all([0, 1, 2].map((i) => mk(KIT_RUN, i, { id: 10 + i, role: 'run', ch: i === 1 ? 'athlete_f' : 'athlete_m' })));
  let active = await mk(KIT_CHASE, 4, { id: 20, role: 'chase', ch: 'athlete_m' });
  const activeOrig = active;
  const all = [...seatP, ...runners, active];
  runners.forEach((r, i) => r.h.setDecal(String(i + 1), { color: '#101028' }));
  active.h.setDecal('9', { color: '#ffffff' });
  // the umpire: white shirt, stands at the near sideline and watches the chaser
  const umpire = await mk({ top: '#f4f4f4', bottoms: '#2a2f3a', socks: '#f2f2f2' }, 1, { id: 30, role: 'ump', ch: 'athlete_m' });
  umpire.h.play('idle_relaxed', { fade: 0 });
  umpire.h.setPosition(wx(COURT.x0 - 26), 0, wz(COURT.y1 - 150)); umpire.h.setFacing(Math.PI / 2); umpire.h.turnRate = 4;
  for (const p of [...all, umpire]) p.h.update(0);

  const up = new Vector3(0, 1, 0), v = new Vector3(), v2 = new Vector3(), qy = new Quaternion();
  const toWorld = (P, l, u, f, out) => out.set(l, u, f).applyAxisAngle(up, P.h.facing).add(P.h.root.position);

  // squat / rise / sit weight `s` (1 = on the heels, 0 = standing)
  function poseSquat(P, t, s, lean = 0, armDrive = 0) {
    const h = P.h, breath = Math.sin(t * 2.1 + P.id * 1.3), k = s;
    const o = {};
    for (const n in SIT) o[n] = { flex: SIT[n][0] * k, abduct: SIT[n][1] * k };
    o.Pelvis.flex += lean * 0.35; o.Spine.flex += lean * 0.4; o.Spine1.flex += lean * 0.4;
    o.Neck = { flex: (-6 + breath * 1.2) * k };
    o.L_UpperArm.flex += armDrive * 30; o.R_UpperArm.flex -= armDrive * 30;
    P.writePose(o, [0, (0.30 - 0.895) * k + breath * 0.004 * k, -0.14 * k]);
    const w = smooth(0, 0.55, k);
    for (const side of ['L', 'R']) {
      const sg = side === 'L' ? 1 : -1;
      if (w > 0.001) { toWorld(P, sg * 0.13, h._ankleRest, 0.0, v); h.setReachFoot(side, v, w, qy.setFromAxisAngle(up, h.facing).multiply(h._restQ[`${side}_Foot`])); } else h.setReachFoot(side, null);
    }
  }
  // hands on the knees while squatting (the reach target follows the squat), released as the figure stands
  function seatHands(P, s) {
    const h = P.h;
    for (const side of ['L', 'R']) {
      const sg = side === 'L' ? 1 : -1;
      if (s > 0.05) {
        toWorld(P, sg * 0.19, 0.46 * s + 0.45 * (1 - s), 0.26 * s, v);
        toWorld(P, sg * 0.5, 0.62, -0.12, v2);                  // elbows out and a little back, as on a real squat
        h.setReach(side, v, { weight: smooth(0.05, 0.8, s), pole: v2 }); h.setFingers(side, 'relaxed');
      } else h.setReach(side, null);
    }
  }

  // ---- crowd: 3D spectators (south asian village) on benches and standing behind
  let crowd = null;
  const lodCam = new THREE.PerspectiveCamera(60, 1, 1, 200); lodCam.position.set(0, 30, 6); lodCam.lookAt(0, 0, 0); lodCam.updateMatrixWorld(true);
  const crowdPoints = () => {
    const pts = [], hx = village.hx, hz = village.hz, BO = village.benchOffset;
    const row = (n, a, c, fixed, along, yaw, seated, stag = 0) => { for (let i = 0; i < n; i++) { const t = (i + 0.5 + stag) / n, u = a + (c - a) * t; pts.push(along === 'x' ? { x: u, z: fixed, y: 0, yaw, seated } : { x: fixed, z: u, y: 0, yaw, seated }); } };
    const W = hx * 0.9, Hh = hz * 0.78;
    row(10, -W, W, -hz - BO, 'x', 0, 1); row(11, -W - 0.3, W + 0.3, -hz - BO - 0.85, 'x', 0, 0, 0.3);
    row(10, -W, W, hz + BO, 'x', Math.PI, 1); row(11, -W - 0.3, W + 0.3, hz + BO + 0.85, 'x', Math.PI, 0, 0.3);
    row(13, -Hh, Hh, -hx - BO, 'z', Math.PI / 2, 1); row(14, -Hh - 0.4, Hh + 0.4, -hx - BO - 0.85, 'z', Math.PI / 2, 0, 0.3);
    row(13, -Hh, Hh, hx + BO, 'z', -Math.PI / 2, 1); row(14, -Hh - 0.4, Hh + 0.4, hx + BO + 0.85, 'z', -Math.PI / 2, 0, 0.3);
    return pts;
  };
  if (quality !== 'low') {
    try {
      crowd = createCrowd3d({ scene, camera: lodCam }, {
        points: crowdPoints(), count: quality === 'high' ? 110 : 78, seed: 5, culture: 'south_asian', quality: quality === 'high' ? 'high' : 'medium',
        camera: lodCam, viewportHeight: 760, props: { flag: 0.0, phone: 0.12, child: 0.08 }, excitement: 0.35, kids: 0.16,
      });
      crowd.update(0, lodCam);
    } catch (e) { console.warn('crowd3d unavailable', e); crowd = null; }
  }

  // ---- dust / chalk puffs and sweat spray: a small sprite pool driven by the sim clock
  const puffTex = new THREE.CanvasTexture(puffSprite(64)); puffTex.colorSpace = THREE.SRGBColorSpace;
  const NP = quality === 'low' ? 24 : 72;
  const puffs = [];
  for (let i = 0; i < NP; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0, color: '#e8cfae', toneMapped: false }));
    s.visible = false; scene.add(s); puffs.push({ s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, g: 0, r0: 0.1, r1: 0.5, a: 0.5 });
  }
  let puffI = 0;
  function emit(x, y, z, o = {}) {
    const p = puffs[puffI++ % NP];
    p.life = p.max = o.life ?? 0.7; p.vx = o.vx ?? 0; p.vy = o.vy ?? 0.35; p.vz = o.vz ?? 0; p.g = o.g ?? 0; p.r0 = o.r0 ?? 0.12; p.r1 = o.r1 ?? 0.5; p.a = o.a ?? 0.5;
    p.s.position.set(x, y, z); p.s.material.color.set(o.color ?? '#e8cfae'); p.s.visible = true; p.s.scale.set(p.r0, p.r0, 1);
  }
  function stepPuffs(dt) {
    for (const p of puffs) {
      if (p.life <= 0) continue;
      p.life -= dt; if (p.life <= 0) { p.s.visible = false; continue; }
      const k = 1 - p.life / p.max;
      p.vy += p.g * dt;
      p.s.position.x += p.vx * dt; p.s.position.y = Math.max(0.02, p.s.position.y + p.vy * dt); p.s.position.z += p.vz * dt;
      const r = p.r0 + (p.r1 - p.r0) * Math.sqrt(k);
      p.s.scale.set(r, r, 1); p.s.material.opacity = p.a * (1 - k) * Math.min(1, k * 8);
    }
  }

  // ---- drifting dust motes in the floodlight (additive specks; they mostly show in the title's perspective view)
  const motes = [];
  if (quality !== 'low') {
    const mt = new THREE.CanvasTexture(puffSprite(32)); mt.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, color: '#ffe2b0', toneMapped: false }));
      const k = (i * 0.6180339) % 1, k2 = (i * 0.7548776) % 1, k3 = (i * 0.5698403) % 1;
      s.userData = { x: (k - 0.5) * 11, y: 0.4 + k2 * 3.6, z: (k3 - 0.5) * 17, ph: i * 1.7, sp: 0.05 + k * 0.08 };
      s.scale.set(0.05, 0.05, 1); scene.add(s); motes.push(s);
    }
  }
  function stepMotes(t) { for (const s of motes) { const d = s.userData; s.position.set(d.x + Math.sin(t * 0.3 + d.ph) * 0.4, d.y + ((t * d.sp) % 3.0), d.z + Math.cos(t * 0.25 + d.ph) * 0.4); s.material.opacity = 0.25 + 0.25 * Math.sin(t * 1.3 + d.ph); } }

  // ---- bookkeeping across frames
  let lastT = null, lastB = null, lastKhos = 0, simClock = 0;
  const outSeen = [false, false, false];
  const seatXZ = (i) => ({ x: wx(SP), z: wz(SEAT_Y[i]) });
  const yawOf = (ang) => Math.PI - ang;               // engine ang 0 = facing up the screen (-Y), clockwise positive
  const faceYawOfSeat = (i) => (i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2);
  let seatOf = seatP.slice();                          // seatOf[i] = the player currently on seat i

  function resetBatch(b) {
    seatOf = seatP.slice(); active = activeOrig;
    for (let i = 0; i < SEATS; i++) {
      const P = seatOf[i]; P.mode = 'seat'; P.s = 1; P.seatIdx = i; P.first = true; P.touch = 0; P.divingT = 0; P.hitT = 0;
      const sx = seatXZ(i); P.h.setPosition(sx.x, 0, sx.z); P.h.setFacing(faceYawOfSeat(i), { snap: true }); P.h.turnRate = 6;
      P.h.groundClamp = 'off'; P.h.footPlanting = false; P.h.play(P.clip, { fade: 0 });
    }
    for (const P of [...runners, active]) {
      P.mode = 'free'; P.s = 0; P.first = true; P.gait = 0; P.yaw = undefined; P.divingT = 0; P.hitT = 0; P.h.groundClamp = 'auto'; P.h.footPlanting = api.tune.footPlant;
      for (const sd of ['L', 'R']) { P.h.setReach(sd, null); P.h.setReachFoot(sd, null); }
      P.clipName = ''; P.h.turnRate = 9;
    }
    outSeen.fill(false);
    lastKhos = b.khos || 0; lastT = null;
  }

  // ---- free movers: stride phase and cadence come from the distance the figure really covers, facing from its real heading
  function moveFree(P, x, z, dt, o = {}) {
    const h = P.h;
    if (P.first) { P.px = x; P.pz = z; P.vx = P.vz = 0; P.first = false; P.yaw = o.yaw ?? P.yaw ?? 0; P.heading = P.yaw; h.turnRate = 0; h.setFacing(P.yaw, { snap: true }); }
    const dx = x - P.px, dz = z - P.pz, d = Math.hypot(dx, dz);
    if (d > 1.4) { P.vx = P.vz = 0; if (o.yaw != null) { P.yaw = o.yaw; h.setFacing(P.yaw, { snap: true }); } }                // a teleport (new batch, Kho): no fake speed
    else if (dt > 1e-5) { const a = 1 - Math.exp(-dt / api.tune.velTau); P.vx += (dx / dt - P.vx) * a; P.vz += (dz / dt - P.vz) * a; }
    P.px = x; P.pz = z;
    h.setPosition(x, 0, z);
    P.speed = Math.hypot(P.vx, P.vz);
    // facing follows the real heading (the way the figure actually moves), at a human-fast turn rate; standing, it takes the requested pose
    let tgt = null;
    if (P.speed > 0.5) { P.heading = Math.atan2(P.vx, P.vz); tgt = P.heading; } else if (o.face != null) tgt = o.face;
    if (tgt != null) {
      let e = tgt - P.yaw; e = Math.atan2(Math.sin(e), Math.cos(e));
      const st = (P.speed > 0.5 ? api.tune.turnRate : 5) * dt;
      P.yaw += clamp(e, -st, st);
    }
    h.turnRate = 0; h.setFacing(P.yaw, { snap: true }); h.maxFootDrag = api.tune.maxFootDrag;
    let g = P.gait;
    while (g < 3 && P.speed > UP[g]) g++;
    while (g > 0 && P.speed < DOWN[g - 1]) g--;
    const gt = GAITS[g], pickName = (g === 0 && o.idle) ? o.idle : gt.n;
    const cur = h.layers.base.current;
    if (!cur || cur.clip.name !== pickName || cur.target === 0) {
      const opts = { fade: g > P.gait || g === 0 ? 0.2 : 0.25, loop: true };
      if (cur && cur.clip.loop && cur.clip.events.footL !== undefined && h.clips[pickName].events.footL !== undefined && g > 0) {
        const a = cur.clip, c = h.clips[pickName], ph = (((cur.time - a.events.footL) / a.dur) % 1 + 1) % 1;
        opts.startTime = (c.events.footL + ph * c.dur) % c.dur;
      }
      h.play(pickName, opts);
    }
    P.gait = g;
    const want = gt.v > 0 ? clamp(P.speed / gt.v, 0.55, 1.55) : 1;
    P.rate += (want - P.rate) * (1 - Math.exp(-(dt || 1 / 60) / 0.08));
    h.setSpeed(P.rate);
    P.clipName = pickName;
  }

  function footDust(P, dt, strength = 1) {
    if (quality === 'low' || P.speed < 2.0) return;
    P.puffT -= dt;
    if (P.puffT > 0) return;
    P.puffT = 0.17;
    const r = P.h.root.position;
    emit(r.x - Math.sin(P.heading) * 0.25, 0.03, r.z - Math.cos(P.heading) * 0.25, { life: 0.55, vy: 0.22, r0: 0.1, r1: 0.42 * strength, a: 0.33 * strength, vx: -Math.sin(P.heading) * 0.3, vz: -Math.cos(P.heading) * 0.3 });
  }

  // ---- per-frame update from the batch
  function update(b, state, dt) {
    if (lastB !== b) { lastB = b; resetBatch(b); }
    simClock += dt;
    const t = state.t;
    const a = b.active;
    // a Kho: the chaser sits into the seat, the seated player rises and runs
    if ((b.khos || 0) > lastKhos) {
      lastKhos = b.khos;
      const j = a.seat;
      if (j >= 0 && seatOf[j] && seatOf[j] !== active) {
        const newA = seatOf[j], old = active;
        newA.mode = 'rise'; newA.tt = 0; newA.rise0 = { x: newA.h.root.position.x, z: newA.h.root.position.z };
        old.mode = 'sit'; old.tt = 0; old.seatIdx = j; old.touch = 0.3;
        old.sit0 = { x: old.h.root.position.x, z: old.h.root.position.z };
        old.h.groundClamp = 'off'; old.h.footPlanting = false; old.h.play(old.clip, { fade: 0.18 }); old.h.setReach('R', null);
        seatOf[j] = old; active = newA;
        if (crowd) crowd.react('cheer', { origin: [0, 0, wz(SEAT_Y[j])], radius: 14, intensity: 0.5 });
        const sx = seatXZ(j);
        for (let k = 0; k < 3; k++) emit(sx.x + (k - 1) * 0.12, 0.05, sx.z, { life: 0.5, vy: 0.3, r0: 0.1, r1: 0.4, a: 0.35, vx: (k - 1) * 0.3 });
      }
    }
    // seated chasers: breathing, weight shifts, eyes on the nearest runner
    for (let i = 0; i < SEATS; i++) {
      const P = seatOf[i], h = P.h;
      if (P.mode === 'seat') {
        h.turnRate = 6;
        const sx = seatXZ(i); h.setPosition(sx.x, 0, sx.z); h.setFacing(faceYawOfSeat(i), { snap: false });
        poseSquat(P, t, 1, Math.sin(t * 0.7 + i) * 0.8);
        seatHands(P, 1);
        let best = null, bd = 1e9;
        for (const r of b.runners) { if (r.out) continue; const d = Math.hypot(r.x - SP, r.y - SEAT_Y[i]); if (d < bd) { bd = d; best = r; } }
        if (best) {
          const tx = wx(best.x), tz = wz(best.y);
          if (!P.look) P.look = { x: tx, z: tz };
          const a = 1 - Math.exp(-dt / 0.18); P.look.x += (tx - P.look.x) * a; P.look.z += (tz - P.look.z) * a;   // the eyes glide to the next runner, never snap
          h.lookAt({ x: P.look.x, y: 1.15, z: P.look.z }, { weight: 0.8, maxYaw: 1.1, maxPitch: 0.5 });
        } else h.lookAt(null);
      } else if (P.mode === 'sit') {
        P.tt += dt;
        const k = smooth(0, 0.42, P.tt);
        P.s = k;
        const sx = seatXZ(i);
        h.setPosition(P.sit0.x + (sx.x - P.sit0.x) * k, 0, P.sit0.z + (sx.z - P.sit0.z) * k);
        h.turnRate = 8; h.setFacing(faceYawOfSeat(i), { snap: false });
        poseSquat(P, t, k, 6 * (1 - k));
        seatHands(P, k);
        // the hand-over: a slap on the back of the player who is getting up
        if (P.touch > 0) {
          P.touch -= dt;
          const w = Math.sin(Math.PI * clamp((0.3 - P.touch) / 0.3, 0, 1));
          const ar = active.h.root.position, fy = active.h.facing;
          v.set(ar.x - Math.sin(fy) * 0.1, 1.05, ar.z - Math.cos(fy) * 0.1);
          h.setReach('R', v, { weight: w }); h.setFingers('R', 'open');
        }
        if (P.tt > 0.5) { P.mode = 'seat'; P.s = 1; h.setReach('R', null); }
      }
    }
    // the standing chaser (the player that has just risen shows up here as `active`)
    {
      const P = active, h = P.h, c = a, x = wx(c.x), z = wz(c.y);
      if (P.mode === 'rise') {
        P.tt += dt;
        const D = 0.46, k = clamp(P.tt / D, 0, 1), s = 1 - smooth(0, 1, k);
        const e = smooth(0, 1, k);
        const px = P.rise0.x + (x - P.rise0.x) * e, pz = P.rise0.z + (z - P.rise0.z) * e;
        h.setPosition(px, 0, pz);
        h.turnRate = 14; h.setFacing(yawOf(c.ang), { snap: false });
        poseSquat(P, t, s, 16 * Math.sin(Math.PI * k), Math.sin(Math.PI * k));
        seatHands(P, s);
        if (k >= 1) {
          P.mode = 'free'; h.groundClamp = 'auto'; h.footPlanting = api.tune.footPlant;
          for (const sd of ['L', 'R']) { h.setReach(sd, null); h.setReachFoot(sd, null); }
          h.lookAt(null); P.px = px; P.pz = pz; P.first = false; P.yaw = h.facing; P.heading = P.yaw; P.vx = Math.sin(yawOf(c.ang)) * 1.5; P.vz = Math.cos(yawOf(c.ang)) * 1.5;
          h.play('jog', { fade: 0.16, loop: true }); P.gait = 2;
        }
        P.speed = 1;
      } else {
        h.lookAt(null);
        moveFree(P, x, z, dt, { yaw: yawOf(c.ang), idle: 'ready_stance', face: yawOf(c.ang) });
        footDust(P, dt);
        // the pole: the chaser grabs it to swing round (only inside the end zone, close to the post)
        let w = 0, pole = null;
        for (let i = 0; i < 2; i++) { const dd = Math.hypot(c.x - SP, c.y - POLE_Y[i]) / PW; if (dd < 1.0) { const ww = 1 - smooth(0.35, 1.0, dd); if (ww > w) { w = ww; pole = i; } } }
        if (pole !== null && P.speed > 1.2) {
          v.set(poles[pole].position.x, 1.02, poles[pole].position.z);
          h.setReach('R', v, { weight: w * 0.9 }); h.setFingers('R', 'fist');
        } else { h.setReach('R', null); h.setFingers('R', 'auto'); }
        if (P.divingT > 0) P.divingT -= dt;
      }
    }
    // runners
    b.runners.forEach((r, i) => {
      const P = runners[i], h = P.h;
      let x = wx(r.x), z = wz(r.y), yaw = null, idle = 'ready_stance';
      if (r.out) {
        const k = b.t - r.outT, sx = r.x < SP ? COURT.x0 - 36 : COURT.x1 + 36, dx = sx - r.x, d = Math.abs(dx);
        const walk = Math.min(d, Math.max(0, k - 0.55) * 1.35 * PW);
        x = wx(r.x + Math.sign(dx || 1) * walk);
        yaw = (Math.PI / 2) * (dx >= 0 ? 1 : -1);
        idle = 'idle_relaxed';
        if (!outSeen[i]) {
          outSeen[i] = true;
          h.play('hit', { fade: 0.1, loop: false });
          P.hitT = 0.4;
          for (let q = 0; q < 6; q++) { const an = q * 1.05; emit(x, 0.9, z, { life: 0.5, vx: Math.cos(an) * 1.0, vz: Math.sin(an) * 1.0, vy: 0.9, g: -4.5, r0: 0.05, r1: 0.1, a: 0.85, color: '#ffffff' }); }
          for (let q = 0; q < 3; q++) emit(x + (q - 1) * 0.15, 0.05, z, { life: 0.6, vy: 0.3, r0: 0.12, r1: 0.5, a: 0.4 });
          if (crowd) crowd.react('cheer', { origin: [x, 0, z], radius: 16, intensity: 0.7 });
          if (active.speed > 2.2 && active.mode === 'free') { active.h.play('dive', { fade: 0.05, loop: false }); active.divingT = 0.42; }
        }
      } else outSeen[i] = false;
      if (P.hitT > 0) {
        P.hitT -= dt;
        h.setPosition(x, 0, z); P.px = x; P.pz = z; P.vx = P.vz = 0; P.speed = 0; P.gait = 0;
      } else {
        moveFree(P, x, z, dt, { yaw: yaw ?? yawOf(r.ang), idle, face: r.out ? (yaw ?? 0) : yawOf(r.ang) });
        if (!r.out) footDust(P, dt, 0.9);
      }
      h.lookAt(null);
      h.root.visible = true;
    });
    umpire.h.lookAt({ x: wx(a.x), y: 1.3, z: wz(a.y) }, { weight: 0.9, maxYaw: 1.2, maxPitch: 0.4 });
    // ---- advance every figure; the pose / reach overrides above are applied inside update()
    for (const P of seatOf) P.h.update(P.mode === 'seat' ? 0 : dt);
    for (const P of runners) P.h.update(dt);
    active.h.update(active.mode === 'rise' ? 0 : dt);
    umpire.h.update(dt);
    stepPuffs(dt);
    stepMotes(simClock);
    village.update(simClock);
    if (crowd) crowd.update(dt, lodCam);
    if (api.recording) api.recording(all, simClock);
  }

  // ---- oblique camera: u = x * PW, v = z * PW - y * PW * COS (court units), centred on the court
  function setOblique(rot, devW, devH, R) {
    if (sized.w !== devW || sized.h !== devH) { renderer.setPixelRatio(1); renderer.setSize(devW, devH, false); sized = { w: devW, h: devH }; }
    const sx = 2 * PW / R.w, sy = 2 * PW / R.h, cu = R.u + R.w / 2, cv = R.v + R.h / 2;
    const r = rot ? [0, -1] : [1, 0], d = rot ? [1, 0] : [0, 1];
    const T = 140;
    const e = cam.projectionMatrix.elements;
    const m = [
      sx * r[0], 0, sx * r[1], -2 * cu / R.w,
      -sy * d[0], sy * COS, -sy * d[1], 2 * cv / R.h,
      -COS * d[0] / T, -1 / T, -COS * d[1] / T, 0,
      0, 0, 0, 1,
    ];
    cam.position.set(0, 0, 0); cam.rotation.set(0, 0, 0); cam.updateMatrixWorld(true); sky.visible = false;
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) e[col * 4 + row] = m[row * 4 + col];
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }
  function setPersp(W, H, pos, target, fov) {
    if (sized.w !== W || sized.h !== H) { renderer.setPixelRatio(1); renderer.setSize(W, H, false); sized = { w: W, h: H }; }
    cam.fov = fov; cam.aspect = W / H; cam.near = 0.3; cam.far = 220; cam.updateProjectionMatrix();
    cam.position.set(pos[0], pos[1], pos[2]); cam.lookAt(target[0], target[1], target[2]); cam.updateMatrixWorld(true);
    sky.visible = true; sky.position.x = pos[0]; sky.position.z = pos[2];
  }

  const cost = { ema: 0, n: 0, step: 0, since: 0 };
  function guard(ms) {
    cost.n++;
    if (cost.n > 60) {
      cost.ema = cost.ema ? cost.ema * 0.96 + ms * 0.04 : ms;
      if (cost.ema > 13 && cost.n - cost.since > 150 && cost.step < 2) {
        cost.step++; cost.since = cost.n; cost.ema = 0;
        if (cost.step === 1) { if (crowd) crowd.setQuality('low'); stage.renderer.shadowMap.enabled = false; stage.lights.key.castShadow = false; scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; }); }
        else { api.quality = 'low'; stage.setQuality('low'); }
      }
    }
  }
  const dtOf = (b) => (lastT === null || lastB !== b ? 0 : clamp(b.t - lastT, 0, 0.1));

  /** Draw the whole screen-sized court picture. ctx is in LOCAL screen-aligned units centred on the court centre (see view.js). */
  // The title hero sees the people up close: full-detail meshes there (medium meshes show shoulder shards in close-ups); play uses the cheaper level.
  let heroFull = false;
  const setPeopleLod = (full) => { if (quality === 'low' || heroFull === full) return; heroFull = full; for (const P of [...all, umpire]) P.h.setLOD(full ? 0 : 1); };
  api.draw = function (ctx, b, state, rot) {
    setPeopleLod(false);
    if (api.lost || stage.contextLost) return false;
    const t0 = globalThis.performance.now();
    const m = ctx.getTransform(), s = Math.hypot(m.a, m.b);
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const R = { u: clamp(-m.e / s, -1100, 0), v: clamp(-m.f / s, -1400, 0) };
    R.w = Math.min(W / s, 2200); R.h = Math.min(H / s, 2800);
    if (R.w < 100 || R.h < 100) return false;
    const sc = Math.min(1, 1500 / Math.max(R.w * s, R.h * s * 0.6));
    const devW = clamp(Math.round(R.w * s * sc), 200, 1500), devH = Math.round(devW * R.h / R.w);
    const dt = dtOf(b);
    update(b, state, dt); lastT = b.t;
    ovTex.needsUpdate = true;
    setOblique(rot, devW, devH, R);
    renderer.render(scene, cam);
    ctx.drawImage(renderer.domElement, R.u, R.v, R.w, R.h);
    guard(globalThis.performance.now() - t0);
    return true;
  };

  /** Perspective hero picture for the title page: drawn into the screen rect (x, y, w, h) of the 2D picture, with a slow camera drift. */
  api.drawHero = function (ctx, rect, b, state, land = false) {
    if (api.lost || stage.contextLost) return false;
    setPeopleLod(true);
    const t0 = globalThis.performance.now();
    const m = ctx.getTransform(), s = Math.hypot(m.a, m.b);
    const W = clamp(Math.round(rect.w * s), 160, 1400), H = Math.max(80, Math.round(W * rect.h / rect.w));
    update(b, state, dtOf(b)); lastT = b.t;
    ovTex.needsUpdate = true;
    const H0 = land ? api.tune.heroL : api.tune.heroP, drift = Math.sin(state.t * 0.25) * H0.drift;
    setPersp(W, H, [H0.pos[0] + drift, H0.pos[1] + Math.sin(state.t * 0.17) * 0.12, H0.pos[2]], [H0.tgt[0] + drift * 0.15, H0.tgt[1], H0.tgt[2]], H0.fov);
    renderer.render(scene, cam);
    ctx.drawImage(renderer.domElement, rect.x, rect.y, rect.w, rect.h);
    guard(globalThis.performance.now() - t0);
    return true;
  };

  // Developer / art tools: advance the people by dt without drawing; a true perspective picture for the store icon and banners.
  api.step = (b, state, dt) => { update(b, state, dt); lastB = b; lastT = b.t; };
  api.perspective = ({ size = 1024, aspect = 1, pos, target, fov = 34, dstW, lod = 0 }) => {
    const Wp = dstW || size, Hp = Math.round(Wp / aspect);
    for (const P of [...all, umpire]) P.h.setLOD(lod);
    setPersp(Wp, Hp, pos, target, fov);
    ovTex.needsUpdate = true;
    renderer.render(scene, cam);
    const url = renderer.domElement.toDataURL('image/png');
    for (const P of [...all, umpire]) P.h.setLOD(quality === 'low' ? 2 : 1);
    sized = { w: 0, h: 0 };
    return url;
  };
  api.cost = cost; api.ready = true;
  api.actors = { seated: seatP, runners, get chaser() { return active; }, umpire };
  api.village = village; api.crowd = crowd; api.scene = scene; api.camera = cam; api.renderer = renderer;
  api.emit = emit; api.poles = poles; api.PW = PW; api.wx = wx; api.wz = wz;
  return api;
}

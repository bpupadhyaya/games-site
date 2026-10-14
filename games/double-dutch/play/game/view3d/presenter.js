// Double Dutch 3D presenter (game-owned). It ONLY READS the sim (game.getState()) and draws the street with the shared view3d layer:
// two turners, two ropes turning in opposite directions about the line of their hands, and the jumper between them, in a dusk Brooklyn
// block with children watching. Where each rope is, when it touches the ground and when the jumper is in the air all come from the sim's
// visual state (Theta, J); the picture never feeds anything back. Poses are pure functions of the sim clock (clips are scrubbed), so it is
// deterministic and pauses with the game.
//
// FRAME ORDER (prop-in-hand): 1 set the targets (reach, look, clip time)  2 stage.update(dt, {renderNow:false}) solves the arms
// 3 read the PALMS of the turners and pin the rope ends and handles to them  4 attach the jumper's ribbon  5 render.
import { layoutFor } from '../src/layout.js';
import { thetaOf, pulseOf } from '../src/playview.js';
import { demoVisual } from '../src/stage.js';
import { stageRect } from '../src/stage3d.js';
import { fit3, W3, handlePoint, ropeTheta, CAM } from '../src/geo3d.js';
import { snaps, credits, creditBlocks } from '../src/snaps.js';
import { buildStreet } from './street.js';
import { createRopes } from './ropes.js';

const LIB = '../vendor3d/index.js';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); };
const G = 9.81;

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const off = { stage: null, wrap: (g) => g, ok: false };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D street', e); return off; }
  const { createStage, loadHuman, buildClip, createCrowd3d, THREE, board3d: B } = V3;
  const contact = V3;

  // WebGL canvas BEHIND the kit canvas; the transparent kit canvas stays on top and keeps all input.
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  canvas.style.opacity = '0'; canvas.style.transition = 'opacity 0.35s';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'evening', shadowSize: 4.6, fov: 30 });
  if (!stage.supported) { canvas.remove(); return off; }
  const scene = stage.scene, camera = stage.camera;
  camera.fov = 30; camera.near = 0.5; camera.far = 140; camera.updateProjectionMatrix();

  const applyLighting = () => {
    stage.setLighting('evening', { hemiSky: 0xb79bff, hemiGround: 0x4a3560, hemi: 1.0, key: 0xffcf9a, keyI: 2.7, rim: 0xff6fb8, rimI: 1.7, exposure: 1.08, sky: 0x2a1650, fog: 0x4a2377 });
    stage.setSky(0x2a1650, 0x4a2377, { near: 34, far: 90 });
    stage.lights.key.position.set(3.5, 7, 5); stage._shadowOffset.set(3.5, 7, 5);
  };
  applyLighting();

  const street = buildStreet({ THREE, B, stage, quality });
  const world = street.group;
  const ropeSys = createRopes({ THREE, world, quality });

  // ------------------------------------------------------------------ people
  const mkHuman = async (character, kit, skin, hair) => { const h = await loadHuman({ character, kit, skin, hair }); h.footPlanting = false; h.groundClamp = 'off'; stage.add(h); stage.track(h); return h; };
  let jumper, turnA, turnB;
  try {
    [jumper, turnA, turnB] = await Promise.all([
      mkHuman('athlete_f', { top: '#ff8a1f', bottoms: '#26264f', socks: '#ffffff', shoes: '#ffffff', trim: '#ff3fa4' }, 'tan', 'black'),
      mkHuman('athlete_m', { top: '#35d0ff', bottoms: '#3b3b55', socks: '#ffffff', shoes: '#ffd23f' }, 'light', 'brown'),
      mkHuman('athlete_f', { top: '#ff3fa4', bottoms: '#e9e1d2', socks: '#ffffff', shoes: '#7be26a' }, 'deep', 'black'),
    ]);
  } catch (e) { console.warn('view3d people failed to load; using the 2D street', e); stage.dispose(); return off; }
  turnA.setPosition(-W3.turnerX, 0, 0); turnA.setFacing(Math.PI / 2);
  turnB.setPosition(W3.turnerX, 0, 0); turnB.setFacing(-Math.PI / 2);
  jumper.setPosition(0, 0, 0); jumper.setFacing(0);

  // ---- onlookers: real instanced 3D people (children and grown-ups) on the stoops and the pavement, they cheer on good hops
  let crowd = null;
  try {
    const pts = [
      // stoop steps (seated on the second step) and pavement groups behind the turners
      { x: -4.05, y: 0, z: -5.35, yaw: 0, seated: 1 }, { x: -3.3, y: 0, z: -5.35, yaw: 0.1, seated: 1 }, { x: 0.95, y: 0, z: -5.35, yaw: 0, seated: 1 }, { x: 1.75, y: 0, z: -5.35, yaw: -0.1, seated: 1 },
      { x: -3.7, y: 0, z: -1.6, yaw: 1.0 }, { x: -4.5, y: 0, z: -0.7, yaw: 1.1 }, { x: -3.9, y: 0, z: 0.2, yaw: 1.0 }, { x: -5.4, y: 0, z: 0.4, yaw: 0.9 }, { x: -4.9, y: 0, z: -2.0, yaw: 0.9 },
      { x: 3.8, y: 0, z: -1.7, yaw: -1.0 }, { x: 4.6, y: 0, z: -0.6, yaw: -1.1 }, { x: 4.0, y: 0, z: 0.3, yaw: -1.0 }, { x: 5.3, y: 0, z: 0.5, yaw: -0.9 }, { x: 5.0, y: 0, z: -2.1, yaw: -0.9 },
      { x: 6.4, y: 0, z: -5.3, yaw: 0, seated: 1 }, { x: 7.1, y: 0, z: -5.3, yaw: 0, seated: 1 },
    ];
    crowd = createCrowd3d(stage, { points: pts, count: pts.length, seed: 21, culture: ['american_rural', 'african', 'latin_american'], quality: quality === 'high' ? 'high' : 'medium', kids: 0.55, excitement: 0.35, props: { phone: 0.1, child: 0 }, blobShadows: true });
  } catch (e) { console.warn('crowd3d unavailable', e); crowd = null; }

  // ---- clips for the jumper: pose-to-pose, with the pelvis lowered so the feet stay on the pavement through every knee bend
  const LEG = Math.max(0.6, jumper.pelvisHeight - 0.09);
  const drop = (a, b = 2 * a) => LEG - (LEG / 2) * (Math.cos(a * Math.PI / 180) + Math.cos((a - b) * Math.PI / 180));   // thigh a forward, calf b back: how far the hip drops
  const knees = (a, o = {}) => {
    const b = o.calf ?? 2 * a;
    return { Pelvis: { pos: [o.sway ?? 0, -(o.noDrop ? 0 : drop(a, b)), o.back ?? 0], flex: o.pelvis ?? 0 },
      L_Thigh: { flex: a + (o.lt ?? 0), abduct: o.ab ?? 0 }, R_Thigh: { flex: a + (o.rt ?? 0), abduct: o.ab ?? 0 }, L_Calf: { flex: b + (o.lc ?? 0) }, R_Calf: { flex: b + (o.rc ?? 0) } };
  };
  const arms = (flex, abd, fore, o = {}) => ({ L_UpperArm: { flex: flex + (o.l ?? 0), abduct: abd, twist: o.tw ?? 0 }, R_UpperArm: { flex: flex + (o.r ?? 0), abduct: abd, twist: o.tw ?? 0 }, L_Forearm: { flex: fore }, R_Forearm: { flex: fore } });
  const trunk = (flex, o = {}) => ({ Spine: { flex: flex * 0.35, twist: o.twist ?? 0, side: o.side ?? 0 }, Spine1: { flex: flex * 0.35, twist: (o.twist ?? 0) * 0.8 }, Spine2: { flex: flex * 0.3 }, Neck: { flex: -flex * 0.35 }, Head: { flex: -flex * 0.15 } });
  const BASE = { clip: 'idle_relaxed', time: 0.6 };
  const clipCache = new Map();
  const hopClip = (trick, air) => {
    const key = `${trick}|${air.toFixed(2)}`;
    let c = clipCache.get(key); if (c) return c;
    // phases of a real double-dutch hop: load (anticipation dip, arms back), push (extension, arms swing up), flight (knees tuck, heels up),
    // land (toes first, knees absorb), rebound
    const A = air, push = 0.075, apex = A * 0.5, land = A, abs = A + 0.07, end = trick === 'touch' ? A + 0.38 : A + 0.24;
    const K = [];
    const k = (t, pose, ease = 'inOut') => K.push({ t, pose, ease });
    k(0, { ...knees(21), ...trunk(8), ...arms(-12, 12, 30) });
    k(push, { ...knees(3), ...trunk(0), ...arms(26, 18, 22) }, 'out');
    if (trick === 'tuck') {
      k(push + (A - push) * 0.45, { ...knees(96, { calf: 118, noDrop: true }), ...trunk(20), ...arms(36, 10, 62) });
      k(A * 0.82, { ...knees(52, { calf: 70, noDrop: true }), ...trunk(10), ...arms(22, 14, 40) });
    } else if (trick === 'spin') {
      k(apex, { ...knees(12, { calf: 34, noDrop: true }), ...trunk(2), ...arms(18, 26, 86) });
    } else if (trick === 'kick') {
      k(apex, { ...knees(10, { calf: 28, noDrop: true, rt: 14, ab: 4 }), R_Thigh: { flex: 18, abduct: 58 }, R_Calf: { flex: 8 }, ...trunk(0, { side: -6 }), ...arms(4, 62, 12) });
    } else if (trick === 'touch') {
      k(apex, { ...knees(52, { calf: 96, noDrop: true }), ...trunk(26), Pelvis: { pos: [0, 0, -0.02], flex: 8 }, ...arms(-10, 42, 24), R_UpperArm: { flex: 38, abduct: 6 }, R_Forearm: { flex: 8 } });
    } else {
      k(apex, { ...knees(14, { calf: 46, noDrop: true }), ...trunk(3), ...arms(10, 26, 38) });     // heels up behind, arms out for balance
    }
    if (trick === 'touch') {
      k(land, { ...knees(48, { calf: 88 }), ...trunk(40), Pelvis: { pos: [0, -drop(48, 88), -0.04], flex: 12 }, ...arms(-8, 40, 24), R_UpperArm: { flex: 48, abduct: 6 }, R_Forearm: { flex: 6 } }, 'in');
      k(abs, { ...knees(56, { calf: 100 }), ...trunk(46), Pelvis: { pos: [0, -drop(56, 100), -0.06], flex: 14 }, ...arms(-8, 40, 24), R_UpperArm: { flex: 52, abduct: 6 }, R_Forearm: { flex: 4 } }, 'out');
      k(A + 0.2, { ...knees(48, { calf: 88 }), ...trunk(34), Pelvis: { pos: [0, -drop(48, 88), -0.03], flex: 10 }, ...arms(0, 30, 24) });
      k(A + 0.38, { ...knees(14), ...trunk(5), ...arms(2, 12, 24) });
    } else {
      k(land, { ...knees(8, { noDrop: true }), ...trunk(6), ...arms(14, 22, 28) }, 'in');
      k(abs, { ...knees(30), ...trunk(10), ...arms(-6, 16, 30) }, 'out');
      k(end, { ...knees(13), ...trunk(4), ...arms(2, 12, 24) });
    }
    c = buildClip(jumper, { fps: 60, name: `hop-${key}`, duration: end, base: BASE, keys: K, grounded: false });
    clipCache.set(key, c);
    return c;
  };
  const stumbleClip = buildClip(jumper, { fps: 60, name: 'stumble', duration: 1, base: BASE, grounded: false, keys: [
    { t: 0, pose: { ...knees(14), ...trunk(4), ...arms(0, 12, 24) } },
    { t: 0.18, pose: { ...knees(24), ...trunk(-12), ...arms(34, 70, 20) }, ease: 'out' },
    { t: 0.6, pose: { ...knees(18), ...trunk(-6), ...arms(30, 60, 26) }, ease: 'inOut' },
    { t: 1, pose: { ...knees(13), ...trunk(2), ...arms(4, 18, 26) } },
  ] });
  // the ready bounce: a jumper waiting between hops keeps the rope's rhythm (a dip as each rope hits the pavement, heels rocking), one unit of Theta per loop
  const readyClip = buildClip(jumper, { fps: 60, name: 'ready', duration: 1, base: BASE, grounded: false, keys: [
    { t: 0, pose: { ...knees(17), ...trunk(5), ...arms(4, 14, 26) } },
    { t: 0.5, pose: { ...knees(9), ...trunk(3), ...arms(2, 12, 24) } },
    { t: 1, pose: { ...knees(17), ...trunk(5), ...arms(4, 14, 26) } },
  ] });
  jumper.addClip(stumbleClip); jumper.addClip(readyClip);
  // turners: knees dip as each rope slaps, the hips and shoulders shift with the turn, one full cycle per two passes (one per rope)
  const turnClip = [turnA, turnB].map((h) => {
    const c = buildClip(h, { fps: 60, name: 'turn-stance', duration: 2, base: { clip: 'idle_relaxed', time: 0.8 }, grounded: false, keys: [
      { t: 0, pose: { ...knees(16, { sway: 0.012 }), ...trunk(6, { twist: 3 }), ...arms(14, 10, 40) } },
      { t: 0.5, pose: { ...knees(10, { sway: 0.002 }), ...trunk(4, { twist: 0 }), ...arms(14, 10, 40) } },
      { t: 1, pose: { ...knees(16, { sway: -0.012 }), ...trunk(6, { twist: -3 }), ...arms(14, 10, 40) } },
      { t: 1.5, pose: { ...knees(10, { sway: -0.002 }), ...trunk(4, { twist: 0 }), ...arms(14, 10, 40) } },
      { t: 2, pose: { ...knees(16, { sway: 0.012 }), ...trunk(6, { twist: 3 }), ...arms(14, 10, 40) } }] });
    h.addClip(c); return c;
  });
  for (const h of [turnA, turnB]) { h.setFingers('L', 'fist'); h.setFingers('R', 'fist'); }

  // scrub a clip: the sim clock sets the time, the clip never advances by itself
  let frameDt = 0;
  const scrub = (h, clip, time, fade = 0.12) => {
    if (frameDt <= 0) fade = 0;      // a frozen sim (pause, screenshots) shows the pose at once
    let tr = h.layers.base.current;
    if (!tr || tr.clip !== clip) { h.play(clip, { fade, loop: false }); tr = h.layers.base.current; }
    tr.speed = 0; tr.time = clamp(time, 0, clip.dur); tr.warp = null; tr.loop = false;
  };
  const playLoop = (h, name, speed) => {
    let tr = h.layers.base.current;
    if (!tr || tr.clip.name !== name || tr.speed === 0) { h.play(name, { fade: 0.18, loop: true }); tr = h.layers.base.current; }
    tr.speed = speed;
  };

  // ---- the jumper's hair ribbon: a spring chain that trails her head (secondary motion)
  const ribbon = (() => {
    const NSEG = 7, mat = new THREE.MeshStandardMaterial({ color: 0xff3fa4, roughness: 0.55, side: THREE.DoubleSide, emissive: 0x551133, emissiveIntensity: 0.4 });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NSEG + 1) * 2 * 3), 3));
    const idx = []; for (let i = 0; i < NSEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.castShadow = false; world.add(mesh);
    const bun = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.012, 6, 14), mat); world.add(bun);
    const pts = []; for (let i = 0; i <= NSEG; i++) pts.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), init: false });
    return { NSEG, geo, mesh, bun, pts, ok: false };
  })();
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
  function updateRibbon(dt) {
    const R = ribbon, head = jumper.bonePosition('Head', _a);
    const yaw = jumper.facing, fx = Math.sin(yaw), fz = Math.cos(yaw);
    const anchor = _b.set(head.x - fx * 0.095, head.y + 0.02, head.z - fz * 0.095);
    R.bun.position.copy(anchor); R.bun.rotation.set(Math.PI / 2, 0, yaw);
    const P = R.pts, seg = 0.052;
    if (!P[0].init) { for (let i = 0; i <= R.NSEG; i++) { P[i].p.set(anchor.x, anchor.y - i * seg, anchor.z); P[i].v.set(0, 0, 0); P[i].init = true; } }
    P[0].p.copy(anchor);
    const h = Math.min(dt, 1 / 30);
    if (h > 0) for (let i = 1; i <= R.NSEG; i++) {
      const q = P[i];
      q.v.y -= G * 0.35 * h; q.v.multiplyScalar(1 - Math.min(1, h * 6));
      q.p.addScaledVector(q.v, h);
      // distance constraint to the previous point
      const prev = P[i - 1].p; _c.copy(q.p).sub(prev); const d = _c.length() || 1e-4;
      const target = _d.copy(prev).addScaledVector(_c, seg / d);
      q.v.addScaledVector(target.clone().sub(q.p), 1 / Math.max(h, 1e-3) * 0.5);
      q.p.copy(target);
      if (q.p.y < 0.02) q.p.y = 0.02;
    }
    const pos = R.geo.attributes.position.array;
    for (let i = 0; i <= R.NSEG; i++) {
      const w = 0.018 * (1 - i / (R.NSEG + 1) * 0.35);
      const a = P[Math.max(0, i - 1)].p, b = P[Math.min(R.NSEG, i + 1)].p;
      _c.copy(b).sub(a); _d.set(-_c.z, 0, _c.x).normalize().multiplyScalar(w);
      const p = P[i].p, o = i * 6;
      pos[o] = p.x - _d.x; pos[o + 1] = p.y; pos[o + 2] = p.z - _d.z; pos[o + 3] = p.x + _d.x; pos[o + 4] = p.y; pos[o + 5] = p.z + _d.z;
    }
    R.geo.attributes.position.needsUpdate = true;
  }

  // ------------------------------------------------------------------ camera: the view is fitted to the stage rectangle of the screen
  function aimCamera(rectV, view) {
    const cw = window.innerWidth, ch = window.innerHeight, s = cw / Math.max(1, view.width);
    const f = fit3(rectV);
    const rw = rectV.w * s, rh = rectV.h * s;
    camera.fov = (CAM.fov * 180) / Math.PI;
    camera.aspect = rw / Math.max(1, rh);
    camera.position.set(f.cam.C[0], f.cam.C[1], f.cam.C[2]);
    camera.lookAt(f.cam.T[0], f.cam.T[1], f.cam.T[2]);
    camera.setViewOffset(rw, rh, -rectV.x * s, -rectV.y * s, cw, ch);
    camera.updateMatrixWorld(true);
    return f;
  }

  // ------------------------------------------------------------------ the frame
  let frames = 0, slow = 0, tier = quality, prevNow = 0;
  const dbg = { lift: 0, V: null, hands: null, gripErr: 0 };
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const _p = new THREE.Vector3();

  // 1) targets for the turners: each hand on the circle the rope's handle draws
  function poseTurners(V) {
    for (const [h, side] of [[turnA, -1], [turnB, 1]]) {
      // which hand holds which rope: the one on the same side of the body as the rope's axis (rope A's axis is on the camera side, +z)
      const yaw = h.facing, leftZ = -Math.sin(yaw);   // world z of the avatar's left
      const ropeFor = leftZ > 0 ? { L: 'A', R: 'B' } : { L: 'B', R: 'A' };
      h._ropeFor = ropeFor;
      for (const hand of ['L', 'R']) {
        const w = ropeFor[hand], p = handlePoint(w, side, ropeTheta(w, V.Theta));
        const out = hand === 'L' ? 1 : -1, ox = Math.cos(yaw) * out, oz = -Math.sin(yaw) * out;   // the side of the body this hand is on
        // elbow: tucked in near the hip, a little out and back (the forearm does most of the turning, the wrist circles)
        (h._tgt ||= {})[hand] = p;
        h.setReach(hand, v3(p.x, p.y, p.z), { weight: 1, pole: v3(h.position.x + ox * 0.5 - side * 0.12, 0.8, oz * 0.5) });
      }
      scrub(h, h.getClip('turn-stance'), ((V.Theta % 2) + 2) % 2 / 1);
      h.lookAt(v3(0, 1.45, 0.2), { weight: 0.8 });
    }
  }

  // jumper state kept between frames: the locomotion is driven by the distance actually travelled
  const JS = { x: null, vx: 0, yaw: 0, airPrev: false, walkPh: 0, sp: 0, sv: 0, yw: 0, yv: 0, spBase: 0, wt: 0 };
  function poseJumper(V, dt) {
    const J = V.J, tr = V.tRun;
    const target = (J.x ?? 0) * 0.65;
    if (JS.x === null || dt === 0) { JS.x = target; JS.vx = 0; }
    if (dt > 0) {
      // speed-limited path to the sim's position (no teleports)
      const maxStep = 2.2 * dt, d = clamp(target - JS.x, -maxStep, maxStep);
      const nx = JS.x + d;
      JS.vx += ((nx - JS.x) / dt - JS.vx) * Math.min(1, dt * 12); JS.x = nx;
    }
    const x = JS.x, pending = target - JS.x, moving = Math.abs(JS.vx) > 0.12 || Math.abs(pending) > 0.04;
    let lift = 0;
    const tt = tr - J.t0, air = J.dur;
    const inFlight = tt >= 0 && tt <= air && J.t0 > -5;
    const hopping = J.t0 > -5 && tt >= -0.001 && tt <= air + (J.trick === 'touch' ? 0.38 : 0.24);
    if (J.stumble > 0.02) scrub(jumper, stumbleClip, (1 - J.stumble) * 1.0);
    else if (moving && !inFlight) {
      const wc = jumper.getClip('walk'), cs = wc && wc.speed > 0.3 ? wc.speed : 1.3;
      playLoop(jumper, 'walk', clamp(Math.abs(JS.vx) / cs, 0.4, 2.2));
    } else if (hopping) scrub(jumper, hopClip(J.trick, air), Math.max(0, tt));
    else scrub(jumper, readyClip, ((V.Theta % 1) + 1) % 1);
    if (inFlight) {
      const s = tt / air, apex = Math.min(0.3, 1.25 * G * air * air / 8);
      lift = 4 * apex * s * (1 - s);
    }
    // landing: a puff of dust and a squeak is the game's job; the picture adds the dust
    const airNow = inFlight;
    if (JS.airPrev && !airNow && dt > 0 && tt > air * 0.9) ropeSys.puff(x, 0, 0.0, 4, 0.35, 0.25);
    JS.airPrev = airNow;
    dbg.lift = lift;
    jumper.setPosition(x, lift, 0);
    // facing: follows the direction of travel while walking (smoothed turn rate, already turning as the walk starts), else the street.
    // A spin is a critically damped spring on an unwrapped angle, so a swipe that arrives mid-flight cannot snap the body round.
    const spinning = J.trick === 'spin' && inFlight;
    if (!spinning) JS.spBase = Math.round(JS.sp / TAU) * TAU;
    const spTarget = spinning ? (JS.spBase ?? 0) + TAU * smooth((tt / air) * 1.04) : (JS.spBase ?? 0);
    const spring = (o, kp, kv, target, w, h) => { o[kv] += (w * w * (target - o[kp]) - 2 * w * o[kv]) * h; o[kp] += o[kv] * h; };
    const head = moving ? ((Math.abs(pending) > 0.04 ? pending : JS.vx) > 0 ? Math.PI / 2 : -Math.PI / 2) : 0;
    if (dt > 0) {
      const h = Math.min(dt, 1 / 30);
      spring(JS, 'sp', 'sv', spTarget, spinning ? 22 : 12, h);
      let d = head - JS.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      spring(JS, 'yw', 'yv', JS.yaw + d, 11, h); JS.yaw = JS.yw;
    } else { JS.sp = spTarget; JS.sv = 0; { let d = head - JS.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); JS.yaw += d; JS.yw = JS.yaw; JS.yv = 0; } }
    jumper.setFacing(JS.yaw + JS.sp);
    // touch down: the right hand meets the pavement in front of the feet as he lands, and leaves it as he rises (weight is rate-limited so
    // a swipe that arrives mid-hop cannot snap the arm)
    let wT = 0;
    if (J.trick === 'touch' && J.t0 > -5 && tt > air * 0.5 && tt < air + 0.36) wT = Math.min(smooth((tt - air * 0.5) / (air * 0.5)), 1 - smooth((tt - (air + 0.18)) / 0.16));
    if (dt > 0) JS.wt += clamp(wT - JS.wt, -dt * 7, dt * 7); else JS.wt = wT;
    if (JS.wt > 0.001) jumper.setReach('R', v3(x - 0.1, 0.045, 0.3), { weight: JS.wt, pole: v3(x - 0.5, 0.45, 0.2) });
    else jumper.setReach('R', null);
    // the gaze follows the street only while she faces it (turning away it fades out instead of flipping the head round)
    const face = Math.cos(JS.yaw + JS.sp);
    jumper.lookAt(v3(0, 1.3, 2.5), { weight: 0.5 * smooth((face - 0.2) / 0.7) });
  }

  // 3) after the arms are solved: the palms of the turners carry the handles; the rope ends are pinned to them
  const handsOut = { A: null, B: null };
  function readHands() {
    const out = { A: [null, null], B: [null, null] };
    for (const [h, side] of [[turnA, -1], [turnB, 1]]) {
      for (const hand of ['L', 'R']) {
        const w = h._ropeFor[hand];
        const palm = contact.palmPoint ? contact.palmPoint(h, hand) : h.bonePosition(`${hand}_Hand`, _p).clone();
        const fr = contact.palmFrame ? contact.palmFrame(h, hand) : null;
        let axis = new THREE.Vector3(-side, -0.1, 0);
        if (fr) {
          const across = new THREE.Vector3().crossVectors(fr.n, fr.f).normalize();
          if (across.y > 0) across.negate();                      // the handle's rope end points down and to the middle
          axis = across.multiplyScalar(0.55).add(new THREE.Vector3(-side * 0.85, 0, 0)).normalize();
        }
        // the rope's end is at the inner end of the handle; the left end of the rope is the turner on -x
        const wr = h.bonePosition(`${hand}_Hand`, new THREE.Vector3()), tg = h._tgt && h._tgt[hand];
        out[w][side < 0 ? 0 : 1] = { palm: { x: palm.x, y: palm.y, z: palm.z }, axis, reach: tg ? Math.hypot(wr.x - tg.x, wr.y - tg.y, wr.z - tg.z) : 0 };
      }
    }
    return out;
  }

  const AIR = 0.36, hopV = (trick, tt) => ({ Theta: 0.3, tRun: 1, pulse: 0, hit: null, J: { t0: 1 - tt, dur: AIR, trick, x: 0, run: 0, stumble: 0 } });
  const pendingSnaps = [];
  // Pose everything for one visual state V and render (also used for the stills of the Rules figures).
  function poseAll(V, dt) {
    frameDt = dt;
    poseTurners(V);
    poseJumper(V, dt);
    street.update(performance.now() / 1000, V.pulse ?? 0);
  }
  function solveAndRope(V, dt, renderNow) {
    stage.setShadowTarget(0, 0, 0);
    stage.update(dt, { renderNow: false });           // 2) arms solved here
    const hands = readHands();
    ropeSys.update(V, dt, hands, V.hit && V.hit.v ? { rope: V.hit.rope, v: V.hit.v } : null);
    updateRibbon(dt);
    if (crowd) crowd.update(dt);
    if (dbg.measure && !snapping) dbg.measure({ hands, V, turnA, turnB, jumper, ropeSys, THREE });
    dbg.hands = hands;
    if (renderNow) { stage.dirty = true; stage.render(); }
  }

  // A still of the scene for the 2D Rules pages: render once at a fixed pose into the shared canvas and copy the part we want.
  let snapping = false;
  function takeSnap(job) {
    snapping = true;
    const cw = window.innerWidth, ch = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sc = Math.min(1, Math.min(cw / job.w, ch / job.h));
    const rw = Math.round(job.w * sc), rh = Math.round(job.h * sc), rx = Math.round((cw - rw) / 2), ry = Math.round((ch - rh) / 2);
    if (job.kind === 'street') {
      const f = fit3({ x: 0, y: 0, w: rw, h: rh });
      camera.fov = (CAM.fov * 180) / Math.PI; camera.aspect = rw / rh;
      camera.position.set(f.cam.C[0], f.cam.C[1], f.cam.C[2]); camera.lookAt(f.cam.T[0], f.cam.T[1], f.cam.T[2]);
      camera.setViewOffset(rw, rh, -rx, -ry, cw, ch);
    } else {
      const d = (2.35 * (ch / rh)) / (2 * Math.tan((30 * Math.PI) / 360));
      camera.fov = 30; camera.aspect = cw / ch; camera.clearViewOffset();
      const az = 0.42, el = 0.1, ty = 0.92;
      camera.position.set(Math.sin(az) * Math.cos(el) * d, ty + Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d); camera.lookAt(0, ty, 0);
    }
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    const keepX = JS.x; JS.x = null;
    ropeSys.reset();
    poseAll(job.V, 0);
    solveAndRope(job.V, 0, false);
    stage.render();
    const c2 = document.createElement('canvas'); c2.width = Math.round(rw * dpr); c2.height = Math.round(rh * dpr);
    c2.getContext('2d').drawImage(canvas, rx * dpr, ry * dpr, rw * dpr, rh * dpr, 0, 0, c2.width, c2.height);
    snaps.set(job.name, c2);
    JS.x = keepX; ropeSys.reset(); snapping = false;
  }
  const queueSnaps = () => {
    pendingSnaps.push({ name: 'side', kind: 'street', w: 760, h: 440, V: { Theta: 0.62, tRun: 0, pulse: 0, hit: null, J: { t0: -9, dur: 0.3, trick: null, x: 0, run: 0, stumble: 0 } } });
    for (const [id, tt] of [['tuck', 0.17], ['spin', 0.1], ['kick', 0.18], ['touch', 0.5]]) pendingSnaps.push({ name: 'trick-' + id, kind: 'trick', w: 420, h: 520, V: hopV(id, tt) });
  };

  let lastCombo = 0, lastLives = null;
  const tick = { sim: -1, real: 0, big: false };
  const thV = { raw: null, out: 0, off: 0 };
  let lastNow = null;
  function frame(game, view) {
    const st = game.getState();
    const L = layoutFor(view.width, view.height);
    if (pendingSnaps.length && frames > 4) { try { takeSnap(pendingSnaps.shift()); } catch (e) { console.warn('still failed', e); } }
    // Visual time: the sim ticks at 60 Hz but a display frame may carry 0, 1 or 2 ticks (jitter), which shows as judder. The picture is
    // extrapolated from the last tick by the real time elapsed since it (at most 2 steps), so it advances evenly on every frame.
    const nowS = performance.now() / 1000, STEPV = 1 / 60;
    const simNow = st.scene === 'play' && st.run && st.run.phase === 'play' ? st.run.t : st.t;
    if (simNow !== tick.sim) { tick.big = Math.abs(simNow - tick.sim) > 0.2; tick.sim = simNow; tick.real = nowS; }
    const since = nowS - tick.real;
    const alpha = tick.big || since > 0.05 || dbg.noInterp ? 0 : clamp(since / STEPV, 0, 2);
    const aT = alpha * STEPV;
    const frozenSim = nowS - tick.real > 0.1 || lastNow === null;
    const dtVis = frozenSim ? 0 : clamp(nowS - lastNow, 0, 0.05);
    lastNow = nowS;
    let V;
    if (st.scene === 'play' && st.run) {
      const r = st.run, rv = r.phase === 'play' ? { ...r, t: r.t + aT } : r;
      V = { Theta: thetaOf(rv, st.t + aT), tRun: r.phase === 'play' ? r.t + aT : 0, J: r.J, pulse: pulseOf(rv), hit: r.hit };
      if (r.phase !== 'play') V.J = { ...r.J, t0: -9, stumble: 0 };
      else if (r.J.stumble > 0) V.J = { ...r.J, stumble: Math.max(0, r.J.stumble - aT * 1.8) };
      if (crowd && r.mode !== undefined) {
        if (r.combo > lastCombo && r.combo >= 2) crowd.react('cheer', { origin: [0, 0, 0], radius: 30, intensity: Math.min(1, 0.4 + r.combo * 0.06) });
        if (lastLives !== null && r.lives < lastLives) crowd.react('groan', { origin: [0, 0, 0], radius: 30, intensity: 0.8 });
        lastCombo = r.combo; lastLives = r.lives;
        crowd.setExcitement?.(Math.min(0.9, 0.25 + r.combo * 0.03));
      }
    } else {
      const d = demoVisual(st.t + aT);
      V = { Theta: d.Theta, tRun: d.tRun, J: d.J, pulse: d.pulse, hit: null };
      lastCombo = 0; lastLives = null;
    }
    // rope phase continuity: the sim restarts Theta when a run starts / ends (a jump of many turns); blend the picture over to it
    // by the nearest even shift (keeps which rope is on the ground at each pass) and let the difference die away in ~0.4 s
    {
      const raw = V.Theta;
      if (thV.raw !== null && Math.abs(raw - thV.raw) > 0.3) { let o = thV.out - raw; o -= 2 * Math.round(o / 2); thV.off = o; }
      thV.raw = raw;
      if (dtVis > 0) thV.off *= Math.exp(-dtVis * 6);
      if (Math.abs(thV.off) < 1e-3) thV.off = 0;
      V.Theta = raw + thV.off; thV.out = V.Theta;
    }
    if (dbg.force) V = { ...V, ...dbg.force, J: { ...V.J, ...(dbg.force.J || {}) } };      // dev only: freeze a pose for screenshots
    dbg.V = V;
    camera.clearViewOffset();
    if (dbg.icon) {   // dev only: the app icon hero shot (square, close, jumper between the two loops)
      const ic = dbg.icon, cw = window.innerWidth, ch = window.innerHeight;
      camera.fov = ic.fov ?? 30; camera.aspect = cw / ch;
      camera.position.set(...ic.pos); camera.lookAt(...ic.look); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    } else aimCamera(stageRect(st, L), view);
    // animation time = difference of the sim clock (pauses with the game, reproducible headless)
    const dt = dtVis;
    poseAll(V, dt);
    const skip = tier !== 'low' && st.scene !== 'play' && st.scene !== 'title' && (frames++ & 1);      // menus: render every other frame
    solveAndRope(V, dt, !skip);
    if (skip) return;
    frames += 1;
    // fixed per-frame budget: when frames stay slow after the first second, step the quality tier down (once per tier)
    const now = performance.now();
    if (frames > 30 && frames < 600 && prevNow) {
      if (now - prevNow > 34) slow += 1; else slow = Math.max(0, slow - 0.25);
      if (slow > 20 && tier !== 'low') { tier = tier === 'high' ? 'medium' : 'low'; stage.setQuality(tier); crowd?.setQuality?.(tier === 'low' ? 'low' : 'medium'); slow = 0; }
    }
    prevNow = now;
  }

  let gameRef = null;
  stage.onContextLost(() => { gameRef?.setStage3d?.(false); canvas.style.visibility = 'hidden'; });     // the 2D street takes over
  stage.onContextRestored(() => { applyLighting(); gameRef?.setStage3d?.(true); canvas.style.visibility = 'visible'; stage.invalidate(); });
  queueSnaps();
  fetch(new URL('../vendor3d/LICENSES.md', import.meta.url)).then((r) => (r.ok ? r.text() : '')).then((t) => { if (t) credits.blocks = creditBlocks(t); }).catch(() => {});
  void turnClip; void B;

  if (new URLSearchParams(location.search).has('dev')) window.__dd3 = dbg;
  return {
    ok: true, stage, THREE, jumper, turnA, turnB, ropes: ropeSys.ropes, dbg, crowd, street, handsOut,
    get tier() { return tier; },
    wrap(game) {
      const r = game.render.bind(game);
      game.render = (ctx, view) => { r(ctx, view); frame(game, view); };
      gameRef = game;
      game.setStage3d?.(true);
      canvas.style.opacity = '1';
      return game;
    },
  };
}

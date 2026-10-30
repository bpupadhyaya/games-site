// The surfer in real 3D (presentation only: it reads the pose the 2D picture already computed and never writes back).
//
// The shared view3d layer supplies the person (athlete_m), the stage and the IK; this file authors the surfing poses on its skeleton (low stance,
// bent knees, hips over the board, chest to the wall, head turned down the line, arms out for balance, a prone paddle, a tumbling wipeout) and
// builds the board. The result is rendered into an off-screen transparent WebGL canvas and composited by art.js drawRider(), so foam, spray and
// the tube shade still draw in front of the rider and the 2D figure remains the fallback (no WebGL2, a lost context, ?fig=2d).
import { createStage, loadHuman, Clip, CLIP_BONES, semanticRot, THREE } from '../vendor3d/index.js';

const { Vector3, Quaternion, Euler, Group } = THREE;
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const bi = (n) => CLIP_BONES.indexOf(`Bip01_${n}`);

export const H_M = 1.78;                                 // standing height in metres: the 2D `size` argument maps to this
const LIGHT = { 0: 'evening', 1: 'day', 2: 'evening', 3: 'night' };
const TUNE = { day: { hemi: 0.62, keyI: 2.7, rimI: 1.7 }, evening: { hemi: 0.72, keyI: 2.4, rimI: 1.5 }, night: { hemi: 0.78, keyI: 1.9, rimI: 1.7 } };
// board length / width (m) per board index (same order as sim BOARDS)
const BOARD_M = [{ len: 2.25, wid: 0.56 }, { len: 1.78, wid: 0.5 }, { len: 1.55, wid: 0.44 }, { len: 2.0, wid: 0.47 }];
const DECK_Y = 0.045;                                    // top of the deck above the board centre line

// ------------------------------------------------------------------------------------------------------------------------------------
// surf boots: the shipped athlete wears trainers and socks. The athlete's own skinned legs and feet are kept (one continuous mesh, so the ankle never
// kinks or shows a seam); the shoe and sock-cuff region of this person's private copy of the body texture is repainted as dark neoprene booties.
function bareFeet(human) {
  const N = 1024;
  const cv = () => { const c = globalThis.document.createElement('canvas'); c.width = c.height = N; return c; };
  const read = (img) => { const c = cv(); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, N, N); return { c, g, d: g.getImageData(0, 0, N, N) }; };
  for (const m of human.mats) {
    if (m.userData.kind !== 'body' || !m.map || !m.userData.tint) continue;
    const u = m.userData.tint;
    const A = read(m.map.image), M = read(u.tMask.value.image), K = read(u.tSkin.value.image);
    const a = A.d.data, mk = M.d.data, sk = K.d.data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 540; y < 760; y += 2) for (let x = 40; x < 270; x += 2) { const i = (y * N + x) * 4; r += a[i]; g += a[i + 1]; b += a[i + 2]; n++; }
    r /= n; g /= n; b /= n;
    const paint = (x0, y0, x1, y1, test) => {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * N + x) * 4;
        if (test && !test(i)) continue;
        const L = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
        const sh = Math.pow(clamp(L / 215, 0.55, 1.12), 0.55);
        a[i] = clamp(34 * sh, 0, 255); a[i + 1] = clamp(37 * sh, 0, 255); a[i + 2] = clamp(44 * sh, 0, 255); a[i + 3] = 255;
        sk[i] = 0; mk[i] = 0; mk[i + 1] = 0; mk[i + 2] = 0;
      }
    };
    paint(225, 868, 400, 1024); paint(630, 868, 805, 1024);
    paint(0, 436, 330, 500, (i) => mk[i + 2] > 100 || (a[i] > 200 && a[i + 1] > 200));
    paint(700, 436, 1024, 500, (i) => mk[i + 2] > 100 || (a[i] > 200 && a[i + 1] > 200));
    A.g.putImageData(A.d, 0, 0); M.g.putImageData(M.d, 0, 0); K.g.putImageData(K.d, 0, 0);
    const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t; };
    m.map = tex(A.c, true); u.tMask.value = tex(M.c, false); u.tSkin.value = tex(K.c, false);
    m.needsUpdate = true;
    return new THREE.Color(r / 255, g / 255, b / 255).convertSRGBToLinear();
  }
  return new THREE.Color('#c88f68');
}

// ------------------------------------------------------------------------------------------------------------------------------------
// The board: a lofted shape (pointed nose with rocker, round tail, rails, thick in the middle), a deck with a centre stripe and a wax patch,
// and three fins. Origin at the middle of the board, nose toward +x, deck up.
function makeBoard(len, wid, col) {
  const NU = 56, NS = 14, th = 0.075, pos = [], clr = [], idx = [];
  const c0 = new THREE.Color(col[0]), c1 = new THREE.Color(col[1]), c2 = new THREE.Color(col[2]);
  const cream = new THREE.Color('#f7f1e1'), tmp = new THREE.Color();
  const outline = (u) => {                               // half width factor 0..1 along the length (u in -1..1, nose at +1)
    const e = u > 0 ? 0.86 : 0.5;
    return Math.pow(Math.max(0, 1 - u * u), e) * (1 + 0.06 * (1 - Math.abs(u - 0.12)));
  };
  const rocker = (u) => (u > 0 ? 0.12 * len * Math.pow(u, 3.2) : 0.035 * len * Math.pow(-u, 3));
  const row = (u, s, top) => {                           // s in -1..1 across
    const hw = wid / 2 * outline(u) * 0.94;
    const body = 1 - 0.55 * Math.pow(Math.abs(u), 3.5);
    const crown = 1 - 0.35 * s * s;
    const y = rocker(u * 0.98) + (top ? 1 : -1) * th * 0.5 * body * (top ? crown : (1 - 0.7 * Math.pow(Math.abs(s), 4)));
    return [u * len / 2, y, s * hw];
  };
  const stripe = (u, s, top) => {
    const rail = Math.abs(s) > 0.8;
    if (!top) return rail ? c2 : c1;
    if (rail) return cream;
    if (Math.abs(s) < 0.2) return c1;
    const pad = u < -0.05 && u > -0.7;                   // wax patch
    return pad ? tmp.copy(c0).lerp(cream, 0.5) : c0;
  };
  for (const top of [true, false]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NU; i++) for (let j = 0; j <= NS; j++) {
      const u = -1 + 2 * i / NU, s = -1 + 2 * j / NS;
      const p = row(u, s, top); pos.push(p[0], p[1], p[2]);
      const c = stripe(u, s, top); clr.push(c.r, c.g, c.b);
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NS; j++) {
      const a = base + i * (NS + 1) + j, b = a + 1, c = a + NS + 1, d = c + 1;
      if (top) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(clr, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.0, side: THREE.DoubleSide });
  const grp = new Group();
  grp.add(new THREE.Mesh(g, mat));
  const finMat = new THREE.MeshStandardMaterial({ color: c2.clone().multiplyScalar(0.55), roughness: 0.35 });
  const fin = (x, z, h, rz) => {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.05, h, 3), finMat);
    f.scale.set(1.6, 1, 0.16); f.position.set(x, -th * 0.45 - h * 0.42, z); f.rotation.z = rz;
    grp.add(f);
  };
  fin(-len * 0.4, 0, 0.1, 0.5); fin(-len * 0.32, wid * 0.22, 0.075, 0.4); fin(-len * 0.32, -wid * 0.22, 0.075, 0.4);
  return grp;
}

// ------------------------------------------------------------------------------------------------------------------------------------
// Finger poses (curl per joint for thumb..pinky, and spread): relaxed, slightly spread, tapered (the little finger curls most), no mitten or claw.
const FP = {
  // balance hands while riding: soft, slightly open, a little spread, the pinky side curled a touch more
  balance: { curl: [[0.10, 0.14, 0.08], [0.10, 0.20, 0.12], [0.16, 0.28, 0.17], [0.22, 0.36, 0.22], [0.28, 0.44, 0.28]], spread: [0.10, 0.10, 0.02, -0.05, -0.12] },
  // trailing fingers while an arm swings fast: let them stream out
  trail: { curl: [[0.06, 0.08, 0.05], [0.05, 0.10, 0.06], [0.08, 0.14, 0.09], [0.12, 0.2, 0.12], [0.16, 0.26, 0.16]], spread: [0.12, 0.14, 0.04, -0.06, -0.16] },
  // paddling: fingers together and gently cupped to scoop water; thumb tucked in
  scoop: { curl: [[0.28, 0.30, 0.18], [0.20, 0.34, 0.20], [0.22, 0.36, 0.22], [0.24, 0.38, 0.24], [0.28, 0.42, 0.26]], spread: [0.0, -0.01, -0.02, -0.02, -0.03] },
  // on the rail while pushing up: fingers spread on the deck
  press: { curl: [[0.12, 0.10, 0.05], [0.10, 0.14, 0.08], [0.12, 0.16, 0.10], [0.14, 0.18, 0.12], [0.16, 0.22, 0.14]], spread: [0.16, 0.12, 0.04, -0.06, -0.14] },
};
const fpMix = (a, b, t) => ({ curl: a.curl.map((r, i) => r.map((v, j) => v + (b.curl[i][j] - v) * t)), spread: a.spread.map((v, i) => v + (b.spread[i] - v) * t) });

// A bank of underdamped springs keyed by name: every pose channel passes through one so no value ever steps (the MOTION SMOOTHNESS GATE).
class Springs {
  constructor() { this.s = new Map(); }
  get(key, target, omega, zeta, dt) {
    let s = this.s.get(key);
    if (!s) { s = { x: target, v: 0 }; this.s.set(key, s); return target; }
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let i = 0; i < n; i++) { const a = omega * omega * (target - s.x) - 2 * zeta * omega * s.v; s.v += a * h; s.x += s.v * h; }
    return s.x;
  }
  snap() { this.s.clear(); }
}

class Pose {
  constructor(human) {
    this.h = human;
    this.clip = new Clip({ name: 'pose', frames: 1, dur: 1 / 30, fps: 30, loop: true, quats: new Float32Array(CLIP_BONES.length * 4), pelvis: new Float32Array(3), grounded: false, fingers: 'relaxed' });
    human.addClip(this.clip);
    human.groundClamp = 'off'; human.footPlanting = false;
    this.restQ = new Float32Array(human.restPose.q);
    this.e = new Euler(); this.qa = new Quaternion(); this.qb = new Quaternion();
    this.ph = human.pelvisHeight;
    this.sp = new Springs();
    human.play(this.clip, { fade: 0 });
  }
  // offs: { Bone: { flex, side, twist, abduct } } over the rest pose; pel = [left, up, fwd] in metres relative to rest. Every channel is smoothed.
  write(offs, pel, dt) {
    const q = this.clip.quats;
    q.set(this.restQ);
    for (const n in offs) {
      const i = bi(n); if (i < 0) continue;
      const g = /Arm|Forearm|Hand/.test(n) ? [15, 0.62] : /Thigh|Calf/.test(n) ? [13, 0.8] : /Head|Neck/.test(n) ? [10, 0.8] : [11, 0.78];
      const o = offs[n], sm = {};
      for (const k in o) sm[k] = this.sp.get(`${n}.${k}`, o[k], g[0], g[1], dt);
      const r = semanticRot(`Bip01_${n}`, sm);
      this.qa.set(q[i * 4], q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3]);
      this.qb.setFromEuler(this.e.set(r[0] * D2R, r[1] * D2R, r[2] * D2R, 'XYZ'));
      this.qa.multiply(this.qb);
      q[i * 4] = this.qa.x; q[i * 4 + 1] = this.qa.y; q[i * 4 + 2] = this.qa.z; q[i * 4 + 3] = this.qa.w;
    }
    for (let k = 0; k < 3; k++) this.clip.pelvis[k] = this.sp.get(`pel${k}`, pel[k], 12, 0.85, dt) / this.ph;
  }
}

// ------------------------------------------------------------------------------------------------------------------------------------
export async function createRider({ quality = 'medium', base } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: true, shadows: false, lighting: 'day', fov: 10 });
  if (!stage.supported) return null;
  stage.setSky(null, null);
  const human = await loadHuman({ character: 'athlete_m', base, kit: { top: '#14305f', bottoms: '#e5603f', socks: '#ffffff' }, skin: '#c98f66', hair: 'black' });
  bareFeet(human);
  // wet look: skin, hair and cloth are a little glossier and the cloth darker where it clings
  for (const m of human.mats || []) { if (m && m.roughness !== undefined) m.roughness = Math.max(0.28, m.roughness * 0.72); }
  const P = new Pose(human);
  const SP = P.sp;
  const pivot = new Group(), boardHolder = new Group();
  stage.add(human);
  pivot.add(human.root); pivot.add(boardHolder);
  stage.scene.add(pivot);
  // leash: a coiled cord from the back ankle to the tail (two straight segments with a sag)
  const leashMat = new THREE.MeshStandardMaterial({ color: '#1b1b1f', roughness: 0.6 });
  const leashGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 6);
  const leash = [new THREE.Mesh(leashGeo, leashMat), new THREE.Mesh(leashGeo, leashMat)];
  leash.forEach((m) => pivot.add(m));
  const cam = stage.camera, renderer = stage.renderer;
  cam.near = 1; cam.far = 120;
  const api = { ok: true, lost: false, quality, stage, human, fitted: '', log: null };
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { api.lost = false; api.fitted = ''; });

  const up = new Vector3(0, 1, 0), v = new Vector3();
  const W = (x, y, z) => { pivot.updateMatrixWorld(true); return v.set(x, y, z).applyMatrix4(pivot.matrixWorld).clone(); };
  const qFoot = (side, yaw) => new Quaternion().setFromAxisAngle(up, yaw).multiply(human._restQ[`${side}_Foot`]);
  let curBoard = -1, curCols = '';
  function setBoard(idx, cols) {
    const key = idx + cols;
    if (key === curCols) return;
    curCols = key; curBoard = idx;
    boardHolder.clear();
    boardHolder.add(makeBoard(BOARD_M[idx].len, BOARD_M[idx].wid, JSON.parse(cols)));
  }

  // ---- state ---------------------------------------------------------------------------------------------------------------------
  const S = { mode: '', modeT: 0, pop: 1, prevMode: '', hand: { L: null, R: null }, phase: 0, lastStroke: null, strokeDist: 0 };
  const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

  // All coordinates are pivot-local metres: x along the board (nose +x), y up from the board's centre line, z toward the camera.
  // Each pose writes into T: bone offsets o, pelvis pel, root position rp and euler (rx, ry, rz), hand/foot targets and finger poses.
  function poseRide(T, p, tt, dt) {
    const c = clamp(p.crouch ?? 0.4, 0, 1), ln = clamp(p.lean ?? 0, -1, 1), ar = clamp(p.arms ?? 0, -1, 1);
    // knees absorb the chop: a small fast bob that grows with the crouch, and a slow breath
    const chop = Math.sin(tt * 6.1) * 0.006 + Math.sin(tt * 9.7 + 1) * 0.004, breath = Math.sin(tt * 1.9) * 0.004;
    T.rp = [0, DECK_Y, 0]; T.rx = 0; T.ry = 0.42 - 0.08 * c + ln * 0.05; T.rz = 0;
    const crouchD = 0.13 + c * 0.3 + chop;
    const flex = 6 + c * 22 + ln * 6, twist = 16 + c * 6, side = ln * 10;
    const o = T.o;
    o.Pelvis = { flex: flex * 0.25, twist: -12 + ln * 4, side: side * 0.2 };
    o.Spine = { flex: flex * 0.28, twist: twist * 0.3 + ln * 3, side: side * 0.3 };
    o.Spine1 = { flex: flex * 0.28 + breath * 200, twist: twist * 0.35, side: side * 0.3 };
    o.Spine2 = { flex: flex * 0.28, twist: twist * 0.35, side: side * 0.2 };
    o.Neck = { flex: -flex * 0.4, twist: 22 };
    o.Head = { flex: -flex * 0.3 - 6, twist: 14 };
    const th = 36 + c * 34, ca = 46 + c * 52;
    o.L_Thigh = { flex: th, abduct: 14 + c * 6, twist: 14 }; o.R_Thigh = { flex: th, abduct: 14 + c * 6, twist: -10 };
    o.L_Calf = { flex: ca }; o.R_Calf = { flex: ca };
    o.L_UpperArm = { flex: 18, abduct: 52 }; o.R_UpperArm = { flex: 8, abduct: 62 };
    o.L_Forearm = { flex: 22 }; o.R_Forearm = { flex: 28 };
    T.pel = [0.02 + ln * 0.07, -crouchD, c * 0.05];
    const fl = 0.36 + 0.02 * c + ln * 0.05, bl = -0.3 - 0.02 * c + ln * 0.04, ankle = DECK_Y + human._ankleRest * 0.92;
    T.foot = { L: [fl, ankle, 0.02, 0.5], R: [bl, ankle, -0.02, 0.2] };
    // arms: the lead arm points along the line (the nose), the back arm trails low and behind; in a carve both swing counter to the turn
    // (turn toward +lean: lead arm rises and reaches, back arm drops), and the arms overshoot a little because their springs are underdamped
    const swing = ln * 0.16 + ar * 0.1;
    T.hand = {
      L: [0.74 + swing * 0.5 + ar * 0.06, 0.98 - c * 0.36 + ln * 0.1 + ar * 0.03, 0.2 + ln * 0.04],
      R: [-0.6 - swing * 0.6 - ar * 0.06, 0.78 - c * 0.28 - ln * 0.12 + ar * 0.1, 0.16 - ln * 0.02],
    };
    T.fing = { L: 'ride', R: 'ride' };
    T.board = [0, ln * 0.04 + (c - 0.4) * 0.03, -ln * 0.08];
  }

  function posePaddle(T, p, tt, dt) {
    // the stroke phase advances with the paddle power the sim gives (p.stroke); arms alternate: reach, catch, pull to the hip, exit, recover high
    const ph = (p.stroke ?? tt) * 6.0;
    const c1 = ph, c2 = ph + Math.PI;
    const arm = (a) => {
      const s = Math.sin(a), k = Math.cos(a);                 // k>0 reaching forward, s>0 pulling back under
      const pull = Math.max(0, s), rec = Math.max(0, -s);
      return {
        up: { flex: 28 + 48 * k, abduct: 16 + 34 * rec + 6 * pull, twist: 10 * rec },
        fore: { flex: 14 + 58 * pull + 38 * rec },
        scoop: pull > 0.1 ? 1 : 0, ext: rec,
      };
    };
    const A = arm(c1), B = arm(c2);
    if (p.armFlex !== undefined) { A.up.flex = p.armFlex; A.up.abduct = p.armAb ?? 22; A.fore.flex = p.foreFlex ?? 20; }
    // the body lies on the deck: chest high on an arch (head up looking ahead), legs together along the tail with a light flutter kick
    T.rp = [-0.74, DECK_Y + 0.115, 0]; T.rx = Math.PI / 2; T.ry = Math.PI / 2; T.rz = 0;
    const roll = Math.sin(c1) * 7;
    const o = T.o;
    o.Pelvis = { flex: -4, twist: 0 }; o.Spine = { flex: -9, twist: roll * 0.3 }; o.Spine1 = { flex: -13, twist: roll * 0.4 }; o.Spine2 = { flex: -15, twist: roll * 0.3 };
    o.Neck = { flex: -22 }; o.Head = { flex: -16, twist: 0 };
    o.L_UpperArm = A.up; o.R_UpperArm = B.up; o.L_Forearm = A.fore; o.R_Forearm = B.fore;
    const kick = Math.sin(tt * 11);
    o.L_Thigh = { flex: -4 + 7 * kick, abduct: 3 }; o.R_Thigh = { flex: -4 - 7 * kick, abduct: 3 };
    o.L_Calf = { flex: 6 + 10 * Math.max(0, kick) }; o.R_Calf = { flex: 6 + 10 * Math.max(0, -kick) };
    T.pel = [0, 0, 0];
    T.foot = { L: null, R: null }; T.hand = { L: null, R: null };
    T.fing = { L: fpMix(FP.trail, FP.scoop, A.scoop), R: fpMix(FP.trail, FP.scoop, B.scoop) };
    T.board = [0, 0, 0];
    T.noSmoothRoot = false;
  }

  // standing up from prone: chest up and hands to the rail, hips lift and feet come under, then rise into the stance with the arms out
  function posePop(T, p, tt, dt, k) {
    posePaddle(T, { stroke: 0 }, tt, dt);
    const R = { o: {}, hand: {} }; poseRide(R, p, tt, dt);
    const a = ease(k / 0.35), b = ease((k - 0.25) / 0.4), d = ease((k - 0.55) / 0.45);
    const o = T.o;
    // phase 1 (chest up): both hands flat by the ribs, back arched
    const press = (1 - b);
    o.L_UpperArm = { flex: 10 + 10 * (1 - a), abduct: 38 }; o.R_UpperArm = { flex: 10 + 10 * (1 - a), abduct: 38 };
    o.L_Forearm = { flex: 80 * (1 - a) + 10 }; o.R_Forearm = { flex: 80 * (1 - a) + 10 };
    const arch = -30 * a * press;
    o.Spine = { flex: arch * 0.4 }; o.Spine1 = { flex: arch * 0.4 }; o.Spine2 = { flex: arch * 0.4 }; o.Neck = { flex: -28 * a * press }; o.Head = { flex: -18 };
    // phase 2 (hips lift, feet under)
    const t2 = b;
    T.rx = Math.PI / 2 * (1 - d) * (1 - 0.0); T.ry = lerp(Math.PI / 2, 0.42, b);
    T.rp = [lerp(-0.74, 0.0, b), lerp(DECK_Y + 0.115, DECK_Y, d) + 0.28 * Math.sin(Math.PI * b) * (1 - d), 0];
    const rd = R.o;
    for (const n of ['L_Thigh', 'R_Thigh', 'L_Calf', 'R_Calf', 'Pelvis']) {
      const from = o[n] || {}, to = rd[n] || {};
      const m = {}; for (const kk of new Set([...Object.keys(from), ...Object.keys(to)])) m[kk] = lerp(from[kk] || 0, to[kk] || 0, t2);
      o[n] = m;
    }
    o.L_Thigh.flex += 55 * Math.sin(Math.PI * b); o.R_Thigh.flex += 30 * Math.sin(Math.PI * b);
    o.L_Calf.flex += 70 * Math.sin(Math.PI * b); o.R_Calf.flex += 50 * Math.sin(Math.PI * b);
    T.pel = [0, lerp(0, R.pel[1], d), lerp(0, R.pel[2], d)];
    const w = ease((k - 0.3) / 0.35);
    T.foot = { L: w > 0.01 ? [R.foot.L[0], R.foot.L[1], R.foot.L[2], R.foot.L[3]] : null, R: w > 0.01 ? R.foot.R : null, w };
    // phase 3: the hands leave the rail and the arms swing out
    const rel = ease((k - 0.55) / 0.3);
    for (const n of ['L_UpperArm', 'R_UpperArm', 'L_Forearm', 'R_Forearm']) {
      const from = o[n], to = rd[n] || R.o[n] || {};
      const m = {}; for (const kk of new Set([...Object.keys(from), ...Object.keys(to)])) m[kk] = lerp(from[kk] || 0, to[kk] || 0, rel);
      o[n] = m;
    }
    for (const n of ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head']) {
      const from = o[n] || {}, to = rd[n] || {}; const m = {};
      for (const kk of new Set([...Object.keys(from), ...Object.keys(to)])) m[kk] = lerp(from[kk] || 0, to[kk] || 0, d);
      o[n] = m;
    }
    T.hand = rel > 0.02 ? { L: R.hand.L, R: R.hand.R, w: rel } : { L: null, R: null };
    T.fing = { L: fpMix(FP.press, FP.balance, rel), R: fpMix(FP.press, FP.balance, rel) };
    T.board = [0, 0, 0];
  }

  function poseWipe(T, p, tt, dt) {
    const w = p.t || 0, f = Math.sin(tt * 14);
    const hop = Math.sin(Math.min(1, w * 1.4) * Math.PI);
    T.rp = [w * 1.55 - 0.1, 0.8 * hop - w * 0.61 + 0.9, 0]; T.rx = 0; T.ry = 0.3; T.rz = -w * 6.5;
    const o = T.o;
    o.Pelvis = { flex: 25 }; o.Spine = { flex: 10 }; o.Spine1 = { flex: 10 }; o.Spine2 = { flex: 10 }; o.Neck = { flex: 10 }; o.Head = { flex: 5 };
    o.L_UpperArm = { flex: 60 * f, abduct: 70 }; o.R_UpperArm = { flex: -60 * f, abduct: 70 };
    o.L_Forearm = { flex: 20 }; o.R_Forearm = { flex: 20 };
    o.L_Thigh = { flex: 50 - 25 * f, abduct: 22 }; o.R_Thigh = { flex: 50 + 25 * f, abduct: 22 };
    o.L_Calf = { flex: 70 }; o.R_Calf = { flex: 70 };
    T.pel = [0, -0.5, 0]; T.foot = { L: null, R: null }; T.hand = { L: null, R: null };
    T.fing = { L: 'trail', R: 'trail' };
    T.boardPos = [-w * 1.05 - 0.2, 0.35 * Math.sin(Math.min(1, w * 1.2) * Math.PI) - w * 0.15, 0]; T.boardRot = [0, 0, w * 2.6 - 0.4];
    T.board = [0, 0, 0];
  }

  // ---- drawing ---------------------------------------------------------------------------------------------------------------------
  const RG = { x0: -2.2, x1: 2.2, y0: -0.9, y1: 3.1 };
  const RW = { x0: -2.6, x1: 4.4, y0: -2.6, y1: 2.8 };
  let lastT = null;
  const cost = { ema: 0, n: 0 };
  const eu = new Euler(), qroot = new Quaternion();

  function frame(devW, devH, R) {
    const key = `${devW}x${devH}:${R === RW ? 'w' : 'g'}`;
    if (api.fitted === key) return;
    api.fitted = key;
    renderer.setPixelRatio(1); renderer.setSize(devW, devH, false);
    const hM = R.y1 - R.y0, D = 40;
    cam.aspect = devW / devH;
    cam.fov = 2 * Math.atan(hM / 2 / D) / D2R;
    const tx = (R.x0 + R.x1) / 2, ty = (R.y0 + R.y1) / 2, pitch = 7 * D2R;
    cam.position.set(tx, ty + D * Math.sin(pitch), D * Math.cos(pitch));
    cam.lookAt(tx, ty, 0);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }

  const fingerFor = (n, ar, speed) => {
    if (n === 'ride') return fpMix(FP.balance, FP.trail, clamp(speed / 2.5, 0, 1));
    return typeof n === 'string' ? FP[n] : n;
  };
  const rideFing = { L: 0, R: 0 };

  // x, y: board centre on the screen; size: standing height in 2D units. Returns false when the 3D picture cannot be shown.
  api.draw = function (ctx, x, y, size, pose, boardIdx, t, cols) {
    if (api.lost || stage.contextLost) return false;
    const t0 = globalThis.performance.now();
    const mode = pose.mode || 'ride';
    const R = mode === 'wipe' ? RW : RG;
    const ppm = size / H_M;
    const m = ctx.getTransform(), sc = Math.hypot(m.a, m.b);
    const wM = R.x1 - R.x0, hM = R.y1 - R.y0;
    const cap = api.quality === 'low' ? 760 : 1200;
    const k = Math.min(1, cap / Math.max(1, wM * ppm * sc));
    const devW = Math.max(64, Math.round(wM * ppm * sc * k)), devH = Math.max(64, Math.round(hM * ppm * sc * k));
    setBoard(boardIdx, JSON.stringify(cols));
    const dt = lastT === null ? 1 / 60 : clamp(t - lastT, 0, 0.1); lastT = t;
    if (dt === 0 && api.fitted && !api.dirtyOnce) { /* same time: still redraw */ }
    if (api.light !== (LIGHT[pose.beach] || 'day')) { api.light = LIGHT[pose.beach] || 'day'; stage.setLighting(api.light, TUNE[api.light]); stage.setSky(null, null); }

    // mode change: remember it so the pop-up can run
    if (S.mode !== mode) { S.prevMode = S.mode; S.mode = mode; S.modeT = 0; if (S.prevMode === 'paddle' && mode === 'ride') S.pop = 0; }
    S.modeT += dt;
    if (S.pop < 1) S.pop = Math.min(1, S.pop + dt / 0.85);
    const T = { o: {}, pel: [0, 0, 0], rp: [0, 0, 0], rx: 0, ry: 0, rz: 0, hand: { L: null, R: null }, foot: { L: null, R: null }, fing: { L: 'balance', R: 'balance' }, board: [0, 0, 0] };
    if (mode === 'paddle') posePaddle(T, pose, t, dt);
    else if (mode === 'wipe') poseWipe(T, pose, t, dt);
    else if (S.pop < 1) posePop(T, pose, t, dt, S.pop);
    else poseRide(T, pose, t, dt);
    // smoothing of everything that is not a bone offset
    const g = (key, val, om = 12, ze = 0.85) => SP.get(key, val, om, ze, dt);
    human.root.position.set(g('rpx', T.rp[0]), g('rpy', T.rp[1]), g('rpz', T.rp[2]));
    eu.set(g('rx', T.rx, 14), g('ry', T.ry, 14), g('rz', T.rz, 14), 'YXZ');
    human.root.quaternion.setFromEuler(eu); human.facing = eu.y;
    // board
    boardHolder.position.set(...(T.boardPos || [0, 0, 0])); boardHolder.rotation.set(...(T.boardRot || [0, 0, 0]));
    boardHolder.rotation.x += g('bx', T.board[0], 9, 0.6); boardHolder.rotation.z += g('bz', T.board[1], 9, 0.6); boardHolder.rotation.y += g('by', T.board[2], 9, 0.6);
    pivot.rotation.set(0, mode === 'wipe' ? 0 : -((pose.yaw || 0) * D2R), 0);
    P.write(T.o, T.pel, dt);
    // hands and feet: targets are smoothed in pivot-local space, with the arm springs underdamped so the arms overshoot slightly
    for (const sd of ['L', 'R']) {
      const h = T.hand[sd];
      if (h) {
        const wgt = g(`hw${sd}`, T.hand.w ?? 0.9, 14, 1);
        const hx = g(`hx${sd}`, h[0], 11, 0.55), hy = g(`hy${sd}`, h[1], 11, 0.55), hz = g(`hz${sd}`, h[2], 11, 0.6);
        S.hand[sd] = [hx, hy, hz];
        pivot.updateMatrixWorld(true);
        human.setReach(sd, W(hx, hy, hz), { weight: clamp(wgt, 0, 0.92) });
      } else { SP.get(`hw${sd}`, 0, 14, 1, dt); human.setReach(sd, null); S.hand[sd] = null; }
      const f = T.foot[sd];
      if (f) {
        const fw = g(`fw${sd}`, T.foot.w ?? 1, 14, 1);
        const fx = g(`fx${sd}`, f[0], 16, 1), fy = g(`fy${sd}`, f[1], 16, 1), fz = g(`fz${sd}`, f[2], 16, 1), fyw = g(`fyw${sd}`, f[3], 12, 1);
        pivot.updateMatrixWorld(true);
        human.setReachFoot(sd, W(fx, fy, fz), clamp(fw, 0, 1), qFoot(sd, fyw));
      } else human.setReachFoot(sd, null);
    }
    // fingers: pose chosen by the arm's speed (fast arm = fingers stream, slow = soft balance hands)
    for (const sd of ['L', 'R']) {
      let sp = 0;
      const hv = SP.s.get(`hx${sd}`);
      if (hv) sp = Math.abs(hv.v);
      const fp = fingerFor(T.fing[sd], 0, sp);
      human.setFingers(sd, typeof fp === 'string' ? fp : fp, { rate: 14 });
    }
    // leash: ankle (back foot) to the tail
    pivot.updateMatrixWorld(true);
    const bm = BOARD_M[curBoard] || BOARD_M[0];
    const a = human.bones.Bip01_R_Foot.getWorldPosition(new Vector3());
    const tail = new Vector3(-bm.len / 2 + 0.05, 0.0, 0).applyMatrix4(boardHolder.matrixWorld);
    const mid = a.clone().lerp(tail, 0.5); mid.y -= 0.07 + 0.03 * Math.sin(t * 4);
    const seg = (m, p0, p1) => { const d = p1.clone().sub(p0), L = d.length(); m.position.copy(p0).addScaledVector(d, 0.5); m.scale.set(1, Math.max(0.01, L), 1); m.quaternion.setFromUnitVectors(up, d.normalize()); m.parent.worldToLocal(m.position); };
    seg(leash[0], a, mid); seg(leash[1], mid, tail);
    leash.forEach((m) => { m.visible = mode !== 'wipe'; });
    human.update(dt);
    frame(devW, devH, R);
    stage.render();
    ctx.drawImage(renderer.domElement, x + R.x0 * ppm, y - R.y1 * ppm, wM * ppm, hM * ppm);
    if (api.log) {
      const L = {}; for (const n of ['Bip01_Pelvis', 'Bip01_L_Foot', 'Bip01_R_Foot', 'Bip01_L_Hand', 'Bip01_R_Hand', 'Bip01_Head', 'Bip01_L_Forearm', 'Bip01_R_Forearm', 'Bip01_L_Calf', 'Bip01_R_Calf']) {
        const b = human.bones[n]; if (b) { const p = b.getWorldPosition(new Vector3()); L[n] = [p.x, p.y, p.z]; }
      }
      api.log.push({ t, mode, L });
    }
    const ms = globalThis.performance.now() - t0;
    cost.ema = cost.n ? cost.ema * 0.95 + ms * 0.05 : ms; cost.n++;
    if (cost.n > 90 && cost.ema > 12 && api.quality !== 'low') { api.quality = 'low'; stage.setQuality('low'); api.fitted = ''; }
    return true;
  };

  api.light = '';
  return api;
}

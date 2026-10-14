// One stilt walker: a real athlete skeleton posed every frame from the simulation, standing on two bamboo stilts.
//
// The simulation (src/sim.js) owns where the body, the planted tip and the free stilt are. src/figure.js `walkerJoints()` already turns a racer
// into joints in road metres (hip, shoulder, tips, grips, how far the torso leans); this rig maps those joints into the 3D scene and lets the
// procedural pose layer (actor.js) put a believable body on them: both feet on the footrests, both hands on the poles, the knees bent when the
// free stilt reaches, the torso leaning by the simulated lean, the weight carried over the planted stilt, the head looking down the road.
//
//   scene mapping  X = r.x + (x - r.x) * s ;  Y = laneOffset + y * s ;  Z = side   (s = lane scale, same as the 2D art, so terrain, shadows,
//                  rings and name tags line up exactly)
//   falls          the whole figure (body + both stilts) pivots about the planted tip by the same angle the 2D art uses, then the sim stands
//                  the walker up again
// Nothing flows back to the simulation.
import { THREE } from '../vendor3d/index.js';
import { Actor } from './actor.js';
import { walkerJoints, BODY } from '../src/figure.js';
import { PHYS, swingDur, trail } from '../src/sim.js';
import { groundH } from '../src/courses.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Qn = () => new THREE.Quaternion();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEG = 180 / Math.PI;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, u) => a + (b - a) * u;
const UP = V(0, 1, 0), Z_AXIS = V(0, 0, 1);

// ---- bamboo --------------------------------------------------------------------------------------------------------------------------
let _bambooTex = null;
function bambooTexture() {
  if (_bambooTex) return _bambooTex;
  const c = globalThis.document.createElement('canvas'); c.width = 128; c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 128, 0);
  gr.addColorStop(0, '#6e7a22'); gr.addColorStop(0.28, '#b9c752'); gr.addColorStop(0.5, '#d9e285'); gr.addColorStop(0.75, '#a3b13e'); gr.addColorStop(1, '#5d6a1c');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 512);
  // fine fibre streaks along the cane
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${40 + (i * 37) % 60},${50 + (i * 53) % 50},10,${0.05 + (i % 5) * 0.015})`; g.fillRect((i * 29) % 128, 0, 1 + (i % 2), 512); }
  // nodes: a dark ring with a lighter swelling either side
  for (let i = 0; i < 6; i++) {
    const y = 40 + i * 84 + ((i * 17) % 11);
    g.fillStyle = 'rgba(255,255,230,0.18)'; g.fillRect(0, y - 9, 128, 6);
    g.fillStyle = 'rgba(48,52,12,0.85)'; g.fillRect(0, y - 3, 128, 6);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y + 3, 128, 5);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  _bambooTex = t; return t;
}

// One stilt: pole + footrest (peg lashed with cord) + a worn rubber-wrapped tip. Built along +Y from the origin, moved by setEnds().
export function createPole(s = 1) {
  const g = new THREE.Group();
  const len = BODY.pole;
  const mat = new THREE.MeshStandardMaterial({ map: bambooTexture(), roughness: 0.55, metalness: 0 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.04, len, 14, 1), mat); pole.position.y = len / 2; g.add(pole);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.031, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6b7220, roughness: 0.7 })); cap.position.y = len; g.add(cap);
  // footrest: a short cane lashed across the pole, pointing inward (toward the body, -Z for the near pole before mirroring)
  const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.26, 10), new THREE.MeshStandardMaterial({ color: 0x8a5a24, roughness: 0.75 }));
  peg.rotation.z = Math.PI / 2; peg.rotation.y = 0; peg.position.set(0.0, BODY.footH - 0.03, 0.0);
  // the peg lies along X in pole space (toward the toe side) so the foot rests on it fore-aft... the foot is wide in Z, the peg is a platform
  const platform = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.12), new THREE.MeshStandardMaterial({ color: 0x80521f, roughness: 0.8 }));
  platform.position.set(0.03, BODY.footH - 0.052, 0.0);
  g.add(platform); g.userData.peg = peg;
  // cord lashing
  const cord = new THREE.MeshStandardMaterial({ color: 0x2a1a0c, roughness: 0.9 });
  for (const dy of [-0.075, -0.03, 0.02]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.008, 6, 14), cord); r.rotation.x = Math.PI / 2; r.position.y = BODY.footH - 0.03 + dy; g.add(r); }
  // rubber tip (an old tyre strip) so the stilt reads as a stilt, not a stick
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.05, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0x1d1a18, roughness: 0.9 })); tip.position.y = 0.05; g.add(tip);
  g.scale.setScalar(s);
  g.traverse((o) => { o.castShadow = false; });
  return g;
}

function placePole(g, base, top) {
  // g is built along +Y; orient it from base to top (positions are world; z is set by the caller)
  g.position.copy(base);
  const d = top.clone().sub(base), len = d.length() || 1;
  g.quaternion.setFromUnitVectors(UP, d.multiplyScalar(1 / len));
}

// ---- smoothing helpers ------------------------------------------------------------------------------------------------------------------
const hash1 = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** critically damped / under-damped scalar spring (visual only; never flows back to the simulation) */
class Sp {
  constructor(x = 0) { this.x = x; this.v = 0; }
  snap(x) { this.x = x; this.v = 0; return x; }
  crit(t, w, dt) {
    const e = this.x - t, tmp = (this.v + w * e) * dt, ex = Math.exp(-w * dt);
    this.x = t + (e + tmp) * ex; this.v = (this.v - w * tmp) * ex; return this.x;
  }
  under(t, w, z, dt) {
    const n = Math.max(1, Math.ceil(dt * w * 4)), h = dt / n;
    for (let i = 0; i < n; i++) { this.v += (-w * w * (this.x - t) - 2 * z * w * this.v) * h; this.x += this.v * h; }
    return this.x;
  }
}
/** Absorbs a discontinuity in a tracked target: the output stays continuous and the offset eases out (stand-up, role swaps, fall start). */
class Ab {
  constructor(n) { this.n = n; this.off = new Array(n).fill(0); this.vel = new Array(n).fill(0); this.last = null; this.out = null; }
  reset() { this.last = null; this.out = null; this.off.fill(0); this.vel.fill(0); }
  run(raw, dt, speedThr, w = 11, force = false) {
    const o = new Array(this.n);
    if (!this.last) { this.last = raw.slice(); this.out = raw.slice(); return raw.slice(); }
    let jump = force;
    for (let i = 0; i < this.n; i++) if (Math.abs(raw[i] - this.last[i]) / Math.max(dt, 1e-3) > speedThr) jump = true;
    for (let i = 0; i < this.n; i++) {
      if (jump) { this.off[i] = this.out[i] - raw[i]; this.vel[i] = 0; }
      const e = this.off[i], tmp = (this.vel[i] + w * e) * dt, ex = Math.exp(-w * dt);
      this.off[i] = (e + tmp) * ex; this.vel[i] = (this.vel[i] - w * tmp) * ex;
      o[i] = raw[i] + this.off[i];
    }
    this.last = raw.slice(); this.out = o.slice();
    return o;
  }
}

export class WalkerRig {
  /** human: a loaded athlete (scale already includes the lane scale). lane: 0..3. s: lane scale. */
  constructor(human, { lane = 0, s = 1, laneDy = 0.5 } = {}) {
    this.h = human; this.lane = lane; this.s = s;
    this.a = new Actor(human);
    this.poles = { N: createPole(s), F: createPole(s) };
    this.g = this.a.groundAnkle;
    const sh = this.a.b.R.up.getWorldPosition(V());
    this.shUp = sh.y - this.a.pelvisRest.y;                      // pelvis to the shoulder joint, standing
    this.armLen = this.a.rest.R.armLen;
    this.legLen = this.a.rest.R.legLen;
    this.st = { init: false, ph: lane * 1.3, last: null };
    this.out = { head: V(), tag: V() };
    this.laneDy = laneDy;
    this.initState();
  }
  initState() {
    const S = this.st;
    S.init = false;
    S.abBase = { N: new Ab(2), F: new Ab(2) }; S.abAng = { N: new Ab(1), F: new Ab(1) }; S.abHip = new Ab(2);
    S.flex = { N: new Sp(), F: new Sp() };
    S.lean = new Sp(); S.wz = new Sp(); S.bob = new Sp(); S.twist = new Sp(); S.gripN = new Sp(); S.gripF = new Sp(); S.lookY = new Sp();
    S.side = new Sp(); S.bend = new Sp(); S.prevPhase = 'ready'; S.prevFoot = 0; S.T = null; S.sw = null; S.fcx = undefined; S.fcy = undefined;
  }
  get group() { return [this.h.root, this.poles.N, this.poles.F]; }
  setVisible(v) { this.h.root.visible = v; this.poles.N.visible = v; this.poles.F.visible = v; }

  /**
   * r: the simulated racer. C: its course. env: { dt (sim seconds since the last pose, 0 = nothing new), laneDy, fallDur, zb }
   * Two stages: a tick stage (only when the simulation advanced) turns the sim state into SMOOTH body targets (snap absorbers, springs, weight
   * transfer, landing compression, stilt flex, counter-twist), then the pose stage puts the skeleton on them. Nothing flows back to the sim.
   */
  step(r, C, env) {
    const S = this.st, dt = env.dt || 0;
    if (!S.init) this.initState();
    const first = !S.T;
    if (dt > 0 || first) { this._tick(r, C, env, Math.max(dt, 1 / 60), first); return this._pose(env, dt); }
    return this.res;                         // nothing new from the simulation: the skeleton keeps its pose
  }

  _tick(r, C, env, dt, first) {
    const S = this.st, s = this.s;
    if (first) {
      const hh = hash1(r.id * 13.7 + r.look * 5.3 + this.lane);
      S.v = { amp: 0.8 + 0.4 * hash1(hh * 91), breath: 1.9 + 0.9 * hash1(hh * 17), ph: hh * 6.28, bias: (hash1(hh * 29) - 0.5) * 0.07, grip: 0.5 + 0.12 * hash1(hh * 41), sway: 1.2 + 0.7 * hash1(hh * 53), twist: 0.7 + 0.7 * hash1(hh * 67) };
      S.ph = hh * 20;
    }
    const V0 = S.v;
    S.ph += dt;
    const off = (3 - this.lane) * (env.laneDy ?? this.laneDy);
    const J = walkerJoints(r, C);
    const M = (p) => [r.x + (p[0] - r.x) * s, off + p[1] * s];
    // ---- poles: positions and angles through snap absorbers ------------------------------------------------------------------------------
    // The free stilt (3D only): it hangs under the body and swings through while the body passes over the planted stilt, so a tap only has to
    // carry it the last stretch (the sim's own 0.16 s kick covers the whole stride, which reads as a whip).
    const uu = r.x - r.f;
    let fbx, fby;
    if (r.phase === 'swing') {
      if (!S.sw) S.sw = { x: S.fcx ?? r.x - 0.2, y: S.fcy ?? 0.2 };
      const sp = clamp(r.swingT / swingDur(r), 0, 1), e = smooth(sp);
      const tx = r.x + PHYS.R, ty = groundH(C, tx);
      fbx = lerp(S.sw.x, tx, e); fby = lerp(S.sw.y, ty, e) + 0.2 * Math.sin(Math.PI * sp);
    } else {
      S.sw = null;
      const t = trail(r.prevF, r.x), c = smooth((uu + 0.15) / 0.65);
      fbx = lerp(t.x, r.x + 0.02, c * 0.92);
      fby = groundH(C, fbx) + t.lift * (1 - 0.35 * c);
    }
    S.fcx = fbx; S.fcy = fby;
    const faRaw = clamp(Math.atan2(r.x + 0.12 - fbx, BODY.grip - 0.05), -0.75, 0.75);
    const near = J.nearPlanted ? { b: M(J.nearBase), a: Math.atan2(J.nearDir[0], J.nearDir[1]) } : { b: M([fbx, fby]), a: faRaw };
    const far = J.nearPlanted ? { b: M([fbx, fby]), a: faRaw } : { b: M(J.farBase), a: Math.atan2(J.farDir[0], J.farDir[1]) };
    const raw = { N: near, F: far };
    // a landing (swing -> stance), a fall and a stand-up change which stilt is planted: ease the role change instead of snapping it
    const landed = S.prevPhase === 'swing' && r.phase === 'stance';
    const downEdge = (S.prevPhase === 'down') !== (r.phase === 'down');
    const releasing = J.nearPlanted ? 'F' : 'N';          // after a landing only the stilt that was just released is eased; the planted tip must not glide
    const pol = {};
    for (const k of ['N', 'F']) {
      const ease = downEdge || (landed && k === releasing);
      const b = S.abBase[k].run(raw[k].b, dt, 16 * s, ease ? 9 : 11, ease), a = S.abAng[k].run([raw[k].a], dt, 14, ease ? 9 : 11, ease)[0];
      pol[k] = { b, a };
    }
    // landing compression + stilt flex
    if (landed) {
      const plantedK = J.nearPlanted ? 'N' : 'F';
      S.flex[plantedK].v += clamp(r.v, 0, 3) * 0.55;
      S.bob.v -= (0.35 + clamp(r.v, 0, 3) * 0.28) * s;            // the knees take the landing
    }
    if (S.prevPhase === 'stance' && r.phase === 'swing') S.bob.v -= 0.22 * s;       // small anticipation crouch at the tap
    if (S.prevPhase !== 'down' && r.phase === 'down') { S.flex.N.v += 0.8; S.flex.F.v -= 0.8; }
    S.prevPhase = r.phase;
    const flexA = {};
    for (const k of ['N', 'F']) {
      S.flex[k].under(0, 24, 0.2, dt);
      S.flex[k].x = clamp(S.flex[k].x, -0.09, 0.09);
      flexA[k] = S.flex[k].x;
    }
    S.bob.under(0, 21, 0.42, dt); S.bob.x = clamp(S.bob.x, -0.08 * s, 0.02 * s);
    // direction of each pole including its flex (the flex pivots about the planted tip, so nothing slides)
    const dirN = [Math.sin(pol.N.a + flexA.N), Math.cos(pol.N.a + flexA.N)], dirF = [Math.sin(pol.F.a + flexA.F), Math.cos(pol.F.a + flexA.F)];
    const baseN = pol.N.b, baseF = pol.F.b;
    // ---- feet on the footrests --------------------------------------------------------------------------------------------------------------
    const ankleH = this.g;
    const peg = (base, dir, d = BODY.footH) => [base[0] + dir[0] * d * s, base[1] + dir[1] * d * s];
    const aN = peg(baseN, dirN), aF = peg(baseF, dirF);
    const ZN = 0.215 * s, ZF = -0.215 * s;
    const fN = [aN[0] + dirN[0] * ankleH, aN[1] + dirN[1] * ankleH], fF = [aF[0] + dirF[0] * ankleH, aF[1] + dirF[1] * ankleH];
    // ---- pelvis: above both feet; weight transfer toward the planted stilt, landing compression -----------------------------------------
    const hipX = r.x + (J.hip[0] - r.x) * s;
    const L = this.legLen * 0.935;                // a slightly soft knee: never fully locked, so the IK has no singular pop
    const hipYFor = (f) => { const dx = hipX - f[0]; return f[1] + Math.sqrt(Math.max(0.02 * s * s, L * L - dx * dx)); };
    const plantedF = J.nearPlanted ? fN : fF, freeF = J.nearPlanted ? fF : fN;
    const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); };
    let hipY = smin(hipYFor(plantedF), hipYFor(freeF) + 0.04 * s, 0.07 * s);
    hipY = Math.max(hipY, Math.max(plantedF[1] + L * 0.7, freeF[1] + L * 0.4));
    const hp = S.abHip.run([hipX, hipY], dt, 14 * s);
    const down = r.phase === 'down';
    const hipYs = hp[1] + (down ? 0 : S.bob.x);
    const tor0 = J.tor + V0.bias;
    if (first) { S.lean.snap(tor0); S.lookY.snap(hipYs + 0.95 * s); S.wz.snap(0); S.twist.snap(0); S.gripN.snap(0); S.gripF.snap(0); S.side.snap(0); S.bend.snap(0); }
    const lean = S.lean.crit(tor0, 12, dt);
    const wzT = (J.nearPlanted ? 1 : -1) * 0.055 * s * (down ? 0.3 : 1);
    const wz = S.wz.crit(wzT, 8, dt);
    // ---- balance: torso side/twist counter the swinging leg; roll from the wobble --------------------------------------------------------
    const roll = clamp(J.roll, -1.2, 1.2);
    const swingSide = J.nearPlanted ? 1 : -1;                          // the far leg swings when the near one is planted
    const sw = r.phase === 'swing' ? Math.sin(Math.PI * clamp(r.swingT / swingDur(r), 0, 1)) : 0;
    const twistT = (swingSide * sw * 6 + swingSide * 1.2) * V0.twist * (down ? 0 : 1);
    const twist = S.twist.crit(twistT, 9, dt);
    const sideT = roll * 8 + Math.sin(S.ph * V0.sway + V0.ph) * 0.9 * V0.amp - swingSide * sw * 2.2;
    const side = S.side.crit(sideT, 10, dt);
    let ang = 0;
    if (r.phase === 'down') {
      const dur = env.fallDur ?? PHYS.DOWN_T, tt = r.standT;
      const sign = r.downKind === 'back' ? -1 : 1, mag = r.downKind === 'side' ? 1.25 : r.downKind === 'splash' ? 1.35 : 1.45;
      ang = sign * mag * smooth(tt / 0.42);
      if (tt > dur - 0.5) ang *= 1 - smooth((tt - (dur - 0.5)) / 0.5);
    }
    const bendT = clamp(lean * DEG * 1.05, -25, 34) + (r.phase === 'swing' ? 3 + 2 * sw : 0) + (S.bob.x / s) * -40;
    const bend = S.bend.crit(down ? lerp(bendT, 10, 0.5) : bendT, 14, dt);
    const breathe = Math.sin(S.ph * V0.breath + V0.ph) * 0.005 * s * V0.amp;
    const rollA = roll * 0.1 * (down ? 0 : 1);
    // grips: the hands slide smoothly along the cane (the want-height follows the shoulder)
    const shY = hipYs + this.shUp * Math.cos(lean), shX = hp[0] + this.shUp * Math.sin(lean);
    // the hand holds the cane where it passes closest to a comfortable hold point in front of the chest (never at full stretch: the elbow
    // would flip), and slides there smoothly
    const holdY = shY - this.armLen * V0.grip, holdX = shX + 0.1 * s;
    // [lo, hi, wanted] along the cane; the hand may lag its wanted spot but never leaves [lo, hi] (not through the shoulder, not at full stretch)
    const gripB = (base, dir) => {
      const t = (holdX - base[0]) * dir[0] + (holdY - base[1]) * dir[1];
      const hi = Math.max(0.75 * s, Math.min((BODY.pole - 0.25) * s, (shY - this.armLen * 0.36 - base[1]) / Math.max(0.3, dir[1])));
      const lo = Math.min(hi, Math.max(0.7 * s, (shY - this.armLen * 0.95 - base[1]) / Math.max(0.3, dir[1])));
      return [lo, hi, clamp(t, lo, hi)];
    };
    const bN = gripB(baseN, dirN), bF = gripB(baseF, dirF), gN = S.gripN, gF = S.gripF;
    if (first) { gN.snap(bN[2]); gF.snap(bF[2]); }
    gN.crit(bN[2], 12, dt); gN.x = clamp(gN.x, bN[0], bN[1]);
    gF.crit(bF[2], 12, dt); gF.x = clamp(gF.x, bF[0], bF[1]);
    const flail = Math.abs(roll) * 0.1 * s;
    // ---- world points (before the fall rotation) -------------------------------------------------------------------------------------------
    const P3 = {
      pelvis: [hp[0], hipYs + breathe, wz],
      topN: [baseN[0] + dirN[0] * BODY.pole * s, baseN[1] + dirN[1] * BODY.pole * s, ZN + rollA * BODY.pole * s * 0.5],
      topF: [baseF[0] + dirF[0] * BODY.pole * s, baseF[1] + dirF[1] * BODY.pole * s, ZF + rollA * BODY.pole * s * 0.5],
      bN: [baseN[0], baseN[1], ZN], bF: [baseF[0], baseF[1], ZF],
      gN: [baseN[0] + dirN[0] * gN.x + flail * 0.5, baseN[1] + dirN[1] * gN.x + flail * 0.7, ZN + rollA * gN.x * 0.5],
      gF: [baseF[0] + dirF[0] * gF.x - flail * 0.35, baseF[1] + dirF[1] * gF.x + flail * 0.9, ZF + rollA * gF.x * 0.5],
      fN: [fN[0], fN[1], 0.125 * s], fF: [fF[0], fF[1], -0.125 * s],
    };
    // the fall: pivot everything about the planted tip
    const pv = J.nearPlanted ? baseN : baseF;
    const cr = Math.cos(-ang), sr = Math.sin(-ang);
    if (ang) for (const k of Object.keys(P3)) {
      const p = P3[k], x = p[0] - pv[0], y = p[1] - pv[1];
      p[0] = pv[0] + x * cr - y * sr; p[1] = pv[1] + x * sr + y * cr;
    }
    // head: eye height is stabilised against the torso bob
    const lookY = S.lookY.crit(hipYs + 0.95 * s, 6, dt);
    S.T = { P3, dirN: [dirN[0] * cr - dirN[1] * sr, dirN[0] * sr + dirN[1] * cr], dirF: [dirF[0] * cr - dirF[1] * sr, dirF[0] * sr + dirF[1] * cr],
      ang, bend, side, twist, roll, down, lookY, lookX: r.x + 5, swing: r.phase === 'swing', zb: env.zb || 0, nearPlanted: J.nearPlanted };
    this.res = { ang, hipY: hipYs };
    this._dtPose = dt;
    const zz = (p) => [p[0], p[1], p[2] + (env.zb || 0)];
    this.dbg = { rx: r.x, s, bN, shY, holdY, gx: gN.x, bnY: baseN[1], dy: dirN[1], arm: this.armLen, shUp: this.shUp, baseN: zz(P3.bN), baseF: zz(P3.bF), footN: zz(P3.fN), footF: zz(P3.fF), gripN: zz(P3.gN), gripF: zz(P3.gF) };
    S.init = true;
  }

  _pose(env, dt) {
    const S = this.st, T = S.T, h = this.h, a = this.a, s = this.s;
    const P3 = T.P3, v = (p) => V(p[0], p[1], p[2] + T.zb);
    const pelvis = v(P3.pelvis), footN = v(P3.fN), footF = v(P3.fF), gripN = v(P3.gN), gripF = v(P3.gF);
    const poleBaseN = v(P3.bN), poleBaseF = v(P3.bF), poleTopN = v(P3.topN), poleTopF = v(P3.topF);
    const yawQ = Qn().setFromAxisAngle(UP, Math.PI / 2);
    const bq = Qn().setFromAxisAngle(Z_AXIS, -T.ang).multiply(yawQ);
    const down = T.down;
    const lookT = V(T.lookX, T.lookY + (T.down ? 0 : 0), T.zb);
    const P = {
      pelvis, yaw: Math.PI / 2, bodyQ: bq, groundY: 0,
      torso: { bend: T.bend, side: T.side, twist: T.twist },
      pelvisTilt: { bend: 2, side: T.roll * 3, twist: -T.twist * 0.6 },
      legs: {}, arms: {},
      look: { target: lookT, w: down ? 0.2 : 0.85 },
    };
    const aimFor = (dir) => ({ n: [-dir[0], -dir[1], 0], fwd: [dir[1], -dir[0], 0], face: 'sole', w: 1 });
    P.legs.R = { p: [footN.x, footN.y, footN.z], f: 'w', w: 1, pole: [1, 0.1, 0.05], pf: 'w', aim: aimFor(T.dirN) };
    P.legs.L = { p: [footF.x, footF.y, footF.z], f: 'w', w: 1, pole: [1, 0.1, -0.05], pf: 'w', aim: aimFor(T.dirF) };
    P.arms.R = { p: [gripN.x, gripN.y, gripN.z], f: 'w', w: 1, pole: [-0.5, -0.35, 1], pf: 'w' };
    P.arms.L = { p: [gripF.x, gripF.y, gripF.z], f: 'w', w: 1, pole: [-0.5, -0.35, -1], pf: 'w' };
    h.setPosition(0, 0, 0); h.setFacing(0); h.update(dt);
    a.apply(P, dt);
    h.setFingers('L', 'fist'); h.setFingers('R', 'fist');
    placePole(this.poles.N, poleBaseN, poleTopN);
    placePole(this.poles.F, poleBaseF, poleTopF);
    this.out.head = h.bonePosition('Head', this.out.head);
    this._posed = true;
    void s;
    return this.res;
  }
}

export { BODY };

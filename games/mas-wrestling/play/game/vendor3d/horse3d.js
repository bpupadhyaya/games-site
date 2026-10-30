// horse3d: ONE shared, rigged, natural-looking horse for every Arcforge riding game.
//   const horse = await loadHorse({ coat: 'bay', mane: 'loose', tack: 'western', quality: 'high' });
//   stage.add(horse); stage.track(horse);                   // horse.root is a THREE.Group (+Z forward, +X left, +Y up, origin on the ground)
//   horse.drive(speedMps, yawRate)   // or locomote(speed) + setTurn(rate): gait, stride phase and lead leg follow the DISTANCE travelled
//   horse.attachRider(human, { style: 'western' });         // seat bones, stirrup feet and rein hands are solved with the human's IK
// The gait solver is the planted-foot, distance-driven solver of the barrel-racing horse (continuous speed blend walk -> trot -> canter -> gallop,
// lead leg from the turn direction, banking and spine curvature in turns), driving a real skeleton: spine, neck, head, jaw, ears, 4 legs with
// fetlock (pastern) and hoof, tail. Mane / tail / forelock are strand cards on a verlet chain (horsehair.js); tack in horsetack.js.
import * as THREE from './three.js';
import { defaultAssetBase } from './human.js';
import { paintCoat, coatSpec, muzzleColor, HORSE_COATS } from './horsecoat.js';
import { HorseHair } from './horsehair.js';
import { HorseFace } from './horseface.js';
import { buildTack } from './horsetack.js';
import { attachRiderTo } from './horserider.js';

export { HORSE_COATS };
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);
const wrapAng = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// gaits: S = stance sweep (m), duty = stance fraction, off = phase offsets of [LH, LF, RH, RF] (left lead), lift = hoof lift (m)
export const HORSE_GAITS = [
  { name: 'walk', v: 1.3, S: 0.78, duty: 0.70, off: [0.0, 0.25, 0.5, 0.75], lift: 0.16, pitch: 0.012, bob: 0.012, bobK: 2, neck: 0.10, ext: 0.0, tailUp: 0.0 },
  { name: 'trot', v: 3.9, S: 1.05, duty: 0.46, off: [0.0, 0.5, 0.5, 0.0], lift: 0.26, pitch: 0.02, bob: 0.034, bobK: 2, neck: 0.05, ext: 0.12, tailUp: 0.25 },
  { name: 'canter', v: 7.0, S: 1.14, duty: 0.38, off: [0.0, 0.66, 0.33, 0.33], lift: 0.32, pitch: 0.075, bob: 0.05, bobK: 1, neck: 0.12, ext: 0.45, tailUp: 0.55 },
  { name: 'gallop', v: 11.0, S: 1.18, duty: 0.29, off: [0.0, 0.57, 0.12, 0.45], lift: 0.34, pitch: 0.095, bob: 0.06, bobK: 1, neck: 0.14, ext: 0.9, tailUp: 0.9 },
];
const MIRROR = [2, 3, 0, 1];           // LH LF RH RF
const LEGS = [{ side: 'L', front: false }, { side: 'L', front: true }, { side: 'R', front: false }, { side: 'R', front: true }];
export function gaitAt(v) {
  const G = HORSE_GAITS;
  let i = 0; while (i < G.length - 2 && v > G[i + 1].v) i++;
  const a = G[i], b = G[i + 1];
  const t = smooth(0, 1, clamp((v - a.v) / (b.v - a.v), 0, 1));
  const o = { i, t, name: t < 0.5 ? a.name : b.name };
  for (const k of ['S', 'duty', 'lift', 'pitch', 'bob', 'neck', 'ext', 'tailUp']) o[k] = lerp(a[k], b[k], t);
  o.bobK = lerp(a.bobK, b.bobK, t);
  o.off = a.off.map((x, j) => x + wrapAng((b.off[j] - x) * TAU) / TAU * t);
  if (v < G[0].v) { const w = clamp(v / G[0].v, 0, 1); o.S = lerp(0.35, G[0].S, w); o.lift = lerp(0.1, G[0].lift, w); o.name = 'walk'; }
  if (v > G[G.length - 1].v) { const w = clamp((v - G[G.length - 1].v) / 4, 0, 1); o.S = G[3].S + 0.05 * w; o.name = 'gallop'; }
  return o;
}

const cache = new Map();
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const QTMP = new THREE.Quaternion();

/** rotate `bone` (identity rest rotation, world-aligned) so its rest direction `d0` points along `want` (group frame). parentQ = parent's group-frame rotation. */
function aim(bone, d0, want, parentQ, outQ) {
  outQ.setFromUnitVectors(d0, want);                      // desired group-frame rotation of the bone
  bone.quaternion.copy(parentQ).invert().multiply(outQ);
  return outQ;
}

export class Horse3D {
  constructor({ scene, info, quality }) {
    this.root = new THREE.Group(); this.root.name = 'horse3d';
    this.model = scene; this.root.add(scene);
    this.info = { height: 3.0, ...info }; this.quality = quality;
    this.b = {}; scene.traverse((o) => { if (o.isBone) this.b[o.name] = o; });
    this.meshes = []; scene.traverse((o) => { if (o.isSkinnedMesh) { o.frustumCulled = false; this.meshes.push(o); } });
    for (const bn of info.bones) { const sn = bn.n.replace(/[.\[\]:\/]/g, ''); if (!this.b[bn.n] && this.b[sn]) this.b[bn.n] = this.b[sn]; }   // three.js strips '.' from node names
    this.rest = {}; for (const bn of info.bones) this.rest[bn.n] = V(...bn.w);
    this.tip = {}; for (const k of ['LF', 'RF', 'LH', 'RH']) this.tip[k] = V(...info.hoofGround[k]);
    this._listeners = {};
    // runtime state (the same smoothed state set as the barrel-racing solver)
    this.phase = 0; this.t = Math.random() * 10; this.lead = 1; this.v = 0; this.yawRate = 0; this.tier = quality;
    this.sm = { pitch: 0, bob: 0, roll: 0, kappa: 0, neck: 0, head: 0, ext: 0, neckYaw: 0, tailUp: 0, mw: 0, accel: 0, vv: 0 };
    this.prevPhase = [0, 0, 0, 0];
    this.target = { v: 0, yaw: 0 };
    this.action = null; this._act = { w: 0 };
    this.gait = 'idle'; this.footEvents = [];
    this._buildLegs();
    this._prevPos = new THREE.Vector3(); this._prevVel = new THREE.Vector3(); this.accelLocal = new THREE.Vector3(); this.angVel = 0; this._prevYaw = 0; this._first = true;
    this._invQ = new THREE.Quaternion();
    this.ears = [0, 0]; this.earT = 3 + Math.random() * 4; this.jaw = 0;
    this._refPose();
  }

  _buildLegs() {
    const r = this.rest;
    this.legs = LEGS.map((L, i) => {
      const s = L.side, f = L.front;
      const names = f ? [`FrontArm.${s}`, `FrontCannon.${s}`, `FrontPastern.${s}`, `FrontHoof.${s}`] : [`Thigh.${s}`, `Gaskin.${s}`, `BackCannon.${s}`, `BackPastern.${s}`, `BackHoof.${s}`];
      const bones = names.map((n) => this.b[n]);
      const tip = this.tip[s + (f ? 'F' : 'H')];
      const pts = names.map((n) => r[n]); pts.push(tip);
      const dirs = names.map((_, k) => pts[k + 1].clone().sub(pts[k]).normalize());
      const len = names.map((_, k) => pts[k + 1].distanceTo(pts[k]));
      const hoofV = tip.clone().sub(r[names[names.length - 1]]), pasV = r[names[names.length - 1]].clone().sub(r[names[names.length - 2]]);
      return {
        i, side: s, front: f, names, bones, dirs, len, rest: pts, tip, x: tip.x, z0: tip.z,
        ap0: Math.atan2(pasV.z, -pasV.y), ah0: Math.atan2(hoofV.z, -hoofV.y), Lp: pasV.length(), Lh: hoofV.length(),
        gz: tip.z, gy: 0, ap: 0, ah: 0, phi: 0, stance: true, u: 0,
      };
    });
  }

  _refPose() {
    // world-aligned rest, group-frame positions of the hip/shoulder joints for the IK
    this.root.updateMatrixWorld(true);
  }

  // ---- events / API ----------------------------------------------------------------------------------------------------
  on(name, fn) { (this._listeners[name] = this._listeners[name] || []).push(fn); return this; }
  off(name, fn) { const l = this._listeners[name]; if (l) this._listeners[name] = l.filter((f) => f !== fn); return this; }
  _emit(name, e) { const l = this._listeners[name]; if (l) for (const f of l) f(e); }

  setPosition(x, y, z) { this.root.position.set(x, y, z); }
  setFacing(yaw) { this.root.rotation.y = yaw; }
  /** Set the travel state from the sim: speed m/s along the heading and yaw rate rad/s (+ = turning left). */
  drive(speed, yawRate = 0) { this.target.v = Math.max(0, speed); this.target.yaw = yawRate; return this; }
  locomote(speedMps) { this.target.v = Math.max(0, speedMps); return this; }
  setTurn(rate) { this.target.yaw = rate; return this; }
  /** play('walk'|'trot'|'canter'|'gallop', {speed}) pins a gait at a speed; 'idle' stops; 'graze' | 'rear' | 'buck' | 'skid' | 'swish' | 'snort' are actions. */
  play(name, o = {}) {
    const g = HORSE_GAITS.find((x) => x.name === name);
    if (g) { this.action = null; this.target.v = o.speed || (name === 'walk' ? 1.5 : name === 'trot' ? 3.6 : name === 'canter' ? 6.5 : 10.5); if (o.lead) this.lead = o.lead === 'R' || o.lead === -1 ? -1 : 1; return this; }
    if (name === 'idle') { this.action = null; this.target.v = 0; return this; }
    if (['graze', 'rear', 'buck', 'skid', 'snort', 'shake'].includes(name)) {
      const dur = { graze: 0, rear: 1.5, buck: 1.0, skid: 1.0, snort: 1.1, shake: 1.2 }[name];
      this.action = { name, t: 0, dur: o.duration ?? dur, hold: dur === 0 };
      if (name === 'skid') this.action.v0 = this.v;
      return this;
    }
    throw new Error(`horse3d: unknown clip "${name}"`);
  }
  stop() { if (this.v > 6) this.play('skid'); else this.target.v = 0; return this; }
  setQuality(t) { this.tier = t; if (this.hair) this.hair.setQuality(t); }
  setCoat(spec) {
    this.coat = coatSpec(spec);
    for (const m of this.meshes) {
      const cls = m.userData.cls;
      paintCoat(m.geometry, cls, this.coat);
      // 'high' quality: the sheen lobe is ADDED on top of the vertex-coloured diffuse. A white sheen turned black/bay coats grey-white at
      // grazing angles and under a bright environment (icon renders). Real hair sheen carries the hair colour: tint it by the coat.
      const mt = m.material;
      if (mt && mt.isMeshPhysicalMaterial && mt.sheen > 0 && mt.sheenColor) {
        const b = new THREE.Color(this.coat.body);
        mt.sheenColor.copy(b).lerp(new THREE.Color('#ffffff'), 0.18);
      }
    }
    if (this.hair) this.hair.setColors(this.coat);
    if (this.face) this.face.setColors(this.coat, muzzleColor(this.coat));
    return this;
  }
  setMane(style) { if (this.hair) this.hair.setStyle(style); return this; }
  setTack(style, o) { if (this.tack) { this.tack.dispose(); this.tack = null; } this.tackStyle = style; if (style && style !== 'none') { this.tack = buildTack(this, style, o); } if (this.rider) this.rider.retune(); return this; }
  attachRider(human, o = {}) { if (this.rider) this.rider.dispose(); this.rider = attachRiderTo(this, human, o); return this.rider; }
  detachRider() { if (this.rider) { this.rider.dispose(); this.rider = null; } }
  /** footfall info for one frame: [{leg:'LH'|'LF'|'RH'|'RF', front, side}] */
  dispose() { this.root.removeFromParent(); this.meshes.forEach((m) => { m.geometry.dispose(); [].concat(m.material).forEach((x) => x.dispose()); }); if (this.hair) this.hair.dispose(); if (this.face) this.face.dispose(); if (this.tack) this.tack.dispose(); }

  // ---- per-frame --------------------------------------------------------------------------------------------------------
  update(dt) {
    dt = Math.min(dt, 0.1);
    if (dt <= 0) return true;
    const root = this.root;
    root.updateMatrixWorld(true);
    // kinematics of the group (for hair inertia): local acceleration and yaw rate
    const wp = V().setFromMatrixPosition(root.matrixWorld);
    const q = root.getWorldQuaternion(new THREE.Quaternion());
    if (this._first) { this._prevPos.copy(wp); this._first = false; }
    const vel = wp.clone().sub(this._prevPos).divideScalar(dt);
    this.accelLocal.copy(vel).sub(this._prevVel).divideScalar(dt).applyQuaternion(this._invQ.copy(q).invert());
    this._prevVel.copy(vel); this._prevPos.copy(wp);
    this.worldSpeed = vel.length();

    const T = this.target;
    // speed follows the target with a gentle limit (a horse does not teleport to a gallop)
    const dv = T.v - this.v, ac = dv > 0 ? 6 : 12;
    this.v += clamp(dv, -ac * dt, ac * dt);
    this.yawRate += (T.yaw - this.yawRate) * Math.min(1, dt * 10);
    this.t += dt;
    const v = this.v, m = this.sm;
    const g = gaitAt(v); this.gait = v < 0.15 ? 'idle' : g.name;
    const mw = smooth(0.12, 0.8, v);
    m.mw += (mw - m.mw) * Math.min(1, dt * 8);
    if (v < 4.6 && Math.abs(this.yawRate) > 0.3) this.lead = this.yawRate > 0 ? 1 : -1;
    // phase advances with the DISTANCE travelled: planted feet cannot slide
    this.phase = fract(this.phase + (v > 0.05 ? v * g.duty / g.S : 0) * dt * m.mw);
    const accel = (v - m.vv) / Math.max(dt, 1e-3); m.vv = v;
    m.accel += (clamp(accel, -8, 8) - m.accel) * Math.min(1, dt * 5);

    const off = this.lead >= 0 ? g.off : [g.off[MIRROR[0]], g.off[MIRROR[1]], g.off[MIRROR[2]], g.off[MIRROR[3]]];
    this.footEvents.length = 0;
    const act = this._updateAction(dt);
    const lag = act ? 1 : 0;
    for (let l = 0; l < 4; l++) {
      const L = this.legs[l];
      const p = fract(this.phase + off[l]);
      let zo = 0, yo = 0, swing = 0, stanceU = 0, inSt = true;
      if (p < g.duty) { stanceU = p / g.duty; zo = g.S * (0.5 - stanceU); }
      else {
        inSt = false;
        const u = (p - g.duty) / (1 - g.duty);
        swing = Math.sin(u * Math.PI);
        // cycloid: zero ground velocity at lift-off and touchdown, so the planted foot (stance) and the swing join without a pop
        const st = g.S * 1.0, stride = g.S / g.duty;
        zo = -g.S * 0.5 + st * u - (stride / TAU) * Math.sin(TAU * u) * 1.0 + 0 * 0;
        yo = g.lift * Math.pow(swing, 0.85) * (L.front ? 1.0 : 0.9);
        if (L.front) zo += 0.08 * swing * g.t;
      }
      L.u2 = inSt ? 0 : (p - g.duty) / (1 - g.duty);
      const pp = this.prevPhase[l]; this.prevPhase[l] = p;
      if (m.mw > 0.5 && pp > p && p < 0.1 && pp > 0.9) {
        const e = { leg: (L.side + (L.front ? 'F' : 'H')), front: L.front, side: L.side, gait: g.name, speed: v };
        this.footEvents.push(e); this._emit('hoof', e);
      }
      const w = m.mw;
      const zi = L.z0 + lerp(0, zo, w) + (L.front ? 0.0 : (0.14 + 0.1 * g.ext) * w), xi = L.tip.x * (1 - 0.15 * m.mw * g.t);
      // curved paths: a planted foot stays fixed in the WORLD, so in the body frame it turns against the yaw (x,z rotated by -dpsi each stance frame);
      // the correction is released over the swing so the next touchdown lands at its ideal place
      if (inSt) {
        const dps = this.yawRate * dt * (v > 0.05 ? 1 : 0);
        const qx = xi + (L.cx || 0), qz = zi + (L.cz || 0);
        const cs = Math.cos(dps), sn = Math.sin(dps);
        L.cx = qx * cs - qz * sn - xi; L.cz = qx * sn + qz * cs - zi;
        L.c0x = L.cx; L.c0z = L.cz;
      } else {
        const rel = 1 - smooth(0, 0.85, L.u2 ?? 0);
        L.cx = (L.c0x || 0) * rel; L.cz = (L.c0z || 0) * rel;
      }
      L.gz = zi + (L.cz || 0) * w;
      L.gy = lerp(0, yo, w);
      L.stance = inSt || w < 0.2; L.u = inSt ? stanceU : swing; L.u2 = inSt ? 0 : (p - g.duty) / (1 - g.duty);
      const sw = inSt ? 0 : swing, load = inSt ? Math.sin(stanceU * Math.PI) : 0;
      const gs = 0.12 + 0.2 * g.t;       // fetlock drop rises with speed
      L.ap = L.ap0 + (-(L.front ? 0.9 : 0.6) * sw + gs * load) * w;
      L.ah = L.ah0 + (-(L.front ? 0.6 : 0.4) * sw) * w;
      L.phi = inSt ? 0 : (0.95 * sw - 0.5 * Math.pow(1 - L.u2, 3)) * w;
      L.x = xi + (L.cx || 0) * w;
    }
    if (act) this._applyAction(act, dt);
    this._body(dt, g, v, act);
    this._solveLegs();
    if (this.hair) this.hair.update(dt, this);
    if (this.tack) this.tack.update(dt, this);
    if (this.rider) this.rider.update(dt);
    return true;
  }

  _body(dt, g, v, act) {
    const m = this.sm, b = this.b, rest = this.rest;
    const ph = this.phase * TAU, yawRate = this.yawRate, lat = yawRate * v;
    const mw = m.mw;
    const tgtPitch = g.pitch * Math.sin(ph + 0.6) * mw + clamp(m.accel * 0.006, -0.06, 0.06);
    const tgtBob = g.bob * Math.cos(g.bobK * ph + 0.3) * mw;
    const tgtRoll = clamp(lat * 0.012, -0.22, 0.22);
    const tgtK = (v > 0.4 ? clamp(yawRate / Math.max(v, 1.5), -0.55, 0.55) : 0);
    const k = (r) => Math.min(1, dt * r);
    m.pitch += (tgtPitch - m.pitch) * k(18); m.bob += (tgtBob - m.bob) * k(22);
    m.roll += (tgtRoll - m.roll) * k(6); m.kappa += (tgtK - m.kappa) * k(6);
    m.ext += (g.ext * mw - m.ext) * k(3);
    const neckBase = lerp(0.05, -0.12, m.ext);
    const nod = Math.sin(ph + 2.1) * g.neck * mw;
    const idleNod = Math.sin(this.t * 0.9) * 0.03 * (1 - mw);
    m.neck += (neckBase + nod * 0.6 + idleNod - m.neck) * k(14);
    m.head += (lerp(-0.05, 0.05, m.ext) + nod * 0.9 + 0.06 * Math.sin(this.t * 0.6 + 1.2) * (1 - mw) - m.head) * k(14);
    m.neckYaw += (clamp(yawRate * 0.26, -0.5, 0.5) - m.neckYaw) * k(5);
    // action overrides
    const A = this._act;
    const breath = Math.sin(this.t * (2.0 + 0.5 * clamp(v, 0, 11))) * (0.012 + 0.012 * mw);
    // ---- root: bob + pitch about the barrel centre + roll
    const pivot = V(0, 1.15, 0.0);
    const pitchX = -(m.pitch + (A.pitch || 0));            // theirs: + = nose up; rotation about +X is nose down
    const rollZ = -m.roll + (A.roll || 0);                 // lean INTO the turn
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitchX, 0, rollZ, 'XYZ'));
    const rr = b.Root; const rp = this.rest.Root;
    const piv = A.pivot || pivot;
    const rel = rp.clone().sub(piv).applyQuaternion(q).add(piv);
    rr.position.copy(rel).add(V(0, m.bob - 0.012 + (A.y || 0), (A.z || 0)));
    rr.quaternion.copy(q);
    // ---- spine: undulation with stride + curvature in turns (yaw about Y, + = left)
    const und = (0.03 * m.ext + 0.012 * mw) * Math.sin(ph + 0.9);
    const bend = clamp(m.kappa * 0.55, -0.4, 0.4);
    const setRot = (name, ex, ey, ez) => { const bo = b[name]; if (bo) bo.quaternion.setFromEuler(new THREE.Euler(ex, ey, ez, 'XYZ')); };
    setRot('Pelvis', 0.5 * und, -bend * 0.25, 0);
    setRot('Spine1', -0.5 * und + breath * 0.2, bend * 0.35, 0);
    setRot('Spine2', 0.2 * und, bend * 0.35, 0);
    setRot('Spine3', 0.3 * und + (A.chest || 0), bend * 0.3, 0);
    // neck: theirs neckPitch + = raised; rotation about +X lowers, so negate
    const np = -(m.neck + (A.neck || 0)), hp = -(m.head + (A.head || 0));
    const ny = clamp(m.neckYaw, -0.6, 0.6);
    setRot('Neck1', np * 0.45 - 0.0, ny * 0.35, 0);
    setRot('Neck2', np * 0.35, ny * 0.35, 0);
    setRot('Neck3', np * 0.2, ny * 0.3, 0);
    setRot('Head', hp + (A.headNod || 0), ny * 0.2 + (A.headYaw || 0), 0);
    // jaw and ears
    this.jaw += ((A.jaw || 0) - this.jaw) * k(12);
    setRot('Jaw', this.jaw, 0, 0);
    this.earT -= dt; if (this.earT < 0) { this.earT = 2 + Math.random() * 6; this._flick = 0.35; }
    this._flick = (this._flick || 0) * Math.max(0, 1 - dt * 5);
    const back = A.earsBack || 0;
    const fl = this._flick * Math.sin(this.t * 40) * 0.3;
    for (const s of ['L', 'R']) {
      const sg = s === 'L' ? 1 : -1;
      const pit = (s === 'L' ? this._flick * 0.8 : 0) - back * 0.9 + 0.1 * Math.sin(this.t * 0.8 + sg);
      setRot(`Ear1.${s}`, pit * 0.6, sg * (fl * 0.5 - back * 0.1), sg * -0.12);
      setRot(`Ear2.${s}`, pit * 0.3, 0, 0); setRot(`Ear3.${s}`, pit * 0.1, 0, 0);
    }
    // tail: lifts with speed (tailUp), swings with turns and lateral accel (chain follow-through is the hair strands)
    const tailUp = lerp(0.0, 0.8, g.tailUp * mw);
    this._tailYaw = (this._tailYaw || 0) + ((-yawRate * 0.22 + Math.sin(this.t * 1.7) * (0.12 + 0.1 * (1 - clamp(v / 11, 0, 1))) * (1 + (A.swish || 0))) - (this._tailYaw || 0)) * k(9);
    for (let i = 1; i <= 7; i++) setRot(`Tail${i}`, (i === 1 ? tailUp : tailUp * 0.1) + 0.04, this._tailYaw * (i === 1 ? 0.5 : 0.25), 0);
    this.root.updateMatrixWorld(true);
  }

  // ---- legs: foot target -> fetlock from the pastern/hoof angles -> two-bone (+ hock) IK --------------------------------
  _solveLegs() {
    const root = this.root;
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const qRoot = root.getWorldQuaternion(new THREE.Quaternion()), qInv = qRoot.clone().invert();
    const P = V(), K = V(), F = V(), Hh = V(), G = V(), pole = V(0, 0, 1), tmp = V(), d = V();
    const gq = new THREE.Quaternion();
    const parentQ = (bone) => bone.parent.getWorldQuaternion(new THREE.Quaternion()).premultiply(qInv);
    const gpos = (bone, out) => out.setFromMatrixPosition(bone.matrixWorld).applyMatrix4(inv);
    const vec = (a, L, out) => out.set(0, -Math.cos(a) * L, Math.sin(a) * L);
    for (const L of this.legs) {
      const front = L.front;
      G.set(L.x, L.gy, L.gz);
      const aT = L.ap, hT = L.ah;
      const Lp = L.Lp, Lh = L.Lh;
      // fetlock F = G - hoofVec(ah) - pasternVec(ap)
      F.copy(G).sub(vec(hT, Lh, tmp)); const hoofVec = vec(hT, Lh, V()); const pasVec = vec(aT, Lp, V());
      F.copy(G).sub(hoofVec).sub(pasVec);
      const bones = L.bones, len = L.len;
      gpos(bones[0], Hh);
      let pb = parentQ(bones[0]);
      if (front) {
        const a = len[0], b2 = len[1];
        this._two(Hh, F, a, b2, pole, K, 0.5);
        pasVec.copy(pasVec); 
        aim(bones[0], L.dirs[0], tmp.copy(K).sub(Hh).normalize(), pb, gq);
        bones[0].updateMatrixWorld(true);
        const q1 = gq.clone();
        aim(bones[1], L.dirs[1], tmp.copy(F).sub(K).normalize(), q1, gq);
        const q2 = gq.clone();
        aim(bones[2], L.dirs[2], pasVec.clone().normalize(), q2, gq);
        const q3 = gq.clone();
        aim(bones[3], L.dirs[3], hoofVec.clone().normalize(), q3, gq);
      } else {
        // hind leg: planar thigh / gaskin / cannon chain with the reciprocal apparatus (hock flexion follows stifle flexion)
        const [l1, l2, l3] = len;
        const th = this._planar3(L, Hh, F, l1, l2, l3);
        const d1 = V(0, -Math.cos(th[0]), Math.sin(th[0])), d2 = V(0, -Math.cos(th[1]), Math.sin(th[1])), d3 = V(0, -Math.cos(th[2]), Math.sin(th[2]));
        // lateral offset of the target (hip -> fetlock) is spread over the segments in proportion to their vertical drop
        const lx = F.x - Hh.x;
        const c1 = l1 * Math.cos(th[0]), c2 = l2 * Math.cos(th[1]), c3 = l3 * Math.cos(th[2]);
        const cs = Math.max(0.2, c1 + c2 + c3);
        d1.x = lx * Math.cos(th[0]) / cs; d2.x = lx * Math.cos(th[1]) / cs; d3.x = lx * Math.cos(th[2]) / cs;
        d1.normalize(); d2.normalize(); d3.normalize();
        aim(bones[0], L.dirs[0], d1, pb, gq);
        const q1 = gq.clone();
        aim(bones[1], L.dirs[1], d2, q1, gq);
        const q2 = gq.clone();
        aim(bones[2], L.dirs[2], d3, q2, gq);
        const q3 = gq.clone();
        aim(bones[3], L.dirs[3], pasVec.clone().normalize(), q3, gq);
        const q4 = gq.clone();
        aim(bones[4], L.dirs[4], hoofVec.clone().normalize(), q4, gq);
        L.reach = 1;
      }
    }
    this.root.updateMatrixWorld(true);
  }

  /** planar 3-link IK for the hind leg (angles from straight down, forward +): returns [thigh, gaskin, cannon]; warm-started from the previous frame. */
  _planar3(L, H, T, l1, l2, l3) {
    const Fs0 = L.rs0 ?? (L.rs0 = Math.atan2(L.dirs[0].z, -L.dirs[0].y) - Math.atan2(L.dirs[1].z, -L.dirs[1].y));
    const Fh0 = L.rh0 ?? (L.rh0 = Math.atan2(L.dirs[2].z, -L.dirs[2].y) - Math.atan2(L.dirs[1].z, -L.dirs[1].y));
    const k = 0.95;
    const fk = (a, g, out) => {
      const c = g + Fh0 + k * ((a - g) - Fs0);
      const y = -(l1 * Math.cos(a) + l2 * Math.cos(g) + l3 * Math.cos(c)), z = l1 * Math.sin(a) + l2 * Math.sin(g) + l3 * Math.sin(c);
      out[0] = y; out[1] = z; out[2] = c; return out;
    };
    let a = L.sa ?? Math.atan2(L.dirs[0].z, -L.dirs[0].y), g = L.sg ?? Math.atan2(L.dirs[1].z, -L.dirs[1].y);
    const ty = T.y - H.y, tz = T.z - H.z;
    const o = [0, 0, 0], o1 = [0, 0, 0], o2 = [0, 0, 0], e = 1e-3;
    for (let it = 0; it < 8; it++) {
      fk(a, g, o);
      const ry = ty - o[0], rz = tz - o[1];
      if (Math.abs(ry) + Math.abs(rz) < 1e-4) break;
      fk(a + e, g, o1); fk(a, g + e, o2);
      const j00 = (o1[0] - o[0]) / e, j10 = (o1[1] - o[1]) / e, j01 = (o2[0] - o[0]) / e, j11 = (o2[1] - o[1]) / e;
      const det = j00 * j11 - j01 * j10;
      if (Math.abs(det) < 1e-5) break;
      let da = (j11 * ry - j01 * rz) / det, dg = (-j10 * ry + j00 * rz) / det;
      const m = Math.max(Math.abs(da), Math.abs(dg)); if (m > 0.4) { da *= 0.4 / m; dg *= 0.4 / m; }
      a += da; g += dg;
      // joint limits: stifle/hock never hyper-extend (thigh stays ahead of the gaskin), and stay inside a sane swing range
      a = clamp(a, -0.5, 1.3); g = clamp(g, -1.5, 0.3);
      if (a - g < 0.5) { const mid = (a + g) / 2; a = mid + 0.25; g = mid - 0.25; }
    }
    L.sa = a; L.sg = g;
    return [a, g, g + Fh0 + k * ((a - g) - Fs0)];
  }

  /** two-bone IK: knee/stifle position for hip H, target T, lengths a,b, bend direction `pole` (group frame). Clamps the reach. */
  _two(H, T, a, b, pole, out, minD = 0) {
    const d = T.clone().sub(H); let l = d.length();
    const max = a + b - 1e-3, min = Math.max(Math.abs(a - b) + 1e-3, minD);
    const lc = clamp(l, min, max); d.normalize();
    const x = (lc * lc + a * a - b * b) / (2 * lc), h = Math.sqrt(Math.max(0, a * a - x * x));
    const p = pole.clone().sub(d.clone().multiplyScalar(pole.dot(d))).normalize();
    out.copy(H).addScaledVector(d, x).addScaledVector(p, h);
    if (lc !== l) T.copy(H).addScaledVector(d, lc);
    return T;
  }

  // ---- actions (graze, rear, buck, skid, ...) ---------------------------------------------------------------------------
  _updateAction(dt) {
    const A = this.action; const a = this._act;
    for (const k of Object.keys(a)) if (k !== 'w') a[k] = (typeof a[k] === 'number') ? a[k] * Math.max(0, 1 - dt * 6) : a[k];
    delete a.pivot;
    if (!A) { a.w = Math.max(0, a.w - dt * 4); return null; }
    A.t += dt;
    if (!A.hold && A.t > A.dur) { this.action = null; this.target.v = 0; return null; }
    a.w = Math.min(1, a.w + dt * 5);
    return A;
  }
  _applyAction(A, dt) {
    const a = this._act, t = A.t, u = A.hold ? 1 : clamp(t / A.dur, 0, 1);
    const env = A.hold ? smooth(0, 0.6, t) : Math.sin(Math.PI * u);
    const up = (L) => { L.gy += 0; };
    const H = this.legs;                       // 0 LH 1 LF 2 RH 3 RF
    if (A.name === 'graze') {
      this.target.v = 0;
      a.neck = -0.9 * env; a.head = -0.35 * env; a.jaw = 0.18 * Math.max(0, Math.sin(t * 7)) * env; a.earsBack = 0.0;
      a.neck += 0; a.headNod = 0.3 * env;
      // one fore leg steps ahead while grazing
      H[1].gz += 0.18 * env; H[1].gy += 0.0;
    } else if (A.name === 'rear') {
      this.target.v = 0;
      const e = Math.pow(env, 0.8);
      a.pitch = 0.62 * e; a.y = 0.18 * e; a.z = -0.1 * e; a.neck = 0.1 * e; a.earsBack = 0.5 * e; a.jaw = 0.25 * e;
      a.pivot = V(0, 0.2, -0.84);
      for (const i of [1, 3]) { H[i].gz = H[i].z0 + 0.45 * e; H[i].gy = 0.55 * e; H[i].ap = H[i].ap0 - 0.9 * e; H[i].ah = H[i].ah0 - 0.7 * e; }
      for (const i of [0, 2]) { H[i].gz = H[i].z0 - 0.1 * e; H[i].gy = 0; }
    } else if (A.name === 'buck') {
      const e = Math.sin(Math.PI * clamp(u * 1.4, 0, 1));
      a.pitch = -0.38 * e; a.neck = -0.35 * e; a.head = -0.2 * e; a.earsBack = 0.7 * e; a.y = 0.05 * e;
      a.pivot = V(0, 0.2, 0.66);
      for (const i of [0, 2]) { H[i].gy = 0.65 * e; H[i].gz = H[i].z0 - 0.35 * e; H[i].phi = 0.3 * e; H[i].ap = H[i].ap0 - 0.8 * e; H[i].ah = H[i].ah0 - 0.4 * e; }
    } else if (A.name === 'skid') {
      const e = env;
      this.v = Math.max(0, A.v0 * (1 - u) * (1 - u)); this.target.v = 0;
      a.pitch = 0.2 * e; a.neck = 0.2 * e; a.head = 0.15 * e; a.earsBack = 0.4 * e;
      for (const i of [0, 2]) { H[i].gz = H[i].z0 + 0.35 * e; H[i].gy = 0; H[i].ap = H[i].ap0 + 0.4 * e; }
      for (const i of [1, 3]) { H[i].gz = H[i].z0 + 0.18 * e; H[i].gy = 0; }
    } else if (A.name === 'snort') { a.neck = 0.15 * env; a.head = 0.25 * env; a.jaw = 0.1 * env; this.target.v = 0; }
    else if (A.name === 'shake') { a.headYaw = 0.5 * Math.sin(t * 22) * env; a.neck = 0.05; this.target.v = 0; }
  }
}

export async function loadHorse(spec = {}) {
  const base = spec.base || defaultAssetBase();
  const quality = spec.quality || 'high';
  const key = `horse:${base}`;
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      const [info, buf] = await Promise.all([
        fetch(`${base}animals/horse.json`).then((r) => { if (r.status >= 400) throw new Error('view3d: horse.json ' + r.status); return r.json(); }),
        fetch(`${base}animals/horse.glb`).then((r) => { if (r.status >= 400) throw new Error('view3d: horse.glb ' + r.status); return r.arrayBuffer(); }),
      ]);
      const gltf = await new THREE.GLTFLoader().parseAsync(buf, `${base}animals/`);
      return { info, gltf };
    })());
  }
  const { info, gltf } = await cache.get(key);
  const scene = THREE.SkeletonUtils.clone(gltf.scene);
  const horse = new Horse3D({ scene, info, quality });
  // materials per class (vertex-coloured coat)
  for (const m of horse.meshes) {
    const prims = Array.isArray(m.material) ? m.material : [m.material];
    m.userData.cls = prims[0].name;
    const cls = prims[0].name;
    const gloss = cls === 'eye' || cls === 'eyewhite';
    // SkeletonUtils.clone shares the BufferGeometry between every horse; setCoat writes the `color` attribute, so without a private copy
    // the last coat painted wins for all horses (and disposing one horse freed the buffers of the others). A clone is ~0.3 MB per horse.
    m.geometry = m.geometry.clone();
    m.material = (quality === 'high' ? new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: gloss ? 0.15 : 0.62, metalness: 0, sheen: gloss ? 0 : 0.55, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffffff'), clearcoat: gloss ? 1 : 0.14, clearcoatRoughness: gloss ? 0.03 : 0.45 })
      : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: gloss ? 0.2 : 0.7, metalness: 0 }));
    m.castShadow = spec.castShadow !== false; m.receiveShadow = true;
  }
  horse.face = new HorseFace(horse);
  horse.hair = new HorseHair(horse, { style: spec.mane || 'loose', quality });
  horse.model.add(horse.hair.group);
  horse.setCoat(spec.coat ? (typeof spec.coat === 'object' ? spec.coat : { coat: spec.coat, socks: spec.socks, blaze: spec.blaze }) : 'bay');
  if (spec.tack && spec.tack !== 'none') horse.setTack(spec.tack, spec.tackColors);
  horse.update(0.0001);
  return horse;
}

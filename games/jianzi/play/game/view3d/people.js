// One courtyard player: a real athlete skeleton (view3d Human) driven from the simulation's own numbers (where the person stands, the
// kick record, where the shuttle is). Nothing here feeds back into the simulation, which stays deterministic.
// World: x lateral (metres), y up, z = -depth (the camera looks along -z, so a person with yaw 0 faces the viewer).
//
// Two stages per frame: drive() decides clips, position, facing and the kick PLAN (before human.update); pose() lays the procedural body
// layer over the animated pose (after human.update): pelvis weight shift, torso counter-lean and twist, both arms as balance poles,
// the kicking leg to the exact contact point with the correct foot face (inside / outside / instep scoop), or the knee to the shuttle,
// with the planted foot pinned to the ground. All targets pass through critically damped springs or decaying offsets, so nothing pops.
import { THREE } from '../vendor3d/index.js';
import { Actor } from './actor.js';
import { footQuat, ankleForBall } from '../vendor3d/contact.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Qn = () => new THREE.Quaternion();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const SCALE = 0.96;
const SHUTTLE_R = 0.026;            // half the coin base: the foot face meets the coin edge

/** critically damped scalar spring */
class Sp {
  constructor(x = 0) { this.x = x; this.v = 0; }
  snap(x) { this.x = x; this.v = 0; return x; }
  crit(t, w, dt) {
    if (dt <= 0) return this.x;
    const e = this.x - t, tmp = (this.v + w * e) * dt, ex = Math.exp(-w * dt);
    this.x = t + (e + tmp) * ex; this.v = (this.v - w * tmp) * ex; return this.x;
  }
}
/** critically damped vector offset that absorbs target discontinuities (kick type switches, side changes) */
class Absorb {
  constructor() { this.off = V(); this.vel = V(); this.out = null; this._last = null; }
  run(raw, dt, w = 16) {
    if (!this.out) { this.out = raw.clone(); this._last = raw.clone(); return this.out; }
    if (raw.distanceTo(this._last) > 0.22) { this.off.copy(this.out).sub(raw); this.vel.set(0, 0, 0); }
    this._last.copy(raw);
    if (dt > 0) {
      const ex = Math.exp(-w * dt);
      for (const k of ['x', 'y', 'z']) { const e = this.off[k], tmp = (this.vel[k] + w * e) * dt; this.off[k] = (e + tmp) * ex; this.vel[k] = (this.vel[k] - w * tmp) * ex; }
    }
    this.out.copy(raw).add(this.off);
    return this.out;
  }
  reset() { this.out = null; this._last = null; this.off.set(0, 0, 0); this.vel.set(0, 0, 0); }
}

const hash1 = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export class Person {
  constructor(human, seat = 0) {
    this.h = human; this.seat = seat;
    human.turnRate = 7;
    this.a = new Actor(human);
    this.pos = V(); this.yaw = 0; this.yawA = 0; this.yawV = 0; this.vx = 0; this.vz = 0; this.speedLP = 0; this.snapped = false; this.clip = '';
    this.side = 'R';                 // kicking leg
    this.tgt = new Absorb();         // ankle target (kick) smoothed against switches
    this.lock = { L: { p: null, step: null, w: new Sp(0) }, R: { p: null, step: null, w: new Sp(0) } };   // own foot planting: world-locked feet and real little steps
    this.leg = { L: { w: new Sp(0), A: null, pole: null, q: null, fl: null }, R: { w: new Sp(0), A: null, pole: null, q: null, fl: null } };
    this.kw = new Sp(0);             // kick weight
    this.sway = new Sp(0); this.lean = new Sp(0); this.twist = new Sp(0); this.drop = new Sp(0); this.bendT = new Sp(0);
    this.armW = new Sp(0);
    this.armP = { L: null, R: null };      // smoothed balance-hand targets (they swap sides when the kicking leg does)
    this.plan = null;
    this.ph = hash1(seat * 13.7 + 2.1) * 6.28; this.rate = 0.9 + 0.3 * hash1(seat * 3.3 + 5);
    this.events = [];
    this._anim = null; this._animSide = 'R';
    this.dbg = {};
  }

  /** stage 1 (before human.update). e = { i, x, z, anim, look }, run = sim run (shuttle sh, expect, over...). */
  drive(e, run, yawRest, dt, snap) {
    const h = this.h, sh = run.sh, i = e.i;
    h.root.visible = true; h.root.rotation.x = 0; h.root.rotation.z = 0;
    const tx = e.x, tz = -e.z;
    if (snap || !this.snapped) { this.pos.set(tx, 0, tz); this.vx = 0; this.vz = 0; this.snapped = true; this.speedLP = 0; this.tgt.reset(); this._anim = null; for (const s of ['L', 'R']) { this.leg[s].w.snap(0); this.leg[s].fl = null; this.lock[s].p = null; this.lock[s].step = null; this.lock[s].w.snap(0); } }
    // position: critically damped follow of the sim's position (SmoothDamp, speed-limited), so the cadence never jumps
    if (dt > 0) {
      const st = 0.11, om = 2 / st, xx = om * dt, ex = 1 / (1 + xx + 0.48 * xx * xx + 0.235 * xx * xx * xx);
      let cx = this.pos.x - tx, cz = this.pos.z - tz;             // change = pos - target
      const maxC = 4.2 * st, cl = Math.hypot(cx, cz);
      if (cl > maxC) { cx *= maxC / cl; cz *= maxC / cl; }
      const tgx = this.pos.x - cx, tgz = this.pos.z - cz;          // the (speed-limited) target
      const tmx = (this.vx + om * cx) * dt, tmz = (this.vz + om * cz) * dt;
      this.vx = (this.vx - om * tmx) * ex; this.vz = (this.vz - om * tmz) * ex;
      this.pos.x = tgx + (cx + tmx) * ex; this.pos.z = tgz + (cz + tmz) * ex;
    }
    const spd = dt > 0 ? Math.hypot(this.vx, this.vz) : this.speedLP;
    this.speedLP += (spd - this.speedLP) * Math.min(1, dt * 12);
    // facing: the circle centre (or the camera, three quarters, when solo), turning toward the shuttle while it is theirs; the heading
    // follows the velocity while running so the legs always move the body the way it faces. A damped spring turns the body (no snaps).
    let want = yawRest;
    const mine = run.expect === i && sh.vy < 0.5 && !run.over;
    if (mine) { const a = Math.atan2(sh.x - this.pos.x, -(sh.z) - this.pos.z); const dl = wrap(a - yawRest); want = yawRest + clamp(dl, -1.0, 1.0); }
    if (spd > 0.4) want = Math.atan2(this.vx, this.vz);
    if (snap || !this._yawInit) { this.yawA = want; this.yawV = 0; this._yawInit = true; this.yawPrev = want; }
    else if (dt > 0) {
      // critically damped spring on the shortest-arc error
      const w0 = spd > 0.3 ? 18 : 9, e = -wrap(want - this.yawA), tm = (this.yawV + w0 * e) * dt, ex = Math.exp(-w0 * dt);
      this.yawV = (this.yawV - w0 * tm) * ex;
      this.yawA = want + (e + tm) * ex;
      // a person turns at most about 600 degrees per second: cap the rate (a reversal takes 0.3 s, never a one-frame spin)
      const maxStep = 12 * dt, stepA = wrap(this.yawA - this.yawPrev);
      if (Math.abs(stepA) > maxStep) { this.yawA = this.yawPrev + Math.sign(stepA) * maxStep; this.yawV = Math.sign(stepA) * 12; }
    }
    this.yawPrev = this.yawA;
    this.yawA = wrap(this.yawA);
    this.yaw = this.yawA; h.setFacing(this.yawA);
    const fy = h.facing;
    const leftX = Math.cos(fy);

    // ---- the kick plan ------------------------------------------------------------------------------------------------
    const a = e.anim;
    let plan = null;
    if (a && a.t < 0.62) {
      const C = V(a.cx, a.cy, -a.cz);
      if (this._anim !== a) {
        this._anim = a;
        const dxw = a.kind === 'outside' && a.side ? a.side : C.x - this.pos.x;
        const lx = dxw * leftX;
        this._animSide = Math.abs(lx) < 0.05 ? this.side : lx >= 0 ? 'L' : 'R';
        this.events.push({ type: 'kick', kind: a.kind, x: this.pos.x, z: this.pos.z, perfect: !!a.perfect, C: C.clone() });
      }
      plan = { kind: a.kind, side: this._animSide, C, t: a.t, post: true };
    } else if (mine && sh.y < 1.15 && Math.hypot(sh.x - this.pos.x, sh.z + this.pos.z) < 1.7) {
      const kind = sh.y > 0.5 ? 'knee' : sh.y > 0.2 ? 'inside' : 'scoop';
      const lx = (sh.x - this.pos.x) * leftX;
      const side = Math.abs(lx) < 0.12 ? this.side : lx >= 0 ? 'L' : 'R';
      plan = { kind, side, C: V(sh.x, sh.y, -sh.z), t: -1, post: false, near: sm((1.15 - sh.y) / 0.6) };
    }
    if (!a) this._anim = null;
    this.plan = plan;

    // ---- the body clip: ready crouch, jogging while it chases the landing, a settle after a drop
    if (run.over && run.expect === i) { if (this.clip !== 'idle_relaxed') { h.crossfade('idle_relaxed', 0.3); this.clip = 'idle_relaxed'; } }
    else if (spd > 0.4 || (this.clip === 'loco' && spd > 0.16)) { h.locomote(this.speedLP, { fade: 0.15, set: { jog: 'jog_slow' } }); this.clip = 'loco'; }
    else if (this.clip !== 'ready_stance') { h.crossfade('ready_stance', 0.25); this.clip = 'ready_stance'; }
    h.footPlanting = false;      // planting is done here (world-locked feet + real steps): the library re-places a dragged foot with a 0.3 m teleport
    // the gaze follows the shuttle through a damped point (a kick launches it at 5 m/s: the head must not whip). A shuttle behind the
    // player is not looked at: the weight fades out well before the direction can flip sides.
    const rel = wrap(Math.atan2(sh.x - this.pos.x, -sh.z - this.pos.z) - this.yawA);
    const gw = 0.85 * (1 - sm((Math.abs(rel) - 1.7) / 0.9));
    const ac = clamp(rel, -1.4, 1.4), dist = Math.max(1.5, Math.hypot(sh.x - this.pos.x, -sh.z - this.pos.z));
    const gx = this.pos.x + Math.sin(this.yawA + ac) * dist, gz = this.pos.z + Math.cos(this.yawA + ac) * dist, gy = clamp(sh.y, 0.2, 2.6);
    const lt = this.lookT || (this.lookT = V(gx, gy, gz)), lv = this.lookV || (this.lookV = V());
    if (snap) { lt.set(gx, gy, gz); lv.set(0, 0, 0); }
    else if (dt > 0) { const w0 = 11, ex = Math.exp(-w0 * dt); for (const [k, tv] of [['x', gx], ['y', gy], ['z', gz]]) { const e = lt[k] - tv, tm = (lv[k] + w0 * e) * dt, ev = Math.exp(-w0 * dt); void ex; lv[k] = (lv[k] - w0 * tm) * ev; lt[k] = tv + (e + tm) * ev; } }
    this.gazeW = this.gazeW === undefined ? gw : this.gazeW + (gw - this.gazeW) * Math.min(1, dt * 10);
    h.lookAt({ x: lt.x, y: lt.y, z: lt.z }, { weight: this.gazeW, maxYaw: 1.5, maxPitch: 0.7 });
    h.setPosition(this.pos.x, 0, this.pos.z);
    h.setReachFoot('L', null); h.setReachFoot('R', null);
  }

  /** stage 2 (after human.update, before render). */
  pose(dt, tAbs) {
    const h = this.h, a = this.a, B = a.b;
    const plan = this.plan, moving = this.clip === 'loco' || this.speedLP > 0.3;
    let kwT = 0;
    if (plan) {
      if (plan.post) kwT = plan.t < 0.09 ? 1 : 1 - 0.88 * sm((plan.t - 0.09) / 0.42);
      else kwT = 0.85 * (plan.near || 0);
    }
    const kw = this.kw.crit(kwT, kwT > this.kw.x ? 26 : 9, dt);
    h.root.updateMatrixWorld(true);
    const rootY = h.facing;                     // NOT root.rotation.y: Actor writes the root quaternion and Euler y is ambiguous beyond 90 degrees
    const left = V(Math.cos(rootY), 0, -Math.sin(rootY)), fwd = V(Math.sin(rootY), 0, Math.cos(rootY));
    const t = tAbs * this.rate + this.ph;

    // current animated landmarks (after human.update)
    const pel0 = B.pelvis.getWorldPosition(V());
    const ank = { L: B.L.foot.getWorldPosition(V()), R: B.R.foot.getWorldPosition(V()) };
    const footQ0 = { L: B.L.foot.getWorldQuaternion(Qn()), R: B.R.foot.getWorldQuaternion(Qn()) };
    const kickSide = plan ? plan.side : this.side;
    if (plan) this.side = plan.side;
    const stand = kickSide === 'L' ? 'R' : 'L';
    const sgn = kickSide === 'L' ? 1 : -1;           // +1: the kicking leg is on the avatar's left

    const kind = plan ? plan.kind : 'none';
    let swayT = 0, leanT = 0, twistT = 0, dropT = 0, bendT = 0, armKick = 0.0;
    const idleSway = 0.012 * Math.sin(t * 0.55) + 0.006 * Math.sin(t * 1.3 + 1);
    const breath = 0.004 * Math.sin(t * 2.2);
    if (kw > 0.02) {
      const k = kw;
      swayT = -sgn * 0.05 * k;
      leanT = -sgn * (kind === 'inside' ? 7 : kind === 'outside' ? 9 : kind === 'knee' ? 5 : 3) * k;
      twistT = sgn * (kind === 'outside' ? -8 : kind === 'inside' ? 6 : kind === 'knee' ? 5 : 4) * k;
      dropT = (kind === 'scoop' ? 0.05 : kind === 'knee' ? 0.0 : 0.02) * k;
      bendT = (kind === 'scoop' ? 9 : kind === 'knee' ? -5 : 3) * k;
      armKick = k;
    }
    const sway = this.sway.crit(swayT + (moving ? 0 : idleSway), 14, dt);
    const lean = this.lean.crit(leanT + (moving ? 0 : 1.2 * Math.sin(t * 0.4)), 12, dt);
    const twist = this.twist.crit(twistT, 12, dt);
    const drop = this.drop.crit(dropT + (moving ? 0 : breath), 12, dt);
    const bend = this.bendT.crit(bendT + (moving ? 0 : 0.8 * Math.sin(t * 2.2)), 12, dt);
    const armW = this.armW.crit(moving ? 0 : 0.18 + 0.8 * armKick, 11, dt);

    const pelvis = pel0.clone().addScaledVector(left, sway).add(V(0, -drop, 0));
    const P = {
      pelvis, yaw: rootY, groundY: 0,
      torso: { bend, side: lean, twist },
      pelvisTilt: { bend: 0, side: moving ? 0 : -lean * 0.35, twist: -twist * 0.4 },
      legs: {}, arms: {}, look: null,
    };

    // ---- planted feet: locked in the world while standing; when the body has drifted more than 0.2 m from where the feet are, ONE foot
    // takes a short stepping arc to where the animation wants it (the other stays), exactly like a person re-setting their stance
    for (const s of ['L', 'R']) {
      const Lk = this.lock[s], oth = this.lock[s === 'L' ? 'R' : 'L'];
      if (!moving) {
        if (!Lk.p || this._wasMoving) { Lk.p = ank[s].clone(); Lk.w.snap(1); Lk.step = null; }      // the foot that is down when the body stops stays down
        if (Lk.step) {
          Lk.step.t += dt; const u = sm(Lk.step.t / Lk.step.dur);
          Lk.p.lerpVectors(Lk.step.from, Lk.step.to, u); Lk.p.y = Lk.step.to.y + 0.09 * Math.sin(Math.PI * clamp(Lk.step.t / Lk.step.dur, 0, 1));
          if (Lk.step.t >= Lk.step.dur) { Lk.p.copy(Lk.step.to); Lk.step = null; }
        } else if (!oth.step && Math.hypot(ank[s].x - Lk.p.x, ank[s].z - Lk.p.z) > 0.22) {
          Lk.step = { t: 0, dur: 0.3, from: Lk.p.clone(), to: ank[s].clone() };
        }
      }
      Lk.w.crit(moving ? 0 : 1, moving ? 14 : 30, dt);
      if (moving && Lk.w.x < 0.02) { Lk.p = null; Lk.step = null; }
    }
    this._wasMoving = moving;

    // ---- legs ---------------------------------------------------------------------------------------------------------------
    // Each leg has its own kick weight (so a side change at the strike cross-fades instead of popping) and remembers its kick solution.
    const polePlant = (s) => { const o = s === 'L' ? 1 : -1; return [left.x * o * 0.35 + fwd.x * 0.9, 0.15, left.z * o * 0.35 + fwd.z * 0.9]; };
    const knees = {};
    if (plan && kw > 0.01) {
      const out = left.clone().multiplyScalar(sgn);
      let C2 = plan.C.clone();
      if (plan.post) {
        const ft = sm((plan.t - 0.02) / 0.14) * (1 - sm((plan.t - 0.2) / 0.3));
        C2.add(V(out.x * 0.05 * ft * (kind === 'outside' ? 2 : 1), 0.12 * ft, out.z * 0.05 * ft));
      }
      let ankle, q = null, pole = null;
      const n = V(0, 1, 0);
      if (kind === 'knee') {
        // put the KNEE JOINT where the strike is: it lies on a sphere around the hip (thigh length), as near the strike point as the thigh
        // reaches; the shin then hangs from it, and the pole makes the knee bend that way
        const hip0 = B[kickSide].thigh.getWorldPosition(V()).add(pelvis).sub(pel0);
        const L1 = B[kickSide].thigh.getWorldPosition(V()).distanceTo(B[kickSide].calf.getWorldPosition(V()));
        const L2 = B[kickSide].calf.getWorldPosition(V()).distanceTo(B[kickSide].foot.getWorldPosition(V()));
        const Kt = C2.clone().add(V(0, -0.06, 0));
        const dirK = Kt.clone().sub(hip0); if (dirK.lengthSq() < 1e-6) dirK.set(0, 0, 1);
        dirK.normalize(); if (dirK.y > 0.12) { dirK.y = 0.12; dirK.normalize(); }     // a knee never rises much above the hip
        const K = hip0.clone().addScaledVector(dirK, L1);
        const shin = fwd.clone().multiplyScalar(-0.12).addScaledVector(out, 0.04).add(V(0, -1, 0)).normalize();
        ankle = K.clone().addScaledVector(shin, L2);
        const mid = hip0.clone().add(ankle).multiplyScalar(0.5), pd = K.clone().sub(mid).normalize();
        pole = [pd.x, pd.y, pd.z];
      } else {
        let toes, face;
        if (kind === 'inside') { face = 'inside'; toes = fwd.clone().multiplyScalar(0.5).addScaledVector(out, 0.87).normalize(); pole = [fwd.x * 0.85 + out.x * 0.35, 0.25, fwd.z * 0.85 + out.z * 0.35]; }
        else if (kind === 'outside') { face = 'outside'; toes = fwd.clone().multiplyScalar(0.76).addScaledVector(out, -0.64).normalize(); pole = [fwd.x * 0.9 - out.x * 0.15, 0.1, fwd.z * 0.9 - out.z * 0.15]; n.set(out.x * 0.25, 1, out.z * 0.25); }
        else { face = 'instep'; toes = fwd.clone(); pole = [fwd.x * 0.9 + out.x * 0.3, 0.2, fwd.z * 0.9 + out.z * 0.3]; n.set(fwd.x * 0.15, 1, fwd.z * 0.15); }
        q = footQuat(h, kickSide, n, toes, face);
        ankle = ankleForBall(h, kickSide, C2, n, toes, face, SHUTTLE_R);
        ankle.y = Math.max(0.065, ankle.y);
      }
      const L = this.leg[kickSide];
      L.A = this.tgt.run(ankle, dt, 18).clone(); L.pole = pole; L.q = q;
      if (kind === 'knee') knees[kickSide] = true;
    } else { this.tgt.reset(); }
    for (const s of ['L', 'R']) {
      const Ls = this.leg[s];
      Ls.w.crit(plan && s === kickSide ? kw : 0, plan && s === kickSide ? 28 : 13, dt);
      const Lk = this.lock[s], wl = sm(clamp(Ls.w.x, 0, 1)), G0 = Lk.p && Lk.w.x > 0.02 ? Lk.p : ank[s];
      const lw = Lk.p ? clamp(Lk.w.x, 0, 1) : 0;
      if (wl > 0.004 && Ls.A) {
        // blend the TARGET (not the IK weights) between the animated ground pose and the kick pose: the foot travels a clean path
        const pp0 = polePlant(s), pole = Ls.pole;
        const pl = V(pp0[0] + (pole[0] - pp0[0]) * wl, pp0[1] + (pole[1] - pp0[1]) * wl, pp0[2] + (pole[2] - pp0[2]) * wl).normalize();
        P.legs[s] = { p: [G0.x + (Ls.A.x - G0.x) * wl, G0.y + (Ls.A.y - G0.y) * wl, G0.z + (Ls.A.z - G0.z) * wl], f: 'w', w: moving ? Math.max(wl, lw) : 1, pole: [pl.x, pl.y, pl.z], pf: 'w' };
      } else if (lw > 0.02) {
        P.legs[s] = { p: [G0.x, G0.y, G0.z], f: 'w', w: lw, pole: polePlant(s), pf: 'w' };    // the foot stays where it was planted (the pelvis moved, the feet must not)
      }
    }

    if (armW <= 0.02) { this.armP.L = null; this.armP.R = null; }
    // ---- arms: balance poles. The arm opposite the kicking leg goes out and up; the same-side arm swings across/back ------------------
    if (armW > 0.02) {
      const chest = B.spine2.getWorldPosition(V());
      const armsFor = (s) => {
        const o = s === 'L' ? 1 : -1, same = o === sgn;
        const wide = same ? 0.46 : 0.62, up = same ? 0.08 : 0.34, fw = same ? -0.16 : 0.14;
        const swing = 0.07 * Math.sin(t * 0.9 + (same ? 0 : 1.7));
        const tgt = chest.clone().addScaledVector(left, o * wide).addScaledVector(fwd, fw + swing).add(V(0, -0.2 + up, 0));
        const pole2 = V(0, -1, 0).addScaledVector(left, o * 0.15).addScaledVector(fwd, -0.3);
        // the target is held in the BODY frame (so it moves with the person) and low-passed: a side change glides across in ~0.15 s
        const rel = tgt.clone().sub(chest);
        const rl = V(rel.dot(left), rel.y, rel.dot(fwd));
        const prev = this.armP[s];
        if (!prev) this.armP[s] = rl.clone(); else prev.lerp(rl, 1 - Math.exp(-14 * dt));
        const sm2 = this.armP[s];
        const wp = chest.clone().addScaledVector(left, sm2.x).addScaledVector(fwd, sm2.z).add(V(0, sm2.y, 0));
        return { p: [wp.x, wp.y, wp.z], f: 'w', w: armW, pole: [pole2.x, pole2.y, pole2.z], pf: 'w' };
      };
      P.arms.L = armsFor('L'); P.arms.R = armsFor('R');
    }

    a.apply(P, dt);

    // ---- feet: orientation is blended continuously between the ground pose and the kick pose, in the shin's local frame (no flips) ------
    for (const s of ['L', 'R']) {
      const Ls = this.leg[s], wf = sm(clamp(Ls.w.x * 1.25, 0, 1));
      const calfInv = B[s].calf.getWorldQuaternion(Qn()).invert();
      const base = moving ? B[s].foot.quaternion.clone() : calfInv.clone().multiply(footQ0[s]);      // standing: keep the foot flat where it was planted
      if (plan && s === kickSide && kw > 0.01) {
        const lk = Ls.q ? calfInv.clone().multiply(Ls.q) : B[s].foot.quaternion.clone();           // knee kick: the foot hangs from the shin
        if (!Ls.fl) Ls.fl = lk.clone(); else Ls.fl.slerp(lk, 1 - Math.exp(-9 * dt));
      }
      if (Ls.fl && wf > 0.002) B[s].foot.quaternion.copy(base.slerp(Ls.fl, wf));
      else { B[s].foot.quaternion.copy(base); if (wf <= 0.002) Ls.fl = null; }
      B[s].foot.updateWorldMatrix(false, true);
    }
    h.root.rotation.set(0, rootY, 0);            // Actor wrote the quaternion: clear the Euler x/z (= pi) it left behind, or the next animation update runs in a flipped frame
    h.root.updateMatrixWorld(true);
    this.dbg = { kw, kind, side: kickSide, moving };
  }

  takeEvents() { const e = this.events; this.events = []; return e; }
}

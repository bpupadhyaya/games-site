// One 3D wrestler: the athlete body in the kurash kit, the stance and throw poses, the lean that follows the sim's balance point, a hand on the
// rival's sleeve and a hand on the rival's lapel, and the fall / rise of a thrown wrestler. It only READS what the presenter hands in each frame;
// it never touches the sim.
import { dress } from './costume.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const sm5 = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
export const M = 0.0036;               // metres per sim unit
export const HOME = 100 * M;          // each wrestler's stance is this far from the mat centre
// each wrestler stands a little to their own left of the centre line, so heads pass side by side (as in a real tie-up) instead of through each other
const SHIFT = 0.075;
const MAX_TILT = 10 * Math.PI / 180;  // lean at the edge of balance

// finger poses that wrap cloth: a hand round a sleeve (fingers hooked, thumb opposed) and a fist closed on a lapel
const SLEEVE_GRIP = { curl: [[0.5, 0.6, 0.4], [0.95, 1.2, 0.85], [1.0, 1.25, 0.9], [1.05, 1.3, 0.9], [1.05, 1.3, 0.9]], spread: [0.0, 0.0, 0.0, 0.0, 0.0] };
const LAPEL_GRIP = { curl: [[0.7, 0.8, 0.6], [1.15, 1.45, 0.95], [1.2, 1.55, 1.0], [1.25, 1.6, 1.0], [1.25, 1.6, 1.0]], spread: [0, 0, 0, 0, 0] };

export class Wrestler {
  constructor(V3, stage, side) {
    this.V3 = V3; this.T = V3.THREE; this.stage = stage; this.side = side;
    this.h = null; this.kit = null; this.reach = 0; this.mode = 'stand'; this.fx = null;
    this.yaw = side === 0 ? Math.PI / 2 : -Math.PI / 2; this.baseYaw = this.yaw;
    this.pos = new this.T.Vector3(side === 0 ? -HOME : HOME, 0, side === 0 ? -SHIFT : SHIFT);
    this.tilt = { x: 0, z: 0 }; this.clip = '';
    this.celebrate = 0;
  }

  async load(look, quality) {
    const { loadHuman, buildClip } = this.V3;
    const lod = quality === 'high' ? 0 : quality === 'medium' ? 'medium' : 'light';
    const h = await loadHuman({ character: 'athlete_m', kit: { top: '#efe9dc', bottoms: '#cdc6b2', socks: '#f4f1ea', shoes: '#1c1713' }, skin: look.skin, hair: look.hair, lod, castShadow: quality !== 'low' });
    this.h = h; this.look = look;
    h.footPlanting = true;
    this.stage.add(h); this.stage.track(h);
    this.kit = dress(h, this.T, look, quality);
    // the kurash stance: feet wide, knees well bent, trunk inclined, head up, a slow breath
    const st = (s, th, ca, nk, pz = 0.04) => ({ Spine: { flex: s }, Neck: { flex: nk }, Head: { flex: 0 }, Pelvis: { pos: [0, -0.05, pz] }, L_Thigh: { flex: th, abduct: 11 }, R_Thigh: { flex: th, abduct: 11 }, L_Calf: { flex: ca }, R_Calf: { flex: ca } });
    h.addClip(buildClip(h, {
      name: 'k_stance', duration: 2.4, base: 'idle_relaxed', loop: true,
      keys: [
        { t: 0, pose: st(11, 28, 44, -9, 0.0) },
        { t: 1.2, pose: st(13, 31, 48, -11, 0.01), ease: 'inOut' },
        { t: 2.4, pose: st(11, 28, 44, -9, 0.0), ease: 'inOut' },
      ],
      fingers: 'relaxed',
    }));
    // the throw entry: drop the hips, turn the trunk in, pull
    h.addClip(buildClip(h, {
      name: 'k_throw', duration: 0.56, base: 'idle_relaxed',
      keys: [
        { t: 0, pose: { Spine: { flex: 11, twist: 0 }, Neck: { flex: -9 }, Pelvis: { twist: 0, pos: [0, -0.05, 0.0] }, L_Thigh: { flex: 28, abduct: 11 }, R_Thigh: { flex: 28, abduct: 11 }, L_Calf: { flex: 44 }, R_Calf: { flex: 44 } } },
        { t: 0.3, pose: { Spine: { flex: 30, twist: 18 }, Neck: { flex: -22 }, Pelvis: { twist: -14, pos: [0, -0.12, 0.05] }, L_Thigh: { flex: 40, abduct: 12 }, R_Thigh: { flex: 40, abduct: 12 }, L_Calf: { flex: 58 }, R_Calf: { flex: 58 } }, ease: 'inOut' },
        { t: 0.56, pose: { Spine: { flex: 18, twist: 6 }, Neck: { flex: -14 }, Pelvis: { twist: -4, pos: [0, -0.05, 0] }, L_Thigh: { flex: 33, abduct: 9 }, R_Thigh: { flex: 33, abduct: 9 }, L_Calf: { flex: 48 }, R_Calf: { flex: 48 } }, ease: 'out' },
      ],
      events: { contact: 0.3 }, fingers: 'relaxed',
    }));
    // a thrown wrestler in the air and on the mat: arms out, knees bent, chin tucked
    h.addClip(buildClip(h, {
      name: 'k_fallen', duration: 0.7, base: 'rest',
      keys: [
        { t: 0, pose: { Spine: { flex: 6 }, L_UpperArm: { abduct: 34, flex: 14 }, R_UpperArm: { abduct: 34, flex: 14 }, L_Forearm: { flex: 34 }, R_Forearm: { flex: 34 }, L_Thigh: { flex: 26, abduct: 7 }, R_Thigh: { flex: 18, abduct: 7 }, L_Calf: { flex: 34 }, R_Calf: { flex: 24 }, Neck: { flex: 16 } } },
        { t: 0.7, pose: { Spine: { flex: 0 }, L_UpperArm: { abduct: 48, flex: 8 }, R_UpperArm: { abduct: 48, flex: 8 }, L_Forearm: { flex: 14 }, R_Forearm: { flex: 14 }, L_Thigh: { flex: 28, abduct: 9 }, R_Thigh: { flex: 20, abduct: 9 }, L_Calf: { flex: 40 }, R_Calf: { flex: 28 }, Neck: { flex: 10 } }, ease: 'inOut' },
      ],
      fingers: 'relaxed',
    }));
    h.play('k_stance', { fade: 0 });
    h.setFingers('L', SLEEVE_GRIP); h.setFingers('R', SLEEVE_GRIP);
    return this;
  }

  setLook(look) {
    if (!this.h) return;
    this.look = look;
    this.h.setKit({ top: '#efe9dc', bottoms: '#cdc6b2' });
    this.h.setSkin(look.skin); this.h.setHair(look.hair);
    this.kit.setColors(look);
  }

  play(name, fade = 0.15, opts = {}) {
    if (this.clip === name) return;
    this.clip = name; this.h.play(name, { fade, ...opts });
  }

  // Put the wrestler back at its stance, upright and gripping.
  reset() {
    this.mode = 'stand'; this.fx = null; this.reach = 1; this.celebrate = 0;
    this.pos.set(this.side === 0 ? -HOME : HOME, 0, this.side === 0 ? -SHIFT : SHIFT);
    this.yaw = this.baseYaw; this.tilt.x = this.tilt.z = 0;
    if (this.h) { this.V3.rotateBody(this.h, null); this.clip = ''; this.play('k_stance', 0); }
  }

  // The loser of a scoring throw: goes over the hip (thrown toward his own front: a forward flip), falls back (thrown behind him), or is turned
  // in the air (thrown sideways), and lands on the back (d: the sim's throw direction).
  startFall(T, d, grade) {
    const len = Math.hypot(d.x, d.y) || 1;
    const dx = d.x / len, dz = d.y / len;
    this.mode = 'fall';
    const yaw0 = this.yaw;
    const dotf = dx * Math.sin(yaw0) + dz * Math.cos(yaw0);
    const kind = dotf > 0.35 ? 'fwd' : dotf < -0.35 ? 'back' : 'side';
    const yawEnd = Math.atan2(-dx, -dz);
    let dy = yawEnd - yaw0; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const yawL = kind === 'fwd' ? yaw0 : yaw0 + dy;
    this.fx = { t0: T, dx, dz, grade, p0: this.pelvisWorld(), yaw0, kind, yawL };
    this.play('k_fallen', 0.3);
  }
  pelvisWorld() { const v = new this.T.Vector3(); this.h.bonePosition('Pelvis', v); return v; }

  // Called once per frame. f: { T, dt, b, wind: 0..1 thrust progress, tdir, rival, over, celebrate, releaseGrip }
  update(f) {
    const h = this.h; if (!h) return;
    const T = this.T;
    if (this.mode === 'fall' || this.mode === 'lie' || this.mode === 'rise') {
      this.updateFall(f);
      return;
    }
    // ----- standing
    let weightReach = 1;
    let yaw = this.baseYaw;
    let bx = f.b.x, bz = f.b.y;
    if (f.wind > 0) {
      // the entry: turn the whole body toward the throw
      const a = Math.atan2(f.tdir.x, f.tdir.y);               // world heading of the throw
      let dlt = a - this.baseYaw; dlt = Math.atan2(Math.sin(dlt), Math.cos(dlt));
      yaw = this.baseYaw + clamp(dlt, -0.9, 0.9) * 0.42 * sm5(f.wind);
      this.play('k_throw', 0.18);
    } else if (this.clip === 'k_throw') this.play('k_stance', 0.4);
    if (f.celebrate) { this.play('celebrate_2', 0.3); weightReach = 0; bx = bz = 0; }
    else if (f.releaseGrip) weightReach = 0;
    // grip weight follows smoothly (a throw keeps hold of the sleeve while the rival goes over)
    const rate = weightReach > this.reach ? 6 : f.releaseGrip ? 3.2 : 8;
    this.reach += (weightReach - this.reach) * Math.min(1, f.dt * rate);
    // smooth yaw and lean (no snapping when the sim changes direction)
    if (f.dt > 0) {
      this.yaw += (yaw - this.yaw) * Math.min(1, f.dt * 10);
      const ky = Math.min(1, f.dt * 12);
      this.tilt.x += (bx - this.tilt.x) * ky; this.tilt.z += (bz - this.tilt.z) * ky;
    }
    // yaw first, then the lean as a tilt about the world axis perpendicular to it
    const L = Math.hypot(this.tilt.x, this.tilt.z);
    const ang = Math.min(1, L) * MAX_TILT;
    const q = h.root.quaternion;
    q.setFromAxisAngle(new T.Vector3(0, 1, 0), this.yaw);
    if (L > 1e-4) q.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(this.tilt.z / L, 0, -this.tilt.x / L), ang));
    h.root.position.copy(this.pos);
    h.root.updateMatrixWorld(true);
    if (f.rival && this.reach > 0.01) this.grip(f.rival, this.reach);
    else this.freeHands();
  }

  freeHands() {
    const h = this.h;
    h.setReach('L', null); h.setReach('R', null);
    h.setFingers('L', 'relaxed'); h.setFingers('R', 'relaxed');
    this.kit.setBunch('L', false); this.kit.setBunch('R', false);
  }

  // Right hand round the rival's sleeve (the forearm on my right), left hand closed on the rival's lapel (his right chest). Arms run side by
  // side and never cross: the sleeve is held from outside and above, the lapel from the front.
  grip(rival, w) {
    const h = this.h, T = this.T, V3 = this.V3, r = rival.h;
    const P = (hh, n) => hh.bonePosition(n, new T.Vector3());
    const myR = P(h, 'R_UpperArm'), myL = P(h, 'L_UpperArm');
    const lat = myR.clone().sub(myL); lat.y = 0; lat.normalize();              // towards my right in the world
    const chest = P(h, 'Spine2'), rChest = P(r, 'Spine2');
    const fwd = rChest.clone().sub(chest); fwd.y = 0; fwd.normalize();
    const up = new T.Vector3(0, 1, 0);
    // the rival's arm on my right side
    const rs = P(r, 'L_UpperArm').dot(lat) > P(r, 'R_UpperArm').dot(lat) ? 'L' : 'R';
    const elb = P(r, `${rs}_Forearm`), wr = P(r, `${rs}_Hand`);
    const axis = wr.clone().sub(elb).normalize();
    const C = elb.clone().lerp(wr, 0.42);
    // sleeve hand: palm comes from outside / above / a little from my side
    const a = lat.clone().multiplyScalar(0.78).addScaledVector(up, 0.5).addScaledVector(fwd, -0.25).normalize();
    const nS = a.clone().negate();
    const fxS = new T.Vector3().crossVectors(axis, nS).normalize();
    const sl = V3.solvePalmBall(h, 'R', C, nS, fxS, 0.062);
    const poleR = myR.clone().addScaledVector(lat, 0.45).addScaledVector(up, -0.4).addScaledVector(fwd, -0.15);
    h.setReach('R', sl.wrist, { weight: w, pole: poleR, quat: sl.quat });
    h.setFingers('R', SLEEVE_GRIP);
    // lapel hand: the rival's chest on my left, a hand's breadth under the collar
    const rivalLat = lat.clone().negate();                                      // my left in the world
    const Lc = rChest.clone().addScaledVector(rivalLat, 0.075).addScaledVector(up, 0.1).addScaledVector(fwd, -0.075);
    const lp = V3.solvePalmBall(h, 'L', Lc, fwd.clone(), up.clone(), 0.04);
    const poleL = myL.clone().addScaledVector(lat, -0.45).addScaledVector(up, -0.4).addScaledVector(fwd, -0.15);
    h.setReach('L', lp.wrist, { weight: w, pole: poleL, quat: lp.quat });
    h.setFingers('L', LAPEL_GRIP);
    const col = rival.look ? rival.look.kit : null;
    this.kit.setBunch('R', w > 0.4, col); this.kit.setBunch('L', w > 0.4, col);
  }

  beltPoint() { const v = new this.T.Vector3(); this.h.bonePosition('Spine', v); return v; }

  updateFall(f) {
    const h = this.h, T = this.T, fx = this.fx;
    const s = Math.max(0, f.T - fx.t0);
    this.reach += (0 - this.reach) * Math.min(1, f.dt * 7);
    if (this.reach > 0.02 && f.rival) this.grip(f.rival, this.reach); else this.freeHands();
    const fwd = fx.kind === 'fwd';
    const FLY = fwd ? 0.7 : 0.62, LIE = f.over ? 99 : 0.9, RISE = 1.0;
    const dist = fwd ? 0.55 : 0.42, zOff = 0.24;
    // final lying place: beyond the start along d; pelvis resting a hand's breadth above the mat
    const land = new T.Vector3(fx.p0.x + fx.dx * dist, 0.15, fx.p0.z + fx.dz * dist + zOff);
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const yawL = fx.yawL;
    if (s < FLY) {
      // one continuous ease from the grip to the mat: the hips are pulled in and up, the body goes over (or back) and the speed bleeds off
      const v = s / FLY;
      const along = sm5(clamp((v - 0.05) / 0.95, 0, 1));
      const pull = -(fwd ? 0.14 : 0.08) * Math.sin(Math.PI * clamp(v / 0.5, 0, 1)) * (1 - sm(clamp((v - 0.3) / 0.45, 0, 1)));
      const peak = fwd ? 0.5 : 0.2;
      const hgt = lerp(fx.p0.y, land.y, along) + peak * Math.sin(Math.PI * Math.pow(v, 0.85));
      const pel = new T.Vector3(fx.p0.x + fx.dx * (dist * along + pull), hgt, fx.p0.z + fx.dz * (dist * along + pull) + zOff * sm(clamp((v - 0.15) / 0.6, 0, 1)));
      const rot = sm5(clamp((v - 0.04) / 0.92, 0, 1));
      const roll = Math.sin(Math.PI * v) * 10 * (fwd ? 0 : 1);
      const yawT = fx.kind === 'fwd' ? 0 : sm(clamp((v - 0.2) / 0.65, 0, 1));
      this.V3.rotateBody(h, { pelvis: pel, yaw: fx.yaw0 + wrap(yawL - fx.yaw0) * yawT, pitch: fwd ? 270 * rot : -90 * rot, roll });
      this.mode = 'fall';
    } else if (s < FLY + LIE) {
      // the landing: a soft settle (the body gives a little) rather than a stop
      const u = s - FLY;
      const settle = Math.exp(-7 * u) * Math.sin(16 * u);
      const k = 1 - Math.exp(-6 * u);
      const pel = new T.Vector3(land.x + fx.dx * 0.03 * k, land.y + 0.035 * Math.max(0, settle), land.z + fx.dz * 0.03 * k);
      this.V3.rotateBody(h, { pelvis: pel, yaw: yawL, pitch: -90 - 3 * settle, roll: 0 });
      this.mode = 'lie';
      f.landed = true;
    } else if (s < FLY + LIE + RISE) {
      const u = (s - FLY - LIE) / RISE;
      // sit up first, then come to the feet and back to the stance
      const pitch = u < 0.45 ? lerp(-90, -42, sm(u / 0.45)) : lerp(-42, 0, sm((u - 0.45) / 0.55));
      const yawNow = yawL + wrap(this.baseYaw - yawL) * sm(u);
      const homeP = new T.Vector3(this.pos.x, 0.86, this.pos.z);
      const ph = u < 0.45 ? lerp(0.15, 0.32, sm(u / 0.45)) : lerp(0.32, 0.86, sm((u - 0.45) / 0.55));
      const pel = new T.Vector3(lerp(land.x, homeP.x, sm(u)), ph, lerp(land.z, homeP.z, sm(u)));
      this.V3.rotateBody(h, { pelvis: pel, yaw: yawNow, pitch, roll: 0 });
      if (u > 0.4 && this.clip !== 'k_stance') this.play('k_stance', 0.45);
      this.mode = 'rise';
    } else {
      this.reset();
    }
  }
}

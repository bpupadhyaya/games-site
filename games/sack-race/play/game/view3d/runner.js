// One runner: a real athlete skeleton posed every frame from the simulation state, standing in a deforming sack.
//
//   take-off  the legs drive (the body is pushed up and forward through the first few hundredths of a second), the sack leaves the
//             ground with the hands pulling the rim up, the body leans forward by the simulated lean
//   flight    a ballistic arc, the sack hangs a little behind the body and goes taut, knees tuck inside the cloth
//   landing   the base of the sack lands flat and PLANTS (it never slides: a long wait on the ground becomes a small shuffle),
//             the body absorbs the impact with a damped crouch and is carried forward over the planted sack
//   fall      the body topples about the planted sack (forward with a sideways roll, or back), hands reach for the ground, the runner
//             lies, wriggles, pushes up and stands again
// All times come from the simulation (phase, pt, hops, v, th, fwdFall); only a damped crouch spring and the planted foot position are
// kept here. Nothing flows back to the simulation.
import { THREE } from '../vendor3d/index.js';
import { Actor } from './actor.js';
import { createSack } from './sack.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Qn = () => new THREE.Quaternion();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const DEG = 180 / Math.PI;
const AIR_T = 0.36;
const U_TO = 0.06, U_TD = 0.94;        // visual take-off / touch-down inside the simulated flight (fraction of AIR_T)
const UP = V(0, 1, 0);
export const FALL_FWD_LIE = 1.42, FALL_BACK_LIE = -1.28;

export class RunnerRig {
  constructor(human, k, style, idx = 0) {
    this.h = human; this.k = k;
    this.a = new Actor(human);
    this.sack = createSack(THREE, style);
    this.stand = this.a.pelvisRest.y - 0.07 * k;     // relaxed standing pelvis height (knees a little bent)
    this.g = this.a.groundAnkle;
    this.s = {
      init: false, hops: -1, phase: '', cur: 0, anchor: 0, c: 0.04 * k, cv: 0, shuf: null, fall: null, gu: 0, ph: idx * 1.7, lie: 0, qd: 0,
      lastFeetLift: 0, sway: 0, cel: 0, tTouch: 0, lastX: 0,
    };
    this.pel = V(); this.bq = Qn(); this.rim = V(); this.feet = V();
    this.out = { head: V(), pelvis: V(), tipY: 1.9 * k };
  }

  /**
   * r: the simulated racer. env: { z, dt, t, go, count, v... , lookX }. Returns nothing; poses the human and the sack.
   */
  step(r, env) {
    const S = this.s, k = this.k, dt = env.dt, z = env.z, a = this.a, h = this.h;
    const air = r.phase === 'air', down = r.phase === 'down', rise = r.phase === 'rise';
    if (!S.init) { S.init = true; S.cur = r.x - 0.04 * k; S.anchor = S.cur; S.hops = r.hops; S.phase = r.phase; S.lastX = r.x; }
    S.ph += dt;
    // ---- events inferred from the state ------------------------------------------------------------------------------------------------
    const newHop = air && r.hops !== S.hops;
    if (newHop) { S.anchor = S.cur; S.hops = r.hops; S.cv = Math.min(S.cv, 0) - 1.9; S.shuf = null; }
    const touched = S.phase === 'air' && r.phase !== 'air';
    if (touched || (newHop && S.phase === 'air')) { S.cv += 1.5 + 0.34 * Math.min(4.4, r.v || 0); S.tTouch = 0; }
    S.tTouch += dt;
    if ((down || rise) && !S.fall) {
      S.fall = { t: 0, x: S.cur, lift: S.lastFeetLift, th0: clamp(r.th, -1.1, 1.1), fwd: r.fwdFall !== false, side: ((r.id | 0) & 1 ? -1 : 1) * 0 + 1 };
    }
    if (!down && !rise && S.fall) { S.fall = null; S.gu = 0; }
    S.phase = r.phase;

    // ---- the plan of the feet --------------------------------------------------------------------------------------------------------
    let u = 0, w = 0, lift = 0, tgt = S.cur;
    if (air) {
      u = clamp(r.pt / AIR_T, 0, 1); w = clamp((u - U_TO) / (U_TD - U_TO), 0, 1);
      const tRem = Math.max(0, (U_TD - u) * AIR_T);
      tgt = r.x + (r.v || 0) * tRem * 0.96 - 0.05 * k;
      S.cur = lerp(S.anchor, tgt, smooth(w));
      lift = 4 * 0.215 * k * w * (1 - w);
      // a flight cut short by a topple keeps the feet where they are
    } else if (r.phase === 'ground' || r.finishT != null) {
      // planted: the body is carried over the sack; when it gets far ahead the runner shuffles the sack forward (never slides)
      const ahead = r.x - S.cur;
      if (!S.shuf && ahead > 0.36 * k + 0.08) S.shuf = { t: 0, from: S.cur, to: r.x - 0.1 * k };
      if (S.shuf) {
        S.shuf.t += dt; const q = clamp(S.shuf.t / 0.12, 0, 1);
        S.cur = lerp(S.shuf.from, S.shuf.to, smooth(q)); lift = 0.03 * k * Math.sin(Math.PI * q);
        if (q >= 1) S.shuf = null;
      }
    }
    S.lastFeetLift = lift;

    // ---- the crouch spring (positive c = pelvis lower than relaxed standing) ----------------------------------------------------------------
    let cTarget = 0.035 * k;
    if (!env.go) cTarget = (env.count > 0.7 ? 0.075 : 0.045) * k;
    if (air) cTarget = u < 0.14 ? -0.012 * k : 0.0;
    if (down || rise) cTarget = 0;
    const om = 34, ze = 0.78, n = Math.max(1, Math.ceil(dt / 0.008)), hdt = dt / n;
    for (let i = 0; i < n; i++) {
      const acc = om * om * (cTarget - S.c) - 2 * ze * om * S.cv;
      S.cv += acc * hdt; S.c += S.cv * hdt;
    }
    S.c = clamp(S.c, -0.05 * k, 0.16 * k);
    const crouchF = clamp(S.c / (0.1 * k), -0.3, 1);

    // ---- body placement ----------------------------------------------------------------------------------------------------------------
    const arc = air ? 4 * 0.2 * k * u * (1 - u) : 0;
    let pelY = this.stand - S.c + arc;
    let th = clamp(r.th, -1.0, 1.0);
    // the simulated lean is the whole-body angle; the picture adds a little posture: always a touch forward, more through the push and flight
    const posture = 0.09 + (air ? 0.12 * Math.max(0, 1 - u / 0.6) : 0.06 * clamp(crouchF, 0, 1));
    let pitch = th * 1.0 + posture, roll = 0, phi = 0;
    const pelX = r.x - 0.02 * k;
    this.pel.set(pelX, pelY, z);
    let feetX = S.cur, feetY = this.g + lift;
    let fallBlend = 0;
    if (S.fall) {
      const F = S.fall; F.t += dt;
      const thf = F.fwd ? FALL_FWD_LIE : FALL_BACK_LIE;
      let ang;
      if (down) {
        // accelerating topple (gravity), a small bounce on the ground
        const T = F.fwd ? 0.4 : 0.46, q = clamp(F.t / T, 0, 1);
        ang = lerp(F.th0, thf, q * q * (1.2 - 0.2 * q));
        if (F.t > T) ang += (F.fwd ? -1 : 1) * 0.07 * Math.exp(-(F.t - T) * 7) * Math.sin((F.t - T) * 22);
        S.gu = clamp((0.5 - r.downLeft) / 0.5, 0, 1) * 0.5;
      } else {
        S.gu = 0.5 + 0.5 * clamp(r.pt / 0.4, 0, 1);
        ang = thf;
      }
      const gu = smooth(S.gu);
      const lieAng = ang * (1 - gu);
      pitch = lieAng; phi = (F.fwd ? 0.5 : -0.5) * smooth(Math.abs(lieAng) / 1.2);
      fallBlend = 1;
      feetX = lerp(F.x, S.cur, 0); feetY = this.g + lerp(F.lift, 0, smooth(F.t / 0.18));
      if (rise) { feetX = S.cur = F.x; }
      S.cur = F.x;
    }
    // pelvis from the planted feet when falling (the body pivots about the sack)
    const yawQ = Qn().setFromAxisAngle(UP, Math.PI / 2);
    const axis = V(Math.cos(phi), 0, Math.sin(phi));
    const qPitch = Qn().setFromAxisAngle(axis, pitch);
    this.bq.copy(yawQ).multiply(qPitch);
    if (fallBlend) {
      const hp = this.stand - 0.0 - this.g;      // pelvis above the feet
      const off = V(0, hp, 0).applyQuaternion(this.bq);
      const py = Math.max(feetY - this.g + off.y + this.g, 0.22 * k);
      this.pel.set(feetX + off.x, py, z + off.z);
      // blend with the standing-based placement for the first instants so there is no pop
      const bl = smooth((S.fall.t || 0) / 0.08);
      this.pel.x = lerp(pelX, this.pel.x, bl); this.pel.y = lerp(pelY, this.pel.y, bl);
    } else {
      // whole-body lean about the pelvis (the planted sack tilts under it)
    }
    const upB = V(0, 1, 0).applyQuaternion(this.bq), latB = V(1, 0, 0).applyQuaternion(this.bq), fwdB = V(0, 0, 1).applyQuaternion(this.bq);

    // ---- the sack --------------------------------------------------------------------------------------------------------------------------
    const T = this.rim.copy(this.pel).addScaledVector(upB, 0.115 * k).addScaledVector(fwdB, 0.025 * k);
    const Bp = this.feet.set(feetX, Math.max(feetY - this.g, 0) - 0.01, z);
    if (fallBlend) Bp.y = Math.max(0.0, feetY - this.g);
    const kneeFlex = clamp(crouchF * 0.8 + (air ? Math.sin(Math.PI * u) * 0.9 : 0), 0, 1);
    const sq = clamp(crouchF, 0, 1);
    const sk = this.sack.update({ B: Bp, T, up: upB, side: latB, kneeFlex, squash: sq, flare: clamp(1 - lift / (0.04 * k), 0, 1) * (0.4 + 0.6 * sq), taut: air ? Math.sin(Math.PI * u) : 0, phase: S.ph, size: k });
    // lying: the sack rests on the ground (nothing below y = 0.0 at the rim ring)
    // ---- the body --------------------------------------------------------------------------------------------------------------------------
    // trunk: folds forward over the knees on the landing and in the crouch before the push, opens out through take-off and flight
    const drive = air ? Math.max(0, 1 - u / 0.22) : 0;
    const bend = 5 + 17 * clamp(th, -0.2, 1) + 13 * clamp(crouchF, 0, 1) + 7 * drive - (air ? 6 * Math.sin(Math.PI * clamp(u, 0, 1)) : 0);
    const torsoBend = fallBlend ? lerp(bend, 8, 0.7) : bend;
    const lookT = V(env.lookX ?? r.x + 4, 1.25 * k, z);
    const P = {
      pelvis: this.pel.clone(), yaw: Math.PI / 2, bodyQ: this.bq, groundY: 0,
      torso: { bend: torsoBend, side: Math.sin(S.ph * 1.3) * 1.2 + clamp(r.om, -2, 2) * 1.5, twist: air ? 5 * Math.sin(Math.PI * u + (r.hops & 1 ? Math.PI : 0)) : 0 },
      pelvisTilt: { bend: 4 * clamp(crouchF, 0, 1), side: 0, twist: 0 },
      legs: {}, arms: {},
      look: { target: lookT, w: fallBlend ? 0.35 : 0.9 },
    };
    // legs: feet together inside the sack, heels at the base
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? 1 : -1;
      const fp = feetPoint(feetX, feetY + 0.035 * k, z, sx * 0.07 * k, 0.0);
      P.legs[side] = { p: fp, f: 'w', w: 1, pole: [1, 0.15, 0], pf: 'w', aim: { n: [0, 1, 0], face: 'sole', fwd: [1, 0, 0], w: 0.0 } };
      void side;
    }
    // arms: both hands on the rim; reach for the ground in a fall; up after the finish
    const holdW = fallBlend ? 1 - smooth((Math.max(0, (S.fall.t || 0) - 0.05)) / 0.12) * (1 - smooth(S.gu * 1.6)) : 1;
    S.cel += ((r.finishT != null && r.place === 1 ? 1 : 0) - S.cel) * Math.min(1, dt * 5);
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? 1 : -1;
      const grip = (sx > 0 ? sk.rimL : sk.rimR).clone();
      grip.addScaledVector(upB, 0.02 * k);
      let tgtW = grip.clone(), poleV = latB.clone().multiplyScalar(0.8 * sx).addScaledVector(fwdB, -0.5).addScaledVector(upB, -0.2), ww = 1;
      if (fallBlend) {
        const F = S.fall, dirW = V(F.fwd ? 1 : -1, 0, 0), sh = this.pel.clone().addScaledVector(upB, 0.5 * k);
        const brace = sh.clone().addScaledVector(dirW, F.fwd ? 0.5 * k : -0.1 * k); brace.y = 0.06;
        brace.z = z + sx * -0.22 * k * (F.fwd ? 1 : -1) + (F.fwd ? 0.1 : 0.15);
        const reach = smooth((F.t || 0) / 0.2) * (1 - smooth(S.gu * 1.4));
        tgtW.lerp(brace, reach);
        poleV = V(0, 0.4, (sx > 0 ? -1 : 1) * 0.8);
      } else if (S.cel > 0.02) {
        const hi = this.pel.clone().addScaledVector(upB, 0.95 * k).addScaledVector(latB, sx * 0.34 * k);
        tgtW.lerp(hi, smooth(S.cel)); poleV = latB.clone().multiplyScalar(sx);
      }
      P.arms[side] = { p: [tgtW.x, tgtW.y, tgtW.z], f: 'w', w: ww * holdW + (1 - holdW) * 1, pole: [poleV.x, poleV.y, poleV.z], pf: 'w' };
      void holdW;
    }
    h.setPosition(0, 0, 0); h.setFacing(0); h.update(dt);
    a.apply(P, dt);
    h.setFingers('L', 'fist'); h.setFingers('R', 'fist');
    this.out.pelvis.copy(this.pel);
    this.out.tipY = this.pel.y + 0.95 * k;
    return { phase: r.phase, lift, planted: lift < 0.004 && !air };
  }

  headPoint(out = V()) { return this.h.bonePosition('Head', out); }
}

function feetPoint(x, y, z, dz, dx) { return [x + dx, y, z + dz]; }

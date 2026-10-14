// One birler: a real athlete skeleton posed every frame from the simulation state. Pure presentation: it reads the world (lean, feet speed,
// feet phase, kicks, fall time) and poses the body; nothing flows back.
//
//   on the log   short, quick steps in place: a foot stays on the log surface and is carried along with it, lifts, steps back over the
//                top and lands again (a saw-tooth in the sim's feet phase, so a faster log means faster steps). Knees stay bent.
//                The whole body tilts about the feet by the simulated lean, the trunk folds a little, the arms spread and swing
//                against the slip, wide and high when the lean is large.
//   kick         the kicker's lead foot is thrown up and stamped on the log, arms out, trunk kicked back.
//   fall         the body leaves the log sideways toward the camera and a little along it (the way it was leaning), arms windmill and
//                legs scramble, then it lands flat in the water with a splash and comes up treading water: head and shoulders
//                above the surface, hands paddling.
//   winner       arms up, small bounces, still stepping on the rolling log.
import { THREE } from '../vendor3d/index.js';
import { Actor } from './actor.js';
import { TOP, U } from './scene.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Qn = () => new THREE.Quaternion();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const UP = V(0, 1, 0);
export const HIT_T = 0.78;                 // same as art.js: seconds from losing balance to the water
const TAU = Math.PI * 2;

export class BirlerRig {
  constructor(human, k, idx) {
    this.h = human; this.k = k; this.idx = idx;
    this.a = new Actor(human);
    this.stand = this.a.pelvisRest.y - 0.075 * k;       // relaxed pelvis height, knees a little bent
    this.g = this.a.groundAnkle;
    this.s = { c: 0.0, sw: 0.0, kick: 0, cel: 0, fallZ: 0, prevFell: -1, wob: 0 };
    this.pel = V();
    this.out = { splash: null, head: V(), pelvis: V(), inWater: false, feet: [V(), V()] };
    this.state = 'stand';
  }

  /**
   * w: the sim world. env: { dt, t, x0 (metres), oppX (metres), top: y of the log top }
   * Returns { splashAt: {x, z} | null (the frame the body enters the water), state }.
   */
  step(w, env) {
    const i = this.idx, face = i === 0 ? 1 : -1, S = this.s, k = this.k, a = this.a, h = this.h, dt = env.dt, t = env.t;
    const x0 = env.x0, top = TOP;
    const falling = w.fell === i && (w.phase === 'fall' || w.phase === 'over');
    const win = w.fell === 1 - i && (w.phase === 'fall' || w.phase === 'over');
    // the sim applies lean impulses in one tick (kicks); the body follows through a critically damped spring so the torso never snaps
    const leanRaw = clamp(w.l[i] * face, -1.4, 1.4);
    if (S.leanS === undefined || Math.abs(leanRaw - S.leanS) > 1.2 || dt <= 0) S.leanS = leanRaw;
    else S.leanS += (leanRaw - S.leanS) * (1 - Math.exp(-dt / 0.07));
    const lean = falling ? leanRaw : S.leanS;
    const ff = w.f[i] * face;                               // feet speed, + toward the way it faces
    const yawQ = Qn().setFromAxisAngle(UP, face * Math.PI / 2);
    let splashAt = null;

    // ---- kick (only the kicker; the pulse is 0..1 over about 0.45 s) -----------------------------------------------------------------------
    let kick = 0;
    if (w.lastKick && w.lastKick.by === i && (w.phase === 'go' || w.phase === 'fall')) {
      const age = w.t - w.lastKick.t;
      if (age >= 0 && age < 0.5) kick = age < 0.16 ? age / 0.16 : Math.max(0, 1 - (age - 0.16) / 0.34);
    }
    S.kick += (kick - S.kick) * (1 - Math.exp(-dt * 16));

    // ---- the plan of the feet ---------------------------------------------------------------------------------------------------------------
    const u = w.ph[i] * 3 / TAU, amp = 0.19 * clamp(Math.abs(ff) * 3.6, 0.28, 1);
    const saw = (c) => { c -= Math.floor(c); return c < 0.6 ? { x: -0.5 + c / 0.6, lift: 0 } : { x: 0.5 - (c - 0.6) / 0.4, lift: Math.sin(Math.PI * (c - 0.6) / 0.4) }; };
    const fa = saw(u), fb = saw(u + 0.5);
    const baseLift = 0.13 * clamp(Math.abs(ff) * 3, 0.35, 1);

    // ---- posture ------------------------------------------------------------------------------------------------------------------------------
    const cT = 0.07 * k + 0.05 * k * Math.min(1, Math.abs(lean)) + (w.phase === 'ready' ? 0.03 * k : 0) + 0.05 * k * S.kick;
    S.c += (cT - S.c) * Math.min(1, dt * 9);
    let ang = lean * 0.30 - 0.12 * S.kick;                  // whole-body tilt about the feet (+ toward the way it faces)
    const bend = 7 + 11 * clamp(lean, -1, 1) + 6 * S.kick;
    const sway = Math.sin(t * 2.1 + i * 1.9) * 1.2 + clamp(w.wob || 0, -1, 1) * 7;

    // celebration eases in/out
    S.cel += ((win ? 1 : 0) - S.cel) * Math.min(1, dt * 5);

    // body placement over the planted feet
    let pelX = x0 + face * Math.sin(ang) * (this.stand - S.c);
    let pelY = top + (this.stand - S.c) * Math.cos(ang) - this.g * 0 + (win ? Math.abs(Math.sin(t * 7)) * 0.07 : 0);
    let pelZ = 0;
    let fallBlend = 0, inWater = false;
    let bodyQ = yawQ.clone().multiply(Qn().setFromAxisAngle(V(1, 0, 0), ang));
    let flailT = 0;
    if (falling) {
      fallBlend = 1;
      const ft = w.fallT, d = Math.sign(w.l[i]) || 1, ang0 = (S.fallAng0 ?? 0);
      if (S.prevFell !== i) { S.fallAng0 = clamp(lean * 0.30, -0.5, 0.5); S.fallY0 = pelY; S.fallX0 = pelX; S.fallZ = 0; }
      const y0 = S.fallY0, xs0 = S.fallX0;
      // direction of the fall: mostly toward the camera (off the side of the log), a little along it the way it was leaning
      const D = V(d * 0.32, 0, 0.95).normalize();
      const axis = V().crossVectors(UP, D).normalize();     // rotating UP about this tips it toward D
      let th, y, hz;
      if (ft < HIT_T) {
        const q = ft / HIT_T;
        th = 0.25 + 1.3 * Math.pow(q, 1.25);
        y = y0 + 1.15 * ft - 0.5 * 6.9 * ft * ft;
        hz = Math.pow(q, 0.9);
        flailT = 1;
      } else {
        const s = ft - HIT_T;
        th = lerp(1.55, 0.12, smooth(s / 0.7)) + 0.06 * Math.sin(s * 5);
        const yHit = y0 + 1.15 * HIT_T - 0.5 * 6.9 * HIT_T * HIT_T;
        y = lerp(yHit, -0.40 * k, smooth(s / 0.55)) + 0.035 * Math.sin(s * 5.5);
        hz = 1 + 0.12 * (1 - Math.exp(-s * 3));
        inWater = true;
        flailT = 0.5;
      }
      // horizontal travel of the pelvis
      pelX = xs0 + D.x * 1.1 * hz;
      pelZ = D.z * 1.25 * hz + 0.0;
      pelY = y;
      const fall = Qn().setFromAxisAngle(axis, th);
      bodyQ = fall.multiply(yawQ);
      // blend from the standing orientation so the topple starts without a snap
      if (S.lastQ && ft < 0.14) bodyQ = S.lastQ.clone().slerp(bodyQ, smooth(ft / 0.14));
      if (ft >= HIT_T && !S.splashed) { S.splashed = true; splashAt = { x: pelX, z: pelZ }; }
      void ang0;
    } else {
      S.prevFell = -1; S.splashed = false; S.lastQ = bodyQ.clone(); S.apw = null;
    }
    if (falling) S.prevFell = i;
    if (!falling && S.prevFell === -1) { /* standing */ }
    this.state = falling ? (inWater ? 'water' : 'fall') : win ? 'win' : 'stand';
    this.pel.set(pelX, pelY, pelZ);
    const upB = V(0, 1, 0).applyQuaternion(bodyQ), latB = V(1, 0, 0).applyQuaternion(bodyQ), fwdB = V(0, 0, 1).applyQuaternion(bodyQ);

    // ---- targets ---------------------------------------------------------------------------------------------------------------------------
    const P = {
      pelvis: this.pel.clone(), yaw: face * Math.PI / 2, bodyQ, groundY: 0,
      torso: { bend: falling ? 14 : bend, side: sway, twist: (falling ? 6 * Math.sin(t * 9) : 3 * Math.sin(u * TAU)) },
      pelvisTilt: { bend: 3 + 4 * S.kick, side: 0, twist: 0 },
      legs: {}, arms: {},
      look: { target: V(env.oppX, top + 1.45 * k, 0.0), w: falling ? 0.25 : 0.9 },
    };
    // feet (world targets while standing; body-frame targets while in the air / water)
    const footZ = [0.07 * k, -0.07 * k];
    const feet = [fa, fb];
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? 'L' : 'R';
      if (!falling) {
        const f = feet[s];
        let fx = x0 + face * f.x * amp * 2 * 1.0;
        let fy = top + this.g - 0.035 * k + baseLift * f.lift * k;
        // the kick: the lead foot (R) is thrown up and forward then stamped
        if (s === 1 && S.kick > 0.01) { fy += 0.30 * k * Math.sin(Math.PI * clamp(S.kick, 0, 1) * 0.9); fx += face * 0.16 * k * S.kick; }
        const kneeUp = s === 1 && S.kick > 0.01;
        P.legs[side] = {
          p: [fx, fy, footZ[s]], f: 'w', w: 1, pole: [face * 1, 0.1, 0.25], pf: 'w',
          aim: { n: [0, 1, 0], face: 'sole', fwd: [face, 0, 0], w: kneeUp ? 0.2 : 0.25 },
        };
        S.lastFootX = fx;
      } else {
        // scrambling in the air; treading water afterwards (hidden below the surface)
        const ph = t * 11 + s * Math.PI + i;
        P.legs[side] = {
          p: [(s ? 0.1 : -0.1) * k, (-this.stand + 0.1 * k) + 0.18 * k * Math.max(0, Math.sin(ph)), (s ? 0.05 : -0.05) * k + 0.14 * k * Math.cos(ph) * (inWater ? 0.4 : 1) - (inWater ? 0 : 0)],
          f: 'b', w: 1, pole: [0, 0.3, 1], pf: 'b',
        };
        if (inWater) P.legs[side].p[1] = -this.stand + 0.2 * k;
      }
    }
    // arms
    const lAbs = Math.abs(lean);
    const spread = (0.38 + 0.2 * lAbs + 0.12 * S.kick) * k;
    const wave = u * TAU;
    const flail = clamp((lAbs - 0.45) * 1.7, 0, 1);
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? 'L' : 'R', sx = s === 0 ? 1 : -1;
      let p;
      const swing = Math.sin(wave + (s ? Math.PI : 0));
      if (falling) {
        const ph = t * 15 + s * 2.4 + i;
        if (inWater) {
          // treading water: hands paddle just under / at the surface beside the shoulders
          const bw = Math.sin(t * 6 + s * Math.PI);
          p = [sx * 0.50 * k, 0.28 * k + 0.07 * bw * k, 0.28 * k * (0.5 + 0.5 * Math.cos(t * 6 + s * Math.PI))];
          const wp = [this.pel.x + latB.x * 0, -0.08 + 0.1 * bw, this.pel.z + 0.3 + 0.1 * bw];
          S.apw = S.apw || {};
          if (!S.apw[side]) S.apw[side] = wp.slice(); else { const al = 1 - Math.exp(-dt / 0.06); for (let q = 0; q < 3; q++) S.apw[side][q] += (wp[q] - S.apw[side][q]) * al; }
          P.arms[side] = { p: S.apw[side].slice(), f: 'w', w: 1, pole: [sx, -0.2, 0.3], pf: 'b' };
          void p;
          continue;
        }
        p = [sx * (0.5 + 0.2 * Math.sin(ph)) * k, (0.55 + 0.55 * Math.sin(ph)) * k, (0.15 + 0.45 * Math.cos(ph)) * k];
      } else if (S.cel > 0.05) {
        const cheer = [sx * 0.34 * k, 0.98 * k + 0.07 * Math.sin(t * 8 + s) * k, 0.12 * k];
        const base = [sx * spread, (0.4 + 0.1 * flail) * k, (0.2 + 0.25 * swing * 0.5) * k];
        p = base.map((v, q) => lerp(v, cheer[q], smooth(S.cel)));
      } else {
        const z = (0.20 + (0.12 + 0.22 * flail) * swing - 0.33 * lean + 0.30 * S.kick) * k;
        const y = (0.40 + 0.2 * lAbs + 0.14 * flail * Math.sin(t * 13 + s * 2) + 0.10 * S.kick) * k;
        p = [sx * spread, y, z];
      }
      // hand targets follow through a critically damped filter so kicks, celebrations and bout starts never pop the elbows
      if (!S.ap) { S.ap = {}; S.ap[side] = p.slice(); }
      else if (!S.ap[side]) S.ap[side] = p.slice();
      else { const al = 1 - Math.exp(-dt / (falling ? 0.03 : 0.055)); for (let q = 0; q < 3; q++) S.ap[side][q] += (p[q] - S.ap[side][q]) * al; }
      p = S.ap[side].slice();
      P.arms[side] = { p, f: 'b', w: 1, pole: [sx * 0.3, -0.6, -0.7], pf: 'b' };
    }
    h.setPosition(0, 0, 0); h.setFacing(0); h.update(dt);
    a.apply(P, dt);
    h.setFingers('L', 'open'); h.setFingers('R', 'open');
    this.out.pelvis.copy(this.pel);
    this.out.inWater = inWater;
    void upB; void latB; void fwdB; void flailT; void U; void fallBlend;
    return { splashAt, state: this.state };
  }
}

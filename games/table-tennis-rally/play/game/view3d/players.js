// The two athletes. Each has the real arm chain (shoulder, elbow, wrist); the hand is placed by two-bone IK so both segments
// keep their natural length and the elbow bends. The paddle is attached to the hand (short handle, gripping fingers). The body
// follows the paddle sideways, turns its shoulders for forehand and backhand, and the free hand balances (or holds the ball
// for the serve). Reads the published state only.
import { THREE, loadHuman } from '../vendor3d/index.js';
import { Actor } from './actor.js';
import { padTarget } from './stroke-pose.js';
import { createBat } from './bat.js';

const T = THREE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeIn = (t) => t * t;
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Shakehand grip. The handle runs diagonally across the palm from the heel toward the web between thumb and index finger; the
// three lower fingers wrap the handle, the index finger lies along the base edge of the blade on one face, the thumb rests on the
// other face. Curl angles are radians for [first, second, third] joint of each finger (thumb first); they differ a little per finger.
export const SHAKEHAND = {
  curl: [[0.30, 0.42, 0.28], [0.34, 0.30, 0.12], [1.10, 1.38, 0.80], [1.16, 1.44, 0.86], [1.22, 1.46, 0.88]],
  spread: [0.0, 0.10, 0.0, -0.03, -0.09],
};
export const FLAT_HAND = { curl: [[0.0, 0.02, 0.0], [0.02, 0.03, 0.02], [0.03, 0.05, 0.03], [0.04, 0.06, 0.04], [0.05, 0.07, 0.05]], spread: [0.22, 0.10, 0.02, -0.06, -0.16] };
export const BALANCE_HAND = { curl: [[0.18, 0.28, 0.16], [0.20, 0.34, 0.22], [0.26, 0.42, 0.28], [0.32, 0.50, 0.32], [0.38, 0.56, 0.36]], spread: [0.14, 0.08, 0.02, -0.05, -0.13] };
// human joint limits (radians) for the regression check: [min, max] per joint index (thumb and fingers) and spread
export const LIMITS = { curl: [[[-0.1, 1.2], [-0.1, 1.3], [-0.1, 1.2]], [[-0.35, 1.6], [-0.05, 1.95], [-0.05, 1.5]]], spread: [-0.35, 0.35] };
export const GRIP_DEFAULT = { a: 0, b: 1.2, roll: 0, slide: 0.035, lift: 0.012, palm: 0.5 };

export function createPlayers({ A, scene, quality }) {
  const PAD = A.PAD;
  const cfg = { phi: 0, handOffset: 0, lefty: false, grip: {} };   // phi: roll of the blade about the handle axis (set by the pose sheets)
  const sides = {
    p: { H: null, prop: A.padP, sg: 1, fh: 1, bodyX: 0, bodyZ: 2.3, turn: 0, free: new T.Vector3(), freeW: 0, arm: { up: [], fore: [] } },
    o: { H: null, prop: A.padO, sg: -1, fh: -1, bodyX: 0, bodyZ: -2.75, turn: 0, free: new T.Vector3(), freeW: 0, arm: { up: [], fore: [] } },
  };
  const tmpG = new T.Group();
  const q1 = new T.Quaternion(), q2 = new T.Quaternion(), v1 = new T.Vector3(), v2 = new T.Vector3(), v3 = new T.Vector3();
  const Yv = new T.Vector3(0, 1, 0);

  // build the hand-space transform of the paddle from the grip parameters and attach it (can be called again to retune)
  function regrip(S) {
    const H = S.H, fr = H.fingers.R, g = { ...GRIP_DEFAULT, ...cfg.grip };
    const fd = fr.fingerDir.clone().normalize(), pd = fr.palmDir.clone().normalize(), ac = fr.across.clone().normalize();
    const Y = fd.clone().multiplyScalar(Math.cos(g.b) * Math.cos(g.a)).addScaledVector(ac, -Math.sin(g.b) * Math.cos(g.a)).addScaledVector(pd, Math.sin(g.a)).normalize();
    const Z = ac.clone().sub(Y.clone().multiplyScalar(ac.dot(Y))).normalize().applyAxisAngle(Y, g.roll);
    const X = new T.Vector3().crossVectors(Y, Z);
    const q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z));
    const palmC = fr.knuckle.clone().multiplyScalar(g.palm).addScaledVector(pd, g.lift);
    const pos = palmC.addScaledVector(Y, -g.slide);
    H.attach(S.prop, 'R', { pos: pos.toArray(), quat: [q.x, q.y, q.z, q.w], pose: SHAKEHAND }, { fingers: SHAKEHAND });
    S.gq = S.prop.quaternion.clone(); S.gp = S.prop.position.clone();
    S.fr = fr;
  }

  function load(side, character, kit, skin, hair) {
    loadHuman({ character, kit, skin, hair }).then((h) => {
      scene.add(h.root); h.play('ready_stance'); h.setPosition(sides[side].bodyX, 0, sides[side].bodyZ);
      sides[side].H = h;
      regrip(sides[side]);
    }).catch((e) => console.warn('athlete failed', side, e));
  }
  A.padP.visible = false;                    // the player has no body: only the bat (bat.js)
  const bat = createBat(A);
  load('o', 'athlete_m', { top: '#d0392b', bottoms: '#16202e', socks: '#f2f2f2' }, 'tan', 'black');

  // torso twist (deg, + = turn left) through a stroke, by progress u (0 ready, .25 wound back, .65 contact, 1 follow-through end)
  const KEYS = [[0, 4], [0.25, 24], [0.65, -4], [1, -22]];
  const keyAt = (u) => { for (let i = 1; i < KEYS.length; i++) if (u <= KEYS[i][0]) { const [u0, a0] = KEYS[i - 1], [u1, a1] = KEYS[i]; return a0 + (a1 - a0) * ease((u - u0) / (u1 - u0)); } return KEYS[KEYS.length - 1][1]; };
  const KIND_F = { loop: 1.25, drive: 1, push: 0.4, chop: 0.7, block: 0.3, smash: 1.4, touch: 0.3, lob: 0.8, flick: 0.9, serveShort: 0.4, serveLong: 0.7, serveSpin: 0.6 };
  const handQuatFor = (fr, Fw, Pw) => {   // hand-bone world rotation that maps the hand's finger axis to Fw and its palm normal to Pw
    const a1 = fr.fingerDir.clone().normalize(), a2 = fr.palmDir.clone().sub(a1.clone().multiplyScalar(fr.palmDir.dot(a1))).normalize(), a3 = new T.Vector3().crossVectors(a1, a2);
    const b1 = Fw.clone().normalize(), b2 = Pw.clone().sub(b1.clone().multiplyScalar(Pw.dot(b1))).normalize(), b3 = new T.Vector3().crossVectors(b1, b2);
    const Ml = new T.Matrix4().makeBasis(a1, a2, a3), Mw = new T.Matrix4().makeBasis(b1, b2, b3);
    return new T.Quaternion().setFromRotationMatrix(Mw.multiply(Ml.transpose()));
  };

  function updateSide(side, v, dr, tNow, clock) {
    const S = sides[side], H = S.H;
    if (!H) return;
    if (!S.actor) { S.actor = new Actor(H); S.hq = null; S.leftPose = null; }
    const pad = v.pads[side], sg = S.sg, fh = S.fh;
    const holdBall = (v.phase === 'serve' && v.server === side) || (v.phase === 'toss' && v.server === side && pad.swing && tNow - pad.swing.t0 < 0.1);
    const serveStance = ((v.phase === 'serve' || v.phase === 'toss') && v.server === side) || !!(pad.swing && pad.swing.serve && tNow < pad.swing.tc + 0.55);
    const tg = padTarget(side, pad, tNow, clock, v.ball, serveStance);
    // ---- where the body stands: follow the paddle sideways, step to the depth of the stroke
    const wf = clamp((pad.x * fh + 0.3) / 0.4, 0, 1);                       // 1 = forehand stance, 0 = backhand stance
    const bodyTX = pad.x - fh * (0.24 * wf - 0.12 * (1 - wf));
    S.bodyX += (bodyTX - S.bodyX) * Math.min(1, dr * 10);
    S.bodyX = clamp(S.bodyX, bodyTX - 0.35, bodyTX + 0.35);
    const sw0 = pad.swing && tNow < pad.swing.tc + 0.4 ? pad.swing : null;
    const cz = sw0 && sw0.cpos ? clamp(Math.abs(sw0.cpos[2]), 1.5, 2.4) : 1.78;
    const bodyTZ = sg * (serveStance ? 1.84 : cz + 0.34);
    S.bodyZ += (bodyTZ - S.bodyZ) * Math.min(1, dr * (sw0 ? 22 : 10));
    const rel = (pad.x - S.bodyX) * fh;
    const backhand = wf < 0.5;
    S.turn += (clamp(rel * 0.5, -0.2, 0.3) - S.turn) * Math.min(1, dr * 12);
    const psi = Math.atan2(-S.bodyX, -S.bodyZ) - S.turn;
    // ---- torso track
    const kind = tg.kind, kf = KIND_F[kind] ?? 0.8;
    const sgn = backhand ? 1 : -1;                                          // wind up toward the paddle side (right: negative twist)
    const twistT = sgn * keyAt(clamp(tg.u, 0, 1)) * kf * (backhand ? 0.7 : 1);
    S.twist = S.twist === undefined ? twistT : S.twist + (twistT - S.twist) * Math.min(1, dr * 20);
    const sin = Math.sin(clamp(tg.u, 0, 1) * Math.PI);
    const bend = 9 + 9 * sin * kf + clamp((1.05 - (sw0 && sw0.cpos ? sw0.cpos[1] : 1.05)) * 30, 0, 12);
    const crouch = 0.10 + 0.045 * sin + clamp((1.0 - (sw0 && sw0.cpos ? sw0.cpos[1] : 1.0)) * 0.3, 0, 0.08);
    // ---- feet: locked to the floor, shuffle when the body has moved away from them
    const fwdV = new T.Vector3(Math.sin(psi), 0, Math.cos(psi)), leftV = new T.Vector3(Math.cos(psi), 0, -Math.sin(psi));
    const pel = new T.Vector3(S.bodyX, 0, S.bodyZ);
    const want = {
      R: pel.clone().addScaledVector(leftV, -0.18).addScaledVector(fwdV, -0.12 * wf + 0.04 * (1 - wf)),
      L: pel.clone().addScaledVector(leftV, 0.18).addScaledVector(fwdV, 0.10 * wf - 0.05 * (1 - wf)),
    };
    const feet = {};
    for (const f of ['L', 'R']) {
      want[f].y = S.actor.rest[f].ankleY;
      if (!S.lock) S.lock = { L: want.L.clone(), R: want.R.clone() }, S.stepper = { L: null, R: null };
      const st = S.stepper[f];
      if (!st && S.lock[f].distanceTo(want[f]) > 0.14) S.stepper[f] = { t: 0, from: S.lock[f].clone() };
      const s2 = S.stepper[f];
      if (s2) { s2.t += dr; const k = clamp(s2.t / 0.13, 0, 1), e = ease(k); S.lock[f].lerpVectors(s2.from, want[f], e); S.lock[f].y = want[f].y + 0.05 * Math.sin(k * Math.PI); if (k >= 1) S.stepper[f] = null; }
      feet[f] = S.lock[f].clone();
    }
    // ---- paddle blade frame (+Z face normal, +Y toward the tip) and the hand pose that puts the prop there
    const n = v1.set(Math.sin(tg.yaw) * Math.cos(tg.tilt) * sg, Math.sin(tg.tilt), -sg * Math.cos(tg.yaw) * Math.cos(tg.tilt));
    tmpG.position.set(tg.pos[0], tg.pos[1], tg.pos[2]); tmpG.up.set(0, 1, 0);
    tmpG.lookAt(tg.pos[0] + n.x, tg.pos[1] + n.y, tg.pos[2] + n.z);
    tmpG.rotateZ((backhand ? -0.35 : 0.4) * sg);
    tmpG.updateMatrixWorld(true);
    const Qb = tmpG.quaternion.clone();
    const bladeG = S.prop.children[0]; bladeG.rotation.y = cfg.phi;
    const Qp = Qb.clone().multiply(q1.setFromAxisAngle(Yv, -cfg.phi));
    const P0 = new T.Vector3(tg.pos[0], tg.pos[1], tg.pos[2]).sub(v2.set(0, PAD.cy, 0).applyQuaternion(Qp));
    const HqT = Qp.clone().multiply(S.gq.clone().invert());
    const Hp = P0.clone().sub(S.gp.clone().applyQuaternion(HqT));
    if (!S.hq) S.hq = HqT.clone();
    const near = sw0 ? Math.abs(tNow - sw0.tc) < 0.12 : false;
    S.hq.rotateTowards(HqT, Math.max(0.02, dr * (near ? 40 : 18)));      // angular speed limit: no snapping, still on target at contact
    // ---- arms: elbow hints, the free hand
    const rightV = leftV.clone().multiplyScalar(-1);
    const poleR = rightV.clone().multiplyScalar(0.55).addScaledVector(fwdV, -0.25).add(new T.Vector3(0, -0.8, 0));
    const shL = S.shL || (S.shL = new T.Vector3());
    H.bonePosition('L_UpperArm', shL);
    const sw = sin;
    const bal = shL.clone().addScaledVector(leftV, 0.16 + 0.12 * sw).addScaledVector(fwdV, 0.2 + 0.1 * tg.u).add(new T.Vector3(0, -0.34 + 0.1 * sw, 0));
    let goal = bal, hqL = null;
    const frL = H.fingers.L;
    if (holdBall && frL && frL.ok) {
      hqL = handQuatFor(frL, fwdV.clone().multiplyScalar(0.9).addScaledVector(rightV, 0.1), new T.Vector3(0, 1, 0));
      const palmC = frL.knuckle.clone().multiplyScalar(0.72).addScaledVector(frL.palmDir.clone().normalize(), 0.014);
      goal = new T.Vector3(v.ball[0], v.ball[1] - 0.031, v.ball[2]).sub(palmC.applyQuaternion(hqL));
    } else if (frL && frL.ok) hqL = handQuatFor(frL, fwdV.clone().multiplyScalar(0.7).add(new T.Vector3(0, -0.5, 0)), rightV);
    S.free.lerp(goal, holdBall ? 1 : Math.min(1, dr * 9));
    const wantPose = holdBall ? FLAT_HAND : BALANCE_HAND;
    if (S.leftPose !== wantPose) { H.setFingers('L', wantPose); S.leftPose = wantPose; }
    const poleL = leftV.clone().multiplyScalar(0.55).addScaledVector(fwdV, -0.2).add(new T.Vector3(0, -0.8, 0));
    // ---- the animation first, then the pose layer on top
    H.update(dr);
    S.actor.apply({
      yaw: psi, x: S.bodyX, z: S.bodyZ, crouch, torso: { bend, side: 0, twist: S.twist }, feet,
      arms: { R: { p: Hp, hq: S.hq, pole: poleR, w: 1 }, L: { p: S.free.clone(), hq: hqL, pole: poleL, w: 1 } },
    });
    // ---- measurements for the regression check
    const a = S.arm;
    a.reach = S.actor.out.handErr; a.shift = S.actor.out.shift;
    a.oriErr = H.bones.Bip01_R_Hand.getWorldQuaternion(new T.Quaternion()).angleTo(S.hq);
    S.prop.updateWorldMatrix(true, false);
    const blade = S.prop.localToWorld(new T.Vector3(0, PAD.cy, 0));
    if (pad.swing && !pad.swing.serve && pad.swing.cpos && Math.abs(tNow - pad.swing.tc) < 0.016) { const d = blade.distanceTo(new T.Vector3(...pad.swing.cpos)); if (!S.cErr || S.cErr.tc !== pad.swing.tc || d < S.cErr.d) S.cErr = { tc: pad.swing.tc, d, kind: tg.kind, c: pad.swing.cpos.map((x) => +x.toFixed(2)), wrist: Math.round((S.arm.wrist || 0) * 57.3), ori: Math.round((S.arm.oriErr || 0) * 57.3), shift: +(S.actor.out.shift || 0).toFixed(2) }; }
    { const hq = H.bones.Bip01_R_Hand.getWorldQuaternion(new T.Quaternion()); const fdW = S.fr.fingerDir.clone().normalize().applyQuaternion(hq); const fa = H.bonePosition('R_Hand', new T.Vector3()).sub(H.bonePosition('R_Forearm', new T.Vector3())).normalize(); a.wrist = Math.acos(clamp(fdW.dot(fa), -1, 1)); }
    { const ps = ['R_Hand', 'R_Finger2', 'R_Finger21', 'R_Finger22'].map((nm) => H.bonePosition(nm, new T.Vector3())); a.handLen = ps[0].distanceTo(ps[1]) + ps[1].distanceTo(ps[2]) + ps[2].distanceTo(ps[3]) + 0.02; }
    for (const [k, [u, m, e]] of Object.entries({ R: ['R_UpperArm', 'R_Forearm', 'R_Hand'], L: ['L_UpperArm', 'L_Forearm', 'L_Hand'] })) {
      const pu = H.bonePosition(u, new T.Vector3()), pm = H.bonePosition(m, new T.Vector3()), pe = H.bonePosition(e, new T.Vector3());
      a[k] = { upper: pu.distanceTo(pm), fore: pm.distanceTo(pe), elbow: pm.y };
    }
    a.contactCm = S.cErr ? S.cErr.d * 100 : null; a.contactInfo = S.cErr;
  }

  return {
    cfg, sides, regrip: () => { for (const k of ['p', 'o']) if (sides[k].H) regrip(sides[k]); },
    bat,
    update(v, dr, tNow, clock, ctx) {
      bat.update(v, dr, tNow, clock, ctx);
      const vis = !v.machine;
      if (sides.o.H) sides.o.H.root.visible = vis;
      sides.o.prop.visible = vis;
      if (vis) updateSide('o', v, dr, tNow, clock);
    },
    hit(e) { if (e.side === 'p') bat.impact(e); },
    setOpponentKit(hue) { const H = sides.o.H; if (H && sides.o.hue !== hue) { sides.o.hue = hue; H.setKit({ top: `hsl(${hue},70%,45%)` }); } },
    // regression data: the current finger pose (joint curls, spreads) and the smallest distance of any finger centre-line point from the
    // rubber plane while it is over the blade (negative = inside the blade)
    fingerState(side = 'p') { const S = sides[side]; if (!S.H) return null; const p = S.H.fingers.R.pose; return { curl: p.curl.map((r) => r.slice()), spread: p.spread.slice() }; },
    bladeClearance(side = 'p') {
      const S = sides[side]; if (!S.H) return null;
      S.prop.updateWorldMatrix(true, true);
      const pts = [];
      for (let f = 0; f < 5; f++) { const ch = [`R_Finger${f}`, `R_Finger${f}1`, `R_Finger${f}2`].map((n) => S.H.bonePosition(n, new T.Vector3())); pts.push(...ch); pts.push(ch[2].clone().add(ch[2].clone().sub(ch[1]).setLength(0.022))); for (let i = 0; i < 2; i++) pts.push(ch[i].clone().add(ch[i + 1]).multiplyScalar(0.5)); }
      let min = 9;
      for (const w of pts) { const l = S.prop.worldToLocal(w.clone()); const rx = Math.hypot(l.x, l.y - PAD.cy); if (rx < PAD.R * 0.97) min = Math.min(min, Math.abs(l.z) - 0.0072); }
      return min;
    },
    armLengths() { return { p: sides.p.arm, o: sides.o.arm, pad: { handle: PAD.hl, blade: PAD.R * 2, total: PAD.hl + PAD.R * 2 * 0.95 } }; },
  };
}

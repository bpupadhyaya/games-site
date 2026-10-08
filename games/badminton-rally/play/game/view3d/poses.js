// Badminton body language on top of the base locomotion clips, built with the Actor's pelvis anchor, torso lean / twist and two-bone IK:
// ready stance, overhead strokes (trophy pose, whip, follow-through, a jump for high smashes), drives, underhand lifts and net lunges, and the
// low serve. The sim owns every time and position; the racket head is solved onto the shuttle's contact point at the exact contact tick
// (a correction loop shifts the wrist target until the sweet spot of the racket is on the point).
import { THREE } from '../vendor3d/index.js';
import { setBoneWorldQuat } from './actor.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const easeOut = (k) => { k = clamp(k, 0, 1); return 1 - (1 - k) * (1 - k); };
const easeIn = (k, p = 2) => Math.pow(clamp(k, 0, 1), p);
const angDiff = (a, b) => { const d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); };
const D2R = Math.PI / 180;
const SWEET = 0.54;

// racket orientation from its long axis and its face normal: local Y = axis, Z = normal, X = Y x Z
const _x = V(), _y = V(), _z = V(), _m = new THREE.Matrix4();
function basisQ(axis, normal) {
  _y.copy(axis).normalize();
  _z.copy(normal).addScaledVector(_y, -normal.dot(_y));
  if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1);
  _z.normalize();
  _x.crossVectors(_y, _z).normalize();
  return Q().setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
}

// key = { r, u, f: wrist offset from the pelvis in the court frame (right, up, forward), a: axis (r,u,f), n: normal (r,u,f) }
const K = (r, u, f, a, n) => ({ r, u, f, a, n });
const READY = K(0.3, 0.55, 0.38, [0.1, 0.9, 0.42], [-0.45, 0.1, 0.8]);
const KEYS = {
  over: { back: K(0.2, 0.7, -0.3, [0.35, -0.78, -0.5], [0.85, 0.25, -0.3]), follow: K(-0.05, 0.28, 0.5, [-0.2, -0.45, 0.85], [-0.1, 0.9, 0.3]) },
  mid: { back: K(0.62, 0.42, -0.16, [0.85, 0.12, -0.3], [0.1, 0.25, 0.95]), follow: K(-0.4, 0.4, 0.45, [-0.8, 0.1, 0.55], [0, 0.3, 0.9]) },
  low: { back: K(0.4, 0.14, 0.12, [0.5, 0.35, 0.5], [0.3, 0.8, 0.4]), follow: K(0.1, 0.5, 0.5, [0.05, 0.8, 0.6], [0, 0.6, 0.8]) },
  serve: { back: K(0.28, 0.2, -0.3, [0.25, -0.35, -0.85], [0.6, 0.55, -0.1]), follow: K(0.05, 0.55, 0.5, [0, 0.85, 0.5], [0, 0.65, 0.75]) },
};

export function poseFor(P, s, sp, d, pa, D, dt) {
  const H = pa.h, A = pa.a, racket = pa.racket;
  const side = sp.side, baseYaw = side > 0 ? Math.PI : 0;
  const td = D.td;
  const sw = sp.sw;
  const F = V(0, 0, -side), Rc = V(side, 0, 0), Lc = V(-side, 0, 0), UP = V(0, 1, 0);
  const speed = Math.hypot(d.vx, d.vz);
  // ---- what is the stroke doing now
  let ph = 'ready', u = 0, tc = 0, cls = 'mid', hasStroke = false;
  if (sw) {
    tc = sw.tc; cls = sw.cls;
    const tb = cls === 'serve' ? 0.34 : 0.5, ts = cls === 'serve' ? 0.14 : 0.17;
    if (td >= tc - tb - 0.05 && td <= tc + 0.78) {
      hasStroke = true;
      if (td < tc - ts) { ph = 'prep'; u = clamp((td - (tc - tb)) / (tb - ts), 0, 1); }
      else if (td < tc) { ph = 'swing'; u = clamp((td - (tc - ts)) / ts, 0, 1); }
      else if (td < tc + 0.26) { ph = 'follow'; u = clamp((td - tc) / 0.26, 0, 1); }
      else { ph = 'recover'; u = clamp((td - tc - 0.26) / 0.5, 0, 1); }
    }
  }
  const rs = sw && sw.forehand === false ? -1 : 1;          // -1 = backhand
  // ---- body yaw
  const vdir = Math.atan2(d.vx, d.vz);
  let target = baseYaw;
  if (speed > 1.6 && !hasStroke) {
    const dl = angDiff(vdir, baseYaw), k = clamp((speed - 1.6) / 3, 0.35, 1);
    target = baseYaw + dl * k;
  }
  if (hasStroke) {
    const stance = baseYaw - rs * (cls === 'over' || cls === 'serve' ? 0.95 : cls === 'mid' ? 0.7 : 0.45), openC = baseYaw - rs * 0.18;
    if (ph === 'prep') target = lerp(pa.byaw, stance, sm(u)) * 0 + stance;
    else if (ph === 'swing') target = lerp(stance, openC, easeIn(u, 1.6));
    else target = openC;
  }
  if (pa.byaw === undefined) pa.byaw = baseYaw;
  const rate = (hasStroke ? 12 : 8) * dt;
  pa.byaw += clamp(angDiff(target, pa.byaw), -rate, rate);
  if (hasStroke && ph !== 'prep') pa.byaw = target;
  const yaw = pa.byaw;
  H.setFacing(yaw);
  // ---- base animation
  H.locomote(speed, { set: { idle: 'ready_stance' } });
  H.update(dt);
  const pelvisBase = A.b.pelvis.getWorldPosition(V());
  const footAnim = { L: A.b.L.foot.getWorldPosition(V()), R: A.b.R.foot.getWorldPosition(V()) };
  const t = performance.now() / 1000;
  const fwdB = V(Math.sin(yaw), 0, Math.cos(yaw)), leftB = V(Math.cos(yaw), 0, -Math.sin(yaw));
  const P2 = { pelvis: pelvisBase.clone(), yaw, pitch: 0, roll: 0, groundY: 0, torso: { bend: 6 + clamp(speed * 1.6, 0, 8), side: 0, twist: 0 }, pelvisTilt: { bend: 0, side: 0, twist: 0 }, legs: { L: null, R: null }, arms: { L: null, R: null } };
  P2.torso.twist = Math.sin(t * 0.8 + pa.seed * 6) * 2;
  let dy = 0, legLift = 0, lunge = 0, jy = 0, lookAt = null;

  // ---- the racket target for this moment (wrist position + racket orientation)
  const C = sw ? V(sw.x, sw.y, sw.z) : null;
  const rp = racket.position, rq = racket.quaternion, rqInv = rq.clone().invert();
  const off = rp.clone().add(V(0, SWEET, 0).applyQuaternion(rq));       // sweet spot in hand space
  const mkKey = (k, mirror) => {
    const m = mirror ? rs : 1;
    const pos = pelvisBase.clone().addScaledVector(Rc, k.r * m).addScaledVector(UP, k.u).addScaledVector(F, k.f);
    const axis = V().addScaledVector(Rc, k.a[0] * m).addScaledVector(UP, k.a[1]).addScaledVector(F, k.a[2]);
    const nrm = V().addScaledVector(Rc, k.n[0] * m).addScaledVector(UP, k.n[1]).addScaledVector(F, k.n[2]);
    return { pos, q: basisQ(axis, nrm) };
  };
  let key = mkKey(READY, false), armW = 0.88;
  const shot = sw && sw.shot;
  if (hasStroke) {
    const KS = KEYS[cls] || KEYS.mid;
    const ready = mkKey(READY, false), back = mkKey(KS.back, true), follow0 = KS.follow;
    // contact key: the racket's sweet spot is ON the shuttle at tc
    const tilt = shot === 'smash' ? -0.5 : shot === 'drive' ? 0 : shot === 'drop' || shot === 'net' || shot === 'block' ? 0.25 : shot === 'clear' || shot === 'lift' || shot === 'serveLong' ? 0.65 : 0.25;
    let axisC, nrmC;
    if (cls === 'over') { axisC = V().addScaledVector(UP, 1).addScaledVector(F, 0.3).addScaledVector(Rc, 0.06 * rs); nrmC = V().addScaledVector(F, 1).addScaledVector(UP, tilt); }
    else if (cls === 'mid') { axisC = V().addScaledVector(Rc, 0.55 * rs).addScaledVector(F, 0.7).addScaledVector(UP, 0.25); nrmC = V().addScaledVector(F, 1).addScaledVector(UP, tilt * 0.6).addScaledVector(Rc, -0.25 * rs); }
    else if (cls === 'serve') { axisC = V().addScaledVector(F, 0.95).addScaledVector(UP, 0.2).addScaledVector(Rc, 0.1); nrmC = V().addScaledVector(F, 0.4).addScaledVector(UP, 0.8); }
    else { axisC = V().addScaledVector(F, 0.55).addScaledVector(UP, 0.75).addScaledVector(Rc, 0.12 * rs); nrmC = V().addScaledVector(F, 0.6).addScaledVector(UP, 0.8); }
    const qC = basisQ(axisC, nrmC), qHc = qC.clone().multiply(rqInv);
    const contact = { pos: C.clone().sub(off.clone().applyQuaternion(qHc)), q: qC };
    // follow-through, relative to the contact wrist
    const fs = shot === 'smash' || shot === 'clear' || shot === 'drive' || shot === 'lift' || shot === 'serveLong' ? 1 : 0.5;
    const FO = { over: [-0.05, -0.5, 0.3], mid: [-0.55, 0, 0.25], low: [-0.1, 0.3, 0.18], serve: [0, 0.35, 0.3] }[cls] || [0, 0, 0.2];
    const fol = { pos: contact.pos.clone().addScaledVector(Rc, FO[0] * rs * fs).addScaledVector(UP, FO[1] * fs).addScaledVector(F, FO[2] * fs), q: mkKey(follow0, true).q };
    const mix = (a, b, e) => ({ pos: a.pos.clone().lerp(b.pos, e), q: a.q.clone().slerp(b.q, e) });
    if (ph === 'prep') key = mix(ready, back, sm(u));
    else if (ph === 'swing') key = mix(back, contact, easeIn(u, cls === 'serve' ? 1.5 : 2.1));
    else if (ph === 'follow') key = mix(contact, fol, easeOut(u));
    else key = mix(fol, ready, sm(u));
    armW = 1;
    if (ph === 'recover') armW = lerp(1, 0.88, sm(u));
    // body: weight back during the prep, through the shot at the contact
    const tk = cls === 'serve' ? 0.4 : 1;
    const tw = tk * (ph === 'prep' ? lerp(0, -34 * rs, sm(u)) : ph === 'swing' ? lerp(-34 * rs, 52 * rs, easeIn(u, 1.7)) : ph === 'follow' ? lerp(52 * rs, 34 * rs, u) : lerp(34 * rs, 0, sm(u)));
    P2.torso.twist += tw;
    const bendK = cls === 'low' ? 30 : cls === 'serve' ? 8 : cls === 'over' ? 10 : 18;
    P2.torso.bend = lerp(6, bendK, ph === 'prep' ? sm(u) * 0.4 : ph === 'swing' ? 0.4 + 0.6 * u : ph === 'follow' ? 1 - 0.3 * u : 0.7 * (1 - sm(u))) + clamp(speed * 1.2, 0, 6);
    P2.torso.side = cls === 'over' ? -rs * 8 * (ph === 'swing' ? u : ph === 'prep' ? 0 : 1 - u) : 0;
    // a high contact: a hop that peaks at the contact; a low one: a lunge
    const win = clamp(1 - Math.abs(td - tc) / 0.26, 0, 1);
    if (cls === 'over') { const need = clamp(C.y - 2.3, 0, 0.7); jy = Math.max(need * 0.8, shot === 'smash' ? 0.14 : 0) * Math.sin(Math.PI * clamp((td - (tc - 0.22)) / 0.44, 0, 1)); }
    if (cls === 'low') { lunge = sm(win); dy = -0.2 * lunge; }
    if (cls === 'mid') { lunge = sm(win) * 0.4; dy = -0.08 * lunge; }
    // the free hand
    const free = V();
    if (cls === 'serve') free.copy(pelvisBase).addScaledVector(F, 0.38).addScaledVector(UP, ph === 'follow' || ph === 'recover' ? 0.3 : 0.5).addScaledVector(Lc, 0.12);
    else if (ph === 'prep' || ph === 'swing') free.copy(pelvisBase).addScaledVector(F, 0.45).addScaledVector(UP, cls === 'low' ? 0.2 : 0.95).addScaledVector(Lc, 0.25 + 0.1 * Math.sin(u * 3));
    else free.copy(pelvisBase).addScaledVector(F, 0.2).addScaledVector(UP, 0.5).addScaledVector(Lc, 0.28);
    if (cls === 'over' && (ph === 'prep' || ph === 'swing')) free.lerp(C, 0.25);
    P2.arms.L = { p: [free.x, free.y, free.z], f: 'w', w: sm(clamp((td - (tc - tb0(cls) - 0.05)) / 0.2, 0, 1)) * (ph === 'recover' ? 1 - sm(u) : 1), pole: [Lc.x * 0.7, -0.3, Lc.z * 0.7 - 0.2], pf: 'w' };
    lookAt = C.clone();
  } else {
    // idle ready stance: racket up in front, the free arm left to the animation
    key = mkKey(READY, false);
    const bob = Math.sin(t * 2.2 + pa.seed * 5) * 0.015;
    key.pos.y += bob;
  }
  function tb0(c) { return c === 'serve' ? 0.34 : 0.5; }
  if (!lookAt) lookAt = V(P.ball ? P.ball.position.x : 0, P.ball ? P.ball.position.y : 1.5, P.ball ? P.ball.position.z : 0);

  // ---- the pelvis: dip, jump, lean towards a far contact
  P2.pelvis.y += dy + jy;
  if (lunge > 0.01) P2.pelvis.addScaledVector(F, 0.22 * lunge);
  if (hasStroke && C) {
    const shoulder = A.b.R.up.getWorldPosition(V()); shoulder.y += dy + jy;
    const wr = key.pos, need = shoulder.distanceTo(wr) - 0.6 * (H.root.scale.y || 1);
    if (need > 0 && ph !== 'recover') { const dir = wr.clone().sub(shoulder).setY(0).normalize(); P2.pelvis.addScaledVector(dir, Math.min(0.4, need * 0.8)); P2.torso.bend += need * (cls === 'serve' ? 8 : 20); }
  }
  // legs follow the pelvis: feet held on the ground (or lifted with a jump), the front foot forward in a lunge
  if (Math.abs(dy) > 0.002 || jy > 0.003 || lunge > 0.01) {
    for (const sd of ['L', 'R']) {
      const f = footAnim[sd].clone();
      const front = sd === 'R' ? rs : -rs;                 // the racket-side foot steps towards the net on a lunge
      if (lunge > 0.01) f.addScaledVector(F, 0.45 * lunge * (front > 0 ? 1 : -0.5)).addScaledVector(Rc, 0.12 * lunge * (sd === 'R' ? 1 : -1));
      f.y = Math.max(A.groundAnkle, f.y) + (jy > 0.003 ? jy * (sd === 'R' ? 0.8 : 1.0) : 0);
      P2.legs[sd] = { p: [f.x, f.y, f.z], f: 'w', w: 1, pole: [0, 0.1, 1], pf: 'g', aim: jy < 0.01 ? { n: [0, -1, 0], face: 'sole', fwd: [F.x, 0, F.z], w: 1 } : undefined };
    }
  }
  if (lookAt) P2.look = { target: lookAt, w: 0.8 };

  // ---- solve: the right wrist to the key, the hand turned so the racket has the key orientation
  const qH = key.q.clone().multiply(rqInv);               // hand world orientation
  const polR = V().addScaledVector(Rc, 1).addScaledVector(UP, cls === 'over' && hasStroke ? 0.45 : -0.2).addScaledVector(F, -0.25);
  const wtgt = key.pos.clone();
  P2.arms.R = { p: [wtgt.x, wtgt.y, wtgt.z], f: 'w', w: armW, pole: [polR.x, polR.y, polR.z], pf: 'w' };
  const hand = A.b.R.hand;
  const applyHand = () => {
    const cur = hand.getWorldQuaternion(Q());
    // limit how far the wrist is turned away from the forearm's own orientation (no candy-wrapper twist)
    const ang = cur.angleTo(qH), maxA = 1.9;
    const tq = ang > maxA ? cur.clone().slerp(qH, maxA / ang) : qH;
    setBoneWorldQuat(hand, cur.clone().slerp(tq, armW));
  };
  A.snapshot();
  A._run(P2);
  applyHand();
  // contact correction: bring the racket's sweet spot onto the shuttle
  if (hasStroke && C && Math.abs(td - tc) < 0.2 && !A.lite) {
    const w = clamp(1 - Math.abs(td - tc) / 0.2, 0, 1);
    for (let it = 0; it < 3; it++) {
      const sweet = racket.localToWorld(V(0, SWEET, 0));
      const want = ph === 'swing' || ph === 'follow' ? C : null;
      if (!want) break;
      const err = C.clone().sub(sweet);
      if (err.length() < 0.006 || err.length() > 0.7) break;
      P2.arms.R.p = [P2.arms.R.p[0] + err.x * w, P2.arms.R.p[1] + err.y * w, P2.arms.R.p[2] + err.z * w];
      A.restore(); A._run(P2); applyHand();
    }
  }
  racket.updateMatrixWorld(true);
  pa.report = { ph, cls, hasStroke };
}
